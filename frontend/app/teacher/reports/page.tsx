"use client";

import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, TrendingUp, TrendingDown, Users, AlertCircle, ChevronDown } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import { teacherCoursesApi, teacherReportsApi, type TeacherCourse, type ReportRow } from "@/lib/teacher-api";

// ─── Design tokens ─────────────────────────────────────────────────────────────
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
  light:      "#AFDDE5",
  warm:       "#964734",
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

const PIE_COLORS = ["#0FA4AF", "#f59e0b", "#ef4444"];

// ─── Components ───────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: CARD_GRAD,
      border: `1px solid ${C.border}`,
      borderRadius: 20, overflow: "hidden",
      boxShadow: SHADOW.rest,
      ...style,
    }}>
      {children}
    </div>
  );
}

function CardHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div style={{
      padding: "22px 28px 0",
      display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
    }}>
      <div>
        <p style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: "-0.02em" }}>{title}</p>
        {sub && <p style={{ fontSize: 12, color: C.body, marginTop: 3 }}>{sub}</p>}
      </div>
      {right}
    </div>
  );
}

function StatCard({ title, value, Icon, color, sub }: {
  title: string; value: string | number; Icon: React.ElementType;
  color?: string; sub?: string;
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
        transition: EASE_ALL,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            {title}
          </p>
          <p style={{ fontSize: 34, fontWeight: 800, color: color ?? C.text, lineHeight: 1, marginTop: 10, letterSpacing: "-0.03em" }}>
            {value}
          </p>
          {sub && <p style={{ fontSize: 11.5, color: C.body, marginTop: 6 }}>{sub}</p>}
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

function PrimaryBtn({ children, onClick, disabled }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "10px 20px", borderRadius: 11, fontSize: 13, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        border: "none",
        background: disabled ? "#e2e8f0" : ICON_GRAD,
        color: disabled ? C.muted : "#fff",
        boxShadow: disabled ? "none" : hov ? SHADOW.active : `0 8px 24px rgba(15,164,175,0.35)`,
        transform: !disabled && hov ? "translateY(-2px) scale(1.01)" : "translateY(0) scale(1)",
        transition: EASE_ALL,
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {children}
    </button>
  );
}

function SecondaryBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "10px 20px", borderRadius: 11, fontSize: 13, fontWeight: 600,
        cursor: "pointer",
        background: hov ? "#f0fdf4" : C.white,
        color: hov ? "#059669" : C.textSoft,
        border: `1px solid ${hov ? "rgba(16,185,129,0.3)" : C.border}`,
        boxShadow: hov ? "0 8px 24px rgba(16,185,129,0.15)" : SHADOW.rest,
        transform: hov ? "translateY(-2px) scale(1.01)" : "translateY(0) scale(1)",
        transition: EASE_ALL,
      }}
    >
      {children}
    </button>
  );
}

function Select({ name, value, onChange, disabled, children }: {
  name: string; value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        style={{
          width: "100%",
          padding: "10px 36px 10px 14px",
          borderRadius: 11, fontSize: 13, fontWeight: 500,
          color: C.text, background: C.white,
          border: `1px solid ${focused ? C.borderHov : C.border}`,
          boxShadow: focused ? `0 0 0 3px rgba(15,164,175,0.12)` : SHADOW.rest,
          outline: "none", cursor: "pointer",
          appearance: "none",
          transition: EASE_ALL,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        color={C.mutedLight}
        style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
      />
    </div>
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          padding: "10px 14px", borderRadius: 11, fontSize: 13,
          color: C.text, background: C.white,
          border: `1px solid ${focused ? C.borderHov : C.border}`,
          boxShadow: focused ? `0 0 0 3px rgba(15,164,175,0.12)` : SHADOW.rest,
          outline: "none", transition: EASE_ALL,
        }}
      />
    </div>
  );
}

