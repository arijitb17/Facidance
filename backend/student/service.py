"""
backend/student/service.py

Pure business logic for the Student microservice.
No HTTP concerns here — all DB access via prisma_client.prisma.
"""

from __future__ import annotations

import json
import os
import time

import httpx
from fastapi import HTTPException, UploadFile
from groq import AsyncGroq

from backend.common.prisma_client import prisma
from backend.common.cache import cache_get, cache_set, cache_invalidate
from backend.student.schemas import (
    JoinCourseRequest,
    UpdateProfileRequest,
)
from backend.common.metrics import (
    STUDENT_PROFILE_OPS_TOTAL,
    STUDENT_PROFILE_OP_DURATION_SECONDS,
    STUDENT_STATS_DURATION_SECONDS,
    STUDENT_COURSE_OPS_TOTAL,
    STUDENT_COURSE_OP_DURATION_SECONDS,
    STUDENT_ATTENDANCE_OPS_TOTAL,
    STUDENT_ATTENDANCE_OP_DURATION_SECONDS,
    STUDENT_UNHANDLED_ERRORS_TOTAL,
)

PYTHON_API_URL = os.environ.get("PYTHON_API_URL", "http://localhost:8004")


# ---------------------------------------------------------------------------
# AI Suggestions
# ---------------------------------------------------------------------------

