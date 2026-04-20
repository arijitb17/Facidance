"use client";

/**
 * frontend/app/student/courses/page.tsx
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen, User, Hash, Search, Calendar,
  GraduationCap, ArrowUpRight, X, ChevronRight,
} from "lucide-react";
import { useStudentCourses } from "@/hooks/useStudent";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const SPRING   = "cubic-bezier(.22,.68,0,1.2)";
const EASE_ALL = `all 0.25s ${SPRING}`;

const SHADOW = {
  rest:  "0 2px 12px rgba(0,49,53,0.06)",
  hover: "0 12px 36px rgba(0,49,53,0.12)",
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

// ─── Course Card ───────────────────────────────────────────────────────────────
function CourseCard({ course, onClick }: { course: any; onClick: () => void }) {
  const [hov, setHov] = useState(false);

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
        padding: "24px 22px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* Top accent stripe */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: hov ? ICON_GRAD : "transparent",
        transition: EASE_ALL,
      }} />

      {/* Header row: icon + title block + arrow */}
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>

        {/* Icon */}
        <div style={{
          height: 44, width: 44, minWidth: 44, borderRadius: 13,
          background: ICON_GRAD,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: hov ? "0 8px 24px rgba(15,164,175,0.38)" : "0 6px 20px rgba(15,164,175,0.22)",
          transform: hov ? "scale(1.1) rotate(-3deg)" : "scale(1) rotate(0deg)",
          transition: EASE_ALL,
        }}>
          <BookOpen size={19} color="#fff" />
        </div>

        {/* Title + badges */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: 15, fontWeight: 700, color: C.text,
            letterSpacing: "-0.02em", lineHeight: 1.3,
            marginBottom: 6,
            /* allow wrapping so long names don't overflow */
            wordBreak: "break-word",
          }}>
            {course.name}
          </p>

          {/* badges row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 8px",
              borderRadius: 20,
              background: "rgba(15,164,175,0.1)", color: C.accent,
            }}>
              Active
            </span>
            {course.code && (
              <span style={{
                fontFamily: "monospace", fontSize: 11, fontWeight: 700,
                padding: "2px 8px", borderRadius: 7,
                background: "rgba(15,164,175,0.08)", color: C.accent,
                letterSpacing: "0.04em",
              }}>
                {course.code}
              </span>
            )}
          </div>
        </div>

        {/* Arrow */}
        <ArrowUpRight
          size={15} color={C.accent}
          style={{
            flexShrink: 0,
            opacity: hov ? 1 : 0.2,
            transform: hov ? "translate(2px,-2px)" : "translate(0,0)",
            transition: EASE_ALL,
            marginTop: 2,
          }}
        />
      </div>

      {/* Meta rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {course.teacher_name && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <User size={13} color={C.accent} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: C.body, fontWeight: 500 }}>
              {course.teacher_name}
            </span>
          </div>
        )}
        {course.semester_name && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Calendar size={13} color={C.accent} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: C.body, fontWeight: 500 }}>
              {course.semester_name}{course.academic_year ? ` · ${course.academic_year}` : ""}
            </span>
          </div>
        )}
        {course.program_name && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <GraduationCap size={13} color={C.accent} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: C.body, fontWeight: 500 }}>
              {course.program_name}
            </span>
          </div>
        )}
        {course.entry_code && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Hash size={13} color={C.accent} style={{ flexShrink: 0 }} />
            <span style={{
              fontFamily: "monospace", fontSize: 12, fontWeight: 700,
              color: C.accent,
              background: "rgba(15,164,175,0.08)",
              padding: "1px 8px", borderRadius: 6,
            }}>
              {course.entry_code}
            </span>
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div style={{
        paddingTop: 14,
        borderTop: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 12, color: C.body }}>View details</span>
        <ChevronRight
          size={14} color={C.accent}
          style={{ opacity: hov ? 1 : 0.4, transition: EASE_ALL }}
        />
      </div>
    </div>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{
      background: CARD_GRAD, border: `1px solid ${C.border}`,
      borderRadius: 20, padding: "24px 22px 20px", boxShadow: SHADOW.rest,
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: "#e2e8f0", flexShrink: 0 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ width: "65%", height: 16, borderRadius: 6, ...shimmerStyle }} />
          <div style={{ width: "35%", height: 12, borderRadius: 6, ...shimmerStyle }} />
        </div>
      </div>
      {[80, 70, 60].map((w, i) => (
        <div key={i} style={{ width: `${w}%`, height: 12, borderRadius: 6, ...shimmerStyle }} />
      ))}
    </div>
  );
}

const shimmerStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, #f1f5f9 25%, #e8f0f5 50%, #f1f5f9 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.6s ease-in-out infinite",
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function MyCoursesPage() {
  const router = useRouter();
  const { data: courses, loading, error, refetch } = useStudentCourses();
  const [searchTerm,    setSearchTerm]    = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const courseList = courses ?? [];
  const filteredCourses = courseList.filter((course) => {
    const s = searchTerm.toLowerCase();
    return (
      course.name.toLowerCase().includes(s) ||
      course.code.toLowerCase().includes(s) ||
      (course.teacher_name ?? "").toLowerCase().includes(s)
    );
  });

  const navigateToCourse = (code: string, name: string) => {
    const slug = `${code}-${slugifyCourseName(name)}`;
    router.push(`/student/courses/${slug}`);
  };

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 18px", borderRadius: 12,
          background: "#fef2f2", border: "1px solid #fecaca",
          color: "#dc2626", fontSize: 13, fontWeight: 500,
        }}>
          ⚠️ {error}
        </div>
        <button onClick={refetch} style={{
          padding: "9px 18px", borderRadius: 11, fontSize: 13, fontWeight: 600,
          background: ICON_GRAD, color: "#fff", border: "none",
          cursor: "pointer", width: "fit-content",
        }}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* Page header */}
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
        <h1 style={{
          fontSize: 28, fontWeight: 800, color: C.text,
          letterSpacing: "-0.03em", lineHeight: 1.1,
        }}>
          My Courses
        </h1>
        <p style={{ fontSize: 14, color: C.body, marginTop: 6 }}>
          {loading
            ? "Loading…"
            : `${courseList.length} course${courseList.length !== 1 ? "s" : ""} enrolled`}
        </p>
      </div>

      {/* Search bar */}
      <div style={{
        display: "flex", gap: 12, alignItems: "center",
        background: "#ffffff",
        border: `1px solid ${searchFocused ? C.borderHov : C.border}`,
        borderRadius: 14, padding: "10px 16px",
        boxShadow: searchFocused
          ? `0 0 0 3px rgba(15,164,175,0.12), ${SHADOW.rest}`
          : SHADOW.rest,
        transition: EASE_ALL,
      }}>
        <Search size={16} color={searchFocused ? C.accent : C.mutedLight}
          style={{ flexShrink: 0, transition: EASE_ALL }} />
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search by course name, code or teacher…"
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            fontSize: 13.5, color: C.text, fontWeight: 500,
          }}
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm("")} style={{
            background: "none", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", padding: 2, borderRadius: 6,
          }}>
            <X size={14} color={C.mutedLight} />
          </button>
        )}
      </div>

      {/* Result count */}
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

      {/* Card grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        gap: 20,
      }}>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : filteredCourses.length === 0
          ? (
            <div style={{
              gridColumn: "1 / -1",
              display: "flex", flexDirection: "column", alignItems: "center",
              padding: "72px 24px",
              background: CARD_GRAD,
              border: `1px dashed ${C.borderHov}`,
              borderRadius: 20, gap: 14,
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
                  {courseList.length === 0 ? "No courses enrolled yet" : "No courses found"}
                </p>
                <p style={{ fontSize: 13, color: C.body, marginTop: 6 }}>
                  {courseList.length === 0
                    ? "Your enrolled courses will appear here once assigned."
                    : "Try a different search term."}
                </p>
              </div>
            </div>
          )
          : filteredCourses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onClick={() => navigateToCourse(course.code, course.name)}
            />
          ))
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