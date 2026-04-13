"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid,
} from "recharts";
import { AttendanceTrend, TeacherLoad, ProgramDistribution } from "@/lib/api";

export function AttendanceTrendChart({ data }: { data: AttendanceTrend[] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">
        Attendance Trend (Monthly)
      </h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis domain={[0, 100]} unit="%" />
            <Tooltip formatter={(v: number) => [`${v}%`, "Attendance Rate"]} />
            <Line type="monotone" dataKey="rate" stroke="#6366f1" strokeWidth={2} dot={false} name="Attendance %" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// FIX: backend sends teacher_name + course_count, not teacher + courses
export function TeacherLoadChart({ data }: { data: TeacherLoad[] }) {
  const chartData = data.map((t) => ({
    teacher: t.teacher_name,
    courses: t.course_count,
    students: t.student_count,
  }));
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Teacher Workload</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="teacher" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="courses" fill="#6366f1" name="Courses" />
            <Bar dataKey="students" fill="#10b981" name="Students" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-slate-500 mt-3">Courses and enrolled students per teacher.</p>
    </div>
  );
}

// FIX: backend sends program_name + student_count, not program + students
export function ProgramDistributionChart({ data }: { data: ProgramDistribution[] }) {
  const chartData = data.map((p) => ({
    program: p.program_name,
    students: p.student_count,
  }));
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Students per Program</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} />
            <YAxis dataKey="program" type="category" width={140} />
            <Tooltip />
            <Bar dataKey="students" fill="#8b5cf6" name="Students" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}