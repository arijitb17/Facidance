/**
 * frontend/hooks/useStudent.ts
 *
 * React hook that wraps all Student API calls with loading / error state.
 * Import individual sub-hooks (useStudentStats, useStudentCourses, etc.)
 * or use the combined useStudent() for the dashboard.
 *
 * All data comes from the FastAPI student microservice via api_student.ts.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getMe,
  getStats,
  listCourses,
  getCourse,
  joinCourse,
  leaveCourse,
  getCourseAttendance,
  getAttendanceHistory,
  checkPhotos,
  updateProfile,
  uploadPhotos,
  type StudentProfile,
  type StudentStats,
  type CourseListItem,
  type CourseDetail,
  type CourseAttendanceSummary,
  type AttendanceHistoryResponse,
  type UpdateProfilePayload,
} from "@/lib/api_student";

// ---------------------------------------------------------------------------
// Generic async state
// ---------------------------------------------------------------------------

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[] = []
): AsyncState<T> & { refetch: () => void } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const isMounted = useRef(true);

  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fn();
      if (isMounted.current) setState({ data, loading: false, error: null });
    } catch (e: unknown) {
      if (isMounted.current)
        setState({
          data: null,
          loading: false,
          error: e instanceof Error ? e.message : "Unknown error",
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    isMounted.current = true;
    run();
    return () => {
      isMounted.current = false;
    };
  }, [run]);

  return { ...state, refetch: run };
}

// ---------------------------------------------------------------------------
// useStudentMe — authenticated profile
// ---------------------------------------------------------------------------

export function useStudentMe() {
  return useAsync<StudentProfile>(getMe, []);
}

// ---------------------------------------------------------------------------
// useStudentStats — dashboard stats
// ---------------------------------------------------------------------------

export function useStudentStats() {
  return useAsync<StudentStats>(getStats, []);
}

// ---------------------------------------------------------------------------
// useStudentCourses — enrolled courses list
// ---------------------------------------------------------------------------

export function useStudentCourses() {
  return useAsync<CourseListItem[]>(listCourses, []);
}

// ---------------------------------------------------------------------------
// useStudentCourse — single course detail
// ---------------------------------------------------------------------------

export function useStudentCourse(courseId: string | null) {
  return useAsync<CourseDetail>(
    () => {
      if (!courseId) return Promise.reject(new Error("No course ID"));
      return getCourse(courseId);
    },
    [courseId]
  );
}

// ---------------------------------------------------------------------------
// useStudentCourseAttendance — attendance for one course
// ---------------------------------------------------------------------------

export function useStudentCourseAttendance(courseId: string | null) {
  return useAsync<CourseAttendanceSummary>(
    () => {
      if (!courseId) return Promise.reject(new Error("No course ID"));
      return getCourseAttendance(courseId);
    },
    [courseId]
  );
}

// ---------------------------------------------------------------------------
// useAttendanceHistory — full history across all courses
// ---------------------------------------------------------------------------

export function useAttendanceHistory() {
  return useAsync<AttendanceHistoryResponse>(getAttendanceHistory, []);
}

// ---------------------------------------------------------------------------
// useCheckPhotos — has the student registered their face?
// ---------------------------------------------------------------------------

export function useCheckPhotos(studentId: string | null) {
  return useAsync<{ has_photos: boolean }>(
    () => {
      if (!studentId) return Promise.reject(new Error("No student ID"));
      return checkPhotos(studentId);
    },
    [studentId]
  );
}

// ---------------------------------------------------------------------------
// useJoinCourse — mutation hook
// ---------------------------------------------------------------------------

export function useJoinCourse() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const join = async (entryCode: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await joinCourse(entryCode);
      setSuccess(res.message);
      return res;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to join course";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { join, loading, error, success };
}

// ---------------------------------------------------------------------------
// useLeaveCourse — mutation hook
// ---------------------------------------------------------------------------

export function useLeaveCourse() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leave = async (courseId: string) => {
    setLoading(true);
    setError(null);
    try {
      return await leaveCourse(courseId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to leave course";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { leave, loading, error };
}

// ---------------------------------------------------------------------------
// useUpdateProfile — mutation hook
// ---------------------------------------------------------------------------

export function useUpdateProfile() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = async (payload: UpdateProfilePayload) => {
    setLoading(true);
    setError(null);
    try {
      return await updateProfile(payload);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to update profile";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { update, loading, error };
}

// ---------------------------------------------------------------------------
// useUploadPhotos — mutation hook
// ---------------------------------------------------------------------------

export type PhotoUploadStatus = "idle" | "uploading" | "success" | "error";

export function useUploadPhotos() {
  const [status, setStatus] = useState<PhotoUploadStatus>("idle");
  const [message, setMessage] = useState<string>("");

  const upload = async (
    studentId: string,
    photos: { front?: File; left?: File; right?: File }
  ) => {
    setStatus("uploading");
    setMessage("Uploading photos and processing face data...");
    try {
      const res = await uploadPhotos(studentId, photos);
      setStatus("success");
      setMessage(res.message || "Photos uploaded successfully!");
      return res;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setStatus("error");
      setMessage(`Error: ${msg}`);
      throw e;
    }
  };

  const reset = () => {
    setStatus("idle");
    setMessage("");
  };

  return { upload, reset, status, message };
}

// ---------------------------------------------------------------------------
// useStudent — combined hook for the dashboard page
// ---------------------------------------------------------------------------

export function useStudent() {
  const me = useStudentMe();
  const stats = useStudentStats();

  return {
    profile: me.data,
    stats: stats.data,
    loading: me.loading || stats.loading,
    error: me.error ?? stats.error,
    refetchProfile: me.refetch,
    refetchStats: stats.refetch,
  };
}