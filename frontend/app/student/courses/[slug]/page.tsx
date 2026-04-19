"use client";

/**
 * frontend/app/student/courses/[slug]/page.tsx
 * Course Detail — redesigned to SaaS level matching teacher design system
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import {
  BookOpen, User, Calendar, ArrowLeft, CheckCircle2,
  XCircle, Mail, GraduationCap,
  Info, Award,
} from "lucide-react";
import {
  listCourses, getCourse, getCourseAttendance,
  type CourseListItem, type CourseDetail, type CourseAttendanceSummary,
} from "@/lib/api_student";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const SPRING   = "cubic-bezier(.22,.68,0,1.2)";
const EASE_ALL = `all 0.25s ${SPRING}`;

const SHADOW = {
  rest:   "0 2px 12px rgba(0,49,53,0.06)",
  hover:  "0 12px 36px rgba(0,49,53,0.12)",
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

function slugifyCourseName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ─── Components ───────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: CARD_GRAD, border: `1px solid ${C.border}`, borderRadius: 20, overflow: "hidden", boxShadow: SHADOW.rest, ...style }}>
      {children}
    </div>
  );
}

function CardHead({ title, sub, Icon }: {
  title: string; sub?: string; Icon: React.ElementType;
}) {
  return (
    <div style={{ padding: "22px 28px 0", display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 20 }}>
      <div style={{
        height: 44, width: 44, borderRadius: 13, background: ICON_GRAD,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 6px 18px rgba(15,164,175,0.28)", flexShrink: 0,
      }}>
        <Icon size={19} color="#fff" />
      </div>
      <div>
        <p style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: "-0.02em" }}>{title}</p>
        {sub && <p style={{ fontSize: 12, color: C.body, marginTop: 3 }}>{sub}</p>}
      </div>
    </div>
  );
}

function StatMini({ label, value, color, bg, border }: {
  label: string; value: string | number; color: string; bg: string; border: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "18px 20px", borderRadius: 16,
        background: bg, border: `1px solid ${border}`,
        boxShadow: hov ? SHADOW.hover : SHADOW.rest,
        transform: hov ? "translateY(-4px) scale(1.01)" : "translateY(0) scale(1)",
        transition: EASE_ALL,
      }}
    >
      <p style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.8 }}>{label}</p>
      <p style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1, marginTop: 8, letterSpacing: "-0.03em" }}>{value}</p>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function StudentCourseDetailPage() {
  const router       = useRouter();
  const params       = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const slug         = params?.slug;

  const [course,     setCourse]     = useState<CourseDetail | null>(null);
  const [attendance, setAttendance] = useState<CourseAttendanceSummary | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [activeTab,  setActiveTab]  = useState<"overview" | "attendance">("overview");

  const parsedSlug = useMemo<{ code: string; nameSlug: string } | null>(() => {
    if (!slug) return null;
    const parts = slug.split("-");
    if (parts.length < 3) return null;
    return { code: `${parts[0]}-${parts[1]}`, nameSlug: parts.slice(2).join("-") };
  }, [slug]);

  useEffect(() => {
    if (searchParams?.get("tab") === "attendance") setActiveTab("attendance");
  }, [searchParams]);

  useEffect(() => {
    if (!parsedSlug) { setError("Invalid course link"); setLoading(false); return; }
    async function load() {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        if (!token) { router.push("/login"); return; }
        const courses: CourseListItem[] = await listCourses();
        const { code, nameSlug } = parsedSlug!;
        const match = courses.find((c) => c.code === code && slugifyCourseName(c.name) === nameSlug);
        if (!match) throw new Error("Course not found for this link.");
        const [detail, att] = await Promise.all([getCourse(match.id), getCourseAttendance(match.id)]);
        setCourse(detail);
        setAttendance(att);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load course details");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [parsedSlug, router]);

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%", margin: "0 auto 14px",
            border: "2px solid rgba(15,164,175,0.15)", borderTopColor: C.accent,
            animation: "spin 0.9s linear infinite",
          }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: C.body }}>Loading course details…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <button
          onClick={() => router.push("/student/courses")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 13, fontWeight: 600, color: C.body,
            background: "none", border: "none", cursor: "pointer", padding: 0,
          }}
        >
          <ArrowLeft size={14} /> Back to Courses
        </button>
        <div style={{
          padding: "24px 28px", borderRadius: 16,
          background: "#fef2f2", border: "1px solid #fecaca", maxWidth: 440,
        }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#dc2626", marginBottom: 8 }}>Error</p>
          <p style={{ fontSize: 13, color: "#b91c1c", lineHeight: 1.6 }}>{error || "Course not found"}</p>
          <button
            onClick={() => router.push("/student/courses")}
            style={{
              marginTop: 16, background: "#dc2626", color: "#fff",
              border: "none", borderRadius: 10, padding: "8px 18px",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            Back to courses
          </button>
        </div>
      </div>
    );
  }

  const totalSessions = attendance?.total_sessions ?? 0;
  const present       = attendance?.present ?? 0;
  const absent        = attendance?.absent ?? 0;
  const rate          = attendance?.rate ?? 0;
  const records       = attendance?.records ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* Back button */}
      <button
        onClick={() => router.push("/student/courses")}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13, fontWeight: 600, color: C.body,
          background: "none", border: "none", cursor: "pointer", padding: 0,
          transition: EASE_ALL,
        }}
      >
        <ArrowLeft size={14} /> Back to My Courses
      </button>

      {/* Course header card */}
      <div style={{
        background: CARD_GRAD, border: `1px solid ${C.border}`,
        borderRadius: 20, padding: "28px 32px", boxShadow: SHADOW.rest,
        position: "relative", overflow: "hidden",
      }}>
        {/* Accent orb */}
        <div style={{
          position: "absolute", top: -60, right: -60, width: 200, height: 200,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(15,164,175,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <div style={{
                height: 52, width: 52, borderRadius: 15,
                background: ICON_GRAD, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 8px 24px rgba(15,164,175,0.3)",
              }}>
                <BookOpen size={22} />
              </div>
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
                  {course.name}
                </h1>
                {course.program_name && <p style={{ fontSize: 13, color: C.body, marginTop: 4 }}>{course.program_name}</p>}
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
              {course.teacher_name && (
                <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: C.body }}>
                  <User size={14} color={C.accent} /> {course.teacher_name}
                </span>
              )}
              {course.semester_name && (
                <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: C.body }}>
                  <Calendar size={14} color={C.accent} /> {course.semester_name}{course.academic_year ? ` · ${course.academic_year}` : ""}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
            {course.code && (
              <span style={{
                fontFamily: "monospace", fontSize: 12, fontWeight: 700,
                padding: "5px 12px", borderRadius: 8,
                background: "rgba(15,164,175,0.08)",
                border: "1px solid rgba(15,164,175,0.2)",
                color: C.accent, letterSpacing: "0.06em",
              }}>{course.code}</span>
            )}
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "5px 12px", borderRadius: 20,
              background: "rgba(16,185,129,0.08)", color: "#059669",
              border: "1px solid rgba(16,185,129,0.2)",
              fontSize: 11.5, fontWeight: 700,
            }}>
              Active
            </span>
          </div>
        </div>
      </div>

      {/* Stat mini cards */}
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(4, 1fr)" }} className="stat-grid">
        <StatMini label="Total Sessions" value={totalSessions} color={C.text}       bg={CARD_GRAD}                       border={C.border} />
        <StatMini label="Attended"       value={present}       color="#059669"      bg="rgba(16,185,129,0.05)"           border="rgba(16,185,129,0.18)" />
        <StatMini label="Absent"         value={absent}        color="#dc2626"      bg="rgba(239,68,68,0.05)"            border="rgba(239,68,68,0.18)" />
        <StatMini label="Rate"           value={`${rate}%`}    color={rate >= 75 ? "#059669" : "#d97706"} bg={rate >= 75 ? "rgba(16,185,129,0.05)" : "rgba(245,158,11,0.05)"} border={rate >= 75 ? "rgba(16,185,129,0.18)" : "rgba(245,158,11,0.2)"} />
      </div>

      {/* Tabs */}
      <div style={{
        background: "rgba(248,250,252,0.8)", border: `1px solid ${C.border}`,
        borderRadius: 16, padding: "6px",
        display: "flex", gap: 4, boxShadow: SHADOW.rest,
      }}>
        {(["overview", "attendance"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: "10px 24px", borderRadius: 12,
              fontSize: 13.5, fontWeight: activeTab === tab ? 700 : 500,
              background: activeTab === tab ? CARD_GRAD : "transparent",
              color: activeTab === tab ? C.text : C.muted,
              border: activeTab === tab ? `1px solid ${C.border}` : "1px solid transparent",
              boxShadow: activeTab === tab ? "0 4px 14px rgba(15,23,42,0.08)" : "none",
              cursor: "pointer", transition: EASE_ALL,
            }}
          >
            {tab === "overview" ? "Overview" : "Attendance History"}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }} className="detail-grid">

            {/* Course Info */}
            <Card>
              <CardHead title="Course Details" sub="Academic information" Icon={BookOpen} />
              <div style={{ padding: "0 28px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
                {course.academic_year && course.semester_name && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <Calendar size={16} color={C.accent} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Academic Period</p>
                      <p style={{ fontSize: 13.5, color: C.text, fontWeight: 600, marginTop: 2 }}>
                        {course.academic_year} · {course.semester_name}
                      </p>
                    </div>
                  </div>
                )}
                {course.program_name && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <GraduationCap size={16} color={C.accent} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Program</p>
                      <p style={{ fontSize: 13.5, color: C.text, fontWeight: 600, marginTop: 2 }}>{course.program_name}</p>
                    </div>
                  </div>
                )}
                <div style={{
                  padding: "12px 14px", borderRadius: 12,
                  background: "rgba(15,164,175,0.05)", border: `1px solid ${C.borderHov}`,
                  display: "flex", alignItems: "flex-start", gap: 10,
                }}>
                  <Info size={14} color={C.accent} style={{ marginTop: 1, flexShrink: 0 }} />
                  <p style={{ fontSize: 12, color: C.body, lineHeight: 1.6 }}>
                    To mark attendance, use the <strong style={{ color: C.text }}>entry code shared by your teacher</strong> in class.
                  </p>
                </div>
              </div>
            </Card>

            {/* Teacher Info */}
            <Card>
              <CardHead title="Instructor" sub="Course teacher details" Icon={User} />
              <div style={{ padding: "0 28px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
                {course.teacher_name && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <User size={16} color={C.accent} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Name</p>
                      <p style={{ fontSize: 13.5, color: C.text, fontWeight: 600, marginTop: 2 }}>{course.teacher_name}</p>
                    </div>
                  </div>
                )}
                {course.teacher_email && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <Mail size={16} color={C.accent} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Email</p>
                      <p style={{ fontSize: 13.5, color: C.text, fontWeight: 600, marginTop: 2 }}>{course.teacher_email}</p>
                    </div>
                  </div>
                )}
                {!course.teacher_name && !course.teacher_email && (
                  <p style={{ fontSize: 13, color: C.body }}>No instructor information available.</p>
                )}
              </div>
            </Card>
          </div>

          {/* Performance summary */}
          {totalSessions > 0 && (
            <Card>
              <CardHead title="Performance Summary" sub="Your overall attendance for this course" Icon={Award} />
              <div style={{ padding: "0 28px 28px" }}>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: C.body }}>Overall Attendance</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{rate}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 8, background: "rgba(175,221,229,0.3)", overflow: "hidden" }}>
                    <div style={{
                      width: `${rate}%`, height: "100%", borderRadius: 8,
                      background: rate >= 75 ? "linear-gradient(90deg,#059669,#10b981)" : rate >= 50 ? "linear-gradient(90deg,#d97706,#f59e0b)" : "linear-gradient(90deg,#dc2626,#ef4444)",
                      transition: `width 0.9s ${SPRING}`,
                    }} />
                  </div>
                  <p style={{ fontSize: 11.5, color: C.body, marginTop: 8 }}>
                    {rate >= 75
                      ? "✅ You're on track — great attendance!"
                      : "⚠️ Below 75% target — consider attending more classes."}
                  </p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {[
                    { label: "Sessions Held", value: totalSessions, color: C.text    },
                    { label: "Present",        value: present,       color: "#059669" },
                    { label: "Absent",         value: absent,        color: "#dc2626" },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{
                      padding: "14px 16px", borderRadius: 12,
                      background: "#f8fafc", border: `1px solid ${C.border}`,
                      textAlign: "center",
                    }}>
                      <p style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{label}</p>
                      <p style={{ fontSize: 28, fontWeight: 800, color, letterSpacing: "-0.03em", lineHeight: 1, marginTop: 6 }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ATTENDANCE TAB */}
      {activeTab === "attendance" && (
        <Card>
          <CardHead title="Attendance History" sub="All session records for this course" Icon={Calendar} />
          <div style={{ padding: "0 0 0" }}>
            {records.length === 0 ? (
              <div style={{ padding: "56px 0", textAlign: "center" }}>
                <Calendar size={36} color={C.mutedLight} style={{ margin: "0 auto 12px" }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>No attendance records yet</p>
                <p style={{ fontSize: 12, color: C.body, marginTop: 5 }}>Records will appear here after sessions are held.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 480, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["Date", "Status"].map((h) => (
                        <th key={h} style={{
                          padding: "12px 28px", textAlign: "left",
                          fontSize: 10.5, fontWeight: 700, color: C.muted,
                          textTransform: "uppercase", letterSpacing: "0.09em",
                          borderBottom: `1px solid ${C.border}`,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records
                      .slice()
                      .sort((a, b) => (a.date > b.date ? -1 : 1))
                      .map((record, idx, arr) => {
                        const ok = record.status;
                        return (
                          <AttendanceRow key={`${record.date}-${idx}`} record={record} isLast={idx === arr.length - 1} ok={ok} />
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 1100px) { .stat-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 900px)  { .detail-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 640px)  { .stat-grid { grid-template-columns: 1fr 1fr !important; } }
      `}</style>
    </div>
  );
}

function AttendanceRow({ record, isLast, ok }: { record: any; isLast: boolean; ok: boolean }) {
  const EASE_ALL = `all 0.25s cubic-bezier(.22,.68,0,1.2)`;
  const C = { text: "#0f172a", body: "#475569", border: "rgba(226,232,240,0.7)" };
  const [hov, setHov] = useState(false);
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
      <td style={{ padding: "14px 28px", fontSize: 13.5, fontWeight: 600, color: C.text }}>
        {new Date(record.date).toLocaleDateString("en-US", {
          weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
        })}
      </td>
      <td style={{ padding: "14px 28px" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "4px 12px", borderRadius: 20, fontSize: 11.5, fontWeight: 700,
          background: ok ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
          color: ok ? "#059669" : "#dc2626",
          border: `1px solid ${ok ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
        }}>
          {ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
          {ok ? "Present" : "Absent"}
        </span>
      </td>
    </tr>
  );
}