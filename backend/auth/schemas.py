"""
backend/auth/schemas.py

Pydantic request/response models for the Auth service.
"""

from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class LoginResponse(BaseModel):
    token: str
    role: str
    name: str
    email: str
    redirect_url: str


# ---------------------------------------------------------------------------
# Teacher registration (self-service, pending admin approval)
# ---------------------------------------------------------------------------

class RegisterTeacherRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)


class RegisterTeacherResponse(BaseModel):
    message: str
    user_id: str
