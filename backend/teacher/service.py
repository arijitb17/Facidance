"""
backend/teacher/service.py

Pure business logic for the Teacher microservice.
All DB access goes through prisma_client.prisma.
Mirrors the logic in the Next.js teacher API routes.
"""

from __future__ import annotations

import asyncio
import os
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import httpx
from fastapi import HTTPException

from backend.common.prisma_client import prisma
from backend.common.cache import cache_get, cache_set, cache_invalidate
from backend.teacher.schemas import (
    GetStudentsRequest,
    ImportStudentsRequest,
    SubmitAttendanceRequest,
    SendCredentialsRequest,
    RemoveStudentRequest,
)
from backend.common.metrics import (
    TEACHER_COURSE_OPS_TOTAL,
    TEACHER_COURSE_OP_DURATION_SECONDS,
    TEACHER_STUDENT_OPS_TOTAL,
    TEACHER_STUDENT_OP_DURATION_SECONDS,
    TEACHER_ATTENDANCE_OPS_TOTAL,
    TEACHER_ATTENDANCE_OP_DURATION_SECONDS,
    TEACHER_FACE_OPS_TOTAL,
    TEACHER_FACE_OP_DURATION_SECONDS,
    TEACHER_REPORT_DURATION_SECONDS,
    TEACHER_STATS_DURATION_SECONDS,
    TEACHER_UNHANDLED_ERRORS_TOTAL,
)

PYTHON_API_URL = os.environ.get("PYTHON_API_URL", "http://localhost:8004")

IST = timezone(timedelta(hours=5, minutes=30))

def _to_ist(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(IST).replace(tzinfo=None)


# ---------------------------------------------------------------------------
# Active Session Store
# ---------------------------------------------------------------------------

ACTIVE_SESSIONS: dict[str, dict[str, set[str]]] = {}


def _ensure_session(course_id: str) -> dict:
    if course_id not in ACTIVE_SESSIONS:
        ACTIVE_SESSIONS[course_id] = {
            "ai": set(),
            "manual": set(),
            "start_time": int(time.time() * 1000),
            "status": "active"
        }
    return ACTIVE_SESSIONS[course_id]


def start_session(course_id: str, start_time: int) -> dict:
    ACTIVE_SESSIONS[course_id] = {
        "ai": set(),
        "manual": set(),
        "start_time": start_time,
        "status": "active"
    }
    return ACTIVE_SESSIONS[course_id]


def _clear_session(course_id: str) -> None:
    ACTIVE_SESSIONS.pop(course_id, None)


def clear_active_session(course_id: str) -> None:
    _clear_session(course_id)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _hash_dob_password(dob: str) -> str:
    cleaned = dob.replace("-", "").replace("/", "").replace(" ", "")
    return bcrypt.hashpw(cleaned.encode(), bcrypt.gensalt()).decode()


def _parse_dt(date_str: str) -> datetime:
    return datetime.fromisoformat(date_str.replace("Z", "+00:00"))


def _make_cuid() -> str:
    ts = format(int(time.time() * 1000), "x")
    rand = secrets.token_hex(16)
    return ("c" + ts + rand)[:25]


# ---------------------------------------------------------------------------
# Me
# ---------------------------------------------------------------------------

async def get_me(user_id: str) -> dict:
    t0 = time.perf_counter()
    try:
        cache_key = f"teacher:me:{user_id}"
        cached = await cache_get(cache_key)
        if cached:
            return cached

        teacher = await prisma.teacher.find_unique(
            where={"userId": user_id},
            include={"user": True, "department": True, "courses": True},
        )
        if not teacher:
            raise HTTPException(status_code=404, detail="Teacher not found")

        result = {
            "id": teacher.id,
            "name": teacher.user.name,
            "department": teacher.department.name if teacher.department else None,
            "courses": [{"id": c.id, "name": c.name} for c in (teacher.courses or [])],
        }
        await cache_set(cache_key, result, ttl=300)
        return result
    except HTTPException:
        raise
    except Exception:
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="get_me").inc()
        raise
    finally:
        TEACHER_STATS_DURATION_SECONDS.labels(endpoint="me").observe(time.perf_counter() - t0)


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

async def get_stats(user_id: str) -> dict:
    t0 = time.perf_counter()
    try:
        cache_key = f"teacher:stats:{user_id}"
        cached = await cache_get(cache_key)
        if cached:
            return cached

        teacher = await prisma.teacher.find_unique(where={"userId": user_id})
        if not teacher:
            raise HTTPException(status_code=404, detail="Teacher not found")

        teacher_id = teacher.id
        courses_count = await prisma.course.count(where={"teacherId": teacher_id})

        courses_with_students = await prisma.course.find_many(
            where={"teacherId": teacher_id},
            include={"students": True},
        )
        unique_student_ids: set[str] = set()
        course_ids: list[str] = []
        for c in courses_with_students:
            course_ids.append(c.id)
            for s in (c.students or []):
                if s.status != "graduated":
                    unique_student_ids.add(s.id)

        total_students = len(unique_student_ids)

        semester_rows = await prisma.course.find_many(where={"teacherId": teacher_id})
        unique_semesters = {c.semesterId for c in semester_rows}
        total_semesters = len(unique_semesters)

        total_attendance = 0
        if course_ids:
            total_attendance = await prisma.attendance.count(
                where={"courseId": {"in": course_ids}}
            )

        result = {
            "courses": courses_count,
            "total_students": total_students,
            "total_semesters": total_semesters,
            "total_attendance": total_attendance,
        }
        await cache_set(cache_key, result, ttl=60)
        return result
    except HTTPException:
        raise
    except Exception:
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="get_stats").inc()
        raise
    finally:
        TEACHER_STATS_DURATION_SECONDS.labels(endpoint="stats").observe(time.perf_counter() - t0)


# ---------------------------------------------------------------------------
# Hierarchy
# ---------------------------------------------------------------------------

