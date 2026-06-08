"""
backend/auth/main.py

Auth microservice entry point.
Runs on port 8000.

Start with:
    uvicorn backend.auth.main:app --port 8000 --reload

Metrics
-------
GET /metrics  — Prometheus text exposition (scrape this endpoint).

The instrumentator automatically tracks:
  - http_requests_total{method, handler, status}
  - http_request_duration_seconds{method, handler, status}
  - http_request_size_bytes / http_response_size_bytes
  - in_progress requests gauge

Business-level metrics (login outcomes, registration, tokens) are defined
in backend/auth/metrics.py and incremented in backend/auth/service.py.
"""

from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from backend.common.prisma_client import connect, disconnect
from backend.auth.router import router

# Import metrics module early so all metric objects are registered with the
# default Prometheus registry before the /metrics endpoint is exposed.
import backend.common.metrics  # noqa: F401  (side-effect import)


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

# ---------------------------------------------------------------------------
# Prometheus — auto-instrument all HTTP routes
# ---------------------------------------------------------------------------
# expose=True mounts GET /metrics automatically.
# exclude_paths skips /health and /metrics from being tracked themselves
# to avoid polluting latency histograms with infrastructure noise.
# ---------------------------------------------------------------------------
Instrumentator(
    should_group_status_codes=False,
    excluded_handlers=["/health", "/metrics"],
).instrument(app).expose(app, include_in_schema=False)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "auth", "port": 8000}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.auth.main:app", host="0.0.0.0", port=8000, reload=True)