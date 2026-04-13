"""
backend/common/prisma_client.py

asyncpg-based client that mimics prisma-client-py's API.
Prisma runs on Node only; Python hits Postgres directly via asyncpg.

Schema-accurate relation map built from schema.prisma.
Student <-> Course is an implicit many-to-many via "_CourseStudents".
"""

import os
from contextlib import asynccontextmanager
from typing import Any

import asyncpg
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

# ---------------------------------------------------------------------------
# Relation map
# Format: rel_name -> (joined_table, local_fk, foreign_fk, is_many, join_table_info)
# join_table_info (only for m2m): (join_table, join_local_col, join_foreign_col)
# ---------------------------------------------------------------------------
RELATIONS: dict[str, dict[str, tuple]] = {
    "User": {
        # User.id -> Teacher.userId
        "teacher": ("Teacher", "id", "userId", False, None),
        # User.id -> Student.userId
        "student": ("Student", "id", "userId", False, None),
    },
    "Teacher": {
        # Teacher.userId -> User.id
        "user":       ("User",       "userId",       "id",  False, None),
        # Teacher.departmentId -> Department.id
        "department": ("Department", "departmentId", "id",  False, None),
        # Teacher.id -> Course.teacherId
        "courses":    ("Course",     "id",           "teacherId", True, None),
    },
    "Student": {
        # Student.userId -> User.id
        "user":       ("User",    "userId",    "id",  False, None),
        # Student.programId -> Program.id
        "program":    ("Program", "programId", "id",  False, None),
        # m2m via _CourseStudents (Prisma implicit table: A=Course, B=Student)
        "courses":    ("Course",  "id",        "id",  True,  ("_CourseStudents", "B", "A")),
        # Student.id -> Attendance.studentId
        "attendance": ("Attendance", "id", "studentId", True, None),
    },
    "Department": {
        # Department.id -> Teacher.departmentId
        "teachers": ("Teacher", "id", "departmentId", True, None),
        # Department.id -> Program.departmentId
        "programs": ("Program", "id", "departmentId", True, None),
    },
    "Program": {
        # Program.departmentId -> Department.id
        "department":    ("Department",   "departmentId", "id",        False, None),
        # Program.id -> AcademicYear.programId
        "academicYears": ("AcademicYear", "id",           "programId", True,  None),
        # Program.id -> Student.programId
        "students":      ("Student",      "id",           "programId", True,  None),
    },
    "AcademicYear": {
        # AcademicYear.programId -> Program.id
        "program":   ("Program",  "programId",     "id",            False, None),
        # AcademicYear.id -> Semester.academicYearId
        "semesters": ("Semester", "id",            "academicYearId", True, None),
    },
    "Semester": {
        # Semester.academicYearId -> AcademicYear.id
        "academicYear": ("AcademicYear", "academicYearId", "id",        False, None),
        # Semester.id -> Course.semesterId
        "courses":      ("Course",       "id",             "semesterId", True, None),
    },
    "Course": {
        # Course.teacherId -> Teacher.id
        "teacher":  ("Teacher",  "teacherId",  "id", False, None),
        # Course.semesterId -> Semester.id
        "semester": ("Semester", "semesterId", "id", False, None),
        # m2m via _CourseStudents (A=Course, B=Student)
        "students": ("Student",  "id",         "id", True,  ("_CourseStudents", "A", "B")),
        # Course.id -> Attendance.courseId
        "attendance": ("Attendance", "id", "courseId", True, None),
    },
    "Attendance": {
        # Attendance.studentId -> Student.id
        "student": ("Student", "studentId", "id", False, None),
        # Attendance.courseId -> Course.id
        "course":  ("Course",  "courseId",  "id", False, None),
    },
}


# ---------------------------------------------------------------------------
# Row — dot-access wrapper so service.py can do obj.teacher.user.name
# ---------------------------------------------------------------------------
class Row:
    def __init__(self, data: dict):
        for k, v in data.items():
            if isinstance(v, dict):
                setattr(self, k, Row(v))
            elif isinstance(v, list):
                setattr(self, k, [Row(i) if isinstance(i, dict) else i for i in v])
            else:
                setattr(self, k, v)
        self._data = data

    def __repr__(self):          return f"Row({self._data})"
    def __bool__(self):          return True
    def __getitem__(self, k):    return self._data[k]
    def get(self, k, d=None):   return self._data.get(k, d)


def _to_rows(rows: list[dict]) -> list[Row]:
    return [Row(r) for r in rows]


