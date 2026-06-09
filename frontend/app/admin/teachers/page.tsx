"use client";

import { useState } from "react";
import { UserPlus, Building2, Trash2, Mail, CheckCircle2, Loader2, Users, ChevronDown, BookOpen, X, Pencil } from "lucide-react";
import { useTeachers, useDepartments, useCourses, useStudents } from "@/hooks/useAdmin";
import { teachersApi } from "@/lib/api";
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
  return <div style={{ background: CARD_GRAD, border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: SHADOW.rest, overflow: "visible", ...style }}>{children}</div>;
}

function Btn({ children, onClick, primary, danger, small, disabled }: {
  children: React.ReactNode; onClick?: () => void; primary?: boolean; danger?: boolean; small?: boolean; disabled?: boolean;
}) {
  const [hov, setHov] = useState(false);
  let bg = hov ? "#f0f9fa" : C.white;
  let color = hov ? C.primary : C.textSoft;
  let border = `1px solid ${hov ? C.borderHov : C.border}`;
  let shadow: string = hov ? SHADOW.hover : SHADOW.rest;
  if (primary) { bg = ICON_GRAD; color = "#fff"; border = "none"; shadow = hov ? `${SHADOW.active}, inset 0 1px 0 rgba(255,255,255,0.18)` : "0 8px 24px rgba(15,164,175,0.35)"; }
  if (danger) { bg = hov ? "#fff1f2" : "transparent"; color = "#e11d48"; border = "1px solid #fecdd3"; shadow = "none"; }
  return (
    <button onClick={onClick} disabled={disabled} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: small ? "6px 13px" : "9px 18px", borderRadius: 11, fontSize: small ? 12 : 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, transform: hov && !disabled ? "translateY(-2px) scale(1.01)" : "none", transition: EASE_ALL, background: bg, color, border, boxShadow: shadow, whiteSpace: "nowrap" }}>
      {children}
    </button>
  );
}

function SkeletonCard() {
  return <div style={{ height: 80, borderRadius: 14, background: "#f1f5f9", animation: "shimmer 1.6s ease-in-out infinite", backgroundSize: "200% 100%", backgroundImage: "linear-gradient(90deg, #f1f5f9 25%, #e8f0f5 50%, #f1f5f9 75%)" }} />;
}