function getRowColor(pct: number) {
  if (pct >= 75) return { text: "#059669", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.2)" };
  if (pct >= 50) return { text: "#d97706", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)" };
  return { text: "#dc2626", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)" };
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function TeacherReports() {
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [report, setReport] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ startDate: "", endDate: "" });

  useEffect(() => {
    teacherCoursesApi.list().then(setCourses).catch(() => setError("Failed to load courses"));
  }, []);

  async function generateReport() {
    if (!selectedCourse) { setError("Please select a course"); return; }
    setLoading(true);
    setError(null);
    setReport([]);
    try {
      const data = await teacherReportsApi.get(
        selectedCourse,
        dateRange.startDate || undefined,
        dateRange.endDate || undefined
      );
      setReport(data);
      if (data.length === 0) setError("No attendance data found for this course.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate report");
    } finally {
      setLoading(false);
    }
  }

  function downloadCSV() {
    if (report.length === 0) return;
    const name = courses.find((c) => c.id === selectedCourse)?.name || "report";
    const headers = ["Student Name", "Email", "Total Sessions", "Attended", "Attendance %"];
    const rows = report.map((r) => [
      r.studentName, r.studentEmail,
      r.totalSessions.toString(), r.attended.toString(),
      r.percentage.toFixed(1) + "%",
    ]);
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance_${name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const avgRate = report.length > 0
    ? (report.reduce((s, r) => s + r.percentage, 0) / report.length).toFixed(1)
    : "0.0";
  const below75  = report.filter((r) => r.percentage < 75).length;
  const above75  = report.filter((r) => r.percentage >= 75).length;
  const b50to75  = report.filter((r) => r.percentage >= 50 && r.percentage < 75).length;
  const below50  = report.filter((r) => r.percentage < 50).length;
  const courseName = courses.find((c) => c.id === selectedCourse)?.name;

  const pieData = [
    { name: "≥ 75%", value: above75 },
    { name: "50–74%", value: b50to75 },
    { name: "< 50%", value: below50 },
  ].filter((d) => d.value > 0);

  const barData = report.map((r) => ({
    name: r.studentName.split(" ")[0] ?? r.studentName.slice(0, 10),
    pct: Number(r.percentage.toFixed(1)),
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* Header */}
      <div style={{ padding: "4px 0 8px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          Attendance Reports
        </h1>
        <p style={{ fontSize: 14, color: C.body, marginTop: 6 }}>
          Generate insights, visualize attendance data, and export detailed reports.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 18px", borderRadius: 12,
          background: "#fef2f2", border: "1px solid #fecaca",
          color: "#dc2626", fontSize: 13, fontWeight: 500,
        }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Config card */}
      <Card>
        <CardHead
          title="Report Configuration"
          sub={report.length > 0 ? `Showing data for ${courseName}` : "Select a course and optional date range"}
        />
        <div style={{ padding: "20px 28px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Course select */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Course <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <Select name="course" value={selectedCourse} onChange={setSelectedCourse}>
              <option value="">Choose a course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </Select>
          </div>

          {/* Date range */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="date-grid">
            <DateInput
              label="Start Date (optional)"
              value={dateRange.startDate}
              onChange={(v) => setDateRange((p) => ({ ...p, startDate: v }))}
            />
            <DateInput
              label="End Date (optional)"
              value={dateRange.endDate}
              onChange={(v) => setDateRange((p) => ({ ...p, endDate: v }))}
            />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, paddingTop: 4 }}>
            <PrimaryBtn onClick={generateReport} disabled={!selectedCourse || loading}>
              <FileSpreadsheet size={15} />
              {loading ? "Generating…" : "Generate Report"}
            </PrimaryBtn>
            {report.length > 0 && (
              <SecondaryBtn onClick={downloadCSV}>
                <Download size={15} /> Export CSV
              </SecondaryBtn>
            )}
          </div>
        </div>
      </Card>

      {/* Summary stat cards */}
      {report.length > 0 && (
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(3, 1fr)" }} className="stat-grid">
          <StatCard title="Total Students"    value={report.length} Icon={Users}        />
          <StatCard title="Average Attendance" value={`${avgRate}%`} Icon={TrendingUp}   color={C.accent} />
          <StatCard title="Below 75%"          value={below75}       Icon={TrendingDown}  color={Number(avgRate) < 75 ? "#dc2626" : C.text} />
        </div>
      )}

      {/* Charts row */}
      {report.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)", gap: 20 }} className="chart-grid">

          {/* Bar chart */}
          <Card>
            <CardHead title="Attendance by Student" sub="Individual percentage breakdown" />
            <div style={{ padding: "16px 8px 24px" }}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barData} barCategoryGap="38%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ background: "rgba(255,255,255,0.98)", border: "1px solid rgba(15,164,175,0.15)", borderRadius: 12, fontSize: 12, boxShadow: SHADOW.hover }}
                    formatter={(v) => [`${v}%`, "Attendance"]}
                    cursor={{ fill: "rgba(15,164,175,0.04)" }}
                  />
                  <Bar dataKey="pct" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {barData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.pct >= 75 ? C.accent : entry.pct >= 50 ? "#f59e0b" : "#ef4444"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Pie chart */}
          <Card>
            <CardHead title="Distribution" sub="Attendance rate segments" />
            <div style={{ padding: "20px 28px 28px" }}>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData} dataKey="value" nameKey="name"
                      cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                      startAngle={90} endAngle={-270} strokeWidth={0}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => [`${v} students`]} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                {pieData.map((d, i) => (
                  <div key={d.name} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 12px", borderRadius: 10,
                    background: "#f8fafc", border: `1px solid ${C.border}`,
                  }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: C.body }}>
                      <span style={{
                        width: 10, height: 10, borderRadius: "50%",
                        background: PIE_COLORS[i], display: "inline-block",
                        boxShadow: `0 0 0 3px ${PIE_COLORS[i]}22`,
                      }} />
                      {d.name}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Report table */}
      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            border: `2px solid rgba(15,164,175,0.15)`,
            borderTopColor: C.accent,
            animation: "spin 0.9s linear infinite",
          }} />
        </div>
      )}

      {!loading && report.length > 0 && (
        <Card>
          <CardHead
            title="Student Report"
            sub={`${report.length} students`}
            right={
              <span style={{ fontSize: 12, color: C.body }}>
                Sorted by attendance rate
              </span>
            }
          />
          <div style={{ padding: "14px 0 0", overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Student", "Total Sessions", "Attended", "Attendance %"].map((h) => (
                    <th key={h} style={{
                      padding: "12px 24px", textAlign: "left",
                      fontSize: 10.5, fontWeight: 700, color: C.muted,
                      textTransform: "uppercase", letterSpacing: "0.09em",
                      borderBottom: `1px solid ${C.border}`,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...report]
                  .sort((a, b) => b.percentage - a.percentage)
                  .map((row, idx, arr) => {
                    const col = getRowColor(row.percentage);
                    return (
                      <ReportRow key={row.studentEmail} row={row} col={col} isLast={idx === arr.length - 1} />
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 1000px) {
          .chart-grid { grid-template-columns: 1fr !important; }
          .stat-grid  { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 600px) {
          .stat-grid  { grid-template-columns: 1fr !important; }
          .date-grid  { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function ReportRow({ row, col, isLast }: {
  row: ReportRow; col: { text: string; bg: string; border: string }; isLast: boolean;
}) {
  const [hov, setHov] = useState(false);
  const pct = row.percentage;
  return (
    <tr
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? "#f8fafc" : "transparent",
        transition: `background 0.15s ease`,
        borderBottom: isLast ? "none" : `1px solid ${C.border}`,
      }}
    >
      <td style={{ padding: "14px 24px" }}>
        <p style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{row.studentName}</p>
        <p style={{ fontSize: 11.5, color: C.body, marginTop: 2 }}>{row.studentEmail}</p>
      </td>
      <td style={{ padding: "14px 24px", fontSize: 13, color: C.body }}>{row.totalSessions}</td>
      <td style={{ padding: "14px 24px", fontSize: 13, color: C.body }}>{row.attended}</td>
      <td style={{ padding: "14px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 80, height: 5, borderRadius: 5, background: "rgba(175,221,229,0.3)", overflow: "hidden" }}>
            <div style={{
              width: `${pct}%`, height: "100%", borderRadius: 5,
              background: pct >= 75
                ? "linear-gradient(90deg,#059669,#10b981)"
                : pct >= 50
                ? "linear-gradient(90deg,#d97706,#f59e0b)"
                : "linear-gradient(90deg,#dc2626,#ef4444)",
            }} />
          </div>
          <span style={{
            display: "inline-flex", padding: "3px 10px", borderRadius: 20,
            fontSize: 11.5, fontWeight: 800,
            color: col.text, background: col.bg,
            border: `1px solid ${col.border}`,
          }}>
            {pct.toFixed(1)}%
          </span>
        </div>
      </td>
    </tr>
  );
}