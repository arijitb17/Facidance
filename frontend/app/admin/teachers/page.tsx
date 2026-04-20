"use client";

import { useState } from "react";
import { UserPlus, Building2, Trash2, Mail, CheckCircle2, Loader2, Users } from "lucide-react";
import { useTeachers, useDepartments } from "@/hooks/useAdmin";
import { teachersApi } from "@/lib/api";

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
  const [activeTeacherId, setActiveTeacherId] = useState<string | null>(null);
  const [activeDeptId, setActiveDeptId] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove(teacherUserId: string) {
    if (!activeDeptId) return;
    setActionLoading(true); setError(null);
    try { await teachersApi.approve(teacherUserId, activeDeptId); setActiveTeacherId(null); setActiveDeptId(""); refetch(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to approve teacher"); }
    finally { setActionLoading(false); }
  }

  async function handleDelete(userId: string) {
    if (!confirm("Delete this teacher? This cannot be undone.")) return;
    setActionLoading(true); setError(null);
    try { await teachersApi.delete(userId); refetch(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to delete teacher"); }
    finally { setActionLoading(false); }
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
          <div style={{ padding: "22px 26px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ height: 36, width: 36, minWidth: 36, borderRadius: 10, background: ICON_GRAD, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Building2 size={16} color="#fff" />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>Approved Teachers</p>
                <p style={{ fontSize: 12, color: C.body, margin: "2px 0 0" }}>Assigned to departments</p>
              </div>
            </div>
            <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, background: "rgba(15,164,175,0.08)", border: `1px solid ${C.borderHov}`, color: C.primary, fontWeight: 600, flexShrink: 0 }}>
              {approved.length} active
            </span>
          </div>
          <div style={{ padding: "20px 26px 26px", display: "flex", flexDirection: "column", gap: 10 }}>
            {teachersLoading ? (
              <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
            ) : approved.length === 0 ? (
              <EmptyState icon={Building2} message="No approved teachers yet." />
            ) : approved.map((t) => (
              <ApprovedRow key={t.id} teacher={t} onDelete={() => handleDelete(t.userId)} actionLoading={actionLoading} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ApprovedRow({ teacher, onDelete, actionLoading }: {
  teacher: { id: string; name: string; email: string; departmentName?: string | null; userId: string };
  onDelete: () => void; actionLoading: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px", borderRadius: 14, border: `1px solid ${hov ? "rgba(15,164,175,0.22)" : "rgba(226,232,240,0.7)"}`, background: hov ? "#fff" : "rgba(248,250,252,0.8)", transition: "all 0.2s ease", boxShadow: hov ? "0 6px 20px rgba(0,49,53,0.08)" : "none" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
        <div style={{ height: 40, width: 40, minWidth: 40, borderRadius: "50%", background: ICON_GRAD, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Users size={16} color="#fff" />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: "#003135", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{teacher.name}</p>
          <p style={{ fontSize: 12, color: "#475569", margin: "2px 0 0", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}><Mail size={11} /> {teacher.email}</p>
          <p style={{ fontSize: 11, color: "#475569", margin: "2px 0 0" }}>
            Dept: <span style={{ fontWeight: 700, color: "#003135" }}>{teacher.departmentName ?? "—"}</span>
          </p>
        </div>
      </div>
      <button onClick={onDelete} disabled={actionLoading}
        style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 13px", borderRadius: 9, border: "1px solid #fecdd3", background: hov ? "#fff1f2" : "transparent", color: "#e11d48", fontSize: 12, fontWeight: 600, cursor: actionLoading ? "not-allowed" : "pointer", transition: "all 0.2s ease", flexShrink: 0, whiteSpace: "nowrap" }}>
        <Trash2 size={12} /> Delete
      </button>
    </div>
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