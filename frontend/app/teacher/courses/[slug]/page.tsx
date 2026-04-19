"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  BookOpen, Building2, CalendarDays, GraduationCap,
  CheckCircle2, Search, Download, ArrowLeft,
  UserCheck, UserX, X, TrendingUp,
} from "lucide-react";
import { teacherCoursesApi, type TeacherCourse, type CourseStudentItem } from "@/lib/teacher-api";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function slugifyCourseName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ─── Components ───────────────────────────────────────────────────────────────
function Btn({
  children, onClick, style, danger,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
  danger?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "9px 18px", borderRadius: 11, fontSize: 13, fontWeight: 600,
        cursor: "pointer", letterSpacing: "-0.01em",
        transform: hov ? "translateY(-2px) scale(1.01)" : "translateY(0) scale(1)",
        transition: EASE_ALL,
        ...(danger ? {
          background: hov ? "#fef2f2" : C.white,
          color: "#ef4444",
          border: "1px solid rgba(239,68,68,0.3)",
          boxShadow: hov ? "0 8px 24px rgba(239,68,68,0.12)" : SHADOW.rest,
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

function PrimaryBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "9px 18px", borderRadius: 11, fontSize: 13, fontWeight: 600,
        cursor: "pointer", background: ICON_GRAD, color: "#fff", border: "none",
        boxShadow: hov ? SHADOW.active : `0 8px 24px rgba(15,164,175,0.35)`,
        transform: hov ? "translateY(-2px) scale(1.01)" : "translateY(0) scale(1)",
        transition: EASE_ALL,
      }}
    >
      {children}
    </button>
  );
}

interface StatCardProps {
  title: string;
  value: number | string;
  Icon: React.ElementType;
  sub?: string;
}

