"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen, Building2, CalendarDays, KeyRound,
  GraduationCap, CheckCircle2, Search, ArrowUpRight,
  Users, Layers, X,
} from "lucide-react";
import { teacherCoursesApi, type TeacherCourse } from "@/lib/teacher-api";

// ─── Design tokens (matches dashboard) ───────────────────────────────────────
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
  cardBg:     "#ffffff",
};

const ICON_GRAD = `linear-gradient(135deg, ${C.primary} 0%, ${C.accent} 100%)`;
const CARD_GRAD = "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function slugifyCourseName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// ─── Components ───────────────────────────────────────────────────────────────
function Btn({
  children, onClick, primary, small, style,
}: {
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
          boxShadow: hov ? SHADOW.active : `0 8px 24px rgba(15,164,175,0.35)`,
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

function StatPill({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "10px 16px", borderRadius: 12,
      background: "rgba(248,250,252,0.8)",
      border: `1px solid ${C.border}`,
      minWidth: 68,
    }}>
      <span style={{ fontSize: 20, fontWeight: 900, color, letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 10, color: C.body, marginTop: 3, fontWeight: 500 }}>{label}</span>
    </div>
  );
}

function CourseCard({ course, onClick }: { course: TeacherCourse; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  const sessRate = course.session_count > 0 && course.student_count > 0
    ? Math.min(100, Math.round((course.session_count / (course.session_count + 2)) * 100))
    : 0;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: CARD_GRAD,
        border: `1px solid ${hov ? C.borderHov : C.border}`,
        borderRadius: 20,
        boxShadow: hov ? SHADOW.hover : SHADOW.rest,
        transform: hov ? "translateY(-6px) scale(1.01)" : "translateY(0) scale(1)",
        transition: EASE_ALL,
        cursor: "pointer",
        overflow: "hidden",
        position: "relative",
        padding: "26px 24px 22px",
        display: "flex", flexDirection: "column", gap: 18,
      }}
    >
      {/* Top stripe */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: hov ? ICON_GRAD : "transparent",
        transition: EASE_ALL,
      }} />

      {/* Header */}
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <p style={{
              fontSize: 15.5, fontWeight: 700, color: C.text,
              letterSpacing: "-0.02em", lineHeight: 1.2,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {course.name}
            </p>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 8px",
              borderRadius: 20, background: "rgba(15,164,175,0.1)", color: C.accent,
              flexShrink: 0,
            }}>
              Active
            </span>
          </div>
          <p style={{ fontSize: 12, color: C.body, marginTop: 3 }}>{course.program}</p>
        </div>
        <ArrowUpRight
          size={15}
          color={C.accent}
          style={{
            flexShrink: 0,
            opacity: hov ? 1 : 0.2,
            transform: hov ? "translate(2px,-2px)" : "translate(0,0)",
            transition: EASE_ALL,
          }}
        />
      </div>

      {/* Meta */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[
          { Icon: Building2,  val: course.department },
          { Icon: CalendarDays, val: course.semester   },
          { Icon: KeyRound,   val: course.entry_code, mono: true },
        ].map(({ Icon, val, mono }) => (
          <div key={val} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon size={13} color={C.accent} style={{ flexShrink: 0 }} />
            {mono ? (
              <span style={{
                fontSize: 11, fontWeight: 700,
                fontFamily: "monospace",
                padding: "2px 8px", borderRadius: 7,
                background: "rgba(15,164,175,0.08)",
                color: C.accent, letterSpacing: "0.04em",
              }}>{val}</span>
            ) : (
              <span style={{ fontSize: 12.5, color: C.body, fontWeight: 500 }}>{val}</span>
            )}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: C.body, fontWeight: 500 }}>Session activity</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{sessRate}%</span>
        </div>
        <div style={{ height: 5, borderRadius: 5, background: "rgba(175,221,229,0.3)", overflow: "hidden" }}>
          <div style={{
            width: `${sessRate}%`, height: "100%",
            background: ICON_GRAD, borderRadius: 5,
            transition: `width 0.9s ${SPRING}`,
          }} />
        </div>
      </div>

      {/* Footer stats */}
      <div style={{
        display: "flex", gap: 10,
        paddingTop: 14,
        borderTop: `1px solid ${C.border}`,
      }}>
        <StatPill value={course.student_count} label="Students" color={C.text} />
        <StatPill value={course.session_count} label="Sessions" color={C.accent} />
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{
      background: CARD_GRAD, border: `1px solid ${C.border}`,
      borderRadius: 20, padding: "26px 24px 22px",
      boxShadow: SHADOW.rest,
    }}>
      {[{ w: "60%", h: 18 }, { w: "40%", h: 13 }, { w: "80%", h: 13 }, { w: "70%", h: 13 }, { w: "50%", h: 13 }].map((s, i) => (
        <div key={i} style={{
          width: s.w, height: s.h, borderRadius: 6, marginBottom: 10,
          background: "linear-gradient(90deg, #f1f5f9 25%, #e8f0f5 50%, #f1f5f9 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.6s ease-in-out infinite",
        }} />
      ))}
    </div>
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div style={{
      gridColumn: "1 / -1",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "72px 24px",
      background: CARD_GRAD,
      border: `1px dashed ${C.borderHov}`,
      borderRadius: 20,
      gap: 14,
    }}>
      <div style={{
        width: 60, height: 60, borderRadius: 16,
        background: "rgba(175,221,229,0.2)",
        border: `1px solid ${C.borderHov}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <BookOpen size={24} color={C.accent} />
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: "-0.02em" }}>
          {hasSearch ? "No courses found" : "No courses assigned yet"}
        </p>
        <p style={{ fontSize: 13, color: C.body, marginTop: 6 }}>
          {hasSearch ? "Try a different search term." : "Your assigned courses will appear here."}
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function TeacherCourses() {
  const router = useRouter();
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    teacherCoursesApi.list().then(setCourses).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filteredCourses = courses.filter((c) => {
    const s = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(s) ||
      (c.code || "").toLowerCase().includes(s) ||
      (c.entry_code || "").toLowerCase().includes(s) ||
      (c.program || "").toLowerCase().includes(s) ||
      (c.department || "").toLowerCase().includes(s)
    );
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* Header */}
      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "center",
        justifyContent: "space-between", gap: 16, padding: "4px 0 8px",
      }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            My Courses
          </h1>
          <p style={{ fontSize: 14, color: C.body, marginTop: 6 }}>
            {loading ? "Loading…" : `${courses.length} course${courses.length !== 1 ? "s" : ""} assigned to you`}
          </p>
        </div>
      </div>

      {/* Search */}
      <div style={{
        display: "flex", gap: 12, alignItems: "center",
        background: CARD_GRAD,
        border: `1px solid ${focused ? C.borderHov : C.border}`,
        borderRadius: 14, padding: "10px 16px",
        boxShadow: focused ? `0 0 0 3px rgba(15,164,175,0.12), ${SHADOW.rest}` : SHADOW.rest,
        transition: EASE_ALL,
      }}>
        <Search size={16} color={focused ? C.accent : C.mutedLight} style={{ flexShrink: 0, transition: EASE_ALL }} />
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search by course name, code, program, or department…"
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            fontSize: 13.5, color: C.text, fontWeight: 500,
          }}
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm("")}
            style={{
              background: "none", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", padding: 2, borderRadius: 6,
            }}
          >
            <X size={14} color={C.mutedLight} />
          </button>
        )}
      </div>

      {/* Count badge */}
      {!loading && searchTerm && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
            background: "rgba(15,164,175,0.1)", color: C.accent,
          }}>
            {filteredCourses.length} result{filteredCourses.length !== 1 ? "s" : ""}
          </span>
          <span style={{ fontSize: 12, color: C.body }}>for "{searchTerm}"</span>
        </div>
      )}

      {/* Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: 20,
      }}>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : filteredCourses.length === 0
          ? <EmptyState hasSearch={!!searchTerm} />
          : filteredCourses.map((course) => {
              const slug = `${course.code}-${slugifyCourseName(course.name)}`;
              return (
                <CourseCard
                  key={course.id}
                  course={course}
                  onClick={() => router.push(`/teacher/courses/${slug}`)}
                />
              );
            })
        }
      </div>

      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}