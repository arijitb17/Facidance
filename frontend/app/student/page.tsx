"use client";

/**
 * frontend/app/student/page.tsx
 * Student Dashboard — redesigned to SaaS level matching teacher design system
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen, GraduationCap,
  BarChart3, CheckCircle2, TrendingUp,
  TrendingDown, ArrowUpRight,
} from "lucide-react";
import { useStudentStats } from "@/hooks/useStudent";

// ─── Design tokens (mirrors teacher exactly) ──────────────────────────────────
const SPRING   = "cubic-bezier(.22,.68,0,1.2)";
const EASE_ALL = `all 0.25s ${SPRING}`;

const SHADOW = {
  rest:   "0 2px 12px rgba(0,49,53,0.06)",
  hover:  "0 12px 36px rgba(0,49,53,0.12)",
  active: "0 16px 40px rgba(15,164,175,0.35)",
};

const C = {
  primary:    "#003135",
  accent:     "#0FA4AF",
  light:      "#AFDDE5",
  white:      "#ffffff",
  text:       "#0f172a",
  textSoft:   "#334155",
  body:       "#475569",
  muted:      "#64748b",
  mutedLight: "#94a3b8",
  border:     "rgba(226,232,240,0.7)",
  borderHov:  "rgba(15,164,175,0.22)",
};

const ICON_GRAD = `linear-gradient(135deg, ${C.primary} 0%, ${C.accent} 100%)`;
const CARD_GRAD = "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)";

// ─── Components ───────────────────────────────────────────────────────────────
function StatCard({ title, value, Icon, trend, trendLabel, loading }: {
  title: string; value: string | number; Icon: React.ElementType;
  trend?: "up" | "down"; trendLabel?: string; loading: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: CARD_GRAD, border: `1px solid ${hov ? C.borderHov : C.border}`,
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
          {loading ? (
            <div style={{ height: 36, width: 80, borderRadius: 8, marginTop: 10, background: "linear-gradient(90deg, #f1f5f9 25%, #e8f0f5 50%, #f1f5f9 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.6s ease-in-out infinite" }} />
          ) : (
            <p style={{ fontSize: 34, fontWeight: 800, color: C.text, lineHeight: 1, marginTop: 10, letterSpacing: "-0.03em" }}>
              {value}
            </p>
          )}
          {trendLabel && !loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 10 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "3px 8px", borderRadius: 20,
                background: trend === "up" ? "rgba(16,185,129,0.1)" : "rgba(249,115,22,0.1)",
              }}>
                {trend === "up"
                  ? <TrendingUp size={11} color="#10b981" />
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

function Btn({ children, onClick, primary, small, style }: {
  children: React.ReactNode; onClick?: () => void; primary?: boolean;
  small?: boolean; style?: React.CSSProperties;
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
          boxShadow: hov ? SHADOW.active : "0 8px 24px rgba(15,164,175,0.35)",
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

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: CARD_GRAD, border: `1px solid ${C.border}`,
      borderRadius: 18, overflow: "hidden", boxShadow: SHADOW.rest,
      ...style,
    }}>
      {children}
    </div>
  );
}

function CardHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
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

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function StudentDashboard() {
  const router = useRouter();
  const { data: stats, loading, error } = useStudentStats();

  const totalCourses    = stats?.total_courses ?? 0;
  const attendancePct   = stats?.attendance_percentage ?? 0;
  const totalPresent    = stats?.total_present ?? 0;

  const statCards = [
    { title: "My Courses",       value: totalCourses,               Icon: GraduationCap, trend: "up" as const,   trendLabel: "enrolled" },
    { title: "Attendance Rate",  value: `${attendancePct.toFixed(1)}%`, Icon: BarChart3, trend: attendancePct >= 75 ? "up" as const : "down" as const, trendLabel: attendancePct >= 75 ? "On track" : "Below target" },
    { title: "Classes Attended", value: totalPresent,               Icon: CheckCircle2,  trend: undefined,       trendLabel: undefined },
  ];


  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* Header */}
                        <div
  style={{
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: "4px 0 8px",
  }}
  className="header-wrap"
