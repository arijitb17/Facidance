"""
backend/teacher/schemas.py

Pydantic request/response models for the Teacher service.
"""

from __future__ import annotations

from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


# ---------------------------------------------------------------------------
# Courses
# ---------------------------------------------------------------------------

class CourseItem(BaseModel):
    id: str
    name: str
    entry_code: str
    student_count: int
    semester: str
    program: str


class CourseListResponse(BaseModel):
    courses: List[CourseItem]


# ---------------------------------------------------------------------------
# Students
# ---------------------------------------------------------------------------

class StudentItem(BaseModel):
    id: str
    name: str
    email: str
    has_face_data: bool


class StudentListResponse(BaseModel):
    students: List[StudentItem]


class CourseStudentDetail(BaseModel):
    id: str
    name: str
    email: str
    program: Optional[dict] = None
    face_embedding: bool
    has_photos: bool
    photo_count: int
    attendance_count: int


class CourseStudentsResponse(BaseModel):
    course: dict
    students: List[CourseStudentDetail]


class ImportStudentItem(BaseModel):
    name: str
    email: EmailStr
    dob: str = Field(..., description="Date of birth used as initial password (YYYY-MM-DD or DD/MM/YYYY)")
    program_id: str


class ImportStudentsRequest(BaseModel):
    students: List[ImportStudentItem]


class ImportResultItem(BaseModel):
    email: str
    reason: str


class ImportStudentsResponse(BaseModel):
    message: str
    successful: List[str]
    failed: List[ImportResultItem]
    existing: List[str]


class RemoveStudentRequest(BaseModel):
    student_id: str


# ---------------------------------------------------------------------------
# Attendance
# ---------------------------------------------------------------------------

class GetStudentsRequest(BaseModel):
    course_id: str


class TrainStudentRequest(BaseModel):
    student_id: str
    course_id: str


class RunTrainingRequest(BaseModel):
    course_id: str


class RecognizedStudentItem(BaseModel):
    id: str
    name: str
    email: str


class AttendanceRecordItem(BaseModel):
    student_id: str
    student_name: str
    status: bool
    timestamp: str


class SubmitAttendanceRequest(BaseModel):
    course_id: str
    recognition_results: dict
    date: Optional[str] = None


class SubmitAttendanceResponse(BaseModel):
    success: bool
    message: str
    statistics: dict
    timestamp: str


class AttendanceHistoryEntry(BaseModel):
    student_id: str
    student_name: str
    student_email: str
    status: bool
    timestamp: str


class AttendanceHistoryResponse(BaseModel):
    course_id: str
    attendance_by_date: dict
    total_records: int


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

class ReportStudentRow(BaseModel):
    student_name: str
    student_email: str
    total_sessions: int
    attended: int
    percentage: float


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

class TeacherStatsResponse(BaseModel):
    courses: int
    total_students: int
    total_semesters: int
    total_attendance: int


# ---------------------------------------------------------------------------
# Me (teacher profile)
# ---------------------------------------------------------------------------

class TeacherMeResponse(BaseModel):
    id: str
    name: str
    department: Optional[str] = None
    courses: List[dict]


# ---------------------------------------------------------------------------
# Hierarchy
# ---------------------------------------------------------------------------

class HierarchyResponse(BaseModel):
    departments: List[dict]


# ---------------------------------------------------------------------------
# Send credentials
# ---------------------------------------------------------------------------

class SendCredentialStudent(BaseModel):
    name: str
    email: EmailStr
    dob: str


class SendCredentialsRequest(BaseModel):
    students: List[SendCredentialStudent]
