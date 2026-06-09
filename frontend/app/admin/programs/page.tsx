"use client";

import { useEffect, useState } from "react";
import { PlusCircle, X, BookOpen, Check, Building2, Users, Trash2, Loader2, ChevronDown, Key } from "lucide-react";
import { programsApi, departmentsApi, studentsApi, coursesApi, Program, Department, Course, Student } from "@/lib/api";
import { useToast } from "@/lib/useToast";
import { ToastContainer } from "@/components/ToastContainer";

const SPRING   = "cubic-bezier(.22,.68,0,1.2)";
const EASE_ALL = `all 0.25s ${SPRING}`;
const C = {
  primary: "#003135", secondary: "#024950", accent: "#0FA4AF",
  text: "#0f172a", textSoft: "#334155", body: "#475569", muted: "#64748b", mutedLight: "#94a3b8",
  border: "rgba(226,232,240,0.7)", borderHov: "rgba(15,164,175,0.22)", white: "#ffffff",
};
const ICON_GRAD = `linear-gradient(135deg, ${C.primary} 0%, ${C.accent} 100%)`;
const CARD_GRAD = "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)";
const SHADOW = { rest: "0 2px 12px rgba(0,49,53,0.06)", hover: "0 12px 36px rgba(0,49,53,0.12)", active: "0 16px 40px rgba(15,164,175,0.35)" };

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: CARD_GRAD, border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: SHADOW.rest, overflow: "hidden", ...style }}>{children}</div>;
}