function StatCard({ title, value, Icon,  sub }: StatCardProps) {
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
        overflow: "hidden", position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            {title}
          </p>
          <p style={{ fontSize: 34, fontWeight: 800, color: C.text, lineHeight: 1, marginTop: 10, letterSpacing: "-0.03em" }}>
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

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function CourseDetailPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [course, setCourse] = useState<TeacherCourse | null>(null);
  const [students, setStudents] = useState<CourseStudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedSlug = useMemo<{ code: string; nameSlug: string } | null>(() => {
    if (!slug) return null;
    const parts = slug.split("-");
    if (parts.length < 3) return null;
    return { code: parts.slice(0, 2).join("-"), nameSlug: parts.slice(2).join("-") };
  }, [slug]);

  useEffect(() => {
    async function resolveCourse() {
      if (!parsedSlug) { setError("Invalid course link"); setLoading(false); return; }
      try {
        const all = await teacherCoursesApi.list();
        const match = all.find(
          (c) => c.code === parsedSlug.code && slugifyCourseName(c.name) === parsedSlug.nameSlug
        );
        if (!match) throw new Error("Course not found.");
        setCourse(match);
        const detail = await teacherCoursesApi.getStudents(match.id);
        setStudents(detail.students);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load course details");
      } finally {
        setLoading(false);
      }
    }
    resolveCourse();
  }, [parsedSlug]);

  function exportToExcel() {
    if (!course) return;
    const data = students.map((s) => ({
      Name: s.user.name,
      Email: s.user.email,
      Program: s.program?.name ?? "",
      "Face Registered": s.faceEmbedding ? "Yes" : "No",
      "Attendance Count": s._count.attendance,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, `${course.name}_students.xlsx`);
  }

  const filteredStudents = students.filter((s) => {
    const q = searchTerm.toLowerCase();
    return (
      s.user.name.toLowerCase().includes(q) ||
      s.user.email.toLowerCase().includes(q) ||
      (s.program?.name || "").toLowerCase().includes(q)
    );
  });

  const registeredCount = students.filter((s) => s.faceEmbedding).length;
  const totalSessions = course?.session_count ?? 0;
  const attendanceRate =
    course && students.length > 0 && totalSessions > 0
      ? Math.round(
          (students.reduce((sum, s) => sum + s._count.attendance, 0) /
            (students.length * totalSessions)) *
            100
        )
      : 0;

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <SkeletonLine w={200} h={40} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ background: CARD_GRAD, border: `1px solid ${C.border}`, borderRadius: 18, padding: 24 }}>
              <SkeletonLine w="60%" h={12} />
              <SkeletonLine w="40%" h={36} />
            </div>
          ))}
        </div>
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Btn onClick={() => router.push("/teacher/courses")}>
          <ArrowLeft size={14} /> Back to Courses
        </Btn>
        <div style={{
          background: "#fef2f2", border: "1px solid #fecaca",
          borderRadius: 18, padding: "28px 32px",
          maxWidth: 440,
        }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#dc2626", marginBottom: 8 }}>Error</p>
          <p style={{ fontSize: 13, color: "#b91c1c", lineHeight: 1.6 }}>{error || "Course not found"}</p>
          <button
            onClick={() => router.push("/teacher/courses")}
            style={{
              marginTop: 18, background: "#dc2626", color: "#fff",
              border: "none", borderRadius: 10, padding: "8px 18px",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            Go back to courses
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* Back */}
      <div>
        <Btn onClick={() => router.push("/teacher/courses")}>
          <ArrowLeft size={14} /> Back to Courses
        </Btn>
      </div>

      {/* Course header card */}
      <div style={{
        background: CARD_GRAD,
        border: `1px solid ${C.border}`,
        borderRadius: 20, padding: "28px 32px",
        boxShadow: SHADOW.rest,
        position: "relative", overflow: "hidden",
      }}>
        {/* Accent orb */}
        <div style={{
          position: "absolute", top: -60, right: -60,
          width: 200, height: 200, borderRadius: "50%",
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
                <p style={{ fontSize: 13, color: C.body, marginTop: 4 }}>{course.program}</p>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
              {[
                { Icon: Building2, val: course.department },
                { Icon: CalendarDays, val: course.semester },
              ].map(({ Icon, val }) => (
                <span key={val} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: C.body }}>
                  <Icon size={14} color={C.accent} /> {val}
                </span>
              ))}
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
            <PrimaryBtn onClick={exportToExcel}>
              <Download size={14} /> Export Excel
            </PrimaryBtn>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(4, 1fr)" }} className="stat-grid">
        <StatCard title="Total Students"  value={students.length}    Icon={GraduationCap} />
        <StatCard title="Face Registered" value={registeredCount}    Icon={UserCheck}     />
        <StatCard title="Total Sessions"  value={totalSessions}      Icon={CheckCircle2}  />
        <StatCard title="Avg Attendance"  value={`${attendanceRate}%`} Icon={TrendingUp}  />
      </div>

      {/* Students table card */}
      <div style={{
        background: CARD_GRAD,
        border: `1px solid ${C.border}`,
        borderRadius: 20, overflow: "hidden",
        boxShadow: SHADOW.rest,
      }}>
        {/* Table header */}
        <div style={{
          padding: "22px 28px 16px",
          display: "flex", flexWrap: "wrap", alignItems: "center",
          justifyContent: "space-between", gap: 14,
          borderBottom: `1px solid ${C.border}`,
        }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: "-0.02em" }}>
              Enrolled Students
            </p>
            <p style={{ fontSize: 12, color: C.body, marginTop: 3 }}>
              {students.length} student{students.length !== 1 ? "s" : ""} in this course
            </p>
          </div>
          {/* Search */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "#f8fafc",
            border: `1px solid ${searchFocused ? C.borderHov : C.border}`,
            borderRadius: 11, padding: "8px 14px",
            boxShadow: searchFocused ? `0 0 0 3px rgba(15,164,175,0.1)` : "none",
            transition: EASE_ALL, minWidth: 260,
          }}>
            <Search size={14} color={searchFocused ? C.accent : C.mutedLight} style={{ flexShrink: 0, transition: EASE_ALL }} />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search students…"
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                fontSize: 13, color: C.text,
              }}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
                <X size={13} color={C.mutedLight} />
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        {filteredStudents.length === 0 ? (
          <div style={{ padding: "56px 0", textAlign: "center" }}>
            <GraduationCap size={36} color={C.mutedLight} style={{ margin: "0 auto 12px" }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
              {searchTerm ? "No matching students" : "No students enrolled"}
            </p>
            <p style={{ fontSize: 12, color: C.body, marginTop: 5 }}>
              {searchTerm ? "Try a different search term." : "Students will appear here once enrolled."}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Student", "Program", "Face Data", "Attendance"].map((h) => (
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
                {filteredStudents.map((student, idx) => (
                  <StudentRow
                    key={student.id}
                    student={student}
                    totalSessions={totalSessions}
                    isLast={idx === filteredStudents.length - 1}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @media (max-width: 1100px) { .stat-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 540px)  { .stat-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}

function StudentRow({
  student, totalSessions, isLast,
}: {
  student: CourseStudentItem;
  totalSessions: number;
  isLast: boolean;
}) {
  const [hov, setHov] = useState(false);
  const pct = totalSessions > 0
    ? Math.round((student._count.attendance / totalSessions) * 100)
    : 0;
  const faceOk = student.faceEmbedding;

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
      <td style={{ padding: "14px 24px" }}>
        <p style={{ fontSize: 13.5, fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>
          {student.user.name}
        </p>
        <p style={{ fontSize: 11.5, color: C.body, marginTop: 2 }}>{student.user.email}</p>
      </td>
      <td style={{ padding: "14px 24px", fontSize: 13, color: C.body }}>
        {student.program?.name ?? "—"}
      </td>
      <td style={{ padding: "14px 24px" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "4px 11px", borderRadius: 20, fontSize: 11.5, fontWeight: 700,
          background: faceOk ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
          color: faceOk ? "#059669" : "#dc2626",
          border: `1px solid ${faceOk ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
        }}>
          {faceOk ? <UserCheck size={12} /> : <UserX size={12} />}
          {faceOk ? "Registered" : "Missing"}
        </span>
      </td>
      <td style={{ padding: "14px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, maxWidth: 100, height: 5, borderRadius: 5, background: "rgba(175,221,229,0.3)", overflow: "hidden" }}>
            <div style={{
              width: `${pct}%`, height: "100%", borderRadius: 5,
              background: pct >= 75 ? "linear-gradient(90deg,#059669,#10b981)"
                         : pct >= 50 ? "linear-gradient(90deg,#d97706,#f59e0b)"
                         : "linear-gradient(90deg,#dc2626,#ef4444)",
              transition: `width 0.8s ${SPRING}`,
            }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
            {student._count.attendance}/{totalSessions}
          </span>
        </div>
      </td>
    </tr>
  );
}