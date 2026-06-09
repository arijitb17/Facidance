"use client";

/**
 * frontend/app/student/page.tsx
 * Student Dashboard — redesigned to SaaS level matching teacher design system
 */

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen, GraduationCap,
  BarChart3, CheckCircle2, TrendingUp,
  TrendingDown, ArrowUpRight, Award, Star, Sparkles,
} from "lucide-react";
import { useStudentStats, useStudentMe } from "@/hooks/useStudent";

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
        borderRadius: 18, padding: "18px 16px",
        boxShadow: hov ? SHADOW.hover : SHADOW.rest,
        transform: hov ? "translateY(-5px) scale(1.01)" : "translateY(0) scale(1)",
        transition: EASE_ALL, overflow: "hidden", position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {title}
          </p>
          {loading ? (
            <div style={{ width: 60, height: 34, borderRadius: 8, background: "linear-gradient(90deg,#f1f5f9 25%,#e8f0f5 50%,#f1f5f9 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.6s ease-in-out infinite", marginTop: 10 }} />
          ) : (
            <p style={{ fontSize: 28, fontWeight: 800, color: C.text, lineHeight: 1, marginTop: 10, letterSpacing: "-0.03em" }}>
              {value}
            </p>
          )}
          {!loading && trend && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8 }}>
              <div style={{ flexShrink: 0 }}>
                {trend === "up" ? <TrendingUp size={12} color="#059669" /> : <TrendingDown size={12} color="#dc2626" />}
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: trend === "up" ? "#059669" : "#dc2626", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {trendLabel}
              </span>
            </div>
          )}
        </div>
        <div style={{
          height: 42, width: 42, borderRadius: 12, flexShrink: 0,
          background: ICON_GRAD,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: hov ? "0 8px 24px rgba(15,164,175,0.38)" : "0 6px 20px rgba(15,164,175,0.28)",
          transform: hov ? "scale(1.1) rotate(-3deg)" : "scale(1) rotate(0deg)",
          transition: EASE_ALL,
        }}>
          <Icon size={18} color="#fff" strokeWidth={2} />
        </div>
      </div>
      {/* Decorative corner */}
      <div style={{
        position: "absolute", bottom: -20, right: -20,
        width: 80, height: 80, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(15,164,175,0.06) 0%, transparent 70%)",
      }} />
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

// ─── Confetti Particle ────────────────────────────────────────────────────────
function ConfettiParticle({ index }: { index: number }) {
  const config = useMemo(() => {
    const colors = ["#FFD700", "#0FA4AF", "#FF6B6B", "#10b981", "#8B5CF6", "#F59E0B", "#EC4899", "#003135"];
    const shapes = ["square", "circle", "strip"] as const;
    return {
      color: colors[index % colors.length],
      shape: shapes[index % shapes.length],
      left: `${(index * 7.3 + 3) % 100}%`,
      delay: `${(index * 0.4) % 5}s`,
      duration: `${3 + (index % 4) * 0.8}s`,
      size: 6 + (index % 5) * 2,
      rotation: index * 47,
    };
  }, [index]);

  return (
    <div
      style={{
        position: "absolute",
        top: -20,
        left: config.left,
        width: config.shape === "strip" ? 4 : config.size,
        height: config.shape === "strip" ? config.size * 2.5 : config.size,
        background: config.color,
        borderRadius: config.shape === "circle" ? "50%" : config.shape === "strip" ? 2 : 1,
        opacity: 0.85,
        animation: `confettiFall ${config.duration} ${config.delay} linear infinite`,
        transform: `rotate(${config.rotation}deg)`,
        pointerEvents: "none",
      }}
    />
  );
}