async def get_hierarchy(user_id: str) -> dict:
    t0 = time.perf_counter()
    try:
        cache_key = f"teacher:hierarchy:{user_id}"
        cached = await cache_get(cache_key)
        if cached:
            return cached

        teacher = await prisma.teacher.find_unique(
            where={"userId": user_id},
            include={
                "department": True,
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
            },
        )
        if not teacher:
            raise HTTPException(status_code=404, detail="Teacher profile not found")

        depts: dict[str, dict] = {}

        for course in (teacher.courses or []):
            sem = course.semester
            ay = sem.academicYear
            prog = ay.program
            dept = prog.department

            if dept.id not in depts:
                depts[dept.id] = {"id": dept.id, "name": dept.name, "programs": {}}

            dept_node = depts[dept.id]
            if prog.id not in dept_node["programs"]:
                dept_node["programs"][prog.id] = {
                    "id": prog.id,
                    "name": prog.name,
                    "departmentId": prog.departmentId,
                    "academicYears": {},
                }

            prog_node = dept_node["programs"][prog.id]
            if ay.id not in prog_node["academicYears"]:
                prog_node["academicYears"][ay.id] = {
                    "id": ay.id,
                    "name": ay.name,
                    "programId": ay.programId,
                    "semesters": {},
                }

            ay_node = prog_node["academicYears"][ay.id]
            if sem.id not in ay_node["semesters"]:
                ay_node["semesters"][sem.id] = {
                    "id": sem.id,
                    "name": sem.name,
                    "academicYearId": sem.academicYearId,
                    "courses": [],
                }

            ay_node["semesters"][sem.id]["courses"].append(
                {"id": course.id, "name": course.name, "entryCode": course.entryCode}
            )

        def _dept_to_list(d: dict) -> list:
            result = []
            for dept in d.values():
                result.append(
                    {
                        "id": dept["id"],
                        "name": dept["name"],
                        "programs": [
                            {
                                "id": p["id"],
                                "name": p["name"],
                                "departmentId": p["departmentId"],
                                "academicYears": [
                                    {
                                        "id": ay["id"],
                                        "name": ay["name"],
                                        "programId": ay["programId"],
                                        "semesters": [
                                            {
                                                "id": sem["id"],
                                                "name": sem["name"],
                                                "academicYearId": sem["academicYearId"],
                                                "courses": sem["courses"],
                                            }
                                            for sem in ay["semesters"].values()
                                        ],
                                    }
                                    for ay in p["academicYears"].values()
                                ],
                            }
                            for p in dept["programs"].values()
                        ],
                    }
                )
            return result

        result = {"departments": _dept_to_list(depts)}
        await cache_set(cache_key, result, ttl=300)
        return result
    except HTTPException:
        raise
    except Exception:
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="get_hierarchy").inc()
        raise
    finally:
        TEACHER_STATS_DURATION_SECONDS.labels(endpoint="hierarchy").observe(time.perf_counter() - t0)


# ---------------------------------------------------------------------------
# Courses
# ---------------------------------------------------------------------------

async def get_courses(user_id: str) -> list[dict]:
    t0 = time.perf_counter()
    try:
        cache_key = f"teacher:courses:{user_id}"
        cached = await cache_get(cache_key)
        if cached:
            TEACHER_COURSE_OPS_TOTAL.labels(operation="list", status="success").inc()
            return cached

        teacher = await prisma.teacher.find_unique(where={"userId": user_id})
        if not teacher:
            TEACHER_COURSE_OPS_TOTAL.labels(operation="list", status="not_found").inc()
            raise HTTPException(status_code=404, detail="Teacher not found")

        courses = await prisma.course.find_many(
            where={"teacherId": teacher.id},
            include={
                "semester": {
                    "include": {
                        "academicYear": {
                            "include": {
                                "program": {"include": {"department": True}}
                            }
                        }
                    }
                },
                "students": True,
            },
            order={"name": "asc"},
        )

        result = []
        for course in courses:
            attendance_rows = await prisma.attendance.find_many(where={"courseId": course.id})
            unique_sessions = len({str(_to_ist(r.timestamp))[:10] for r in attendance_rows})

            sem = course.semester
            ay = sem.academicYear
            prog = ay.program
            dept = prog.department if prog else None

            active_students = [s for s in (course.students or []) if getattr(s, "status", None) != "graduated"]

            result.append(
                {
                    "id": course.id,
                    "name": course.name,
                    "code": course.code if hasattr(course, "code") else "",
                    "entry_code": course.entryCode,
                    "teacher_id": course.teacherId,
                    "semester": sem.name if sem else None,
                    "program": prog.name if prog else None,
                    "department": dept.name if dept else None,
                    "student_count": len(active_students),
                    "session_count": unique_sessions,
                }
            )

        await cache_set(cache_key, result, ttl=120)
        TEACHER_COURSE_OPS_TOTAL.labels(operation="list", status="success").inc()
        return result
    except HTTPException:
        raise
    except Exception:
        TEACHER_COURSE_OPS_TOTAL.labels(operation="list", status="error").inc()
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="get_courses").inc()
        raise
    finally:
        TEACHER_COURSE_OP_DURATION_SECONDS.labels(operation="list").observe(time.perf_counter() - t0)


# ---------------------------------------------------------------------------
# Attendance — get-students
# ---------------------------------------------------------------------------

async def get_course_students_for_attendance(
    user_id: str, data: GetStudentsRequest
) -> list[dict]:
    t0 = time.perf_counter()
    try:
        course = await prisma.course.find_unique(
            where={"id": data.course_id},
            include={
                "students": {
                    "include": {"user": True},
                    "order": {"user": {"name": "asc"}},
                }
            },
        )
        if not course:
            TEACHER_ATTENDANCE_OPS_TOTAL.labels(operation="get_students", status="not_found").inc()
            raise HTTPException(status_code=404, detail="Course not found")

        TEACHER_ATTENDANCE_OPS_TOTAL.labels(operation="get_students", status="success").inc()
        return [
            {
                "id": s.id,
                "name": s.user.name,
                "email": s.user.email,
                "has_face_data": bool(getattr(s, "faceEmbedding", None)),
            }
            for s in (course.students or [])
            if s.status != "graduated"
        ]
    except HTTPException:
        raise
    except Exception:
        TEACHER_ATTENDANCE_OPS_TOTAL.labels(operation="get_students", status="error").inc()
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="get_course_students_for_attendance").inc()
        raise
    finally:
        TEACHER_ATTENDANCE_OP_DURATION_SECONDS.labels(operation="get_students").observe(time.perf_counter() - t0)


# ---------------------------------------------------------------------------
# Attendance — train-student
# ---------------------------------------------------------------------------

