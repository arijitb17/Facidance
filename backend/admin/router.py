"""
backend/admin/router.py

All admin HTTP endpoints.
Router → Service ONLY. No DB calls here.

Wraps service calls to catch unexpected exceptions and increment
ADMIN_UNHANDLED_ERRORS_TOTAL before re-raising, matching the pattern
used in the auth service.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path

from backend.admin.dependencies import get_current_admin
from backend.admin import service
from backend.admin.schemas import (
    ApproveTeacherRequest,
    CreateCourseRequest,
    CreateDepartmentRequest,
    CreateProgramRequest,
    CreateTeacherRequest,
    UpdateCourseTeacherRequest,
    UpdateStudentRequest,
)
from backend.common.metrics import ADMIN_UNHANDLED_ERRORS_TOTAL

router = APIRouter(prefix="/admin", tags=["Admin"])

AdminUser = Annotated[dict, Depends(get_current_admin)]


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@router.get("/stats")
async def get_stats(_: AdminUser):
    try:
        return await service.get_stats()
    except HTTPException:
        raise
    except Exception:
        ADMIN_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/admin/stats").inc()
        raise


# ---------------------------------------------------------------------------
# Teachers
# ---------------------------------------------------------------------------

@router.get("/teachers")
async def list_teachers(_: AdminUser):
    try:
        teachers = await service.get_teachers()
        return {"teachers": teachers}
    except HTTPException:
        raise
    except Exception:
        ADMIN_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/admin/teachers").inc()
        raise


@router.post("/approve-teacher")
async def approve_teacher(body: ApproveTeacherRequest, _: AdminUser):
    try:
        return await service.approve_teacher(body)
    except HTTPException:
        raise
    except Exception:
        ADMIN_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/admin/approve-teacher").inc()
        raise


@router.post("/teachers")
async def create_teacher(body: CreateTeacherRequest, _: AdminUser):
    try:
        return await service.create_teacher(body)
    except HTTPException:
        raise
    except Exception:
        ADMIN_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/admin/teachers").inc()
        raise


@router.delete("/teachers/{user_id}")
async def delete_teacher(
    user_id: Annotated[str, Path(description="User.id of the teacher")],
    _: AdminUser,
):
    try:
        return await service.delete_teacher(user_id)
    except HTTPException:
        raise
    except Exception:
        ADMIN_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/admin/teachers/{user_id}").inc()
        raise


# ---------------------------------------------------------------------------
# Departments
# ---------------------------------------------------------------------------

@router.get("/departments")
async def list_departments(_: AdminUser):
    try:
        depts = await service.get_departments()
        return {"departments": depts}
    except HTTPException:
        raise
    except Exception:
        ADMIN_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/admin/departments").inc()
        raise


@router.post("/departments")
async def create_department(body: CreateDepartmentRequest, _: AdminUser):
    try:
        dept = await service.create_department(body)
        return {"department": dept}
    except HTTPException:
        raise
    except Exception:
        ADMIN_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/admin/departments").inc()
        raise


@router.delete("/departments/{dept_id}")
async def delete_department(dept_id: Annotated[str, Path()], _: AdminUser):
    try:
        return await service.delete_department(dept_id)
    except HTTPException:
        raise
    except Exception:
        ADMIN_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/admin/departments/{dept_id}").inc()
        raise


# ---------------------------------------------------------------------------
# Programs
# ---------------------------------------------------------------------------

@router.get("/programs")
async def list_programs(_: AdminUser):
    try:
        progs = await service.get_programs()
        return {"programs": progs}
    except HTTPException:
        raise
    except Exception:
        ADMIN_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/admin/programs").inc()
        raise


@router.post("/programs")
async def create_program(body: CreateProgramRequest, _: AdminUser):
    try:
        prog = await service.create_program(body)
        return {"program": prog}
    except HTTPException:
        raise
    except Exception:
        ADMIN_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/admin/programs").inc()
        raise


@router.delete("/programs/{program_id}")
async def delete_program(program_id: Annotated[str, Path()], _: AdminUser):
    try:
        return await service.delete_program(program_id)
    except HTTPException:
        raise
    except Exception:
        ADMIN_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/admin/programs/{program_id}").inc()
        raise


# ---------------------------------------------------------------------------
# Courses
# ---------------------------------------------------------------------------

@router.get("/courses")
async def list_courses(_: AdminUser):
    try:
        courses = await service.get_courses()
        return {"courses": courses}
    except HTTPException:
        raise
    except Exception:
        ADMIN_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/admin/courses").inc()
        raise


@router.post("/courses")
async def create_course(body: CreateCourseRequest, _: AdminUser):
    try:
        course = await service.create_course(body)
        return {"course": course}
    except HTTPException:
        raise
    except Exception:
        ADMIN_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/admin/courses").inc()
        raise


@router.patch("/courses/{course_id}")
async def update_course_teacher(
    course_id: Annotated[str, Path()],
    body: UpdateCourseTeacherRequest,
    _: AdminUser,
):
    try:
        course = await service.update_course_teacher(course_id, body.teacher_id)
        return {"course": course}
    except HTTPException:
        raise
    except Exception:
        ADMIN_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/admin/courses/{course_id}").inc()
        raise


@router.delete("/courses/{course_id}")
async def delete_course(course_id: Annotated[str, Path()], _: AdminUser):
    try:
        return await service.delete_course(course_id)
    except HTTPException:
        raise
    except Exception:
        ADMIN_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/admin/courses/{course_id}").inc()
        raise


# ---------------------------------------------------------------------------
# Students
# ---------------------------------------------------------------------------

@router.get("/students")
async def list_students(_: AdminUser):
    try:
        return await service.get_students()
    except HTTPException:
        raise
    except Exception:
        ADMIN_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/admin/students").inc()
        raise


@router.patch("/students/{user_id}")
async def update_student(
    user_id: Annotated[str, Path()],
    body: UpdateStudentRequest,
    _: AdminUser,
):
    try:
        return await service.update_student(user_id, body)
    except HTTPException:
        raise
    except Exception:
        ADMIN_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/admin/students/{user_id}").inc()
        raise


@router.delete("/students/{user_id}")
async def delete_student(user_id: Annotated[str, Path()], _: AdminUser):
    try:
        return await service.delete_student(user_id)
    except HTTPException:
        raise
    except Exception:
        ADMIN_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/admin/students/{user_id}").inc()
        raise


@router.post("/students/{user_id}/graduate")
async def graduate_student(user_id: Annotated[str, Path()], _: AdminUser):
    try:
        return await service.graduate_student(user_id)
    except HTTPException:
        raise
    except Exception:
        ADMIN_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/admin/students/{user_id}/graduate").inc()
        raise


@router.post("/students/{user_id}/ungraduate")
async def ungraduate_student(user_id: Annotated[str, Path()], _: AdminUser):
    try:
        return await service.ungraduate_student(user_id)
    except HTTPException:
        raise
    except Exception:
        ADMIN_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/admin/students/{user_id}/ungraduate").inc()
        raise


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

@router.get("/analytics/overview")
async def analytics_overview(_: AdminUser):
    try:
        return await service.get_analytics_overview()
    except HTTPException:
        raise
    except Exception:
        ADMIN_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/admin/analytics/overview").inc()
        raise


@router.get("/analytics/attendance-trends")
async def attendance_trends(_: AdminUser):
    try:
        return await service.get_attendance_trends()
    except HTTPException:
        raise
    except Exception:
        ADMIN_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/admin/analytics/attendance-trends").inc()
        raise


@router.get("/analytics/teacher-load")
async def teacher_load(_: AdminUser):
    try:
        return await service.get_teacher_load()
    except HTTPException:
        raise
    except Exception:
        ADMIN_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/admin/analytics/teacher-load").inc()
        raise


@router.get("/analytics/program-distribution")
async def program_distribution(_: AdminUser):
    try:
        return await service.get_program_distribution()
    except HTTPException:
        raise
    except Exception:
        ADMIN_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/admin/analytics/program-distribution").inc()
        raise