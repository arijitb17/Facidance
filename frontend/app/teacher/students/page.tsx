"use client";

import { useCallback, useState, useRef, useMemo,useEffect } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  Search, Upload, X, AlertCircle, Users,
  UserCheck, UserX, ChevronDown, Filter, UserPlus, Check
} from "lucide-react";
import { useToast } from "@/lib/useToast";
import { ToastContainer } from "@/components/ToastContainer";
import { teacherStudentsApi, teacherCoursesApi, teacherHierarchyApi } from "@/lib/teacher-api";

// ─── Types ────────────────────────────────────────────────────────────────────
interface StudentCourseRef { id: string; name: string }
interface Student {
  id: string;
  user: { name: string; email: string };
  program: { name: string; department: { name: string } };
  faceEmbedding: boolean;
  _count: { courses: number; attendance: number };
  courses?: StudentCourseRef[];
}
interface Course { id: string; name: string; entryCode: string; _count: { students: number; attendance: number } }
interface Program { id: string; name: string; department: { name: string } }

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
        <div style={{ flex: 1, minWidth: 0 }}>
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

function PrimaryBtn({ children, onClick, disabled, type }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit";
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type={type ?? "button"}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "10px 20px", borderRadius: 11, fontSize: 13, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer", border: "none",
        background: disabled ? "#e2e8f0" : ICON_GRAD,
        color: disabled ? C.muted : "#fff",
        boxShadow: !disabled && hov ? SHADOW.active : !disabled ? "0 8px 24px rgba(15,164,175,0.3)" : "none",
        transform: !disabled && hov ? "translateY(-2px) scale(1.01)" : "translateY(0) scale(1)",
        transition: EASE_ALL, opacity: disabled ? 0.7 : 1,
      }}
    >
      {children}
    </button>
  );
}

function SearchInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      background: C.white, border: `1px solid ${focused ? C.borderHov : C.border}`,
      borderRadius: 11, padding: "10px 14px",
      boxShadow: focused ? `0 0 0 3px rgba(15,164,175,0.1), ${SHADOW.rest}` : SHADOW.rest,
      transition: EASE_ALL,
    }}>
      <Search size={14} color={focused ? C.accent : C.mutedLight} style={{ flexShrink: 0, transition: EASE_ALL }} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: C.text }}
      />
      {value && (
        <button onClick={() => onChange("")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
          <X size={13} color={C.mutedLight} />
        </button>
      )}
    </div>
  );
}