async def train_student(
    user_id: str,
    teacher_id_str: str,
    student_id: str,
    course_id: str,
    photos_bytes: list[tuple[bytes, str]],
) -> dict:
    t0 = time.perf_counter()
    try:
        student = await prisma.student.find_first(
            where={
                "id": student_id,
                "courses": {"some": {"id": course_id, "teacherId": teacher_id_str}},
            },
            include={"user": True},
        )
        if not student:
            TEACHER_FACE_OPS_TOTAL.labels(operation="train_student", status="not_found").inc()
            raise HTTPException(
                status_code=404,
                detail="Student not found or not enrolled in course",
            )

        if len(photos_bytes) < 3:
            TEACHER_FACE_OPS_TOTAL.labels(operation="train_student", status="error").inc()
            raise HTTPException(status_code=400, detail="3 photos required (front, left, right)")

        async with httpx.AsyncClient(timeout=60.0) as client:
            files = [
                ("front", (photos_bytes[0][1], photos_bytes[0][0], "image/jpeg")),
                ("left",  (photos_bytes[1][1], photos_bytes[1][0], "image/jpeg")),
                ("right", (photos_bytes[2][1], photos_bytes[2][0], "image/jpeg")),
            ]
            data = {"studentId": student_id}
            resp = await client.post(f"{PYTHON_API_URL}/api/process-student", data=data, files=files)

            if resp.status_code == 422:
                TEACHER_FACE_OPS_TOTAL.labels(operation="train_student", status="error").inc()
                detail = resp.json().get("detail", "Face validation failed")
                raise HTTPException(status_code=422, detail=detail)
            if resp.status_code != 200:
                TEACHER_FACE_OPS_TOTAL.labels(operation="train_student", status="error").inc()
                raise HTTPException(status_code=502, detail=f"Python face service error: {resp.text}")

            result = resp.json()

        await prisma.student.update(
            where={"id": student_id},
            data={"faceEmbedding": None},
        )

        TEACHER_FACE_OPS_TOTAL.labels(operation="train_student", status="success").inc()
        return {
            "success": True,
            "student_id": student_id,
            "student_name": student.user.name,
            "photos_saved": 3,
            "result": result,
        }
    except HTTPException:
        raise
    except Exception:
        TEACHER_FACE_OPS_TOTAL.labels(operation="train_student", status="error").inc()
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="train_student").inc()
        raise
    finally:
        TEACHER_FACE_OP_DURATION_SECONDS.labels(operation="train_student").observe(time.perf_counter() - t0)


# ---------------------------------------------------------------------------
# Attendance — run-training
# ---------------------------------------------------------------------------

async def run_training(data) -> dict:
    t0 = time.perf_counter()
    try:
        if not data.course_id:
            TEACHER_FACE_OPS_TOTAL.labels(operation="run_training", status="error").inc()
            raise HTTPException(status_code=400, detail="Course ID required")

        async with httpx.AsyncClient(timeout=300.0) as client:
            resp = await client.post(
                f"{PYTHON_API_URL}/api/train",
                headers={"Content-Type": "application/json"},
            )
            if resp.status_code != 200:
                TEACHER_FACE_OPS_TOTAL.labels(operation="run_training", status="error").inc()
                raise HTTPException(status_code=502, detail=f"Training failed: {resp.text}")
            result = resp.json()

        TEACHER_FACE_OPS_TOTAL.labels(operation="run_training", status="success").inc()
        return {
            "success": True,
            "message": result.get("message", "Training completed successfully"),
            "trained_count": result.get("trained_count", 0),
            "total_images": result.get("total_images", 0),
            "results": result,
        }
    except HTTPException:
        raise
    except Exception:
        TEACHER_FACE_OPS_TOTAL.labels(operation="run_training", status="error").inc()
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="run_training").inc()
        raise
    finally:
        TEACHER_FACE_OP_DURATION_SECONDS.labels(operation="run_training").observe(time.perf_counter() - t0)


# ---------------------------------------------------------------------------
# Attendance — recognize faces
# ---------------------------------------------------------------------------

async def recognize_faces(
    course_id: str,
    batch_id,
    frames_bytes: list[tuple[bytes, str]],
    auto_submit: bool = False,
) -> dict:
    t0 = time.perf_counter()
    try:
        if not course_id or not frames_bytes:
            TEACHER_FACE_OPS_TOTAL.labels(operation="recognize", status="error").inc()
            raise HTTPException(status_code=400, detail="Missing required fields")

        async with httpx.AsyncClient(timeout=120.0) as client:
            files = [
                ("frames", (fname, content, "image/jpeg"))
                for content, fname in frames_bytes
            ]
            data = {"courseId": course_id}
            resp = await client.post(f"{PYTHON_API_URL}/api/recognize", data=data, files=files)

            if resp.status_code != 200:
                TEACHER_FACE_OPS_TOTAL.labels(operation="recognize", status="error").inc()
                raise HTTPException(status_code=502, detail=f"Recognition failed: {resp.text}")
            results = resp.json()

        recognized_ids: list[str] = results.get("recognizedStudents", [])

        if recognized_ids:
            session = _ensure_session(course_id)
            session["ai"].update(recognized_ids)

        if recognized_ids:
            students = await prisma.student.find_many(
                where={"id": {"in": recognized_ids}},
                include={"user": True},
            )
        else:
            students = []
        student_map = {s.id: {"name": s.user.name, "email": s.user.email} for s in students}

        enhanced = {
            **results,
            "recognizedStudents": [
                {
                    "id": sid,
                    "name": student_map.get(sid, {}).get("name", "Unknown"),
                    "email": student_map.get(sid, {}).get("email", ""),
                }
                for sid in recognized_ids
            ],
            "batchId": batch_id,
            "courseId": course_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        attendance_result = None
        if auto_submit:
            attendance_result = await _do_submit_attendance(course_id, recognized_ids, None)

        TEACHER_FACE_OPS_TOTAL.labels(operation="recognize", status="success").inc()
        return {**enhanced, "attendance": attendance_result}
    except HTTPException:
        raise
    except Exception:
        TEACHER_FACE_OPS_TOTAL.labels(operation="recognize", status="error").inc()
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="recognize_faces").inc()
        raise
    finally:
        TEACHER_FACE_OP_DURATION_SECONDS.labels(operation="recognize").observe(time.perf_counter() - t0)


