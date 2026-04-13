"use client";

/**
 * frontend/app/student/history/page.tsx
 * Attendance History — redesigned to SaaS level matching teacher design system
 */

import { useMemo, useState } from "react";
import {
  Calendar, Download, Search, CheckCircle2, XCircle,
  TrendingUp, TrendingDown, BarChart3, AlertCircle, X,
} from "lucide-react";
import { useAttendanceHistory } from "@/hooks/useStudent";

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
  accent:     "#0FA4AF",
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
        background: CARD_GRAD, border: `1px solid ${hov ? C.borderHov : C.border}`,
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

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: CARD_GRAD, border: `1px solid ${C.border}`, borderRadius: 20, overflow: "hidden", boxShadow: SHADOW.rest, ...style }}>
      {children}
    </div>
  );
}

function CardHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div style={{ padding: "22px 28px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <div>
        <p style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: "-0.02em" }}>{title}</p>
        {sub && <p style={{ fontSize: 12, color: C.body, marginTop: 3 }}>{sub}</p>}
      </div>
      {right}
    </div>
  );
}

function GhostBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "9px 18px", borderRadius: 11, fontSize: 13, fontWeight: 600,
        cursor: "pointer",
        background: hov ? "#f0f9fa" : C.white,
        color: hov ? C.primary : C.textSoft,
        border: `1px solid ${hov ? C.borderHov : C.border}`,
        boxShadow: hov ? SHADOW.hover : SHADOW.rest,
        transform: hov ? "translateY(-2px) scale(1.01)" : "translateY(0) scale(1)",
        transition: EASE_ALL,
      }}
    >
      {children}
    </button>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AttendanceHistoryPage() {
  const { data, loading, error, refetch } = useAttendanceHistory();
  const [filter, setFilter]   = useState<"all" | "present" | "absent">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "records">("overview");

  const records = data?.records ?? [];
  const summary = data?.summary ?? [];

  const filteredRecords = records.filter((r) => {
    const matchesFilter = filter === "all" || (filter === "present" && r.status) || (filter === "absent" && !r.status);
    const matchesSearch = r.course_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const presentCount = records.filter((r) => r.status).length;
  const absentCount  = records.filter((r) => !r.status).length;
  const percentage   = records.length > 0 ? ((presentCount / records.length) * 100).toFixed(1) : "0.0";

  const courseSummary = useMemo(() => summary.slice().sort((a, b) => b.rate - a.rate), [summary]);

  function downloadCSV() {
    const headers = ["Course", "Status", "Date"];
    const rows = filteredRecords.map((r) => [r.course_name, r.status ? "Present" : "Absent", r.date]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance_history_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%", margin: "0 auto 14px",
            border: "2px solid rgba(15,164,175,0.15)", borderTopColor: C.accent,
            animation: "spin 0.9s linear infinite",
          }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: C.body }}>Loading attendance history…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 18px", borderRadius: 12,
          background: "#fef2f2", border: "1px solid #fecaca",
          color: "#dc2626", fontSize: 13, fontWeight: 500,
        }}>
          <AlertCircle size={15} /> {error}
        </div>
        <button onClick={refetch} style={{
          padding: "9px 18px", borderRadius: 11, fontSize: 13, fontWeight: 600,
          background: ICON_GRAD, color: "#fff", border: "none", cursor: "pointer", width: "fit-content",
        }}>Try Again</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* Header */}
      <div style={{ padding: "4px 0 8px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            Attendance History
          </h1>
          <p style={{ fontSize: 14, color: C.body, marginTop: 6 }}>
            Review and analyze your attendance across all courses.
          </p>
        </div>
        {records.length > 0 && (
          <GhostBtn onClick={downloadCSV}>
            <Download size={14} /> Export CSV
          </GhostBtn>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        background: "rgba(248,250,252,0.8)", border: `1px solid ${C.border}`,
        borderRadius: 16, padding: "6px",
        display: "flex", gap: 4, boxShadow: SHADOW.rest,
      }}>
        {(["overview", "records"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: "10px 24px", borderRadius: 12,
              fontSize: 13.5, fontWeight: activeTab === tab ? 700 : 500,
              textTransform: "capitalize",
              background: activeTab === tab ? CARD_GRAD : "transparent",
              color: activeTab === tab ? C.text : C.muted,
              border: activeTab === tab ? `1px solid ${C.border}` : "1px solid transparent",
              boxShadow: activeTab === tab ? "0 4px 14px rgba(15,23,42,0.08)" : "none",
              cursor: "pointer", transition: EASE_ALL,
            }}
          >
            {tab === "overview" ? "Overview" : "All Records"}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {/* Stat cards */}
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(4, 1fr)" }} className="stat-grid">
            <StatCard title="Total Classes"     value={records.length} Icon={Calendar}    />
            <StatCard title="Present"           value={presentCount}   Icon={CheckCircle2} color="#059669" />
            <StatCard title="Absent"            value={absentCount}    Icon={XCircle}      color="#dc2626" />
            <StatCard title="Attendance Rate"   value={`${percentage}%`} Icon={TrendingUp} color={Number(percentage) >= 75 ? C.accent : "#d97706"} />
          </div>

          {/* Course breakdown */}
          {courseSummary.length > 0 && (
            <Card>
              <CardHead title="By Course" sub="Attendance rate per course" />
              <div style={{ padding: "16px 28px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
                {courseSummary.map((c) => {
                  const good = c.rate >= 75;
                  return (
                    <div key={c.course_id} style={{
                      padding: "16px 18px", borderRadius: 14,
                      background: "#f8fafc", border: `1px solid ${C.border}`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 13.5, fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>{c.course_name}</p>
                          <p style={{ fontSize: 11.5, color: C.body, marginTop: 2 }}>{c.present}/{c.total_sessions} sessions attended</p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          {good ? <TrendingUp size={13} color="#059669" /> : <TrendingDown size={13} color="#dc2626" />}
                          <span style={{ fontSize: 14, fontWeight: 800, color: good ? "#059669" : "#dc2626" }}>
                            {c.rate.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div style={{ height: 5, borderRadius: 5, background: "rgba(175,221,229,0.3)", overflow: "hidden" }}>
                        <div style={{
                          width: `${c.rate}%`, height: "100%", borderRadius: 5,
                          background: good ? "linear-gradient(90deg,#059669,#10b981)" : "linear-gradient(90deg,#dc2626,#ef4444)",
                          transition: `width 0.9s ${SPRING}`,
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* RECORDS TAB */}
      {activeTab === "records" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Filters */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {/* Search */}
            <div style={{
              flex: "1 1 260px", display: "flex", alignItems: "center", gap: 10,
              background: CARD_GRAD,
              border: `1px solid ${searchFocused ? C.borderHov : C.border}`,
              borderRadius: 11, padding: "10px 14px",
              boxShadow: searchFocused ? `0 0 0 3px rgba(15,164,175,0.1)` : SHADOW.rest,
              transition: EASE_ALL,
            }}>
              <Search size={14} color={searchFocused ? C.accent : C.mutedLight} style={{ flexShrink: 0, transition: EASE_ALL }} />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search courses…"
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: C.text }}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
                  <X size={13} color={C.mutedLight} />
                </button>
              )}
            </div>
            {/* Filter pills */}
            <div style={{ display: "flex", gap: 8 }}>
              {(["all", "present", "absent"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: "9px 16px", borderRadius: 11, fontSize: 13, fontWeight: 600,
                    textTransform: "capitalize", cursor: "pointer", transition: EASE_ALL,
                    background: filter === f ? ICON_GRAD : C.white,
                    color: filter === f ? "#fff" : C.textSoft,
                    border: `1px solid ${filter === f ? "transparent" : C.border}`,
                    boxShadow: filter === f ? SHADOW.active : SHADOW.rest,
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {filteredRecords.length === 0 ? (
            <Card>
              <div style={{ padding: "56px 0", textAlign: "center" }}>
                <Calendar size={36} color={C.mutedLight} style={{ margin: "0 auto 12px" }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>No records match your filter</p>
                <p style={{ fontSize: 12, color: C.body, marginTop: 5 }}>Try adjusting your search or filter.</p>
              </div>
            </Card>
          ) : (
            <Card>
              <CardHead
                title="Attendance Records"
                sub={`${filteredRecords.length} record${filteredRecords.length !== 1 ? "s" : ""}`}
                right={
                  <span style={{ fontSize: 12, color: C.body }}>
                    Sorted by most recent
                  </span>
                }
              />
              <div style={{ padding: "14px 0 0", overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["Course", "Status", "Date"].map((h) => (
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
                    {filteredRecords
                      .slice()
                      .sort((a, b) => (a.date > b.date ? -1 : 1))
                      .map((record, i, arr) => (
                        <RecordRow
                          key={`${record.course_id}-${record.date}-${i}`}
                          record={record}
                          isLast={i === arr.length - 1}
                        />
                      ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 1100px) { .stat-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 540px)  { .stat-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}

function RecordRow({ record, isLast }: { record: any; isLast: boolean }) {
  const [hov, setHov] = useState(false);
  const ok = record.status;
  return (
    <tr
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? "#f8fafc" : "transparent",
        transition: EASE_ALL,
        borderBottom: isLast ? "none" : `1px solid ${C.border}`,
      }}
    >
      <td style={{ padding: "14px 24px", fontSize: 13.5, fontWeight: 600, color: C.text }}>{record.course_name}</td>
      <td style={{ padding: "14px 24px" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "4px 11px", borderRadius: 20, fontSize: 11.5, fontWeight: 700,
          background: ok ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
          color: ok ? "#059669" : "#dc2626",
          border: `1px solid ${ok ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
        }}>
          {ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
          {ok ? "Present" : "Absent"}
        </span>
      </td>
      <td style={{ padding: "14px 24px", fontSize: 13, color: C.body }}>
        {new Date(record.date).toLocaleDateString("en-US", {
          weekday: "short", year: "numeric", month: "short", day: "numeric",
        })}
      </td>
    </tr>
  );
}