export default function TeachersPage() {
  const { approved, pending, loading: teachersLoading, refetch } = useTeachers();
  const { data: departments } = useDepartments();
  const { data: courses } = useCourses();
  const { students } = useStudents();
  const [activeTeacherId, setActiveTeacherId] = useState<string | null>(null);
  const [activeDeptId, setActiveDeptId] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toasts, toast, removeToast } = useToast();

  const filteredApproved = filterDept 
    ? approved.filter(t => t.departmentId === filterDept)
    : approved;

  async function handleApprove(teacherUserId: string) {
    if (!activeDeptId) return;
    setActionLoading(true); setError(null);
    try { 
      await teachersApi.approve(teacherUserId, activeDeptId); 
      toast.success("Teacher Approved", "Successfully approved and assigned department.");
      setActiveTeacherId(null); setActiveDeptId(""); refetch(); 
    }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to approve teacher"); }
    finally { setActionLoading(false); }
  }

  async function handleDelete(userId: string) {
    if (!confirm("Are you sure you want to delete this teacher? This cannot be undone.")) return;
    setActionLoading(true); setError(null);
    try {
      await teachersApi.delete(userId);
      toast.success("Teacher Deleted", "Successfully removed teacher account");
      refetch();
    } catch (err) {
      toast.error("Delete Failed", err instanceof Error ? err.message : "Failed to delete teacher");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleEditDept(userId: string, newDeptId: string) {
    try {
      await teachersApi.updateDepartment(userId, newDeptId);
      toast.success("Success", "Teacher department updated successfully.");
      refetch();
    } catch (err) {
      toast.error("Update Failed", err instanceof Error ? err.message : "Failed to update department");
      throw err;
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Two-panel grid: side-by-side on desktop, stacked on mobile */
        .teacher-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media (max-width: 900px) { .teacher-grid { grid-template-columns: 1fr !important; } }

        /* Stat pills: wrap on small screens */
        .teacher-stats { display: flex; gap: 10px; flex-wrap: wrap; }

        /* Pending row action buttons: wrap on small screens */
        .pending-actions { display: flex; gap: 8px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }
        @media (max-width: 480px) { .pending-actions { width: 100%; margin-top: 10px; } }

        /* Approved teacher row: stack on mobile */
        @media (max-width: 540px) {
          .approved-row { flex-direction: column !important; align-items: flex-start !important; }
          .approved-row-actions { width: 100% !important; margin-top: 8px !important; }
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
          <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, letterSpacing: "-0.03em", lineHeight: 1.1, margin: 0 }}>Teachers</h1>
          <p style={{ fontSize: 14, color: C.body, marginTop: 6 }}>Approve new teachers, assign departments, and manage faculty records.</p>
        </div>
        {/* Mini stat pills */}
        <div className="teacher-stats">
          {[
            { label: "Total",    value: approved.length + pending.length, bg: "rgba(175,221,229,0.15)", border: C.border,       color: C.muted },
            { label: "Pending",  value: pending.length,                   bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.3)", color: "#92400e" },
            { label: "Approved", value: approved.length,                  bg: "rgba(15,164,175,0.08)", border: C.borderHov,    color: C.primary },
          ].map((s) => (
            <div key={s.label} style={{ padding: "8px 16px", borderRadius: 12, background: s.bg, border: `1px solid ${s.border}`, textAlign: "center" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>{s.label}</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: s.color, margin: "2px 0 0" }}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ padding: "12px 18px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13 }}>{error}</div>
      )}

      {/* Two-panel grid */}
      <div className="teacher-grid">

        {/* Pending */}
        <Card>
          <div style={{ padding: "22px 26px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ height: 36, width: 36, minWidth: 36, borderRadius: 10, background: "rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <UserPlus size={16} color="#f59e0b" />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>Pending Approvals</p>
                <p style={{ fontSize: 12, color: C.body, margin: "2px 0 0" }}>Assign a department to approve</p>
              </div>
            </div>
            <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", color: "#92400e", fontWeight: 600, flexShrink: 0 }}>
              {pending.length} pending
            </span>
          </div>
          <div style={{ padding: "20px 26px 26px", display: "flex", flexDirection: "column", gap: 12 }}>
            {teachersLoading ? (
              <><SkeletonCard /><SkeletonCard /></>
            ) : pending.length === 0 ? (
              <EmptyState icon={UserPlus} message="No pending registrations." />
            ) : pending.map((t) => (
              <div key={t.id} style={{ borderRadius: 14, border: `1px solid ${activeTeacherId === t.id ? C.borderHov : C.border}`, padding: "16px 18px", background: activeTeacherId === t.id ? "rgba(15,164,175,0.03)" : "rgba(248,250,252,0.8)", transition: "all 0.2s ease" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                    <div style={{ height: 40, width: 40, minWidth: 40, borderRadius: "50%", background: ICON_GRAD, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Users size={16} color="#fff" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13.5, fontWeight: 700, color: C.text, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</p>
                      <p style={{ fontSize: 12, color: C.body, margin: "2px 0 0", display: "flex", alignItems: "center", gap: 4 }}><Mail size={11} /> {t.email}</p>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#b45309", background: "rgba(245,158,11,0.1)", padding: "2px 8px", borderRadius: 6, display: "inline-block", marginTop: 4 }}>Pending approval</span>
                    </div>
                  </div>
                  <div className="pending-actions">
                    <Btn small primary onClick={() => setActiveTeacherId(activeTeacherId === t.id ? null : t.id)}>
                      Assign & Approve
                    </Btn>
                    <Btn small danger disabled={actionLoading} onClick={() => handleDelete(t.userId)}>
                      <Trash2 size={12} /> Reject
                    </Btn>
                  </div>
                </div>
                {activeTeacherId === t.id && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}`, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Assign Department</label>
                      <select value={activeDeptId} onChange={(e) => setActiveDeptId(e.target.value)}
                        style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, fontSize: 13, color: C.text, outline: "none" }}>
                        <option value="">Select department</option>
                        {(departments ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <button disabled={actionLoading || !activeDeptId} onClick={() => handleApprove(t.userId)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, background: actionLoading || !activeDeptId ? "#e2e8f0" : "linear-gradient(135deg, #059669 0%, #10b981 100%)", color: actionLoading || !activeDeptId ? C.muted : "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: actionLoading || !activeDeptId ? "not-allowed" : "pointer", transition: "all 0.2s ease", whiteSpace: "nowrap" }}>
                      {actionLoading ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <CheckCircle2 size={13} />}
                      Confirm
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Approved */}
        <Card>
          <div style={{ padding: "22px 26px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ height: 36, width: 36, minWidth: 36, borderRadius: 10, background: ICON_GRAD, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Building2 size={16} color="#fff" />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>Approved Teachers</p>
                <p style={{ fontSize: 12, color: C.body, margin: "2px 0 0" }}>Assigned to departments</p>
              </div>
            </div>
            
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {/* Department Filter */}
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
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.borderHov)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
                >
                  <option value="">All Departments</option>
                  {(departments ?? []).map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} color={C.muted} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              </div>

              <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, background: "rgba(15,164,175,0.08)", border: `1px solid ${C.borderHov}`, color: C.primary, fontWeight: 600, flexShrink: 0 }}>
                {filteredApproved.length} {filteredApproved.length === 1 ? 'active' : 'active'}
              </span>
            </div>
          </div>
          <div style={{ padding: "20px 26px 26px", display: "flex", flexDirection: "column", gap: 10 }}>
            {teachersLoading ? (
              <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
            ) : filteredApproved.length === 0 ? (
              <EmptyState icon={Building2} message={filterDept ? "No approved teachers in this department." : "No approved teachers yet."} />
            ) : filteredApproved.map((t) => (
              <ApprovedRow key={t.id} teacher={t} departments={departments ?? []} onClick={() => setSelectedTeacher(t)} onDelete={() => handleDelete(t.userId)} onEditDept={handleEditDept} actionLoading={actionLoading} />
            ))}
          </div>
        </Card>
      </div>

      {selectedTeacher && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15,23,42,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: C.white, borderRadius: 20, padding: 30, width: "100%", maxWidth: 500, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", position: "relative" }}>
            <button onClick={() => setSelectedTeacher(null)} style={{ position: "absolute", top: 16, right: 16, background: "rgba(226,232,240,0.5)", border: "none", width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.muted, zIndex: 10 }}>
              <X size={16} />
            </button>
            
            <div style={{ overflowY: "auto", flex: 1, minHeight: 0, paddingRight: 10, marginRight: -10 }}>
              <div style={{ alignItems: "center", display: "flex", flexDirection: "column", borderBottom: `1px solid ${C.border}`, paddingBottom: 24, marginBottom: 20, flexShrink: 0, paddingTop: 10 }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: C.secondary, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>{selectedTeacher.name?.charAt(0) || "T"}</span>
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0, textAlign: "center" }}>{selectedTeacher.name}</h2>
                <span style={{ background: "rgba(15,164,175,0.1)", padding: "4px 14px", borderRadius: 16, marginTop: 8, border: `1px solid ${C.accent}`, fontSize: 11, fontWeight: 700, color: C.secondary }}>Faculty</span>
              </div>

              <div style={{ marginBottom: 16, flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", background: "rgba(248,250,252,0.8)", padding: 14, borderRadius: 12, marginBottom: 8, border: `1px solid ${C.border}` }}>
                  <Mail size={16} color={C.muted} style={{ marginRight: 14 }} />
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 2px" }}>Email</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>{selectedTeacher.email}</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", background: "rgba(248,250,252,0.8)", padding: 14, borderRadius: 12, marginBottom: 8, border: `1px solid ${C.border}` }}>
                  <Building2 size={16} color={C.muted} style={{ marginRight: 14 }} />
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 2px" }}>Department</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>{selectedTeacher.departmentName ?? "—"}</p>
                  </div>
                </div>
              </div>

              {(() => {
                const teacherCourses = courses?.filter(c => c.teacher_id === selectedTeacher.id || c.teacher_name === selectedTeacher.name) || [];
                const mappedCourses = teacherCourses.map(c => {
                  const enrolledCount = students?.filter(s => s.courses?.some(sc => sc.id === c.id)).length || 0;
                  return { ...c, studentsCount: enrolledCount };
                });
                const totalStudents = mappedCourses.reduce((sum, c) => sum + c.studentsCount, 0);

                return (
                  <>
                    <div style={{ display: "flex", background: "rgba(248,250,252,0.8)", borderRadius: 12, marginBottom: 20, border: `1px solid ${C.border}`, flexShrink: 0 }}>
                      <div style={{ flex: 1, padding: "16px 0", textAlign: "center" }}>
                        <p style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: "0 0 4px" }}>{mappedCourses.length}</p>
                        <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, margin: 0 }}>Courses</p>
                      </div>
                      <div style={{ width: 1, background: C.border }} />
                      <div style={{ flex: 1, padding: "16px 0", textAlign: "center" }}>
                        <p style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: "0 0 4px" }}>{totalStudents}</p>
                        <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, margin: 0 }}>Students</p>
                      </div>
                    </div>

                    <p style={{ fontSize: 12, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12, flexShrink: 0 }}>Courses Teaching</p>
                    <div style={{ paddingBottom: 10 }}>
                      {mappedCourses.length > 0 ? mappedCourses.map(c => (
                        <div key={c.id} style={{ display: "flex", background: C.white, padding: 14, borderRadius: 12, marginBottom: 8, border: `1px solid ${C.border}` }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(15,164,175,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 12, flexShrink: 0 }}>
                            <BookOpen size={16} color={C.secondary} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: "0 0 2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</p>
                            <p style={{ fontSize: 11, fontWeight: 600, color: C.accent, margin: "0 0 8px" }}>{c.code}</p>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(15,164,175,0.1)", color: C.secondary, padding: "3px 8px", borderRadius: 6 }}>{c.program_name ?? "Unknown"}</span>
                              <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(16,185,129,0.1)", color: "#059669", padding: "3px 8px", borderRadius: 6 }}>{c.semester_name ?? "Unknown"}</span>
                              <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(245,158,11,0.1)", color: "#d97706", padding: "3px 8px", borderRadius: 6 }}>{c.studentsCount} students</span>
                            </div>
                          </div>
                        </div>
                      )) : (
                        <p style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "20px 0" }}>No courses assigned yet.</p>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
            
            <div style={{ paddingTop: 20, marginTop: 10, borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
              <button onClick={() => setSelectedTeacher(null)} style={{ width: "100%", padding: "12px 0", borderRadius: 12, background: C.secondary, color: "#fff", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}

function EditDeptModal({
  teacher,
  departments,
  onClose,
  onSave,
  isSaving,
  initialDeptId,
}: {
  teacher: any;
  departments: { id: string; name: string }[];
  onClose: () => void;
  onSave: (deptId: string) => Promise<void>;
  isSaving: boolean;
  initialDeptId: string;
}) {
  const [deptId, setDeptId] = useState(initialDeptId);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.5)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: C.white,
          borderRadius: 20,
          padding: 30,
          width: "100%",
          maxWidth: 460,
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "rgba(226,232,240,0.5)",
            border: "none",
            width: 32,
            height: 32,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: C.muted,
          }}
        >
          <X size={16} />
        </button>

        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.text }}>
          Edit department for <span style={{ color: C.primary }}>{teacher.name}</span>
        </h2>

        <div style={{ marginTop: 24 }}>
          <label
            style={{
              display: "block",
              marginBottom: 6,
              fontSize: 12,
              fontWeight: 600,
              color: C.muted,
            }}
          >
            Department
          </label>
          <select
            value={deptId}
            onChange={(e) => setDeptId(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: "#fff",
              fontSize: 13,
              color: C.text,
            }}
          >
            <option value="">Select department...</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            marginTop: 30,
            display: "flex",
            gap: 12,
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            disabled={isSaving}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              background: "#e2e8f0",
              color: "#475569",
              border: "none",
              fontSize: 13,
              cursor: isSaving ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(deptId)}
            disabled={isSaving || !deptId}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              background: isSaving || !deptId ? "#cbd5e1" : "#0FA4AF",
              color: "#fff",
              border: "none",
              fontSize: 13,
              cursor: isSaving || !deptId ? "not-allowed" : "pointer",
            }}
          >
            {isSaving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ApprovedRow({ teacher, departments, onClick, onDelete, onEditDept, actionLoading }: {
  teacher: { id: string; name: string; email: string; departmentName?: string | null; department_id?: string | null; departmentId?: string | null; userId: string };
  departments: { id: string; name: string }[];
  onClick: () => void; onDelete: () => void; onEditDept: (userId: string, newDeptId: string) => Promise<void>; actionLoading: boolean;
}) {
  const [hov, setHov] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const startEdit = () => setIsEditing(true);
  const closeEdit = () => setIsEditing(false);

  const handleSave = async (deptId: string) => {
    setIsSaving(true);
    try {
      await onEditDept(teacher.userId, deptId);
      closeEdit();
    } catch (e) {
      // handled by parent toast
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div
        onClick={!isEditing ? onClick : undefined}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        className="approved-row"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px", borderRadius: 14, border: `1px solid ${hov ? "rgba(15,164,175,0.22)" : "rgba(226,232,240,0.7)"}`, background: hov ? "#fff" : "rgba(248,250,252,0.8)", transition: "all 0.2s ease", boxShadow: hov ? "0 6px 20px rgba(0,49,53,0.08)" : "none", cursor: isEditing ? "default" : "pointer", flexWrap: "wrap" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
          <div style={{ height: 40, width: 40, minWidth: 40, borderRadius: "50%", background: ICON_GRAD, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Users size={16} color="#fff" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: "#003135", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{teacher.name}</p>
            <p style={{ fontSize: 12, color: "#475569", margin: "2px 0 0", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}><Mail size={11} /> {teacher.email}</p>
            <p style={{ fontSize: 11, color: "#475569", margin: "2px 0 0" }}>
              Dept: <span style={{ fontWeight: 700, color: "#003135" }}>{teacher.departmentName ?? "—"}</span>
            </p>
          </div>
        </div>
        
        {!isEditing && (
          <div className="approved-row-actions" style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <button onClick={(e) => { e.stopPropagation(); startEdit(); }} disabled={actionLoading}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 13px", borderRadius: 9, border: "1px solid #cbd5e1", background: hov ? "#fff" : "transparent", color: "#475569", fontSize: 12, fontWeight: 600, cursor: actionLoading ? "not-allowed" : "pointer", transition: "all 0.2s ease", flexShrink: 0, whiteSpace: "nowrap" }}>
              <Pencil size={12} /> Edit
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} disabled={actionLoading}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 13px", borderRadius: 9, border: "1px solid #fecdd3", background: hov ? "#fff1f2" : "transparent", color: "#e11d48", fontSize: 12, fontWeight: 600, cursor: actionLoading ? "not-allowed" : "pointer", transition: "all 0.2s ease", flexShrink: 0, whiteSpace: "nowrap" }}>
              <Trash2 size={12} /> Delete
            </button>
          </div>
        )}
      </div>

      {isEditing && (
        <EditDeptModal
          teacher={teacher}
          departments={departments}
          onClose={closeEdit}
          onSave={handleSave}
          isSaving={isSaving}
          initialDeptId={teacher.department_id || teacher.departmentId || ""}
        />
      )}
    </>
  );
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ height: 48, width: 48, borderRadius: 14, background: "rgba(175,221,229,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={20} color="#94a3b8" />
      </div>
      <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>{message}</p>
    </div>
  );
}