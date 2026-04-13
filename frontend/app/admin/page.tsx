"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
  AreaChart, Area,
} from "recharts";
import {
  Users, GraduationCap, Building2, BookOpen,
  BookMarked, BarChart3, TrendingUp, TrendingDown,
  UserCheck, AlertCircle, ChevronRight, RefreshCw,
  CheckCircle2,
} from "lucide-react";

// ─── API ─────────────────────────────────────────────────────────────────────

const BASE = process.env.NEXT_PUBLIC_ADMIN_API_URL ?? "http://localhost:8001";

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function fetchStats() {
  const res = await fetch(`${BASE}/admin/stats`, { headers: authHeaders() });
  if (!res.ok) throw new Error("stats");
  return res.json();
}
async function fetchAnalyticsOverview() {
  const res = await fetch(`${BASE}/admin/analytics/overview`, { headers: authHeaders() });
  if (!res.ok) throw new Error("analytics-overview");
  return res.json();
}
async function fetchAttendanceTrends() {
  const res = await fetch(`${BASE}/admin/analytics/attendance-trends`, { headers: authHeaders() });
  if (!res.ok) throw new Error("attendance-trends");
  return res.json();
}
async function fetchTeacherLoad() {
  const res = await fetch(`${BASE}/admin/analytics/teacher-load`, { headers: authHeaders() });
  if (!res.ok) throw new Error("teacher-load");
  return res.json();
}
async function fetchProgramDistribution() {
  const res = await fetch(`${BASE}/admin/analytics/program-distribution`, { headers: authHeaders() });
  if (!res.ok) throw new Error("program-distribution");
  return res.json();
}
async function fetchTeachers() {
  const res = await fetch(`${BASE}/admin/teachers`, { headers: authHeaders() });
  if (!res.ok) throw new Error("teachers");
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats { teachers: number; students: number; departments: number; programs: number; courses: number; }
interface AnalyticsOverview {
  total_users: number; total_teachers: number; total_students: number;
  active_students: number; graduated_students: number; total_departments: number;
  total_programs: number; total_courses: number; total_attendance_records: number;
  overall_attendance_rate: number;
}
interface TrendPoint { month: string; total: number; present: number; rate: number; }
interface TeacherLoadItem { teacher_id: string; teacher_name: string; department_name?: string; course_count: number; student_count: number; }
interface ProgramDistItem { program_id: string; program_name: string; department_name?: string; student_count: number; }

// ─── Design system — MATCHES teacher dashboard exactly ────────────────────────

const SPRING   = "cubic-bezier(.22,.68,0,1.2)";
const EASE_ALL = `all 0.25s ${SPRING}`;

const C = {
  primary:    "#003135",
  secondary:  "#024950",
  accent:     "#0FA4AF",
  light:      "#AFDDE5",
  bg:         "#f8fafc",
  white:      "#ffffff",
  text:       "#0f172a",
  textSoft:   "#334155",
  body:       "#475569",
  muted:      "#64748b",
  mutedLight: "#94a3b8",
  border:     "rgba(226,232,240,0.7)",
  borderHov:  "rgba(15,164,175,0.22)",
  success:    "#10b981",
  warning:    "#f59e0b",
  danger:     "#ef4444",
  info:       "#3b82f6",
};

// Exact same gradients as teacher dashboard
const ICON_GRAD   = `linear-gradient(135deg, ${C.primary} 0%, ${C.accent} 100%)`;
const CARD_GRAD   = "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)";
const ACTIVE_GRAD = "linear-gradient(135deg, #003135 0%, #024950 50%, #0FA4AF 100%)";

const SHADOW = {
  rest:   "0 2px 12px rgba(0,49,53,0.06)",
  hover:  "0 12px 36px rgba(0,49,53,0.12)",
  active: "0 16px 40px rgba(15,164,175,0.35)",
};

const CHART = { high: "#14b8a6", medium: "#f59e0b", low: "#ef4444" };

// ─── Reusable Components ──────────────────────────────────────────────────────

function Card({ children, style, hoverable, onClick }: {
  children: React.ReactNode; style?: React.CSSProperties;
  hoverable?: boolean; onClick?: () => void;
}) {
  const [hov, setHov] = useState(false);
  const isHov = hoverable && hov;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => hoverable && setHov(true)}
      onMouseLeave={() => hoverable && setHov(false)}
      style={{
        background: CARD_GRAD,
        border: `1px solid ${isHov ? C.borderHov : C.border}`,
        borderRadius: 18,
        boxShadow: isHov ? SHADOW.hover : SHADOW.rest,
        overflow: "hidden",
        transform: isHov ? "translateY(-5px) scale(1.01)" : "translateY(0) scale(1)",
        transition: EASE_ALL,
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div style={{ padding: "22px 26px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div>
        <p style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: "-0.03em", margin: 0 }}>{title}</p>
        {sub && <p style={{ fontSize: 12, color: C.body, marginTop: 3 }}>{sub}</p>}
      </div>
      {right}
    </div>
  );
}

function Btn({ children, onClick, primary, small, style }: {
  children: React.ReactNode; onClick?: () => void;
  primary?: boolean; small?: boolean; style?: React.CSSProperties;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: small ? "6px 13px" : "9px 18px",
        borderRadius: 11, fontSize: small ? 12 : 13, fontWeight: 600,
        cursor: "pointer", letterSpacing: "-0.01em",
        transform: hov ? "translateY(-2px) scale(1.01)" : "translateY(0) scale(1)",
        transition: EASE_ALL,
        ...(primary ? {
          background: ICON_GRAD, color: "#fff", border: "none",
          boxShadow: hov
            ? `${SHADOW.active}, inset 0 1px 0 rgba(255,255,255,0.18)`
            : `0 8px 24px rgba(15,164,175,0.35), inset 0 1px 0 rgba(255,255,255,0.15)`,
        } : {
          background: hov ? "#f0f9fa" : C.white,
          color: hov ? C.primary : C.textSoft,
          border: `1px solid ${hov ? C.borderHov : C.border}`,
          boxShadow: hov ? SHADOW.hover : SHADOW.rest,
        }),
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function SkeletonLine({ w, h = 16 }: { w: number | string; h?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 8,
      background: "linear-gradient(90deg, #f1f5f9 25%, #e8f0f5 50%, #f1f5f9 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.6s ease-in-out infinite",
    }} />
  );
}

// ─── Stat Card — identical structure to teacher StatCard ─────────────────────

function StatCard({ title, value, Icon, trend, trendLabel, loading }: {
  title: string; value: number | string; Icon: React.ElementType;
  trend?: "up" | "down" | "neutral"; trendLabel?: string; loading: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: CARD_GRAD,
        border: `1px solid ${hov ? C.borderHov : C.border}`,
        borderRadius: 18, padding: "22px 24px",
        boxShadow: hov ? SHADOW.hover : SHADOW.rest,
        transform: hov ? "translateY(-5px) scale(1.01)" : "translateY(0) scale(1)",
        transition: EASE_ALL, overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>
            {title}
          </p>
          {loading
            ? <SkeletonLine w={80} h={36} />
            : (
              <p style={{ fontSize: 34, fontWeight: 800, color: C.text, lineHeight: 1, marginTop: 10, letterSpacing: "-0.03em" }}>
                {typeof value === "number" ? value.toLocaleString() : value}
              </p>
            )
          }
          {trendLabel && !loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 10 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 20,
                background: trend === "up" ? "rgba(16,185,129,0.1)" : trend === "down" ? "rgba(249,115,22,0.1)" : "rgba(100,116,139,0.08)",
              }}>
                {trend === "up"   && <TrendingUp   size={11} color="#10b981" />}
                {trend === "down" && <TrendingDown size={11} color="#f97316" />}
                <span style={{ fontSize: 11, fontWeight: 700, color: trend === "up" ? "#10b981" : trend === "down" ? "#f97316" : C.muted }}>
                  {trendLabel}
                </span>
              </div>
            </div>
          )}
        </div>
        {/* Same teal icon box as teacher dashboard */}
        <div style={{
          height: 50, width: 50, borderRadius: 14, flexShrink: 0,
          background: ICON_GRAD,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: hov ? "0 8px 24px rgba(15,164,175,0.38)" : "0 6px 20px rgba(15,164,175,0.28)",
          transform: hov ? "scale(1.1) rotate(-3deg)" : "scale(1) rotate(0deg)",
          transition: EASE_ALL,
        }}>
          <Icon size={22} color="#fff" strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

