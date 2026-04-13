"""
backend/auth/router.py

Public auth endpoints — no auth guard required.
Router → Service ONLY. No DB calls here.
"""

from fastapi import APIRouter

from backend.auth import service
from backend.auth.schemas import (
    LoginRequest,
    LoginResponse,
    RegisterTeacherRequest,
    RegisterTeacherResponse,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Authenticate and receive a JWT",
)
async def login(body: LoginRequest):
    return await service.login(body)


@router.post(
    "/register-teacher",
    response_model=RegisterTeacherResponse,
    status_code=201,
    summary="Self-register as a teacher (pending admin approval)",
)
async def register_teacher(body: RegisterTeacherRequest):
    return await service.register_teacher(body)
