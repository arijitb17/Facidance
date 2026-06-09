"use client";

import { useState, useRef, useEffect } from "react";
import { BookOpen, GraduationCap, Trash2, PlusCircle, X, Loader2, Users, Edit2, ChevronDown, Search, Check, User, Building2, Calendar, Key } from "lucide-react";
import { useCourses, useTeachers, usePrograms, useDepartments } from "@/hooks/useAdmin";
import { coursesApi } from "@/lib/api";
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
  const [filterSemester, setFilterSemester] = useState("");
  const { toasts, toast, removeToast } = useToast();

  const filteredCourses = (courses || []).filter((c) => {
    if (filterSemester && c.semester_name !== filterSemester) return false;
    return true;
  });
  
  const uniqueSemesters = Array.from(new Set((courses || []).map(c => c.semester_name).filter(Boolean))) as string[];
  uniqueSemesters.sort();

  const filteredTeachers = form.department_filter
    ? teachers.filter((t) => t.departmentId === form.department_filter)
    : teachers;

  async function handleCreate() {
    const { name, teacher_id, program_id, academic_year, semester_number } = form;
    if (!name || !teacher_id || !program_id || !academic_year || !semester_number) { setError("Please fill in all required fields."); return; }
    setSubmitting(true); setError(null);
    try {
      await coursesApi.create({ name, teacher_id, program_id, academic_year, semester_number: parseInt(semester_number, 10) });
      toast.success("Course Added", `Successfully added course: ${name}`);
      setForm({ name: "", teacher_id: "", program_id: "", academic_year: "", semester_number: "", department_filter: "" });
      setShowForm(false); refetch();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to create course"); }
    finally { setSubmitting(false); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete course "${name}"?`)) return;
    try { 
      await coursesApi.delete(id); 
      toast.success("Course Deleted", `Successfully deleted course: ${name}`);
      refetch(); 
    }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to delete course"); }
  }

  async function handleChangeTeacher(courseId: string, teacherId: string, courseName: string) {
    try {
      await coursesApi.updateTeacher(courseId, teacherId);
      const teacherName = teachers.find((t) => t.id === teacherId)?.name ?? "teacher";
      toast.success("Teacher Reassigned", `${courseName} assigned to ${teacherName}`);
      refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to change teacher");
    }
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
          display: flex; flex-direction: row; flex-wrap: wrap;
          align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 12px;
          border: 1px solid rgba(226,232,240,0.7);
          background: rgba(248,250,252,0.8);
          transition: all 0.2s ease; min-width: 0; box-sizing: border-box;
        }
        .course-row:hover { background: #fff; border-color: rgba(15,164,175,0.22); box-shadow: 0 6px 20px rgba(0,49,53,0.08); }
        .course-actions { display: flex; gap: 6px; flex-shrink: 0; margin-left: auto; }
        @media (max-width: 540px) {
          .course-actions { width: 100%; padding-left: 44px; margin-left: 0; margin-top: 2px; box-sizing: border-box; }
        }

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
                { label: "Program *",             el: <select value={form.program_id} onChange={(e) => setForm({ ...form, program_id: e.target.value })} style={fieldCls}><option value="">Select Program</option><option value="ALL">All Programs (Common Course)</option>{(programs ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select> },
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
      <Card style={{ overflow: "visible" }}>
        <div className="card-hd" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ height: 30, width: 30, minWidth: 30, borderRadius: 9, background: ICON_GRAD, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <GraduationCap size={13} color="#fff" />
            </div>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>All Courses</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {/* Semester Filter */}
            <div style={{ position: "relative" }}>
              <select 
                value={filterSemester} 
                onChange={(e) => setFilterSemester(e.target.value)}
                style={{
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
                <option value="">All Semesters</option>
                {uniqueSemesters.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown size={14} color={C.muted} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            </div>
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "rgba(175,221,229,0.2)", border: `1px solid ${C.border}`, color: C.muted, fontWeight: 600 }}>
              {filteredCourses.length} {filteredCourses.length === 1 ? 'course' : 'courses'}
            </span>
          </div>
        </div>
        <div className="card-bd">
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ height: 58, borderRadius: 12, background: "#f1f5f9", animation: "shimmer 1.6s ease-in-out infinite", backgroundSize: "200% 100%", backgroundImage: "linear-gradient(90deg,#f1f5f9 25%,#e8f0f5 50%,#f1f5f9 75%)" }} />
              ))}
            </div>
          ) : !filteredCourses.length ? (
            <div style={{ textAlign: "center", padding: "36px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div style={{ height: 48, width: 48, borderRadius: 13, background: "rgba(175,221,229,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BookOpen size={20} color={C.mutedLight} />
              </div>
              <p style={{ fontSize: 13, color: C.body, margin: 0 }}>
                {filterSemester ? "No courses found for this semester." : "No courses yet. Add one above."}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredCourses.map((c) => (
                <CourseRow
                  key={c.id}
                  course={c}
                  teachers={teachers}
                  onDelete={() => handleDelete(c.id, c.name)}
                  onChangeTeacher={(teacherId: string) => handleChangeTeacher(c.id, teacherId, c.name)}
                />
              ))}
            </div>
          )}
        </div>
      </Card>
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}

function CourseDetailsModal({ course, onClose }: {
  course: any;
  onClose: () => void;
}) {
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={onClose}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", animation: "fadeIn 0.2s ease forwards", willChange: "opacity" }} />
      <div onClick={(e) => e.stopPropagation()} style={{
        position: "relative", width: "100%", maxWidth: 420,
        background: "#fff", borderRadius: 24,
        boxShadow: "0 20px 40px rgba(0,49,53,0.15)", overflow: "hidden",
        animation: "modalIn 0.25s cubic-bezier(.2,.8,.4,1) forwards",
        willChange: "transform, opacity",
      }}>
        <div style={{ padding: "24px 24px 20px", display: "flex", alignItems: "center", gap: 16, borderBottom: "1px solid rgba(226,232,240,0.6)", background: "linear-gradient(180deg, rgba(248,250,252,0.6) 0%, #fff 100%)" }}>
          <div style={{ height: 48, width: 48, minWidth: 48, borderRadius: 14, background: ICON_GRAD, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 16px rgba(15,164,175,0.25)" }}>
            <BookOpen size={22} color="#fff" strokeWidth={2.5} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#003135", letterSpacing: "-0.02em", lineHeight: 1.2 }}>{course.name}</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600, color: "#64748b", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: "monospace", background: "rgba(226,232,240,0.5)", padding: "2px 6px", borderRadius: 6, color: "#475569" }}>{course.code || "No Code"}</span>
            </p>
          </div>
        </div>

        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { icon: User, label: "Teacher", value: course.teacher_name || "Unassigned", sub: course.teacher_email || "", highlight: false },
            { icon: Building2, label: "Department", value: course.department_name || "—", sub: "", highlight: false },
            { icon: GraduationCap, label: "Program", value: course.program_name || "—", sub: "", highlight: false },
            { icon: Calendar, label: "Year & Semester", value: [course.academic_year_name, course.semester_name].filter(Boolean).join(" • ") || "—", sub: "", highlight: false },
            { icon: Key, label: "Entry Code", value: course.entry_code || "—", sub: "", highlight: true },
          ].map((itm, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 16, background: itm.highlight ? "rgba(15,164,175,0.06)" : "#f8fafc", border: itm.highlight ? "1px solid rgba(15,164,175,0.2)" : "1px solid rgba(226,232,240,0.7)" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: itm.highlight ? "rgba(15,164,175,0.15)" : "#fff", border: itm.highlight ? "1px solid rgba(15,164,175,0.3)" : "1px solid rgba(226,232,240,0.8)", display: "flex", alignItems: "center", justifyContent: "center", color: itm.highlight ? "#0FA4AF" : "#64748b", boxShadow: itm.highlight ? "none" : "0 2px 4px rgba(0,0,0,0.02)" }}>
                <itm.icon size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: itm.highlight ? "#0FA4AF" : "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>{itm.label}</p>
                <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 700, color: itm.highlight ? "#003135" : "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{itm.value}</p>
                {itm.sub && <p style={{ margin: "1px 0 0", fontSize: 12, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{itm.sub}</p>}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: "0 24px 24px" }}>
          <button onClick={onClose} style={{ width: "100%", padding: "14px 0", borderRadius: 14, background: "#003135", color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 6px 16px rgba(0,49,53,0.2)", transition: "all 0.2s ease" }} onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"} onMouseLeave={(e) => e.currentTarget.style.transform = "none"}>
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}

function CourseRow({ course, teachers, onDelete, onChangeTeacher }: {
  course: { id: string; name: string; code?: string | null; teacher_id?: string | null; teacher_name?: string | null; academic_year_name?: string | null; semester_name?: string | null };
  teachers: { id: string; name: string; departmentName?: string | null }[];
  onDelete: () => void;
  onChangeTeacher: (teacherId: string) => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = teachers.filter((t) => {
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || (t.departmentName ?? "").toLowerCase().includes(q);
  });

  const selectedObj = teachers.find((t) => t.id === selectedTeacher);

  function getInitials(name: string) {
    return name.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  }

  return (
    <>
    <div style={{ borderRadius: 12, border: `1px solid rgba(226,232,240,0.7)`, background: "rgba(248,250,252,0.8)", transition: "all 0.2s ease", overflow: "visible", position: "relative", zIndex: dropdownOpen ? 10 : 1 }}>
      <div className="course-row" style={{ border: "none", borderRadius: 0, cursor: "pointer" }} onClick={() => setShowModal(true)}>
        <div className="ci"><BookOpen size={14} color="#fff" /></div>
        <div className="cinfo">
          <p className="cname">{course.name}</p>
          <div className="cmeta">
            {course.code && <span className="ccode">{course.code}</span>}
            {course.teacher_name ? (
              <span className="cteacher">{course.teacher_name}</span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 600, color: "#b45309", background: "rgba(245,158,11,0.1)", padding: "1px 7px", borderRadius: 5, whiteSpace: "nowrap" }}>
                Unassigned
              </span>
            )}
            <span className="csem">{[course.academic_year_name, course.semester_name].filter(Boolean).join(" · ") || "—"}</span>
          </div>
        </div>
        <div className="course-actions">
          <button
            onClick={(e) => { e.stopPropagation(); setShowReassign((p) => !p); setSelectedTeacher(""); setSearch(""); setDropdownOpen(false); }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              padding: "5px 9px", height: 28, borderRadius: 7,
              border: `1px solid ${showReassign ? "rgba(15,164,175,0.3)" : "rgba(226,232,240,0.7)"}`,
              background: showReassign ? "rgba(15,164,175,0.06)" : "transparent",
              color: showReassign ? "#003135" : "#64748b",
              fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
              transition: "all 0.15s ease",
            }}
          >
            <Edit2 size={10} /> {showReassign ? "Cancel" : "Change Teacher"}
          </button>
          <button className="delbtn" onClick={(e) => { e.stopPropagation(); onDelete(); }}><Trash2 size={11} /> Delete</button>
        </div>
      </div>
      {showReassign && (
        <div style={{
          padding: "12px 14px 14px",
          borderTop: "1px solid rgba(226,232,240,0.5)",
          background: "linear-gradient(180deg, rgba(15,164,175,0.03) 0%, rgba(248,250,252,0.5) 100%)",
          display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap",
          animation: "slideDown 0.2s ease",
        }}>
          <style>{`@keyframes slideDown { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }`}</style>
          <div ref={dropRef} style={{ flex: 1, minWidth: 220, position: "relative" }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
              Assign New Teacher
            </label>
            {/* Trigger */}
            <button
              onClick={() => setDropdownOpen((p) => !p)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", borderRadius: 10,
                border: `1.5px solid ${dropdownOpen ? "rgba(15,164,175,0.4)" : "rgba(226,232,240,0.9)"}`,
                background: "#fff", cursor: "pointer", transition: "all 0.15s ease",
                boxShadow: dropdownOpen ? "0 0 0 3px rgba(15,164,175,0.08)" : "none",
              }}
            >
              {selectedObj ? (
                <>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: "linear-gradient(135deg, #003135, #0FA4AF)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: 10, fontWeight: 800, letterSpacing: "0.02em", flexShrink: 0,
                  }}>{getInitials(selectedObj.name)}</div>
                  <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selectedObj.name}</p>
                    {selectedObj.departmentName && <p style={{ fontSize: 10, color: "#64748b", margin: "1px 0 0" }}>{selectedObj.departmentName}</p>}
                  </div>
                </>
              ) : (
                <span style={{ flex: 1, textAlign: "left", fontSize: 13, color: "#94a3b8" }}>Select a teacher…</span>
              )}
              <ChevronDown size={14} color="#94a3b8" style={{ transform: dropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s ease", flexShrink: 0 }} />
            </button>

            {/* Dropdown */}
            {dropdownOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
                background: "#fff", borderRadius: 12, border: "1px solid rgba(226,232,240,0.7)",
                boxShadow: "0 12px 40px rgba(0,49,53,0.15), 0 0 0 1px rgba(0,0,0,0.03)",
                zIndex: 50, overflow: "hidden",
                animation: "dropIn 0.18s ease",
              }}>
                <style>{`@keyframes dropIn { from { opacity:0; transform:translateY(-4px) scale(0.98); } to { opacity:1; transform:translateY(0) scale(1); } }`}</style>
                {/* Search */}
                <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(226,232,240,0.5)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid rgba(226,232,240,0.7)" }}>
                    <Search size={13} color="#94a3b8" />
                    <input
                      autoFocus
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search teachers…"
                      style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 12, color: "#0f172a" }}
                    />
                  </div>
                </div>
                {/* List */}
                <div style={{ maxHeight: 220, overflowY: "auto", padding: "4px" }}>
                  {filtered.length === 0 ? (
                    <div style={{ padding: "20px 14px", textAlign: "center" }}>
                      <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>No teachers found</p>
                    </div>
                  ) : filtered.map((t) => {
                    const isSelected = selectedTeacher === t.id;
                    const isCurrent = course.teacher_id === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => { setSelectedTeacher(t.id); setDropdownOpen(false); setSearch(""); }}
                        style={{
                          width: "100%", display: "flex", alignItems: "center", gap: 10,
                          padding: "8px 10px", borderRadius: 8, border: "none",
                          background: isSelected ? "rgba(15,164,175,0.08)" : "transparent",
                          cursor: isCurrent ? "default" : "pointer",
                          opacity: isCurrent ? 0.5 : 1,
                          transition: "background 0.12s ease",
                        }}
                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "rgba(15,164,175,0.05)"; }}
                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                        disabled={isCurrent}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: 9,
                          background: isSelected ? "linear-gradient(135deg, #003135, #0FA4AF)" : "linear-gradient(135deg, #e2e8f0, #cbd5e1)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: isSelected ? "#fff" : "#475569", fontSize: 11, fontWeight: 800,
                          transition: "all 0.15s ease", flexShrink: 0,
                        }}>{getInitials(t.name)}</div>
                        <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                          <p style={{ fontSize: 12.5, fontWeight: 600, color: "#0f172a", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {t.name}
                            {isCurrent && <span style={{ fontSize: 10, color: "#64748b", fontWeight: 500 }}> (current)</span>}
                          </p>
                          {t.departmentName && (
                            <span style={{
                              display: "inline-block", fontSize: 9.5, fontWeight: 600, marginTop: 2,
                              padding: "1px 6px", borderRadius: 4,
                              background: "rgba(15,164,175,0.08)", color: "#0FA4AF",
                            }}>{t.departmentName}</span>
                          )}
                        </div>
                        {isSelected && <Check size={14} color="#0FA4AF" strokeWidth={3} style={{ flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <button
            disabled={!selectedTeacher}
            onClick={() => { onChangeTeacher(selectedTeacher); setShowReassign(false); setSelectedTeacher(""); }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 18px", borderRadius: 10, border: "none",
              background: selectedTeacher
                ? "linear-gradient(135deg, #003135 0%, #0FA4AF 100%)"
                : "#e2e8f0",
              color: selectedTeacher ? "#fff" : "#94a3b8",
              fontSize: 13, fontWeight: 700,
              cursor: selectedTeacher ? "pointer" : "not-allowed",
              transition: "all 0.2s ease", whiteSpace: "nowrap",
              boxShadow: selectedTeacher ? "0 4px 14px rgba(15,164,175,0.3)" : "none",
            }}
          >
            <Check size={14} /> Assign Teacher
          </button>
        </div>
      )}
    </div>
    {showModal && <CourseDetailsModal course={course} onClose={() => setShowModal(false)} />}
    </>
  );
}