# ---------------------------------------------------------------------------
# Attendance — submit-attendance
# ---------------------------------------------------------------------------

async def submit_attendance(data: SubmitAttendanceRequest) -> dict:
    t0 = time.perf_counter()
    try:
        course_id = data.course_id
        recognition_results = data.recognition_results
        date_str = data.date

        recognized_ids: list[str] = [
            (s if isinstance(s, str) else s["id"])
            for s in recognition_results.get("recognizedStudents", [])
        ]
        result = await _do_submit_attendance(course_id, recognized_ids, date_str)
        _clear_session(course_id)

        TEACHER_ATTENDANCE_OPS_TOTAL.labels(operation="submit", status="success").inc()
        return result
    except HTTPException:
        raise
    except Exception:
        TEACHER_ATTENDANCE_OPS_TOTAL.labels(operation="submit", status="error").inc()
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="submit_attendance").inc()
        raise
    finally:
        TEACHER_ATTENDANCE_OP_DURATION_SECONDS.labels(operation="submit").observe(time.perf_counter() - t0)


async def _do_submit_attendance(
    course_id: str,
    recognized_ids: list[str],
    date_str: Optional[str],
) -> dict:
    if date_str:
        attendance_date = _to_ist(_parse_dt(date_str))
    else:
        attendance_date = _to_ist(datetime.utcnow())

    start_of_day = datetime(
        attendance_date.year, attendance_date.month, attendance_date.day,
        0, 0, 0, 0
    )
    end_of_day = datetime(
        attendance_date.year, attendance_date.month, attendance_date.day,
        23, 59, 59, 999999
    )

    course = await prisma.course.find_unique(
        where={"id": course_id},
        include={"students": True},
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    recognized_set = set(recognized_ids)
    records = []

    for student in (course.students or []):
        is_present = student.id in recognized_set

        existing = await prisma.attendance.find_first(
            where={
                "studentId": student.id,
                "courseId": course_id,
                "timestamp": {"gte": start_of_day, "lte": end_of_day},
            }
        )

        if existing:
            rec = await prisma.attendance.update(
                where={"id": existing.id},
                data={"status": is_present, "timestamp": attendance_date},
            )
        else:
            rec = await prisma.attendance.create(
                data={
                    "id": _make_cuid(),
                    "studentId": student.id,
                    "courseId": course_id,
                    "status": is_present,
                    "timestamp": attendance_date,
                }
            )
        records.append(rec)

    present_count = sum(1 for r in records if r.status)

    await cache_invalidate(
        f"teacher:stats:{course.teacherId}",
        f"teacher:courses:{course.teacherId}",
        f"student:attendance:*:{course_id}",
        "student:stats:*",
        "student:history:*",
    )

    return {
        "success": True,
        "message": "Attendance submitted successfully",
        "statistics": {
            "totalStudents": len(records),
            "present": present_count,
            "absent": len(records) - present_count,
            "attendanceRate": (
                f"{(present_count / len(records) * 100):.1f}" if records else "0.0"
            ),
        },
        "timestamp": attendance_date.isoformat(),
    }


# ---------------------------------------------------------------------------
# Attendance — history
# ---------------------------------------------------------------------------

async def get_attendance_history(course_id: str) -> dict:
    t0 = time.perf_counter()
    try:
        records = await prisma.attendance.find_many(
            where={"courseId": course_id},
            include={"student": {"include": {"user": True}}},
            order={"timestamp": "desc"},
        )

        grouped: dict[str, list] = {}
        for r in records:
            date_key = str(_to_ist(r.timestamp))[:10]
            grouped.setdefault(date_key, []).append(
                {
                    "studentId": r.studentId,
                    "studentName": r.student.user.name,
                    "studentEmail": r.student.user.email,
                    "status": r.status,
                    "timestamp": str(r.timestamp),
                }
            )

        TEACHER_ATTENDANCE_OPS_TOTAL.labels(operation="history", status="success").inc()
        return {
            "courseId": course_id,
            "attendanceByDate": grouped,
            "totalRecords": len(records),
        }
    except HTTPException:
        raise
    except Exception:
        TEACHER_ATTENDANCE_OPS_TOTAL.labels(operation="history", status="error").inc()
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="get_attendance_history").inc()
        raise
    finally:
        TEACHER_ATTENDANCE_OP_DURATION_SECONDS.labels(operation="history").observe(time.perf_counter() - t0)


async def mark_present(course_id: str, student_id: str, date_str: Optional[str]) -> dict:
    t0 = time.perf_counter()
    try:
        if date_str:
            attendance_date = _to_ist(_parse_dt(date_str))
        else:
            attendance_date = _to_ist(datetime.utcnow())

        start_of_day = datetime(
            attendance_date.year, attendance_date.month, attendance_date.day,
            0, 0, 0, 0
        )
        end_of_day = datetime(
            attendance_date.year, attendance_date.month, attendance_date.day,
            23, 59, 59, 999999
        )

        existing = await prisma.attendance.find_first(
            where={
                "studentId": student_id,
                "courseId": course_id,
                "timestamp": {"gte": start_of_day, "lte": end_of_day},
            }
        )

        if existing:
            rec = await prisma.attendance.update(
                where={"id": existing.id},
                data={"status": True, "timestamp": attendance_date},
            )
        else:
            rec = await prisma.attendance.create(
                data={
                    "id": _make_cuid(),
                    "studentId": student_id,
                    "courseId": course_id,
                    "status": True,
                    "timestamp": attendance_date,
                }
            )

        TEACHER_ATTENDANCE_OPS_TOTAL.labels(operation="mark_present", status="success").inc()
        return {
            "success": True,
            "message": "Student marked as present",
            "attendance_id": rec.id,
        }
    except HTTPException:
        raise
    except Exception:
        TEACHER_ATTENDANCE_OPS_TOTAL.labels(operation="mark_present", status="error").inc()
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="mark_present").inc()
        raise
    finally:
        TEACHER_ATTENDANCE_OP_DURATION_SECONDS.labels(operation="mark_present").observe(time.perf_counter() - t0)


# ---------------------------------------------------------------------------
# Active Session — live sync
# ---------------------------------------------------------------------------

