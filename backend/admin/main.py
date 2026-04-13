"""
backend/admin/main.py

Admin microservice entry point.
Runs on port 8001.

Start with:
    uvicorn backend.admin.main:app --port 8001 --reload
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.common.prisma_client import connect, disconnect
from backend.admin.router import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Connect Prisma on startup, disconnect on shutdown."""
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

# Allow Next.js frontend (adjust origins for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
    ],
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