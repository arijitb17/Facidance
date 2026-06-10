"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Camera, Users, Brain, History, CheckCircle2,
  Play, Pause, Square, Clock, ArrowLeft,
  Zap, BarChart3, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  UserPlus, XCircle, Send,
} from "lucide-react";
import { useToast } from "@/lib/useToast";
import { ToastContainer } from "@/components/ToastContainer";
import { teacherAttendanceApi, type AttendanceHistoryRecord } from "@/lib/teacher-api";

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

const SESSION_DURATION = 45 * 60 * 1000;
const CAPTURE_INTERVAL = 2  * 60 * 1000;
const BASE_SCALE = 1.0;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Student { id: string; name: string; email: string; hasFaceData: boolean }
interface RecognitionStudent { id: string; name: string; email: string }
interface RecognitionResult { totalFaces: number; recognizedStudents: RecognitionStudent[]; averageConfidence: number; detections: unknown[] }
interface SessionRecognition { timestamp: string; recognizedStudents: RecognitionStudent[]; totalFaces: number; averageConfidence: number }

// ─── Components ───────────────────────────────────────────────────────────────
function Card({ children, style, accent }: { children: React.ReactNode; style?: React.CSSProperties; accent?: boolean }) {
  return (
    <div style={{
      background: CARD_GRAD,
      border: `1px solid ${accent ? C.borderHov : C.border}`,
      borderRadius: 20, overflow: "hidden",
      boxShadow: accent ? `0 0 0 3px rgba(15,164,175,0.1), ${SHADOW.rest}` : SHADOW.rest,
      ...style,
    }}>
      {children}
    </div>
  );
}

function CardHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div style={{ padding: "22px 26px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <div>
        <p style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: "-0.02em" }}>{title}</p>
        {sub && <p style={{ fontSize: 12, color: C.body, marginTop: 3 }}>{sub}</p>}
      </div>
      {right}
    </div>
  );
}

function ActionBtn({ children, onClick, disabled, variant = "primary" }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  variant?: "primary" | "pause" | "danger" | "ghost";
}) {
  const [hov, setHov] = useState(false);
  const map: Record<string, React.CSSProperties> = {
    primary: { background: disabled ? "#e2e8f0" : ICON_GRAD, color: disabled ? C.muted : "#fff", border: "none", boxShadow: !disabled && hov ? SHADOW.active : !disabled ? "0 8px 24px rgba(15,164,175,0.3)" : "none" },
    pause:   { background: hov ? "#fef3c7" : "#fffbeb", color: "#b45309", border: "1px solid rgba(245,158,11,0.3)", boxShadow: hov ? "0 8px 24px rgba(245,158,11,0.15)" : SHADOW.rest },
    danger:  { background: hov ? "#fef2f2" : C.white, color: "#dc2626", border: "1px solid rgba(239,68,68,0.3)", boxShadow: hov ? "0 8px 24px rgba(239,68,68,0.1)" : SHADOW.rest },
    ghost:   { background: hov ? "#f0f9fa" : C.white, color: hov ? C.primary : C.textSoft, border: `1px solid ${hov ? C.borderHov : C.border}`, boxShadow: hov ? SHADOW.hover : SHADOW.rest },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "9px 18px", borderRadius: 11, fontSize: 13, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        transform: !disabled && hov ? "translateY(-2px) scale(1.01)" : "translateY(0) scale(1)",
        transition: EASE_ALL, opacity: disabled ? 0.65 : 1,
        ...map[variant],
      }}
    >
      {children}
    </button>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      textAlign: "center", padding: "10px 16px",
      background: C.white, border: `1px solid ${C.border}`,
      borderRadius: 12, boxShadow: SHADOW.rest, minWidth: 72,
    }}>
      <p style={{ fontSize: 22, fontWeight: 900, color: color ?? C.text, letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 10, color: C.body, marginTop: 4, fontWeight: 500 }}>{label}</p>
    </div>
  );
}