def get_active_session(course_id: str) -> dict:
    session = ACTIVE_SESSIONS.get(course_id)
    if not session:
        return {
            "course_id": course_id,
            "ai_recognized": [],
            "manually_marked": [],
            "active": False,
        }
    return {
        "course_id": course_id,
        "ai_recognized": list(session["ai"]),
        "manually_marked": list(session["manual"]),
        "active": True,
        "status": session.get("status", "active"),
        "start_time": session.get("start_time"),
    }


def update_session_status(course_id: str, status: str) -> None:
    session = ACTIVE_SESSIONS.get(course_id)
    if session:
        session["status"] = status


def update_manual_mark(course_id: str, student_id: str, is_present: bool) -> dict:
    session = _ensure_session(course_id)
    if is_present:
        session["manual"].add(student_id)
    else:
        session["manual"].discard(student_id)
    return {
        "success": True,
        "course_id": course_id,
        "student_id": student_id,
        "is_present": is_present,
        "ai_recognized": list(session["ai"]),
        "manually_marked": list(session["manual"]),
    }


# ---------------------------------------------------------------------------
# Course students detail view
# ---------------------------------------------------------------------------

async def _fetch_photo_data(client: httpx.AsyncClient, student_id: str) -> dict:
    try:
        resp = await client.get(
            f"{PYTHON_API_URL}/api/student/{student_id}/photos",
            timeout=2.0,
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass
    return {"hasPhotos": False, "photoCount": 0}


async def get_course_students(user_id: str, course_id: str) -> dict:
    t0 = time.perf_counter()
    try:
        course = await prisma.course.find_first(
            where={"id": course_id, "teacher": {"userId": user_id}},
            include={
                "semester": {
                    "include": {
                        "academicYear": {
                            "include": {
                                "program": {"include": {"department": True}}
                            }
                        }
                    }
                }
            },
        )

        if not course:
            TEACHER_COURSE_OPS_TOTAL.labels(operation="get_students", status="not_found").inc()
            raise HTTPException(status_code=404, detail="Course not found or access denied")

        rows = await prisma.query_raw(
            'SELECT "B" as student_id FROM "_CourseStudents" WHERE "A" = $1',
            course_id
        )

        student_ids = [r["student_id"] for r in rows]

        if not student_ids:
            students = []
        else:
            students_raw = await prisma.student.find_many(
                where={"id": {"in": student_ids}},
                include={
                    "user": True,
                    "program": {"include": {"department": True}},
                    "attendance": True,
                },
            )
            students = [s for s in students_raw if s.status != "graduated"]

        students = sorted(students, key=lambda s: s.user.name.lower())

        if not students:
            sem = course.semester
            ay = sem.academicYear if sem else None
            prog = ay.program if ay else None
            dept = prog.department if prog else None
            TEACHER_COURSE_OPS_TOTAL.labels(operation="get_students", status="success").inc()
            return {
                "course": {
                    "id": course.id,
                    "name": course.name,
                    "entryCode": course.entryCode,
                    "semester": {"id": sem.id, "name": sem.name} if sem else None,
                    "academicYear": {"id": ay.id, "name": ay.name} if ay else None,
                    "program": {"id": prog.id, "name": prog.name} if prog else None,
                    "department": {"id": dept.id, "name": dept.name} if dept else None,
                },
                "students": [],
            }

        attendance_counts_raw = await prisma.attendance.find_many(
            where={
                "courseId": course_id,
                "status": True,
                "studentId": {"in": [s.id for s in students]},
            },
        )
        attendance_map: dict[str, int] = {}
        for rec in attendance_counts_raw:
            attendance_map[rec.studentId] = attendance_map.get(rec.studentId, 0) + 1

        async with httpx.AsyncClient(timeout=2.0) as client:
            photo_tasks = [_fetch_photo_data(client, s.id) for s in students]
            photo_results: list[dict] = await asyncio.gather(*photo_tasks)

        student_list = []
        for s, photo_data in zip(students, photo_results):
            student_list.append(
                {
                    "id": s.id,
                    "user": {
                        "name": s.user.name,
                        "email": s.user.email,
                    },
                    "program": (
                        {
                            "id": s.program.id,
                            "name": s.program.name,
                            "department": (
                                {
                                    "id": s.program.department.id,
                                    "name": s.program.department.name,
                                }
                                if s.program and s.program.department
                                else None
                            ),
                        }
                        if s.program
                        else None
                    ),
                    "faceEmbedding": bool(getattr(s, "faceEmbedding", None)),
                    "hasPhotos": photo_data.get("hasPhotos", False),
                    "photoCount": photo_data.get("photoCount", 0),
                    "_count": {
                        "attendance": attendance_map.get(s.id, 0),
                    },
                }
            )

        sem = course.semester
        ay = sem.academicYear if sem else None
        prog = ay.program if ay else None
        dept = prog.department if prog else None

        course_data = {
            "id": course.id,
            "name": course.name,
            "entryCode": course.entryCode,
            "semester": {"id": sem.id, "name": sem.name} if sem else None,
            "academicYear": {"id": ay.id, "name": ay.name} if ay else None,
            "program": {"id": prog.id, "name": prog.name} if prog else None,
            "department": {"id": dept.id, "name": dept.name} if dept else None,
        }

        TEACHER_COURSE_OPS_TOTAL.labels(operation="get_students", status="success").inc()
        return {"course": course_data, "students": student_list}
    except HTTPException:
        raise
    except Exception:
        TEACHER_COURSE_OPS_TOTAL.labels(operation="get_students", status="error").inc()
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="get_course_students").inc()
        raise
    finally:
        TEACHER_COURSE_OP_DURATION_SECONDS.labels(operation="get_students").observe(time.perf_counter() - t0)


# ---------------------------------------------------------------------------
# Import students
# ---------------------------------------------------------------------------