// ─── Graduated Alumni View ────────────────────────────────────────────────────
function AlumniDashboard({ name, totalCourses, totalPresent, attendancePct }: {
  name: string; totalCourses: number; totalPresent: number; attendancePct: number;
}) {
  const router = useRouter();
  const [btnHov, setBtnHov] = useState(false);

  return (
    <div style={{
      position: "relative",
      minHeight: "78vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      padding: "40px 20px",
    }}>
      {/* ── Animated background orbs ── */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: "-10%", left: "-5%",
          width: 500, height: 500, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(15,164,175,0.12) 0%, transparent 70%)",
          animation: "orbFloat1 8s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", bottom: "-15%", right: "-8%",
          width: 600, height: 600, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,215,0,0.08) 0%, transparent 70%)",
          animation: "orbFloat2 10s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", top: "30%", right: "15%",
          width: 300, height: 300, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)",
          animation: "orbFloat3 12s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", bottom: "20%", left: "10%",
          width: 250, height: 250, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)",
          animation: "orbFloat1 9s ease-in-out infinite reverse",
        }} />
      </div>

      {/* ── Confetti ── */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        {Array.from({ length: 30 }).map((_, i) => (
          <ConfettiParticle key={i} index={i} />
        ))}
      </div>

      {/* ── Main content ── */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 24, maxWidth: 600 }}>

        {/* Graduation cap with golden glow */}
        <div style={{ position: "relative" }}>
          <div style={{
            position: "absolute", inset: -18,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,215,0,0.25) 0%, rgba(255,215,0,0.08) 40%, transparent 70%)",
            animation: "goldenPulse 3s ease-in-out infinite",
          }} />
          <div style={{
            width: 100, height: 100, borderRadius: "50%",
            background: "linear-gradient(135deg, #FFD700 0%, #F59E0B 50%, #D97706 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 16px 48px rgba(255,215,0,0.35), 0 4px 16px rgba(217,119,6,0.25), inset 0 1px 2px rgba(255,255,255,0.3)",
            animation: "capFloat 4s ease-in-out infinite",
            position: "relative",
          }}>
            <GraduationCap size={48} color="#fff" strokeWidth={1.8} />
          </div>
          {/* Sparkle accents */}
          <div style={{ position: "absolute", top: -4, right: -4, animation: "sparkle 2s ease-in-out infinite" }}>
            <Sparkles size={18} color="#FFD700" />
          </div>
          <div style={{ position: "absolute", bottom: 2, left: -8, animation: "sparkle 2s ease-in-out infinite 0.7s" }}>
            <Star size={14} color="#F59E0B" fill="#F59E0B" />
          </div>
          <div style={{ position: "absolute", top: 10, left: -12, animation: "sparkle 2s ease-in-out infinite 1.4s" }}>
            <Star size={10} color="#FFD700" fill="#FFD700" />
          </div>
        </div>

        {/* Headline */}
        <div style={{ textAlign: "center" }}>
          <p style={{
            fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em",
            background: "linear-gradient(90deg, #FFD700, #F59E0B, #D97706)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            marginBottom: 8,
          }}>
            Class of {new Date().getFullYear()}
          </p>
          <h1 style={{
            fontSize: 42, fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.03em",
            background: "linear-gradient(135deg, #003135 0%, #0FA4AF 60%, #FFD700 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            margin: 0,
          }}>
            Congratulations, {name}!
          </h1>
        </div>

        {/* Glassmorphism info card */}
        <div style={{
          background: "rgba(255,255,255,0.65)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.5)",
          borderRadius: 20,
          padding: "24px 32px",
          maxWidth: 480,
          textAlign: "center",
          boxShadow: "0 8px 32px rgba(0,49,53,0.08), inset 0 1px 0 rgba(255,255,255,0.6)",
        }}>
          <p style={{ fontSize: 15, color: C.body, lineHeight: 1.7, margin: 0 }}>
            You have successfully graduated. Your academic journey has been recorded and preserved.
            Access your complete attendance history and course records anytime.
          </p>
        </div>

        {/* Academic summary stat cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14,
          width: "100%",
          maxWidth: 500,
        }}
        className="alumni-stat-grid"
        >
          {[
            { label: "Courses Completed", value: totalCourses, Icon: BookOpen, gradient: "linear-gradient(135deg, #003135, #0FA4AF)" },
            { label: "Classes Attended", value: totalPresent, Icon: CheckCircle2, gradient: "linear-gradient(135deg, #059669, #10b981)" },
            { label: "Attendance Rate", value: `${attendancePct.toFixed(0)}%`, Icon: Award, gradient: "linear-gradient(135deg, #D97706, #F59E0B)" },
          ].map(({ label, value, Icon, gradient }) => (
            <div key={label} style={{
              background: "rgba(255,255,255,0.7)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.5)",
              borderRadius: 16,
              padding: "18px 14px",
              textAlign: "center",
              boxShadow: "0 4px 20px rgba(0,49,53,0.06)",
              animation: "fadeSlideUp 0.6s ease-out both",
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, margin: "0 auto 10px",
                background: gradient,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
              }}>
                <Icon size={18} color="#fff" strokeWidth={2} />
              </div>
              <p style={{ fontSize: 24, fontWeight: 800, color: C.text, lineHeight: 1, letterSpacing: "-0.02em", margin: 0 }}>
                {value}
              </p>
              <p style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 6, lineHeight: 1.3 }}>
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* CTA button with shimmer */}
        <button
          onClick={() => router.push("/student/history")}
          onMouseEnter={() => setBtnHov(true)}
          onMouseLeave={() => setBtnHov(false)}
          style={{
            position: "relative",
            display: "inline-flex", alignItems: "center", gap: 10,
            padding: "14px 32px",
            borderRadius: 14,
            fontSize: 15, fontWeight: 700,
            cursor: "pointer",
            background: "linear-gradient(135deg, #003135 0%, #024950 40%, #0FA4AF 100%)",
            color: "#fff",
            border: "none",
            boxShadow: btnHov
              ? "0 20px 50px rgba(15,164,175,0.4), 0 4px 16px rgba(0,49,53,0.2)"
              : "0 12px 36px rgba(15,164,175,0.3), 0 2px 8px rgba(0,49,53,0.15)",
            transform: btnHov ? "translateY(-3px) scale(1.02)" : "translateY(0) scale(1)",
            transition: EASE_ALL,
            overflow: "hidden",
            letterSpacing: "-0.01em",
          }}
        >
          {/* Shimmer overlay */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)",
            backgroundSize: "200% 100%",
            animation: "btnShimmer 3s ease-in-out infinite",
            borderRadius: 14,
          }} />
          <BarChart3 size={18} style={{ position: "relative", zIndex: 1 }} />
          <span style={{ position: "relative", zIndex: 1 }}>View Past Records</span>
          <ArrowUpRight size={16} style={{ position: "relative", zIndex: 1, opacity: 0.7 }} />
        </button>
      </div>

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 0.9; }
          25% { transform: translateY(25vh) rotate(120deg) translateX(15px); opacity: 0.8; }
          50% { transform: translateY(50vh) rotate(240deg) translateX(-10px); opacity: 0.7; }
          75% { transform: translateY(75vh) rotate(360deg) translateX(20px); opacity: 0.5; }
          100% { transform: translateY(100vh) rotate(480deg) translateX(-5px); opacity: 0; }
        }
        @keyframes orbFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.05); }
          66% { transform: translate(-15px, 15px) scale(0.95); }
        }
        @keyframes orbFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-25px, 20px) scale(1.08); }
        }
        @keyframes orbFloat3 {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.6; }
          50% { transform: translate(20px, -30px) scale(1.1); opacity: 1; }
        }
        @keyframes goldenPulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.15); opacity: 1; }
        }
        @keyframes capFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes sparkle {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
          50% { transform: scale(0.5) rotate(180deg); opacity: 0.3; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes btnShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (max-width: 540px) {
          .alumni-stat-grid { 
            grid-template-columns: repeat(3, 1fr) !important; 
            max-width: 100% !important; 
            gap: 8px !important; 
          }
          .alumni-stat-grid > div {
            padding: 14px 6px !important;
          }
          .alumni-stat-grid p:last-child {
            font-size: 8px !important;
          }
          .alumni-stat-grid p:nth-child(2) {
            font-size: 20px !important;
          }
          .alumni-stat-grid > div > div:first-child {
            width: 32px !important;
            height: 32px !important;
          }
          .alumni-stat-grid > div > div:first-child svg {
            width: 16px !important;
            height: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function StudentDashboard() {
  const router = useRouter();
  const { data: stats, loading, error } = useStudentStats();
  const { data: me, loading: meLoading } = useStudentMe();

  const totalCourses    = stats?.total_courses ?? 0;
  const attendancePct   = stats?.attendance_percentage ?? 0;
  const totalPresent    = stats?.total_present ?? 0;

  const statCards = [
    { title: "My Courses",       value: totalCourses,               Icon: GraduationCap, trend: "up" as const,   trendLabel: "enrolled" },
    { title: "Attendance Rate",  value: `${attendancePct.toFixed(1)}%`, Icon: BarChart3, trend: attendancePct >= 75 ? "up" as const : "down" as const, trendLabel: attendancePct >= 75 ? "On track" : "Below target" },
    { title: "Classes Attended", value: totalPresent,               Icon: CheckCircle2,  trend: undefined,       trendLabel: undefined },
  ];

  if (meLoading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid rgba(15,164,175,0.2)", borderTopColor: "#0FA4AF", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const isGraduated = me?.student?.status === "graduated" || false;

  if (isGraduated) {
    return (
      <AlumniDashboard
        name={me?.name ?? "Alumni"}
        totalCourses={totalCourses}
        totalPresent={totalPresent}
        attendancePct={attendancePct}
      />
    );
  }

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
            Welcome back
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
                  <span style={{ fontSize: 14, marginTop: -1 }}></span>
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
          .stat-grid  { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; }
          .qa-grid    { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 400px) {
          .stat-grid  { grid-template-columns: 1fr !important; gap: 10px !important; }
          .qa-grid    { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}