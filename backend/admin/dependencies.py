"""
backend/admin/dependencies.py

Reusable auth dependencies for FastAPI.
Designed to be extended for TEACHER and STUDENT services.
"""

import os
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

JWT_SECRET = os.environ.get("JWT_SECRET", "changeme-use-env-in-production")
JWT_ALGORITHM = "HS256"

bearer_scheme = HTTPBearer()


# ---------------------------------------------------------------------------
# Core token verification (shared across all services)
# ---------------------------------------------------------------------------

def verify_token(token: str) -> dict:
    """
    Decode and validate a JWT.
    Raises HTTPException 401 if invalid or expired.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )


# ---------------------------------------------------------------------------
# Role-specific guards — add TEACHER / STUDENT guards here as services grow
# ---------------------------------------------------------------------------

def get_current_admin(
    credentials: Annotated[HTTPAuthorizationCredentials, Security(bearer_scheme)],
) -> dict:
    """
    FastAPI dependency: extracts Bearer token and asserts ADMIN role.
    Usage: admin: dict = Depends(get_current_admin)
    """
    payload = verify_token(credentials.credentials)
    if payload.get("role") != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return payload  # { "id": str, "role": "ADMIN", "email": str, ... }


def get_current_teacher(
    credentials: Annotated[HTTPAuthorizationCredentials, Security(bearer_scheme)],
) -> dict:
    """
    FastAPI dependency: asserts TEACHER role.
    Ready for the teacher microservice — not used in admin service.
    """
    payload = verify_token(credentials.credentials)
    if payload.get("role") not in ("TEACHER", "ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher access required",
        )
    return payload


def get_current_student(
    credentials: Annotated[HTTPAuthorizationCredentials, Security(bearer_scheme)],
) -> dict:
    """
    FastAPI dependency: asserts STUDENT role.
    Ready for the student microservice.
    """
    payload = verify_token(credentials.credentials)
    if payload.get("role") not in ("STUDENT", "ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student access required",
        )
    return payload