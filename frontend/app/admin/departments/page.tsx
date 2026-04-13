"use client";

import { useEffect, useState } from "react";
import { PlusCircle, X, Building2, Check, BookOpen, Users, Trash2, Loader2 } from "lucide-react";
import { departmentsApi, Department } from "@/lib/api";

const SPRING   = "cubic-bezier(.22,.68,0,1.2)";
const EASE_ALL = `all 0.25s ${SPRING}`;
const C = {
  primary: "#003135", secondary: "#024950", accent: "#0FA4AF", light: "#AFDDE5",
  text: "#0f172a", textSoft: "#334155", body: "#475569", muted: "#64748b",
  mutedLight: "#94a3b8", border: "rgba(226,232,240,0.7)", borderHov: "rgba(15,164,175,0.22)",
  white: "#ffffff",
};
const ICON_GRAD = `linear-gradient(135deg, ${C.primary} 0%, ${C.accent} 100%)`;
const CARD_GRAD = "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)";
const SHADOW = { rest: "0 2px 12px rgba(0,49,53,0.06)", hover: "0 12px 36px rgba(0,49,53,0.12)", active: "0 16px 40px rgba(15,164,175,0.35)" };

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: CARD_GRAD, border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: SHADOW.rest, overflow: "hidden", ...style }}>
      {children}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, loading }: { label: string; value: number; icon: React.ElementType; loading: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: CARD_GRAD, border: `1px solid ${hov ? C.borderHov : C.border}`,
        borderRadius: 18, padding: "22px 24px",
        boxShadow: hov ? SHADOW.hover : SHADOW.rest,
        transform: hov ? "translateY(-5px) scale(1.01)" : "none", transition: EASE_ALL,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>{label}</p>
          {loading
            ? <div style={{ width: 80, height: 36, borderRadius: 8, background: "#f1f5f9", marginTop: 10, animation: "shimmer 1.6s ease-in-out infinite", backgroundSize: "200% 100%", backgroundImage: "linear-gradient(90deg, #f1f5f9 25%, #e8f0f5 50%, #f1f5f9 75%)" }} />
            : <p style={{ fontSize: 34, fontWeight: 800, color: C.text, lineHeight: 1, marginTop: 10, letterSpacing: "-0.03em" }}>{value}</p>
          }
        </div>
        <div style={{
          height: 50, width: 50, minWidth: 50, borderRadius: 14, background: ICON_GRAD,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: hov ? "0 8px 24px rgba(15,164,175,0.38)" : "0 6px 20px rgba(15,164,175,0.28)",
          transform: hov ? "scale(1.1) rotate(-3deg)" : "none", transition: EASE_ALL,
        }}>
          <Icon size={22} color="#fff" strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

function Btn({ children, onClick, primary, disabled, small }: { children: React.ReactNode; onClick?: () => void; primary?: boolean; disabled?: boolean; small?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: small ? "6px 13px" : "9px 18px", borderRadius: 11,
        fontSize: small ? 12 : 13, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        letterSpacing: "-0.01em", opacity: disabled ? 0.5 : 1,
        transform: hov && !disabled ? "translateY(-2px) scale(1.01)" : "none", transition: EASE_ALL,
        ...(primary
          ? { background: ICON_GRAD, color: "#fff", border: "none", boxShadow: hov ? `${SHADOW.active}, inset 0 1px 0 rgba(255,255,255,0.18)` : "0 8px 24px rgba(15,164,175,0.35), inset 0 1px 0 rgba(255,255,255,0.15)" }
          : { background: hov ? "#f0f9fa" : C.white, color: hov ? C.primary : C.textSoft, border: `1px solid ${hov ? C.borderHov : C.border}`, boxShadow: hov ? SHADOW.hover : SHADOW.rest }),
      }}
    >
      {children}
    </button>
  );
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newDept, setNewDept] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchDepartments() {
    try { const data = await departmentsApi.list(); setDepartments(data.departments); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to fetch departments"); }
  }

  async function addDepartment() {
    if (!newDept.trim()) return;
    setLoading(true); setError(null);
    try { await departmentsApi.create(newDept.trim()); setNewDept(""); setShowForm(false); await fetchDepartments(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to add department"); }
    finally { setLoading(false); }
  }

  async function deleteDepartment(id: string, name: string) {
    if (!confirm(`Delete "${name}" department? This cannot be undone.`)) return;
    setError(null);
    try { await departmentsApi.delete(id); await fetchDepartments(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to delete department"); }
  }

  useEffect(() => {
    (async () => { setInitialLoading(true); await fetchDepartments(); setInitialLoading(false); })();
  }, []);

  const totalPrograms = departments.reduce((sum, d) => sum + (d.programs_count ?? 0), 0);
  const totalTeachers = departments.reduce((sum, d) => sum + (d.teachers_count ?? 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }

        .dept-stat-grid { display: grid; gap: 16px; grid-template-columns: repeat(3, 1fr); }
        @media (max-width: 900px)  { .dept-stat-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 540px)  { .dept-stat-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, letterSpacing: "-0.03em", lineHeight: 1.1, margin: 0 }}>Departments</h1>
          <p style={{ fontSize: 14, color: C.body, marginTop: 6, lineHeight: 1.5 }}>Manage academic departments and their structure.</p>
        </div>
        <Btn primary onClick={() => setShowForm((p) => !p)}>
          <PlusCircle size={14} /> {showForm ? "Close" : "Add Department"}
        </Btn>
      </div>

      {/* Error */}
      {error && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13 }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626" }}><X size={14} /></button>
        </div>
      )}

      {/* Stats */}
      <div className="dept-stat-grid">
        <StatCard label="Total Departments" value={departments.length} icon={Building2} loading={initialLoading} />
        <StatCard label="Active Programs"   value={totalPrograms}       icon={BookOpen}  loading={initialLoading} />
        <StatCard label="Faculty Members"   value={totalTeachers}       icon={Users}     loading={initialLoading} />
      </div>

      {/* Add form */}
      {showForm && (
        <Card>
          <div style={{ padding: "22px 26px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ height: 36, width: 36, borderRadius: 10, background: "rgba(175,221,229,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Building2 size={16} color={C.secondary} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>Add New Department</p>
            </div>
            <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }}><X size={18} /></button>
          </div>
          <div style={{ padding: "20px 26px 26px" }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Department Name</label>
                <input
                  type="text" value={newDept} onChange={(e) => setNewDept(e.target.value)}
                  placeholder="e.g., Computer Science"
                  onKeyDown={(e) => e.key === "Enter" && addDepartment()}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, fontSize: 13, color: C.text, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <Btn primary onClick={addDepartment} disabled={loading || !newDept.trim()}>
                  {loading ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />Adding…</> : <><Check size={13} />Add</>}
                </Btn>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* List */}
      <Card>
        <div style={{ padding: "22px 26px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ height: 36, width: 36, borderRadius: 10, background: ICON_GRAD, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Building2 size={16} color="#fff" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>All Departments</p>
          </div>
          <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, background: "rgba(175,221,229,0.2)", border: `1px solid ${C.border}`, color: C.muted, fontWeight: 600 }}>
            {departments.length} total
          </span>
        </div>
        <div style={{ padding: "20px 26px 26px" }}>
          {initialLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[1, 2, 3].map((i) => <div key={i} style={{ height: 72, borderRadius: 12, background: "#f1f5f9", animation: "shimmer 1.6s ease-in-out infinite" }} />)}
            </div>
          ) : departments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ height: 56, width: 56, borderRadius: 16, background: "rgba(175,221,229,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Building2 size={24} color={C.mutedLight} />
              </div>
              <p style={{ fontSize: 14, color: C.body, margin: 0 }}>No departments found. Add your first one above.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {departments.map((dept) => (
                <DeptRow key={dept.id} dept={dept} onDelete={() => deleteDepartment(dept.id, dept.name)} />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function DeptRow({ dept, onDelete }: { dept: Department; onDelete: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        padding: "14px 18px", borderRadius: 14,
        border: `1px solid ${hov ? "rgba(15,164,175,0.22)" : "rgba(226,232,240,0.7)"}`,
        background: hov ? "#fff" : "rgba(248,250,252,0.8)",
        transition: "all 0.2s ease",
        boxShadow: hov ? "0 6px 20px rgba(0,49,53,0.08)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
        <div style={{ height: 42, width: 42, minWidth: 42, borderRadius: 12, background: ICON_GRAD, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Building2 size={18} color="#fff" />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#003135", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{dept.name}</p>
          <div style={{ display: "flex", gap: 16, marginTop: 4, flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#475569" }}>
              <BookOpen size={11} color="#8b5cf6" /> {dept.programs_count ?? 0} programs
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#475569" }}>
              <Users size={11} color="#10b981" /> {dept.teachers_count ?? 0} teachers
            </span>
          </div>
        </div>
      </div>
      <button
        onClick={onDelete}
        style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 13px", borderRadius: 9, border: "1px solid #fecdd3", background: hov ? "#fff1f2" : "transparent", color: "#e11d48", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: EASE_ALL, flexShrink: 0, whiteSpace: "nowrap" }}
      >
        <Trash2 size={12} /> Delete
      </button>
    </div>
  );
}