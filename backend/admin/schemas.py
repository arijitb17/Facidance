"""
backend/admin/schemas.py

Pydantic request/response models for the Admin service.
All fields are typed and validated.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# ---------------------------------------------------------------------------
# Teachers
# ---------------------------------------------------------------------------

class ApproveTeacherRequest(BaseModel):
    teacher_id: str = Field(..., description="User.id of the teacher to approve")
    department_id: str = Field(..., description="Department.id to assign the teacher to")


class CreateTeacherRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
    department_id: str


class TeacherResponse(BaseModel):
    id: str
    user_id: str
    name: str
    email: str
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    is_pending: bool = False


class ApproveTeacherResponse(BaseModel):
    message: str
    teacher_id: str
    department_id: str


# ---------------------------------------------------------------------------
# Departments
# ---------------------------------------------------------------------------

class CreateDepartmentRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120, description="Department name")

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()


class DepartmentResponse(BaseModel):
    id: str
    name: str
    programs_count: int = 0
    teachers_count: int = 0


# ---------------------------------------------------------------------------
# Programs
# ---------------------------------------------------------------------------

class CreateProgramRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    department_id: str


class ProgramResponse(BaseModel):
    id: str
    name: str
    department_id: str
    department_name: Optional[str] = None


# ---------------------------------------------------------------------------
# Courses
# ---------------------------------------------------------------------------

class CreateCourseRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    teacher_id: str = Field(..., description="Teacher.id (not User.id)")
    program_id: str
    academic_year: str = Field(..., examples=["2024-2025"])
    semester_number: int = Field(..., ge=1, le=12, description="Semester number 1–12")


class CourseResponse(BaseModel):
    id: str
    name: str
    code: str
    entry_code: str
    teacher_id: str
    teacher_name: Optional[str] = None
    semester_id: str
    semester_name: Optional[str] = None
    academic_year_name: Optional[str] = None
    program_name: Optional[str] = None


# ---------------------------------------------------------------------------
# Students
# ---------------------------------------------------------------------------

class UpdateStudentRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    program_id: Optional[str] = None


class StudentResponse(BaseModel):
    id: str
    user_id: str
    name: str
    email: str
    program_id: Optional[str] = None
    program_name: Optional[str] = None
    department_name: Optional[str] = None
    status: str
    joined_at: datetime
    graduated: bool
    courses_count: int = 0


# ---------------------------------------------------------------------------
# Stats & Analytics
# ---------------------------------------------------------------------------

class StatsResponse(BaseModel):
    teachers: int
    students: int
    departments: int
    programs: int
    courses: int
    success: bool = True


class AnalyticsOverviewResponse(BaseModel):
    total_users: int
    total_teachers: int
    total_students: int
    active_students: int
    graduated_students: int
    total_departments: int
    total_programs: int
    total_courses: int
    total_attendance_records: int
    overall_attendance_rate: float = Field(..., description="Percentage 0–100")


class AttendanceTrendPoint(BaseModel):
    month: str           # e.g. "2024-09"
    total: int
    present: int
    rate: float


class AttendanceTrendsResponse(BaseModel):
    trends: list[AttendanceTrendPoint]


class TeacherLoadItem(BaseModel):
    teacher_id: str
    teacher_name: str
    department_name: Optional[str]
    course_count: int
    student_count: int


class TeacherLoadResponse(BaseModel):
    teachers: list[TeacherLoadItem]


class ProgramDistributionItem(BaseModel):
    program_id: str
    program_name: str
    department_name: Optional[str]
    student_count: int


class ProgramDistributionResponse(BaseModel):
    programs: list[ProgramDistributionItem]