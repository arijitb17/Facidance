"use client";

/**
 * frontend/app/student/profile/page.tsx
 * Student Profile — redesigned to SaaS level matching teacher design system
 */

import React, { useState, useRef, useEffect } from "react";
import {
  Camera, Upload, CheckCircle2, AlertCircle,
  User, Mail, Book, Calendar, Building,
  UserCheck,
} from "lucide-react";
import { useStudentMe, useCheckPhotos, useUploadPhotos } from "@/hooks/useStudent";
import Image from "next/image";
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

type PoseKey = "front" | "left" | "right";

interface Photos  { front: File | null; left: File | null; right: File | null }
interface Previews { front: string | null; left: string | null; right: string | null }

const POSES: Array<{ key: PoseKey; label: string; instruction: string; emoji: string }> = [
  { key: "front", label: "Front View",    instruction: "Look straight at the camera",           emoji: "😊" },
  { key: "left",  label: "Left Profile",  instruction: "Turn your head slightly to the left",   emoji: "😄" },
  { key: "right", label: "Right Profile", instruction: "Turn your head slightly to the right",  emoji: "😃" },
];

// ─── Components ───────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: CARD_GRAD, border: `1px solid ${C.border}`,
      borderRadius: 20, overflow: "hidden", boxShadow: SHADOW.rest,
      ...style,
    }}>
      {children}
    </div>
  );
}