async def get_ai_suggestions(user_id: str) -> dict:
    t0 = time.perf_counter()
    try:
        stats   = await get_stats(user_id)
        history = await get_attendance_history(user_id)

        attendance_pct: float = stats["attendance_percentage"]
        total_courses: int    = stats["total_courses"]
        total_present: int    = stats["total_present"]
        summary: list[dict]   = history.get("summary", [])

        course_data = []
        for s in sorted(summary, key=lambda x: x["rate"]):
            total   = s["total_sessions"]
            present = s["present"]
            rate    = s["rate"]

            if rate < 75 and total > 0:
                needed = max(0, int(((0.75 * total) - present) / 0.25) + 1)
            else:
                can_miss = max(0, int(present / 0.75) - total)
                needed = -can_miss

            course_data.append({**s, "sessions_needed_for_75": needed})

        course_lines = "\n".join(
            f"  - {s['course_name']}: {s['rate']}% "
            f"({s['present']} present / {s['total_sessions']} sessions)"
            + (
                f" — must attend next {s['sessions_needed_for_75']} consecutive sessions to reach 75%"
                if s["sessions_needed_for_75"] > 0
                else f" ✓ above 75% (can miss {abs(s['sessions_needed_for_75'])} more sessions safely)"
            )
            for s in course_data
        )

        prompt = f"""You are an academic advisor helping a university student improve their attendance.

Student attendance snapshot:
- Overall attendance: {attendance_pct}%
- Total courses enrolled: {total_courses}
- Total sessions attended: {total_present}
- Minimum required attendance: 75% per course

Per-course breakdown (worst first):
{course_lines if course_lines else "  No course data available yet."}

Your task:
1. Briefly acknowledge the student's overall situation (1-2 sentences, empathetic but direct).
2. For EACH course below 75%: state exactly how many consecutive sessions they must attend to reach 75% — use the numbers already given above, do not recalculate.
3. For courses already above 75%: state exactly how many sessions they can still afford to miss.
4. Give 4 specific, actionable suggestions tailored to the weakest courses by name.
5. Add one motivational closing sentence.

Respond ONLY with this JSON — no markdown, no extra text:
{{
  "severity": "low",
  "summary": "...",
  "urgent_courses": [
    {{
      "name": "Course Name",
      "current_rate": 72.5,
      "sessions_needed": 3,
      "advice": "Attend the next 3 sessions consecutively to reach 75%."
    }}
  ],
  "safe_courses": [
    {{
      "name": "Course Name",
      "current_rate": 91.3,
      "can_miss": 10,
      "advice": "You can afford to miss up to 10 more sessions and stay above 75%."
    }}
  ],
  "suggestions": [
    {{ "title": "...", "detail": "..." }},
    {{ "title": "...", "detail": "..." }},
    {{ "title": "...", "detail": "..." }},
    {{ "title": "...", "detail": "..." }}
  ],
  "motivation": "..."
}}

severity must be: "low" if overall attendance >= 75%, "medium" if 50-74%, "high" if below 50%.
Use the EXACT numbers already provided above — do not recalculate. Keep each suggestion detail under 50 words."""

        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=503,
                detail="AI Tips not available — GROQ_API_KEY is not configured. "
                       "Get a free key at https://console.groq.com and add it to your .env file."
            )

        client = AsyncGroq(api_key=api_key)

        response = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful academic advisor. Always respond with valid JSON only. Never recalculate numbers — use exactly what the user provides.",
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            temperature=0.4,
            max_tokens=1000,
        )

        raw = response.choices[0].message.content.strip()

        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = {"raw": raw, "parse_error": True}

        real = {s["course_name"]: s for s in course_data}

        all_ai_courses = {
            **{c["name"]: c for c in parsed.get("urgent_courses", [])},
            **{c["name"]: c for c in parsed.get("safe_courses", [])},
        }

        corrected_urgent = []
        corrected_safe   = []

        for course_name, match in real.items():
            ai_entry = all_ai_courses.get(course_name, {})

            if match["sessions_needed_for_75"] > 0:
                corrected_urgent.append({
                    "name":            course_name,
                    "current_rate":    match["rate"],
                    "sessions_needed": match["sessions_needed_for_75"],
                    "advice":          ai_entry.get(
                        "advice",
                        f"Attend the next {match['sessions_needed_for_75']} sessions consecutively to reach 75%.",
                    ),
                })
            else:
                corrected_safe.append({
                    "name":         course_name,
                    "current_rate": match["rate"],
                    "can_miss":     abs(match["sessions_needed_for_75"]),
                    "advice":       ai_entry.get(
                        "advice",
                        f"You can afford to miss up to {abs(match['sessions_needed_for_75'])} more sessions and stay above 75%.",
                    ),
                })

        parsed["urgent_courses"] = corrected_urgent
        parsed["safe_courses"]   = corrected_safe

        return {
            "attendance_percentage": attendance_pct,
            "suggestions": parsed,
        }
    except HTTPException:
        raise
    except Exception:
        STUDENT_UNHANDLED_ERRORS_TOTAL.labels(endpoint="get_ai_suggestions").inc()
        raise
    finally:
        STUDENT_STATS_DURATION_SECONDS.labels(endpoint="ai_suggestions").observe(time.perf_counter() - t0)


# ---------------------------------------------------------------------------
# Me / Profile
# ---------------------------------------------------------------------------

async def get_me(user_id: str) -> dict:
    t0 = time.perf_counter()
    try:
        cache_key = f"student:me:{user_id}"
        cached = await cache_get(cache_key)
        if cached:
            STUDENT_PROFILE_OPS_TOTAL.labels(operation="get_me", status="success").inc()
            return cached

        user = await prisma.user.find_unique(
            where={"id": user_id},
            include={
                "student": {
                    "include": {
                        "program": {"include": {"department": True}}
                    }
                }
            },
        )
        if not user:
            STUDENT_PROFILE_OPS_TOTAL.labels(operation="get_me", status="not_found").inc()
            raise HTTPException(status_code=404, detail="User not found")

        s = user.student
        result = {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "created_at": user.createdAt.isoformat(),
            "student": {
                "id": s.id,
                "program_id": s.programId,
                "program_name": s.program.name if s and s.program else None,
                "department_name": (
                    s.program.department.name
                    if s and s.program and s.program.department
                    else None
                ),
                "joined_at": s.joinedAt.isoformat(),
                "status": s.status,
                "face_embedding": s.faceEmbedding is not None,
            } if s else None,
        }
        await cache_set(cache_key, result, ttl=300)
        STUDENT_PROFILE_OPS_TOTAL.labels(operation="get_me", status="success").inc()
        return result
    except HTTPException:
        raise
    except Exception:
        STUDENT_PROFILE_OPS_TOTAL.labels(operation="get_me", status="error").inc()
        STUDENT_UNHANDLED_ERRORS_TOTAL.labels(endpoint="get_me").inc()
        raise
    finally:
        STUDENT_PROFILE_OP_DURATION_SECONDS.labels(operation="get_me").observe(time.perf_counter() - t0)


