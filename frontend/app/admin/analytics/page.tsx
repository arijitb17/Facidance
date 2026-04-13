"use client";

import { BarChart3, Users, GraduationCap, Building2, BookOpen, Activity, Award, TrendingUp } from "lucide-react";
import {
  useAnalyticsOverview, useAttendanceTrends, useTeacherLoad, useProgramDistribution,
} from "@/hooks/useAdmin";
import {
  AttendanceTrendChart, TeacherLoadChart, ProgramDistributionChart,
} from "@/components/admin/AnalyticsChart";
import { useState } from "react";

// ─── Design tokens ────────────────────────────────────────────────────────────
const SPRING   = "cubic-bezier(.22,.68,0,1.2)";
const EASE_ALL = `all 0.25s ${SPRING}`;
const C = {
  primary: "#003135", secondary: "#024950", accent: "#0FA4AF",
  text: "#0f172a", body: "#475569", muted: "#64748b", mutedLight: "#94a3b8",
  border: "rgba(226,232,240,0.7)", borderHov: "rgba(15,164,175,0.22)", white: "#ffffff",
};
const ICON_GRAD = `linear-gradient(135deg, ${C.primary} 0%, ${C.accent} 100%)`;
const CARD_GRAD = "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)";
const SHADOW = { rest: "0 2px 12px rgba(0,49,53,0.06)", hover: "0 12px 36px rgba(0,49,53,0.12)" };

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: CARD_GRAD, border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: SHADOW.rest, overflow: "hidden", ...style }}>{children}</div>;
}

