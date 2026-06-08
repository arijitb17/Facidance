"""
backend/teacher/router.py

All teacher HTTP endpoints.
Router → Service ONLY. No DB calls here.

Endpoints mirror the Next.js teacher API routes:
  GET  /teacher/me
  GET  /teacher/stats
  GET  /teacher/hierarchy
  GET  /teacher/courses
  GET  /teacher/courses/{course_id}/students
  DELETE /teacher/courses/{course_id}/students
  POST /teacher/courses/{course_id}/import
  POST /teacher/courses/{course_id}/enroll-existing
  GET  /teacher/students
  GET  /teacher/students/search
  GET  /teacher/students/at-risk
  GET  /teacher/reports
  GET  /teacher/attendance/history
  POST /teacher/attendance/get-students
  POST /teacher/attendance/train-student
  POST /teacher/attendance/run-training
  POST /teacher/attendance/recognize
  POST /teacher/attendance/submit
  PATCH /teacher/attendance/mark-present
  POST /teacher/send-credentials
"""

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Path, Query, UploadFile

from backend.teacher.dependencies import get_current_teacher
from backend.teacher import service
from backend.teacher.schemas import (
    GetStudentsRequest,
    ImportStudentsRequest,
    MarkPresentRequest,
    RemoveStudentRequest,
    RunTrainingRequest,
    SendCredentialsRequest,
    SubmitAttendanceRequest,
    EnrollExistingRequest,
)
from backend.common.metrics import TEACHER_UNHANDLED_ERRORS_TOTAL

router = APIRouter(prefix="/teacher", tags=["Teacher"])

TeacherUser = Annotated[dict, Depends(get_current_teacher)]


# ---------------------------------------------------------------------------
# Profile & Stats
# ---------------------------------------------------------------------------

@router.get("/me", summary="Get teacher profile (name, department, courses)")
async def me(teacher: TeacherUser):
    try:
        return await service.get_me(teacher["id"])
    except HTTPException:
        raise
    except Exception:
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/teacher/me").inc()
        raise


@router.get("/stats", summary="Dashboard counts for the logged-in teacher")
async def stats(teacher: TeacherUser):
    try:
        return await service.get_stats(teacher["id"])
    except HTTPException:
        raise
    except Exception:
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/teacher/stats").inc()
        raise


# ---------------------------------------------------------------------------
# Hierarchy (Department → Program → Year → Semester → Course)
# ---------------------------------------------------------------------------

@router.get("/hierarchy", summary="Full course hierarchy for this teacher")
async def hierarchy(teacher: TeacherUser):
    try:
        return await service.get_hierarchy(teacher["id"])
    except HTTPException:
        raise
    except Exception:
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/teacher/hierarchy").inc()
        raise


# ---------------------------------------------------------------------------
# Courses
# ---------------------------------------------------------------------------

@router.get("/courses", summary="List teacher's courses with student & session counts")
async def list_courses(teacher: TeacherUser):
    try:
        courses = await service.get_courses(teacher["id"])
        return {"courses": courses}
    except HTTPException:
        raise
    except Exception:
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/teacher/courses").inc()
        raise


# ---------------------------------------------------------------------------
# Course students sub-resource
# ---------------------------------------------------------------------------

@router.get(
    "/courses/{course_id}/students",
    summary="List students in a course with face-data status",
)
async def get_course_students(
    course_id: Annotated[str, Path()],
    teacher: TeacherUser,
):
    try:
        return await service.get_course_students(teacher["id"], course_id)
    except HTTPException:
        raise
    except Exception:
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/teacher/courses/{course_id}/students").inc()
        raise


@router.delete(
    "/courses/{course_id}/students",
    summary="Remove (unenrol) a student from a course",
)
async def remove_student(
    course_id: Annotated[str, Path()],
    body: RemoveStudentRequest,
    teacher: TeacherUser,
):
    try:
        return await service.remove_student_from_course(teacher["id"], course_id, body)
    except HTTPException:
        raise
    except Exception:
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/teacher/courses/{course_id}/students").inc()
        raise


@router.post(
    "/courses/{course_id}/import",
    summary="Bulk-import students from CSV data into a course",
)
async def import_students(
    course_id: Annotated[str, Path()],
    body: ImportStudentsRequest,
    teacher: TeacherUser,
):
    try:
        return await service.import_students(course_id, teacher["id"], body)
    except HTTPException:
        raise
    except Exception:
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/teacher/courses/{course_id}/import").inc()
        raise


@router.post(
    "/courses/{course_id}/enroll-existing",
    summary="Enroll an existing student directly into a course",
)
async def enroll_existing(
    course_id: Annotated[str, Path()],
    body: EnrollExistingRequest,
    teacher: TeacherUser,
):
    try:
        return await service.enroll_existing_student(course_id, teacher["id"], body.student_id)
    except HTTPException:
        raise
    except Exception:
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/teacher/courses/{course_id}/enroll-existing").inc()
        raise


# ---------------------------------------------------------------------------
# Students (teacher-scoped)
# NOTE: specific sub-paths (/at-risk, /search) must be declared BEFORE
# any parameterised route like /{student_id} to avoid routing conflicts.
# ---------------------------------------------------------------------------

