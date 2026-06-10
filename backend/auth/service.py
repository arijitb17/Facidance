"""
backend/auth/service.py

Pure business logic for authentication.
No HTTP concerns — only DB access and token generation.
"""

from __future__ import annotations

import os
import time
import uuid
from datetime import datetime

import bcrypt
import jwt
from fastapi import HTTPException, status

from backend.common.prisma_client import prisma
from backend.auth.schemas import LoginRequest, RegisterTeacherRequest
from backend.common.metrics import (
    LOGIN_ATTEMPTS_TOTAL,
    LOGIN_DURATION_SECONDS,
    REGISTRATION_ATTEMPTS_TOTAL,
    REGISTRATION_DURATION_SECONDS,
    TOKENS_ISSUED_TOTAL,
    AUTH_UNHANDLED_ERRORS_TOTAL,
)

JWT_SECRET = os.environ.get("JWT_SECRET", "changeme-use-env-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRES_SECONDS = 7 * 24 * 3600  # 7 days


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _verify_password(plain: str, hashed: str) -> bool:
    if bcrypt.checkpw(plain.encode(), hashed.encode()):
        return True
    variations = [
        plain.replace("-", "").replace("/", "").replace(" ", ""),
        plain.replace("/", "-"),
        plain.replace("-", "/"),
    ]
    for variant in variations:
        if variant == plain:
            continue
        try:
            if bcrypt.checkpw(variant.encode(), hashed.encode()):
                return True
        except Exception:
            pass
    return False


def _hash_password(plain: str) -> str:
    cleaned = plain.replace("-", "").replace("/", "").replace(" ", "")
    return bcrypt.hashpw(cleaned.encode(), bcrypt.gensalt()).decode()


def _generate_token(user_id: str, role: str) -> str:
    payload = {
        "id": user_id,
        "userId": user_id,
        "role": role,
        "iat": int(time.time()),
        "exp": int(time.time()) + JWT_EXPIRES_SECONDS,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _redirect_for_role(role: str) -> str:
    mapping = {"ADMIN": "/admin", "TEACHER": "/teacher", "STUDENT": "/student"}
    return mapping.get(role, "/")


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

async def login(data: LoginRequest) -> dict:
    t0 = time.perf_counter()
    try:
        email = data.email.lower().strip()
        user = await prisma.user.find_unique(where={"email": email})

        if not user:
            LOGIN_ATTEMPTS_TOTAL.labels(status="failure_not_found").inc()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        if not _verify_password(data.password, user.password):
            LOGIN_ATTEMPTS_TOTAL.labels(status="failure_bad_credentials").inc()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        token = _generate_token(user.id, user.role)
        LOGIN_ATTEMPTS_TOTAL.labels(status="success").inc()
        TOKENS_ISSUED_TOTAL.labels(role=user.role).inc()

        return {
            "token": token,
            "role": user.role,
            "name": user.name,
            "email": user.email,
            "redirect_url": _redirect_for_role(user.role),
        }
    except HTTPException:
        raise
    except Exception:
        AUTH_UNHANDLED_ERRORS_TOTAL.labels(endpoint="login").inc()
        raise
    finally:
        LOGIN_DURATION_SECONDS.observe(time.perf_counter() - t0)


# ---------------------------------------------------------------------------
# Teacher self-registration
# ---------------------------------------------------------------------------

async def register_teacher(data: RegisterTeacherRequest) -> dict:
    t0 = time.perf_counter()
    try:
        email = data.email.lower().strip()

        existing = await prisma.user.find_unique(where={"email": email})
        if existing:
            REGISTRATION_ATTEMPTS_TOTAL.labels(status="conflict_email").inc()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        hashed = _hash_password(data.password)
        user = await prisma.user.create(
            data={
                "id": str(uuid.uuid4()),
                "name": data.name,
                "email": email,
                "password": hashed,
                "role": "TEACHER",
                "updatedAt": datetime.utcnow(),
            }
        )
        REGISTRATION_ATTEMPTS_TOTAL.labels(status="success").inc()

        return {
            "message": "Teacher registration submitted. Awaiting admin approval.",
            "user_id": user.id,
        }
    except HTTPException:
        raise
    except Exception:
        REGISTRATION_ATTEMPTS_TOTAL.labels(status="error").inc()
        AUTH_UNHANDLED_ERRORS_TOTAL.labels(endpoint="register_teacher").inc()
        raise
    finally:
        REGISTRATION_DURATION_SECONDS.observe(time.perf_counter() - t0)