"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AnalyticsOverview, AttendanceTrend, Course, Department, Program,
  Student, Teacher, TeacherLoad, ProgramDistribution, AdminStats,
  analyticsApi, coursesApi, departmentsApi, programsApi,
  statsApi, studentsApi, teachersApi,
} from "@/lib/api";

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

  useEffect(() => { fetch_(); }, [fetch_]);

  return { data, loading, error, refetch: fetch_ };
}

export function useStats() {
  return useQuery<AdminStats>(statsApi.get);
}

export function useTeachers() {
  const q = useQuery(() => teachersApi.list().then((r) => r.teachers));
  return {
    ...q,
    approved: q.data?.filter((t) => !t.isPending) ?? [],
    pending: q.data?.filter((t) => t.isPending) ?? [],
  };
}

export function useDepartments() {
  return useQuery(() => departmentsApi.list().then((r) => r.departments));
}

export function usePrograms() {
  return useQuery(() => programsApi.list().then((r) => r.programs));
}

export function useCourses() {
  return useQuery(() => coursesApi.list().then((r) => r.courses));
}

export function useStudents() {
  const q = useQuery(() => studentsApi.list());
  return {
    loading: q.loading,
    error: q.error,
    refetch: q.refetch,
    students: q.data?.students ?? [],
    programs: q.data?.programs ?? [],
    active: q.data?.students.filter((s) => !s.graduated) ?? [],
    graduated: q.data?.students.filter((s) => s.graduated) ?? [],
  };
}

export function useAnalyticsOverview() {
  return useQuery<AnalyticsOverview>(analyticsApi.overview);
}

export function useAttendanceTrends() {
  return useQuery(() => analyticsApi.attendanceTrends().then((r) => r.trends));
}

export function useTeacherLoad() {
  return useQuery(() => analyticsApi.teacherLoad().then((r) => r.teachers));
}

export function useProgramDistribution() {
  return useQuery(() => analyticsApi.programDistribution().then((r) => r.programs));
}