"""
backend/admin/main.py

Admin microservice entry point.
Runs on port 8001.

Start with:
    uvicorn backend.admin.main:app --port 8001 --reload

Metrics
-------
GET /metrics  — Prometheus text exposition (scrape this endpoint).

The instrumentator automatically tracks:
  - http_requests_total{method, handler, status}
  - http_request_duration_seconds{method, handler, status}
  - http_request_size_bytes / http_response_size_bytes
  - in_progress requests gauge

Business-level metrics (teacher/department/course/student ops, analytics
latency, auto-graduations) are defined in backend/common/metrics.py and
incremented in backend/admin/service.py.
"""

from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from backend.common.prisma_client import connect, disconnect
from backend.admin.router import router

import backend.common.metrics  # noqa: F401  (side-effect import)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect()
    yield
    await disconnect()


app = FastAPI(
    title="Attendance Management — Admin Service",
    description=(
        "Admin microservice: manage teachers, students, departments, "
        "programs, courses, and analytics."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

Instrumentator(
    should_group_status_codes=False,
    excluded_handlers=["/health", "/metrics"],
).instrument(app).expose(app, include_in_schema=False)

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
    return {"status": "ok", "service": "admin", "port": 8001}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.admin.main:app", host="0.0.0.0", port=8001, reload=True)