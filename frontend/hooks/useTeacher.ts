"use client";

/**
 * lib/useTeacher.ts
 *
 * React hooks for all teacher data, mirroring useAdmin.ts style.
 * Each hook wraps the teacher-api.ts client in the shared useQuery pattern.
 */

import { useCallback, useEffect, useState } from "react";
import {
  AttendanceHistoryResponse,
  CourseStudentItem,
  HierarchyDepartment,
  ImportResult,
  ImportStudent,
  RecognizedStudent,
  ReportRow,
  SubmitAttendanceResponse,
  TeacherCourse,
  TeacherHierarchy,
  TeacherMe,
  TeacherStats,
  TeacherStudent,
  teacherAttendanceApi,
  teacherCoursesApi,
  teacherCredentialsApi,
  teacherHierarchyApi,
  teacherMeApi,
  teacherReportsApi,
  teacherStatsApi,
  teacherStudentsApi,
} from "@/lib/teacher-api";

// ---------------------------------------------------------------------------
// Shared query primitive
// ---------------------------------------------------------------------------

interface UseQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function useQuery<T>(fetcher: () => Promise<T>): UseQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  return { data, loading, error, refetch: fetch_ };
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Teacher profile: name, department, course list */
export function useTeacherMe() {
  return useQuery<TeacherMe>(teacherMeApi.get);
}

/** Dashboard stat counts */
export function useTeacherStats() {
  return useQuery<TeacherStats>(teacherStatsApi.get);
}

/** Full Department → … → Course hierarchy */
export function useTeacherHierarchy() {
  const q = useQuery<TeacherHierarchy>(teacherHierarchyApi.get);
  return {
    ...q,
    departments: q.data?.departments ?? ([] as HierarchyDepartment[]),
  };
}

/** All courses taught by the logged-in teacher */
export function useTeacherCourses() {
  return useQuery<TeacherCourse[]>(teacherCoursesApi.list);
}

/**
 * Students enrolled in a specific course (detail view).
 * Pass `courseId` — hook re-fetches when it changes.
 */
export function useCourseStudents(courseId: string | null) {
  const [data, setData] = useState<{
    course: object;
    students: CourseStudentItem[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await teacherCoursesApi.getStudents(courseId);
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  return {
    course: data?.course ?? null,
    students: data?.students ?? [],
    loading,
    error,
    refetch: fetch_,
  };
}

/** All students across this teacher's courses (optionally filtered by courseId) */
export function useTeacherStudents(courseId?: string) {
  const fetcher = useCallback(
    () => teacherStudentsApi.list(courseId),
    [courseId]
  );
  const q = useQuery<TeacherStudent[]>(fetcher);
  return {
    ...q,
    students: q.data ?? [],
  };
}

/**
 * Attendance report for a course with optional date range.
 * Pass null courseId to skip the initial fetch.
 */
export function useTeacherReport(
  courseId: string | null,
  startDate?: string,
  endDate?: string
) {
  const fetcher = useCallback(() => {
    if (!courseId) return Promise.resolve([] as ReportRow[]);
    return teacherReportsApi.get(courseId, startDate, endDate);
  }, [courseId, startDate, endDate]);

  return useQuery<ReportRow[]>(fetcher);
}

/**
 * Attendance history for a course, grouped by date.
 */
export function useAttendanceHistory(courseId: string | null) {
  const fetcher = useCallback(() => {
    if (!courseId)
      return Promise.resolve({
        courseId: "",
        attendanceByDate: {},
        totalRecords: 0,
      } as AttendanceHistoryResponse);
    return teacherAttendanceApi.getHistory(courseId);
  }, [courseId]);

  return useQuery<AttendanceHistoryResponse>(fetcher);
}

// ---------------------------------------------------------------------------
// Mutation helpers (not hooks — call directly from event handlers)
// ---------------------------------------------------------------------------

/**
 * Import students from parsed CSV rows into a course.
 * Returns the ImportResult or throws.
 */
export async function importStudents(
  courseId: string,
  students: ImportStudent[]
): Promise<ImportResult> {
  return teacherCoursesApi.importStudents(courseId, students);
}

/**
 * Remove a student from a course.
 */
export async function removeStudentFromCourse(
  courseId: string,
  studentId: string
): Promise<void> {
  await teacherCoursesApi.removeStudent(courseId, studentId);
}

/**
 * Upload photos and train the face model for one student.
 */
export async function trainStudent(
  studentId: string,
  courseId: string,
  photos: File[]
) {
  return teacherAttendanceApi.trainStudent(studentId, courseId, photos);
}

/**
 * Trigger model training for all trained students in a course.
 */
export async function runTraining(courseId: string) {
  return teacherAttendanceApi.runTraining(courseId);
}

/**
 * Run face recognition on classroom frames.
 */
export async function recognizeFaces(
  courseId: string,
  frames: File[],
  batchId?: string,
  autoSubmit = false
) {
  return teacherAttendanceApi.recognize(courseId, frames, batchId, autoSubmit);
}

/**
 * Persist attendance records after reviewing recognition results.
 */
export async function submitAttendance(
  courseId: string,
  recognitionResults: { recognizedStudents: RecognizedStudent[] },
  date?: string
): Promise<SubmitAttendanceResponse> {
  return teacherAttendanceApi.submitAttendance(courseId, recognitionResults, date);
}

/**
 * Email login credentials to a batch of newly imported students.
 */
export async function sendCredentials(
  students: { name: string; email: string; dob: string }[]
) {
  return teacherCredentialsApi.send(students);
}