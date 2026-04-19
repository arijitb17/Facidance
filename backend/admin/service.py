"""
backend/admin/service.py

Pure business logic — no HTTP concerns here.
All DB access goes through prisma_client.prisma (prisma-client-py).
"""

from __future__ import annotations

import random
import string
from datetime import datetime, timezone
from typing import Optional

import bcrypt
from fastapi import HTTPException
from asyncpg.exceptions import UniqueViolationError

from backend.common.prisma_client import prisma
from backend.admin.schemas import (
    ApproveTeacherRequest,
    CreateCourseRequest,
    CreateDepartmentRequest,
    CreateProgramRequest,
    CreateTeacherRequest,
    UpdateStudentRequest,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_dept_code(dept_name: Optional[str]) -> str:
    """
    Derive a short department code from the full department name.
    Mirrors the TypeScript getDeptCode() helper exactly.
    e.g. "Information Technology" → "IT", "Computer Science" → "CS"
    """
    if not dept_name:
        return "GEN"
    stop_words = {"and", "of", "department", "dept.", "dept"}
    words = [w for w in dept_name.split() if w.lower() not in stop_words]
    if not words:
        return "GEN"
    if len(words) == 1:
        w = "".join(c for c in words[0] if c.isalpha())
        return w[:3].upper() if len(w) >= 3 else w.upper()
    return "".join(w[0] for w in words).upper()


def _random_entry_code() -> str:
    """6-char uppercase alphanumeric code for course entry."""
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


# ---------------------------------------------------------------------------
# Teachers
# ---------------------------------------------------------------------------

async def get_teachers() -> list[dict]:
    """
    Return all TEACHER-role users, separated into approved (has Teacher record)
    and pending (no Teacher record yet).
    Mirrors GET /api/admin/teachers.
    """
    users = await prisma.user.find_many(
        where={"role": "TEACHER"},
        include={"teacher": {"include": {"department": True}}},
    )
    result = []
    for u in users:
        t = u.teacher
        result.append(
            {
                "id": t.id if t else u.id,
                "userId": u.id,
                "name": u.name,
                "email": u.email,
                "departmentId": t.departmentId if t else None,
                "departmentName": t.department.name if (t and t.department) else None,
                "isPending": t is None,
            }
        )
    return result


async def approve_teacher(data: ApproveTeacherRequest) -> dict:
    """
    Upsert a Teacher record: assign departmentId to the given userId.
    Mirrors POST /api/admin/approve-teacher.
    """
    if not data.department_id:
        raise HTTPException(status_code=400, detail="Department ID is required")

    # Verify the user exists and is a TEACHER
    user = await prisma.user.find_unique(where={"id": data.teacher_id})
    if not user or user.role != "TEACHER":
        raise HTTPException(status_code=404, detail="Teacher user not found")

    teacher = await prisma.teacher.upsert(
        where={"userId": data.teacher_id},
        data={
            "update": {"departmentId": data.department_id},
            "create": {"userId": data.teacher_id, "departmentId": data.department_id},
        },
    )
    return {
        "message": "Teacher approved successfully",
        "teacher_id": teacher.id,
        "department_id": teacher.department_id,
    }


async def create_teacher(data: CreateTeacherRequest) -> dict:
    """
    Create a User(TEACHER) + Teacher record in one nested write.
    Mirrors POST /api/admin/create-teacher.
    """
    hashed = _hash_password(data.password)
    try:
        user = await prisma.user.create(
            data={
                "name": data.name,
                "email": data.email,
                "password": hashed,
                "role": "TEACHER",
                "teacher": {
                    "create": {"departmentId": data.department_id}
                },
            }
        )
    except UniqueViolationError:
        raise HTTPException(status_code=409, detail="Email already registered")
    return {"message": "Teacher created successfully", "user_id": user.id}


async def delete_teacher(user_id: str) -> dict:
    """
    Delete Teacher record (if exists) then User record.
    Mirrors DELETE /api/admin/teachers and DELETE /api/admin/teachers/[id].
    """
    await prisma.teacher.delete_many(where={"userId": user_id})
    await prisma.user.delete(where={"id": user_id})
    return {"message": "Teacher deleted successfully"}


# ---------------------------------------------------------------------------
# Departments
# ---------------------------------------------------------------------------

async def get_departments() -> list[dict]:
    """Return all departments with program and teacher counts."""
    depts = await prisma.department.find_many(
        include={
            "_count": {"select": {"programs": True, "teachers": True}}
        },
        order={"name": "asc"},
    )
    return [
        {
            "id": d.id,
            "name": d.name,
            "programs_count": d._count.programs if d._count else 0,
            "teachers_count": d._count.teachers if d._count else 0,
        }
        for d in depts
    ]


async def create_department(data: CreateDepartmentRequest) -> dict:
    """Create a single department. Mirrors POST /api/admin/departments."""
    dept = await prisma.department.create(
        data={"name": data.name},
        include={"_count": {"select": {"programs": True, "teachers": True}}},
    )
    return {
        "id": dept.id,
        "name": dept.name,
        "programs_count": dept._count.programs if dept._count else 0,
        "teachers_count": dept._count.teachers if dept._count else 0,
    }


async def delete_department(dept_id: str) -> dict:
    """
    Cascade-delete a department and all related academic data (programs →
    academic years → semesters → courses → attendance).
    Raises if students or teachers are still assigned.
    Mirrors DELETE /api/admin/departments/[id].
    """
    async with prisma.tx() as tx:
        programs = await tx.program.find_many(
            where={"departmentId": dept_id}, include={"academicYears": True}
        )
        program_ids = [p.id for p in programs]

        academic_year_ids: list[str] = []
        for p in programs:
            academic_year_ids += [ay.id for ay in (p.academicYears or [])]

        semester_ids: list[str] = []
        if academic_year_ids:
            semesters = await tx.semester.find_many(
                where={"academicYearId": {"in": academic_year_ids}}
            )
            semester_ids = [s.id for s in semesters]

        course_ids: list[str] = []
        if semester_ids:
            courses = await tx.course.find_many(
                where={"semesterId": {"in": semester_ids}}
            )
            course_ids = [c.id for c in courses]

        if course_ids:
            await tx.attendance.delete_many(where={"courseId": {"in": course_ids}})
            await tx.course.delete_many(where={"id": {"in": course_ids}})

        if semester_ids:
            await tx.semester.delete_many(where={"id": {"in": semester_ids}})

        if academic_year_ids:
            await tx.academicyear.delete_many(where={"id": {"in": academic_year_ids}})

        # Guard: students still enrolled
        if program_ids:
            student_count = await tx.student.count(
                where={"programId": {"in": program_ids}}
            )
            if student_count > 0:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"Cannot delete department: {student_count} student(s) are "
                        "enrolled in programs under this department. "
                        "Reassign or remove students first."
                    ),
                )
            await tx.program.delete_many(where={"id": {"in": program_ids}})

        # Guard: teachers still assigned
        teacher_count = await tx.teacher.count(where={"departmentId": dept_id})
        if teacher_count > 0:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Cannot delete department: {teacher_count} teacher(s) are "
                    "assigned. Reassign or remove them first."
                ),
            )

        deleted = await tx.department.delete(where={"id": dept_id})

    return {"message": "Department deleted successfully", "id": deleted.id}