>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            Welcome back 👋
          </h1>
          <p style={{ fontSize: 14, color: C.body, marginTop: 6, lineHeight: 1.5 }}>
            Here's an overview of your attendance and courses.
          </p>
          {error && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", fontSize: 12.5, color: "#dc2626" }}>
              ⚠️ {error}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn onClick={() => router.push("/student/history")}><BarChart3 size={14} /> View History</Btn>
          <Btn primary onClick={() => router.push("/student/courses")}><BookOpen size={14} /> My Courses</Btn>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(3, 1fr)" }} className="stat-grid">
        {statCards.map(({ title, value, Icon, trend, trendLabel }) => (
          <StatCard key={title} title={title} value={value} Icon={Icon} trend={trend} trendLabel={trendLabel} loading={loading} />
        ))}
      </div>

      {/* Main Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)", gap: 20 }} className="main-grid">

        {/* Attendance guide */}
<Card>
  <CardHead 
    title="How Attendance Works" 
    sub="Understand how your presence is tracked during class" 
  />
  <div style={{ padding: "20px 26px 26px" }}>
    <ol style={{ 
      paddingLeft: 0, 
      margin: 0, 
      listStyle: "none", 
      display: "flex", 
      flexDirection: "column", 
      gap: 12 
    }}>
      {[
        { n: "01", text: "Join a class when your teacher invites you." },
        { n: "02", text: "Upload or capture your face images (front, left, right) from your profile." },
        { n: "03", text: "Your teacher trains the system using your facial data before the session." },
        { n: "04", text: "Each class session lasts around 45 minutes." },
        { n: "05", text: "Attendance is automatically captured every 2 minutes using AI." },
        { n: "06", text: "Missing more than 2 captures may mark you absent." },
        { n: "07", text: "Stay present and visible throughout the class to remain marked present." },
      ].map(({ n, text }) => (
        <li key={n} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <span style={{
            flexShrink: 0,
            width: 32,
            height: 32,
            borderRadius: 9,
            background: ICON_GRAD,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.02em",
            boxShadow: "0 4px 12px rgba(15,164,175,0.28)",
          }}>
            {n}
          </span>
          <span style={{ 
            fontSize: 13.5, 
            color: C.body, 
            lineHeight: 1.6, 
            paddingTop: 6 
          }}>
            {text}
          </span>
        </li>
      ))}
    </ol>
  </div>
</Card>

        {/* Insights */}
        <Card>
          <CardHead title="Attendance Insights" sub="Your current standing" />
          <div style={{ padding: "20px 26px 26px", display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Progress ring-style display */}
            <div style={{
              padding: "20px", borderRadius: 14,
              background: "rgba(15,164,175,0.05)",
              border: `1px solid ${C.borderHov}`,
              textAlign: "center",
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Overall Rate
              </p>
              <p style={{ fontSize: 48, fontWeight: 900, color: attendancePct >= 75 ? "#059669" : attendancePct >= 50 ? "#d97706" : "#dc2626", letterSpacing: "-0.04em", lineHeight: 1, marginTop: 8 }}>
                {loading ? "–" : `${attendancePct.toFixed(1)}%`}
              </p>
              {/* Progress bar */}
              <div style={{ height: 6, borderRadius: 6, background: "rgba(175,221,229,0.3)", overflow: "hidden", marginTop: 14 }}>
                <div style={{
                  width: `${attendancePct}%`, height: "100%", borderRadius: 6,
                  background: attendancePct >= 75 ? "linear-gradient(90deg,#059669,#10b981)" : attendancePct >= 50 ? "linear-gradient(90deg,#d97706,#f59e0b)" : "linear-gradient(90deg,#dc2626,#ef4444)",
                  transition: "width 0.9s cubic-bezier(.22,.68,0,1.2)",
                }} />
              </div>
              <p style={{ fontSize: 11.5, color: C.body, marginTop: 8 }}>
                Target: <strong style={{ color: C.text }}>75%</strong> minimum
              </p>
            </div>

            {/* Tips */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                "Submit attendance as soon as a batch opens.",
                "Ensure good lighting when taking your face photo.",
                "Contact your teacher if you notice any discrepancy.",
              ].map((tip, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "10px 12px", borderRadius: 10,
                  background: "#f8fafc", border: `1px solid ${C.border}`,
                }}>
                  <span style={{ fontSize: 14, marginTop: -1 }}>💡</span>
                  <span style={{ fontSize: 12, color: C.body, lineHeight: 1.5 }}>{tip}</span>
                </div>
              ))}
            </div>

            <Btn onClick={() => router.push("/student/history")} style={{ width: "100%", justifyContent: "center" }}>
              <ArrowUpRight size={14} /> Full History
            </Btn>
          </div>
        </Card>
      </div>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @media (max-width: 1100px) {
          .stat-grid  { grid-template-columns: repeat(2, 1fr) !important; }
          .main-grid  { grid-template-columns: 1fr !important; }
          .qa-grid    { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 640px) {
          .stat-grid  { grid-template-columns: 1fr !important; }
          .qa-grid    { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 400px) {
          .qa-grid    { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}