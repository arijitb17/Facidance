"""
backend/student/service.py

Pure business logic for the Student microservice.
No HTTP concerns here — all DB access via prisma_client.prisma.
"""

from __future__ import annotations


from fastapi import HTTPException

from backend.common.prisma_client import prisma
from backend.student.schemas import (
    JoinCourseRequest,
    UpdateProfileRequest,
)


# ---------------------------------------------------------------------------
# Me / Profile
# ---------------------------------------------------------------------------

async def get_me(user_id: str) -> dict:
    """
    Return the authenticated student's full profile.
    Mirrors GET /api/student/me.
    """
    user = await prisma.user.find_unique(
        where={"id": user_id},
        include={
            "student": {
                "include": {
                    "program": {"include": {"department": True}}
                }
            }
        },
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    s = user.student
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "created_at": user.createdAt.isoformat(),
        "student": {
            "id": s.id,
            "program_id": s.programId,
            "program_name": s.program.name if s and s.program else None,
            "department_name": (
                s.program.department.name
                if s and s.program and s.program.department
                else None
            ),
            "joined_at": s.joinedAt.isoformat(),
            "status": s.status,
            "face_embedding": s.faceEmbedding is not None,
        } if s else None,
    }


async def update_profile(user_id: str, data: UpdateProfileRequest) -> dict:
    """
    Update the student's name and/or email.
    Mirrors PATCH /api/student/profile.
    """
    update_data: dict = {}
    if data.name:
        update_data["name"] = data.name
    if data.email:
        update_data["email"] = data.email

    if not update_data:
        raise HTTPException(status_code=400, detail="Nothing to update")

    user = await prisma.user.update(
        where={"id": user_id},
        data=update_data,
    )
    return {"id": user.id, "name": user.name, "email": user.email}