# ---------------------------------------------------------------------------
# WHERE clause builder
# Supports: {"field": value}, {"field": {"in": [...]}}, {"field": {"gte/lte": v}}
# ---------------------------------------------------------------------------
def _build_where(where: dict, start: int = 1) -> tuple[str, list]:
    clauses, values, i = [], [], start
    for k, v in where.items():
        if isinstance(v, dict):
            if "in" in v:
                ph = ", ".join(f"${j}" for j in range(i, i + len(v["in"])))
                clauses.append(f'"{k}" IN ({ph})')
                values.extend(v["in"]); i += len(v["in"])
            elif "gte" in v:
                clauses.append(f'"{k}" >= ${i}'); values.append(v["gte"]); i += 1
            elif "lte" in v:
                clauses.append(f'"{k}" <= ${i}'); values.append(v["lte"]); i += 1
        else:
            clauses.append(f'"{k}" = ${i}'); values.append(v); i += 1
    return " AND ".join(clauses), values


def _order_sql(order: dict | None) -> str:
    if not order:
        return ""
    parts = [f'"{k}" {"ASC" if v == "asc" else "DESC"}' for k, v in order.items()]
    return "ORDER BY " + ", ".join(parts)


# ---------------------------------------------------------------------------
# Relation loader — recursively resolves include dicts
# ---------------------------------------------------------------------------
async def _load_includes(
    table: str, rows: list[dict], include: dict, conn=None
) -> list[dict]:
    if not rows or not include:
        return rows

    rel_map = RELATIONS.get(table, {})

    async def _fetch(q, *args):
        return await conn.fetch(q, *args) if conn else await db.fetch(q, *args)

    for rel_name, rel_opts in include.items():

        # ── _count: {"select": {"programs": True, ...}} ──────────────────
        if rel_name == "_count":
            select_parts = rel_opts.get("select", {}) if isinstance(rel_opts, dict) else {}
            for count_rel in select_parts:
                info = rel_map.get(count_rel)
                if not info:
                    continue
                _jt, local_fk, foreign_fk, _, m2m = info

                if m2m:
                    jt_name, jt_local, jt_foreign = m2m
                    parent_ids = [r[local_fk] for r in rows if r.get(local_fk)]
                    if not parent_ids:
                        for r in rows: r.setdefault("_count", {})[count_rel] = 0
                        continue
                    q = (
                        f'SELECT "{jt_local}", COUNT(*) AS cnt FROM "{jt_name}"'
                        f' WHERE "{jt_local}" = ANY($1::text[]) GROUP BY "{jt_local}"'
                    )
                    crows = await _fetch(q, parent_ids)
                    cmap = {cr[jt_local]: cr["cnt"] for cr in crows}
                    for r in rows:
                        r.setdefault("_count", {})[count_rel] = cmap.get(r.get(local_fk), 0)
                else:
                    parent_ids = [r[local_fk] for r in rows if r.get(local_fk)]
                    if not parent_ids:
                        for r in rows: r.setdefault("_count", {})[count_rel] = 0
                        continue
                    q = (
                        f'SELECT "{foreign_fk}", COUNT(*) AS cnt FROM "{_jt}"'
                        f' WHERE "{foreign_fk}" = ANY($1::text[]) GROUP BY "{foreign_fk}"'
                    )
                    crows = await _fetch(q, parent_ids)
                    cmap = {cr[foreign_fk]: cr["cnt"] for cr in crows}
                    for r in rows:
                        r.setdefault("_count", {})[count_rel] = cmap.get(r.get(local_fk), 0)
            continue

        rel_info = rel_map.get(rel_name)
        if not rel_info:
            continue

        joined_table, local_fk, foreign_fk, is_many, m2m = rel_info
        nested_include = rel_opts.get("include") if isinstance(rel_opts, dict) else None

        parent_ids = list({r[local_fk] for r in rows if r.get(local_fk) is not None})
        if not parent_ids:
            for r in rows: r[rel_name] = [] if is_many else None
            continue

        # ── Many-to-many via implicit join table ──────────────────────────
        if m2m:
            jt_name, jt_local, jt_foreign = m2m
            # fetch join rows
            jq = f'SELECT "{jt_local}", "{jt_foreign}" FROM "{jt_name}" WHERE "{jt_local}" = ANY($1::text[])'
            join_rows = await _fetch(jq, parent_ids)
            foreign_ids = list({jr[jt_foreign] for jr in join_rows})

            if not foreign_ids:
                for r in rows: r[rel_name] = []
                continue

            rq = f'SELECT * FROM "{joined_table}" WHERE "id" = ANY($1::text[])'
            related_records = [dict(rr) for rr in await _fetch(rq, foreign_ids)]

            if nested_include:
                related_records = await _load_includes(joined_table, related_records, nested_include, conn)

            # build lookup: parent_id -> [related rows]
            foreign_by_id = {rd["id"]: rd for rd in related_records}
            idx: dict[Any, list] = {}
            for jr in join_rows:
                rd = foreign_by_id.get(jr[jt_foreign])
                if rd:
                    idx.setdefault(jr[jt_local], []).append(rd)
            for r in rows:
                r[rel_name] = idx.get(r[local_fk], [])
            continue

        # ── Regular relation ──────────────────────────────────────────────
        q = f'SELECT * FROM "{joined_table}" WHERE "{foreign_fk}" = ANY($1::text[])'
        related = [dict(rr) for rr in await _fetch(q, parent_ids)]

        if nested_include:
            related = await _load_includes(joined_table, related, nested_include, conn)

        if is_many:
            idx2: dict[Any, list] = {}
            for rd in related: idx2.setdefault(rd[foreign_fk], []).append(rd)
            for r in rows: r[rel_name] = idx2.get(r[local_fk], [])
        else:
            idx_s = {rd[foreign_fk]: rd for rd in related}
            for r in rows: r[rel_name] = idx_s.get(r[local_fk])

    return rows