async def update_profile(user_id: str, data: UpdateProfileRequest) -> dict:
    t0 = time.perf_counter()
    try:
        update_data: dict = {}
        if data.name:
            update_data["name"] = data.name
        if data.email:
            update_data["email"] = data.email

        if not update_data:
            raise HTTPException(status_code=400, detail="Nothing to update")

        user = await prisma.user.update(
            where={"id": user_id},
            data=update_data,
        )
        await cache_invalidate(f"student:me:{user_id}")
        STUDENT_PROFILE_OPS_TOTAL.labels(operation="update", status="success").inc()
        return {"id": user.id, "name": user.name, "email": user.email}
    except HTTPException:
        raise
    except Exception:
        STUDENT_PROFILE_OPS_TOTAL.labels(operation="update", status="error").inc()
        STUDENT_UNHANDLED_ERRORS_TOTAL.labels(endpoint="update_profile").inc()
        raise
    finally:
        STUDENT_PROFILE_OP_DURATION_SECONDS.labels(operation="update").observe(time.perf_counter() - t0)


async def check_photos(student_id: str) -> dict:
    t0 = time.perf_counter()
    try:
        cache_key = f"student:photos:{student_id}"
        cached = await cache_get(cache_key)
        if cached:
            STUDENT_PROFILE_OPS_TOTAL.labels(operation="check_photos", status="success").inc()
            return cached

        student = await prisma.student.find_unique(where={"id": student_id})
        if not student:
            STUDENT_PROFILE_OPS_TOTAL.labels(operation="check_photos", status="not_found").inc()
            raise HTTPException(status_code=404, detail="Student not found")

        has_photos = student.faceEmbedding is not None
        if not has_photos:
            try:
                async with httpx.AsyncClient(timeout=3.0) as client:
                    resp = await client.get(f"{PYTHON_API_URL}/api/student/{student_id}/photos")
                    if resp.status_code == 200:
                        has_photos = resp.json().get("hasPhotos", False)
            except Exception:
                pass

        result = {"has_photos": has_photos}
        ttl = 300 if student.faceEmbedding is not None else 30
        await cache_set(cache_key, result, ttl=ttl)
        STUDENT_PROFILE_OPS_TOTAL.labels(operation="check_photos", status="success").inc()
        return result
    except HTTPException:
        raise
    except Exception:
        STUDENT_PROFILE_OPS_TOTAL.labels(operation="check_photos", status="error").inc()
        STUDENT_UNHANDLED_ERRORS_TOTAL.labels(endpoint="check_photos").inc()
        raise
    finally:
        STUDENT_PROFILE_OP_DURATION_SECONDS.labels(operation="check_photos").observe(time.perf_counter() - t0)