function InfoRow({ Icon, label, value }: { Icon: React.ElementType; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{
        height: 40, width: 40, borderRadius: 11, background: "rgba(175,221,229,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <Icon size={16} color={C.accent} />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
        <p style={{ fontSize: 14, fontWeight: 600, color: C.text, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</p>
      </div>
    </div>
  );
}

function PrimaryBtn({ children, onClick, disabled }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "11px 22px", borderRadius: 12, fontSize: 13.5, fontWeight: 600,
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

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function StudentProfilePage() {
  const { data: profile, loading, error: profileError } = useStudentMe();
  const studentId = profile?.student?.id ?? null;
  const { data: photosCheck } = useCheckPhotos(studentId);
  const { upload, reset: resetUpload, status: uploadStatus, message } = useUploadPhotos();

  const [photos,   setPhotos]   = useState<Photos>({   front: null, left: null, right: null });
  const [previews, setPreviews] = useState<Previews>({ front: null, left: null, right: null });
  const [activeCamera, setActiveCamera] = useState<PoseKey | null>(null);

  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => stopCamera(), []);

  async function startCamera(pose: PoseKey) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      });
      streamRef.current = stream;
      setActiveCamera(pose);
      await new Promise((r) => setTimeout(r, 100));
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
    } catch { setActiveCamera(null); }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActiveCamera(null);
  }

  function capturePhoto() {
    if (!videoRef.current || !activeCamera) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob || !activeCamera) return;
        handlePhotoSelect(activeCamera, new File([blob], `${activeCamera}.jpg`, { type: "image/jpeg" }));
        stopCamera();
      },
      "image/jpeg", 0.95
    );
  }

  function handlePhotoSelect(pose: PoseKey, file: File) {
    setPhotos((p) => ({ ...p, [pose]: file }));
    const reader = new FileReader();
    reader.onloadend = () => setPreviews((p) => ({ ...p, [pose]: reader.result as string }));
    reader.readAsDataURL(file);
  }

  function removePhoto(pose: PoseKey) {
    setPhotos((p) => ({ ...p, [pose]: null }));
    setPreviews((p) => ({ ...p, [pose]: null }));
  }

  async function handleSubmit() {
    if (!profile?.student) return;
    const has = Object.values(photos).some(Boolean);
    if (!has) return;
    try {
      await upload(profile.student.id, {
        front: photos.front ?? undefined,
        left:  photos.left  ?? undefined,
        right: photos.right ?? undefined,
      });
      setTimeout(() => {
        setPhotos({ front: null, left: null, right: null });
        setPreviews({ front: null, left: null, right: null });
        resetUpload();
      }, 3000);
    } catch { /* shown via message */ }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%", margin: "0 auto 14px",
            border: "2px solid rgba(15,164,175,0.15)", borderTopColor: C.accent,
            animation: "spin 0.9s linear infinite",
          }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: C.body }}>Loading your profile…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 18px", borderRadius: 12,
          background: "#fef2f2", border: "1px solid #fecaca",
          color: "#dc2626", fontSize: 13, fontWeight: 500,
        }}>
          <AlertCircle size={15} /> {profileError ?? "Failed to load profile."}
        </div>
      </div>
    );
  }

  const hasFace = photosCheck?.has_photos || profile.student?.face_embedding === true;
  const hasAnyPhoto = Object.values(photos).some(Boolean);

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

        {/* Header */}
        <div style={{ padding: "4px 0 8px" }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            My Profile
          </h1>
          <p style={{ fontSize: 14, color: C.body, marginTop: 6 }}>
            Your personal details and face recognition setup.
          </p>
        </div>

        {/* Profile card */}
        <Card>
          <div style={{ padding: "28px 32px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>

              {/* Avatar + name */}
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <div style={{
                  height: 72, width: 72, borderRadius: 20,
                  background: ICON_GRAD,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 12px 32px rgba(15,164,175,0.35)",
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>
                    {profile.name?.charAt(0).toUpperCase() ?? "S"}
                  </span>
                </div>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                    {profile.name}
                  </h2>
                  <p style={{ fontSize: 13, color: C.body, marginTop: 4 }}>{profile.email}</p>
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "4px 12px", borderRadius: 20, fontSize: 11.5, fontWeight: 700,
                      background: "rgba(15,164,175,0.1)", color: C.accent,
                      border: `1px solid ${C.borderHov}`,
                    }}>
                      Student
                    </span>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "4px 12px", borderRadius: 20, fontSize: 11.5, fontWeight: 700,
                      background: new Date(profile.created_at) ? "rgba(248,250,252,0.9)" : "transparent",
                      color: C.body, border: `1px solid ${C.border}`,
                    }}>
                      <Calendar size={11} />
                      Joined {new Date(profile.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short" })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Face status badge */}
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10,
              }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", borderRadius: 12, fontSize: 12.5, fontWeight: 700,
                  background: hasFace ? "rgba(16,185,129,0.08)" : "rgba(245,158,11,0.08)",
                  color: hasFace ? "#059669" : "#d97706",
                  border: `1px solid ${hasFace ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.2)"}`,
                }}>
                  {hasFace ? <UserCheck size={14} /> : <AlertCircle size={14} />}
                  {hasFace ? "Face recognition active" : "Face recognition not set up"}
                </span>
              </div>
            </div>

            {/* Info grid */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginTop: 28,
              paddingTop: 24, borderTop: `1px solid ${C.border}`,
            }} className="info-grid">
              <InfoRow Icon={User}     label="Full Name"  value={profile.name} />
              <InfoRow Icon={Mail}     label="Email"      value={profile.email} />
              {profile.student?.program_name    && <InfoRow Icon={Book}     label="Program"    value={profile.student.program_name} />}
              {profile.student?.department_name && <InfoRow Icon={Building} label="Department" value={profile.student.department_name} />}
            </div>
          </div>
        </Card>

        {/* Face recognition setup */}
        <Card>
          <div style={{ padding: "22px 28px 0", display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <div style={{
              height: 48, width: 48, borderRadius: 14, background: ICON_GRAD,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 6px 18px rgba(15,164,175,0.28)",
            }}>
              <Camera size={20} color="#fff" />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: "-0.02em" }}>
                Face Recognition Setup
              </p>
              <p style={{ fontSize: 12, color: C.body, marginTop: 2 }}>
                Upload photos for automatic AI attendance marking
              </p>
            </div>
          </div>

          <div style={{ padding: "0 28px 28px", display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Camera view */}
            {activeCamera && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{
                  position: "relative", width: "100%", aspectRatio: "16/9",
                  borderRadius: 14, overflow: "hidden",
                  background: "#000",
                  boxShadow: "0 0 0 3px rgba(15,164,175,0.3)",
                }}>
                  <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} autoPlay muted playsInline />
                  <div style={{
                    position: "absolute", top: 12, left: 12,
                    display: "flex", alignItems: "center", gap: 6,
                    background: "rgba(15,164,175,0.9)", color: "#fff",
                    padding: "5px 12px", borderRadius: 20, fontSize: 11.5, fontWeight: 700,
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />
                    Camera Live
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <PrimaryBtn onClick={capturePhoto}>
                    <Camera size={15} /> Capture Photo
                  </PrimaryBtn>
                  <button
                    onClick={stopCamera}
                    style={{
                      flex: 1, padding: "11px 22px", borderRadius: 12, fontSize: 13.5, fontWeight: 600,
                      cursor: "pointer", background: C.white,
                      color: C.textSoft, border: `1px solid ${C.border}`,
                      boxShadow: SHADOW.rest,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Pose cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }} className="pose-grid">
              {POSES.map(({ key, label, instruction }) => (
                <div key={key} style={{
                  borderRadius: 16, border: `1px solid ${previews[key] ? C.borderHov : C.border}`,
                  padding: "16px",
                  background: previews[key] ? "rgba(15,164,175,0.04)" : "#f8fafc",
                  boxShadow: previews[key] ? `0 0 0 3px rgba(15,164,175,0.1), ${SHADOW.rest}` : SHADOW.rest,
                  transition: EASE_ALL,
                  display: "flex", flexDirection: "column", gap: 12,
                }}>
                  <div>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{label}</p>
                    <p style={{ fontSize: 11.5, color: C.body, marginTop: 3 }}>{instruction}</p>
                  </div>

                  {previews[key] ? (
                    <div style={{ position: "relative" }}>
                      <div style={{ width: "100%", aspectRatio: "3/4", borderRadius: 10, overflow: "hidden", background: "#f1f5f9" }}>
                        <Image
  src={previews[key]!}
  alt={label}
  fill
  style={{ objectFit: "cover" }}
/>
                      </div>
                      <button
                        onClick={() => removePhoto(key)}
                        style={{
                          position: "absolute", top: 8, right: 8,
                          width: 24, height: 24, borderRadius: "50%",
                          background: "rgba(0,0,0,0.7)", color: "#fff",
                          border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        ×
                      </button>
                      <div style={{
                        marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "4px 10px", borderRadius: 20,
                        background: "rgba(16,185,129,0.08)", color: "#059669",
                        border: "1px solid rgba(16,185,129,0.2)",
                        fontSize: 11.5, fontWeight: 700,
                      }}>
                        <CheckCircle2 size={12} /> Photo ready
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <button
                        onClick={() => startCamera(key)}
                        disabled={activeCamera !== null}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                          padding: "9px 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 600,
                          cursor: activeCamera ? "not-allowed" : "pointer",
                          background: activeCamera ? "#e2e8f0" : "rgba(15,164,175,0.1)",
                          color: activeCamera ? C.muted : C.primary,
                          border: `1px solid ${activeCamera ? C.border : C.borderHov}`,
                          transition: EASE_ALL,
                        }}
                      >
                        <Camera size={14} /> Use Camera
                      </button>
                      <label style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                        padding: "9px 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 600,
                        cursor: "pointer",
                        background: C.white, color: C.textSoft,
                        border: `1px solid ${C.border}`,
                        transition: EASE_ALL,
                      }}>
                        <Upload size={14} /> Upload Image
                        <input
                          type="file" accept="image/*"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoSelect(key, f); }}
                          style={{ display: "none" }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Status message */}
            {message && uploadStatus !== "idle" && (
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "12px 16px", borderRadius: 12, fontSize: 13,
                background: uploadStatus === "success" ? "rgba(16,185,129,0.08)"
                  : uploadStatus === "error" ? "#fef2f2" : "rgba(15,164,175,0.06)",
                color: uploadStatus === "success" ? "#059669"
                  : uploadStatus === "error" ? "#dc2626" : C.primary,
                border: `1px solid ${uploadStatus === "success" ? "rgba(16,185,129,0.2)"
                  : uploadStatus === "error" ? "#fecaca" : C.borderHov}`,
              }}>
                {uploadStatus === "success" && <CheckCircle2 size={16} />}
                {uploadStatus === "error"   && <AlertCircle size={16} />}
                {uploadStatus === "uploading" && <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(15,164,175,0.3)", borderTopColor: C.accent, animation: "spin 0.9s linear infinite" }} />}
                <span>{message}</span>
              </div>
            )}

            {/* Submit button */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <p style={{ fontSize: 12, color: C.body }}>
                Photos are stored securely and used only for AI attendance verification.
              </p>
              <PrimaryBtn onClick={handleSubmit} disabled={uploadStatus === "uploading" || !hasAnyPhoto}>
                {uploadStatus === "uploading" ? (
                  <><div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.9s linear infinite" }} /> Processing…</>
                ) : (
                  <><Upload size={15} /> Submit Photos</>
                )}
              </PrimaryBtn>
            </div>
          </div>
        </Card>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          .info-grid  { grid-template-columns: 1fr !important; }
          .pose-grid  { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 600px) {
          .pose-grid  { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}