// ─── Full-screen Review Panel ─────────────────────────────────────────────────
function ReviewPanel({
  students,
  allRecognizedStudents,
  manuallyMarked,
  submitting,
  summarySubmitted,
  onMarkPresent,
  onUnmarkPresent,
  onSubmit,
  onDismiss,
}: {
  students: Student[];
  allRecognizedStudents: Set<string>;
  manuallyMarked: Set<string>;
  submitting: boolean;
  summarySubmitted: boolean;
  onMarkPresent: (id: string) => void;
  onUnmarkPresent: (id: string) => void;
  onSubmit: () => void;
  onDismiss: () => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const allPresentSet = new Set(allRecognizedStudents);
  manuallyMarked.forEach((id) => allPresentSet.add(id));

  const presentStudents = students.filter((s) => allPresentSet.has(s.id));
  const absentStudents  = students.filter((s) => !allPresentSet.has(s.id));
  const totalPresent    = allPresentSet.size;
  const rate = students.length > 0 ? ((totalPresent / students.length) * 100).toFixed(1) : "0";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "#f1f5f9",
      display: "flex", flexDirection: "column",
      fontFamily: "inherit",
      // Push down to clear the app's top navbar (~64px typical height)
      paddingTop: 0,
    }}>
      {/* ── Sticky action bar — always visible at top ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 20px",
        background: C.white,
        borderBottom: `2px solid ${C.borderHov}`,
        boxShadow: "0 4px 20px rgba(0,49,53,0.1)",
        flexShrink: 0,
        flexWrap: "wrap",
        gap: 10,
      }}>
        {/* Left: back + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={onDismiss}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 10,
              background: "#f1f5f9", border: `1px solid ${C.border}`,
              color: C.textSoft, fontSize: 13, fontWeight: 600,
              cursor: "pointer", transition: EASE_ALL,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#e2e8f0"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <p style={{ fontSize: 15, fontWeight: 800, color: C.text, letterSpacing: "-0.02em", lineHeight: 1 }}>
              Review Attendance
            </p>
            <p style={{ fontSize: 11, color: C.body, marginTop: 2 }}>
              Tap any absent student to mark them present
            </p>
          </div>
        </div>

        {/* Center: stats pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ padding: "5px 12px", borderRadius: 20, background: "rgba(16,185,129,0.1)", color: "#059669", fontSize: 12, fontWeight: 700 }}>
            ✔ {totalPresent} present
          </span>
          <span style={{ padding: "5px 12px", borderRadius: 20, background: "rgba(239,68,68,0.08)", color: "#dc2626", fontSize: 12, fontWeight: 700 }}>
            ✗ {absentStudents.length} absent
          </span>
          <span style={{ padding: "5px 12px", borderRadius: 20, background: "rgba(15,164,175,0.1)", color: C.accent, fontSize: 12, fontWeight: 700 }}>
            {rate}%
          </span>
        </div>

        {/* Right: submit */}
        <button
          onClick={onSubmit}
          disabled={submitting || totalPresent === 0}
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "10px 20px", borderRadius: 11, fontSize: 13, fontWeight: 700,
            background: submitting || totalPresent === 0 ? "#e2e8f0" : ICON_GRAD,
            color: submitting || totalPresent === 0 ? C.muted : "#fff",
            border: "none",
            cursor: submitting || totalPresent === 0 ? "not-allowed" : "pointer",
            boxShadow: submitting || totalPresent === 0 ? "none" : "0 6px 20px rgba(15,164,175,0.35)",
            transition: EASE_ALL,
          }}
        >
          {submitting ? <><Zap size={14} /> Submitting…</> : <><Send size={14} /> Submit Attendance ({totalPresent})</>}
        </button>
      </div>

      {/* ── Two-pane scrollable body ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>

        {/* ── PRESENT section ── */}
        {presentStudents.length > 0 && (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            background: "rgba(16,185,129,0.04)",
            borderBottom: absentStudents.length > 0 ? "3px solid rgba(16,185,129,0.15)" : "none",
            minHeight: 0, overflow: "hidden",
          }}>
            <div style={{ padding: "12px 20px 8px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <CheckCircle2 size={14} color="#059669" />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Present — {presentStudents.length}
              </span>
            </div>
            <div style={{
              flex: 1, overflowY: "auto",
              padding: "0 20px 14px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
              gap: 8, alignContent: "start",
            }}>
              {presentStudents.map((s) => {
                const isAI     = allRecognizedStudents.has(s.id);
                const isManual = manuallyMarked.has(s.id) && !isAI;
                return (
                  <div key={s.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 13px", borderRadius: 12,
                    background: isManual ? "rgba(16,185,129,0.08)" : "rgba(15,164,175,0.07)",
                    border: `1px solid ${isManual ? "rgba(16,185,129,0.2)" : C.borderHov}`,
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</p>
                      <p style={{ fontSize: 11, color: C.body, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.email}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 16, fontSize: 10.5, fontWeight: 700,
                        background: isManual ? "rgba(16,185,129,0.12)" : ICON_GRAD,
                        color: isManual ? "#059669" : "#fff", whiteSpace: "nowrap",
                      }}>
                        {isManual ? "Marked" : "AI ✔"}
                      </span>
                      {isManual && !summarySubmitted && (
                        <button
                          onClick={() => onUnmarkPresent(s.id)}
                          title="Undo"
                          style={{
                            width: 22, height: 22, borderRadius: "50%", border: "none",
                            background: "rgba(239,68,68,0.1)", color: "#dc2626",
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 13, lineHeight: 1, transition: EASE_ALL,
                          }}
                        >×</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── ABSENT section ── */}
        {absentStudents.length > 0 && (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            background: "rgba(239,68,68,0.025)",
            minHeight: 0, overflow: "hidden",
          }}>
            <div style={{ padding: "12px 20px 8px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <XCircle size={14} color="#dc2626" />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Absent — {absentStudents.length}
              </span>
              <span style={{ fontSize: 11, color: C.body }}>· tap to mark present</span>
            </div>
            <div style={{
              flex: 1, overflowY: "auto",
              padding: "0 20px 14px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
              gap: 8, alignContent: "start",
            }}>
              {absentStudents.map((s) => {
                const hov = hoveredId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => onMarkPresent(s.id)}
                    onMouseEnter={() => setHoveredId(s.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 13px", borderRadius: 12, textAlign: "left",
                      background: hov ? "rgba(15,164,175,0.08)" : "rgba(239,68,68,0.04)",
                      border: `1px solid ${hov ? C.borderHov : "rgba(239,68,68,0.15)"}`,
                      cursor: "pointer", width: "100%",
                      transform: hov ? "translateY(-1px)" : "none",
                      boxShadow: hov ? SHADOW.hover : "none",
                      transition: EASE_ALL,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: hov ? C.primary : C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</p>
                      <p style={{ fontSize: 11, color: C.body, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.email}</p>
                    </div>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "4px 10px", borderRadius: 16,
                      background: hov ? ICON_GRAD : "rgba(239,68,68,0.08)",
                      color: hov ? "#fff" : "#dc2626",
                      fontSize: 11, fontWeight: 700, flexShrink: 0,
                      transition: EASE_ALL,
                      boxShadow: hov ? "0 4px 12px rgba(15,164,175,0.3)" : "none",
                    }}>
                      {hov ? <><UserPlus size={11} /> Mark</> : "✗ Absent"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* All present state */}
        {absentStudents.length === 0 && presentStudents.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, gap: 12 }}>
            <CheckCircle2 size={40} color="#059669" />
            <p style={{ fontSize: 16, fontWeight: 700, color: "#059669" }}>All students are present!</p>
            <p style={{ fontSize: 13, color: C.body }}>Perfect attendance this session.</p>
          </div>
        )}
      </div>

      {/* ── Sticky bottom bar — submit always reachable ── */}
      <div style={{
        position: "sticky", bottom: 0,
        background: C.white,
        borderTop: `2px solid ${C.borderHov}`,
        boxShadow: "0 -4px 20px rgba(0,49,53,0.08)",
        padding: "14px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, flexShrink: 0, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.body }}>
            <strong style={{ color: "#059669" }}>{totalPresent}</strong> present ·{" "}
            <strong style={{ color: "#dc2626" }}>{absentStudents.length}</strong> absent ·{" "}
            <strong style={{ color: C.accent }}>{rate}%</strong> rate
          </span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onDismiss}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 18px", borderRadius: 11,
              background: "#f1f5f9", border: `1px solid ${C.border}`,
              color: C.textSoft, fontSize: 13, fontWeight: 600,
              cursor: "pointer", transition: EASE_ALL,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#e2e8f0"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}
          >
            <ArrowLeft size={13} /> Back
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting || totalPresent === 0}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "10px 24px", borderRadius: 11, fontSize: 13, fontWeight: 700,
              background: submitting || totalPresent === 0 ? "#e2e8f0" : ICON_GRAD,
              color: submitting || totalPresent === 0 ? C.muted : "#fff",
              border: "none",
              cursor: submitting || totalPresent === 0 ? "not-allowed" : "pointer",
              boxShadow: submitting || totalPresent === 0 ? "none" : "0 6px 20px rgba(15,164,175,0.35)",
              transition: EASE_ALL,
            }}
          >
            {submitting ? <><Zap size={14} /> Submitting…</> : <><Send size={14} /> Submit Attendance ({totalPresent})</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AttendanceCapturePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toasts, toast, removeToast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const livePollingRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadRef = useRef(false);

  const [courseId, setCourseId] = useState("");
  const [courseName, setCourseName] = useState("");
  const [students, setStudents] = useState<Student[]>([]);

  const zoomRef = useRef(1);
  const [zoom, setZoom] = useState(1);
  const handleZoom = (val: number) => { setZoom(val); zoomRef.current = val; };

  const panRef = useRef(0);
  const [pan, setPan] = useState(0);
  const handlePan = (val: number) => { setPan(val); panRef.current = val; };

  const tiltRef = useRef(0);
  const [tilt, setTilt] = useState(0);
  const handleTilt = (val: number) => { setTilt(val); tiltRef.current = val; };

  const [sessionActive, setSessionActive] = useState(false);
  const [sessionPaused, setSessionPaused] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(SESSION_DURATION);
  const [sessionRecognitions, setSessionRecognitions] = useState<SessionRecognition[]>([]);
  const [allRecognizedStudents, setAllRecognizedStudents] = useState<Set<string>>(new Set());

  const [cameraActive, setCameraActive] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [currentRecognition, setCurrentRecognition] = useState<RecognitionResult | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<Record<string, AttendanceHistoryRecord[]>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // replaces showSessionSummary modal — now a full-screen review view
  const [showReview, setShowReview] = useState(false);
  const [manuallyMarked, setManuallyMarked] = useState<Set<string>>(new Set());
  const [summarySubmitted, setSummarySubmitted] = useState(false);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    const urlCourseId = searchParams.get("courseId");
    const urlCourseName = searchParams.get("courseName");
    const finalCourseId = urlCourseId || localStorage.getItem("selectedCourseId");
    const finalCourseName = urlCourseName || localStorage.getItem("selectedCourseName");
    if (!finalCourseId) { toast.error("No course selected", "Please select a course first"); router.push("/teacher/attendance"); return; }
    setCourseId(finalCourseId);
    setCourseName(finalCourseName || "");
    localStorage.setItem("selectedCourseId", finalCourseId);
    if (finalCourseName) localStorage.setItem("selectedCourseName", finalCourseName);
    fetchStudents(finalCourseId);
    fetchAttendanceHistory(finalCourseId);
    return () => { cleanup(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sessionActive && !sessionPaused && sessionStartTime) {
      countdownIntervalRef.current = setInterval(() => {
        const remaining = Math.max(0, SESSION_DURATION - (Date.now() - sessionStartTime));
        setTimeRemaining(remaining);
        if (remaining === 0) endSession();
      }, 1000);
      return () => { if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current); };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionActive, sessionPaused, sessionStartTime]);

  function cleanup() {
    stopCamera();
    if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
    if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (livePollingRef.current) clearInterval(livePollingRef.current);
  }

  useEffect(() => {
    if (sessionActive && !sessionPaused && courseId) {
      async function pollActiveSession() {
        try {
          const data = await teacherAttendanceApi.getActiveSession(courseId);
          if (data && data.active !== false) {
            if (data.manually_marked) {
              setManuallyMarked((prev) => {
                const next = new Set(prev);
                data.manually_marked.forEach((id: string) => next.add(id));
                prev.forEach((id) => { if (!data.manually_marked.includes(id)) next.delete(id); });
                return next;
              });
            }
          }
        } catch (e) { /* silent */ }
      }
      pollActiveSession();
      livePollingRef.current = setInterval(pollActiveSession, 3000);
      return () => { if (livePollingRef.current) { clearInterval(livePollingRef.current); livePollingRef.current = null; } };
    } else {
      if (livePollingRef.current) { clearInterval(livePollingRef.current); livePollingRef.current = null; }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionActive, sessionPaused, courseId]);

  async function fetchStudents(cid: string) {
    try {
      const data = await teacherAttendanceApi.getStudents(cid);
      setStudents(data.map((s) => ({ id: s.id, name: s.name, email: s.email, hasFaceData: s.has_face_data })));
    } catch { toast.error("Failed to load students", ""); }
  }

  async function fetchAttendanceHistory(cid: string) {
    try {
      const data = await teacherAttendanceApi.getHistory(cid);
      setAttendanceHistory(data.attendanceByDate || {});
    } catch { /* silent */ }
  }

  async function startCamera() {
    const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: "user" }, audio: false });
    if (videoRef.current) { videoRef.current.srcObject = mediaStream; setStream(mediaStream); setCameraActive(true); }
  }

  function stopCamera() {
    if (stream) { stream.getTracks().forEach((t) => t.stop()); setStream(null); setCameraActive(false); }
  }

  async function captureAndRecognize() {
    if (!videoRef.current || !canvasRef.current || !courseId) return;
    setCapturing(true);
    toast.info("Capturing frames…", "Running face recognition");
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setCapturing(false); return; }
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const z = BASE_SCALE * zoomRef.current;
    const cropWidth = video.videoWidth / z;
    const cropHeight = video.videoHeight / z;
    const maxPanX = (video.videoWidth - cropWidth) / 2;
    const sx = maxPanX + (panRef.current / 100) * maxPanX;
    const maxTiltY = (video.videoHeight - cropHeight) / 2;
    const sy = maxTiltY + (tiltRef.current / 100) * maxTiltY;
    const frames: File[] = [];
    try {
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 300));
        ctx.drawImage(video, sx, sy, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => b ? res(b) : rej(new Error("blob")), "image/jpeg", 0.9));
        frames.push(new File([blob], `frame_${i}.jpg`, { type: "image/jpeg" }));
      }
      await recognizeFaces(frames);
    } catch { toast.error("Capture failed", "Please try again."); }
    finally { setCapturing(false); }
  }

  async function recognizeFaces(frames: File[]) {
    if (!courseId || frames.length === 0) return;
    try {
      const result = await teacherAttendanceApi.recognize(courseId, frames, `batch_${Date.now()}`);
      const normalized = normalizeResult(result as unknown as Record<string, unknown>);
      setCurrentRecognition(normalized);
      setSessionRecognitions((prev) => [...prev, { timestamp: new Date().toISOString(), recognizedStudents: normalized.recognizedStudents, totalFaces: normalized.totalFaces, averageConfidence: normalized.averageConfidence }]);
      const prev = allRecognizedStudents.size;
      const next = new Set(allRecognizedStudents);
      normalized.recognizedStudents.forEach((s) => next.add(s.id));
      setAllRecognizedStudents(next);
      const added = next.size - prev;
      if (added > 0) toast.success(`${added} new student${added > 1 ? "s" : ""} recognized`, `Total present: ${next.size}`);
      else if (normalized.totalFaces > 0) toast.info("Scan complete", `${normalized.totalFaces} faces, no new students`);
      else toast.warning("No faces detected", "Make sure students are visible");
    } catch { toast.error("Recognition error", ""); }
  }

  function normalizeResult(result: Record<string, unknown>): RecognitionResult {
    const rawRec = (result.recognizedStudents as unknown[]) || [];
    const validStudents: RecognitionStudent[] = [];
    for (const item of rawRec) {
      if (!item) continue;
      let found: Student | undefined;
      if (typeof item === "string") {
        found = students.find((s) => s.id === item || s.name.toLowerCase() === item.toLowerCase());
      } else {
        const obj = item as Record<string, unknown>;
        for (const cand of [obj.id, obj.studentId, obj.name].filter(Boolean)) {
          found = students.find((s) => s.id === String(cand) || s.name.toLowerCase() === String(cand).toLowerCase());
          if (found) break;
        }
      }
      if (found && !validStudents.some(s => s.id === found!.id)) {
        validStudents.push({ id: found.id, name: found.name, email: found.email });
      }
    }
    return { totalFaces: Number(result.totalFaces ?? validStudents.length), recognizedStudents: validStudents, averageConfidence: typeof result.averageConfidence === "number" ? result.averageConfidence : 0, detections: [] };
  }

  async function startSession() {
    if (students.filter((s) => s.hasFaceData).length === 0) { toast.error("No trained students", "Please train the model first"); return; }
    try {
      await startCamera();
      const startTime = Date.now();
      if (courseId) teacherAttendanceApi.startActiveSession(courseId, startTime).catch(() => {});
      setSessionActive(true); setSessionPaused(false);
      setSessionStartTime(startTime); setTimeRemaining(SESSION_DURATION);
      setSessionRecognitions([]); setAllRecognizedStudents(new Set()); setCurrentRecognition(null);
      setShowReview(false);
      toast.success("Session started", "45-minute attendance session active");
      await new Promise((r) => setTimeout(r, 1000));
      captureAndRecognize();
      captureIntervalRef.current = setInterval(() => { if (!sessionPaused) captureAndRecognize(); }, CAPTURE_INTERVAL);
      sessionTimerRef.current = setTimeout(() => endSession(), SESSION_DURATION);
    } catch { toast.error("Camera failed", "Check camera permissions"); setSessionActive(false); }
  }

  function pauseSession() {
    setSessionPaused(true);
    if (captureIntervalRef.current) { clearInterval(captureIntervalRef.current); captureIntervalRef.current = null; }
    toast.warning("Paused", "Capture stopped. Data is preserved.");
  }

  function resumeSession() {
    setSessionPaused(false);
    captureIntervalRef.current = setInterval(() => captureAndRecognize(), CAPTURE_INTERVAL);
    toast.success("Resumed", "Capture restarted.");
  }

  function endSession() {
    cleanup(); setSessionActive(false); setSessionPaused(false);
    if (courseId) teacherAttendanceApi.clearActiveSession(courseId).catch(() => {});
    const allPresentCount = allRecognizedStudents.size + manuallyMarked.size;
    if (allPresentCount > 0) {
      toast.success("Session ended", `${allPresentCount} student${allPresentCount > 1 ? "s" : ""} present. Review below.`, 5000);
      // Open full-screen review immediately
      setShowReview(true);
      setSummarySubmitted(false);
    } else {
      toast.warning("Session ended", "No students were marked present.");
    }
  }

  async function submitFinalAttendance() {
    if (!courseId) return;
    const allPresentIds = new Set(allRecognizedStudents);
    manuallyMarked.forEach((id) => allPresentIds.add(id));
    if (allPresentIds.size === 0) { toast.error("Cannot submit", "No students marked present"); return; }
    setSubmitting(true);
    try {
      const submitDate = new Date().toISOString();
      const finalRec: RecognitionStudent[] = Array.from(allPresentIds)
        .map((sid) => { const s = students.find((st) => st.id === sid); return s ? { id: s.id, name: s.name, email: s.email } : null; })
        .filter((s): s is RecognitionStudent => s !== null);
      const result = await teacherAttendanceApi.submitAttendance(courseId, { recognizedStudents: finalRec }, submitDate);
      toast.success("Submitted!", `Present: ${result.statistics.present}, Absent: ${result.statistics.absent}, Rate: ${result.statistics.attendanceRate}%`, 7000);
      await fetchAttendanceHistory(courseId);
      setSummarySubmitted(true);
      setSessionRecognitions([]);
      setAllRecognizedStudents(new Set());
      setCurrentRecognition(null);
      setManuallyMarked(new Set());
      setShowReview(false);
    } catch { toast.error("Submission failed", ""); }
    finally { setSubmitting(false); }
  }

  function handleMarkPresent(studentId: string) {
    setManuallyMarked((prev) => new Set(prev).add(studentId));
    if (courseId) teacherAttendanceApi.updateManualMark(courseId, studentId, true).catch(() => {});
  }

  function handleUnmarkPresent(studentId: string) {
    setManuallyMarked((prev) => { const next = new Set(prev); next.delete(studentId); return next; });
    if (courseId) teacherAttendanceApi.updateManualMark(courseId, studentId, false).catch(() => {});
  }

  function goBack() {
    if (sessionActive && !window.confirm("Session is active. Leave without saving?")) return;
    cleanup();
    localStorage.removeItem("selectedCourseId"); localStorage.removeItem("selectedCourseName");
    router.push("/teacher/attendance");
  }

  function formatTime(ms: number) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  const trainedCount    = students.filter((s) => s.hasFaceData).length;
  const untrainedCount  = students.length - trainedCount;

  const allPresentSet   = new Set(allRecognizedStudents);
  manuallyMarked.forEach((id) => allPresentSet.add(id));
  const recognizedCount = allPresentSet.size;

  const attendanceRate  = students.length > 0 ? ((recognizedCount / students.length) * 100).toFixed(1) : "0.0";
  const historyEntries  = Object.entries(attendanceHistory).sort(([a], [b]) => b.localeCompare(a));
  const timeProgress    = ((SESSION_DURATION - timeRemaining) / SESSION_DURATION) * 100;

  if (!courseId) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", margin: "0 auto 14px", border: "2px solid rgba(15,164,175,0.15)", borderTopColor: C.accent, animation: "spin 0.9s linear infinite" }} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* ── Full-screen Review Panel (replaces modal) ── */}
      {showReview && (
        <ReviewPanel
          students={students}
          allRecognizedStudents={allRecognizedStudents}
          manuallyMarked={manuallyMarked}
          submitting={submitting}
          summarySubmitted={summarySubmitted}
          onMarkPresent={handleMarkPresent}
          onUnmarkPresent={handleUnmarkPresent}
          onSubmit={submitFinalAttendance}
          onDismiss={() => setShowReview(false)}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

        {/* Header */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "4px 0 8px" }}>
          <div>
            <button
              onClick={goBack}
              disabled={sessionActive && !sessionPaused}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 10, fontSize: 13, fontWeight: 600, color: C.body, background: "none", border: "none", cursor: sessionActive && !sessionPaused ? "not-allowed" : "pointer", padding: 0, opacity: sessionActive && !sessionPaused ? 0.5 : 1 }}
            >
              <ArrowLeft size={14} /> Back to Attendance Setup
            </button>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, letterSpacing: "-0.03em", lineHeight: 1.1 }}>AI Attendance Session</h1>
            <p style={{ fontSize: 14, color: C.body, marginTop: 6 }}>{courseName || "Automated 45-minute face recognition attendance"}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {!sessionActive && recognizedCount > 0 && (
              <ActionBtn variant="primary" onClick={() => setShowReview(true)}>
                <Users size={14} /> Review Attendance
              </ActionBtn>
            )}
            {!sessionActive && (
              <ActionBtn variant="ghost" onClick={() => setShowHistory(!showHistory)}>
                <History size={14} /> {showHistory ? "Hide History" : "View History"}
              </ActionBtn>
            )}
          </div>
        </div>

        {/* Active session timer bar */}
        {sessionActive && (
          <div style={{ background: CARD_GRAD, border: `2px solid ${C.borderHov}`, borderRadius: 20, overflow: "hidden", boxShadow: `0 0 0 4px rgba(15,164,175,0.08), ${SHADOW.hover}` }}>
            <div style={{ height: 4, background: "rgba(175,221,229,0.3)" }}>
              <div style={{ height: "100%", width: `${timeProgress}%`, background: ICON_GRAD, borderRadius: 4, transition: "width 1s linear" }} />
            </div>
            <div style={{ padding: "20px 26px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ height: 52, width: 52, borderRadius: 15, background: ICON_GRAD, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(15,164,175,0.3)" }}>
                    <Clock size={24} color="#fff" />
                  </div>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Time Remaining</p>
                    <p style={{ fontSize: 36, fontWeight: 900, color: C.accent, letterSpacing: "-0.04em", lineHeight: 1, marginTop: 2 }}>{formatTime(timeRemaining)}</p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <MiniStat label="Present"  value={recognizedCount}            color={C.accent} />
                  <MiniStat label="Rate"     value={`${attendanceRate}%`}       color={C.primary} />
                  <MiniStat label="Scans"    value={sessionRecognitions.length} color={C.body} />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <ActionBtn variant="primary" onClick={captureAndRecognize} disabled={capturing || sessionPaused}>
                    {capturing ? <Zap size={14} /> : <Camera size={14} />}
                    {capturing ? "Wait…" : "Capture Now"}
                  </ActionBtn>
                  {!sessionPaused ? (
                    <ActionBtn variant="pause" onClick={pauseSession}><Pause size={14} /> Pause</ActionBtn>
                  ) : (
                    <ActionBtn variant="primary" onClick={resumeSession}><Play size={14} /> Resume</ActionBtn>
                  )}
                  <ActionBtn variant="danger" onClick={endSession}><Square size={14} /> End Session</ActionBtn>
                </div>
              </div>
              {sessionPaused && (
                <div style={{ marginTop: 14, padding: "10px 16px", borderRadius: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", fontSize: 12.5, color: "#92400e" }}>
                  ⏸️ Session paused. {recognizedCount} student{recognizedCount !== 1 ? "s" : ""} recognized so far — data is preserved.
                </div>
              )}
              {capturing && (
                <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 10, background: "rgba(15,164,175,0.06)", border: `1px solid ${C.borderHov}`, fontSize: 12.5, color: C.primary }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.accent, animation: "pulse 1s ease-in-out infinite" }} />
                  Capturing frames and running face recognition…
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pre-session stats */}
        {!sessionActive && !showHistory && (
          <>
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(3, 1fr)" }} className="stat-grid">
              {[
                { label: "Total Students",   value: students.length,  color: C.text },
                { label: "Trained Students", value: trainedCount,     color: C.accent },
                { label: "Not Trained",      value: untrainedCount,   color: untrainedCount > 0 ? "#dc2626" : C.text },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: CARD_GRAD, border: `1px solid ${C.border}`, borderRadius: 18, padding: "22px 24px", boxShadow: SHADOW.rest }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</p>
                  <p style={{ fontSize: 34, fontWeight: 800, color, letterSpacing: "-0.03em", lineHeight: 1, marginTop: 10 }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Today's attendance banner */}
            {(() => {
              const today = new Date();
              const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
              const todaysAttendance = attendanceHistory[todayStr];
              if (!todaysAttendance || todaysAttendance.length === 0) return null;
              const present = todaysAttendance.filter((r) => r.status);
              const absentCount = todaysAttendance.length - present.length;
              const rate = ((present.length / todaysAttendance.length) * 100).toFixed(1);
              return (
                <div style={{ background: C.white, border: `2px solid rgba(15,164,175,0.25)`, borderRadius: 20, padding: "24px", boxShadow: "0 8px 30px rgba(15,164,175,0.08)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <CheckCircle2 size={20} color={C.accent} style={{ marginTop: 2 }} />
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: "-0.02em" }}>Attendance Already Recorded Today</p>
                      <p style={{ fontSize: 13, color: C.body, marginTop: 4 }}>Submitted via website or another device</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, padding: "0 10px" }}>
                    <div style={{ textAlign: "center" }}><p style={{ fontSize: 26, fontWeight: 800, color: "#059669", lineHeight: 1 }}>{present.length}</p><p style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginTop: 6 }}>Present</p></div>
                    <div style={{ textAlign: "center" }}><p style={{ fontSize: 26, fontWeight: 800, color: "#dc2626", lineHeight: 1 }}>{absentCount}</p><p style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginTop: 6 }}>Absent</p></div>
                    <div style={{ textAlign: "center" }}><p style={{ fontSize: 26, fontWeight: 800, color: C.accent, lineHeight: 1 }}>{rate}%</p><p style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginTop: 6 }}>Rate</p></div>
                  </div>
                  <div style={{ marginTop: 24, padding: "14px 16px", borderRadius: 12, background: "#f8fafc", border: `1px solid ${C.border}` }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: C.textSoft, marginBottom: 4 }}>Present students:</p>
                    <p style={{ fontSize: 13, color: C.body, lineHeight: 1.5 }}>{present.length > 0 ? present.map(p => p.studentName).join(", ") : "None"}</p>
                  </div>
                </div>
              );
            })()}
          </>
        )}

        {/* History panel */}
        {showHistory && (
          <Card>
            <CardHead title="Attendance History" sub="Past sessions for this course" />
            <div style={{ padding: "16px 26px 26px" }}>
              {historyEntries.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 0" }}>
                  <BarChart3 size={32} color={C.mutedLight} style={{ margin: "0 auto 12px" }} />
                  <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>No attendance history yet</p>
                  <p style={{ fontSize: 12, color: C.body, marginTop: 5 }}>Run your first session to see records here.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {historyEntries.map(([date, records]) => {
                    const presentCount = records.filter((r) => r.status).length;
                    const rate = ((presentCount / records.length) * 100).toFixed(1);
                    return <HistorySession key={date} date={date} records={records} presentCount={presentCount} rate={rate} courseName={courseName} />;
                  })}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Main session area */}
        {!showHistory && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,3fr) minmax(0,2fr)", gap: 20 }} className="session-grid">

            {/* Camera */}
            <Card>
              <CardHead title="Live Camera Feed" sub="Face recognition capture" />
              <div style={{ padding: "16px 26px 26px" }}>
                <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#0a0a0a", aspectRatio: "4/3", boxShadow: cameraActive ? "0 0 0 3px rgba(15,164,175,0.3)" : "none", transition: EASE_ALL }}>
                  <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transform: `scale(${BASE_SCALE * zoom}) translate(${-pan * 0.15}%, ${-tilt * 0.15}%)`, transition: "all 0.15s ease-out" }} />
                  <canvas ref={canvasRef} style={{ display: "none" }} />

                  {!cameraActive && !sessionActive && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.82)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24 }}>
                      {recognizedCount > 0 ? (
                        <>
                          <div style={{ height: 56, width: 56, borderRadius: 16, background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <CheckCircle2 size={24} color="#10b981" />
                          </div>
                          <div style={{ textAlign: "center" }}>
                            <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>Session Complete</p>
                            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 6, lineHeight: 1.6, maxWidth: 280 }}>
                              {recognizedCount} student{recognizedCount !== 1 ? "s" : ""} recognized
                            </p>
                          </div>
                          <button onClick={startSession} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", marginTop: 4 }}>
                            <Play size={15} /> Start New Session
                          </button>
                        </>
                      ) : (
                        <>
                          <div style={{ height: 56, width: 56, borderRadius: 16, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Camera size={24} color="#fff" />
                          </div>
                          <div style={{ textAlign: "center" }}>
                            <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>Ready to capture attendance</p>
                            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 6, lineHeight: 1.6, maxWidth: 280 }}>45-minute session · auto-capture every 2 min · cumulative recognition</p>
                          </div>
                          <button onClick={startSession} disabled={trainedCount === 0} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: 12, fontSize: 14, fontWeight: 700, background: trainedCount === 0 ? "rgba(255,255,255,0.1)" : ICON_GRAD, color: "#fff", border: "none", cursor: trainedCount === 0 ? "not-allowed" : "pointer", boxShadow: trainedCount > 0 ? "0 8px 24px rgba(15,164,175,0.4)" : "none", opacity: trainedCount === 0 ? 0.5 : 1 }}>
                            <Play size={17} /> Start 45-Min Session
                          </button>
                          {trainedCount === 0 && <p style={{ fontSize: 11.5, color: "rgba(255,100,100,0.9)" }}>⚠️ No trained students. Train the model first.</p>}
                        </>
                      )}
                    </div>
                  )}

                  {sessionActive && !capturing && (
                    <div style={{ position: "absolute", top: 12, right: 12, display: "flex", alignItems: "center", gap: 6, background: "rgba(16,185,129,0.9)", color: "#fff", padding: "5px 12px", borderRadius: 20, fontSize: 11.5, fontWeight: 700 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} /> Live
                    </div>
                  )}
                  {capturing && (
                    <div style={{ position: "absolute", top: 12, right: 12, display: "flex", alignItems: "center", gap: 6, background: "rgba(15,164,175,0.9)", color: "#fff", padding: "5px 12px", borderRadius: 20, fontSize: 11.5, fontWeight: 700, animation: "pulse 1s ease-in-out infinite" }}>
                      <Zap size={11} /> Capturing…
                    </div>
                  )}

                  {/* Camera Controls */}
                  {sessionActive && (
                    <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "flex-end", gap: 12, zIndex: 10 }}>
                      <div style={{ position: "relative", width: 120, height: 120, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(12px) saturate(1.4)", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)" }}>
                        <button onClick={() => handleTilt(Math.max(-100, tilt - 30))} style={{ position: "absolute", top: 6, left: "50%", transform: "translateX(-50%)", width: 32, height: 32, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s ease" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(15,164,175,0.5)"; e.currentTarget.style.transform = "translateX(-50%) scale(1.15)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.transform = "translateX(-50%) scale(1)"; }}><ChevronUp size={16} /></button>
                        <button onClick={() => handleTilt(Math.min(100, tilt + 30))} style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", width: 32, height: 32, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s ease" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(15,164,175,0.5)"; e.currentTarget.style.transform = "translateX(-50%) scale(1.15)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.transform = "translateX(-50%) scale(1)"; }}><ChevronDown size={16} /></button>
                        <button onClick={() => handlePan(Math.max(-100, pan - 30))} style={{ position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)", width: 32, height: 32, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s ease" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(15,164,175,0.5)"; e.currentTarget.style.transform = "translateY(-50%) scale(1.15)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.transform = "translateY(-50%) scale(1)"; }}><ChevronLeft size={16} /></button>
                        <button onClick={() => handlePan(Math.min(100, pan + 30))} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 32, height: 32, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s ease" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(15,164,175,0.5)"; e.currentTarget.style.transform = "translateY(-50%) scale(1.15)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.transform = "translateY(-50%) scale(1)"; }}><ChevronRight size={16} /></button>
                        <button onClick={() => { handlePan(0); handleTilt(0); }} style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 34, height: 34, borderRadius: "50%", border: "2px solid rgba(15,164,175,0.5)", background: "rgba(15,164,175,0.15)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease", fontSize: 9, fontWeight: 700 }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(15,164,175,0.4)"; e.currentTarget.style.transform = "translate(-50%,-50%) scale(1.1)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(15,164,175,0.15)"; e.currentTarget.style.transform = "translate(-50%,-50%) scale(1)"; }} title="Reset pan & tilt">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 1 3 6.36"/><path d="M3 21V12H12"/></svg>
                        </button>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(12px) saturate(1.4)", borderRadius: 28, padding: "8px 6px", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)" }}>
                        <button onClick={() => handleZoom(Math.min(10, zoom + 0.5))} style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s ease" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(15,164,175,0.5)"; e.currentTarget.style.transform = "scale(1.15)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.transform = "scale(1)"; }} title="Zoom in"><ZoomIn size={15} /></button>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.7)", padding: "4px 0", letterSpacing: "0.02em", userSelect: "none" }}>{zoom.toFixed(1)}×</span>
                        <button onClick={() => handleZoom(Math.max(0.5, zoom - 0.5))} style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s ease" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(15,164,175,0.5)"; e.currentTarget.style.transform = "scale(1.15)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.transform = "scale(1)"; }} title="Zoom out"><ZoomOut size={15} /></button>
                        <div style={{ width: 20, height: 1, background: "rgba(255,255,255,0.15)", margin: "4px 0" }} />
                        <button onClick={() => { handleZoom(1); handlePan(0); handleTilt(0); }} style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s ease", fontSize: 9, fontWeight: 700 }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.3)"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.transform = "scale(1.15)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; e.currentTarget.style.transform = "scale(1)"; }} title="Reset all controls">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 1 3 6.36"/><path d="M3 21V12H12"/></svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {!sessionActive && (
                  <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 12, background: "rgba(15,164,175,0.05)", border: `1px solid ${C.borderHov}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                      <Brain size={13} color={C.accent} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.primary }}>How cumulative attendance works</span>
                    </div>
                    <ol style={{ paddingLeft: 16, margin: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                      {["Click 'Start' — camera activates automatically", "First face capture runs immediately", "Auto-captures every 2 minutes thereafter", "Once recognized, students stay marked present", "Submit at end to save the session record"].map((step, i) => (
                        <li key={i} style={{ fontSize: 12, color: C.body, lineHeight: 1.5 }}>{step}</li>
                      ))}
                    </ol>
                    <p style={{ marginTop: 10, fontSize: 11.5, fontWeight: 700, color: C.accent }}>✨ Students only need to be detected once — no need to stay in frame!</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Recognition results panel */}
            <Card accent={recognizedCount > 0}>
              <CardHead title="Session Attendance" sub="Cumulative recognized students" right={recognizedCount > 0 ? (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "rgba(15,164,175,0.1)", color: C.accent }}>{recognizedCount} present</span>
              ) : undefined} />
              <div style={{ padding: "16px 26px 26px" }}>
                {!sessionActive && recognizedCount === 0 ? (
                  <div style={{ textAlign: "center", padding: "48px 0" }}>
                    <Users size={32} color={C.mutedLight} style={{ margin: "0 auto 12px" }} />
                    <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>No recognitions yet</p>
                    <p style={{ fontSize: 12, color: C.body, marginTop: 5 }}>Start a session to track attendance.</p>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                      <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(15,164,175,0.06)", border: `1px solid ${C.borderHov}` }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: "0.1em" }}>Present</p>
                        <p style={{ fontSize: 28, fontWeight: 900, color: C.text, letterSpacing: "-0.03em", lineHeight: 1, marginTop: 6 }}>{recognizedCount}</p>
                      </div>
                      <div style={{ padding: "12px 14px", borderRadius: 12, background: "#f8fafc", border: `1px solid ${C.border}` }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Absent</p>
                        <p style={{ fontSize: 28, fontWeight: 900, color: C.text, letterSpacing: "-0.03em", lineHeight: 1, marginTop: 6 }}>{students.length - recognizedCount}</p>
                      </div>
                    </div>

                    {recognizedCount > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: C.body, marginBottom: 8 }}>
                          Recognized students · {currentRecognition ? `Last scan: ${currentRecognition.totalFaces} faces` : ""}
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto", paddingRight: 4 }}>
                          {Array.from(allPresentSet).map((sid) => {
                            const s = students.find((st) => st.id === sid);
                            const isManual = manuallyMarked.has(sid) && !allRecognizedStudents.has(sid);
                            return (
                              <div key={sid} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 11, background: isManual ? "rgba(16,185,129,0.06)" : "rgba(15,164,175,0.06)", border: `1px solid ${isManual ? "rgba(16,185,129,0.15)" : C.borderHov}` }}>
                                <div>
                                  <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{s?.name || sid}</p>
                                  {s?.email && <p style={{ fontSize: 11, color: C.body, marginTop: 2 }}>{s.email}</p>}
                                </div>
                                <span style={{ padding: "3px 10px", borderRadius: 20, background: isManual ? "rgba(16,185,129,0.1)" : ICON_GRAD, color: isManual ? "#059669" : "#fff", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                                  {isManual ? "✔ Marked" : "✔ Present"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(sessionActive || recognizedCount > 0) && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
                        <button
                          onClick={() => setShowReview(true)}
                          style={{ width: "100%", padding: "12px 0", borderRadius: 12, fontSize: 13.5, fontWeight: 700, background: "#f1f5f9", border: `1px solid ${C.borderHov}`, color: C.text, cursor: "pointer", transition: EASE_ALL }}
                        >
                          Review &amp; Mark Manually
                        </button>
                        {recognizedCount > 0 && (
                          <button
                            onClick={submitFinalAttendance}
                            disabled={submitting}
                            style={{ width: "100%", padding: "12px 0", borderRadius: 12, fontSize: 13.5, fontWeight: 700, background: submitting ? "#e2e8f0" : ICON_GRAD, color: submitting ? C.muted : "#fff", border: "none", cursor: submitting ? "not-allowed" : "pointer", boxShadow: submitting ? "none" : SHADOW.active, transition: EASE_ALL }}
                          >
                            {submitting ? "Submitting…" : `Submit Attendance (${recognizedCount} present)`}
                          </button>
                        )}
                        {sessionActive && recognizedCount > 0 && (
                          <p style={{ fontSize: 11.5, textAlign: "center", color: C.body }}>You can submit now or wait until the session ends</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        @media (max-width: 900px) { .session-grid { grid-template-columns: 1fr !important; } .stat-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </>
  );
}

function HistorySession({ date, records, presentCount, rate, courseName }: {
  date: string; records: AttendanceHistoryRecord[];
  presentCount: number; rate: string; courseName: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", background: "#f8fafc", border: "none", padding: "14px 20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ textAlign: "left" }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{new Date(date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
          <p style={{ fontSize: 12, color: C.body, marginTop: 2 }}>{courseName}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: C.body }}><strong style={{ color: "#059669" }}>{presentCount}</strong> / {records.length}</span>
          <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "rgba(15,164,175,0.1)", color: C.accent }}>{rate}%</span>
          <CheckCircle2 size={14} color={open ? C.accent : C.mutedLight} style={{ transition: EASE_ALL }} />
        </div>
      </button>
      {open && (
        <div style={{ padding: "0 20px 16px" }}>
          {records.map((r) => (
            <div key={`${r.studentId}-${r.timestamp}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{r.studentName}</p>
                <p style={{ fontSize: 11, color: C.body }}>{r.studentEmail}</p>
              </div>
              <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700, background: r.status ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", color: r.status ? "#059669" : "#dc2626", border: `1px solid ${r.status ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}` }}>
                {r.status ? "✔ Present" : "✗ Absent"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}