async def upload_photos(
    user_id: str,
    student_id: str,
    front: "UploadFile",
    left: "UploadFile",
    right: "UploadFile",
) -> dict:
    t0 = time.perf_counter()
    try:
        front_bytes = await front.read()
        left_bytes  = await left.read()
        right_bytes = await right.read()

        for name, data in [("front", front_bytes), ("left", left_bytes), ("right", right_bytes)]:
            if not data:
                raise HTTPException(status_code=400, detail=f"{name} photo is empty.")

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{PYTHON_API_URL}/api/process-student",
                data={"studentId": student_id},
                files=[
                    ("front", (front.filename or "front.jpg", front_bytes, front.content_type or "image/jpeg")),
                    ("left",  (left.filename  or "left.jpg",  left_bytes,  left.content_type  or "image/jpeg")),
                    ("right", (right.filename or "right.jpg", right_bytes, right.content_type or "image/jpeg")),
                ],
            )

        if resp.status_code == 422:
            raise HTTPException(status_code=422, detail=resp.json().get("detail", "Face validation failed"))
        if resp.status_code == 400:
            raise HTTPException(status_code=400, detail=resp.json().get("detail", "Bad request"))
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Face service error: {resp.text[:200]}")

        await cache_invalidate(
            f"student:photos:{student_id}",
            f"student:me:{user_id}",
        )

        STUDENT_PROFILE_OPS_TOTAL.labels(operation="upload_photos", status="success").inc()
        return {
            "success": True,
            "studentId": student_id,
            "message": "All 3 photos validated and saved successfully.",
        }
    except HTTPException:
        raise
    except Exception:
        STUDENT_PROFILE_OPS_TOTAL.labels(operation="upload_photos", status="error").inc()
        STUDENT_UNHANDLED_ERRORS_TOTAL.labels(endpoint="upload_photos").inc()
        raise
    finally:
        STUDENT_PROFILE_OP_DURATION_SECONDS.labels(operation="upload_photos").observe(time.perf_counter() - t0)


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

async def get_stats(user_id: str) -> dict:
    t0 = time.perf_counter()
    try:
        cache_key = f"student:stats:{user_id}"
        cached = await cache_get(cache_key)
        if cached:
            return cached

        student = await prisma.student.find_unique(
            where={"userId": user_id},
            include={"courses": {"select": {"id": True}}},
        )
        if not student:
            STUDENT_UNHANDLED_ERRORS_TOTAL.labels(endpoint="get_stats").inc()
            raise HTTPException(status_code=404, detail="Student not found")

        enrolled_ids = [c.id for c in (student.courses or [])]
        total_courses = len(enrolled_ids)

        if not enrolled_ids:
            return {"total_courses": 0, "attendance_percentage": 0.0, "total_present": 0}

        records = await prisma.attendance.find_many(
            where={"studentId": student.id, "courseId": {"in": enrolled_ids}},
            order={"timestamp": "desc"},
        )

        seen: dict[str, bool] = {}
        for r in records:
            date_str = r.timestamp.strftime("%Y-%m-%d")
            key = f"{r.courseId}-{date_str}"
            if key not in seen:
                seen[key] = r.status

        total_sessions = len(seen)
        total_present = sum(1 for v in seen.values() if v)
        attendance_pct = (
            round((total_present / total_sessions) * 100 * 10) / 10
            if total_sessions > 0
            else 0.0
        )

        result = {
            "total_courses": total_courses,
            "attendance_percentage": attendance_pct,
            "total_present": total_present,
        }
        await cache_set(cache_key, result, ttl=60)
        return result
    except HTTPException:
        raise
    except Exception:
        STUDENT_UNHANDLED_ERRORS_TOTAL.labels(endpoint="get_stats").inc()
        raise
    finally:
        STUDENT_STATS_DURATION_SECONDS.labels(endpoint="stats").observe(time.perf_counter() - t0)


# ---------------------------------------------------------------------------
# Courses
# ---------------------------------------------------------------------------