async def import_students(course_id: str, user_id: str, data: ImportStudentsRequest) -> dict:
    t0 = time.perf_counter()
    try:
        teacher = await prisma.teacher.find_unique(where={"userId": user_id})
        if not teacher:
            TEACHER_COURSE_OPS_TOTAL.labels(operation="import", status="not_found").inc()
            raise HTTPException(status_code=404, detail="Teacher not found")

        course = await prisma.course.find_first(
            where={"id": course_id, "teacherId": teacher.id}
        )
        if not course:
            TEACHER_COURSE_OPS_TOTAL.labels(operation="import", status="not_found").inc()
            raise HTTPException(status_code=404, detail="Course not found")

        successful: list[str] = []
        failed: list[dict] = []
        existing: list[str] = []

        for item in data.students:
            if not all([item.name, item.email, item.program_id]):
                failed.append({"email": item.email or "unknown", "reason": "Missing required fields (name, email, or program)"})
                continue

            try:
                email = item.email.lower().strip()

                user = await prisma.user.find_unique(
                    where={"email": email},
                    include={"student": True},
                )

                if user:
                    if user.student:
                        from backend.common.prisma_client import db
                        enrolment_exists = await db.fetchval(
                            'SELECT 1 FROM "_CourseStudents" WHERE "A" = $1 AND "B" = $2',
                            course_id,
                            user.student.id
                        )
                        if enrolment_exists:
                            existing.append(email)
                            continue

                        await prisma.query_raw(
                            'INSERT INTO "_CourseStudents" ("A", "B") VALUES ($1, $2) ON CONFLICT DO NOTHING',
                            course_id,
                            user.student.id,
                        )
                        successful.append(email)
                    else:
                        failed.append({"email": email, "reason": "User exists but is not a student"})
                else:
                    if not item.dob:
                        failed.append({"email": email, "reason": "DOB is required for new students (used as password)"})
                        continue
                    dob_clean = item.dob.replace("-", "").replace("/", "")
                    hashed_pw = _hash_dob_password(dob_clean)
                    new_user = await prisma.user.create(
                        data={
                            "id": _make_cuid(),
                            "name": item.name,
                            "email": email,
                            "password": hashed_pw,
                            "role": "STUDENT",
                            "createdAt": datetime.utcnow(),
                            "updatedAt": datetime.utcnow(),
                            "student": {
                                "create": {
                                    "id": _make_cuid(),
                                    "programId": item.program_id
                                }
                            },
                        }
                    )
                    new_student = await prisma.student.find_unique(where={"userId": new_user.id})
                    if new_student:
                        await prisma.query_raw(
                            'INSERT INTO "_CourseStudents" ("A", "B") VALUES ($1, $2) ON CONFLICT DO NOTHING',
                            course_id,
                            new_student.id,
                        )
                    successful.append(email)

            except Exception as exc:
                failed.append({"email": item.email, "reason": str(exc)})

        TEACHER_COURSE_OPS_TOTAL.labels(operation="import", status="success").inc()
        return {
            "message": "Import completed",
            "successful": successful,
            "failed": failed,
            "existing": existing,
        }
    except HTTPException:
        raise
    except Exception:
        TEACHER_COURSE_OPS_TOTAL.labels(operation="import", status="error").inc()
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="import_students").inc()
        raise
    finally:
        TEACHER_COURSE_OP_DURATION_SECONDS.labels(operation="import").observe(time.perf_counter() - t0)


# ---------------------------------------------------------------------------
# Teacher-scoped students list
# ---------------------------------------------------------------------------

async def get_teacher_students(user_id: str, course_id: Optional[str] = None) -> list[dict]:
    t0 = time.perf_counter()
    try:
        teacher = await prisma.teacher.find_unique(where={"userId": user_id})
        if not teacher:
            TEACHER_STUDENT_OPS_TOTAL.labels(operation="list", status="not_found").inc()
            raise HTTPException(status_code=404, detail="Teacher not found")

        course_filter = {"teacherId": teacher.id}
        if course_id:
            course_filter["id"] = course_id

        courses = await prisma.course.find_many(
            where=course_filter,
            include={
                "students": {
                    "include": {
                        "user": True,
                        "program": {"include": {"department": True}},
                        "courses": True,
                    }
                }
            },
        )

        student_map: dict[str, dict] = {}

        for course in courses:
            for s in (course.students or []):
                if s.status == "graduated":
                    continue
                if s.id not in student_map:
                    from backend.common.prisma_client import db

                    if course_id:
                        attendance_count = await db.fetchval(
                            'SELECT COUNT(*) FROM "Attendance" WHERE "studentId" = $1 AND "courseId" = $2',
                            s.id, course_id
                        )
                    else:
                        attendance_count = await db.fetchval(
                            'SELECT COUNT(*) FROM "Attendance" a '
                            'JOIN "Course" c ON a."courseId" = c.id '
                            'WHERE a."studentId" = $1 AND c."teacherId" = $2',
                            s.id, teacher.id
                        )
                    attendance_count = int(attendance_count or 0)

                    courses_count = await db.fetchval(
                        'SELECT COUNT(*) FROM "_CourseStudents" cs '
                        'JOIN "Course" c ON cs."A" = c.id '
                        'WHERE cs."B" = $1 AND c."teacherId" = $2',
                        s.id, teacher.id
                    )
                    courses_count = int(courses_count or 0)

                    student_map[s.id] = {
                        "id": s.id,
                        "user": {"name": s.user.name, "email": s.user.email},
                        "program": (
                            {
                                "id": s.program.id,
                                "name": s.program.name,
                                "department": (
                                    {
                                        "id": s.program.department.id,
                                        "name": s.program.department.name,
                                    }
                                    if s.program.department
                                    else None
                                ),
                            }
                            if s.program
                            else None
                        ),
                        "faceEmbedding": bool(getattr(s, "faceEmbedding", None)),
                        "courses": [{"id": c.id, "name": c.name} for c in (s.courses or [])],
                        "_count": {
                            "courses": courses_count,
                            "attendance": attendance_count,
                        },
                    }

        students_list = list(student_map.values())
        students_list.sort(key=lambda s: s["user"]["name"].lower() if s["user"]["name"] else "")
        TEACHER_STUDENT_OPS_TOTAL.labels(operation="list", status="success").inc()
        return students_list
    except HTTPException:
        raise
    except Exception:
        TEACHER_STUDENT_OPS_TOTAL.labels(operation="list", status="error").inc()
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="get_teacher_students").inc()
        raise
    finally:
        TEACHER_STUDENT_OP_DURATION_SECONDS.labels(operation="list").observe(time.perf_counter() - t0)


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

