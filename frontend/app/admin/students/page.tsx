"use client";

import { useState, useMemo } from "react";
import { Search, Users, CheckCircle, GraduationCap, Eye, Edit, Trash2, Award, Loader2, X, BookOpen } from "lucide-react";
import { useStudents } from "@/hooks/useAdmin";
import { studentsApi, Student } from "@/lib/api";

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

type ModalType = "view" | "edit" | "graduate" | "delete" | null;
type StatusFilter = "all" | "active" | "graduated";

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
            : <p style={{ fontSize: 34, fontWeight: 800, color: C.text, lineHeight: 1, marginTop: 10, letterSpacing: "-0.03em" }}>{value.toLocaleString()}</p>
          }
        </div>
        <div style={{ height: 50, width: 50, minWidth: 50, borderRadius: 14, background: ICON_GRAD, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: hov ? "0 8px 24px rgba(15,164,175,0.38)" : "0 6px 20px rgba(15,164,175,0.28)", transform: hov ? "scale(1.1) rotate(-3deg)" : "none", transition: EASE_ALL }}>
          <Icon size={22} color="#fff" strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

function IconBtn({ icon: Icon, onClick, title, variant = "default" }: { icon: React.ElementType; onClick: () => void; title: string; variant?: "default" | "danger" | "warn" }) {
  const [hov, setHov] = useState(false);
  const styles: Record<string, React.CSSProperties> = {
    default: { background: hov ? "rgba(15,164,175,0.06)" : "transparent", color: hov ? C.primary : C.muted, border: `1px solid ${hov ? C.borderHov : C.border}` },
    danger:  { background: hov ? "#fff1f2" : "transparent", color: hov ? "#e11d48" : "#f87171", border: "1px solid #fecdd3" },
    warn:    { background: hov ? "rgba(245,158,11,0.08)" : "transparent", color: hov ? "#b45309" : "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" },
  };
  return (
    <button title={title} onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 9, cursor: "pointer", transition: "all 0.2s ease", ...styles[variant] }}>
      <Icon size={14} />
    </button>
  );
}

function PrimaryBtn({ children, onClick, disabled, color = "primary" }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; color?: "primary" | "purple" | "red" }) {
  const [hov, setHov] = useState(false);
  const bgs: Record<string, string> = {
    primary: ICON_GRAD,
    purple: "linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)",
    red:    "linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)",
  };
  return (
    <button onClick={onClick} disabled={disabled} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 11, fontSize: 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, background: bgs[color], color: "#fff", border: "none", transition: EASE_ALL, transform: hov && !disabled ? "translateY(-1px)" : "none" }}>
      {children}
    </button>
  );
}

