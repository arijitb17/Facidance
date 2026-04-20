"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Camera, Users, Brain, History, CheckCircle2,
  Play, Pause, Square, Clock, ArrowLeft,
  Zap, BarChart3,
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
  const initialLoadRef = useRef(false);

  const [courseId, setCourseId] = useState("");
  const [courseName, setCourseName] = useState("");
  const [students, setStudents] = useState<Student[]>([]);

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
  }

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
    const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: false });
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
    const frames: File[] = [];
    try {
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 300));
        ctx.drawImage(video, 0, 0);
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
    const normalized: RecognitionStudent[] = rawRec.map((item) => {
      if (!item) return { id: "unknown", name: "unknown", email: "" };
      if (typeof item === "string") {
        const found = students.find((s) => s.id === item || s.name.toLowerCase() === item.toLowerCase());
        return found ? { id: found.id, name: found.name, email: found.email } : { id: item, name: item, email: "" };
      }
      const obj = item as Record<string, unknown>;
      for (const cand of [obj.id, obj.studentId, obj.name].filter(Boolean)) {
        const found = students.find((s) => s.id === String(cand) || s.name.toLowerCase() === String(cand).toLowerCase());
        if (found) return { id: found.id, name: found.name, email: found.email };
      }
      return { id: String(obj.id ?? ""), name: String(obj.name ?? obj.id ?? ""), email: String(obj.email ?? "") };
    });
    return { totalFaces: Number(result.totalFaces ?? normalized.length), recognizedStudents: normalized, averageConfidence: typeof result.averageConfidence === "number" ? result.averageConfidence : 0, detections: [] };
  }

  async function startSession() {
    if (students.filter((s) => s.hasFaceData).length === 0) { toast.error("No trained students", "Please train the model first"); return; }
    try {
      await startCamera();
      setSessionActive(true); setSessionPaused(false);
      setSessionStartTime(Date.now()); setTimeRemaining(SESSION_DURATION);
      setSessionRecognitions([]); setAllRecognizedStudents(new Set()); setCurrentRecognition(null);
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
    if (allRecognizedStudents.size > 0) toast.success("Session ended", `${allRecognizedStudents.size} student${allRecognizedStudents.size > 1 ? "s" : ""} recognized. Submit to save.`, 7000);
    else toast.warning("Session ended", "No students were recognized.");
  }

  async function submitAttendance() {
    if (allRecognizedStudents.size === 0 || !courseId) { toast.error("Cannot submit", "No students recognized"); return; }
    setSubmitting(true);
    try {
      const finalRec: RecognitionStudent[] = Array.from(allRecognizedStudents)
        .map((sid) => { const s = students.find((st) => st.id === sid); return s ? { id: s.id, name: s.name, email: s.email } : null; })
        .filter((s): s is RecognitionStudent => s !== null);
      const result = await teacherAttendanceApi.submitAttendance(courseId, { recognizedStudents: finalRec }, new Date().toISOString());
      toast.success("Submitted!", `Present: ${result.statistics.present}, Absent: ${result.statistics.absent}, Rate: ${result.statistics.attendanceRate}%`, 7000);
      await fetchAttendanceHistory(courseId);
      setSessionRecognitions([]); setAllRecognizedStudents(new Set()); setCurrentRecognition(null);
    } catch { toast.error("Submission failed", ""); }
    finally { setSubmitting(false); }
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
  const recognizedCount = allRecognizedStudents.size;
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
          <div>
            <button
              onClick={goBack}
              disabled={sessionActive && !sessionPaused}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 10,
                fontSize: 13, fontWeight: 600, color: C.body, background: "none", border: "none",
                cursor: sessionActive && !sessionPaused ? "not-allowed" : "pointer", padding: 0,
                opacity: sessionActive && !sessionPaused ? 0.5 : 1,
              }}
            >
              <ArrowLeft size={14} /> Back to Attendance Setup
            </button>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
              AI Attendance Session
            </h1>
            <p style={{ fontSize: 14, color: C.body, marginTop: 6 }}>
              {courseName || "Automated 45-minute face recognition attendance"}
            </p>
          </div>
          {!sessionActive && (
            <ActionBtn variant="ghost" onClick={() => setShowHistory(!showHistory)}>
              <History size={14} />
              {showHistory ? "Hide History" : "View History"}
            </ActionBtn>
          )}
        </div>

        {/* Active session timer bar */}
        {sessionActive && (
          <div style={{
            background: CARD_GRAD,
            border: `2px solid ${C.borderHov}`,
            borderRadius: 20, overflow: "hidden",
            boxShadow: `0 0 0 4px rgba(15,164,175,0.08), ${SHADOW.hover}`,
          }}>
            {/* Progress bar */}
            <div style={{ height: 4, background: "rgba(175,221,229,0.3)" }}>
              <div style={{
                height: "100%", width: `${timeProgress}%`,
                background: ICON_GRAD, borderRadius: 4,
                transition: "width 1s linear",
              }} />
            </div>
            <div style={{ padding: "20px 26px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{
                    height: 52, width: 52, borderRadius: 15, background: ICON_GRAD,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 8px 24px rgba(15,164,175,0.3)",
                  }}>
                    <Clock size={24} color="#fff" />
                  </div>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Time Remaining</p>
                    <p style={{ fontSize: 36, fontWeight: 900, color: C.accent, letterSpacing: "-0.04em", lineHeight: 1, marginTop: 2 }}>
                      {formatTime(timeRemaining)}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <MiniStat label="Present"  value={recognizedCount}            color={C.accent} />
                  <MiniStat label="Rate"     value={`${attendanceRate}%`}       color={C.primary} />
                  <MiniStat label="Scans"    value={sessionRecognitions.length} color={C.body} />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
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
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(3, 1fr)" }} className="stat-grid">
            {[
              { label: "Total Students",   value: students.length,  color: C.text },
              { label: "Trained Students", value: trainedCount,     color: C.accent },
              { label: "Not Trained",      value: untrainedCount,   color: untrainedCount > 0 ? "#dc2626" : C.text },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                background: CARD_GRAD, border: `1px solid ${C.border}`,
                borderRadius: 18, padding: "22px 24px", boxShadow: SHADOW.rest,
              }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</p>
                <p style={{ fontSize: 34, fontWeight: 800, color, letterSpacing: "-0.03em", lineHeight: 1, marginTop: 10 }}>{value}</p>
              </div>
            ))}
          </div>
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
                    return (
                      <HistorySession key={date} date={date} records={records} presentCount={presentCount} rate={rate} courseName={courseName} />
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Main session area */}
        {!showHistory && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 20 }} className="session-grid">

            {/* Camera */}
            <Card>
              <CardHead title="Live Camera Feed" sub="Face recognition capture" />
              <div style={{ padding: "16px 26px 26px" }}>
                <div style={{
  position: "relative", borderRadius: 14, overflow: "hidden",
  background: "#0a0a0a", aspectRatio: "16/9",
  boxShadow: cameraActive ? "0 0 0 3px rgba(15,164,175,0.3)" : "none",
  transition: EASE_ALL,
}}>
  <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
  <canvas ref={canvasRef} style={{ display: "none" }} />

  {/* Pre-session overlay */}
  {!cameraActive && !sessionActive && (
    <div style={{
      position: "absolute", inset: 0,
      background: "rgba(0,0,0,0.82)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 16, padding: 24,
    }}>
      <div style={{
        height: 56, width: 56, borderRadius: 16,
        background: "rgba(255,255,255,0.1)",
        border: "1px solid rgba(255,255,255,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Camera size={24} color="#fff" />
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>
          Ready to capture attendance
        </p>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 6, lineHeight: 1.6, maxWidth: 280 }}>
          45-minute session · auto-capture every 2 min · cumulative recognition
        </p>
      </div>
      <button
        onClick={startSession}
        disabled={trainedCount === 0}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "12px 24px", borderRadius: 12, fontSize: 14, fontWeight: 700,
          background: trainedCount === 0 ? "rgba(255,255,255,0.1)" : ICON_GRAD,
          color: "#fff", border: "none", cursor: trainedCount === 0 ? "not-allowed" : "pointer",
          boxShadow: trainedCount > 0 ? "0 8px 24px rgba(15,164,175,0.4)" : "none",
          opacity: trainedCount === 0 ? 0.5 : 1,
        }}
      >
        <Play size={17} /> Start 45-Min Session
      </button>
      {trainedCount === 0 && (
        <p style={{ fontSize: 11.5, color: "rgba(255,100,100,0.9)" }}>⚠️ No trained students. Train the model first.</p>
      )}
    </div>
  )}
                  {/* Live indicator */}
                  {sessionActive && !capturing && (
                    <div style={{
                      position: "absolute", top: 12, right: 12,
                      display: "flex", alignItems: "center", gap: 6,
                      background: "rgba(16,185,129,0.9)", color: "#fff",
                      padding: "5px 12px", borderRadius: 20, fontSize: 11.5, fontWeight: 700,
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />
                      Live
                    </div>
                  )}
                  {capturing && (
                    <div style={{
                      position: "absolute", top: 12, right: 12,
                      display: "flex", alignItems: "center", gap: 6,
                      background: "rgba(15,164,175,0.9)", color: "#fff",
                      padding: "5px 12px", borderRadius: 20, fontSize: 11.5, fontWeight: 700,
                      animation: "pulse 1s ease-in-out infinite",
                    }}>
                      <Zap size={11} />
                      Capturing…
                    </div>
                  )}
                </div>

                {/* How-it-works */}
                {!sessionActive && (
                  <div style={{
                    marginTop: 16, padding: "14px 16px", borderRadius: 12,
                    background: "rgba(15,164,175,0.05)", border: `1px solid ${C.borderHov}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                      <Brain size={13} color={C.accent} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.primary }}>How cumulative attendance works</span>
                    </div>
                    <ol style={{ paddingLeft: 16, margin: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                      {[
                        "Click 'Start' — camera activates automatically",
                        "First face capture runs immediately",
                        "Auto-captures every 2 minutes thereafter",
                        "Once recognized, students stay marked present",
                        "Submit at end to save the session record",
                      ].map((step, i) => (
                        <li key={i} style={{ fontSize: 12, color: C.body, lineHeight: 1.5 }}>{step}</li>
                      ))}
                    </ol>
                    <p style={{ marginTop: 10, fontSize: 11.5, fontWeight: 700, color: C.accent }}>
                      ✨ Students only need to be detected once — no need to stay in frame!
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Recognition results */}
            <Card accent={recognizedCount > 0}>
              <CardHead
                title="Session Attendance"
                sub="Cumulative recognized students"
                right={recognizedCount > 0 ? (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "rgba(15,164,175,0.1)", color: C.accent }}>
                    {recognizedCount} present
                  </span>
                ) : undefined}
              />
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

                    {/* Student list */}
                    {recognizedCount > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: C.body, marginBottom: 8 }}>
                          Recognized students · {currentRecognition ? `Last scan: ${currentRecognition.totalFaces} faces` : ""}
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto", paddingRight: 4 }}>
                          {Array.from(allRecognizedStudents).map((sid) => {
                            const s = students.find((st) => st.id === sid);
                            if (!s) return null;
                            return (
                              <div key={sid} style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "10px 14px", borderRadius: 11,
                                background: "rgba(15,164,175,0.06)", border: `1px solid ${C.borderHov}`,
                              }}>
                                <div>
                                  <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{s.name}</p>
                                  <p style={{ fontSize: 11, color: C.body, marginTop: 2 }}>{s.email}</p>
                                </div>
                                <span style={{
                                  padding: "3px 10px", borderRadius: 20,
                                  background: ICON_GRAD, color: "#fff",
                                  fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
                                }}>
                                  ✔ Present
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {recognizedCount > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <button
                          onClick={submitAttendance}
                          disabled={submitting}
                          style={{
                            width: "100%", padding: "12px 0",
                            borderRadius: 12, fontSize: 13.5, fontWeight: 700,
                            background: submitting ? "#e2e8f0" : ICON_GRAD,
                            color: submitting ? C.muted : "#fff", border: "none",
                            cursor: submitting ? "not-allowed" : "pointer",
                            boxShadow: submitting ? "none" : SHADOW.active,
                            transition: EASE_ALL,
                          }}
                        >
                          {submitting ? "Submitting…" : `Submit Attendance (${recognizedCount} present)`}
                        </button>
                        {sessionActive && (
                          <p style={{ fontSize: 11.5, textAlign: "center", color: C.body }}>
                            💡 You can submit now or wait until the session ends
                          </p>
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
        @media (max-width: 900px)  { .session-grid { grid-template-columns: 1fr !important; } .stat-grid { grid-template-columns: 1fr !important; } }
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
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", background: "#f8fafc", border: "none",
          padding: "14px 20px", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}
      >
        <div style={{ textAlign: "left" }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
            {new Date(date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
          <p style={{ fontSize: 12, color: C.body, marginTop: 2 }}>{courseName}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: C.body }}>
            <strong style={{ color: "#059669" }}>{presentCount}</strong> / {records.length}
          </span>
          <span style={{
            padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: "rgba(15,164,175,0.1)", color: C.accent,
          }}>{rate}%</span>
          <CheckCircle2 size={14} color={open ? C.accent : C.mutedLight} style={{ transition: EASE_ALL }} />
        </div>
      </button>
      {open && (
        <div style={{ padding: "0 20px 16px" }}>
          {records.map((r) => (
            <div key={`${r.studentId}-${r.timestamp}`} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 0", borderBottom: `1px solid ${C.border}`,
            }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{r.studentName}</p>
                <p style={{ fontSize: 11, color: C.body }}>{r.studentEmail}</p>
              </div>
              <span style={{
                padding: "3px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700,
                background: r.status ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                color: r.status ? "#059669" : "#dc2626",
                border: `1px solid ${r.status ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
              }}>
                {r.status ? "✔ Present" : "✗ Absent"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}