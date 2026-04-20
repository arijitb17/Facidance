"use client";

import { useState } from "react";
import { BookOpen, GraduationCap, Trash2, PlusCircle, X, Loader2, Users } from "lucide-react";
import { useCourses, useTeachers, usePrograms, useDepartments } from "@/hooks/useAdmin";
import { coursesApi } from "@/lib/api";

const SPRING   = "cubic-bezier(.22,.68,0,1.2)";
const EASE_ALL = `all 0.25s ${SPRING}`;
const C = {
  primary: "#003135", secondary: "#024950", accent: "#0FA4AF",
  text: "#0f172a", textSoft: "#334155", body: "#475569", muted: "#64748b", mutedLight: "#94a3b8",
  border: "rgba(226,232,240,0.7)", borderHov: "rgba(15,164,175,0.22)", white: "#ffffff",
};
const ICON_GRAD = `linear-gradient(135deg, ${C.primary} 0%, ${C.accent} 100%)`;
const CARD_GRAD = "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)";
const SHADOW = {
  rest: "0 2px 12px rgba(0,49,53,0.06)",
  hover: "0 12px 36px rgba(0,49,53,0.12)",
  active: "0 16px 40px rgba(15,164,175,0.35)",
};

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: CARD_GRAD, border: `1px solid ${C.border}`, borderRadius: 16, boxShadow: SHADOW.rest, overflow: "hidden", ...style }}>
      {children}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, loading }: { label: string; value: number; icon: React.ElementType; loading: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: CARD_GRAD,
        border: `1px solid ${hov ? C.borderHov : C.border}`,
        borderRadius: 14, padding: "12px 10px",
        boxShadow: hov ? SHADOW.hover : SHADOW.rest,
        transform: hov ? "translateY(-3px)" : "none",
        transition: EASE_ALL, minWidth: 0, overflow: "hidden",
      }}
    >
      <p style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
        {loading ? (
          <div style={{ width: 32, height: 24, borderRadius: 5, background: "#f1f5f9", animation: "shimmer 1.6s ease-in-out infinite", backgroundSize: "200% 100%", backgroundImage: "linear-gradient(90deg,#f1f5f9 25%,#e8f0f5 50%,#f1f5f9 75%)" }} />
        ) : (
          <p style={{ fontSize: 26, fontWeight: 800, color: C.text, lineHeight: 1, margin: 0, letterSpacing: "-0.03em" }}>{value}</p>
        )}
        <div style={{
          height: 34, width: 34, minWidth: 34, borderRadius: 10, background: ICON_GRAD,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 3px 10px rgba(15,164,175,0.28)",
          transform: hov ? "scale(1.08) rotate(-3deg)" : "none", transition: EASE_ALL,
        }}>
          <Icon size={15} color="#fff" strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

