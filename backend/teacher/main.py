"""
backend/teacher/main.py

Teacher microservice entry point.
Runs on port 8002.

Start with:
    uvicorn backend.teacher.main:app --port 8002 --reload
"""

from contextlib import asynccontextmanager
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from backend.common.prisma_client import connect, disconnect
from backend.teacher.router import router
from backend.middleware.face_concurrency import FaceConcurrencyMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Connect Prisma on startup, disconnect on shutdown."""
    await connect()
    yield
    await disconnect()


app = FastAPI(
    title="Attendance Management — Teacher Service",
    description=(
        "Teacher microservice: manage courses, import students, "
        "run face-recognition attendance, and generate reports."
    ),
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(FaceConcurrencyMiddleware, max_concurrent=3)
# Allow Next.js frontend (adjust origins for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=500)

app.include_router(router)

# Enable Prometheus metrics
Instrumentator().instrument(app).expose(app)


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "teacher", "port": 8002}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.teacher.main:app", host="0.0.0.0", port=8002, reload=True)
