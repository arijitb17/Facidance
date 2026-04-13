"""
backend/student/router.py

All student HTTP endpoints.
Router → Service ONLY. No DB calls here.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Path

from backend.admin.dependencies import get_current_student
from backend.student import service
from backend.student.schemas import JoinCourseRequest, UpdateProfileRequest

router = APIRouter(prefix="/student", tags=["Student"])

# Type alias for cleaner signatures
StudentUser = Annotated[dict, Depends(get_current_student)]


# ---------------------------------------------------------------------------
# Me / Profile
# ---------------------------------------------------------------------------

@router.get("/me", summary="Get the authenticated student's profile")
async def get_me(current: StudentUser):
    return await service.get_me(current["id"])


@router.patch("/profile", summary="Update student name / email")
async def update_profile(body: UpdateProfileRequest, current: StudentUser):
    return await service.update_profile(current["id"], body)


@router.get("/check-photos", summary="Check whether the student has a face embedding")
async def check_photos(student_id: str, current: StudentUser):
    """
    Query param: ?student_id=<Student.id>
    Validates the student_id belongs to the calling user before checking.
    """
    # Ensure the student can only check their own photos
    me = await service.get_me(current["id"])
    if not me.get("student") or me["student"]["id"] != student_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Forbidden")
    return await service.check_photos(student_id)


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@router.get("/stats", summary="Dashboard stats: courses, attendance %, total present")
async def get_stats(current: StudentUser):
    return await service.get_stats(current["id"])


# ---------------------------------------------------------------------------
# Courses
# ---------------------------------------------------------------------------

@router.get("/courses", summary="List all enrolled courses")
async def list_courses(current: StudentUser):
    courses = await service.list_courses(current["id"])
    return {"courses": courses}


@router.get("/courses/{course_id}", summary="Get a single enrolled course's detail")
async def get_course(
    course_id: Annotated[str, Path()],
    current: StudentUser,
):
    return await service.get_course(current["id"], course_id)


@router.post("/courses/join", summary="Join a course using its entry code")
async def join_course(body: JoinCourseRequest, current: StudentUser):
    return await service.join_course(current["id"], body)


@router.delete("/courses/{course_id}/leave", summary="Leave an enrolled course")
async def leave_course(
    course_id: Annotated[str, Path()],
    current: StudentUser,
):
    return await service.leave_course(current["id"], course_id)


# ---------------------------------------------------------------------------
# Attendance
# ---------------------------------------------------------------------------

@router.get(
    "/courses/{course_id}/attendance",
    summary="Attendance records for a specific course",
)
async def course_attendance(
    course_id: Annotated[str, Path()],
    current: StudentUser,
):
    return await service.get_course_attendance(current["id"], course_id)


@router.get("/history", summary="Full attendance history across all courses")
async def attendance_history(current: StudentUser):
    return await service.get_attendance_history(current["id"])
