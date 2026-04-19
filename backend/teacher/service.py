"""
backend/teacher/service.py

Pure business logic for the Teacher microservice.
All DB access goes through prisma_client.prisma.
Mirrors the logic in the Next.js teacher API routes.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Optional

import bcrypt
from fastapi import HTTPException

from backend.common.prisma_client import prisma
from backend.teacher.schemas import (
    GetStudentsRequest,
    ImportStudentsRequest,
    SubmitAttendanceRequest,
    SendCredentialsRequest,
)
import httpx

PYTHON_API_URL = os.environ.get("PYTHON_API_URL", "http://localhost:8003")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _hash_dob_password(dob: str) -> str:
    """
    Hash a DOB string as the initial student password.
    Strips separators for consistency: '2004-03-13' → '20040313'
    """
    cleaned = dob.replace("-", "").replace("/", "").replace(" ", "")
    return bcrypt.hashpw(cleaned.encode(), bcrypt.gensalt()).decode()


# ---------------------------------------------------------------------------
# Me
# ---------------------------------------------------------------------------

async def get_me(user_id: str) -> dict:
    """
    Return teacher profile with department + course list.
    Mirrors GET /api/teacher/me
    """
    teacher = await prisma.teacher.find_unique(
        where={"userId": user_id},
        include={"user": True, "department": True, "courses": True},
    )
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    return {
        "id": teacher.id,
        "name": teacher.user.name,
        "department": teacher.department.name if teacher.department else None,
        "courses": [{"id": c.id, "name": c.name} for c in (teacher.courses or [])],
    }


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

async def get_stats(user_id: str) -> dict:
    """
    Per-teacher dashboard counts.
    Mirrors GET /api/teacher/stats
    """
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
            unique_student_ids.add(s.id)

    total_students = len(unique_student_ids)

    # Unique semesters
    semester_rows = await prisma.course.find_many(
        where={"teacherId": teacher_id},
    )
    unique_semesters = {c.semesterId for c in semester_rows}
    total_semesters = len(unique_semesters)

    # Total attendance records for teacher's courses
    total_attendance = 0
    if course_ids:
        total_attendance = await prisma.attendance.count(
            where={"courseId": {"in": course_ids}}
        )

    return {
        "courses": courses_count,
        "total_students": total_students,
        "total_semesters": total_semesters,
        "total_attendance": total_attendance,
    }


# ---------------------------------------------------------------------------
# Hierarchy
# ---------------------------------------------------------------------------

async def get_hierarchy(user_id: str) -> dict:
    """
    Return the full Department → Program → AcademicYear → Semester → Course tree
    for courses taught by this teacher.
    Mirrors GET /api/teacher/hierarchy
    """
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

    # Build nested structure using plain dicts (Maps → dicts keyed by id)
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

    # Serialise maps → lists
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

    return {"departments": _dept_to_list(depts)}


# ---------------------------------------------------------------------------
# Courses
# ---------------------------------------------------------------------------

async def get_courses(user_id: str) -> list[dict]:
    """
    Return all courses taught by this teacher with student count and real session count.
    Mirrors GET /api/teacher/courses
    """
    teacher = await prisma.teacher.find_unique(where={"userId": user_id})
    if not teacher:
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
        # Real session count = distinct timestamps in attendance for this course
        attendance_rows = await prisma.attendance.find_many(
            where={"courseId": course.id},
        )
        unique_sessions = len({str(r.timestamp) for r in attendance_rows})

        sem = course.semester
        ay = sem.academicYear
        prog = ay.program
        dept = prog.department if prog else None

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
                "student_count": len(course.students or []),
                "session_count": unique_sessions,
            }
        )

    return result


# ---------------------------------------------------------------------------
# Attendance — get-students
# ---------------------------------------------------------------------------

async def get_course_students_for_attendance(
    user_id: str, data: GetStudentsRequest
) -> list[dict]:
    """
    List students enrolled in a course (for attendance marking UI).
    Mirrors POST ?operation=get-students
    """
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
        raise HTTPException(status_code=404, detail="Course not found")

    return [
        {
            "id": s.id,
            "name": s.user.name,
            "email": s.user.email,
            "has_face_data": bool(getattr(s, "faceEmbedding", None)),
        }
        for s in (course.students or [])
    ]


# ---------------------------------------------------------------------------
# Attendance — train-student  (proxy to Python face service)
# ---------------------------------------------------------------------------

async def train_student(
    user_id: str,
    teacher_id_str: str,
    student_id: str,
    course_id: str,
    photos_bytes: list[tuple[bytes, str]],  # [(content, filename), ...]
) -> dict:
    import httpx
 
    student = await prisma.student.find_first(
        where={
            "id": student_id,
            "courses": {"some": {"id": course_id, "teacherId": teacher_id_str}},
        },
        include={"user": True},
    )
    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found or not enrolled in course",
        )
 
    if len(photos_bytes) < 3:
        raise HTTPException(status_code=400, detail="3 photos required (front, left, right)")
 
    async with httpx.AsyncClient(timeout=60.0) as client:
        # ✅ Field name matches /api/process-student: studentId (camelCase)
        # ✅ File field names match FastAPI params: front, left, right
        files = [
            ("front", (photos_bytes[0][1], photos_bytes[0][0], "image/jpeg")),
            ("left",  (photos_bytes[1][1], photos_bytes[1][0], "image/jpeg")),
            ("right", (photos_bytes[2][1], photos_bytes[2][0], "image/jpeg")),
        ]
        data = {"studentId": student_id}   # ✅ camelCase matches Form(alias)
        resp = await client.post(f"{PYTHON_API_URL}/api/process-student", data=data, files=files)
 
        if resp.status_code == 422:
            # Surface the face-detection error message to the caller
            detail = resp.json().get("detail", "Face validation failed")
            raise HTTPException(status_code=422, detail=detail)
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Python face service error: {resp.text}")
 
        result = resp.json()
 
    return {
        "success": True,
        "student_id": student_id,
        "student_name": student.user.name,
        "photos_saved": 3,
        "result": result,
    }


# ---------------------------------------------------------------------------
# Attendance — run-training  (proxy to Python face service)
# ---------------------------------------------------------------------------
 
async def run_training(data) -> dict:
    import httpx
 
    if not data.course_id:
        raise HTTPException(status_code=400, detail="Course ID required")
 
    async with httpx.AsyncClient(timeout=300.0) as client:   # ✅ 5 min — training is slow
        resp = await client.post(
            f"{PYTHON_API_URL}/api/train",
            headers={"Content-Type": "application/json"},
        )
        if resp.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"Training failed: {resp.text}",
            )
        result = resp.json()
 
    return {
        "success": True,
        "message": "Training completed successfully",
        "results": result,
    }


# ---------------------------------------------------------------------------
# Attendance — recognize faces  (proxy to Python face service)
# ---------------------------------------------------------------------------
 
async def recognize_faces(
    course_id: str,
    batch_id,
    frames_bytes: list[tuple[bytes, str]],
    auto_submit: bool = False,
) -> dict:
    import httpx
    from datetime import datetime, timezone
 
    if not course_id or not frames_bytes:
        raise HTTPException(status_code=400, detail="Missing required fields")
 
    async with httpx.AsyncClient(timeout=120.0) as client:
        # ✅ Field name matches Form param in face service: courseId
        files = [
            ("frames", (fname, content, "image/jpeg"))
            for content, fname in frames_bytes
        ]
        data = {"courseId": course_id}
        resp = await client.post(f"{PYTHON_API_URL}/api/recognize", data=data, files=files)
 
        if resp.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"Recognition failed: {resp.text}",
            )
        results = resp.json()
 
    # In recognize_faces(), around line 456
    recognized_ids: list[str] = results.get("recognizedStudents", [])

    # Enrich recognised IDs with student names from DB
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
 
    return {**enhanced, "attendance": attendance_result}


# ---------------------------------------------------------------------------
# Attendance — submit-attendance
# ---------------------------------------------------------------------------

async def submit_attendance(data: SubmitAttendanceRequest) -> dict:
    """
    Persist attendance records for a course from recognition results.
    Mirrors POST ?operation=submit-attendance
    """
    course_id = data.course_id
    recognition_results = data.recognition_results
    date_str = data.date

    recognized_ids: list[str] = [
        (s if isinstance(s, str) else s["id"])
        for s in recognition_results.get("recognizedStudents", [])
    ]
    result = await _do_submit_attendance(course_id, recognized_ids, date_str)
    return result


async def _do_submit_attendance(
    course_id: str,
    recognized_ids: list[str],
    date_str: Optional[str],
) -> dict:
    attendance_date = datetime.fromisoformat(date_str) if date_str else datetime.now(timezone.utc)
    start_of_day = attendance_date.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day = attendance_date.replace(hour=23, minute=59, second=59, microsecond=999999)

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
                    "studentId": student.id,
                    "courseId": course_id,
                    "status": is_present,
                    "timestamp": attendance_date,
                }
            )
        records.append(rec)

    present_count = sum(1 for r in records if r.status)

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
    """
    Return all attendance records for a course, grouped by date.
    Mirrors GET ?operation=get-attendance-history
    """
    records = await prisma.attendance.find_many(
        where={"courseId": course_id},
        include={"student": {"include": {"user": True}}},
        order={"timestamp": "desc"},
    )

    grouped: dict[str, list] = {}
    for r in records:
        date_key = str(r.timestamp)[:10]
        grouped.setdefault(date_key, []).append(
            {
                "studentId": r.studentId,
                "studentName": r.student.user.name,
                "studentEmail": r.student.user.email,
                "status": r.status,
                "timestamp": str(r.timestamp),
            }
        )

    return {
        "courseId": course_id,
        "attendanceByDate": grouped,
        "totalRecords": len(records),
    }


# ---------------------------------------------------------------------------
# Course students (detail view)
# ---------------------------------------------------------------------------


async def get_course_students(user_id: str, course_id: str) -> dict:
    """
    Full student list for a course with face-data status.
    Mirrors GET /api/teacher/courses/[courseId]/students
    """

    # -------------------------------
    # 1. Validate course access
    # -------------------------------
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
        raise HTTPException(status_code=404, detail="Course not found or access denied")

    # -------------------------------
    # 2. Get student IDs (join table)
    # -------------------------------
    rows = await prisma.query_raw(
        'SELECT "B" as student_id FROM "_CourseStudents" WHERE "A" = $1',
        course_id
    )

    student_ids = [r["student_id"] for r in rows]

    if not student_ids:
        students = []
    else:
        students = await prisma.student.find_many(
            where={"id": {"in": student_ids}},
            include={
                "user": True,
                "program": {"include": {"department": True}},
                "attendance": True,
            },
        )
    # Sort in Python (ORM limitation)
    students = sorted(students, key=lambda s: s.user.name.lower())

    # -------------------------------
    # 4. Build student response
    # -------------------------------
    student_list = []

    async with httpx.AsyncClient(timeout=3.0) as client:
        for s in students:

            # Attendance count
            attendance_count = await prisma.attendance.count(
                where={"studentId": s.id, "courseId": course_id}
            )

            # 🔥 Fetch photo info from Face Service
            try:
                resp = await client.get(f"{PYTHON_API_URL}/api/student/{s.id}/photos")
                if resp.status_code == 200:
                    photo_data = resp.json()
                else:
                    photo_data = {"hasPhotos": False, "photoCount": 0}
            except Exception:
                photo_data = {"hasPhotos": False, "photoCount": 0}

            student_list.append(
                {
                    "id": s.id,
                    "user": {
                        "name": s.user.name,
                        "email": s.user.email
                    },
                    "program": (
                        {
                            "id": s.program.id,
                            "name": s.program.name,
                            "department": (
                                {
                                    "id": s.program.department.id,
                                    "name": s.program.department.name
                                }
                                if s.program and s.program.department
                                else None
                            ),
                        }
                        if s.program
                        else None
                    ),
                    "faceEmbedding": bool(getattr(s, "faceEmbedding", None)),

                    # ✅ FIXED VALUES
                    "hasPhotos": photo_data["hasPhotos"],
                    "photoCount": photo_data["photoCount"],

                    "_count": {
                        "attendance": attendance_count
                    },
                }
            )

    # -------------------------------
    # 5. Serialize course
    # -------------------------------
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

    return {
        "course": course_data,
        "students": student_list
    }

# ---------------------------------------------------------------------------
# Import students from CSV data
# ---------------------------------------------------------------------------

async def import_students(course_id: str, user_id: str, data: ImportStudentsRequest) -> dict:
    """
    Bulk-create or enrol students in a course from parsed CSV data.
    Mirrors POST /api/teacher/courses/[courseId]/import
    """
    # Verify course belongs to teacher
    teacher = await prisma.teacher.find_unique(where={"userId": user_id})
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    course = await prisma.course.find_first(
        where={"id": course_id, "teacherId": teacher.id}
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    successful: list[str] = []
    failed: list[dict] = []
    existing: list[str] = []

    for item in data.students:
        if not all([item.name, item.email, item.dob, item.program_id]):
            failed.append({"email": item.email or "unknown", "reason": "Missing required fields"})
            continue

        try:
            dob_clean = item.dob.replace("-", "").replace("/", "")
            hashed_pw = _hash_dob_password(dob_clean)
            email = item.email.lower().strip()

            user = await prisma.user.find_unique(
                where={"email": email},
                include={"student": True},
            )

            if user:
                if user.student:
                    # Check if already enrolled
                    enrolment = await prisma.course.find_first(
                        where={
                            "id": course_id,
                            "students": {"some": {"id": user.student.id}},
                        }
                    )
                    if enrolment:
                        existing.append(email)
                        continue

                    # Enrol existing student
                    await prisma.query_raw(
                        'INSERT INTO "_CourseStudents" ("A", "B") VALUES ($1, $2) ON CONFLICT DO NOTHING',
                        course_id,
                        user.student.id,
                    )
                    successful.append(email)
                else:
                    failed.append({"email": email, "reason": "User exists but is not a student"})
            else:
                # Create user + student + enrolment
                new_user = await prisma.user.create(
                    data={
                        "name": item.name,
                        "email": email,
                        "password": hashed_pw,
                        "role": "STUDENT",
                        "student": {
                            "create": {"programId": item.program_id}
                        },
                    }
                )
                # Get newly created student record
                new_student = await prisma.student.find_unique(
                    where={"userId": new_user.id}
                )
                if new_student:
                    await prisma.query_raw(
                        'INSERT INTO "_CourseStudents" ("A", "B") VALUES ($1, $2) ON CONFLICT DO NOTHING',
                        course_id,
                        new_student.id,
                    )
                successful.append(email)

        except Exception as exc:
            failed.append({"email": item.email, "reason": str(exc)})

    return {
        "message": "Import completed",
        "successful": successful,
        "failed": failed,
        "existing": existing,
    }


# ---------------------------------------------------------------------------
# Teacher-scoped students list
# ---------------------------------------------------------------------------

async def get_teacher_students(user_id: str, course_id: Optional[str] = None) -> list[dict]:
    """
    All students enrolled in at least one of this teacher's courses.
    Optionally filtered to a single course.
    Mirrors GET /api/teacher/students
    """
    teacher = await prisma.teacher.find_unique(where={"userId": user_id})
    if not teacher:
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
            if s.id not in student_map:
                attendance_count = await prisma.attendance.count(
                    where={"studentId": s.id, "course": {"teacherId": teacher.id}}
                )
                courses_count = await prisma.course.count(
                    where={
                        "teacherId": teacher.id,
                        "students": {"some": {"id": s.id}},
                    }
                )
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

    return list(student_map.values())


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

async def get_report(
    user_id: str,
    course_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> list[dict]:
    """
    Per-student attendance summary for a course with optional date range.
    Mirrors GET /api/teacher/reports
    """
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
        date_filter.setdefault("timestamp", {})["gte"] = datetime.fromisoformat(start_date)
    if end_date:
        end_dt = datetime.fromisoformat(end_date).replace(
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
                "studentName": s.user.name,
                "studentEmail": s.user.email,
                "totalSessions": 0,
                "attended": 0,
                "percentage": 0,
            }
            for s in (course.students or [])
        ]
        report.sort(key=lambda x: x["studentName"])
        return report

    # Unique sessions = distinct timestamp strings
    total_sessions = len({str(r.timestamp) for r in records})

    # Map: student_id → attended timestamps
    student_stats: dict[str, dict] = {}
    for s in (course.students or []):
        student_stats[s.id] = {
            "studentName": s.user.name,
            "studentEmail": s.user.email,
            "attendedSessions": set(),
        }

    for r in records:
        if r.status and r.studentId in student_stats:
            student_stats[r.studentId]["attendedSessions"].add(str(r.timestamp))

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


# ---------------------------------------------------------------------------
# Send credentials via email
# ---------------------------------------------------------------------------

async def send_credentials(data: SendCredentialsRequest) -> dict:
    """
    Email login credentials to a list of newly imported students.
    Mirrors POST /api/teacher/send-credentials
    Uses SMTP via environment variables EMAIL_USER / EMAIL_PASS.
    """
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

async def get_at_risk_students(user_id: str) -> list[dict]:
    teacher = await prisma.teacher.find_unique(where={"userId": user_id})
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    courses = await prisma.course.find_many(
        where={"teacherId": teacher.id},
        include={"students": {"include": {"user": True}}},
    )

    at_risk = []

    for course in courses:
        records = await prisma.attendance.find_many(
            where={"courseId": course.id},
        )
        total_sessions = len({str(r.timestamp) for r in records})
        if total_sessions == 0:
            continue

        for student in (course.students or []):
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

    # Sort by worst attendance first
    at_risk.sort(key=lambda x: x["attendance_rate"])
    return at_risk