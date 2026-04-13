"""
backend/student/schemas.py

Pydantic request/response models for the Student service.
"""

from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Me / Profile
# ---------------------------------------------------------------------------

class StudentProfileResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    created_at: str
    student: Optional["StudentDetail"] = None


class StudentDetail(BaseModel):
    id: str
    program_id: str
    program_name: Optional[str] = None
    department_name: Optional[str] = None
    joined_at: str
    status: str
    face_embedding: Optional[bool] = None   # True/False — never expose raw bytes


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[str] = None


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

class StudentStatsResponse(BaseModel):
    total_courses: int
    attendance_percentage: float
    total_present: int


# ---------------------------------------------------------------------------
# Courses
# ---------------------------------------------------------------------------

class CourseListItem(BaseModel):
    id: str
    name: str
    code: str
    entry_code: str
    teacher_name: Optional[str] = None
    semester_name: Optional[str] = None
    academic_year: Optional[str] = None
    program_name: Optional[str] = None


class CourseDetail(BaseModel):
    id: str
    name: str
    code: str
    entry_code: str
    teacher_id: str
    teacher_name: Optional[str] = None
    teacher_email: Optional[str] = None
    semester_name: Optional[str] = None
    academic_year: Optional[str] = None
    program_name: Optional[str] = None


class JoinCourseRequest(BaseModel):
    entry_code: str = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# Attendance
# ---------------------------------------------------------------------------

class AttendanceRecord(BaseModel):
    course_id: str
    course_name: str
    date: str          # YYYY-MM-DD
    status: bool


class CourseAttendanceSummary(BaseModel):
    course_id: str
    course_name: str
    total_sessions: int
    present: int
    absent: int
    rate: float


class AttendanceHistoryResponse(BaseModel):
    records: list[AttendanceRecord]
    summary: list[CourseAttendanceSummary]
