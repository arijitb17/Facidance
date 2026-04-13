const ADMIN_API_URL =
  process.env.NEXT_PUBLIC_ADMIN_API_URL ?? "http://localhost:8001";

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("token") ?? "";
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${ADMIN_API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
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

export interface AdminStats {
  teachers: number;
  students: number;
  departments: number;
  programs: number;
  courses: number;
  success: boolean;
}
export const statsApi = {
  get: () => apiFetch<AdminStats>("/admin/stats"),
};

export interface Teacher {
  id: string;
  userId: string;
  name: string;
  email: string;
  departmentId: string | null;
  departmentName: string | null;
  isPending: boolean;
}
export const teachersApi = {
  list: () => apiFetch<{ teachers: Teacher[] }>("/admin/teachers"),
  approve: (teacherId: string, departmentId: string) =>
    apiFetch("/admin/approve-teacher", {
      method: "POST",
      body: JSON.stringify({ teacher_id: teacherId, department_id: departmentId }),
    }),
  create: (data: { name: string; email: string; password: string; department_id: string }) =>
    apiFetch("/admin/teachers", { method: "POST", body: JSON.stringify(data) }),
  delete: (userId: string) =>
    apiFetch(`/admin/teachers/${userId}`, { method: "DELETE" }),
};

export interface Department {
  id: string;
  name: string;
  programs_count: number;
  teachers_count: number;
}
export const departmentsApi = {
  list: () => apiFetch<{ departments: Department[] }>("/admin/departments"),
  create: (name: string) =>
    apiFetch<{ department: Department }>("/admin/departments", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  delete: (id: string) => apiFetch(`/admin/departments/${id}`, { method: "DELETE" }),
};

export interface Program {
  id: string;
  name: string;
  department_id: string;
  department_name: string | null;
}
export const programsApi = {
  list: () => apiFetch<{ programs: Program[] }>("/admin/programs"),
  create: (name: string, department_id: string) =>
    apiFetch<{ program: Program }>("/admin/programs", {
      method: "POST",
      body: JSON.stringify({ name, department_id }),
    }),
  delete: (id: string) => apiFetch(`/admin/programs/${id}`, { method: "DELETE" }),
};

export interface Course {
  id: string;
  name: string;
  code: string;
  entry_code: string;
  teacher_id: string;
  teacher_name: string | null;
  semester_id: string;
  semester_name: string | null;
  academic_year_name: string | null;
  program_name: string | null;
}
export const coursesApi = {
  list: () => apiFetch<{ courses: Course[] }>("/admin/courses"),
  create: (data: {
    name: string;
    teacher_id: string;
    program_id: string;
    academic_year: string;
    semester_number: number;
  }) => apiFetch<{ course: Course }>("/admin/courses", { method: "POST", body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch(`/admin/courses/${id}`, { method: "DELETE" }),
};

export interface StudentCourse {
  id: string;
  name: string;
  entry_code: string;
  semester_name: string | null;
  academic_year: string | null;
  program_name: string | null;
}
export interface Student {
  id: string;
  name: string;
  email: string;
  student_id: string | null;
  program_id: string | null;
  program_name: string | null;
  department_name: string | null;
  status: string;
  joined_at: string | null;
  graduated: boolean;
  courses_count: number;
  courses: StudentCourse[];
}
export const studentsApi = {
  list: () => apiFetch<{ students: Student[]; programs: Program[] }>("/admin/students"),
  update: (userId: string, data: { name?: string; email?: string; program_id?: string }) =>
    apiFetch(`/admin/students/${userId}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (userId: string) => apiFetch(`/admin/students/${userId}`, { method: "DELETE" }),
  graduate: (userId: string) =>
    apiFetch(`/admin/students/${userId}/graduate`, { method: "POST" }),
};

export interface AnalyticsOverview {
  total_users: number;
  total_teachers: number;
  total_students: number;
  active_students: number;
  graduated_students: number;
  total_departments: number;
  total_programs: number;
  total_courses: number;
  total_attendance_records: number;
  overall_attendance_rate: number;
}
export interface AttendanceTrend {
  month: string;
  total: number;
  present: number;
  rate: number;
}
export interface TeacherLoad {
  teacher_id: string;
  teacher_name: string;
  department_name: string | null;
  course_count: number;
  student_count: number;
}
export interface ProgramDistribution {
  program_id: string;
  program_name: string;
  department_name: string | null;
  student_count: number;
}
export const analyticsApi = {
  overview: () => apiFetch<AnalyticsOverview>("/admin/analytics/overview"),
  attendanceTrends: () =>
    apiFetch<{ trends: AttendanceTrend[] }>("/admin/analytics/attendance-trends"),
  teacherLoad: () =>
    apiFetch<{ teachers: TeacherLoad[] }>("/admin/analytics/teacher-load"),
  programDistribution: () =>
    apiFetch<{ programs: ProgramDistribution[] }>("/admin/analytics/program-distribution"),
};