// ─── Quick Action — same as teacher QuickActionCard ───────────────────────────

function QuickActionCard({ label, desc, Icon, isHovered, onEnter, onLeave, onClick }: {
  label: string; desc: string; Icon: React.ElementType; href: string;
  isHovered: boolean; onEnter: () => void; onLeave: () => void; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick} onMouseEnter={onEnter} onMouseLeave={onLeave}
      style={{
        display: "flex", flexDirection: "column", alignItems: "flex-start",
        gap: 16, padding: "22px 20px", borderRadius: 16,
        cursor: "pointer", textAlign: "left", width: "100%",
        transform: isHovered ? "translateY(-5px) scale(1.02)" : "translateY(0) scale(1)",
        transition: EASE_ALL,
        background: isHovered ? ICON_GRAD : CARD_GRAD,
        border: `1px solid ${isHovered ? "transparent" : C.border}`,
        boxShadow: isHovered ? SHADOW.active : SHADOW.rest,
      }}
    >
      <div style={{
        height: 42, width: 42, borderRadius: 12,
        background: isHovered ? "rgba(255,255,255,0.18)" : "rgba(175,221,229,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: isHovered ? "0 4px 14px rgba(0,0,0,0.12)" : "none",
        transform: isHovered ? "scale(1.1) rotate(-4deg)" : "scale(1) rotate(0deg)",
        transition: EASE_ALL,
      }}>
        <Icon size={18} color={isHovered ? "#fff" : C.secondary} strokeWidth={2} />
      </div>
      <div>
        <p style={{ fontSize: 13.5, fontWeight: 700, color: isHovered ? "#fff" : C.text, letterSpacing: "-0.02em", transition: EASE_ALL, margin: 0 }}>{label}</p>
        <p style={{ fontSize: 12, marginTop: 3, color: isHovered ? "rgba(255,255,255,0.72)" : C.body, transition: EASE_ALL }}>{desc}</p>
      </div>
    </button>
  );
}