async def get_report(
    user_id: str,
    course_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> list[dict]:
    t0 = time.perf_counter()
    try:
        teacher = await prisma.teacher.find_unique(where={"userId": user_id})
        if not teacher:
            raise HTTPException(status_code=404, detail="Teacher not found")

        course = await prisma.course.find_first(
            where={"id": course_id, "teacherId": teacher.id},
            include={"students": {"include": {"user": True}}},
        )
        if not course:
            raise HTTPException(status_code=404, detail="Course not found or access denied")

        date_filter: dict = {"courseId": course_id}
        if start_date:
            date_filter.setdefault("timestamp", {})["gte"] = _parse_dt(start_date).replace(tzinfo=None)
        if end_date:
            end_dt = _parse_dt(end_date).replace(tzinfo=None).replace(
                hour=23, minute=59, second=59, microsecond=999999
            )
            date_filter.setdefault("timestamp", {})["lte"] = end_dt

        records = await prisma.attendance.find_many(
            where=date_filter,
            include={"student": {"include": {"user": True}}},
            order={"timestamp": "desc"},
        )

        if not records:
            report = [
                {
                    "studentName": s.user.name + (" (Graduated)" if s.status == "graduated" else ""),
                    "studentEmail": s.user.email,
                    "totalSessions": 0,
                    "attended": 0,
                    "percentage": 0,
                }
                for s in (course.students or [])
            ]
            report.sort(key=lambda x: x["studentName"])
            return report

        total_sessions = len({str(_to_ist(r.timestamp))[:10] for r in records})

        student_stats: dict[str, dict] = {}
        for s in (course.students or []):
            name_display = s.user.name
            if s.status == "graduated":
                name_display += " (Graduated)"

            student_stats[s.id] = {
                "studentName": name_display,
                "studentEmail": s.user.email,
                "attendedSessions": set(),
            }

        for r in records:
            if r.status and r.studentId in student_stats:
                student_stats[r.studentId]["attendedSessions"].add(str(_to_ist(r.timestamp))[:10])

        report = []
        for stats in student_stats.values():
            attended = len(stats["attendedSessions"])
            pct = round((attended / total_sessions) * 100, 1) if total_sessions > 0 else 0.0
            report.append(
                {
                    "studentName": stats["studentName"],
                    "studentEmail": stats["studentEmail"],
                    "totalSessions": total_sessions,
                    "attended": attended,
                    "percentage": pct,
                }
            )

        report.sort(key=lambda x: x["studentName"])
        return report
    except HTTPException:
        raise
    except Exception:
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="get_report").inc()
        raise
    finally:
        TEACHER_REPORT_DURATION_SECONDS.labels(endpoint="report").observe(time.perf_counter() - t0)


# ---------------------------------------------------------------------------
# Send credentials
# ---------------------------------------------------------------------------

async def send_credentials(data: SendCredentialsRequest) -> dict:
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    email_user = os.environ.get("EMAIL_USER")
    email_pass = os.environ.get("EMAIL_PASS")

    if not email_user or not email_pass:
        raise HTTPException(
            status_code=503,
            detail="Email service not configured (EMAIL_USER / EMAIL_PASS missing)",
        )

    smtp_host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))

    sent: list[str] = []
    failed: list[str] = []

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.starttls()
        server.login(email_user, email_pass)

        for student in data.students:
            if not student.email:
                continue
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = "Your Student Portal Login Credentials"
                msg["From"] = f"Academic Team <{email_user}>"
                msg["To"] = student.email

                html = f"""
                <div style="font-family: Arial, sans-serif; color: #333;">
                  <h2>Hello {student.name},</h2>
                  <p>Welcome to the student portal!</p>
                  <p>Your account has been created. Log in using:</p>
                  <ul>
                    <li><strong>Email:</strong> {student.email}</li>
                    <li><strong>Password:</strong> {student.dob}</li>
                  </ul>
                  <p>⚠️ Please change your password after your first login.</p>
                  <br/>
                  <p>Best regards,<br/>Your Academic Team</p>
                </div>
                """
                msg.attach(MIMEText(html, "html"))
                server.sendmail(email_user, student.email, msg.as_string())
                sent.append(student.email)
            except Exception:
                failed.append(student.email)

    return {"success": True, "message": "Emails sent successfully", "sent": sent, "failed": failed}


# ---------------------------------------------------------------------------
# At-risk students
# ---------------------------------------------------------------------------

async def get_at_risk_students(user_id: str) -> list[dict]:
    t0 = time.perf_counter()
    try:
        teacher = await prisma.teacher.find_unique(where={"userId": user_id})
        if not teacher:
            TEACHER_STUDENT_OPS_TOTAL.labels(operation="at_risk", status="not_found").inc()
            raise HTTPException(status_code=404, detail="Teacher not found")

        courses = await prisma.course.find_many(
            where={"teacherId": teacher.id},
            include={"students": {"include": {"user": True}}},
        )

        at_risk = []

        for course in courses:
            records = await prisma.attendance.find_many(where={"courseId": course.id})
            total_sessions = len({str(r.timestamp) for r in records})
            if total_sessions == 0:
                continue

            for student in (course.students or []):
                if student.status == "graduated":
                    continue
                attended = sum(
                    1 for r in records
                    if r.studentId == student.id and r.status
                )
                pct = round((attended / total_sessions) * 100, 1)
                if pct < 75:
                    at_risk.append({
                        "student_id": student.id,
                        "student_name": student.user.name,
                        "student_email": student.user.email,
                        "course_id": course.id,
                        "course_name": course.name,
                        "attended": attended,
                        "total": total_sessions,
                        "attendance_rate": pct,
                    })

        at_risk.sort(key=lambda x: x["attendance_rate"])
        TEACHER_STUDENT_OPS_TOTAL.labels(operation="at_risk", status="success").inc()
        return at_risk
    except HTTPException:
        raise
    except Exception:
        TEACHER_STUDENT_OPS_TOTAL.labels(operation="at_risk", status="error").inc()
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="get_at_risk_students").inc()
        raise
    finally:
        TEACHER_REPORT_DURATION_SECONDS.labels(endpoint="at_risk").observe(time.perf_counter() - t0)


# ---------------------------------------------------------------------------
# Search and enroll existing students
# ---------------------------------------------------------------------------