export default function StudentsPage() {
  const { students, programs, loading, refetch } = useStudents();
  const [search, setSearch] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", program_id: "" });
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const term = search.toLowerCase();
      const matchSearch = !term || s.name.toLowerCase().includes(term) || s.email.toLowerCase().includes(term) || (s.program_name ?? "").toLowerCase().includes(term);
      const matchProgram = programFilter ? s.program_id === programFilter : true;
      const matchStatus = statusFilter === "all" ? true : statusFilter === "active" ? !s.graduated : s.graduated;
      return matchSearch && matchProgram && matchStatus;
    });
  }, [students, search, programFilter, statusFilter]);

  function openModal(type: ModalType, student: Student) {
    setSelectedStudent(student); setModalType(type);
    if (type === "edit") setEditForm({ name: student.name, email: student.email, program_id: student.program_id ?? "" });
  }
  function closeModal() { setModalType(null); setSelectedStudent(null); setEditForm({ name: "", email: "", program_id: "" }); setError(null); }

  async function handleEdit() {
    if (!selectedStudent) return;
    setActionLoading(true);
    try { await studentsApi.update(selectedStudent.id, { name: editForm.name || undefined, email: editForm.email || undefined, program_id: editForm.program_id || undefined }); refetch(); closeModal(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to update"); }
    finally { setActionLoading(false); }
  }
  async function handleGraduate() {
    if (!selectedStudent) return;
    setActionLoading(true);
    try { await studentsApi.graduate(selectedStudent.id); refetch(); closeModal(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to graduate"); }
    finally { setActionLoading(false); }
  }
  async function handleDelete() {
    if (!selectedStudent) return;
    setActionLoading(true);
    try { await studentsApi.delete(selectedStudent.id); refetch(); closeModal(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to delete"); }
    finally { setActionLoading(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }

        .stu-stat-grid { display: grid; gap: 16px; grid-template-columns: repeat(3, 1fr); }
        @media (max-width: 900px)  { .stu-stat-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 540px)  { .stu-stat-grid { grid-template-columns: 1fr !important; } }

        .stu-filters { display: flex; gap: 12px; flex-wrap: wrap; }
        .stu-search  { flex: 1; min-width: 200px; position: relative; }
        .stu-select  { min-width: 180px; }
        @media (max-width: 480px) { .stu-select { min-width: 100%; } }
      `}</style>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, letterSpacing: "-0.03em", lineHeight: 1.1, margin: 0 }}>Students</h1>
        <p style={{ fontSize: 14, color: C.body, marginTop: 6 }}>Manage enrolled students, programs, status, and course mapping.</p>
      </div>

      {/* Stats */}
      <div className="stu-stat-grid">
        <StatCard label="Total Students" value={students.length}                         icon={Users}       loading={loading} />
        <StatCard label="Active"          value={students.filter((s) => !s.graduated).length} icon={CheckCircle} loading={loading} />
        <StatCard label="Graduated"       value={students.filter((s) => s.graduated).length}  icon={GraduationCap} loading={loading} />
      </div>

      {/* Filters */}
      <Card>
        <div style={{ padding: "20px 26px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="stu-filters">
            <div className="stu-search">
              <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.muted }} />
              <input
                type="text" placeholder="Search name, email, program…" value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ width: "100%", paddingLeft: 36, paddingRight: 14, paddingTop: 10, paddingBottom: 10, borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, fontSize: 13, color: C.text, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <select
              value={programFilter} onChange={(e) => setProgramFilter(e.target.value)}
              className="stu-select"
              style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, fontSize: 13, color: C.text, outline: "none" }}
            >
              <option value="">All Programs</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {/* Status pills */}
          <div style={{ display: "inline-flex", borderRadius: 99, background: "rgba(226,232,240,0.4)", padding: 4, border: `1px solid ${C.border}`, gap: 2 }}>
            {(["all", "active", "graduated"] as StatusFilter[]).map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                style={{ padding: "5px 18px", borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", transition: "all 0.2s ease", background: statusFilter === s ? ICON_GRAD : "transparent", color: statusFilter === s ? "#fff" : C.muted, boxShadow: statusFilter === s ? "0 4px 12px rgba(15,164,175,0.3)" : "none" }}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Student list */}
      <Card>
        <div style={{ padding: "22px 26px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            
            <p style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>Students List</p>
          </div>
          <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, background: "rgba(175,221,229,0.2)", border: `1px solid ${C.border}`, color: C.muted, fontWeight: 600 }}>
            {filtered.length} / {students.length}
          </span>
        </div>
        <div style={{ padding: "20px 26px 26px" }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[1, 2, 3, 4].map((i) => <div key={i} style={{ height: 72, borderRadius: 12, background: "#f1f5f9", animation: "shimmer 1.6s ease-in-out infinite" }} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ height: 56, width: 56, borderRadius: 16, background: "rgba(175,221,229,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Users size={24} color={C.mutedLight} />
              </div>
              <p style={{ fontSize: 14, color: C.body, margin: 0 }}>No students found.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map((s) => (
                <StudentRow key={s.id} student={s}
                  onView={() => openModal("view", s)}
                  onEdit={() => openModal("edit", s)}
                  onGraduate={() => openModal("graduate", s)}
                  onDelete={() => openModal("delete", s)}
                />
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Modal */}
      {modalType && selectedStudent && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.border}`, boxShadow: "0 32px 80px rgba(0,49,53,0.22)", width: "100%", maxWidth: 460, padding: "28px 24px", position: "relative", maxHeight: "90vh", overflowY: "auto" }}>
            <button onClick={closeModal} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", color: C.muted }}><X size={18} /></button>
            {error && <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 12 }}>{error}</div>}

            {modalType === "view" && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <div style={{ height: 44, width: 44, minWidth: 44, borderRadius: "50%", background: ICON_GRAD, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Eye size={18} color="#fff" />
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>Student Details</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {([["Name", selectedStudent.name], ["Email", selectedStudent.email], ["Program", selectedStudent.program_name ?? "—"], ["Department", selectedStudent.department_name ?? "—"], ["Status", selectedStudent.graduated ? "Graduated" : "Active"], ["Joined", selectedStudent.joined_at ? new Date(selectedStudent.joined_at).toLocaleDateString() : "—"], ["Courses", String(selectedStudent.courses_count)]] as [string, string][]).map(([k, v]) => (
                    <div key={k} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 12, color: C.muted, width: 90, flexShrink: 0 }}>{k}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{v}</span>
                    </div>
                  ))}
                </div>
                {selectedStudent.courses.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Enrolled Courses</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {selectedStudent.courses.map((c) => (
                        <div key={c.id} style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(248,250,252,0.8)", border: `1px solid ${C.border}` }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>{c.name}</p>
                          <p style={{ fontSize: 11, color: C.muted, margin: "2px 0 0" }}>{c.academic_year} · {c.semester_name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={closeModal} style={{ padding: "8px 18px", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.textSoft, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Close</button>
                </div>
              </>
            )}

            {modalType === "edit" && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <div style={{ height: 44, width: 44, minWidth: 44, borderRadius: "50%", background: ICON_GRAD, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Edit size={18} color="#fff" />
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>Edit Student</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {(["name", "email"] as const).map((field) => (
                    <div key={field}>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{field}</label>
                      <input type={field === "email" ? "email" : "text"} value={editForm[field]} onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })}
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, fontSize: 13, color: C.text, outline: "none", boxSizing: "border-box" }} />
                    </div>
                  ))}
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Program</label>
                    <select value={editForm.program_id} onChange={(e) => setEditForm({ ...editForm, program_id: e.target.value })}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, fontSize: 13, color: C.text, outline: "none" }}>
                      <option value="">Select Program</option>
                      {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button onClick={closeModal} style={{ padding: "8px 18px", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.textSoft, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                  <PrimaryBtn onClick={handleEdit} disabled={actionLoading}>
                    {actionLoading && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />} Save Changes
                  </PrimaryBtn>
                </div>
              </>
            )}

            {modalType === "graduate" && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ height: 44, width: 44, minWidth: 44, borderRadius: "50%", background: "linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <GraduationCap size={18} color="#fff" />
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>Mark as Graduated</p>
                </div>
                <p style={{ fontSize: 14, color: C.body, marginBottom: 20 }}>Mark <strong style={{ color: C.text }}>{selectedStudent.name}</strong> as graduated? This action cannot be undone.</p>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button onClick={closeModal} style={{ padding: "8px 18px", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.textSoft, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                  <PrimaryBtn onClick={handleGraduate} disabled={actionLoading} color="purple">
                    {actionLoading && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />} Confirm
                  </PrimaryBtn>
                </div>
              </>
            )}

            {modalType === "delete" && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ height: 44, width: 44, minWidth: 44, borderRadius: "50%", background: "linear-gradient(135deg, #be123c 0%, #e11d48 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Trash2 size={18} color="#fff" />
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>Delete Student</p>
                </div>
                <p style={{ fontSize: 14, color: C.body, marginBottom: 20 }}>Delete <strong style={{ color: C.text }}>{selectedStudent.name}</strong>? This cannot be undone.</p>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button onClick={closeModal} style={{ padding: "8px 18px", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.textSoft, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                  <PrimaryBtn onClick={handleDelete} disabled={actionLoading} color="red">
                    {actionLoading && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />} Delete
                  </PrimaryBtn>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Replace the StudentRow component with this mobile-optimized version:

function StudentRow({ student, onView, onEdit, onGraduate, onDelete }: { student: Student; onView: () => void; onEdit: () => void; onGraduate: () => void; onDelete: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ 
        display: "flex", 
        flexDirection: "column",
        gap: 12, 
        padding: "14px 16px", 
        borderRadius: 14, 
        border: `1px solid ${hov ? "rgba(15,164,175,0.22)" : "rgba(226,232,240,0.7)"}`, 
        background: hov ? "#fff" : "rgba(248,250,252,0.8)", 
        transition: "all 0.2s ease", 
        boxShadow: hov ? "0 6px 20px rgba(0,49,53,0.08)" : "none" 
      }}
    >
      {/* Top row: avatar + info + actions */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ 
            fontSize: 13.5, fontWeight: 700, color: C.primary, 
            margin: 0, wordBreak: "break-word"
          }}>
            {student.name}
          </p>
          <p style={{ 
            fontSize: 12, color: C.muted, margin: "2px 0 0",
            wordBreak: "break-all"
          }}>
            {student.email}
          </p>
        </div>

        {/* Actions — top right */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <IconBtn icon={Eye}    onClick={onView}     title="View" />
          <IconBtn icon={Edit}   onClick={onEdit}     title="Edit" />
          {!student.graduated && <IconBtn icon={Award} onClick={onGraduate} title="Graduate" variant="warn" />}
          <IconBtn icon={Trash2} onClick={onDelete}   title="Delete" variant="danger" />
        </div>
      </div>

      {/* Bottom row: badges */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap"}}>
        {student.program_name && (
          <span style={{ 
            fontSize: 11, fontWeight: 600, padding: "3px 10px", 
            borderRadius: 6, background: "rgba(139,92,246,0.1)", 
            color: "#6d28d9", border: "1px solid rgba(139,92,246,0.2)",
            whiteSpace: "nowrap"
          }}>
            {student.program_name}
          </span>
        )}
        <span style={{ 
          fontSize: 11, fontWeight: 600, padding: "3px 10px", 
          borderRadius: 6, whiteSpace: "nowrap",
          ...(student.graduated 
            ? { background: "rgba(245,158,11,0.08)", color: "#b45309", border: "1px solid rgba(245,158,11,0.25)" } 
            : { background: "rgba(16,185,129,0.08)", color: "#065f46", border: "1px solid rgba(16,185,129,0.25)" }
          )
        }}>
          {student.graduated ? "Graduated" : "Active"}
        </span>
        {student.courses_count > 0 && (
          <span style={{ 
            fontSize: 11, fontWeight: 600, padding: "3px 10px", 
            borderRadius: 6, background: "rgba(175,221,229,0.2)", 
            color: C.primary, border: `1px solid ${C.border}`, 
            display: "inline-flex", alignItems: "center", gap: 3,
            whiteSpace: "nowrap"
          }}>
            <BookOpen size={10} /> {student.courses_count}
          </span>
        )}
      </div>
    </div>
  );
}