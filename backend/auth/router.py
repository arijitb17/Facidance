"""
backend/auth/router.py

Public auth endpoints — no auth guard required.
Router → Service ONLY. No DB calls here.

Wraps service calls to catch unexpected exceptions and increment the
UNHANDLED_ERRORS_TOTAL metric before re-raising (so the global exception
handler still returns a clean 500 to the client).
"""

from fastapi import APIRouter
from fastapi import HTTPException

from backend.auth import service
from backend.auth.schemas import (
    LoginRequest,
    LoginResponse,
    RegisterTeacherRequest,
    RegisterTeacherResponse,
)
from backend.common.metrics import AUTH_UNHANDLED_ERRORS_TOTAL

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Authenticate and receive a JWT",
)
async def login(body: LoginRequest):
    try:
        return await service.login(body)
    except HTTPException:
        raise
    except Exception:
        AUTH_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/auth/login").inc()
        raise


@router.post(
    "/register-teacher",
    response_model=RegisterTeacherResponse,
    status_code=201,
    summary="Self-register as a teacher (pending admin approval)",
)
async def register_teacher(body: RegisterTeacherRequest):
    try:
        return await service.register_teacher(body)
    except HTTPException:
        raise
    except Exception:
        AUTH_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/auth/register-teacher").inc()
        raise