# ---------------------------------------------------------------------------
# Programs
# ---------------------------------------------------------------------------

async def get_programs() -> list[dict]:
    progs = await prisma.program.find_many(
        include={"department": True},
        order={"name": "asc"},
    )
    return [
        {
            "id": p.id,
            "name": p.name,
            "department_id": p.departmentId,
            "department_name": p.department.name if p.department else None,
        }
        for p in progs
    ]


async def create_program(data: CreateProgramRequest) -> dict:
    dept = await prisma.department.find_unique(where={"id": data.department_id})
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    prog = await prisma.program.create(
        data={"name": data.name, "departmentId": data.department_id},
        include={"department": True},
    )
    return {
        "id": prog.id,
        "name": prog.name,
        "department_id": prog.departmentId,
        "department_name": prog.department.name if prog.department else None,
    }


async def delete_program(program_id: str) -> dict:
    await prisma.program.delete(where={"id": program_id})
    return {"message": "Program deleted successfully"}


# ---------------------------------------------------------------------------
# Courses
# ---------------------------------------------------------------------------

async def get_courses() -> list[dict]:
    """Return all courses with full nested relations."""
    courses = await prisma.course.find_many(
        include={
            "teacher": {"include": {"user": True}},
            "semester": {
                "include": {
                    "academicYear": {
                        "include": {
                            "program": {"include": {"department": True}}
                        }
                    }
                }
            },
        }
    )
    return [_serialize_course(c) for c in courses]


