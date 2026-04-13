/**
 * lib/teacher-api.ts
 *
 * Typed API client for the Teacher FastAPI microservice (port 8002).
 * Mirrors the shape of the original Next.js teacher API routes.
 */

const TEACHER_API_URL =
  process.env.NEXT_PUBLIC_TEACHER_API_URL ?? "http://localhost:8002";

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("token") ?? "";
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${TEACHER_API_URL}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? body?.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TeacherMe {
  id: string;
  name: string;
  department: string | null;
  courses: { id: string; name: string }[];
}

export interface TeacherStats {
  courses: number;
  total_students: number;
  total_semesters: number;
  total_attendance: number;
}

export interface TeacherCourse {
  id: string;
  name: string;
  code: string;
  entry_code: string;
  teacher_id: string;
  semester: string | null;
  program: string | null;
  department: string | null;
  student_count: number;
  session_count: number;
}

export interface CourseStudentItem {
  id: string;
  user: { name: string; email: string };
  program: {
    id: string;
    name: string;
    department: { id: string; name: string } | null;
  } | null;
  faceEmbedding: boolean;
  hasPhotos: boolean;
  photoCount: number;
  _count: { attendance: number };
}

export interface HierarchyCourse {
  id: string;
  name: string;
  entryCode: string;
}

export interface HierarchySemester {
  id: string;
  name: string;
  academicYearId: string;
  courses: HierarchyCourse[];
}

export interface HierarchyAcademicYear {
  id: string;
  name: string;
  programId: string;
  semesters: HierarchySemester[];
}

export interface HierarchyProgram {
  id: string;
  name: string;
  departmentId: string;
  academicYears: HierarchyAcademicYear[];
}

export interface HierarchyDepartment {
  id: string;
  name: string;
  programs: HierarchyProgram[];
}

export interface TeacherHierarchy {
  departments: HierarchyDepartment[];
}

export interface TeacherStudent {
  id: string;
  user: { name: string; email: string };
  program: {
    id: string;
    name: string;
    department: { id: string; name: string } | null;
  } | null;
  faceEmbedding: boolean;
  courses: { id: string; name: string }[];
  _count: { courses: number; attendance: number };
}

export interface ReportRow {
  studentName: string;
  studentEmail: string;
  totalSessions: number;
  attended: number;
  percentage: number;
}

export interface ImportStudent {
  name: string;
  email: string;
  dob: string;
  program_id: string;
}

export interface ImportResult {
  message: string;
  successful: string[];
  failed: { email: string; reason: string }[];
  existing: string[];
}

export interface RecognizedStudent {
  id: string;
  name: string;
  email: string;
}

export interface AttendanceStatistics {
  totalStudents: number;
  present: number;
  absent: number;
  attendanceRate: string;
}

export interface SubmitAttendanceResponse {
  success: boolean;
  message: string;
  statistics: AttendanceStatistics;
  timestamp: string;
}

export interface AttendanceHistoryRecord {
  studentId: string;
  studentName: string;
  studentEmail: string;
  status: boolean;
  timestamp: string;
}

export interface AttendanceHistoryResponse {
  courseId: string;
  attendanceByDate: Record<string, AttendanceHistoryRecord[]>;
  totalRecords: number;
}

// ---------------------------------------------------------------------------
// API surface
// ---------------------------------------------------------------------------

/** Teacher profile */
export const teacherMeApi = {
  get: () => apiFetch<TeacherMe>("/teacher/me"),
};

/** Dashboard stats */
export const teacherStatsApi = {
  get: () => apiFetch<TeacherStats>("/teacher/stats"),
};

/** Course hierarchy */
export const teacherHierarchyApi = {
  get: () => apiFetch<TeacherHierarchy>("/teacher/hierarchy"),
};

/** Courses */
export const teacherCoursesApi = {
  list: () =>
    apiFetch<{ courses: TeacherCourse[] }>("/teacher/courses").then(
      (r) => r.courses
    ),

  getStudents: (courseId: string) =>
    apiFetch<{ course: object; students: CourseStudentItem[] }>(
      `/teacher/courses/${courseId}/students`
    ),

  removeStudent: (courseId: string, studentId: string) =>
    apiFetch(`/teacher/courses/${courseId}/students`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId }),
    }),

  importStudents: (courseId: string, students: ImportStudent[]) =>
    apiFetch<ImportResult>(`/teacher/courses/${courseId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ students }),
    }),
};

/** Students (teacher-scoped) */
export const teacherStudentsApi = {
  list: (courseId?: string) => {
    const qs = courseId ? `?course_id=${courseId}` : "";
    return apiFetch<TeacherStudent[]>(`/teacher/students${qs}`);
  },
};

/** Reports */
export const teacherReportsApi = {
  get: (courseId: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams({ course_id: courseId });
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);
    return apiFetch<ReportRow[]>(`/teacher/reports?${params}`);
  },
};

/** Attendance operations */
export const teacherAttendanceApi = {
  getStudents: (courseId: string) =>
    apiFetch<{ id: string; name: string; email: string; has_face_data: boolean }[]>(
      "/teacher/attendance/get-students",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: courseId }),
      }
    ),

  trainStudent: (
    studentId: string,
    courseId: string,
    photos: File[]
  ) => {
    const fd = new FormData();
    fd.append("student_id", studentId);
    fd.append("course_id", courseId);
    photos.forEach((p) => fd.append("photos", p));
    return apiFetch<{
      success: boolean;
      student_id: string;
      student_name: string;
      photos_saved: number;
    }>("/teacher/attendance/train-student", { method: "POST", body: fd });
  },

  runTraining: (courseId: string) =>
    apiFetch<{ success: boolean; message: string; results: unknown }>(
      "/teacher/attendance/run-training",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: courseId }),
      }
    ),

  recognize: (
    courseId: string,
    frames: File[],
    batchId?: string,
    autoSubmit = false
  ) => {
    const fd = new FormData();
    fd.append("course_id", courseId);
    if (batchId) fd.append("batch_id", batchId);
    fd.append("auto_submit", String(autoSubmit));
    frames.forEach((f) => fd.append("frames", f));
    return apiFetch<{
      recognizedStudents: RecognizedStudent[];
      totalFaces: number;
      averageConfidence: number;
      batchId: string | null;
      courseId: string;
      timestamp: string;
      attendance: SubmitAttendanceResponse | null;
    }>("/teacher/attendance/recognize", { method: "POST", body: fd });
  },

  submitAttendance: (
    courseId: string,
    recognitionResults: { recognizedStudents: RecognizedStudent[] },
    date?: string
  ) =>
    apiFetch<SubmitAttendanceResponse>("/teacher/attendance/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        course_id: courseId,
        recognition_results: recognitionResults,
        date,
      }),
    }),

  getHistory: (courseId: string) =>
    apiFetch<AttendanceHistoryResponse>(
      `/teacher/attendance/history?course_id=${courseId}`
    ),
};

/** Send credentials email */
export const teacherCredentialsApi = {
  send: (students: { name: string; email: string; dob: string }[]) =>
    apiFetch<{ success: boolean; message: string; sent: string[]; failed: string[] }>(
      "/teacher/send-credentials",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students }),
      }
    ),
};