async def list_courses(user_id: str) -> list[dict]:
    t0 = time.perf_counter()
    try:
        cache_key = f"student:courses:{user_id}"
        cached = await cache_get(cache_key)
        if cached:
            STUDENT_COURSE_OPS_TOTAL.labels(operation="list", status="success").inc()
            return cached

        student = await prisma.student.find_unique(
            where={"userId": user_id},
            include={
                "courses": {
                    "include": {
                        "teacher": {"include": {"user": True}},
                        "semester": {
                            "include": {
                                "academicYear": {
                                    "include": {
                                        "program": {"include": {"department": True}}
                                    }
                                }
                            }
                        },
                    }
                }
            },
        )
        if not student:
            STUDENT_COURSE_OPS_TOTAL.labels(operation="list", status="not_found").inc()
            raise HTTPException(status_code=404, detail="Student not found")

        result = [_serialize_course_list(c) for c in (student.courses or [])]
        await cache_set(cache_key, result, ttl=120)
        STUDENT_COURSE_OPS_TOTAL.labels(operation="list", status="success").inc()
        return result
    except HTTPException:
        raise
    except Exception:
        STUDENT_COURSE_OPS_TOTAL.labels(operation="list", status="error").inc()
        STUDENT_UNHANDLED_ERRORS_TOTAL.labels(endpoint="list_courses").inc()
        raise
    finally:
        STUDENT_COURSE_OP_DURATION_SECONDS.labels(operation="list").observe(time.perf_counter() - t0)


async def get_course(user_id: str, course_id: str) -> dict:
    t0 = time.perf_counter()
    try:
        student = await prisma.student.find_unique(where={"userId": user_id})
        if not student:
            STUDENT_COURSE_OPS_TOTAL.labels(operation="get", status="not_found").inc()
            raise HTTPException(status_code=404, detail="Student not found")

        course = await prisma.course.find_unique(
            where={"id": course_id},
            include={
                "teacher": {"include": {"user": True}},
                "semester": {
                    "include": {
                        "academicYear": {
                            "include": {
                                "program": {"include": {"department": True}}
                            }
                        }
                    }
                },
                "students": {"where": {"id": student.id}},
            },
        )

        if not course:
            STUDENT_COURSE_OPS_TOTAL.labels(operation="get", status="not_found").inc()
            raise HTTPException(status_code=404, detail="Course not found")

        enrolled = any(s.id == student.id for s in (course.students or []))
        if not enrolled:
            STUDENT_COURSE_OPS_TOTAL.labels(operation="get", status="forbidden").inc()
            raise HTTPException(status_code=403, detail="You are not enrolled in this course")

        STUDENT_COURSE_OPS_TOTAL.labels(operation="get", status="success").inc()
        return _serialize_course_detail(course)
    except HTTPException:
        raise
    except Exception:
        STUDENT_COURSE_OPS_TOTAL.labels(operation="get", status="error").inc()
        STUDENT_UNHANDLED_ERRORS_TOTAL.labels(endpoint="get_course").inc()
        raise
    finally:
        STUDENT_COURSE_OP_DURATION_SECONDS.labels(operation="get").observe(time.perf_counter() - t0)


async def join_course(user_id: str, data: JoinCourseRequest) -> dict:
    t0 = time.perf_counter()
    try:
        student = await prisma.student.find_unique(where={"userId": user_id})
        if not student:
            STUDENT_COURSE_OPS_TOTAL.labels(operation="join", status="not_found").inc()
            raise HTTPException(status_code=404, detail="Student not found")

        course = await prisma.course.find_unique(
            where={"entryCode": data.entry_code.upper().strip()},
            include={"students": {"where": {"id": student.id}}},
        )
        if not course:
            STUDENT_COURSE_OPS_TOTAL.labels(operation="join", status="not_found").inc()
            raise HTTPException(status_code=404, detail="Invalid entry code")

        already_enrolled = any(s.id == student.id for s in (course.students or []))
        if already_enrolled:
            STUDENT_COURSE_OPS_TOTAL.labels(operation="join", status="conflict").inc()
            raise HTTPException(status_code=409, detail="Already enrolled in this course")

        await prisma.course.update(
            where={"id": course.id},
            data={"students": {"connect": [{"id": student.id}]}},
        )
        await cache_invalidate(
            f"student:courses:{user_id}",
            f"student:stats:{user_id}",
        )
        STUDENT_COURSE_OPS_TOTAL.labels(operation="join", status="success").inc()
        return {"message": "Enrolled successfully", "course_id": course.id, "course_name": course.name}
    except HTTPException:
        raise
    except Exception:
        STUDENT_COURSE_OPS_TOTAL.labels(operation="join", status="error").inc()
        STUDENT_UNHANDLED_ERRORS_TOTAL.labels(endpoint="join_course").inc()
        raise
    finally:
        STUDENT_COURSE_OP_DURATION_SECONDS.labels(operation="join").observe(time.perf_counter() - t0)