async def search_students(user_id: str, query: str, course_id: Optional[str] = None) -> dict:
    t0 = time.perf_counter()
    try:
        teacher = await prisma.teacher.find_unique(where={"userId": user_id})
        if not teacher:
            TEACHER_STUDENT_OPS_TOTAL.labels(operation="search", status="not_found").inc()
            raise HTTPException(status_code=404, detail="Teacher not found")

        from backend.common.prisma_client import db

        q = f"%{query}%"

        if course_id:
            sql = '''
                SELECT s.id, u.name, u.email, p.name as program_name, d.name as department_name, s."faceEmbedding"
                FROM "Student" s
                JOIN "User" u ON s."userId" = u.id
                JOIN "Program" p ON s."programId" = p.id
                JOIN "Department" d ON p."departmentId" = d.id
                WHERE s.status != 'graduated'
                  AND (u.name ILIKE $1 OR u.email ILIKE $1)
                  AND s.id NOT IN (
                      SELECT "B" FROM "_CourseStudents" WHERE "A" = $2
                  )
                ORDER BY u.name ASC
                LIMIT 200
            '''
            rows = await db.fetch(sql, q, course_id)
        else:
            sql = '''
                SELECT s.id, u.name, u.email, p.name as program_name, d.name as department_name, s."faceEmbedding"
                FROM "Student" s
                JOIN "User" u ON s."userId" = u.id
                JOIN "Program" p ON s."programId" = p.id
                JOIN "Department" d ON p."departmentId" = d.id
                WHERE s.status != 'graduated'
                  AND (u.name ILIKE $1 OR u.email ILIKE $1)
                ORDER BY u.name ASC
                LIMIT 200
            '''
            rows = await db.fetch(sql, q)

        students = []
        for r in rows:
            students.append({
                "id": r["id"],
                "name": r["name"],
                "email": r["email"],
                "program": {
                    "name": r["program_name"],
                    "department": {"name": r["department_name"]}
                },
                "face_embedding": bool(r["faceEmbedding"])
            })

        TEACHER_STUDENT_OPS_TOTAL.labels(operation="search", status="success").inc()
        return {"students": students}
    except HTTPException:
        raise
    except Exception:
        TEACHER_STUDENT_OPS_TOTAL.labels(operation="search", status="error").inc()
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="search_students").inc()
        raise
    finally:
        TEACHER_STUDENT_OP_DURATION_SECONDS.labels(operation="search").observe(time.perf_counter() - t0)


async def enroll_existing_student(course_id: str, user_id: str, student_id: str) -> dict:
    t0 = time.perf_counter()
    try:
        teacher = await prisma.teacher.find_unique(where={"userId": user_id})
        if not teacher:
            TEACHER_COURSE_OPS_TOTAL.labels(operation="enroll_existing", status="not_found").inc()
            raise HTTPException(status_code=404, detail="Teacher not found")

        course = await prisma.course.find_first(
            where={"id": course_id, "teacherId": teacher.id}
        )
        if not course:
            TEACHER_COURSE_OPS_TOTAL.labels(operation="enroll_existing", status="not_found").inc()
            raise HTTPException(status_code=404, detail="Course not found or access denied")

        from backend.common.prisma_client import db

        student_exists = await db.fetchval('SELECT id FROM "Student" WHERE id = $1', student_id)
        if not student_exists:
            TEACHER_COURSE_OPS_TOTAL.labels(operation="enroll_existing", status="not_found").inc()
            raise HTTPException(status_code=404, detail="Student not found")

        enrolment_exists = await db.fetchval(
            'SELECT 1 FROM "_CourseStudents" WHERE "A" = $1 AND "B" = $2',
            course_id, student_id
        )
        if enrolment_exists:
            TEACHER_COURSE_OPS_TOTAL.labels(operation="enroll_existing", status="conflict").inc()
            raise HTTPException(status_code=400, detail="Student already enrolled in this course")

        await prisma.query_raw(
            'INSERT INTO "_CourseStudents" ("A", "B") VALUES ($1, $2)',
            course_id, student_id
        )

        TEACHER_COURSE_OPS_TOTAL.labels(operation="enroll_existing", status="success").inc()
        return {"success": True, "message": "Student successfully enrolled"}
    except HTTPException:
        raise
    except Exception:
        TEACHER_COURSE_OPS_TOTAL.labels(operation="enroll_existing", status="error").inc()
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="enroll_existing_student").inc()
        raise
    finally:
        TEACHER_COURSE_OP_DURATION_SECONDS.labels(operation="enroll_existing").observe(time.perf_counter() - t0)


async def remove_student_from_course(user_id: str, course_id: str, data: RemoveStudentRequest) -> dict:
    t0 = time.perf_counter()
    try:
        student_id = data.student_id
        teacher = await prisma.teacher.find_unique(where={"userId": user_id})
        if not teacher:
            TEACHER_COURSE_OPS_TOTAL.labels(operation="remove_student", status="not_found").inc()
            raise HTTPException(status_code=404, detail="Teacher not found")

        course = await prisma.course.find_first(
            where={"id": course_id, "teacherId": teacher.id}
        )
        if not course:
            TEACHER_COURSE_OPS_TOTAL.labels(operation="remove_student", status="not_found").inc()
            raise HTTPException(status_code=404, detail="Course not found or access denied")

        from backend.common.prisma_client import db

        student_exists = await db.fetchval('SELECT id FROM "Student" WHERE id = $1', student_id)
        if not student_exists:
            TEACHER_COURSE_OPS_TOTAL.labels(operation="remove_student", status="not_found").inc()
            raise HTTPException(status_code=404, detail="Student not found")

        enrolment_exists = await db.fetchval(
            'SELECT 1 FROM "_CourseStudents" WHERE "A" = $1 AND "B" = $2',
            course_id, student_id
        )
        if not enrolment_exists:
            TEACHER_COURSE_OPS_TOTAL.labels(operation="remove_student", status="error").inc()
            raise HTTPException(status_code=400, detail="Student not enrolled in this course")

        await prisma.query_raw(
            'DELETE FROM "_CourseStudents" WHERE "A" = $1 AND "B" = $2',
            course_id, student_id
        )

        TEACHER_COURSE_OPS_TOTAL.labels(operation="remove_student", status="success").inc()
        return {"success": True, "message": "Student successfully removed from the course"}
    except HTTPException:
        raise
    except Exception:
        TEACHER_COURSE_OPS_TOTAL.labels(operation="remove_student", status="error").inc()
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="remove_student_from_course").inc()
        raise
    finally:
        TEACHER_COURSE_OP_DURATION_SECONDS.labels(operation="remove_student").observe(time.perf_counter() - t0)