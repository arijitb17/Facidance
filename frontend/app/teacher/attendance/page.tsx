"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen, Users, CheckCircle2, AlertCircle, Camera,
  GraduationCap, PlayCircle, Sparkles, Search, X, ChevronRight,
} from "lucide-react";
import {
  teacherHierarchyApi, teacherCoursesApi,
  type TeacherHierarchy, type CourseStudentItem,
} from "@/lib/teacher-api";

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
interface FlattenedCourse {
  id: string; name: string; entryCode: string;
  departmentName: string; programName: string;
  academicYearName: string; semesterName: string;
  displayPath: string; searchText: string;
}

function getDeptCode(n: string) {
  const words = n.split(/\s+/).filter((w) => !["and","of","department","dept.","dept"].includes(w.toLowerCase()));
  if (!words.length) return "GEN";
  return words.length === 1 ? words[0].replace(/[^a-zA-Z]/g,"").slice(0,3).toUpperCase() : words.map((w) => w[0]).join("").toUpperCase();
}
function getSemNum(n: string) { const m = n.match(/\d+/); return m ? parseInt(m[0]) : 0; }
function buildCode(dept: string, sem: string, idx: number) {
  return `${getDeptCode(dept)}-${getSemNum(sem)}${String(idx + 1).padStart(2, "0")}`;
}

// ─── Components ───────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: CARD_GRAD, border: `1px solid ${C.border}`, borderRadius: 20, overflow: "hidden", boxShadow: SHADOW.rest, ...style }}>
      {children}
    </div>
  );
}