// ─── Teacher Load Row ─────────────────────────────────────────────────────────

function TeacherLoadRow({ item, rank, isLast }: { item: TeacherLoadItem; rank: number; isLast: boolean }) {
  const [hov, setHov] = useState(false);

  return (
    <>
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 10px",
          borderRadius: 12,

          background: rank === 1
            ? "rgba(15,164,175,0.08)"
            : hov
              ? "rgba(15,164,175,0.04)"
              : "transparent",

          transform: hov ? "translateX(4px)" : "translateX(0)",
          transition: EASE_ALL,
        }}
      >
        {/* Rank */}
        <div style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          flexShrink: 0,
          background: ICON_GRAD,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 800,
          boxShadow: "0 4px 12px rgba(15,164,175,0.35)",
        }}>
          {rank}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: 13,
            fontWeight: 700,
            color: C.text,
            margin: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }}>
            {item.teacher_name}
          </p>

          <p style={{
            fontSize: 11,
            color: C.body,
            margin: "2px 0 0"
          }}>
            {item.department_name ?? "No dept."}
          </p>
        </div>

        {/* Stats */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{
            fontSize: 13,
            fontWeight: 800,
            color: C.text,
            margin: 0
          }}>
            {item.course_count}
          </p>

          <p style={{
            fontSize: 10.5,
            color: C.muted,
            margin: "2px 0 0"
          }}>
            {item.student_count} students
          </p>
        </div>
      </div>

      {!isLast && (
        <div style={{
          height: 1,
          background: "#f1f5f9",
          margin: "0 8px"
        }} />
      )}
    </>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const router = useRouter();
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

  const { data: stats,    isLoading: sL,  isError: sE, refetch } = useQuery<Stats>({ queryKey: ["admin-stats"],                queryFn: fetchStats,              staleTime: 120_000 });
  const { data: overview, isLoading: oL  } = useQuery<AnalyticsOverview>({            queryKey: ["admin-analytics-overview"],  queryFn: fetchAnalyticsOverview,  staleTime: 120_000 });
  const { data: trendsData, isLoading: tL } = useQuery<{ trends: TrendPoint[] }>({   queryKey: ["admin-attendance-trends"],   queryFn: fetchAttendanceTrends,   staleTime: 300_000 });
  const { data: teacherLoadData, isLoading: tlL } = useQuery<{ teachers: TeacherLoadItem[] }>({ queryKey: ["admin-teacher-load"], queryFn: fetchTeacherLoad, staleTime: 300_000 });
  const { data: programData, isLoading: pL } = useQuery<{ programs: ProgramDistItem[] }>({ queryKey: ["admin-program-distribution"], queryFn: fetchProgramDistribution, staleTime: 300_000 });
  const { data: teachersRaw } = useQuery({ queryKey: ["admin-teachers-list"], queryFn: fetchTeachers, staleTime: 120_000 });

  const safe: Stats = stats ?? { teachers: 0, students: 0, departments: 0, programs: 0, courses: 0 };
  const ov: AnalyticsOverview = overview ?? {
    total_users: 0, total_teachers: 0, total_students: 0, active_students: 0,
    graduated_students: 0, total_departments: 0, total_programs: 0,
    total_courses: 0, total_attendance_records: 0, overall_attendance_rate: 0,
  };

  const trends   = trendsData?.trends ?? [];
  const teachers = teacherLoadData?.teachers ?? [];
  const programs = programData?.programs ?? [];
  const pendingTeachers = (teachersRaw?.teachers ?? []).filter((t: { isPending: boolean }) => t.isPending).length;

  const studentPieData = [
    { name: "Active",    value: ov.active_students    },
    { name: "Graduated", value: ov.graduated_students },
    { name: "Other",     value: Math.max(0, ov.total_students - ov.active_students - ov.graduated_students) },
  ].filter((d) => d.value > 0);

  // Pie uses same teal palette
  const PIE_COLORS = [C.accent, C.primary, C.mutedLight];

  const topPrograms = [...programs].sort((a, b) => b.student_count - a.student_count).slice(0, 5);
  const maxProgramStudents = topPrograms[0]?.student_count ?? 1;

  const formatMonth = (month: string) => {
    const [y, m] = month.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleString("default", { month: "short", year: "2-digit" });
  };

  const statCards = [
    { title: "TOTAL TEACHERS",   value: safe.teachers,    Icon: Users,         trend: "up" as const,      trendLabel: pendingTeachers > 0 ? `${pendingTeachers} pending` : "approved" },
    { title: "TOTAL STUDENTS",   value: safe.students,    Icon: GraduationCap, trend: "up" as const,      trendLabel: `${ov.active_students} active` },
    { title: "DEPARTMENTS",      value: safe.departments, Icon: Building2,     trend: "neutral" as const, trendLabel: `${safe.programs} programs` },
    { title: "TOTAL COURSES",    value: safe.courses,     Icon: BookOpen,      trend: "up" as const,      trendLabel: `${ov.total_attendance_records.toLocaleString()} records` },
    { title: "ATTENDANCE RATE",  value: `${ov.overall_attendance_rate.toFixed(1)}%`, Icon: BarChart3, trend: ov.overall_attendance_rate >= 75 ? "up" as const : "down" as const, trendLabel: ov.overall_attendance_rate >= 75 ? "On track" : "Needs attention" },
    { title: "GRADUATED",        value: ov.graduated_students, Icon: UserCheck, trend: "up" as const, trendLabel: "alumni" },
  ];

  const quickActions = [
    { label: "Manage Teachers",  desc: "Approve & review",       Icon: Users,         href: "/admin/teachers"    },
    { label: "Departments",      desc: "Create & organize",      Icon: Building2,     href: "/admin/departments" },
    { label: "Programs",         desc: "Academic programs",      Icon: BookMarked,    href: "/admin/programs"    },
    { label: "Courses",          desc: "Configure courses",      Icon: BookOpen,      href: "/admin/courses"     },
    { label: "Students",         desc: "View & manage students", Icon: GraduationCap, href: "/admin/students"    },
    { label: "Reports",          desc: "Analytics & export",     Icon: BarChart3,     href: "/admin/reports"     },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "4px 0 8px" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, letterSpacing: "-0.03em", lineHeight: 1.1, margin: 0 }}>
            Admin Dashboard 🛡️
          </h1>
          <p style={{ fontSize: 14, color: C.body, marginTop: 6, lineHeight: 1.5 }}>
            Institution-wide overview — teachers, students, departments &amp; analytics.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn onClick={() => refetch()}><RefreshCw size={13} /> Refresh</Btn>
          <Btn primary onClick={() => router.push("/admin/teachers")}>
            <UserCheck size={14} />
            {pendingTeachers > 0 ? `${pendingTeachers} Pending Approval` : "Manage Teachers"}
          </Btn>
        </div>
      </div>

      {/* Error banner */}
      {sE && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13, fontWeight: 500 }}>
          <AlertCircle size={15} /> Could not load stats — check your backend connection.
        </div>
      )}

      {/* Pending teachers alert — teal-style like at-risk in teacher dash */}
      {pendingTeachers > 0 && (
        <div
          onClick={() => router.push("/admin/teachers")}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 20px", borderRadius: 14, cursor: "pointer",
            background: "linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(251,191,36,0.04) 100%)",
            border: "1px solid rgba(245,158,11,0.22)",
            boxShadow: "0 2px 12px rgba(245,158,11,0.06)", transition: EASE_ALL,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(245,158,11,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <UserCheck size={18} color="#f59e0b" />
            </div>
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 700, color: "#92400e", margin: 0 }}>
                {pendingTeachers} teacher{pendingTeachers !== 1 ? "s" : ""} pending approval
              </p>
              <p style={{ fontSize: 12, color: "#b45309", margin: "2px 0 0" }}>
                Review and approve new teacher registrations
              </p>
            </div>
          </div>
          <ChevronRight size={18} color="#f59e0b" />
        </div>
      )}

      {/* ── Stat Cards — 3 columns, 2 rows (same style as teacher 4-col) ── */}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(3, 1fr)" }} className="stat-grid">
        {statCards.map(({ title, value, Icon, trend, trendLabel }) => (
          <StatCard key={title} title={title} value={value} Icon={Icon} trend={trend} trendLabel={trendLabel} loading={sL || oL} />
        ))}
      </div>

      {/* ── Attendance Trend Area Chart + Student Pie ── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)", gap: 20, alignItems: "stretch" }} className="chart-grid">

        {/* Area Chart */}
        <Card style={{ height: 340, display: "flex", flexDirection: "column" }}>
          <CardHeader
            title="Attendance Trends"
            sub="Monthly present vs total over the last 12 months"
            right={
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.body, fontWeight: 500 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.primary, display: "inline-block" }} /> Present
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.body, fontWeight: 500 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#e2e8f0", display: "inline-block" }} /> Total
                </span>
              </div>
            }
          />
          <div style={{ padding: "16px 8px 24px", flex: 1 }}>
            {tL ? (
              <div style={{ height: 248, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <SkeletonLine w="90%" h={200} />
              </div>
            ) : trends.length === 0 ? (
              <div style={{ height: 248, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: "linear-gradient(135deg, rgba(175,221,229,0.3) 0%, rgba(15,164,175,0.1) 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <BarChart3 size={20} color={C.accent} />
                </div>
                <p style={{ fontSize: 13, color: C.body }}>No attendance data yet.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={248}>
                <AreaChart data={trends.map((t) => ({ ...t, month: formatMonth(t.month), rate: Math.round(t.rate) }))}>
                  <defs>
                    <linearGradient id="adminPresentGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.primary} stopOpacity={0.14} />
                      <stop offset="95%" stopColor={C.primary} stopOpacity={0.01} />
                    </linearGradient>
                    <linearGradient id="adminTotalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#94a3b8" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(0,49,53,0.04)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11.5, fill: "#94a3b8", fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11.5, fill: "#94a3b8", fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "rgba(255,255,255,0.96)", border: "1px solid rgba(15,164,175,0.12)", borderRadius: 14, fontSize: 12, backdropFilter: "blur(12px)", boxShadow: "0 20px 40px rgba(0,49,53,0.18)" }} cursor={{ fill: "rgba(15,164,175,0.06)" }} />
                  <Area type="monotone" dataKey="present" name="Present" stroke={C.primary} strokeWidth={2.5} fill="url(#adminPresentGrad)" dot={{ fill: C.primary, r: 3 }} activeDot={{ r: 5, fill: C.accent }} />
                  <Area type="monotone" dataKey="total"   name="Total"   stroke="#94a3b8"  strokeWidth={1.5} fill="url(#adminTotalGrad)"   strokeDasharray="4 2" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Student Status Pie */}
        <Card style={{ height: 340, display: "flex", flexDirection: "column" }}>
          <CardHeader title="Student Status" sub="Active vs graduated breakdown" />
          <div style={{ padding: "8px 16px 16px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {oL ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", paddingTop: 20 }}>
                {[1, 2, 3].map((i) => <SkeletonLine key={i} w="80%" h={24} />)}
              </div>
            ) : ov.total_students === 0 ? (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, textAlign: "center", padding: "20px 0" }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CheckCircle2 size={22} color={C.success} />
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>No students yet</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Pie
                      data={studentPieData} cx="50%" cy="50%"
                      innerRadius={58} outerRadius={82} paddingAngle={3}
                      dataKey="value" animationDuration={800}
                    >
                      {studentPieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => (typeof v === "number" ? v.toLocaleString() : v)} contentStyle={{ background: "rgba(255,255,255,0.96)", border: "1px solid rgba(15,164,175,0.12)", borderRadius: 12, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 12px" }}>
                  {studentPieData.map((d, i) => (
                    <div key={d.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                        <span style={{ fontSize: 12.5, color: C.body, fontWeight: 500 }}>{d.name}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{d.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* ── Teacher Load + Program Distribution ── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 20 }} className="mid-grid">

        {/* Teacher Load */}
        <Card style={{ height: 380, display: "flex", flexDirection: "column" }}>
          <CardHeader
            title="Teacher Workload"
            sub="Courses and students per teacher"
            right={<Btn small onClick={() => router.push("/admin/teachers")}>View all <ChevronRight size={12} /></Btn>}
          />
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px 16px" }}>
            {tlL ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[1, 2, 3, 4, 5].map((i) => <SkeletonLine key={i} w="100%" h={52} />)}
              </div>
            ) : teachers.length === 0 ? (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <Users size={28} color={C.mutedLight} />
                <p style={{ fontSize: 13, color: C.body }}>No teacher data available.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {teachers.slice(0, 8).map((t, i) => (
                  <TeacherLoadRow key={t.teacher_id} item={t} rank={i + 1} isLast={i === Math.min(7, teachers.length - 1)} />
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Program Distribution */}
        <Card style={{ height: 380, display: "flex", flexDirection: "column" }}>
          <CardHeader
            title="Program Distribution"
            sub="Students enrolled per program (top 5)"
            right={<Btn small onClick={() => router.push("/admin/programs")}>View all <ChevronRight size={12} /></Btn>}
          />
          <div style={{
  padding: "14px 18px 16px",
  flex: 1,
  overflowY: "auto",   
}}>
            {pL ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[1, 2, 3, 4, 5].map((i) => <SkeletonLine key={i} w="100%" h={36} />)}
              </div>
            ) : topPrograms.length === 0 ? (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <BookMarked size={28} color={C.mutedLight} />
                <p style={{ fontSize: 13, color: C.body }}>No programs yet.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {topPrograms.map((p, i) => {
                  const pct = Math.round((p.student_count / maxProgramStudents) * 100);
                  // Teal-family gradients
                  const BAR_COLORS = [
  "#0FA4AF", // teal (brand)
  "#6366f1", // indigo
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
];
                  return (
                    <div key={p.program_id}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                        <div>
                          <p style={{ fontSize: 12.5, fontWeight: 700, color: C.text, margin: 0, maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {p.program_name}
                          </p>
                          <p style={{ fontSize: 10.5, color: C.muted, margin: "1px 0 0" }}>{p.department_name ?? "—"}</p>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{p.student_count}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 6, background: "#e2e8f0", overflow: "hidden" }}>
                        <div style={{
  width: `${pct}%`,
  height: "100%",
  background: BAR_COLORS[i % BAR_COLORS.length],
  borderRadius: 6,
  transition: "width 0.8s cubic-bezier(.22,.68,0,1.2)",
}} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ── Monthly Rate % Bar Chart — color-coded like teacher trend chart ── */}
      {trends.length > 0 && (
        <Card style={{ height: 320, display: "flex", flexDirection: "column" }}>
          <CardHeader
            title="Monthly Attendance Rate %"
            sub="Color-coded: ≥75% high · ≥50% medium · <50% low"
            right={
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {[{ label: "≥75% (High)", color: CHART.high }, { label: "≥50% (Mid)", color: CHART.medium }, { label: "<50% (Low)", color: CHART.low }].map((l) => (
                  <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.body, fontWeight: 500 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: l.color, display: "inline-block" }} />{l.label}
                  </span>
                ))}
              </div>
            }
          />
          <div style={{ padding: "12px 8px 20px", flex: 1 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trends.map((t) => ({ ...t, month: formatMonth(t.month), rate: Math.round(t.rate) }))} barCategoryGap="35%">
                <CartesianGrid stroke="rgba(0,49,53,0.04)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11.5, fill: "#94a3b8", fontWeight: 500 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11.5, fill: "#94a3b8", fontWeight: 500 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "rgba(255,255,255,0.96)", border: "1px solid rgba(15,164,175,0.12)", borderRadius: 14, fontSize: 12, backdropFilter: "blur(12px)", boxShadow: "0 20px 40px rgba(0,49,53,0.18)" }} cursor={{ fill: "rgba(15,164,175,0.06)" }} />
                <Bar dataKey="rate" name="Rate %" radius={[8, 8, 0, 0]} maxBarSize={48} animationDuration={900}>
                  {trends.map((t, i) => (
                    <Cell key={i} fill={t.rate >= 75 ? CHART.high : t.rate >= 50 ? CHART.medium : CHART.low} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* ── Quick Actions ── */}
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(6, 1fr)" }} className="qa-grid">
        {quickActions.map(({ label, desc, Icon, href }) => (
          <QuickActionCard
            key={label} label={label} desc={desc} Icon={Icon} href={href}
            isHovered={hoveredAction === label}
            onEnter={() => setHoveredAction(label)}
            onLeave={() => setHoveredAction(null)}
            onClick={() => router.push(href)}
          />
        ))}
      </div>

      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (max-width: 1280px) {
          .stat-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .qa-grid   { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (max-width: 1024px) {
          .stat-grid   { grid-template-columns: repeat(2, 1fr) !important; }
          .chart-grid  { grid-template-columns: 1fr !important; }
          .mid-grid    { grid-template-columns: 1fr !important; }
          .qa-grid     { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (max-width: 640px) {
          .stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .qa-grid   { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 400px) {
          .stat-grid { grid-template-columns: 1fr !important; }
          .qa-grid   { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}