async def create_course(data: CreateCourseRequest) -> dict:
    """
    Create a course with auto-generated code (e.g. IT-701).
    Mirrors the full POST /api/admin/courses logic including:
      - teacher lookup with user-id-vs-teacher-id guard
      - find-or-create AcademicYear + Semester
      - dept-code derivation
      - sequential course code generation
    """
    # Verify teacher exists by Teacher.id
    teacher = await prisma.teacher.find_unique(
        where={"id": data.teacher_id},
        include={"user": True, "department": True},
    )
    if not teacher:
        # Helpful diagnostic: check if it's a User.id sent by mistake
        by_user = await prisma.teacher.find_unique(where={"userId": data.teacher_id})
        if by_user:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Received a User ID instead of a Teacher ID. "
                    f"Use teacher_id='{by_user.id}'."
                ),
            )
        raise HTTPException(status_code=404, detail="Teacher not found in database")

    # Get program + department for code generation
    program = await prisma.program.find_unique(
        where={"id": data.program_id},
        include={"department": True},
    )
    if not program or not program.department:
        raise HTTPException(status_code=404, detail="Program or department not found")

    dept_code = _get_dept_code(program.department.name)

    # Find or create AcademicYear
    ay = await prisma.academicyear.find_first(
        where={"name": data.academic_year, "programId": data.program_id}
    )
    if not ay:
        ay = await prisma.academicyear.create(
            data={"name": data.academic_year, "programId": data.program_id}
        )

    # Find or create Semester
    semester_name = f"Semester {data.semester_number}"
    sem = await prisma.semester.find_first(
        where={"name": semester_name, "academicYearId": ay.id}
    )
    if not sem:
        sem = await prisma.semester.create(
            data={"name": semester_name, "academicYearId": ay.id}
        )

    # Auto-generate course code: DEPT-SemIndex (e.g. IT-701)
    existing_count = await prisma.course.count(where={"semesterId": sem.id})
    index_part = str(existing_count + 1).zfill(2)
    course_code = f"{dept_code}-{data.semester_number}{index_part}"

    course = await prisma.course.create(
        data={
            "name": data.name,
            "code": course_code,
            "entryCode": _random_entry_code(),
            "teacherId": teacher.id,
            "semesterId": sem.id,
        },
        include={
            "teacher": {"include": {"user": True}},
            "semester": {
                "include": {
                    "academicYear": {
                        "include": {
                            "program": {"include": {"department": True}}
                        }
                    }
                }
            },
        },
    )
    return _serialize_course(course)


async def delete_course(course_id: str) -> dict:
    await prisma.attendance.delete_many(where={"courseId": course_id})
    await prisma.course.delete(where={"id": course_id})
    return {"message": "Course deleted successfully"}


def _serialize_course(c) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "code": c.code,
        "entry_code": c.entryCode,
        "teacher_id": c.teacherId,
        "teacher_name": (
            c.teacher.user.name if (c.teacher and c.teacher.user) else None
        ),
        "semester_id": c.semesterId,
        "semester_name": c.semester.name if c.semester else None,
        "academic_year_name": (
            c.semester.academicYear.name
            if (c.semester and c.semester.academicYear)
            else None
        ),
        "program_name": (
            c.semester.academicYear.program.name
            if (
                c.semester
                and c.semester.academicYear
                and c.semester.academicYear.program
            )
            else None
        ),
    }