function SelectInput({ value, onChange, children }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <Filter size={13} color={C.mutedLight} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%", padding: "10px 36px 10px 34px",
          borderRadius: 11, fontSize: 13, fontWeight: 500, color: C.text,
          background: C.white, border: `1px solid ${focused ? C.borderHov : C.border}`,
          boxShadow: focused ? `0 0 0 3px rgba(15,164,175,0.1)` : SHADOW.rest,
          outline: "none", appearance: "none", cursor: "pointer", transition: EASE_ALL,
        }}
      >
        {children}
      </select>
      <ChevronDown size={13} color={C.mutedLight} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function TeacherStudents() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [importing, setImporting] = useState(false);
  const [selectedCourseFilter, setSelectedCourseFilter] = useState("");
  const { toasts, toast, removeToast } = useToast();

  const [activeTab, setActiveTab] = useState<"import" | "enroll">("import");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [enrollCourseId, setEnrollCourseId] = useState("");
  const [enrollingStudentId, setEnrollingStudentId] = useState<string | null>(null);

  // Search effect for existing students
  useEffect(() => {
    if (activeTab !== "enroll") return;
    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await teacherStudentsApi.search(searchQuery, enrollCourseId);
        setSearchResults(res.students);
      } catch (err: any) {
        toast.error("Search failed", err.message);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, enrollCourseId, activeTab, toast]);

  async function handleEnrollExisting(studentId: string) {
    if (!enrollCourseId) {
      toast.warning("Select Course", "Please select a course first.");
      return;
    }
    setEnrollingStudentId(studentId);
    try {
      await teacherCoursesApi.enrollExisting(enrollCourseId, studentId);
      toast.success("Enrolled", "Student successfully added to the course.");
      setSearchResults(prev => prev.filter(s => s.id !== studentId));
      fetchData();
    } catch (err: any) {
      toast.error("Enrollment failed", err.message);
    } finally {
      setEnrollingStudentId(null);
    }
  }

  const [studentToRemove, setStudentToRemove] = useState<{ student: Student; courseId: string; courseName: string } | null>(null);
  const [removing, setRemoving] = useState(false);

  async function handleConfirmRemove() {
    if (!studentToRemove) return;
    setRemoving(true);
    try {
      await teacherCoursesApi.removeStudent(studentToRemove.courseId, studentToRemove.student.id);
      toast.success("Student removed", `Successfully disenrolled ${studentToRemove.student.user.name} from ${studentToRemove.courseName}.`);
      setStudentToRemove(null);
      await fetchData();
    } catch (err: any) {
      toast.error("Failed to remove student", err.message || "An error occurred");
    } finally {
      setRemoving(false);
    }
  }

  const fetchData = useCallback(async () => {
  try {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem("token");
    if (!token) { setError("Not authenticated."); router.push("/login"); return; }

    const [studentsData, coursesData, hierarchyData] = await Promise.all([
      teacherStudentsApi.list(),
      teacherCoursesApi.list(),
      teacherHierarchyApi.get(),
    ]);
    const programsData = hierarchyData.departments.flatMap(d => 
      d.programs.map(p => ({
        id: p.id,
        name: p.name,
        department: { name: d.name }
      }))
    );

    setStudents(studentsData.map((s) => ({
      id: s.id,
      user: s.user,
      program: {
        name: s.program?.name ?? "N/A",
        department: { name: s.program?.department?.name ?? "N/A" },
      },
      faceEmbedding: s.faceEmbedding,
      _count: { courses: s._count.courses, attendance: s._count.attendance },
      courses: s.courses,
    })));

    setCourses(coursesData.map((c) => ({
      id: c.id,
      name: c.name,
      entryCode: c.entry_code,
      _count: { students: c.student_count, attendance: c.session_count },
    })));

    setPrograms(programsData);
  } catch (err: unknown) {
  const message = err instanceof Error ? err.message : "Failed to load data";
  setError(message);
} finally {
    setLoading(false);
  }
}, [router]);
useEffect(() => {
  fetchData();
}, [fetchData]);
const filteredStudents = useMemo(() => {
  return students
    .filter((s) => {
      const q = searchTerm.toLowerCase();
      return (
        s.user.name.toLowerCase().includes(q) ||
        s.user.email.toLowerCase().includes(q) ||
        s.program.name.toLowerCase().includes(q)
      );
    })
    .filter(
      (s) =>
        !selectedCourseFilter ||
        s.courses?.some((c) => c.id === selectedCourseFilter)
    );
}, [students, searchTerm, selectedCourseFilter]);

  async function handleImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setImporting(true);
    try {
      const formData = new FormData(e.currentTarget);
      const courseId = formData.get("courseId") as string;
      const programId = formData.get("programId") as string;
      const file = formData.get("file") as File;

      if (!courseId || !programId || !file) {
        toast.error("Missing fields", "Please fill in all required fields.");
        return;
      }

      const token = localStorage.getItem("token");
      if (!token) { toast.error("Auth error", "Please log in again."); router.push("/login"); return; }

      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
if (!sheetName) throw new Error("Invalid Excel file");

const firstSheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

      const studentsToImport: { name: string; email: string; dob: string; program_id: string }[] = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;
        const [name, dob, email] = row;
        if (!name) continue;
        const studentEmail = email || `${String(name).toLowerCase().replace(/\s+/g, ".")}@student.com`;

        let parsedDob = "";
        if (dob) {
          if (typeof dob === "number") {
            const epoch = new Date(Date.UTC(1899, 11, 30));
            epoch.setUTCDate(epoch.getUTCDate() + Math.floor(dob));
            parsedDob = epoch.toISOString().split("T")[0];
          } else {
            const parts = String(dob).trim().replace(/\//g, "-").split("-");
            if (parts.length === 3) {
              const [day, month, yearRaw] = parts;
              let year = yearRaw;
              if (year.length === 2) {
                year = String(
                  Math.floor(new Date().getFullYear() / 100) * 100 + parseInt(year)
                );
              }
              parsedDob = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
            }
          }
        }
        studentsToImport.push({ name: String(name).trim(), email: studentEmail.toLowerCase().trim(), dob: parsedDob, program_id: programId });
      }

      if (studentsToImport.length === 0) { toast.warning("No data", "No valid student records found."); return; }

      const result = await teacherCoursesApi.importStudents(courseId, studentsToImport);
      if (result.failed.length > 0) {
        toast.error("Import had issues", `Added: ${result.successful.length}, Failed: ${result.failed.length}. Reasons: ${result.failed.map((f: any) => f.reason).join(', ')}`);
      } else {
        toast.success("Import successful!", `Added: ${result.successful.length}, Existing: ${result.existing.length}`);
      }
      await fetchData();
      if (formRef.current) formRef.current.reset();
    } catch (err: any) {
      toast.error("Import failed", err.message || "An error occurred");
    } finally {
      setImporting(false);
    }
  }

  const registeredCount = students.filter((s) => s.faceEmbedding).length;
  const unregisteredCount = students.length - registeredCount;

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%", margin: "0 auto 14px",
            border: "2px solid rgba(15,164,175,0.15)", borderTopColor: C.accent,
            animation: "spin 0.9s linear infinite",
          }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: C.body }}>Loading students…</p>
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
          padding: "16px 20px", borderRadius: 14, maxWidth: 480,
          background: "#fef2f2", border: "1px solid #fecaca",
        }}>
          <AlertCircle size={16} color="#dc2626" />
          <span style={{ fontSize: 13, color: "#b91c1c", fontWeight: 500 }}>{error}</span>
        </div>
        <button onClick={fetchData} style={{
          padding: "9px 18px", borderRadius: 11, fontSize: 13, fontWeight: 600,
          background: ICON_GRAD, color: "#fff", border: "none", cursor: "pointer", width: "fit-content",
        }}>Try Again</button>
      </div>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onClose={removeToast} />
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
          <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            Student Management
          </h1>
          <p style={{ fontSize: 14, color: C.body, marginTop: 6 }}>
            Import, view, and manage your students across all courses.
          </p>
        </div>

        {/* Stat cards */}
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(3, 1fr)" }} className="stat-grid">
          <StatCard title="Total Students"   value={students.length}   Icon={Users}      />
          <StatCard title="Face Registered"  value={registeredCount}   Icon={UserCheck}  color={C.accent} />
          <StatCard title="Not Registered"   value={unregisteredCount} Icon={UserX}      color={unregisteredCount > 0 ? "#dc2626" : C.text} />
        </div>

        {/* Import & Enroll Card */}
        <Card>
          <div style={{ display: "flex", borderBottom: `1px solid ${C.border}` }}>
            <button
              type="button"
              onClick={() => setActiveTab("import")}
              style={{
                flex: 1, padding: "16px 0", background: activeTab === "import" ? "#fff" : "#f8fafc",
                border: "none", borderBottom: activeTab === "import" ? `2px solid ${C.accent}` : "2px solid transparent",
                fontSize: 14, fontWeight: 700, color: activeTab === "import" ? C.accent : C.muted,
                cursor: "pointer", transition: EASE_ALL
              }}
            >
              Import New Students (Excel)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("enroll")}
              style={{
                flex: 1, padding: "16px 0", background: activeTab === "enroll" ? "#fff" : "#f8fafc",
                border: "none", borderBottom: activeTab === "enroll" ? `2px solid ${C.accent}` : "2px solid transparent",
                fontSize: 14, fontWeight: 700, color: activeTab === "enroll" ? C.accent : C.muted,
                cursor: "pointer", transition: EASE_ALL
              }}
            >
              Enroll Existing Students
            </button>
          </div>

          {activeTab === "import" ? (
            <>
              <div style={{ padding: "22px 28px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                  <div style={{
                    height: 44, width: 44, borderRadius: 13, background: ICON_GRAD,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 6px 18px rgba(15,164,175,0.28)",
                  }}>
                    <Upload size={19} color="#fff" />
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: "-0.02em" }}>Import New Students</p>
                    <p style={{ fontSize: 12, color: C.body, marginTop: 2 }}>
                      Upload an Excel file to create accounts and enroll students into a course.
                    </p>
                  </div>
                </div>
              </div>

              <form ref={formRef} onSubmit={handleImport} style={{ padding: "0 28px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
                {/* File input */}
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                    Excel File (.xlsx) — Columns: Name, DOB (dd/mm/yyyy), Email (optional)
                  </label>
                  <input
                    type="file" name="file" accept=".xlsx,.xls" required disabled={importing}
                    style={{
                      display: "block", width: "100%",
                      padding: "9px 12px", borderRadius: 11, fontSize: 12.5,
                      border: `1px solid ${C.border}`, background: "#f8fafc", color: C.body,
                      cursor: "pointer",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="import-grid">
                  {/* Program */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                      Program <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <div style={{ position: "relative" }}>
                      <select
                        name="programId" required disabled={importing}
                        style={{
                          width: "100%", padding: "10px 36px 10px 14px",
                          borderRadius: 11, fontSize: 13, color: C.text,
                          background: C.white, border: `1px solid ${C.border}`,
                          outline: "none", appearance: "none", cursor: "pointer",
                        }}
                      >
                        <option value="">Select program…</option>
                        {programs.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} ({p.department.name})</option>
                        ))}
                      </select>
                      <ChevronDown size={13} color={C.mutedLight} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                    </div>
                  </div>

                  {/* Course */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                      Course <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <div style={{ position: "relative" }}>
                      <select
                        name="courseId" required disabled={importing}
                        style={{
                          width: "100%", padding: "10px 36px 10px 14px",
                          borderRadius: 11, fontSize: 13, color: C.text,
                          background: C.white, border: `1px solid ${C.border}`,
                          outline: "none", appearance: "none", cursor: "pointer",
                        }}
                      >
                        <option value="">Select course…</option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={13} color={C.mutedLight} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 4 }}>
                  <p style={{ fontSize: 12, color: C.body }}>
                    Newly imported students will receive login credentials via email.
                  </p>
                  <PrimaryBtn type="submit" disabled={importing}>
                    <Upload size={14} />
                    {importing ? "Importing…" : "Import Students"}
                  </PrimaryBtn>
                </div>
              </form>
            </>
          ) : (
            <div style={{ padding: "28px", display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                  1. Select Target Course <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div style={{ position: "relative", maxWidth: 400 }}>
                  <select
                    value={enrollCourseId} onChange={(e) => setEnrollCourseId(e.target.value)}
                    style={{
                      width: "100%", padding: "10px 36px 10px 14px",
                      borderRadius: 11, fontSize: 13, color: C.text,
                      background: C.white, border: `1px solid ${C.border}`,
                      outline: "none", appearance: "none", cursor: "pointer",
                    }}
                  >
                    <option value="">Select course…</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} color={C.mutedLight} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                </div>
              </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                    2. Search Existing Students
                  </label>
                  <div style={{ position: "relative" }}>
                    <SearchInput
                      value={searchQuery}
                      onChange={setSearchQuery}
                      placeholder="Search registered students by name or email..."
                    />
                    {isSearching && (
                      <div style={{
                        position: "absolute", right: 14, top: "50%", marginTop: -8,
                        width: 16, height: 16, borderRadius: "50%",
                        border: "2px solid rgba(15,164,175,0.15)", borderTopColor: C.accent,
                        animation: "spin 0.6s linear infinite",
                      }} />
                    )}
                  </div>
                  
                  {searchResults.length > 0 && (
                    <div style={{ marginTop: 16, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
                      {searchResults.map((s, idx) => (
                        <div key={s.id} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "12px 16px", background: idx % 2 === 0 ? "#fff" : "#f8fafc",
                          borderBottom: idx === searchResults.length - 1 ? "none" : `1px solid ${C.border}`,
                        }}>
                          <div>
                            <p style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{s.name}</p>
                            <p style={{ fontSize: 11.5, color: C.body, marginTop: 2 }}>{s.email} • {s.program?.name || "No Program"} ({s.program?.department?.name || "No Dept"})</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleEnrollExisting(s.id)}
                            disabled={enrollingStudentId === s.id}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                              cursor: enrollingStudentId === s.id ? "not-allowed" : "pointer",
                              border: `1px solid ${C.accent}`,
                              background: enrollingStudentId === s.id ? "#e2e8f0" : "rgba(15,164,175,0.08)",
                              color: enrollingStudentId === s.id ? C.muted : C.accent,
                              transition: EASE_ALL,
                            }}
                          >
                            {enrollingStudentId === s.id ? <div style={{width: 12, height: 12, border: "2px solid transparent", borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.6s linear infinite"}}/> : <UserPlus size={14} />}
                            {enrollingStudentId === s.id ? "Adding..." : "Enroll"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {searchResults.length === 0 && !isSearching && (
                    <p style={{ fontSize: 13, color: C.muted, marginTop: 12, textAlign: "center", padding: "20px 0" }}>
                      {searchQuery ? `No un-enrolled students found matching "${searchQuery}"` : "No un-enrolled students available to add."}
                    </p>
                  )}
                </div>
            </div>
          )}
        </Card>

        {/* Filters */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <div style={{ flex: "1 1 260px" }}>
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search by name, email, or program…"
            />
          </div>
          <div style={{ width: 220 }}>
            <SelectInput value={selectedCourseFilter} onChange={setSelectedCourseFilter}>
              <option value="">All Courses</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </SelectInput>
          </div>
        </div>

        {/* Students table */}
        <Card>
          <div style={{
            padding: "22px 28px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottom: `1px solid ${C.border}`,
          }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: "-0.02em" }}>Student Directory</p>
              <p style={{ fontSize: 12, color: C.body, marginTop: 3 }}>
                {filteredStudents.length} student{filteredStudents.length !== 1 ? "s" : ""}
                {selectedCourseFilter ? ` in ${courses.find(c => c.id === selectedCourseFilter)?.name}` : ""}
              </p>
            </div>
            {(searchTerm || selectedCourseFilter) && (
              <button
                onClick={() => { setSearchTerm(""); setSelectedCourseFilter(""); }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  fontSize: 12, fontWeight: 600, color: C.body,
                  background: "none", border: "none", cursor: "pointer",
                  padding: "5px 10px", borderRadius: 8,
                }}
              >
                <X size={12} /> Clear filters
              </button>
            )}
          </div>

          {filteredStudents.length === 0 ? (
            <div style={{ padding: "56px 0", textAlign: "center" }}>
              <Users size={36} color={C.mutedLight} style={{ margin: "0 auto 12px" }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                {searchTerm || selectedCourseFilter ? "No matching students" : "No students enrolled yet"}
              </p>
              <p style={{ fontSize: 12, color: C.body, marginTop: 5 }}>
                {searchTerm || selectedCourseFilter ? "Try adjusting your filters." : "Import students using the form above."}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {[
                      "Student",
                      "Program",
                      "Department",
                      "Courses",
                      "Attendance",
                      "Face Data",
                      ...(selectedCourseFilter ? ["Actions"] : [])
                    ].map((h) => (
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
                      isLast={idx === filteredStudents.length - 1}
                      teacherCourses={courses}
                      selectedCourseFilter={selectedCourseFilter}
                      onRemove={(student, courseId, courseName) => {
                        setStudentToRemove({ student, courseId, courseName });
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {studentToRemove && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16
        }}>
          <div style={{
            background: C.white, borderRadius: 20, border: `1px solid ${C.border}`,
            boxShadow: "0 32px 80px rgba(0,49,53,0.22)", width: "100%", maxWidth: 440,
            position: "relative", display: "flex", flexDirection: "column", animation: "modalIn 0.3s cubic-bezier(.22,.68,0,1.2)"
          }}>
            <button onClick={() => setStudentToRemove(null)} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", color: C.muted, zIndex: 10 }}>
              <X size={18} />
            </button>
            <div style={{ padding: "28px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ height: 44, width: 44, minWidth: 44, borderRadius: "50%", background: "linear-gradient(135deg, #be123c 0%, #e11d48 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <UserX size={20} color="#fff" />
                </div>
                <p style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>Remove Student from Course</p>
              </div>
              <p style={{ fontSize: 14, color: C.body, marginBottom: 10, lineHeight: 1.5 }}>
                Are you sure you want to remove <strong style={{ color: C.text }}>{studentToRemove.student.user.name}</strong> from <strong style={{ color: C.text }}>{studentToRemove.courseName}</strong>?
              </p>
              <div style={{
                background: "#fffbeb", border: "1px solid #fef3c7", borderRadius: 12, padding: "12px 14px",
                display: "flex", gap: 10, marginBottom: 22
              }}>
                <AlertCircle size={16} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12.5, color: "#b45309", margin: 0, lineHeight: 1.4 }}>
                  <strong>Mid-semester Change:</strong> This student will be disenrolled. Their attendance records and details will no longer appear on rosters or reports for this course.
                </p>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setStudentToRemove(null)}
                  disabled={removing}
                  style={{
                    padding: "9px 18px", borderRadius: 10, border: `1px solid ${C.border}`,
                    background: "transparent", color: C.textSoft, fontSize: 13, fontWeight: 600,
                    cursor: "pointer", transition: EASE_ALL
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRemove}
                  disabled={removing}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "9px 18px", borderRadius: 10, border: "none",
                    background: "linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)",
                    color: "#fff", fontSize: 13, fontWeight: 600,
                    cursor: removing ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 12px rgba(225,29,72,0.25)",
                    transition: EASE_ALL, opacity: removing ? 0.7 : 1
                  }}
                >
                  {removing ? (
                    <div style={{ width: 14, height: 14, border: "2px solid transparent", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                  ) : <UserX size={14} />}
                  {removing ? "Removing..." : "Remove Student"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.96) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @media (max-width: 900px)  { .stat-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 540px)  { .stat-grid { grid-template-columns: repeat(2, 1fr) !important; } .import-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </>
  );
}

function StudentRow({ 
  student, 
  isLast, 
  teacherCourses, 
  selectedCourseFilter, 
  onRemove 
}: { 
  student: Student; 
  isLast: boolean; 
  teacherCourses: Course[]; 
  selectedCourseFilter: string; 
  onRemove: (student: Student, courseId: string, courseName: string) => void;
}) {
  const [hov, setHov] = useState(false);
  const faceOk = student.faceEmbedding;

  const studentTeacherCourses = useMemo(() => {
    return student.courses?.filter(sc => teacherCourses.some(tc => tc.id === sc.id)) || [];
  }, [student.courses, teacherCourses]);

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
      <td style={{ padding: "13px 24px" }}>
        <p style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{student.user.name}</p>
        <p style={{ fontSize: 11.5, color: C.body, marginTop: 2 }}>{student.user.email}</p>
      </td>
      <td style={{ padding: "13px 24px", fontSize: 13, color: C.body }}>{student.program.name}</td>
      <td style={{ padding: "13px 24px", fontSize: 13, color: C.body }}>{student.program.department.name}</td>
      <td style={{ padding: "13px 24px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxWidth: 280 }}>
          {studentTeacherCourses.map((c) => (
            <span
              key={c.id}
              onClick={() => onRemove(student, c.id, c.name)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px 4px 12px",
                borderRadius: 14,
                fontSize: 12,
                fontWeight: 600,
                background: "#f1f5f9",
                color: C.textSoft,
                border: `1px solid ${C.border}`,
                cursor: "pointer",
                transition: EASE_ALL,
              }}
              className="course-badge"
              title={`Click to remove student from ${c.name}`}
            >
              <span style={{ maxWidth: 160, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {c.name}
              </span>
              <div 
                className="badge-close"
                style={{ 
                  display: "flex", alignItems: "center", justifyContent: "center", 
                  width: 16, height: 16, borderRadius: "50%", 
                  background: "rgba(15,23,42,0.06)", transition: EASE_ALL 
                }}
              >
                <X size={10} style={{ color: C.textSoft }} />
              </div>
            </span>
          ))}
        </div>
        <style>{`
          .course-badge:hover {
            background: #fef2f2 !important;
            color: #dc2626 !important;
            border-color: #fecaca !important;
          }
          .course-badge:hover .badge-close {
            background: #fecaca !important;
          }
          .course-badge:hover .badge-close svg {
            color: #dc2626 !important;
          }
        `}</style>
      </td>
      <td style={{ padding: "13px 24px", fontSize: 13, fontWeight: 700, color: C.text }}>{student._count.attendance}</td>
      <td style={{ padding: "13px 24px" }}>
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
      {selectedCourseFilter && (
        <td style={{ padding: "13px 24px" }}>
          <button
            onClick={() => {
              const activeCourse = teacherCourses.find(tc => tc.id === selectedCourseFilter);
              onRemove(student, selectedCourseFilter, activeCourse?.name ?? "Course");
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid #fecaca",
              background: "rgba(239,68,68,0.04)",
              color: "#dc2626",
              transition: EASE_ALL,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(239,68,68,0.08)";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(220,38,38,0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(239,68,68,0.04)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <UserX size={12} /> Remove
          </button>
        </td>
      )}
    </tr>
  );
}