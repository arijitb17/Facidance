"""
backend/teacher/main.py

Teacher microservice entry point.
Runs on port 8002.

Start with:
    uvicorn backend.teacher.main:app --port 8002 --reload
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.common.prisma_client import connect, disconnect
from backend.teacher.router import router


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
    return {"status": "ok", "service": "teacher", "port": 8002}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.teacher.main:app", host="0.0.0.0", port=8002, reload=True)
