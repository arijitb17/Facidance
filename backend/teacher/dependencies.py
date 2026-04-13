"""
backend/teacher/dependencies.py

Auth dependency for the Teacher microservice.
Reuses verify_token from backend.admin.dependencies.
"""

from typing import Annotated

from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.admin.dependencies import bearer_scheme, verify_token


def get_current_teacher(
    credentials: Annotated[HTTPAuthorizationCredentials, Security(bearer_scheme)],
) -> dict:
    """
    FastAPI dependency: extracts Bearer token and asserts TEACHER (or ADMIN) role.
    Usage: teacher: dict = Depends(get_current_teacher)
    """
    payload = verify_token(credentials.credentials)
    if payload.get("role") not in ("TEACHER", "ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher access required",
        )
    return payload  # { "id": str, "role": "TEACHER", "email": str, ... }