# ---------------------------------------------------------------------------
# Database pool
# ---------------------------------------------------------------------------
class Database:
    def __init__(self):
        self.pool: asyncpg.Pool | None = None

    async def connect(self):
        if not self.pool:
            self.pool = await asyncpg.create_pool(DATABASE_URL)
            print("✅ DB connected")

    async def disconnect(self):
        if self.pool:
            await self.pool.close(); self.pool = None
            print("❌ DB disconnected")

    async def fetch(self, q, *args):
        async with self.pool.acquire() as c: return await c.fetch(q, *args)

    async def fetchrow(self, q, *args):
        async with self.pool.acquire() as c: return await c.fetchrow(q, *args)

    async def fetchval(self, q, *args):
        async with self.pool.acquire() as c: return await c.fetchval(q, *args)

    async def execute(self, q, *args):
        async with self.pool.acquire() as c: return await c.execute(q, *args)


db = Database()


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------
class Model:
    def __init__(self, table: str):
        self.table = table

    async def find_many(self, where=None, include=None, order=None, conn=None) -> list[Row]:
        q, values = f'SELECT * FROM "{self.table}"', []
        if where:
            clause, values = _build_where(where); q += f" WHERE {clause}"
        q += f" {_order_sql(order)}"
        recs = await (conn.fetch(q, *values) if conn else db.fetch(q, *values))
        rows = [dict(r) for r in recs]
        if include:
            rows = await _load_includes(self.table, rows, include, conn)
        return _to_rows(rows)

    async def find_unique(self, where, include=None, conn=None) -> "Row | None":
        k, v = next(iter(where.items()))
        q = f'SELECT * FROM "{self.table}" WHERE "{k}" = $1 LIMIT 1'
        rec = await (conn.fetchrow(q, v) if conn else db.fetchrow(q, v))
        if not rec: return None
        row = dict(rec)
        if include:
            rows = await _load_includes(self.table, [row], include, conn); row = rows[0]
        return Row(row)

    async def find_first(self, where=None, include=None, conn=None) -> "Row | None":
        q, values = f'SELECT * FROM "{self.table}"', []
        if where:
            clause, values = _build_where(where); q += f" WHERE {clause}"
        q += " LIMIT 1"
        rec = await (conn.fetchrow(q, *values) if conn else db.fetchrow(q, *values))
        if not rec: return None
        row = dict(rec)
        if include:
            rows = await _load_includes(self.table, [row], include, conn); row = rows[0]
        return Row(row)

    async def create(self, data, include=None, conn=None) -> Row:
        flat = {k: v for k, v in data.items() if not isinstance(v, dict)}
        keys, vals = list(flat.keys()), list(flat.values())
        cols = ", ".join(f'"{k}"' for k in keys)
        phs  = ", ".join(f"${i+1}" for i in range(len(vals)))
        q = f'INSERT INTO "{self.table}" ({cols}) VALUES ({phs}) RETURNING *'
        rec = await (conn.fetchrow(q, *vals) if conn else db.fetchrow(q, *vals))
        row = dict(rec)

        # nested relation creates e.g. {"teacher": {"create": {...}}}
        for rel_name, rel_data in {k: v for k, v in data.items() if isinstance(v, dict) and "create" in v}.items():
            info = RELATIONS.get(self.table, {}).get(rel_name)
            if not info: continue
            jt, local_fk, foreign_fk, _, _m2m = info
            cd = {**rel_data["create"], foreign_fk: row[local_fk]}
            ck, cv = list(cd.keys()), list(cd.values())
            col_names = ", ".join('"' + x + '"' for x in ck)
            col_phs   = ", ".join(f"${i+1}" for i in range(len(cv)))
            cq = f'INSERT INTO "{jt}" ({col_names}) VALUES ({col_phs})'
            await (conn.execute(cq, *cv) if conn else db.execute(cq, *cv))

        if include:
            rows = await _load_includes(self.table, [row], include, conn); row = rows[0]
        return Row(row)

    async def update(self, where, data, include=None, conn=None) -> Row:
        flat = {k: v for k, v in data.items() if not isinstance(v, dict)}
        if not flat:
            return await self.find_unique(where=where, include=include, conn=conn)
        set_parts = [f'"{k}" = ${i+1}' for i, k in enumerate(flat)]
        vals = list(flat.values())
        wk, wv = next(iter(where.items()))
        q = f'UPDATE "{self.table}" SET {", ".join(set_parts)} WHERE "{wk}" = ${len(vals)+1} RETURNING *'
        rec = await (conn.fetchrow(q, *vals, wv) if conn else db.fetchrow(q, *vals, wv))
        row = dict(rec)
        if include:
            rows = await _load_includes(self.table, [row], include, conn); row = rows[0]
        return Row(row)

    async def upsert(self, where, data, conn=None) -> Row:
        existing = await self.find_unique(where=where, conn=conn)
        if existing:
            return await self.update(where=where, data=data.get("update", {}), conn=conn)
        return await self.create(data=data.get("create", {}), conn=conn)

    async def delete(self, where, conn=None) -> "Row | None":
        k, v = next(iter(where.items()))
        q = f'DELETE FROM "{self.table}" WHERE "{k}" = $1 RETURNING *'
        rec = await (conn.fetchrow(q, v) if conn else db.fetchrow(q, v))
        return Row(dict(rec)) if rec else None

    async def delete_many(self, where=None, conn=None) -> int:
        q, values = f'DELETE FROM "{self.table}"', []
        if where:
            clause, values = _build_where(where); q += f" WHERE {clause}"
        result = await (conn.execute(q, *values) if conn else db.execute(q, *values))
        try: return int(str(result).split()[-1])
        except (ValueError, IndexError): return 0

    async def count(self, where=None, conn=None) -> int:
        q, values = f'SELECT COUNT(*) FROM "{self.table}"', []
        if where:
            clause, values = _build_where(where); q += f" WHERE {clause}"
        val = await (conn.fetchval(q, *values) if conn else db.fetchval(q, *values))
        return int(val)