@router.get("/students/at-risk", summary="Students below 75% attendance across all courses")
async def at_risk_students(teacher: TeacherUser):
    try:
        return await service.get_at_risk_students(teacher["id"])
    except HTTPException:
        raise
    except Exception:
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/teacher/students/at-risk").inc()
        raise


@router.get("/students/search", summary="Search all registered students (excludes those already in the course)")
async def search_students(
    teacher: TeacherUser,
    q: str = Query("", description="Search query for name or email"),
    course_id: Optional[str] = Query(None, description="Course ID to exclude already enrolled students"),
):
    try:
        return await service.search_students(teacher["id"], q, course_id)
    except HTTPException:
        raise
    except Exception:
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/teacher/students/search").inc()
        raise


@router.get("/students", summary="All students across teacher's courses (optionally filtered by course)")
async def list_students(
    teacher: TeacherUser,
    course_id: Optional[str] = Query(None, description="Filter to a single course"),
):
    try:
        return await service.get_teacher_students(teacher["id"], course_id)
    except HTTPException:
        raise
    except Exception:
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/teacher/students").inc()
        raise


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

@router.get("/reports", summary="Per-student attendance report for a course")
async def get_report(
    teacher: TeacherUser,
    course_id: str = Query(..., description="Course ID"),
    start_date: Optional[str] = Query(None, description="ISO date string"),
    end_date: Optional[str] = Query(None, description="ISO date string"),
):
    try:
        return await service.get_report(teacher["id"], course_id, start_date, end_date)
    except HTTPException:
        raise
    except Exception:
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/teacher/reports").inc()
        raise


# ---------------------------------------------------------------------------
# Attendance sub-routes
# ---------------------------------------------------------------------------

@router.post("/attendance/get-students", summary="List students in a course for attendance marking")
async def attendance_get_students(body: GetStudentsRequest, teacher: TeacherUser):
    try:
        return await service.get_course_students_for_attendance(teacher["id"], body)
    except HTTPException:
        raise
    except Exception:
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/teacher/attendance/get-students").inc()
        raise


@router.post(
    "/attendance/train-student",
    summary="Forward student photos to Python face-recognition service",
)
async def train_student(
    teacher: TeacherUser,
    student_id: str = Form(...),
    course_id: str = Form(...),
    photos: list[UploadFile] = File(..., description="front, left, right photos"),
):
    try:
        from backend.common.prisma_client import prisma as _prisma

        t = await _prisma.teacher.find_unique(where={"userId": teacher["id"]})
        if not t:
            raise HTTPException(status_code=404, detail="Teacher not found")

        photos_bytes = [(await p.read(), p.filename or "photo.jpg") for p in photos]
        return await service.train_student(teacher["id"], t.id, student_id, course_id, photos_bytes)
    except HTTPException:
        raise
    except Exception:
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/teacher/attendance/train-student").inc()
        raise


@router.post("/attendance/run-training", summary="Trigger model training on Python face service")
async def run_training(body: RunTrainingRequest, _: TeacherUser):
    try:
        return await service.run_training(body)
    except HTTPException:
        raise
    except Exception:
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/teacher/attendance/run-training").inc()
        raise


@router.post(
    "/attendance/recognize",
    summary="Run face recognition on classroom frames",
)
async def recognize_faces(
    teacher: TeacherUser,
    course_id: str = Form(...),
    batch_id: Optional[str] = Form(None),
    auto_submit: bool = Form(False),
    frames: list[UploadFile] = File(...),
):
    try:
        frames_bytes = [(await f.read(), f.filename or "frame.jpg") for f in frames]
        return await service.recognize_faces(course_id, batch_id, frames_bytes, auto_submit)
    except HTTPException:
        raise
    except Exception:
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/teacher/attendance/recognize").inc()
        raise


@router.post("/attendance/submit", summary="Persist attendance records from recognition results")
async def submit_attendance(body: SubmitAttendanceRequest, _: TeacherUser):
    try:
        return await service.submit_attendance(body)
    except HTTPException:
        raise
    except Exception:
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/teacher/attendance/submit").inc()
        raise


@router.patch("/attendance/mark-present", summary="Manually mark a student as present")
async def mark_present(body: MarkPresentRequest, _: TeacherUser):
    try:
        return await service.mark_present(body.course_id, body.student_id, body.date)
    except HTTPException:
        raise
    except Exception:
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/teacher/attendance/mark-present").inc()
        raise


@router.get("/attendance/history", summary="Attendance history for a course grouped by date")
async def attendance_history(
    _: TeacherUser,
    course_id: str = Query(...),
):
    try:
        return await service.get_attendance_history(course_id)
    except HTTPException:
        raise
    except Exception:
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/teacher/attendance/history").inc()
        raise


# ---------------------------------------------------------------------------
# Send credentials
# ---------------------------------------------------------------------------

@router.post("/send-credentials", summary="Email login credentials to newly imported students")
async def send_credentials(body: SendCredentialsRequest, _: TeacherUser):
    try:
        return await service.send_credentials(body)
    except HTTPException:
        raise
    except Exception:
        TEACHER_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/teacher/send-credentials").inc()
        raise