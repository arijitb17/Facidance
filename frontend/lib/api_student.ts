/**
 * frontend/lib/api_student.ts
 *
 * Typed API client for the Student microservice (FastAPI — port 8003).
 * All calls go through Next.js rewrites (`/api/student/*` → `http://localhost:8003/student/*`),
 * so CORS is handled server-side and the JWT token is forwarded transparently.
 */

// ---------------------------------------------------------------------------
// Types (mirroring backend/student/schemas.py)
// ---------------------------------------------------------------------------

export interface StudentProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  student: {
    id: string;
    program_id: string;
    program_name: string | null;
    department_name: string | null;
    joined_at: string;
    status: string;
    face_embedding: boolean | null;
  } | null;
}

export interface StudentStats {
  total_courses: number;
  attendance_percentage: number;
  total_present: number;
}

export interface CourseListItem {
  id: string;
  name: string;
  code: string;
  entry_code: string;
  teacher_name: string | null;
  semester_name: string | null;
  academic_year: string | null;
  program_name: string | null;
}

export interface CourseDetail extends CourseListItem {
  teacher_id: string;
  teacher_email: string | null;
}

export interface AttendanceRecord {
  date: string;
  status: boolean;
}

export interface CourseAttendanceSummary {
  course_id: string;
  course_name: string;
  total_sessions: number;
  present: number;
  absent: number;
  rate: number;
  records: AttendanceRecord[];
}

export interface HistoryRecord {
  course_id: string;
  course_name: string;
  date: string;
  status: boolean;
}

export interface AttendanceHistoryResponse {
  records: HistoryRecord[];
  summary: CourseAttendanceSummary[];
}

export interface CheckPhotosResponse {
  has_photos: boolean;
}

export interface UpdateProfilePayload {
  name?: string;
  email?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("token") ?? "";
}

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

/** Base URL — all traffic goes through the Next.js rewrite proxy. */
const BASE = `${process.env.NEXT_PUBLIC_STUDENT_API_URL}/student`;

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body?.detail ?? body?.error ?? detail;
    } catch {
      // ignore parse errors
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function getMe(): Promise<StudentProfile> {
  const res = await fetch(`${BASE}/me`, { headers: authHeaders() });
  return handleResponse<StudentProfile>(res);
}

export async function updateProfile(
  payload: UpdateProfilePayload
): Promise<{ id: string; name: string; email: string }> {
  const res = await fetch(`${BASE}/profile`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function checkPhotos(
  studentId: string
): Promise<CheckPhotosResponse> {
  const res = await fetch(`${BASE}/check-photos?student_id=${studentId}`, {
    headers: authHeaders(),
  });
  return handleResponse<CheckPhotosResponse>(res);
}

export async function getStats(): Promise<StudentStats> {
  const res = await fetch(`${BASE}/stats`, { headers: authHeaders() });
  return handleResponse<StudentStats>(res);
}

export async function listCourses(): Promise<CourseListItem[]> {
  const res = await fetch(`${BASE}/courses`, { headers: authHeaders() });
  const data = await handleResponse<{ courses: CourseListItem[] }>(res);
  return data.courses;
}

export async function getCourse(courseId: string): Promise<CourseDetail> {
  const res = await fetch(`${BASE}/courses/${courseId}`, {
    headers: authHeaders(),
  });
  return handleResponse<CourseDetail>(res);
}

export async function joinCourse(
  entryCode: string
): Promise<{ message: string; course_id: string; course_name: string }> {
  const res = await fetch(`${BASE}/courses/join`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ entry_code: entryCode }),
  });
  return handleResponse(res);
}

export async function leaveCourse(
  courseId: string
): Promise<{ message: string }> {
  const res = await fetch(`${BASE}/courses/${courseId}/leave`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function getCourseAttendance(
  courseId: string
): Promise<CourseAttendanceSummary> {
  const res = await fetch(`${BASE}/courses/${courseId}/attendance`, {
    headers: authHeaders(),
  });
  return handleResponse<CourseAttendanceSummary>(res);
}

export async function getAttendanceHistory(): Promise<AttendanceHistoryResponse> {
  const res = await fetch(`${BASE}/history`, { headers: authHeaders() });
  return handleResponse<AttendanceHistoryResponse>(res);
}

/**
 * POST /student/upload-photos
 *
 * Routes: browser → Next.js rewrite → student service → face service (internal).
 * The face service is on an internal Docker network and must never be called
 * directly from the browser. All photo uploads go through the student service.
 *
 * The Authorization header is forwarded so the student service can verify
 * the JWT before proxying to face.
 */
export async function uploadPhotos(
  studentId: string,
  photos: { front?: File; left?: File; right?: File }
): Promise<{ message: string; studentId: string }> {
  if (!photos.front || !photos.left || !photos.right) {
    throw new Error("All three photos (front, left, right) are required.");
  }

  const formData = new FormData();
  formData.append("studentId", studentId);
  formData.append("front", photos.front, photos.front.name);
  formData.append("left",  photos.left,  photos.left.name);
  formData.append("right", photos.right, photos.right.name);

  // ✅ Goes through student service — never directly to face service
  const res = await fetch(`${BASE}/upload-photos`, {
    method: "POST",
    // Do NOT set Content-Type — browser must set it with the multipart boundary
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body?.detail ?? body?.error ?? detail;
    } catch {}
    throw new Error(detail);
  }

  return res.json() as Promise<{ message: string; studentId: string }>;
}