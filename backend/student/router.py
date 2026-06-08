"""
backend/student/router.py

All student HTTP endpoints.
Router → Service ONLY. No DB calls here.

Wraps service calls to catch unexpected exceptions and increment
STUDENT_UNHANDLED_ERRORS_TOTAL before re-raising, matching the pattern
used in the auth and admin services.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path

from backend.admin.dependencies import get_current_student
from backend.student import service
from backend.student.schemas import JoinCourseRequest, UpdateProfileRequest
from backend.common.metrics import STUDENT_UNHANDLED_ERRORS_TOTAL

router = APIRouter(prefix="/student", tags=["Student"])

StudentUser = Annotated[dict, Depends(get_current_student)]


# ---------------------------------------------------------------------------
# Me / Profile
# ---------------------------------------------------------------------------

@router.get("/me")
async def get_me(current: StudentUser):
    try:
        return await service.get_me(current["id"])
    except HTTPException:
        raise
    except Exception:
        STUDENT_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/student/me").inc()
        raise


@router.patch("/profile")
async def update_profile(body: UpdateProfileRequest, current: StudentUser):
    try:
        return await service.update_profile(current["id"], body)
    except HTTPException:
        raise
    except Exception:
        STUDENT_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/student/profile").inc()
        raise


@router.get("/check-photos")
async def check_photos(student_id: str, current: StudentUser):
    try:
        me = await service.get_me(current["id"])
        if not me.get("student") or me["student"]["id"] != student_id:
            raise HTTPException(status_code=403, detail="Forbidden")
        return await service.check_photos(student_id)
    except HTTPException:
        raise
    except Exception:
        STUDENT_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/student/check-photos").inc()
        raise


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@router.get("/stats")
async def get_stats(current: StudentUser):
    try:
        return await service.get_stats(current["id"])
    except HTTPException:
        raise
    except Exception:
        STUDENT_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/student/stats").inc()
        raise


@router.get("/ai-suggestions")
async def ai_suggestions(current: StudentUser):
    try:
        return await service.get_ai_suggestions(current["id"])
    except HTTPException:
        raise
    except Exception:
        STUDENT_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/student/ai-suggestions").inc()
        raise


# ---------------------------------------------------------------------------
# Courses
# ---------------------------------------------------------------------------

@router.get("/courses")
async def list_courses(current: StudentUser):
    try:
        courses = await service.list_courses(current["id"])
        return {"courses": courses}
    except HTTPException:
        raise
    except Exception:
        STUDENT_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/student/courses").inc()
        raise


@router.get("/courses/{course_id}")
async def get_course(
    course_id: Annotated[str, Path()],
    current: StudentUser,
):
    try:
        return await service.get_course(current["id"], course_id)
    except HTTPException:
        raise
    except Exception:
        STUDENT_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/student/courses/{course_id}").inc()
        raise


@router.post("/courses/join")
async def join_course(body: JoinCourseRequest, current: StudentUser):
    try:
        return await service.join_course(current["id"], body)
    except HTTPException:
        raise
    except Exception:
        STUDENT_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/student/courses/join").inc()
        raise


@router.delete("/courses/{course_id}/leave")
async def leave_course(
    course_id: Annotated[str, Path()],
    current: StudentUser,
):
    try:
        return await service.leave_course(current["id"], course_id)
    except HTTPException:
        raise
    except Exception:
        STUDENT_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/student/courses/{course_id}/leave").inc()
        raise


# ---------------------------------------------------------------------------
# Attendance
# ---------------------------------------------------------------------------

@router.get("/courses/{course_id}/attendance")
async def course_attendance(
    course_id: Annotated[str, Path()],
    current: StudentUser,
):
    try:
        return await service.get_course_attendance(current["id"], course_id)
    except HTTPException:
        raise
    except Exception:
        STUDENT_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/student/courses/{course_id}/attendance").inc()
        raise


@router.get("/history")
async def attendance_history(current: StudentUser):
    try:
        return await service.get_attendance_history(current["id"])
    except HTTPException:
        raise
    except Exception:
        STUDENT_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/student/history").inc()
        raise