# ---------------------------------------------------------------------------
# Students
# ---------------------------------------------------------------------------

async def get_students() -> dict:
    """
    Return all students with auto-graduation logic.
    Mirrors GET /api/admin/students (including the graduation-check loop).
    """
    now = datetime.now(timezone.utc)
    users = await prisma.user.find_many(
        where={"role": "STUDENT"},
        include={
            "student": {
                "include": {
                    "program": {"include": {"department": True}},
                    "courses": {
                        "include": {
                            "semester": {
                                "include": {
                                    "academicYear": {
                                        "include": {
                                            "program": {
                                                "include": {"department": True}
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                }
            }
        },
        order={"createdAt": "desc"},
    )

    result = []
    for u in users:
        s = u.student
        graduated = False
        if s:
            joined = s.joinedAt.replace(tzinfo=timezone.utc) if s.joinedAt.tzinfo is None else s.joinedAt
            years_passed = (now - joined).days / 365.25

            prog_name = (s.program.name.lower() if s.program else "")
            duration = 4
            if "bachelor" in prog_name:
                duration = 3
            if "integrated" in prog_name:
                duration = 5

            if years_passed >= duration and s.status != "graduated":
                await prisma.student.update(
                    where={"id": s.id}, data={"status": "graduated"}
                )
                s.status = "graduated"  # type: ignore[assignment]

            graduated = s.status == "graduated"

        result.append(
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "student_id": s.id if s else None,
                "program_id": s.programId if s else None,
                "program_name": s.program.name if (s and s.program) else None,
                "department_name": (
                    s.program.department.name
                    if (s and s.program and s.program.department)
                    else None
                ),
                "status": s.status if s else "unknown",
                "joinedAt": s.joinedAt.isoformat() if s else None,
                "graduated": graduated,
                "courses_count": len(s.courses) if (s and s.courses) else 0,
                "courses": [
                    {
                        "id": c.id,
                        "name": c.name,
                        "entry_code": c.entryCode,
                        "semester_name": c.semester.name if c.semester else None,
                        "academic_year": (
                            c.semester.academicYear.name
                            if (c.semester and c.semester.academicYear)
                            else None
                        ),
                        "program_name": (
                            c.semester.academicYear.program.name
                            if (
                                c.semester
                                and c.semester.academicYear
                                and c.semester.academicYear.program
                            )
                            else None
                        ),
                    }
                    for c in (s.courses or [])
                ],
            }
        )

    programs = await prisma.program.find_many(
        include={"department": True}, order={"name": "asc"}
    )
    program_list = [
        {
            "id": p.id,
            "name": p.name,
            "department_id": p.departmentId,
            "department_name": p.department.name if p.department else None,
        }
        for p in programs
    ]

    return {"students": result, "programs": program_list}


async def update_student(user_id: str, data: UpdateStudentRequest) -> dict:
    """PATCH student: name, email, programId. Mirrors PATCH /api/admin/students/[id]."""
    update_data: dict = {}
    if data.name:
        update_data["name"] = data.name
    if data.email:
        update_data["email"] = data.email

    student_update: dict = {}
    if data.program_id:
        student_update["programId"] = data.program_id

    user = await prisma.user.update(
        where={"id": user_id},
        data={
            **update_data,
            **({"student": {"update": student_update}} if student_update else {}),
        },
        include={"student": True},
    )
    return {"id": user.id, "name": user.name, "email": user.email}


async def delete_student(user_id: str) -> dict:
    """DELETE student user. Mirrors DELETE /api/admin/students/[id]."""
    await prisma.user.delete(where={"id": user_id})
    return {"success": True}


async def graduate_student(user_id: str) -> dict:
    """Mark a student as graduated."""
    student = await prisma.student.find_unique(where={"userId": user_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    await prisma.student.update(
        where={"id": student.id}, data={"status": "graduated"}
    )
    return {"message": "Student marked as graduated"}


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

async def get_stats() -> dict:
    """
    Fast parallel count queries.
    Mirrors GET /api/admin/stats.
    """
    (
        teachers,
        students,
        departments,
        programs,
        courses,
    ) = await asyncio.gather(
        prisma.teacher.count(),
        prisma.student.count(),
        prisma.department.count(),
        prisma.program.count(),
        prisma.course.count(),
    )
    return {
        "teachers": teachers,
        "students": students,
        "departments": departments,
        "programs": programs,
        "courses": courses,
        "success": True,
    }


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

async def get_analytics_overview() -> dict:
    """
    Aggregate overview metrics for the admin analytics dashboard.
    GET /admin/analytics/overview
    """
    (
        total_teachers,
        total_students,
        active_students,
        graduated_students,
        total_departments,
        total_programs,
        total_courses,
        total_attendance,
        present_attendance,
    ) = await asyncio.gather(
        prisma.teacher.count(),
        prisma.student.count(),
        prisma.student.count(where={"status": "active"}),
        prisma.student.count(where={"status": "graduated"}),
        prisma.department.count(),
        prisma.program.count(),
        prisma.course.count(),
        prisma.attendance.count(),
        prisma.attendance.count(where={"status": True}),
    )

    attendance_rate = (
        round((present_attendance / total_attendance) * 100, 2)
        if total_attendance > 0
        else 0.0
    )

    return {
        "total_users": total_teachers + total_students,
        "total_teachers": total_teachers,
        "total_students": total_students,
        "active_students": active_students,
        "graduated_students": graduated_students,
        "total_departments": total_departments,
        "total_programs": total_programs,
        "total_courses": total_courses,
        "total_attendance_records": total_attendance,
        "overall_attendance_rate": attendance_rate,
    }


async def get_attendance_trends() -> dict:
    """
    Monthly attendance aggregation for the last 12 months.
    GET /admin/analytics/attendance-trends
    Uses raw SQL via prisma.query_raw for date truncation.
    """
    rows = await prisma.query_raw(
        """
        SELECT
            TO_CHAR(DATE_TRUNC('month', timestamp), 'YYYY-MM') AS month,
            COUNT(*)                                            AS total,
            SUM(CASE WHEN status = true THEN 1 ELSE 0 END)     AS present
        FROM "Attendance"
        WHERE timestamp >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', timestamp)
        ORDER BY DATE_TRUNC('month', timestamp)
        """
    )
    trends = [
        {
            "month": r["month"],
            "total": int(r["total"]),
            "present": int(r["present"]),
            "rate": (
                round((int(r["present"]) / int(r["total"])) * 100, 2)
                if int(r["total"]) > 0
                else 0.0
            ),
        }
        for r in rows
    ]
    return {"trends": trends}


async def get_teacher_load() -> dict:
    """
    Per-teacher course count and enrolled student count.
    GET /admin/analytics/teacher-load
    """
    teachers = await prisma.teacher.find_many(
        include={
            "user": True,
            "department": True,
            "courses": {
                "include": {
                    "_count": {"select": {"students": True}}
                }
            },
        },
        order={"userId": "asc"},
    )
    result = []
    for t in teachers:
        course_count = len(t.courses) if t.courses else 0
        student_count = sum(
            (c._count.students if c._count else 0) for c in (t.courses or [])
        )
        result.append(
            {
                "teacher_id": t.id,
                "teacher_name": t.user.name if t.user else "Unknown",
                "department_name": t.department.name if t.department else None,
                "course_count": course_count,
                "student_count": student_count,
            }
        )
    return {"teachers": result}


async def get_program_distribution() -> dict:
    """
    Students per program.
    GET /admin/analytics/program-distribution
    """
    programs = await prisma.program.find_many(
        include={
            "department": True,
            "_count": {"select": {"students": True}},
        },
        order={"name": "asc"},
    )
    return {
        "programs": [
            {
                "program_id": p.id,
                "program_name": p.name,
                "department_name": p.department.name if p.department else None,
                "student_count": p._count.students if p._count else 0,
            }
            for p in programs
        ]
    }


# deferred import to avoid circular at module load time
import asyncio  # noqa: E402