function CardSection({ title, sub, icon: Icon }: { title: string; sub?: string; icon: React.ElementType }) {
  return (
    <div style={{ padding: "22px 26px 0", display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
      <div style={{ height: 36, width: 36, borderRadius: 10, background: ICON_GRAD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={16} color="#fff" />
      </div>
      <div>
        <p style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>{title}</p>
        {sub && <p style={{ fontSize: 12, color: C.body, margin: "2px 0 0" }}>{sub}</p>}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, loading }: { label: string; value: number; icon: React.ElementType; loading: boolean }) {
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
        transform: hov ? "translateY(-5px) scale(1.01)" : "none",
        transition: EASE_ALL,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>{label}</p>
          {loading
            ? <div style={{ width: 80, height: 36, borderRadius: 8, background: "#f1f5f9", marginTop: 10, animation: "shimmer 1.6s ease-in-out infinite", backgroundSize: "200% 100%", backgroundImage: "linear-gradient(90deg, #f1f5f9 25%, #e8f0f5 50%, #f1f5f9 75%)" }} />
            : <p style={{ fontSize: 34, fontWeight: 800, color: C.text, lineHeight: 1, marginTop: 10, letterSpacing: "-0.03em" }}>{value.toLocaleString()}</p>
          }
        </div>
        <div style={{
          height: 50, width: 50, minWidth: 50, borderRadius: 14,
          background: ICON_GRAD, display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: hov ? "0 8px 24px rgba(15,164,175,0.38)" : "0 6px 20px rgba(15,164,175,0.28)",
          transform: hov ? "scale(1.1) rotate(-3deg)" : "none", transition: EASE_ALL,
        }}>
          <Icon size={22} color="#fff" strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

function BigMetricCard({ label, value, suffix, sub, icon: Icon, accent }: {
  label: string; value: string | number; suffix?: string; sub: string; icon: React.ElementType; accent: string;
}) {
  return (
    <div style={{ background: CARD_GRAD, border: `1px solid ${C.border}`, borderRadius: 18, padding: "24px 26px", boxShadow: SHADOW.rest }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Icon size={16} color={accent} />
        <p style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>{label}</p>
      </div>
      <p style={{ fontSize: 44, fontWeight: 800, color: accent, lineHeight: 1, margin: 0 }}>
        {value}<span style={{ fontSize: 22, fontWeight: 600, marginLeft: 2 }}>{suffix}</span>
      </p>
      <p style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{sub}</p>
    </div>
  );
}

function Skeleton({ h = 240 }: { h?: number }) {
  return <div style={{ height: h, borderRadius: 12, background: "#f1f5f9", animation: "shimmer 1.6s ease-in-out infinite", backgroundSize: "200% 100%", backgroundImage: "linear-gradient(90deg, #f1f5f9 25%, #e8f0f5 50%, #f1f5f9 75%)" }} />;
}

export default function AnalyticsPage() {
  const { data: overview, loading: overviewLoading } = useAnalyticsOverview();
  const { data: trends, loading: trendsLoading } = useAttendanceTrends();
  const { data: teacherLoad, loading: loadLoading } = useTeacherLoad();
  const { data: programs, loading: programsLoading } = useProgramDistribution();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

        .an-kpi  { display: grid; gap: 16px; grid-template-columns: repeat(4, 1fr); }
        .an-big  { display: grid; gap: 16px; grid-template-columns: repeat(3, 1fr); }
        .an-charts { display: grid; gap: 20px; grid-template-columns: 1fr 1fr; }

        @media (max-width: 1100px) {
          .an-kpi    { grid-template-columns: repeat(2, 1fr) !important; }
          .an-big    { grid-template-columns: repeat(2, 1fr) !important; }
          .an-charts { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 600px) {
          .an-kpi { grid-template-columns: 1fr 1fr !important; }
          .an-big { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 420px) {
          .an-kpi { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, letterSpacing: "-0.03em", lineHeight: 1.1, margin: 0 }}>Analytics 📊</h1>
        <p style={{ fontSize: 14, color: C.body, marginTop: 6 }}>Real-time metrics across attendance, faculty, and enrollment.</p>
      </div>

      {/* KPI Cards */}
      <div className="an-kpi">
        <StatCard label="Total Users"      value={overview?.total_users      ?? 0} icon={Users}         loading={overviewLoading} />
        <StatCard label="Active Students"  value={overview?.active_students   ?? 0} icon={GraduationCap} loading={overviewLoading} />
        <StatCard label="Departments"      value={overview?.total_departments ?? 0} icon={Building2}     loading={overviewLoading} />
        <StatCard label="Total Courses"    value={overview?.total_courses     ?? 0} icon={BookOpen}      loading={overviewLoading} />
      </div>

      {/* Big highlight metrics */}
      <div className="an-big">
        <BigMetricCard
          label="Overall Attendance" value={overview?.overall_attendance_rate ?? 0} suffix="%" icon={Activity} accent={C.accent}
          sub={`${(overview?.total_attendance_records ?? 0).toLocaleString()} total records`}
        />
        <BigMetricCard
          label="Graduation Rate"
          value={overview && overview.total_students > 0 ? Math.round((overview.graduated_students / overview.total_students) * 100) : 0}
          suffix="%" icon={Award} accent="#d97706"
          sub={`${overview?.graduated_students ?? 0} graduated / ${overview?.total_students ?? 0} total`}
        />
        <BigMetricCard
          label="Programs / Dept"
          value={overview && overview.total_departments > 0 ? (overview.total_programs / overview.total_departments).toFixed(1) : "0.0"}
          icon={TrendingUp} accent="#059669"
          sub={`${overview?.total_programs ?? 0} programs across ${overview?.total_departments ?? 0} departments`}
        />
      </div>

      {/* Charts row */}
      <div className="an-charts">
        <Card>
          <CardSection title="Monthly Attendance Trends" sub="Attendance rate (%) over the last 12 months" icon={Activity} />
          <div style={{ padding: "16px 26px 26px" }}>
            {trendsLoading ? <Skeleton /> : !trends?.length ? <EmptyChart message="No attendance data yet." /> : <AttendanceTrendChart data={trends} />}
          </div>
        </Card>
        <Card>
          <CardSection title="Teacher Workload" sub="Courses and enrolled students per teacher (top 10)" icon={Users} />
          <div style={{ padding: "16px 26px 26px" }}>
            {loadLoading ? <Skeleton /> : !teacherLoad?.length ? <EmptyChart message="No teacher data yet." /> : <TeacherLoadChart data={teacherLoad} />}
          </div>
        </Card>
      </div>

      {/* Program Distribution */}
      <Card>
        <CardSection title="Students per Program" sub="Enrollment distribution across all academic programs" icon={BookOpen} />
        <div style={{ padding: "16px 26px 26px" }}>
          {programsLoading ? <Skeleton /> : !programs?.length ? <EmptyChart message="No program data yet." /> : <ProgramDistributionChart data={programs} />}
        </div>
      </Card>

      {/* Teacher Load Table */}
      {teacherLoad && teacherLoad.length > 0 && (
        <Card>
          <CardSection title="Teacher Load Detail" icon={Users} />
          <div style={{ padding: "16px 26px 26px", overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 480, borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {["Teacher", "Department", "Courses", "Students"].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...teacherLoad].sort((a, b) => b.student_count - a.student_count).map((t, i) => (
                  <tr key={t.teacher_id} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? "transparent" : "rgba(248,250,252,0.5)" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 700, color: C.primary }}>{t.teacher_name}</td>
                    <td style={{ padding: "12px 14px", color: C.body }}>{t.department_name ?? "—"}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ padding: "3px 10px", borderRadius: 20, background: "rgba(15,164,175,0.1)", color: C.primary, fontSize: 12, fontWeight: 700 }}>{t.course_count}</span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ padding: "3px 10px", borderRadius: 20, background: "rgba(16,185,129,0.1)", color: "#065f46", fontSize: 12, fontWeight: 700 }}>{t.student_count}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div style={{ height: 240, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
      <div style={{ height: 46, width: 46, borderRadius: 13, background: "rgba(175,221,229,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <BarChart3 size={20} color="#94a3b8" />
      </div>
      <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>{message}</p>
    </div>
  );
}