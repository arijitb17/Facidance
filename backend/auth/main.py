"""
backend/auth/main.py

Auth microservice entry point.
Runs on port 8000.

Start with:
    uvicorn backend.auth.main:app --port 8000 --reload
"""

from contextlib import asynccontextmanager
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.common.prisma_client import connect, disconnect
from backend.auth.router import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Connect Prisma on startup, disconnect on shutdown."""
    await connect()
    yield
    await disconnect()


app = FastAPI(
    title="Attendance Management — Auth Service",
    description="Handles login and teacher self-registration.",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow Next.js frontend (adjust origins for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "auth", "port": 8000}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.auth.main:app", host="0.0.0.0", port=8000, reload=True)