function StatCard({ label, value, icon: Icon, loading }: { label: string; value: number; icon: React.ElementType; loading: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: CARD_GRAD, border: `1px solid ${hov ? C.borderHov : C.border}`, borderRadius: 18, padding: "22px 24px", boxShadow: hov ? SHADOW.hover : SHADOW.rest, transform: hov ? "translateY(-5px) scale(1.01)" : "none", transition: EASE_ALL }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>{label}</p>
          {loading
            ? <div style={{ width: 80, height: 36, borderRadius: 8, background: "#f1f5f9", marginTop: 10, animation: "shimmer 1.6s ease-in-out infinite", backgroundSize: "200% 100%", backgroundImage: "linear-gradient(90deg, #f1f5f9 25%, #e8f0f5 50%, #f1f5f9 75%)" }} />
            : <p style={{ fontSize: 34, fontWeight: 800, color: C.text, lineHeight: 1, marginTop: 10, letterSpacing: "-0.03em" }}>{value}</p>
          }
        </div>
        <div style={{ height: 50, width: 50, minWidth: 50, borderRadius: 14, background: ICON_GRAD, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: hov ? "0 8px 24px rgba(15,164,175,0.38)" : "0 6px 20px rgba(15,164,175,0.28)", transform: hov ? "scale(1.1) rotate(-3deg)" : "none", transition: EASE_ALL }}>
          <Icon size={22} color="#fff" strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

function Btn({ children, onClick, primary, disabled }: { children: React.ReactNode; onClick?: () => void; primary?: boolean; disabled?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 11, fontSize: 13, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer", letterSpacing: "-0.01em", opacity: disabled ? 0.5 : 1,
        transform: hov && !disabled ? "translateY(-2px) scale(1.01)" : "none", transition: EASE_ALL,
        ...(primary
          ? { background: ICON_GRAD, color: "#fff", border: "none", boxShadow: hov ? `${SHADOW.active}, inset 0 1px 0 rgba(255,255,255,0.18)` : "0 8px 24px rgba(15,164,175,0.35)" }
          : { background: hov ? "#f0f9fa" : C.white, color: hov ? C.primary : C.textSoft, border: `1px solid ${hov ? C.borderHov : C.border}`, boxShadow: hov ? SHADOW.hover : SHADOW.rest }),
      }}
    >
      {children}
    </button>
  );
}

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [name, setName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterDept, setFilterDept] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const { toasts, toast, removeToast } = useToast();

  const [reassignProgram, setReassignProgram] = useState<Program | null>(null);
  const [reassignDeptId, setReassignDeptId] = useState("");
  const [reassignLoading, setReassignLoading] = useState(false);

  const filteredPrograms = filterDept
    ? programs.filter((p) => p.department_id === filterDept)
    : programs;

  async function fetchAll() {
    const [pd, dd, sd, cd] = await Promise.all([programsApi.list(), departmentsApi.list(), studentsApi.list(), coursesApi.list()]);
    setPrograms(pd.programs); setDepartments(dd.departments); setStudentCount(sd.students.length);
    setAllStudents(sd.students); setAllCourses(cd.courses);
  }

  async function addProgram() {
    if (!name.trim() || !departmentId.trim()) return;
    setLoading(true); setError(null);
    try { 
      await programsApi.create(name.trim(), departmentId.trim()); 
      toast.success("Program Added", `Successfully added program: ${name.trim()}`);
      setName(""); setDepartmentId(""); setShowForm(false); await fetchAll(); 
    }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to add program"); }
    finally { setLoading(false); }
  }

  async function deleteProgram(id: string, programName: string) {
    if (!confirm(`Delete "${programName}"? This cannot be undone.`)) return;
    setError(null);
    try { 
      await programsApi.delete(id); 
      toast.success("Program Deleted", `Successfully deleted program: ${programName}`);
      await fetchAll(); 
    }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to delete"); }
  }

  async function handleReassign() {
    if (!reassignProgram || !reassignDeptId) return;
    setReassignLoading(true); setError(null);
    try {
      await programsApi.updateDepartment(reassignProgram.id, reassignDeptId);
      toast.success("Program Reassigned", `Successfully moved "${reassignProgram.name}" to another department.`);
      setReassignProgram(null);
      setReassignDeptId("");
      await fetchAll();
    }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to reassign program"); }
    finally { setReassignLoading(false); }
  }

  useEffect(() => {
    (async () => { setInitialLoading(true); try { await fetchAll(); } finally { setInitialLoading(false); } })();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }

        .prog-stat-grid { display: grid; gap: 16px; grid-template-columns: repeat(3, 1fr); }
        @media (max-width: 900px)  { .prog-stat-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 540px)  { .prog-stat-grid { grid-template-columns: 1fr !important; } }

        .prog-form-grid { display: grid; gap: 12px; grid-template-columns: 1fr 1fr auto; align-items: flex-end; }
        @media (max-width: 700px)  { .prog-form-grid { grid-template-columns: 1fr !important; } }

        @media (max-width: 540px) {
          .prog-row { flex-direction: column !important; align-items: flex-start !important; }
          .prog-row-actions { width: 100% !important; margin-top: 8px !important; }
        }
      `}</style>

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
          <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, letterSpacing: "-0.03em", lineHeight: 1.1, margin: 0 }}>Programs</h1>
          <p style={{ fontSize: 14, color: C.body, marginTop: 6 }}>Manage academic programs and degree offerings.</p>
        </div>
        <Btn primary onClick={() => setShowForm((p) => !p)}>
          <PlusCircle size={14} /> {showForm ? "Close" : "Add Program"}
        </Btn>
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13 }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626" }}><X size={14} /></button>
        </div>
      )}

      {/* Stats */}
      <div className="prog-stat-grid">
        <StatCard label="Total Programs"    value={programs.length}    icon={BookOpen}  loading={initialLoading} />
        <StatCard label="Departments Linked" value={departments.length} icon={Building2} loading={initialLoading} />
        <StatCard label="Total Students"    value={studentCount}       icon={Users}     loading={initialLoading} />
      </div>

      {/* Add form */}
      {showForm && (
        <Card>
          <div style={{ padding: "22px 26px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ height: 36, width: 36, borderRadius: 10, background: "rgba(175,221,229,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BookOpen size={16} color={C.secondary} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>Add New Program</p>
            </div>
            <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }}><X size={18} /></button>
          </div>
          <div style={{ padding: "20px 26px 26px" }}>
            <div className="prog-form-grid">
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Program Name</label>
                <input
                  type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Bachelor of Computer Science"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, fontSize: 13, color: C.text, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Department</label>
                <select
                  value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, fontSize: 13, color: C.text, outline: "none", boxSizing: "border-box" }}
                >
                  <option value="">Select a department</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <Btn primary onClick={addProgram} disabled={loading || !name.trim() || !departmentId.trim()}>
                {loading ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />Adding…</> : <><Check size={13} />Add</>}
              </Btn>
            </div>
          </div>
        </Card>
      )}

      {/* List */}
      <Card>
        <div style={{ padding: "22px 26px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ height: 36, width: 36, borderRadius: 10, background: ICON_GRAD, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BookOpen size={16} color="#fff" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>All Programs</p>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <select 
                value={filterDept} 
                onChange={(e) => setFilterDept(e.target.value)}
                style={{
                  width: 180,
                  padding: "7px 32px 7px 14px", 
                  borderRadius: 10, 
                  border: `1px solid ${C.border}`, 
                  background: "rgba(248,250,252,0.8)", 
                  fontSize: 12.5, 
                  fontWeight: 600,
                  color: C.text, 
                  outline: "none",
                  cursor: "pointer",
                  appearance: "none",
                  WebkitAppearance: "none",
                  transition: "all 0.2s ease"
                }}
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <ChevronDown size={14} color={C.muted} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            </div>

            <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, background: "rgba(175,221,229,0.2)", border: `1px solid ${C.border}`, color: C.muted, fontWeight: 600 }}>
              {filteredPrograms.length} total
            </span>
          </div>
        </div>
        <div style={{ padding: "20px 26px 26px" }}>
          {initialLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[1, 2, 3].map((i) => <div key={i} style={{ height: 72, borderRadius: 12, background: "#f1f5f9", animation: "shimmer 1.6s ease-in-out infinite" }} />)}
            </div>
          ) : filteredPrograms.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ height: 56, width: 56, borderRadius: 16, background: "rgba(175,221,229,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BookOpen size={24} color={C.mutedLight} />
              </div>
              <p style={{ fontSize: 14, color: C.body, margin: 0 }}>{filterDept ? "No programs found in this department." : "No programs found. Add your first one above."}</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredPrograms.map((program) => (
                <ProgramRow 
                  key={program.id} 
                  program={program} 
                  onClick={() => setSelectedProgram(program)} 
                  onDelete={() => deleteProgram(program.id, program.name)} 
                  onReassign={() => {
                    setReassignProgram(program);
                    setReassignDeptId(program.department_id || "");
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Program Detail Modal */}
      {selectedProgram && (() => {
        const progCourses = allCourses.filter(c => c.program_name === selectedProgram.name);
        const uniqueTeachers = Array.from(new Set(progCourses.map(c => c.teacher_id).filter(Boolean)));
        
        return (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15,23,42,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: C.white, borderRadius: 20, padding: 30, width: "100%", maxWidth: 500, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", position: "relative" }}>
              <button onClick={() => setSelectedProgram(null)} style={{ position: "absolute", top: 16, right: 16, background: "rgba(226,232,240,0.5)", border: "none", width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.muted, zIndex: 10 }}>
                <X size={16} />
              </button>

              <div style={{ overflowY: "auto", flex: 1, minHeight: 0, paddingRight: 10, marginRight: -10 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 16, borderBottom: `1px solid ${C.border}`, paddingBottom: 24, marginBottom: 20, flexShrink: 0, paddingTop: 10 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 14, background: C.secondary, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <BookOpen size={24} color="#fff" />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: "0 0 6px", lineHeight: 1.2 }}>{selectedProgram.name}</h2>
                    <p style={{ fontSize: 13, color: C.mutedLight, margin: 0 }}>{selectedProgram.department_name}</p>
                  </div>
                </div>

                <div style={{ marginBottom: 16, flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", background: "rgba(248,250,252,0.8)", padding: 14, borderRadius: 12, marginBottom: 8, border: `1px solid ${C.border}` }}>
                    <Building2 size={16} color={C.muted} style={{ marginRight: 14 }} />
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 2px" }}>Department</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>{selectedProgram.department_name ?? "—"}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", background: "rgba(248,250,252,0.8)", padding: 14, borderRadius: 12, marginBottom: 8, border: `1px solid ${C.border}` }}>
                    <Key size={16} color={C.muted} style={{ marginRight: 14 }} />
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 2px" }}>Program ID</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0, fontFamily: "monospace" }}>{selectedProgram.id.toUpperCase()}</p>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", background: "rgba(248,250,252,0.8)", borderRadius: 12, marginBottom: 20, border: `1px solid ${C.border}`, flexShrink: 0 }}>
                  <div style={{ flex: 1, padding: "16px 0", textAlign: "center" }}>
                    <p style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: "0 0 4px" }}>{progCourses.length}</p>
                    <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, margin: 0 }}>Courses</p>
                  </div>
                  <div style={{ width: 1, background: C.border }} />
                  <div style={{ flex: 1, padding: "16px 0", textAlign: "center" }}>
                    <p style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: "0 0 4px" }}>{uniqueTeachers.length}</p>
                    <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, margin: 0 }}>Faculty</p>
                  </div>
                  <div style={{ width: 1, background: C.border }} />
                  <div style={{ flex: 1, padding: "16px 0", textAlign: "center" }}>
                    <p style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: "0 0 4px" }}>{allStudents.filter(s => s.program_id === selectedProgram.id).length}</p>
                    <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, margin: 0 }}>Students</p>
                  </div>
                </div>

                <p style={{ fontSize: 12, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12, flexShrink: 0 }}>Courses</p>
                <div style={{ paddingBottom: 10 }}>
                  {progCourses.length > 0 ? progCourses.map(c => {
                    const enrolledCount = allStudents.filter(s => s.program_id === selectedProgram.id && s.courses?.some(sc => sc.id === c.id)).length;
                    return (
                      <div key={c.id} style={{ display: "flex", background: C.white, padding: 14, borderRadius: 12, marginBottom: 8, border: `1px solid ${C.border}` }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(15,164,175,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 12, flexShrink: 0 }}>
                          <BookOpen size={16} color={C.secondary} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: "0 0 2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</p>
                          <p style={{ fontSize: 11, fontWeight: 600, color: C.accent, margin: "0 0 8px" }}>{c.code}</p>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(15,164,175,0.1)", color: C.secondary, padding: "3px 8px", borderRadius: 6 }}>{c.semester_name ?? "Unknown"}</span>
                            {c.teacher_name && (
                              <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(245,158,11,0.1)", color: "#d97706", padding: "3px 8px", borderRadius: 6 }}>{c.teacher_name}</span>
                            )}
                            <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(16,185,129,0.1)", color: "#059669", padding: "3px 8px", borderRadius: 6 }}>{enrolledCount} students</span>
                          </div>
                        </div>
                      </div>
                    );
                  }) : (
                    <p style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "20px 0" }}>No courses assigned to this program yet.</p>
                  )}
                </div>
              </div>

              <div style={{ paddingTop: 20, marginTop: 10, borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
                <button onClick={() => setSelectedProgram(null)} style={{ width: "100%", padding: "12px 0", borderRadius: 12, background: C.secondary, color: "#fff", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Reassign Modal */}
      {reassignProgram && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15,23,42,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: C.white, borderRadius: 20, padding: 30, width: "100%", maxWidth: 450, display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", position: "relative" }}>
            <button onClick={() => setReassignProgram(null)} style={{ position: "absolute", top: 16, right: 16, background: "rgba(226,232,240,0.5)", border: "none", width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.muted }}>
              <X size={16} />
            </button>

            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, borderBottom: `1px solid ${C.border}`, paddingBottom: 20, marginBottom: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: ICON_GRAD, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Building2 size={22} color="#fff" />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: "0 0 4px" }}>Reassign Department</h2>
                <p style={{ fontSize: 13, color: C.mutedLight, margin: 0 }}>Move program to another department</p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Program</label>
                <p style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>{reassignProgram.name}</p>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Select New Department</label>
                <select
                  value={reassignDeptId}
                  onChange={(e) => setReassignDeptId(e.target.value)}
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, fontSize: 13, color: C.text, outline: "none", boxSizing: "border-box" }}
                >
                  <option value="">Select a department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button 
                onClick={() => setReassignProgram(null)} 
                style={{ flex: 1, padding: "12px 0", borderRadius: 12, background: C.white, border: `1px solid ${C.border}`, color: C.textSoft, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button 
                onClick={handleReassign}
                disabled={reassignLoading || !reassignDeptId}
                style={{ flex: 1, padding: "12px 0", borderRadius: 12, background: ICON_GRAD, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: reassignLoading || !reassignDeptId ? "not-allowed" : "pointer", opacity: reassignLoading || !reassignDeptId ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                {reassignLoading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={14} />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}

function ProgramRow({ program, onClick, onDelete, onReassign }: { program: Program; onClick: () => void; onDelete: () => void; onReassign: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      className="prog-row"
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 18px", borderRadius: 14, border: `1px solid ${hov ? "rgba(15,164,175,0.22)" : "rgba(226,232,240,0.7)"}`, background: hov ? "#fff" : "rgba(248,250,252,0.8)", transition: "all 0.2s ease", boxShadow: hov ? "0 6px 20px rgba(0,49,53,0.08)" : "none", cursor: "pointer", flexWrap: "wrap" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
        <div style={{ height: 42, width: 42, minWidth: 42, borderRadius: 12, background: ICON_GRAD, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <BookOpen size={18} color="#fff" />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.primary, margin: 0, overflow: "hidden", textOverflow: "ellipsis", wordBreak: "break-word" }}>{program.name}</p>
          <div style={{ display: "flex", gap: 12, marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: C.body }}>
              <Building2 size={11} color="#38bdf8" /> {program.department_name ?? "Unknown department"}
            </span>
            <span style={{ fontFamily: "monospace", fontSize: 11, background: "rgba(226,232,240,0.6)", padding: "2px 8px", borderRadius: 6, color: C.muted, border: `1px solid ${C.border}` }}>
              {program.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
        </div>
      </div>
      <div className="prog-row-actions" style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        <button
          onClick={(e) => { e.stopPropagation(); onReassign(); }}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 13px", borderRadius: 9, border: `1px solid ${C.border}`, background: hov ? "rgba(15,164,175,0.05)" : "transparent", color: C.secondary, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s ease", flexShrink: 0, whiteSpace: "nowrap" }}
        >
          <Building2 size={12} /> Reassign
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 13px", borderRadius: 9, border: "1px solid #fecdd3", background: hov ? "#fff1f2" : "transparent", color: "#e11d48", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s ease", flexShrink: 0, whiteSpace: "nowrap" }}
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </div>
  );
}