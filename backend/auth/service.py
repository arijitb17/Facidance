"""
backend/auth/service.py

Pure business logic for authentication.
No HTTP concerns — only DB access and token generation.
"""

from __future__ import annotations

import os

import bcrypt
import jwt
from fastapi import HTTPException, status

from backend.common.prisma_client import prisma
from backend.auth.schemas import LoginRequest, RegisterTeacherRequest

JWT_SECRET = os.environ.get("JWT_SECRET", "changeme-use-env-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRES_SECONDS = 7 * 24 * 3600  # 7 days


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _verify_password(plain: str, hashed: str) -> bool:
    """
    Compare a plain-text password against its bcrypt hash.
    Supports DOB-format variations used for student passwords:
      - 2004-03-13  →  try as-is, then strip separators → 20040313
      - 13/03/2004  →  try as-is, slash→dash, strip separators
    """
    if bcrypt.checkpw(plain.encode(), hashed.encode()):
        return True

    variations = [
        plain.replace("-", "").replace("/", "").replace(" ", ""),  # 20040313
        plain.replace("/", "-"),                                    # 13-03-2004
        plain.replace("-", "/"),                                    # 2004/03/13
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
    """Hash using bcrypt after stripping separators (mirrors lib/auth.ts)."""
    cleaned = plain.replace("-", "").replace("/", "").replace(" ", "")
    return bcrypt.hashpw(cleaned.encode(), bcrypt.gensalt()).decode()


def _generate_token(user_id: str, role: str) -> str:
    """Sign a JWT valid for 7 days (mirrors generateToken in lib/auth.ts)."""
    import time

    payload = {
        "id": user_id,
        "userId": user_id,   # kept for Next.js middleware compatibility
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
    """
    Authenticate a user by email + password.
    Returns token, role, name, email, redirect_url.
    Mirrors POST /api/auth/login (Next.js route).
    """
    email = data.email.lower().strip()
    user = await prisma.user.find_unique(where={"email": email})

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not _verify_password(data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    token = _generate_token(user.id, user.role)

    return {
        "token": token,
        "role": user.role,
        "name": user.name,
        "email": user.email,
        "redirect_url": _redirect_for_role(user.role),
    }


# ---------------------------------------------------------------------------
# Teacher self-registration
# ---------------------------------------------------------------------------

async def register_teacher(data: RegisterTeacherRequest) -> dict:
    """
    Create a User(TEACHER) with no Teacher record yet.
    Status is implicitly PENDING — admin must approve and assign a department.
    Mirrors POST /api/auth/register-teacher (Next.js route).
    """
    email = data.email.lower().strip()

    existing = await prisma.user.find_unique(where={"email": email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    hashed = _hash_password(data.password)
    user = await prisma.user.create(
        data={
            "name": data.name,
            "email": email,
            "password": hashed,
            "role": "TEACHER",
        }
    )

    return {
        "message": "Teacher registration submitted. Awaiting admin approval.",
        "user_id": user.id,
    }