async def check_photos(student_id: str) -> dict:
    """
    Check whether a student has a face embedding registered.
    Mirrors GET /api/student/check-photos.
    """
    student = await prisma.student.find_unique(where={"id": student_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    return {"has_photos": student.faceEmbedding is not None}


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

async def get_stats(user_id: str) -> dict:
    """
    Return the student's course count, attendance %, and total present.
    Mirrors GET /api/student/stats — including the dedup-by-day logic.
    """
    student = await prisma.student.find_unique(
        where={"userId": user_id},
        include={"courses": {"select": {"id": True}}},
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    enrolled_ids = [c.id for c in (student.courses or [])]
    total_courses = len(enrolled_ids)

    if not enrolled_ids:
        return {"total_courses": 0, "attendance_percentage": 0.0, "total_present": 0}

    records = await prisma.attendance.find_many(
        where={"studentId": student.id, "courseId": {"in": enrolled_ids}},
        order={"timestamp": "desc"},
    )

    # Deduplicate: keep only the most-recent record per (course, date)
    seen: dict[str, bool] = {}
    for r in records:
        date_str = r.timestamp.strftime("%Y-%m-%d")
        key = f"{r.courseId}-{date_str}"
        if key not in seen:
            seen[key] = r.status

    total_sessions = len(seen)
    total_present = sum(1 for v in seen.values() if v)
    attendance_pct = (
        round((total_present / total_sessions) * 100 * 10) / 10
        if total_sessions > 0
        else 0.0
    )

    return {
        "total_courses": total_courses,
        "attendance_percentage": attendance_pct,
        "total_present": total_present,
    }


# ---------------------------------------------------------------------------
# Courses
# ---------------------------------------------------------------------------

async def list_courses(user_id: str) -> list[dict]:
    """
    Return all courses the student is enrolled in.
    Mirrors GET /api/student/courses.
    """
    student = await prisma.student.find_unique(
        where={"userId": user_id},
        include={
            "courses": {
                "include": {
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
            }
        },
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    return [_serialize_course_list(c) for c in (student.courses or [])]


async def get_course(user_id: str, course_id: str) -> dict:
    """
    Return a single course detail (only if student is enrolled).
    Mirrors GET /api/student/courses/[id].
    """
    student = await prisma.student.find_unique(where={"userId": user_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    course = await prisma.course.find_unique(
        where={"id": course_id},
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
            "students": {"where": {"id": student.id}},
        },
    )

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    enrolled = any(s.id == student.id for s in (course.students or []))
    if not enrolled:
        raise HTTPException(status_code=403, detail="You are not enrolled in this course")

    return _serialize_course_detail(course)


async def join_course(user_id: str, data: JoinCourseRequest) -> dict:
    """
    Enrol a student into a course using its entry code.
    """
    student = await prisma.student.find_unique(where={"userId": user_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    course = await prisma.course.find_unique(
        where={"entryCode": data.entry_code.upper().strip()},
        include={"students": {"where": {"id": student.id}}},
    )
    if not course:
        raise HTTPException(status_code=404, detail="Invalid entry code")

    already_enrolled = any(s.id == student.id for s in (course.students or []))
    if already_enrolled:
        raise HTTPException(status_code=409, detail="Already enrolled in this course")

    # Connect student ↔ course (many-to-many)
    await prisma.course.update(
        where={"id": course.id},
        data={"students": {"connect": [{"id": student.id}]}},
    )
    return {"message": "Enrolled successfully", "course_id": course.id, "course_name": course.name}


async def leave_course(user_id: str, course_id: str) -> dict:
    """Remove a student from a course."""
    student = await prisma.student.find_unique(where={"userId": user_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    await prisma.course.update(
        where={"id": course_id},
        data={"students": {"disconnect": [{"id": student.id}]}},
    )
    return {"message": "Left course successfully"}


# ---------------------------------------------------------------------------
# Attendance
# ---------------------------------------------------------------------------

async def get_course_attendance(user_id: str, course_id: str) -> dict:
    """
    Return attendance records for a student in one course.
    Mirrors GET /api/student/courses/[id]/attendance.
    Deduplicates by (course, date) — same logic as stats.
    """
    student = await prisma.student.find_unique(where={"userId": user_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    course = await prisma.course.find_unique(where={"id": course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    records = await prisma.attendance.find_many(
        where={"studentId": student.id, "courseId": course_id},
        order={"timestamp": "desc"},
    )

    seen: dict[str, bool] = {}
    for r in records:
        date_str = r.timestamp.strftime("%Y-%m-%d")
        if date_str not in seen:
            seen[date_str] = r.status

    total = len(seen)
    present = sum(1 for v in seen.values() if v)
    rate = round((present / total) * 100, 1) if total > 0 else 0.0

    return {
        "course_id": course_id,
        "course_name": course.name,
        "total_sessions": total,
        "present": present,
        "absent": total - present,
        "rate": rate,
        "records": [
            {"date": date, "status": status}
            for date, status in sorted(seen.items(), reverse=True)
        ],
    }


async def get_attendance_history(user_id: str) -> dict:
    """
    Full attendance history across all enrolled courses.
    Mirrors GET /api/student/history.
    """
    student = await prisma.student.find_unique(
        where={"userId": user_id},
        include={"courses": True},
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    enrolled_ids = [c.id for c in (student.courses or [])]
    if not enrolled_ids:
        return {"records": [], "summary": []}

    all_records = await prisma.attendance.find_many(
        where={"studentId": student.id, "courseId": {"in": enrolled_ids}},
        include={"course": True},
        order={"timestamp": "desc"},
    )

    # Dedup per course per day
    seen: dict[str, dict] = {}  # key → {date, status, course_id, course_name}
    for r in all_records:
        date_str = r.timestamp.strftime("%Y-%m-%d")
        key = f"{r.courseId}-{date_str}"
        if key not in seen:
            seen[key] = {
                "course_id": r.courseId,
                "course_name": r.course.name if r.course else "",
                "date": date_str,
                "status": r.status,
            }

    deduped = sorted(seen.values(), key=lambda x: x["date"], reverse=True)

    # Per-course summary
    summary_map: dict[str, dict] = {}
    for rec in deduped:
        cid = rec["course_id"]
        if cid not in summary_map:
            summary_map[cid] = {
                "course_id": cid,
                "course_name": rec["course_name"],
                "total_sessions": 0,
                "present": 0,
                "absent": 0,
            }
        summary_map[cid]["total_sessions"] += 1
        if rec["status"]:
            summary_map[cid]["present"] += 1
        else:
            summary_map[cid]["absent"] += 1

    summary = []
    for s in summary_map.values():
        t = s["total_sessions"]
        s["rate"] = round((s["present"] / t) * 100, 1) if t > 0 else 0.0
        summary.append(s)

    return {"records": deduped, "summary": summary}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _serialize_course_list(c) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "code": c.code,
        "entry_code": c.entryCode,
        "teacher_name": (
            c.teacher.user.name if (c.teacher and c.teacher.user) else None
        ),
        "semester_name": c.semester.name if c.semester else None,
        "academic_year": (
            c.semester.academicYear.name
            if (c.semester and c.semester.academicYear)
            else None
        ),
        "program_name": (
            c.semester.academicYear.program.name
            if (c.semester and c.semester.academicYear and c.semester.academicYear.program)
            else None
        ),
    }


def _serialize_course_detail(c) -> dict:
    return {
        **_serialize_course_list(c),
        "teacher_id": c.teacherId,
        "teacher_email": (
            c.teacher.user.email if (c.teacher and c.teacher.user) else None
        ),
    }