# ---------------------------------------------------------------------------
# Transaction support
# ---------------------------------------------------------------------------
class _BoundModel(Model):
    def __init__(self, table, conn):
        super().__init__(table); self._c = conn

    async def find_many(self, **kw):   return await super().find_many(conn=self._c, **kw)
    async def find_unique(self, **kw): return await super().find_unique(conn=self._c, **kw)
    async def find_first(self, **kw):  return await super().find_first(conn=self._c, **kw)
    async def create(self, **kw):      return await super().create(conn=self._c, **kw)
    async def update(self, **kw):      return await super().update(conn=self._c, **kw)
    async def upsert(self, **kw):      return await super().upsert(conn=self._c, **kw)
    async def delete(self, **kw):      return await super().delete(conn=self._c, **kw)
    async def delete_many(self, **kw): return await super().delete_many(conn=self._c, **kw)
    async def count(self, **kw):       return await super().count(conn=self._c, **kw)


class TransactionProxy:
    def __init__(self, conn):
        self.user         = _BoundModel("User",         conn)
        self.teacher      = _BoundModel("Teacher",      conn)
        self.student      = _BoundModel("Student",      conn)
        self.department   = _BoundModel("Department",   conn)
        self.program      = _BoundModel("Program",      conn)
        self.course       = _BoundModel("Course",       conn)
        self.attendance   = _BoundModel("Attendance",   conn)
        self.semester     = _BoundModel("Semester",     conn)
        self.academicyear = _BoundModel("AcademicYear", conn)


# ---------------------------------------------------------------------------
# Prisma Client (singleton)
# ---------------------------------------------------------------------------
class PrismaClient:
    def __init__(self):
        self.user         = Model("User")
        self.teacher      = Model("Teacher")
        self.student      = Model("Student")
        self.department   = Model("Department")
        self.program      = Model("Program")
        self.course       = Model("Course")
        self.attendance   = Model("Attendance")
        self.semester     = Model("Semester")
        self.academicyear = Model("AcademicYear")

    @asynccontextmanager
    async def tx(self):
        """async with prisma.tx() as tx: await tx.user.find_many(...)"""
        async with db.pool.acquire() as conn:
            async with conn.transaction():
                yield TransactionProxy(conn)

    async def query_raw(self, sql: str, *args) -> list[dict]:
        return [dict(r) for r in await db.fetch(sql, *args)]


prisma = PrismaClient()


# ---------------------------------------------------------------------------
# Lifespan exports
# ---------------------------------------------------------------------------
async def connect():
    await db.connect()

async def disconnect():
    await db.disconnect()