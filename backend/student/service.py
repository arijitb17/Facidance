"""
backend/student/service.py

Pure business logic for the Student microservice.
No HTTP concerns here — all DB access via prisma_client.prisma.
"""

from __future__ import annotations


from fastapi import HTTPException
import os
import json
from groq import AsyncGroq
from backend.common.prisma_client import prisma
from backend.common.cache import cache_get, cache_set, cache_invalidate
from backend.student.schemas import (
    JoinCourseRequest,
    UpdateProfileRequest,
)


async def get_ai_suggestions(user_id: str) -> dict:
    """
    Generate personalised AI suggestions for a student with low attendance.
    Uses Groq (free tier) with llama-3.1-8b-instant.
    Mirrors GET /api/student/ai-suggestions.
    """
    stats   = await get_stats(user_id)
    history = await get_attendance_history(user_id)

    attendance_pct: float = stats["attendance_percentage"]
    total_courses: int    = stats["total_courses"]
    total_present: int    = stats["total_present"]
    summary: list[dict]   = history.get("summary", [])

    # Pre-compute per-course session gaps — don't let the AI guess the math
    course_data = []
    for s in sorted(summary, key=lambda x: x["rate"]):
        total   = s["total_sessions"]
        present = s["present"]
        rate    = s["rate"]

        if rate < 75 and total > 0:
            # Solve: (present + x) / (total + x) >= 0.75
            needed = max(0, int(((0.75 * total) - present) / 0.25) + 1)
        else:
            # How many can they still miss while staying >= 75%?
            # Solve: (present) / (total + x) >= 0.75  →  x = present/0.75 - total
            can_miss = max(0, int(present / 0.75) - total)
            needed = -can_miss  # negative = buffer remaining

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

    # Strip markdown fences if model adds them anyway
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parsed = {"raw": raw, "parse_error": True}

    # ── Patch AI output with ground-truth numbers ──────────────────────────
    # LLMs hallucinate / rescale numbers and miscategorize courses.
    # Rebuild urgent/safe lists entirely from server-computed course_data.
    real = {s["course_name"]: s for s in course_data}

    # Collect whatever advice text the AI wrote for each course (best-effort)
    all_ai_courses = {
        **{c["name"]: c for c in parsed.get("urgent_courses", [])},
        **{c["name"]: c for c in parsed.get("safe_courses", [])},
    }

    corrected_urgent = []
    corrected_safe   = []

    for course_name, match in real.items():
        ai_entry = all_ai_courses.get(course_name, {})

        if match["sessions_needed_for_75"] > 0:
            # Truly below 75% — urgent
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
            # At or above 75% — safe
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
    # ──────────────────────────────────────────────────────────────────────

    return {
        "attendance_percentage": attendance_pct,
        "suggestions": parsed,
    }
# ---------------------------------------------------------------------------
# Me / Profile
# ---------------------------------------------------------------------------

async def get_me(user_id: str) -> dict:
    """
    Return the authenticated student's full profile.
    Mirrors GET /api/student/me.
    """
    cache_key = f"student:me:{user_id}"
    cached = await cache_get(cache_key)
    if cached:
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
    return result


async def update_profile(user_id: str, data: UpdateProfileRequest) -> dict:
    """
    Update the student's name and/or email.
    Mirrors PATCH /api/student/profile.
    """
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
    return {"id": user.id, "name": user.name, "email": user.email}


async def check_photos(student_id: str) -> dict:
    """
    Check whether a student has a face embedding registered.
    Mirrors GET /api/student/check-photos.
    """
    cache_key = f"student:photos:{student_id}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    student = await prisma.student.find_unique(where={"id": student_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    result = {"has_photos": student.faceEmbedding is not None}
    await cache_set(cache_key, result, ttl=300)
    return result


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

async def get_stats(user_id: str) -> dict:
    """
    Return the student's course count, attendance %, and total present.
    Mirrors GET /api/student/stats — including the dedup-by-day logic.
    """
    cache_key = f"student:stats:{user_id}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    student = await prisma.student.find_unique(
        where={"userId": user_id},
        include={"courses": {"select": {"id": True}}},
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    enrolled_ids = [c.id for c in (student.courses or [])]
    total_courses = len(enrolled_ids)

    if not enrolled_ids:
        return {"total_courses": 0, "attendance_percentage": 0.0, "total_present": 0}

    records = await prisma.attendance.find_many(
        where={"studentId": student.id, "courseId": {"in": enrolled_ids}},
        order={"timestamp": "desc"},
    )

    # Deduplicate: keep only the most-recent record per (course, date)
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


