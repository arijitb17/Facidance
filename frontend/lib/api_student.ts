/**
 * frontend/lib/api_student.ts
 *
 * Typed API client for the Student microservice (FastAPI — port 8003).
 * All calls go through Next.js rewrites (`/api/student/*` → `http://localhost:8003/student/*`),
 * so CORS is handled server-side and the JWT token is forwarded transparently.
 *
 * Add this rewrite to next.config.js:
 *   async rewrites() {
 *     return [{ source: "/api/student/:path*", destination: "http://localhost:8003/student/:path*" }];
 *   }
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
    face_embedding: boolean | null; // true = has embedding; never raw bytes
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
  date: string; // YYYY-MM-DD
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

/** GET /student/me — authenticated student's full profile */
export async function getMe(): Promise<StudentProfile> {
  const res = await fetch(`${BASE}/me`, { headers: authHeaders() });
  return handleResponse<StudentProfile>(res);
}

/** PATCH /student/profile — update name / email */
export async function updateProfile(payload: UpdateProfilePayload): Promise<{ id: string; name: string; email: string }> {
  const res = await fetch(`${BASE}/profile`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

/** GET /student/check-photos?student_id=<id> — whether the student has a face embedding */
export async function checkPhotos(studentId: string): Promise<CheckPhotosResponse> {
  const res = await fetch(`${BASE}/check-photos?student_id=${studentId}`, {
    headers: authHeaders(),
  });
  return handleResponse<CheckPhotosResponse>(res);
}

/** GET /student/stats — dashboard stats */
export async function getStats(): Promise<StudentStats> {
  const res = await fetch(`${BASE}/stats`, { headers: authHeaders() });
  return handleResponse<StudentStats>(res);
}

/** GET /student/courses — list enrolled courses */
export async function listCourses(): Promise<CourseListItem[]> {
  const res = await fetch(`${BASE}/courses`, { headers: authHeaders() });
  const data = await handleResponse<{ courses: CourseListItem[] }>(res);
  return data.courses;
}

/** GET /student/courses/:id — single course detail (must be enrolled) */
export async function getCourse(courseId: string): Promise<CourseDetail> {
  const res = await fetch(`${BASE}/courses/${courseId}`, { headers: authHeaders() });
  return handleResponse<CourseDetail>(res);
}

/** POST /student/courses/join — join by entry code */
export async function joinCourse(entryCode: string): Promise<{ message: string; course_id: string; course_name: string }> {
  const res = await fetch(`${BASE}/courses/join`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ entry_code: entryCode }),
  });
  return handleResponse(res);
}

/** DELETE /student/courses/:id/leave — leave an enrolled course */
export async function leaveCourse(courseId: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE}/courses/${courseId}/leave`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handleResponse(res);
}

/** GET /student/courses/:id/attendance — attendance for one course */
export async function getCourseAttendance(courseId: string): Promise<CourseAttendanceSummary> {
  const res = await fetch(`${BASE}/courses/${courseId}/attendance`, { headers: authHeaders() });
  return handleResponse<CourseAttendanceSummary>(res);
}

/** GET /student/history — full attendance history across all courses */
export async function getAttendanceHistory(): Promise<AttendanceHistoryResponse> {
  const res = await fetch(`${BASE}/history`, { headers: authHeaders() });
  return handleResponse<AttendanceHistoryResponse>(res);
}

/**
 * POST /student/upload-photos
 * Upload face photos. This still hits the Next.js API route (/api/student/upload-photos)
 * because photo processing involves a Python script call from the server side.
 * If you move that logic to FastAPI, update the URL to `${BASE}/upload-photos`.
 */
export async function uploadPhotos(studentId: string, photos: { front?: File; left?: File; right?: File }): Promise<{ message: string; studentId: string }> {
  const formData = new FormData();
  formData.append("studentId", studentId);
  if (photos.front) formData.append("front", photos.front);
  if (photos.left) formData.append("left", photos.left);
  if (photos.right) formData.append("right", photos.right);

  const res = await fetch("/api/student/upload-photos", {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` }, // no Content-Type — browser sets multipart boundary
    body: formData,
  });
  return handleResponse(res);
}