async def leave_course(user_id: str, course_id: str) -> dict:
    t0 = time.perf_counter()
    try:
        student = await prisma.student.find_unique(where={"userId": user_id})
        if not student:
            STUDENT_COURSE_OPS_TOTAL.labels(operation="leave", status="not_found").inc()
            raise HTTPException(status_code=404, detail="Student not found")

        await prisma.course.update(
            where={"id": course_id},
            data={"students": {"disconnect": [{"id": student.id}]}},
        )
        await cache_invalidate(
            f"student:courses:{user_id}",
            f"student:stats:{user_id}",
        )
        STUDENT_COURSE_OPS_TOTAL.labels(operation="leave", status="success").inc()
        return {"message": "Left course successfully"}
    except HTTPException:
        raise
    except Exception:
        STUDENT_COURSE_OPS_TOTAL.labels(operation="leave", status="error").inc()
        STUDENT_UNHANDLED_ERRORS_TOTAL.labels(endpoint="leave_course").inc()
        raise
    finally:
        STUDENT_COURSE_OP_DURATION_SECONDS.labels(operation="leave").observe(time.perf_counter() - t0)


# ---------------------------------------------------------------------------
# Attendance
# ---------------------------------------------------------------------------

async def get_course_attendance(user_id: str, course_id: str) -> dict:
    t0 = time.perf_counter()
    try:
        cache_key = f"student:attendance:{user_id}:{course_id}"
        cached = await cache_get(cache_key)
        if cached:
            STUDENT_ATTENDANCE_OPS_TOTAL.labels(operation="course_attendance", status="success").inc()
            return cached

        student = await prisma.student.find_unique(where={"userId": user_id})
        if not student:
            STUDENT_ATTENDANCE_OPS_TOTAL.labels(operation="course_attendance", status="not_found").inc()
            raise HTTPException(status_code=404, detail="Student not found")

        course = await prisma.course.find_unique(where={"id": course_id})
        if not course:
            STUDENT_ATTENDANCE_OPS_TOTAL.labels(operation="course_attendance", status="not_found").inc()
            raise HTTPException(status_code=404, detail="Course not found")

        records = await prisma.attendance.find_many(
            where={"studentId": student.id, "courseId": course_id},
            order={"timestamp": "desc"},
        )

        seen: dict[str, bool] = {}
        for r in records:
            date_str = r.timestamp.strftime("%Y-%m-%d")
            if date_str not in seen:
                seen[date_str] = r.status

        total = len(seen)
        present = sum(1 for v in seen.values() if v)
        rate = round((present / total) * 100, 1) if total > 0 else 0.0

        result = {
            "course_id": course_id,
            "course_name": course.name,
            "total_sessions": total,
            "present": present,
            "absent": total - present,
            "rate": rate,
            "records": [
                {"date": date, "status": status}
                for date, status in sorted(seen.items(), reverse=True)
            ],
        }
        await cache_set(cache_key, result, ttl=60)
        STUDENT_ATTENDANCE_OPS_TOTAL.labels(operation="course_attendance", status="success").inc()
        return result
    except HTTPException:
        raise
    except Exception:
        STUDENT_ATTENDANCE_OPS_TOTAL.labels(operation="course_attendance", status="error").inc()
        STUDENT_UNHANDLED_ERRORS_TOTAL.labels(endpoint="get_course_attendance").inc()
        raise
    finally:
        STUDENT_ATTENDANCE_OP_DURATION_SECONDS.labels(operation="course_attendance").observe(time.perf_counter() - t0)


