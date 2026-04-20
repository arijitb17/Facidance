"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import AdminQueryProvider from "./admin-query-provider";
import Image from "next/image";
function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [adminName, setAdminName] = useState("Admin");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    try {
      const decoded = JSON.parse(atob(token.split(".")[1]));
      if (decoded.role !== "ADMIN") { router.push("/login"); return; }
      if (decoded.name) setAdminName(decoded.name);
    } catch {
      router.push("/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div style={{
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e8eef4 100%)",
}}>
  <div style={{ textAlign: "center" }}>

    {/* LOGO ANIMATION */}
    <div style={{
      width: 72,
      height: 72,
      margin: "0 auto 18px",
      position: "relative",
    }}>
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

    {/* TEXT */}
    <p style={{
      fontSize: 14,
      fontWeight: 600,
      color: "#1e293b",
      letterSpacing: "-0.01em",
    }}>
      Facidance Admin
    </p>

    <p style={{
      fontSize: 12,
      color: "#94a3b8",
      marginTop: 4,
    }}>
      Initializing secure session…
    </p>
  </div>

  {/* ANIMATIONS */}
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
  width: "100vw",          // ← force full viewport width
  maxWidth: "100%",        // ← prevent overflow scrollbar
  background: "linear-gradient(160deg, #f8fafc 0%, #f1f5f9 40%, #eaeff5 100%)",
  display: "flex",
  flexDirection: "column",
  boxSizing: "border-box",
}}>
      {/* Decorative ambient orbs */}
      <div aria-hidden style={{
        position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0,
      }}>
        <div style={{
          position: "absolute", top: "10%", right: "5%",
          width: 600, height: 600, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(71,85,105,0.04) 0%, transparent 65%)",
        }} />
        <div style={{
          position: "absolute", bottom: "15%", left: "2%",
          width: 480, height: 480, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(30,41,59,0.03) 0%, transparent 65%)",
        }} />
      </div>

  <Navbar role="admin" name={adminName} />  {/* ← outside main, no padding applied */}

  <main style={{
    flex: 1,
    position: "relative",
    zIndex: 1,
    padding: "clamp(16px, 3vw, 36px) clamp(10px, 4vw, 40px)",
  }}>
    {children}
  </main>
</div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminQueryProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminQueryProvider>
  );
}