# ---------------------------------------------------------------------------
# Courses
# ---------------------------------------------------------------------------

async def list_courses(user_id: str) -> list[dict]:
    """
    Return all courses the student is enrolled in.
    Mirrors GET /api/student/courses.
    """
    cache_key = f"student:courses:{user_id}"
    cached = await cache_get(cache_key)
    if cached:
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
        raise HTTPException(status_code=404, detail="Student not found")

    result = [_serialize_course_list(c) for c in (student.courses or [])]
    await cache_set(cache_key, result, ttl=120)
    return result


async def get_course(user_id: str, course_id: str) -> dict:
    """
    Return a single course detail (only if student is enrolled).
    Mirrors GET /api/student/courses/[id].
    """
    student = await prisma.student.find_unique(where={"userId": user_id})
    if not student:
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
        raise HTTPException(status_code=404, detail="Course not found")

    enrolled = any(s.id == student.id for s in (course.students or []))
    if not enrolled:
        raise HTTPException(status_code=403, detail="You are not enrolled in this course")

    return _serialize_course_detail(course)


async def join_course(user_id: str, data: JoinCourseRequest) -> dict:
    """
    Enrol a student into a course using its entry code.
    """
    student = await prisma.student.find_unique(where={"userId": user_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    course = await prisma.course.find_unique(
        where={"entryCode": data.entry_code.upper().strip()},
        include={"students": {"where": {"id": student.id}}},
    )
    if not course:
        raise HTTPException(status_code=404, detail="Invalid entry code")

    already_enrolled = any(s.id == student.id for s in (course.students or []))
    if already_enrolled:
        raise HTTPException(status_code=409, detail="Already enrolled in this course")

    # Connect student ↔ course (many-to-many)
    await prisma.course.update(
        where={"id": course.id},
        data={"students": {"connect": [{"id": student.id}]}},
    )
    # Invalidate cached course/stats data
    await cache_invalidate(
        f"student:courses:{user_id}",
        f"student:stats:{user_id}",
    )
    return {"message": "Enrolled successfully", "course_id": course.id, "course_name": course.name}


async def leave_course(user_id: str, course_id: str) -> dict:
    """Remove a student from a course."""
    student = await prisma.student.find_unique(where={"userId": user_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    await prisma.course.update(
        where={"id": course_id},
        data={"students": {"disconnect": [{"id": student.id}]}},
    )
    # Invalidate cached course/stats data
    await cache_invalidate(
        f"student:courses:{user_id}",
        f"student:stats:{user_id}",
    )
    return {"message": "Left course successfully"}


# ---------------------------------------------------------------------------
# Attendance
# ---------------------------------------------------------------------------

async def get_course_attendance(user_id: str, course_id: str) -> dict:
    """
    Return attendance records for a student in one course.
    Mirrors GET /api/student/courses/[id]/attendance.
    Deduplicates by (course, date) — same logic as stats.
    """
    cache_key = f"student:attendance:{user_id}:{course_id}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    student = await prisma.student.find_unique(where={"userId": user_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    course = await prisma.course.find_unique(where={"id": course_id})
    if not course:
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
    return result


async def get_attendance_history(user_id: str) -> dict:
    """
    Full attendance history across all enrolled courses.
    Mirrors GET /api/student/history.
    """
    cache_key = f"student:history:{user_id}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    student = await prisma.student.find_unique(
        where={"userId": user_id},
        include={"courses": True},
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    enrolled_ids = [c.id for c in (student.courses or [])]
    if not enrolled_ids:
        return {"records": [], "summary": []}

    all_records = await prisma.attendance.find_many(
        where={"studentId": student.id, "courseId": {"in": enrolled_ids}},
        include={"course": True},
        order={"timestamp": "desc"},
    )

    # Dedup per course per day
    seen: dict[str, dict] = {}  # key → {date, status, course_id, course_name}
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

    # Per-course summary
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
    return result


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
