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

interface Photos   { front: File | null; left: File | null; right: File | null }
interface Previews { front: string | null; left: string | null; right: string | null }

const POSES: Array<{ key: PoseKey; label: string; instruction: string }> = [
  { key: "front", label: "Front View",    instruction: "Look straight at the camera"          },
  { key: "left",  label: "Left Profile",  instruction: "Turn your head slightly to the left"  },
  { key: "right", label: "Right Profile", instruction: "Turn your head slightly to the right" },
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
        height: 40, width: 40, minWidth: 40, borderRadius: 11,
        background: "rgba(175,221,229,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={16} color={C.accent} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{
          fontSize: 10.5, fontWeight: 700, color: C.muted,
          textTransform: "uppercase", letterSpacing: "0.08em", margin: 0,
        }}>{label}</p>
        <p style={{
          fontSize: 14, fontWeight: 600, color: C.text,
          marginTop: 2, overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{value}</p>
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
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
        padding: "11px 22px", borderRadius: 12, fontSize: 13.5, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer", border: "none",
        background: disabled ? "#e2e8f0" : ICON_GRAD,
        color: disabled ? C.muted : "#fff",
        boxShadow: !disabled && hov ? SHADOW.active : !disabled ? "0 8px 24px rgba(15,164,175,0.3)" : "none",
        transform: !disabled && hov ? "translateY(-2px) scale(1.01)" : "translateY(0) scale(1)",
        transition: EASE_ALL, opacity: disabled ? 0.7 : 1,
        width: "100%",
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

        {/* ── Header ─────────────────────────────────────────────────────── */}
       <div style={{ padding: "4px 0 8px" }} className="profile-header">
  <h1 style={{
    fontSize: "clamp(22px, 6vw, 28px)",
    fontWeight: 800, color: C.text,
    letterSpacing: "-0.03em", lineHeight: 1.1, margin: 0,
  }}>
    My Profile
  </h1>
  <p style={{ fontSize: 14, color: C.body, marginTop: 6 }}>
    Your personal details and face recognition setup.
  </p>
</div>

        {/* ── Profile card ───────────────────────────────────────────────── */}
        <Card>
          <div style={{ padding: "24px 20px" }}>

            {/* Avatar + name + face badge — stacked on mobile */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Top row: avatar + name */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div style={{
                  height: 64, width: 64, minWidth: 64, borderRadius: 18,
                  background: ICON_GRAD,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 12px 32px rgba(15,164,175,0.35)",
                }}>
                  <span style={{ fontSize: 26, fontWeight: 800, color: "#fff" }}>
                    {profile.name?.charAt(0).toUpperCase() ?? "S"}
                  </span>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{
                    fontSize: "clamp(17px, 4.5vw, 22px)",
                    fontWeight: 800, color: C.text,
                    letterSpacing: "-0.02em", lineHeight: 1.2, margin: 0,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {profile.name}
                  </h2>
                  <p style={{
                    fontSize: 13, color: C.body, marginTop: 3,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{profile.email}</p>

                  {/* Badges */}
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: "rgba(15,164,175,0.1)", color: C.accent,
                      border: `1px solid ${C.borderHov}`,
                    }}>
                      Student
                    </span>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: "rgba(248,250,252,0.9)",
                      color: C.body, border: `1px solid ${C.border}`,
                    }}>
                      <Calendar size={10} />
                      Joined {new Date(profile.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short" })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Face status badge — full width on mobile */}
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "9px 16px", borderRadius: 12, fontSize: 12.5, fontWeight: 700,
                width: "100%", boxSizing: "border-box",
                background: hasFace ? "rgba(16,185,129,0.08)" : "rgba(245,158,11,0.08)",
                color: hasFace ? "#059669" : "#d97706",
                border: `1px solid ${hasFace ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.2)"}`,
              }}>
                {hasFace ? <UserCheck size={14} /> : <AlertCircle size={14} />}
                {hasFace ? "Face recognition active" : "Face recognition not set up"}
              </span>
            </div>

            {/* Info grid — single column on mobile */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14, marginTop: 24,
              paddingTop: 20, borderTop: `1px solid ${C.border}`,
            }}>
              <InfoRow Icon={User}     label="Full Name"  value={profile.name} />
              <InfoRow Icon={Mail}     label="Email"      value={profile.email} />
              {profile.student?.program_name    && <InfoRow Icon={Book}     label="Program"    value={profile.student.program_name} />}
              {profile.student?.department_name && <InfoRow Icon={Building} label="Department" value={profile.student.department_name} />}
            </div>
          </div>
        </Card>

        {/* ── Face recognition setup ─────────────────────────────────────── */}
        <Card>
          {/* Section header */}
          <div style={{
            padding: "20px 20px 0",
            display: "flex", alignItems: "center", gap: 14, marginBottom: 20,
          }}>
            <div style={{
              height: 46, width: 46, minWidth: 46, borderRadius: 14, background: ICON_GRAD,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 6px 18px rgba(15,164,175,0.28)",
            }}>
              <Camera size={20} color="#fff" />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: "-0.02em", margin: 0 }}>
                Face Recognition Setup
              </p>
              <p style={{ fontSize: 12, color: C.body, marginTop: 2, margin: 0 }}>
                Upload photos for automatic AI attendance marking
              </p>
            </div>
          </div>

          <div style={{ padding: "0 20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Camera view */}
            {activeCamera && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{
                  position: "relative", width: "100%", aspectRatio: "16/9",
                  borderRadius: 14, overflow: "hidden",
                  background: "#000",
                  boxShadow: "0 0 0 3px rgba(15,164,175,0.3)",
                }}>
                  <video
                    ref={videoRef}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    autoPlay muted playsInline
                  />
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

                {/* Camera action buttons */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button
                    onClick={capturePhoto}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                      padding: "12px 22px", borderRadius: 12, fontSize: 14, fontWeight: 600,
                      cursor: "pointer", border: "none",
                      background: ICON_GRAD, color: "#fff",
                      boxShadow: "0 8px 24px rgba(15,164,175,0.3)",
                      width: "100%",
                    }}
                  >
                    <Camera size={15} /> Capture Photo
                  </button>
                  <button
                    onClick={stopCamera}
                    style={{
                      width: "100%", padding: "12px 22px", borderRadius: 12,
                      fontSize: 14, fontWeight: 600,
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

            {/* Pose cards — single column on mobile, 3 col on larger */}
            <div className="pose-grid" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {POSES.map(({ key, label, instruction }) => (
                <div key={key} style={{
                  borderRadius: 16, border: `1px solid ${previews[key] ? C.borderHov : C.border}`,
                  padding: "16px",
                  background: previews[key] ? "rgba(15,164,175,0.04)" : "#f8fafc",
                  boxShadow: previews[key] ? `0 0 0 3px rgba(15,164,175,0.1), ${SHADOW.rest}` : SHADOW.rest,
                  transition: EASE_ALL,
                }}>
                  {/* Pose label */}
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: C.text, margin: 0 }}>{label}</p>
                    <p style={{ fontSize: 12, color: C.body, marginTop: 3, margin: 0 }}>{instruction}</p>
                  </div>

                  {previews[key] ? (
                    /* Preview layout: image left, status right */
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                      <div style={{
                        position: "relative",
                        width: 80, minWidth: 80, height: 106,
                        borderRadius: 10, overflow: "hidden",
                        background: "#f1f5f9",
                      }}>
                        <Image
                          src={previews[key]!}
                          alt={label}
                          fill
                          style={{ objectFit: "cover" }}
                        />
                      </div>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "5px 10px", borderRadius: 20,
                          background: "rgba(16,185,129,0.08)", color: "#059669",
                          border: "1px solid rgba(16,185,129,0.2)",
                          fontSize: 12, fontWeight: 700,
                        }}>
                          <CheckCircle2 size={12} /> Photo ready
                        </div>
                        <button
                          onClick={() => removePhoto(key)}
                          style={{
                            padding: "7px 14px", borderRadius: 8,
                            background: "rgba(220,38,38,0.07)", color: "#dc2626",
                            border: "1px solid rgba(220,38,38,0.15)",
                            cursor: "pointer", fontSize: 12, fontWeight: 600,
                            display: "inline-flex", alignItems: "center", gap: 5,
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Upload / camera buttons — side by side on mobile */
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => startCamera(key)}
                        disabled={activeCamera !== null}
                        style={{
                          flex: 1,
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                          padding: "10px 8px", borderRadius: 10, fontSize: 12.5, fontWeight: 600,
                          cursor: activeCamera ? "not-allowed" : "pointer",
                          background: activeCamera ? "#e2e8f0" : "rgba(15,164,175,0.1)",
                          color: activeCamera ? C.muted : C.primary,
                          border: `1px solid ${activeCamera ? C.border : C.borderHov}`,
                          transition: EASE_ALL,
                        }}
                      >
                        <Camera size={13} /> Camera
                      </button>
                      <label style={{
                        flex: 1,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        padding: "10px 8px", borderRadius: 10, fontSize: 12.5, fontWeight: 600,
                        cursor: "pointer",
                        background: C.white, color: C.textSoft,
                        border: `1px solid ${C.border}`,
                        transition: EASE_ALL,
                      }}>
                        <Upload size={13} /> Upload
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
                {uploadStatus === "uploading" && (
                  <div style={{
                    width: 14, height: 14, flexShrink: 0, borderRadius: "50%",
                    border: "2px solid rgba(15,164,175,0.3)", borderTopColor: C.accent,
                    animation: "spin 0.9s linear infinite",
                  }} />
                )}
                <span>{message}</span>
              </div>
            )}

            {/* Submit section */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: 12, color: C.body, margin: 0, textAlign: "center" }}>
                Photos are stored securely and used only for AI attendance verification.
              </p>
              <PrimaryBtn onClick={handleSubmit} disabled={uploadStatus === "uploading" || !hasAnyPhoto}>
                {uploadStatus === "uploading" ? (
                  <>
                    <div style={{
                      width: 14, height: 14, borderRadius: "50%",
                      border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff",
                      animation: "spin 0.9s linear infinite",
                    }} />
                    Processing…
                  </>
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

        @media (min-width: 640px) {
          .pose-grid {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
          @media (max-width: 639px) {
  .profile-header { text-align: center; }
}
      `}</style>
    </>
  );
}