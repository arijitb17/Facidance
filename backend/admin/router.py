"""
backend/admin/router.py

All admin HTTP endpoints.
Router → Service ONLY. No DB calls here.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Path

from backend.admin.dependencies import get_current_admin
from backend.admin import service
from backend.admin.schemas import (
    ApproveTeacherRequest,
    ApproveTeacherResponse,
    CreateCourseRequest,
    CreateDepartmentRequest,
    CreateProgramRequest,
    CreateTeacherRequest,
    UpdateStudentRequest,
)

router = APIRouter(prefix="/admin", tags=["Admin"])

# Type alias for cleaner signatures
AdminUser = Annotated[dict, Depends(get_current_admin)]


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@router.get("/stats", summary="Get institution-wide counts")
async def get_stats(_: AdminUser):
    return await service.get_stats()


# ---------------------------------------------------------------------------
# Teachers
# ---------------------------------------------------------------------------

@router.get("/teachers", summary="List all teachers (approved + pending)")
async def list_teachers(_: AdminUser):
    teachers = await service.get_teachers()
    return {"teachers": teachers}


@router.post("/approve-teacher", summary="Approve a teacher and assign to department")
async def approve_teacher(body: ApproveTeacherRequest, _: AdminUser):
    return await service.approve_teacher(body)


@router.post("/teachers", summary="Create a teacher account directly")
async def create_teacher(body: CreateTeacherRequest, _: AdminUser):
    return await service.create_teacher(body)


@router.delete("/teachers/{user_id}", summary="Delete a teacher by User ID")
async def delete_teacher(
    user_id: Annotated[str, Path(description="User.id of the teacher")],
    _: AdminUser,
):
    return await service.delete_teacher(user_id)


# ---------------------------------------------------------------------------
# Departments
# ---------------------------------------------------------------------------

@router.get("/departments", summary="List all departments")
async def list_departments(_: AdminUser):
    depts = await service.get_departments()
    return {"departments": depts}


@router.post("/departments", summary="Create a department")
async def create_department(body: CreateDepartmentRequest, _: AdminUser):
    dept = await service.create_department(body)
    return {"department": dept}


@router.delete("/departments/{dept_id}", summary="Delete a department (cascade)")
async def delete_department(
    dept_id: Annotated[str, Path()],
    _: AdminUser,
):
    return await service.delete_department(dept_id)


# ---------------------------------------------------------------------------
# Programs
# ---------------------------------------------------------------------------

@router.get("/programs", summary="List all programs")
async def list_programs(_: AdminUser):
    progs = await service.get_programs()
    return {"programs": progs}


@router.post("/programs", summary="Create a program")
async def create_program(body: CreateProgramRequest, _: AdminUser):
    prog = await service.create_program(body)
    return {"program": prog}


@router.delete("/programs/{program_id}", summary="Delete a program")
async def delete_program(program_id: Annotated[str, Path()], _: AdminUser):
    return await service.delete_program(program_id)


# ---------------------------------------------------------------------------
# Courses
# ---------------------------------------------------------------------------

@router.get("/courses", summary="List all courses with full relations")
async def list_courses(_: AdminUser):
    courses = await service.get_courses()
    return {"courses": courses}


@router.post("/courses", summary="Create a course with auto-generated code")
async def create_course(body: CreateCourseRequest, _: AdminUser):
    course = await service.create_course(body)
    return {"course": course}


@router.delete("/courses/{course_id}", summary="Delete a course and its attendance")
async def delete_course(course_id: Annotated[str, Path()], _: AdminUser):
    return await service.delete_course(course_id)


# ---------------------------------------------------------------------------
# Students
# ---------------------------------------------------------------------------

@router.get("/students", summary="List all students with auto-graduation logic")
async def list_students(_: AdminUser):
    return await service.get_students()


@router.patch("/students/{user_id}", summary="Update student name / email / program")
async def update_student(
    user_id: Annotated[str, Path()],
    body: UpdateStudentRequest,
    _: AdminUser,
):
    return await service.update_student(user_id, body)


@router.delete("/students/{user_id}", summary="Delete a student")
async def delete_student(user_id: Annotated[str, Path()], _: AdminUser):
    return await service.delete_student(user_id)


@router.post("/students/{user_id}/graduate", summary="Mark a student as graduated")
async def graduate_student(user_id: Annotated[str, Path()], _: AdminUser):
    return await service.graduate_student(user_id)


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

@router.get("/analytics/overview", summary="Aggregated metrics for admin dashboard")
async def analytics_overview(_: AdminUser):
    return await service.get_analytics_overview()


@router.get(
    "/analytics/attendance-trends",
    summary="Monthly attendance rates (last 12 months)",
)
async def attendance_trends(_: AdminUser):
    return await service.get_attendance_trends()


@router.get("/analytics/teacher-load", summary="Courses and students per teacher")
async def teacher_load(_: AdminUser):
    return await service.get_teacher_load()


@router.get(
    "/analytics/program-distribution",
    summary="Student count per program",
)
async def program_distribution(_: AdminUser):
    return await service.get_program_distribution()