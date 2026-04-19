"use client";

/**
 * frontend/app/student/layout.tsx
 * Student shell — uses the unified <Navbar role="student" /> component.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getMe } from "@/lib/api_student";
import Navbar from "@/components/Navbar"; // ← adjust path to wherever you placed the unified Navbar
import Image from "next/image";

const PRIMARY     = "#003135";
const MUTED_LIGHT = "#94a3b8";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const [studentName, setStudentName] = useState<string>("Student");
  const [ready,       setReady]       = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    getMe()
      .then((data) => { setStudentName(data.name || "Student"); setReady(true); })
      .catch(() => router.push("/login"));
  }, [router]);

  if (!ready) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg, #f8fafc 0%, #f0f9fa 50%, #e8f6f8 100%)",
        position: "relative",
      }}>
        {/* Ambient orbs */}
        <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <div style={{
            position: "absolute", top: "20%", left: "30%",
            width: 500, height: 500, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(15,164,175,0.06) 0%, transparent 70%)",
          }} />
          <div style={{
            position: "absolute", bottom: "20%", right: "25%",
            width: 400, height: 400, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0,49,53,0.04) 0%, transparent 70%)",
          }} />
        </div>

        {/* Spinner */}
        {/* Logo Loader */}
<div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
  <div style={{
    position: "relative",
    width: 72,
    height: 72,
    margin: "0 auto 18px",
  }}>

    {/* Glow */}
    <div style={{
      position: "absolute",
      inset: 0,
      borderRadius: "50%",
      background: "radial-gradient(circle, rgba(15,164,175,0.25), transparent 70%)",
      filter: "blur(14px)",
    }} />

    {/* Logo */}
    <Image
  src="/logo.png"
  alt="Facidance"
  width={72}
  height={72}
  style={{
    objectFit: "contain",
    animation: "logoSpin 2.2s linear infinite, logoPulse 1.8s ease-in-out infinite",
  }}
/>
  </div>

  <p style={{
    fontSize: 14,
    fontWeight: 600,
    color: PRIMARY,
    letterSpacing: "-0.01em",
  }}>
    Facidance
  </p>

  <p style={{
    fontSize: 12,
    color: MUTED_LIGHT,
    marginTop: 4,
  }}>
    Loading your portal…
  </p>
</div>
        <style>{`
  @keyframes logoSpin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes logoPulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.08); opacity: 0.85; }
  }
`}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #f8fafc 0%, #f0f9fa 40%, #eaf6f8 100%)",
      position: "relative",
    }}>
      {/* Decorative ambient orbs */}
      <div aria-hidden style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
        <div style={{
          position: "absolute", top: "10%", right: "5%",
          width: 600, height: 600, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(15,164,175,0.05) 0%, transparent 65%)",
        }} />
        <div style={{
          position: "absolute", bottom: "15%", left: "2%",
          width: 480, height: 480, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,49,53,0.04) 0%, transparent 65%)",
        }} />
      </div>

      {/* ── Unified Navbar ── */}
      <Navbar role="student" name={studentName} />

      {/* Main content */}
      <main style={{
        position: "relative", zIndex: 1,
        width: "100%", maxWidth: 1600,
        margin: "0 auto",
        padding: "clamp(20px, 3vw, 36px) clamp(16px, 4vw, 40px)",
      }}>
        {children}
      </main>
    </div>
  );
}