function Btn({ children, onClick, primary, disabled }: {
  children: React.ReactNode; onClick?: () => void; primary?: boolean; disabled?: boolean;
}) {
  const [hov, setHov] = useState(false);
  let bg = hov ? "#f0f9fa" : C.white;
  let color = hov ? C.primary : C.textSoft;
  let border = `1px solid ${hov ? C.borderHov : C.border}`;
  let shadow: string = hov ? SHADOW.hover : SHADOW.rest;
  if (primary) { bg = ICON_GRAD; color = "#fff"; border = "none"; shadow = hov ? SHADOW.active : "0 6px 20px rgba(15,164,175,0.32)"; }
  return (
    <button
      onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
        padding: "0 16px", height: 40, borderRadius: 11, fontSize: 13, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
        transition: EASE_ALL, background: bg, color, border, boxShadow: shadow,
        WebkitTapHighlightColor: "transparent", whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

const fieldCls: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 10,
  border: `1px solid rgba(226,232,240,0.9)`, background: "#fff",
  fontSize: 14, color: "#0f172a", outline: "none",
  boxSizing: "border-box", minHeight: 42,
  WebkitAppearance: "none", appearance: "none" as const,
};

export default function CoursesPage() {
  const { data: courses, loading, refetch } = useCourses();
  const { approved: teachers } = useTeachers();
  const { data: programs } = usePrograms();
  const { data: departments } = useDepartments();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", teacher_id: "", program_id: "", academic_year: "", semester_number: "", department_filter: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredTeachers = form.department_filter
    ? teachers.filter((t) => t.departmentId === form.department_filter)
    : teachers;

  async function handleCreate() {
    const { name, teacher_id, program_id, academic_year, semester_number } = form;
    if (!name || !teacher_id || !program_id || !academic_year || !semester_number) { setError("Please fill in all required fields."); return; }
    setSubmitting(true); setError(null);
    try {
      await coursesApi.create({ name, teacher_id, program_id, academic_year, semester_number: parseInt(semester_number, 10) });
      setForm({ name: "", teacher_id: "", program_id: "", academic_year: "", semester_number: "", department_filter: "" });
      setShowForm(false); refetch();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to create course"); }
    finally { setSubmitting(false); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete course "${name}"?`)) return;
    try { await coursesApi.delete(id); refetch(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to delete course"); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0}100%{background-position:-200% 0} }
        @keyframes spin { to{transform:rotate(360deg)} }

        .stat-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }
        @media (max-width: 540px) { .stat-grid { grid-template-columns: 1fr !important; } }

        .form-grid { display: grid; gap: 10px; grid-template-columns: 1fr; }
        @media (min-width: 500px)  { .form-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 900px)  { .form-grid { grid-template-columns: repeat(3, 1fr); } }

        .card-hd { padding: 14px 14px 0; }
        .card-bd  { padding: 10px 14px 14px; }
        @media (min-width: 640px) {
          .card-hd { padding: 18px 22px 0; }
          .card-bd  { padding: 14px 22px 22px; }
        }

        .course-row {
          display: flex; flex-direction: row;
          align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 12px;
          border: 1px solid rgba(226,232,240,0.7);
          background: rgba(248,250,252,0.8);
          transition: all 0.2s ease; min-width: 0;
        }
        .course-row:hover { background: #fff; border-color: rgba(15,164,175,0.22); box-shadow: 0 6px 20px rgba(0,49,53,0.08); }

        .ci { height: 34px; width: 34px; min-width: 34px; border-radius: 10px; background: ${ICON_GRAD}; display: flex; align-items: center; justify-content: center; }

        .cinfo { flex: 1; min-width: 0; overflow: hidden; }
        .cname { font-size: 13px; font-weight: 700; color: #003135; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cmeta { display: flex; align-items: center; gap: 5px; margin-top: 3px; overflow: hidden; }
        .ccode { font-family: monospace; font-size: 10px; background: rgba(226,232,240,0.6); padding: 1px 5px; border-radius: 5px; color: #64748b; border: 1px solid rgba(226,232,240,0.7); white-space: nowrap; flex-shrink: 0; }
        .cteacher { font-size: 11px; color: #0f172a; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
        .csem { font-size: 11px; color: #64748b; white-space: nowrap; flex-shrink: 0; }

        .delbtn {
          display: inline-flex; align-items: center; gap: 3px;
          padding: 5px 9px; height: 28px;
          border-radius: 7px; border: 1px solid #fecdd3;
          background: transparent;
          color: #e11d48; font-size: 11px; font-weight: 600;
          cursor: pointer; flex-shrink: 0; white-space: nowrap;
          transition: background 0.15s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .delbtn:hover { background: #fff1f2; }

        select { cursor: pointer; }
        button:active { opacity: 0.85; }
      `}</style>

      {/* Error */}
      {error && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13, gap: 10 }}>
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 0, display: "flex", minWidth: 28, minHeight: 28, alignItems: "center", justifyContent: "center" }}>
            <X size={13} />
          </button>
        </div>
      )}

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
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: "-0.03em", lineHeight: 1.1, margin: 0 }}>Courses</h1>
          <p style={{ fontSize: 13, color: C.body, marginTop: 3, marginBottom: 0 }}>Manage academic courses — teachers, programs, semesters.</p>
        </div>
        <Btn primary onClick={() => { setShowForm((p) => !p); setError(null); }}>
          {showForm ? <X size={13} /> : <PlusCircle size={13} />}
          {showForm ? "Close" : "Add Course"}
        </Btn>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <StatCard label="Total Courses" value={courses?.length ?? 0} icon={GraduationCap} loading={loading} />
        <StatCard label="Programs"      value={programs?.length ?? 0} icon={BookOpen}      loading={loading} />
        <StatCard label="Faculty"       value={teachers.length}       icon={Users}          loading={loading} />
      </div>

      {/* Add form */}
      {showForm && (
        <Card>
          <div className="card-hd" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ height: 30, width: 30, minWidth: 30, borderRadius: 9, background: "rgba(175,221,229,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BookOpen size={13} color={C.secondary} />
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>Add New Course</p>
            </div>
            <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 4, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 32, minHeight: 32 }}>
              <X size={16} />
            </button>
          </div>
          <div className="card-bd">
            <div className="form-grid">
              {[
                { label: "Filter by Department", el: <select value={form.department_filter} onChange={(e) => setForm({ ...form, department_filter: e.target.value, teacher_id: "" })} style={fieldCls}><option value="">All Departments</option>{(departments ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select> },
                { label: "Teacher *",             el: <select value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: e.target.value })} style={fieldCls}><option value="">Select Teacher</option>{filteredTeachers.map((t) => <option key={t.id} value={t.id}>{t.name}{t.departmentName ? ` (${t.departmentName})` : ""}</option>)}</select> },
                { label: "Program *",             el: <select value={form.program_id} onChange={(e) => setForm({ ...form, program_id: e.target.value })} style={fieldCls}><option value="">Select Program</option>{(programs ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select> },
                { label: "Academic Year *",       el: <input type="text" inputMode="text" placeholder="e.g. 2024-2025" value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: e.target.value })} style={fieldCls} /> },
                { label: "Semester *",            el: <select value={form.semester_number} onChange={(e) => setForm({ ...form, semester_number: e.target.value })} style={fieldCls}><option value="">Select Semester</option>{[1,2,3,4,5,6,7,8].map((n) => <option key={n} value={n}>Semester {n}</option>)}</select> },
                { label: "Course Name *",         el: <input type="text" placeholder="e.g. Data Structures" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={fieldCls} /> },
              ].map(({ label, el }) => (
                <div key={label}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>{label}</label>
                  {el}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <Btn onClick={() => setShowForm(false)}>Cancel</Btn>
              <Btn primary onClick={handleCreate} disabled={submitting}>
                {submitting && <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />}
                {submitting ? "Adding…" : "Add Course"}
              </Btn>
            </div>
          </div>
        </Card>
      )}

      {/* Course list */}
      <Card>
        <div className="card-hd" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ height: 30, width: 30, minWidth: 30, borderRadius: 9, background: ICON_GRAD, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <GraduationCap size={13} color="#fff" />
            </div>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>All Courses</p>
          </div>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "rgba(175,221,229,0.2)", border: `1px solid ${C.border}`, color: C.muted, fontWeight: 600 }}>
            {courses?.length ?? 0} total
          </span>
        </div>
        <div className="card-bd">
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ height: 58, borderRadius: 12, background: "#f1f5f9", animation: "shimmer 1.6s ease-in-out infinite", backgroundSize: "200% 100%", backgroundImage: "linear-gradient(90deg,#f1f5f9 25%,#e8f0f5 50%,#f1f5f9 75%)" }} />
              ))}
            </div>
          ) : !courses?.length ? (
            <div style={{ textAlign: "center", padding: "36px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div style={{ height: 48, width: 48, borderRadius: 13, background: "rgba(175,221,229,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BookOpen size={20} color={C.mutedLight} />
              </div>
              <p style={{ fontSize: 13, color: C.body, margin: 0 }}>No courses yet. Add one above.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {courses.map((c) => (
                <CourseRow key={c.id} course={c} onDelete={() => handleDelete(c.id, c.name)} />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function CourseRow({ course, onDelete }: {
  course: { id: string; name: string; code?: string | null; teacher_name?: string | null; academic_year_name?: string | null; semester_name?: string | null };
  onDelete: () => void;
}) {
  return (
    <div className="course-row">
      <div className="ci"><BookOpen size={14} color="#fff" /></div>
      <div className="cinfo">
        <p className="cname">{course.name}</p>
        <div className="cmeta">
          {course.code && <span className="ccode">{course.code}</span>}
          {course.teacher_name && <span className="cteacher">{course.teacher_name}</span>}
          <span className="csem">{[course.academic_year_name, course.semester_name].filter(Boolean).join(" · ") || "—"}</span>
        </div>
      </div>
      <button className="delbtn" onClick={onDelete}><Trash2 size={11} /> Delete</button>
    </div>
  );
}