function StatCard({ title, value, Icon, color }: { title: string; value: number; Icon: React.ElementType; color?: string }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: CARD_GRAD, border: `1px solid ${hov ? C.borderHov : C.border}`,
        borderRadius: 18, padding: "20px 22px",
        boxShadow: hov ? SHADOW.hover : SHADOW.rest,
        transform: hov ? "translateY(-4px) scale(1.01)" : "translateY(0) scale(1)",
        transition: EASE_ALL,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>{title}</p>
          <p style={{ fontSize: 32, fontWeight: 800, color: color ?? C.text, letterSpacing: "-0.03em", lineHeight: 1, marginTop: 9 }}>{value}</p>
        </div>
        <div style={{
          height: 48, width: 48, borderRadius: 14, background: ICON_GRAD,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: hov ? "0 8px 24px rgba(15,164,175,0.38)" : "0 6px 20px rgba(15,164,175,0.22)",
          transform: hov ? "scale(1.1) rotate(-3deg)" : "scale(1) rotate(0deg)",
          transition: EASE_ALL,
        }}>
          <Icon size={21} color="#fff" />
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  children, onClick, disabled, variant = "primary",
}: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  variant?: "primary" | "warning" | "secondary";
}) {
  const [hov, setHov] = useState(false);
  const styles: Record<string, React.CSSProperties> = {
    primary: {
      background: disabled ? "#e2e8f0" : ICON_GRAD,
      color: disabled ? C.muted : "#fff", border: "none",
      boxShadow: !disabled && hov ? SHADOW.active : !disabled ? "0 8px 24px rgba(15,164,175,0.3)" : "none",
    },
    warning: {
      background: disabled ? "#e2e8f0" : hov ? "#fef3c7" : "#fffbeb",
      color: disabled ? C.muted : "#b45309",
      border: `1px solid ${hov && !disabled ? "rgba(180,83,9,0.3)" : "rgba(245,158,11,0.3)"}`,
      boxShadow: !disabled && hov ? "0 8px 24px rgba(245,158,11,0.2)" : SHADOW.rest,
    },
    secondary: {
      background: hov ? "#f0f9fa" : C.white,
      color: hov ? C.primary : C.textSoft,
      border: `1px solid ${hov ? C.borderHov : C.border}`,
      boxShadow: hov ? SHADOW.hover : SHADOW.rest,
    },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: "11px 22px", borderRadius: 12, fontSize: 13.5, fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer", letterSpacing: "-0.01em",
        transition: EASE_ALL, opacity: disabled ? 0.65 : 1,
        transform: !disabled && hov ? "translateY(-2px) scale(1.01)" : "translateY(0) scale(1)",
        ...styles[variant],
      }}
    >
      {children}
    </button>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function TeacherAttendance() {
  const router = useRouter();
  const [currentView, setCurrentView] = useState<"select" | "students">("select");
  const [hierarchy, setHierarchy] = useState<TeacherHierarchy | null>(null);
  const [loadingHierarchy, setLoadingHierarchy] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<FlattenedCourse | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [students, setStudents] = useState<CourseStudentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [training, setTraining] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const allCourses = useMemo<FlattenedCourse[]>(() => {
    if (!hierarchy) return [];
    const courses: FlattenedCourse[] = [];
    hierarchy.departments.forEach((dept) => {
      dept.programs.forEach((program) => {
        program.academicYears.forEach((year) => {
          year.semesters.forEach((semester) => {
            semester.courses.forEach((course, index) => {
              const displayCode = buildCode(dept.name, semester.name, index);
              const displayPath = `${dept.name} → ${program.name} → ${year.name} → ${semester.name}`;
              const searchText = `${course.name} ${displayCode} ${dept.name} ${program.name} ${year.name} ${semester.name}`.toLowerCase();
              courses.push({ ...course, departmentName: dept.name, programName: program.name, academicYearName: year.name, semesterName: semester.name, displayPath, searchText });
            });
          });
        });
      });
    });
    return courses;
  }, [hierarchy]);

  const filteredCourses = useMemo(() => {
    if (!searchQuery.trim()) return allCourses;
    return allCourses.filter((c) => c.searchText.includes(searchQuery.toLowerCase()));
  }, [allCourses, searchQuery]);

  useEffect(() => {
    teacherHierarchyApi.get().then(setHierarchy).catch(() => alert("Failed to load courses")).finally(() => setLoadingHierarchy(false));
  }, []);

  async function fetchCourseStudents(courseId: string) {
    setLoading(true);
    try {
      const data = await teacherCoursesApi.getStudents(courseId);
      setStudents(data.students || []);
      setCurrentView("students");
    } catch (e) {
      alert("Error fetching students: " + (e instanceof Error ? e.message : "Unknown"));
    } finally {
      setLoading(false);
    }
  }

  function handleCourseSelect(course: FlattenedCourse) {
    setSelectedCourse(course);
    setSearchQuery("");
    setShowDropdown(false);
    fetchCourseStudents(course.id);
  }

  async function handleTrainStudents() {
    if (!selectedCourse) return;
    if (students.filter((s) => !s.faceEmbedding).length === 0) { alert("ℹ️ All students are already trained!"); return; }
    setTraining(true);
    try {
      const { teacherAttendanceApi } = await import("@/lib/teacher-api");
      const data = await teacherAttendanceApi.runTraining(selectedCourse.id);
      alert("✅ " + data.message);
      fetchCourseStudents(selectedCourse.id);
    } catch (e) {
      alert("❌ " + (e instanceof Error ? e.message : "Training failed"));
    } finally {
      setTraining(false);
    }
  }

  function handleCaptureAttendance() {
    if (!selectedCourse) return;
    if (students.filter((s) => s.faceEmbedding).length === 0) { alert("⚠️ No trained students yet. Please train the model first."); return; }
    localStorage.setItem("selectedCourseId", selectedCourse.id);
    localStorage.setItem("selectedCourseName", selectedCourse.name);
    router.push(`/teacher/attendance/batches?courseId=${selectedCourse.id}&courseName=${encodeURIComponent(selectedCourse.name)}`);
  }

  const trainedCount = students.filter((s) => s.faceEmbedding).length;
  const withPhotosCount = students.filter((s) => s.hasPhotos).length;
  const untrainedCount = students.length - trainedCount;

  if (loadingHierarchy) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%", margin: "0 auto 14px",
            border: "2px solid rgba(15,164,175,0.15)", borderTopColor: C.accent,
            animation: "spin 0.9s linear infinite",
          }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: C.body }}>Loading course data…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
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
            Attendance Management
          </h1>
          <p style={{ fontSize: 14, color: C.body, marginTop: 6 }}>
            Select a course, train the face recognition model, then capture live attendance.
          </p>
        </div>
      </div>

      {/* Course select */}
      {currentView === "select" && (
        <Card>
          <div style={{ padding: "22px 28px 0", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                height: 44, width: 44, borderRadius: 13, background: ICON_GRAD,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 6px 18px rgba(15,164,175,0.28)",
              }}>
                <BookOpen size={19} color="#fff" />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: "-0.02em" }}>Select Course</p>
                <p style={{ fontSize: 12, color: C.body, marginTop: 2 }}>
                  {allCourses.length} courses available — search to filter
                </p>
              </div>
            </div>
          </div>

          <div style={{ padding: "0 28px 28px", display: "flex", flexDirection: "column", gap: 0 }}>
            {/* Search input */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "#f8fafc",
              border: `1px solid ${searchFocused ? C.borderHov : C.border}`,
              borderRadius: showDropdown && filteredCourses.length > 0 ? "11px 11px 0 0" : 11,
              padding: "10px 14px",
              boxShadow: searchFocused ? `0 0 0 3px rgba(15,164,175,0.1)` : SHADOW.rest,
              transition: "border-color 0.2s, box-shadow 0.2s",
            }}>
              <Search size={14} color={searchFocused ? C.accent : C.mutedLight} style={{ flexShrink: 0, transition: EASE_ALL }} />
              <input
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                onFocus={() => { setShowDropdown(true); setSearchFocused(true); }}
                onBlur={() => { setTimeout(() => setShowDropdown(false), 180); setSearchFocused(false); }}
                placeholder="Search by course name, department, program, or semester…"
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13.5, color: C.text }}
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(""); setShowDropdown(false); }} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
                  <X size={13} color={C.mutedLight} />
                </button>
              )}
            </div>

            {/* Dropdown */}
            {showDropdown && filteredCourses.length > 0 && (
              <div style={{
                border: `1px solid ${C.borderHov}`, borderTop: "none",
                borderRadius: "0 0 11px 11px",
                maxHeight: 300, overflowY: "auto",
                boxShadow: "0 12px 32px rgba(0,49,53,0.1)",
                background: C.white,
              }}>
                {filteredCourses.map((course, idx) => (
                  <CourseOption key={course.id} course={course} isLast={idx === filteredCourses.length - 1} onSelect={handleCourseSelect} />
                ))}
              </div>
            )}
            {showDropdown && searchQuery && filteredCourses.length === 0 && (
              <div style={{
                border: `1px solid ${C.border}`, borderTop: "none",
                borderRadius: "0 0 11px 11px", padding: "20px 16px",
                textAlign: "center", background: C.white,
              }}>
                <p style={{ fontSize: 13, color: C.body }}>No courses found for "{searchQuery}"</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Students view */}
      {currentView === "students" && selectedCourse && (
        <>
          {/* Selected course pill */}
          <div style={{
            display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
            gap: 14, padding: "18px 24px",
            background: "rgba(15,164,175,0.06)",
            border: `1px solid ${C.borderHov}`,
            borderRadius: 16,
          }}>
            <div>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                Selected Course
              </p>
              <p style={{ fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: "-0.02em" }}>{selectedCourse.name}</p>
              <p style={{ fontSize: 12, color: C.body, marginTop: 3 }}>{selectedCourse.displayPath}</p>
            </div>
            <button
              onClick={() => { setSelectedCourse(null); setStudents([]); setCurrentView("select"); }}
              style={{
                fontSize: 12, fontWeight: 600, color: C.body,
                background: C.white, border: `1px solid ${C.border}`,
                borderRadius: 9, padding: "7px 14px", cursor: "pointer",
                transition: EASE_ALL,
              }}
            >
              Change course
            </button>
          </div>

          {/* Stat cards */}
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(4, 1fr)" }} className="stat-grid">
            <StatCard title="Total Students" value={students.length}   Icon={Users}        />
            <StatCard title="Trained"         value={trainedCount}       Icon={CheckCircle2} color={trainedCount > 0 ? C.accent : C.text} />
            <StatCard title="Have Photos"     value={withPhotosCount}    Icon={Camera}       />
            <StatCard title="Not Trained"     value={untrainedCount}     Icon={AlertCircle}  color={untrainedCount > 0 ? "#dc2626" : C.text} />
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center" }}>
            <ActionBtn
              variant="warning"
              onClick={handleTrainStudents}
              disabled={training || loading}
            >
              <Sparkles size={17} />
              {training ? "Training model…" : "Train Recognition Model"}
            </ActionBtn>
            <ActionBtn
              variant="primary"
              onClick={handleCaptureAttendance}
              disabled={loading || trainedCount === 0}
            >
              <PlayCircle size={17} />
              Capture Attendance
            </ActionBtn>
          </div>

          {/* Students table */}
          <Card>
            <div style={{
              padding: "22px 28px 16px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              borderBottom: `1px solid ${C.border}`,
            }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: "-0.02em" }}>Enrolled Students</p>
                <p style={{ fontSize: 12, color: C.body, marginTop: 3 }}>{students.length} total enrolled</p>
              </div>
            </div>

            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  border: "2px solid rgba(15,164,175,0.15)", borderTopColor: C.accent,
                  animation: "spin 0.9s linear infinite",
                }} />
              </div>
            ) : students.length === 0 ? (
              <div style={{ padding: "56px 0", textAlign: "center" }}>
                <GraduationCap size={36} color={C.mutedLight} style={{ margin: "0 auto 12px" }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>No students enrolled</p>
                <p style={{ fontSize: 12, color: C.body, marginTop: 5 }}>Students will appear here once enrolled in this course.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 500, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["Student", "Photos", "Photo Count", "Status"].map((h) => (
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
                    {students.map((student, idx) => (
                      <AttendanceStudentRow key={student.id} student={student} isLast={idx === students.length - 1} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Next steps hint */}
          <div style={{
            padding: "20px 24px", borderRadius: 16,
            background: "rgba(15,164,175,0.05)",
            border: `1px solid ${C.borderHov}`,
          }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.primary, marginBottom: 10 }}>📋 Next Steps</p>
            <ol style={{ paddingLeft: 18, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {trainedCount === 0 ? (
                <>
                  <li style={{ fontSize: 13, color: C.body, lineHeight: 1.6 }}>Make sure each student has captured photos using the photo tool.</li>
                  <li style={{ fontSize: 13, color: C.body, lineHeight: 1.6 }}>Click <strong style={{ color: C.text }}>Train Recognition Model</strong> to generate face embeddings.</li>
                  <li style={{ fontSize: 13, color: C.body, lineHeight: 1.6 }}>After training, use <strong style={{ color: C.text }}>Capture Attendance</strong> to start a live session.</li>
                </>
              ) : (
                <>
                  <li style={{ fontSize: 13, color: C.body, lineHeight: 1.6 }}>Click <strong style={{ color: C.text }}>Capture Attendance</strong> to start the 45-minute AI session.</li>
                  <li style={{ fontSize: 13, color: C.body, lineHeight: 1.6 }}>Ask students to look at the camera — face captures run automatically every 2 minutes.</li>
                  <li style={{ fontSize: 13, color: C.body, lineHeight: 1.6 }}>Review results in the Reports section after the session ends.</li>
                </>
              )}
            </ol>
            {untrainedCount > 0 && (
              <div style={{
                marginTop: 14, padding: "10px 14px", borderRadius: 10,
                background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <AlertCircle size={14} color="#d97706" />
                <span style={{ fontSize: 12.5, color: "#92400e" }}>
                  <strong>{untrainedCount}</strong> student{untrainedCount > 1 ? "s" : ""} still {untrainedCount > 1 ? "have" : "has"} no face embeddings — train the model to include them.
                </span>
              </div>
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 1100px) { .stat-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 540px)  { .stat-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}

function CourseOption({ course, isLast, onSelect }: {
  course: FlattenedCourse; isLast: boolean; onSelect: (c: FlattenedCourse) => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onMouseDown={() => onSelect(course)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        width: "100%", textAlign: "left",
        padding: "12px 16px",
        background: hov ? "#f0f9fa" : "transparent",
        border: "none", borderBottom: isLast ? "none" : `1px solid ${C.border}`,
        cursor: "pointer", transition: `background 0.15s ease`,
      }}
    >
      <div>
        <p style={{ fontSize: 13.5, fontWeight: 700, color: hov ? C.primary : C.text, letterSpacing: "-0.01em", transition: EASE_ALL }}>
          {course.name}
        </p>
        <p style={{ fontSize: 11.5, color: C.body, marginTop: 3 }}>{course.displayPath}</p>
      </div>
      <ChevronRight size={14} color={C.accent} style={{ opacity: hov ? 1 : 0.3, flexShrink: 0, transition: EASE_ALL }} />
    </button>
  );
}

function AttendanceStudentRow({ student, isLast }: { student: CourseStudentItem; isLast: boolean }) {
  const [hov, setHov] = useState(false);
  const trained = student.faceEmbedding;
  const hasPhotos = student.hasPhotos;

  return (
    <tr
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ background: hov ? "#f8fafc" : "transparent", transition: "background 0.15s", borderBottom: isLast ? "none" : `1px solid ${C.border}` }}
    >
      <td style={{ padding: "13px 24px" }}>
        <p style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{student.user.name}</p>
        <p style={{ fontSize: 11.5, color: C.body, marginTop: 2 }}>{student.user.email}</p>
      </td>
      <td style={{ padding: "13px 24px" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "3px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700,
          background: hasPhotos ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
          color: hasPhotos ? "#059669" : "#dc2626",
          border: `1px solid ${hasPhotos ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
        }}>
          {hasPhotos ? "Available" : "Missing"}
        </span>
      </td>
      <td style={{ padding: "13px 24px", fontSize: 13, color: C.body }}>{student.photoCount || 0}</td>
      <td style={{ padding: "13px 24px" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "3px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700,
          background: trained ? "rgba(15,164,175,0.08)" : "rgba(245,158,11,0.08)",
          color: trained ? C.accent : "#d97706",
          border: `1px solid ${trained ? C.borderHov : "rgba(245,158,11,0.25)"}`,
        }}>
          {trained ? "Trained" : "Pending"}
        </span>
      </td>
    </tr>
  );
}