async def get_attendance_history(user_id: str) -> dict:
    t0 = time.perf_counter()
    try:
        cache_key = f"student:history:{user_id}"
        cached = await cache_get(cache_key)
        if cached:
            STUDENT_ATTENDANCE_OPS_TOTAL.labels(operation="history", status="success").inc()
            return cached

        student = await prisma.student.find_unique(
            where={"userId": user_id},
            include={"courses": True},
        )
        if not student:
            STUDENT_ATTENDANCE_OPS_TOTAL.labels(operation="history", status="not_found").inc()
            raise HTTPException(status_code=404, detail="Student not found")

        enrolled_ids = [c.id for c in (student.courses or [])]
        if not enrolled_ids:
            return {"records": [], "summary": []}

        all_records = await prisma.attendance.find_many(
            where={"studentId": student.id, "courseId": {"in": enrolled_ids}},
            include={"course": True},
            order={"timestamp": "desc"},
        )

        seen: dict[str, dict] = {}
        for r in all_records:
            date_str = r.timestamp.strftime("%Y-%m-%d")
            key = f"{r.courseId}-{date_str}"
            if key not in seen:
                seen[key] = {
                    "course_id": r.courseId,
                    "course_name": r.course.name if r.course else "",
                    "date": date_str,
                    "status": r.status,
                }

        deduped = sorted(seen.values(), key=lambda x: x["date"], reverse=True)

        summary_map: dict[str, dict] = {}
        for rec in deduped:
            cid = rec["course_id"]
            if cid not in summary_map:
                summary_map[cid] = {
                    "course_id": cid,
                    "course_name": rec["course_name"],
                    "total_sessions": 0,
                    "present": 0,
                    "absent": 0,
                }
            summary_map[cid]["total_sessions"] += 1
            if rec["status"]:
                summary_map[cid]["present"] += 1
            else:
                summary_map[cid]["absent"] += 1

        summary = []
        for s in summary_map.values():
            t = s["total_sessions"]
            s["rate"] = round((s["present"] / t) * 100, 1) if t > 0 else 0.0
            summary.append(s)

        result = {"records": deduped, "summary": summary}
        await cache_set(cache_key, result, ttl=60)
        STUDENT_ATTENDANCE_OPS_TOTAL.labels(operation="history", status="success").inc()
        return result
    except HTTPException:
        raise
    except Exception:
        STUDENT_ATTENDANCE_OPS_TOTAL.labels(operation="history", status="error").inc()
        STUDENT_UNHANDLED_ERRORS_TOTAL.labels(endpoint="get_attendance_history").inc()
        raise
    finally:
        STUDENT_ATTENDANCE_OP_DURATION_SECONDS.labels(operation="history").observe(time.perf_counter() - t0)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _serialize_course_list(c) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "code": c.code,
        "entry_code": c.entryCode,
        "teacher_name": (
            c.teacher.user.name if (c.teacher and c.teacher.user) else None
        ),
        "semester_name": c.semester.name if c.semester else None,
        "academic_year": (
            c.semester.academicYear.name
            if (c.semester and c.semester.academicYear)
            else None
        ),
        "program_name": (
            c.semester.academicYear.program.name
            if (c.semester and c.semester.academicYear and c.semester.academicYear.program)
            else None
        ),
    }


def _serialize_course_detail(c) -> dict:
    return {
        **_serialize_course_list(c),
        "teacher_id": c.teacherId,
        "teacher_email": (
            c.teacher.user.email if (c.teacher and c.teacher.user) else None
        ),
    }