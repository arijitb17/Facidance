"use client";

import { useCallback, useState, useRef, useMemo,useEffect } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  Search, Upload, X, AlertCircle, Users,
  UserCheck, UserX, ChevronDown, Filter,
} from "lucide-react";
import { useToast } from "@/lib/useToast";
import { ToastContainer } from "@/components/ToastContainer";
import { teacherStudentsApi, teacherCoursesApi } from "@/lib/teacher-api";

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

  const fetchData = useCallback(async () => {
  try {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem("token");
    if (!token) { setError("Not authenticated."); router.push("/login"); return; }

    const [studentsData, coursesData, programsRes] = await Promise.all([
      teacherStudentsApi.list(),
      teacherCoursesApi.list(),
      fetch("/api/programs", { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const programsData = programsRes.ok ? await programsRes.json() : [];

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
        if (!name || !dob) continue;
        const studentEmail = email || `${String(name).toLowerCase().replace(/\s+/g, ".")}@student.com`;

        let parsedDob: string;
        if (typeof dob === "number") {
          const epoch = new Date(1899, 11, 30);
          epoch.setDate(epoch.getDate() + Math.floor(dob));
          parsedDob = epoch.toISOString().split("T")[0];
        } else {
          const parts = String(dob).trim().replace(/\//g, "-").split("-");
          if (parts.length !== 3) continue;
         const [day, month, yearRaw] = parts;

let year = yearRaw;

if (year.length === 2) {
  year = String(
    Math.floor(new Date().getFullYear() / 100) * 100 + parseInt(year)
  );
}

parsedDob = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        }
        studentsToImport.push({ name: String(name).trim(), email: studentEmail.toLowerCase().trim(), dob: parsedDob, program_id: programId });
      }

      if (studentsToImport.length === 0) { toast.warning("No data", "No valid student records found."); return; }

      const result = await teacherCoursesApi.importStudents(courseId, studentsToImport);
      toast.success("Import successful!", `Added: ${result.successful.length}, Existing: ${result.existing.length}, Failed: ${result.failed.length}`);
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

        {/* Import card */}
        <Card>
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
                <p style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: "-0.02em" }}>Import Students</p>
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
                    {["Student", "Program", "Department", "Courses", "Attendance", "Face Data"].map((h) => (
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
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px)  { .stat-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 540px)  { .stat-grid { grid-template-columns: 1fr !important; } .import-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </>
  );
}

function StudentRow({ student, isLast }: { student: Student; isLast: boolean }) {
  const [hov, setHov] = useState(false);
  const faceOk = student.faceEmbedding;

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
      <td style={{ padding: "13px 24px", fontSize: 13, fontWeight: 700, color: C.text }}>{student._count.courses}</td>
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
    </tr>
  );
}