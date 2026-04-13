"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  BookOpen, Users, ClipboardList, CheckCircle2,
  TrendingUp, TrendingDown, Scan, Download,
  ArrowUpRight, Clock, UserCheck, BarChart3, AlertCircle,
  AlertTriangle, Mail,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

// ─── API ─────────────────────────────────────────────────────────────────────

const BASE = process.env.NEXT_PUBLIC_TEACHER_API_URL ?? "http://localhost:8002";
const CHART = {
  high:   "#14b8a6",
  medium: "#f59e0b",
  low:    "#ef4444",
};

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function fetchStats() {
  const res = await fetch(`${BASE}/teacher/stats`, { headers: authHeaders() });
  if (!res.ok) throw new Error("stats");
  return res.json() as Promise<Stats>;
}

async function fetchCourses() {
  const res = await fetch(`${BASE}/teacher/courses`, { headers: authHeaders() });
  if (!res.ok) throw new Error("courses");
  const d = await res.json();
  return (d.courses ?? []) as CourseRow[];
}

async function fetchHistory(courseId: string) {
  const res = await fetch(`${BASE}/teacher/attendance/history?course_id=${courseId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("history");
  return res.json();
}

async function fetchAtRisk() {
  const res = await fetch(`${BASE}/teacher/students/at-risk`, { headers: authHeaders() });
  if (!res.ok) throw new Error("at-risk");
  return res.json() as Promise<AtRiskStudent[]>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  courses: number;
  total_students: number;
  total_semesters: number;
  total_attendance: number;
}

interface CourseRow {
  id: string;
  name: string;
  semester: string;
  program: string;
  department: string;
  student_count: number;
  session_count: number;
  entry_code: string;
}

interface AtRiskStudent {
  student_id: string;
  student_name: string;
  student_email: string;
  course_id: string;
  course_name: string;
  attended: number;
  total: number;
  attendance_rate: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function buildTrend(attendanceByDate: Record<string, { status: boolean }[]>) {
  const map: Record<string, { present: number; absent: number }> = {};
  Object.entries(attendanceByDate).forEach(([dateKey, records]) => {
    const m = MONTH_NAMES[new Date(dateKey).getMonth()];
    if (!map[m]) map[m] = { present: 0, absent: 0 };
    records.forEach((r) => { r.status ? map[m].present++ : map[m].absent++; });
  });
  return Object.entries(map).map(([month, v]) => ({ month, ...v }));
}

// ─── Design system ────────────────────────────────────────────────────────────

const SPRING   = "cubic-bezier(.22,.68,0,1.2)";
const EASE_ALL = `all 0.25s ${SPRING}`;

const SHADOW = {
  rest:   "0 2px 12px rgba(0,49,53,0.06)",
  hover:  "0 12px 36px rgba(0,49,53,0.12)",
  active: "0 16px 40px rgba(15,164,175,0.35)",
};

const C = {
  primary:    "#003135",
  secondary:  "#024950",
  accent:     "#0FA4AF",
  warm:       "#964734",
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
  cardBg:     "#ffffff",
};

const ICON_GRAD = `linear-gradient(135deg, ${C.primary} 0%, ${C.accent} 100%)`;
const CARD_GRAD = "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)";
const CHART_CARD_HEIGHT = 340;
const BOTTOM_CARD_HEIGHT = 320;
// ─── Reusable components ──────────────────────────────────────────────────────

function Card({
  children, style, hoverable, onClick,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  hoverable?: boolean;
  onClick?: () => void;
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
        <p style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: "-0.03em" }}>{title}</p>
        {sub && <p style={{ fontSize: 12, color: C.body, marginTop: 3 }}>{sub}</p>}
      </div>
      {right}
    </div>
  );
}

function Btn({ children, onClick, primary, small, style }: {
  children: React.ReactNode;
  onClick?: () => void;
  primary?: boolean;
  small?: boolean;
  style?: React.CSSProperties;
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ title, value, Icon, trend, trendLabel, loading }: {
  title: string; value: number; Icon: React.ElementType;
  trend?: "up" | "down"; trendLabel?: string; loading: boolean;
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
          <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            {title}
          </p>
          {loading ? <SkeletonLine w={80} h={36} /> : (
            <p style={{ fontSize: 34, fontWeight: 800, color: C.text, lineHeight: 1, marginTop: 10, letterSpacing: "-0.03em" }}>
              {value.toLocaleString()}
            </p>
          )}
          {trendLabel && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 10 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "3px 8px", borderRadius: 20,
                background: trend === "up" ? "rgba(16,185,129,0.1)" : "rgba(249,115,22,0.1)",
              }}>
                {trend === "up"
                  ? <TrendingUp  size={11} color="#10b981" />
                  : <TrendingDown size={11} color="#f97316" />}
                <span style={{ fontSize: 11, fontWeight: 700, color: trend === "up" ? "#10b981" : "#f97316" }}>
                  {trendLabel}
                </span>
              </div>
            </div>
          )}
        </div>
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

function AtRiskRow({ student, isLast }: { student: AtRiskStudent; isLast: boolean }) {
  const [hov, setHov] = useState(false);
  const rate      = student.attendance_rate;
  const rateColor = rate < 50 ? "#ef4444" : "#f59e0b";
  const rateBg    = rate < 50 ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)";

  return (
    <>
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "9px 8px", borderRadius: 10,
          background: hov ? "rgba(15,164,175,0.03)" : "transparent",
          transform: hov ? "translateX(3px)" : "translateX(0)",
          transition: EASE_ALL,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, color: C.text, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {student.student_name}
          </p>
          <p style={{ fontSize: 10.5, color: C.body, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {student.course_name}
          </p>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, flexShrink: 0 }}>
          {student.attended}/{student.total}
        </span>
        <div style={{ flexShrink: 0, padding: "3px 9px", borderRadius: 20, background: rateBg, border: `1px solid ${rateColor}22`, display: "flex", alignItems: "center", gap: 4 }}>
          <AlertTriangle size={10} color={rateColor} />
          <span style={{ fontSize: 11, fontWeight: 800, color: rateColor }}>{rate.toFixed(0)}%</span>
        </div>
        <a
          href={`mailto:${student.student_email}`}
          onClick={(e) => e.stopPropagation()}
          style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, background: hov ? "rgba(15,164,175,0.1)" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", transition: EASE_ALL, textDecoration: "none" }}
        >
          <Mail size={12} color={hov ? C.accent : C.muted} />
        </a>
      </div>
      {!isLast && <div style={{ height: 1, background: "#f1f5f9", margin: "0 8px" }} />}
    </>
  );
}

function CourseItem({ course, onClick }: { course: CourseRow; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  const rate =
    course.session_count > 0 && course.student_count > 0
      ? Math.min(100, Math.round((course.session_count / (course.session_count + 1)) * 100))
      : 0;
  const getColor = (pct: number) => {
    if (pct >= 75) return ["#14b8a6", "#0ea5a4"];
    if (pct >= 50) return ["#f59e0b", "#d97706"];
    return ["#ef4444", "#dc2626"];
  };
  const [c1, c2] = getColor(rate);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "16px 18px", borderRadius: 14, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18,
        background: hov ? "rgba(15,164,175,0.04)" : "transparent",
        boxShadow: hov ? "0 6px 20px rgba(0,49,53,0.08)" : "none",
        transform: hov ? "translateY(-2px)" : "translateY(0)",
        transition: "all 0.25s ease",
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{course.name}</p>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: "rgba(20,184,166,0.12)", color: "#0ea5a4" }}>Active</span>
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ height: 6, borderRadius: 6, background: "#e2e8f0", overflow: "hidden", maxWidth: 220 }}>
            <div style={{ width: `${rate}%`, height: "100%", background: `linear-gradient(90deg, ${c1}, ${c2})`, borderRadius: 6, boxShadow: `0 0 10px ${c1}55`, transition: "all 0.6s ease" }} />
          </div>
          <p style={{ fontSize: 11, marginTop: 4, color: "#64748b", fontWeight: 600 }}>{rate}% attendance</p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 24 }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{course.student_count}</p>
          <p style={{ fontSize: 10, color: "#64748b" }}>Students</p>
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{course.session_count}</p>
          <p style={{ fontSize: 10, color: "#64748b" }}>Sessions</p>
        </div>
      </div>
    </div>
  );
}

function ActivityItem({ course, action, time, IconComponent, bg, color, isLast }: {
  course: string; action: string; time: string;
  IconComponent: React.ElementType; bg: string; color: string; isLast: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <>
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: "flex", gap: 12, alignItems: "flex-start",
          padding: "11px 8px", borderRadius: 10,
          background: hov ? "#f8fafc" : "transparent",
          transform: hov ? "translateX(3px)" : "translateX(0)",
          transition: EASE_ALL,
        }}
      >
        <div style={{ height: 36, width: 36, borderRadius: 10, flexShrink: 0, background: bg, border: "1px solid rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "center", transform: hov ? "scale(1.08)" : "scale(1)", boxShadow: hov ? "0 4px 12px rgba(0,0,0,0.08)" : "none", transition: EASE_ALL }}>
          <IconComponent size={15} color={color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, color: C.text, lineHeight: 1.3, letterSpacing: "-0.01em" }}>{course}</p>
          <p style={{ fontSize: 11.5, color: C.body, marginTop: 2, lineHeight: 1.5 }}>{action}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
            <Clock size={10} color={C.mutedLight} />
            <span style={{ fontSize: 10.5, color: C.mutedLight, fontWeight: 500 }}>{time}</span>
          </div>
        </div>
      </div>
      {!isLast && <div style={{ height: 1, background: "#f1f5f9", margin: "0 8px" }} />}
    </>
  );
}

function QuickActionCard({ label, desc, Icon, isHovered, onEnter, onLeave, onClick }: {
  label: string; desc: string; Icon: React.ElementType; href: string;
  isHovered: boolean; onEnter: () => void; onLeave: () => void; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        display: "flex", flexDirection: "column", alignItems: "flex-start",
        gap: 16, padding: "22px 20px", borderRadius: 16,
        cursor: "pointer", textAlign: "left",
        transform: isHovered ? "translateY(-5px) scale(1.02)" : "translateY(0) scale(1)",
        transition: EASE_ALL,
        background: isHovered ? ICON_GRAD : CARD_GRAD,
        border: `1px solid ${isHovered ? "transparent" : C.border}`,
        boxShadow: isHovered ? SHADOW.active : SHADOW.rest,
        width: "100%",
      }}
    >
      <div style={{ height: 42, width: 42, borderRadius: 12, background: isHovered ? "rgba(255,255,255,0.18)" : "rgba(175,221,229,0.4)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: isHovered ? "0 4px 14px rgba(0,0,0,0.12)" : "none", transform: isHovered ? "scale(1.1) rotate(-4deg)" : "scale(1) rotate(0deg)", transition: EASE_ALL }}>
        <Icon size={18} color={isHovered ? "#fff" : C.secondary} strokeWidth={2} />
      </div>
      <div>
        <p style={{ fontSize: 13.5, fontWeight: 700, color: isHovered ? "#fff" : C.text, letterSpacing: "-0.02em", transition: EASE_ALL }}>{label}</p>
        <p style={{ fontSize: 12, marginTop: 3, color: isHovered ? "rgba(255,255,255,0.72)" : C.body, transition: EASE_ALL }}>{desc}</p>
      </div>
    </button>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function TeacherDashboard() {
  const router = useRouter();
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

  const { data: stats, isLoading: sL, isError: sE } = useQuery<Stats>({
    queryKey: ["teacher-stats"], queryFn: fetchStats, staleTime: 120_000,
  });
  const { data: courses = [], isLoading: cL } = useQuery<CourseRow[]>({
    queryKey: ["teacher-courses"], queryFn: fetchCourses, staleTime: 120_000,
  });
  const firstId = courses[0]?.id;
  const { data: historyData } = useQuery({
    queryKey: ["attendance-history", firstId],
    queryFn: () => fetchHistory(firstId!),
    enabled: !!firstId, staleTime: 300_000,
  });
  const { data: atRisk = [], isLoading: arL } = useQuery<AtRiskStudent[]>({
    queryKey: ["at-risk"], queryFn: fetchAtRisk, staleTime: 120_000,
  });

  const trendData = historyData?.attendanceByDate ? buildTrend(historyData.attendanceByDate) : [];
  const safe: Stats = stats ?? { courses: 0, total_students: 0, total_semesters: 0, total_attendance: 0 };

  const statCards = [
    { title: "MY COURSES",       value: safe.courses,          Icon: BookOpen,      trend: "up" as const,  trendLabel: `${safe.total_semesters} semester${safe.total_semesters !== 1 ? "s" : ""}` },
    { title: "TOTAL STUDENTS",   value: safe.total_students,   Icon: Users,         trend: "up" as const,  trendLabel: "enrolled" },
    { title: "ACTIVE SEMESTERS", value: safe.total_semesters,  Icon: ClipboardList, trend: undefined,      trendLabel: undefined },
    { title: "TOTAL ATTENDANCE", value: safe.total_attendance, Icon: CheckCircle2,  trend: atRisk.length === 0 ? "up" as const : "down" as const, trendLabel: `${atRisk.length} at risk` },
  ];

  const activity = courses.slice(0, 5).map((c, i) => ({
    id: c.id, course: c.name,
    action: `${c.session_count} sessions · ${c.student_count} students enrolled`,
    time: i === 0 ? "Today" : i === 1 ? "Yesterday" : `${i + 1}d ago`,
    type: (["attendance", "import", "report", "attendance", "import"] as const)[i],
  }));

  const activityIcons = {
    attendance: { Icon: UserCheck, bg: "rgba(175,221,229,0.25)", color: C.secondary },
    import:     { Icon: Download,  bg: "#fff7ed",                color: C.warm      },
    report:     { Icon: BarChart3, bg: "#f5f3ff",                color: "#7c3aed"   },
  };

  const quickActions = [
    { label: "Take Attendance", desc: "Start a new batch", Icon: Scan,     href: "/teacher/attendance" },
    { label: "My Courses",      desc: "Browse & manage",  Icon: BookOpen,  href: "/teacher/courses"    },
    { label: "Students",        desc: "Import & manage",  Icon: Users,     href: "/teacher/students"   },
    { label: "Reports",         desc: "Export & analyse", Icon: BarChart3, href: "/teacher/reports"    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "4px 0 8px" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, letterSpacing: "-0.03em", lineHeight: 1.1 }}>Welcome back 👋</h1>
          <p style={{ fontSize: 14, color: C.body, marginTop: 6, lineHeight: 1.5 }}>Here's what's happening across your courses today.</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn onClick={() => router.push("/teacher/reports")}><Download size={14} /> Export Report</Btn>
          <Btn primary onClick={() => router.push("/teacher/attendance")}><Scan size={14} /> New Attendance</Btn>
        </div>
      </div>

      {sE && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13, fontWeight: 500 }}>
          <AlertCircle size={15} /> Could not load stats — check your backend.
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(4, 1fr)" }} className="stat-grid">
        {statCards.map(({ title, value, Icon, trend, trendLabel }) => (
          <StatCard key={title} title={title} value={value} Icon={Icon} trend={trend} trendLabel={trendLabel} loading={sL} />
        ))}
      </div>

      {/* ── Bar Chart + At-Risk ── */}
      <div
        className="chart-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)",
          gap: 20,
          alignItems: "stretch",
        }}
      >
        {/* Bar Chart */}
        <Card style={{ height: CHART_CARD_HEIGHT, display: "flex", flexDirection: "column" }}>
          <CardHeader
            title="Attendance Trend"
            sub="Monthly present vs absent breakdown"
            right={
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                {[
                  { label: "≥75% (High)", color: CHART.high   },
                  { label: "≥50% (Mid)",  color: CHART.medium },
                  { label: "<50% (Low)",  color: CHART.low    },
                  { label: "Absent",      color: "#e2e8f0"    },
                ].map((l) => (
                  <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.body, fontWeight: 500 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: l.color, display: "inline-block" }} />
                    {l.label}
                  </span>
                ))}
              </div>
            }
          />
          <div style={{ padding: "16px 8px 24px" }}>
            {trendData.length === 0 ? (
              <div style={{ height: 248, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: "linear-gradient(135deg, rgba(175,221,229,0.3) 0%, rgba(15,164,175,0.1) 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <BarChart3 size={20} color={C.accent} />
                </div>
                <p style={{ fontSize: 13, color: C.body }}>{cL ? "Loading data…" : "No attendance data yet. Run a session first."}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={248}>
                <BarChart data={trendData} barGap={8} barCategoryGap="30%">
                  <CartesianGrid stroke="rgba(0,49,53,0.04)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11.5, fill: "#94a3b8", fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11.5, fill: "#94a3b8", fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "rgba(255,255,255,0.96)", border: "1px solid rgba(15,164,175,0.12)", borderRadius: 14, fontSize: 12, backdropFilter: "blur(12px)", boxShadow: "0 20px 40px rgba(0,49,53,0.18)" }} cursor={{ fill: "rgba(15,164,175,0.06)" }} />
                  <Bar dataKey="present" radius={[8, 8, 0, 0]} name="Present" maxBarSize={46} animationDuration={900}>
                    {trendData.map((entry, i) => {
                      const total = entry.present + entry.absent;
                      const pct   = total > 0 ? (entry.present / total) * 100 : 0;
                      return <Cell key={i} fill={pct >= 75 ? CHART.high : pct >= 50 ? CHART.medium : CHART.low} />;
                    })}
                  </Bar>
                  <Bar dataKey="absent" fill="rgba(15,164,175,0.25)" radius={[8, 8, 0, 0]} name="Absent" maxBarSize={46} animationDuration={900} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* At-Risk */}
        <Card style={{ height: CHART_CARD_HEIGHT,display: "flex", flexDirection: "column" }}>
          <CardHeader
            title="At-Risk Students"
            sub="Below 75% attendance"
            right={
              atRisk.length > 0 ? (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)", whiteSpace: "nowrap" }}>
                  {atRisk.length} at risk
                </span>
              ) : undefined
            }
          />
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px 16px" }}>
            {arL ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
                {[1, 2, 3, 4].map((i) => <SkeletonLine key={i} w="100%" h={46} />)}
              </div>
            ) : atRisk.length === 0 ? (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, textAlign: "center", padding: "20px 0" }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CheckCircle2 size={22} color="#10b981" />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>All students on track</p>
                  <p style={{ fontSize: 11.5, color: C.body, marginTop: 3 }}>No one is below 75% attendance.</p>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {atRisk.map((s, i) => (
                  <AtRiskRow
                    key={`${s.student_id}-${s.course_id}`}
                    student={s}
                    isLast={i === atRisk.length - 1}
                  />
                ))}
              </div>
            )}
          </div>
          {atRisk.length > 0 && (
            <div style={{ borderTop: `1px solid ${C.border}`, padding: "10px 18px", flexShrink: 0 }}>
              <button
                onClick={() => router.push("/teacher/reports")}
                style={{ width: "100%", padding: "7px", borderRadius: 10, border: "none", background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: 600, color: C.accent, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
              >
                View full reports <ArrowUpRight size={12} />
              </button>
            </div>
          )}
        </Card>
      </div>

      {/* ── Bottom Row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)", gap: 20 }} className="bottom-grid">
        <Card style={{ height: BOTTOM_CARD_HEIGHT, display: "flex", flexDirection: "column" }}>
          <CardHeader title="Course Overview" sub="Attendance rates per course" right={<Btn small onClick={() => router.push("/teacher/courses")}>View all <ArrowUpRight size={12} /></Btn>} />
          <div style={{ padding: "14px 26px 26px" }}>
            {cL ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{[1,2,3].map((i) => <SkeletonLine key={i} w="100%" h={56} />)}</div>
            ) : courses.length === 0 ? (
              <div style={{ padding: "48px 0", textAlign: "center", fontSize: 13, color: C.body }}>No courses assigned yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {courses.map((c) => <CourseItem key={c.id} course={c} onClick={() => router.push("/teacher/courses")} />)}
              </div>
            )}
          </div>
        </Card>

        <Card style={{ height: BOTTOM_CARD_HEIGHT, display: "flex", flexDirection: "column" }}>
          <CardHeader title="Recent Activity" sub="Latest actions" right={activity.length > 0 ? <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "rgba(15,164,175,0.1)", color: C.accent }}>{activity.length} events</span> : undefined} />
          <div style={{ padding: "14px 26px 26px" }}>
            {cL ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{[1,2,3].map((i) => <SkeletonLine key={i} w="100%" h={48} />)}</div>
            ) : activity.length === 0 ? (
              <div style={{ padding: "48px 0", textAlign: "center", fontSize: 13, color: C.body }}>No activity yet.</div>
            ) : (
              <div>
                {activity.map((a, i) => {
                  const { Icon, bg, color } = activityIcons[a.type];
                  return <ActivityItem key={a.id} course={a.course} action={a.action} time={a.time} IconComponent={Icon} bg={bg} color={color} isLast={i === activity.length - 1} />;
                })}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ── Quick Actions ── */}
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(4, 1fr)" }} className="qa-grid">
        {quickActions.map(({ label, desc, Icon, href }) => (
          <QuickActionCard key={label} label={label} desc={desc} Icon={Icon} href={href} isHovered={hoveredAction === label} onEnter={() => setHoveredAction(label)} onLeave={() => setHoveredAction(null)} onClick={() => router.push(href)} />
        ))}
      </div>

      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* Tablet */
        @media (max-width: 1100px) {
          .stat-grid   { grid-template-columns: repeat(2, 1fr) !important; }
          .chart-grid  { grid-template-columns: 1fr !important; }
          .bottom-grid { grid-template-columns: 1fr !important; }
          .qa-grid     { grid-template-columns: repeat(2, 1fr) !important; }
        }

        /* Mobile */
        @media (max-width: 640px) {
          .stat-grid   { grid-template-columns: repeat(2, 1fr) !important; }
          .chart-grid  { grid-template-columns: 1fr !important; }
          .bottom-grid { grid-template-columns: 1fr !important; }
          .qa-grid     { grid-template-columns: repeat(2, 1fr) !important; }
        }

        /* Small mobile */
        @media (max-width: 400px) {
          .stat-grid { grid-template-columns: 1fr !important; }
          .qa-grid   { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}