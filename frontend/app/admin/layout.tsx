"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import AdminQueryProvider from "./admin-query-provider";

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
        {/* Subtle background orbs */}
        <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <div style={{
            position: "absolute", top: "20%", left: "30%",
            width: 500, height: 500, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(71,85,105,0.06) 0%, transparent 70%)",
          }} />
          <div style={{
            position: "absolute", bottom: "20%", right: "25%",
            width: 400, height: 400, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(30,41,59,0.04) 0%, transparent 70%)",
          }} />
        </div>

        <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
          <div style={{ position: "relative", width: 56, height: 56, margin: "0 auto 16px" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              border: "2px solid rgba(71,85,105,0.12)",
              borderTopColor: "#475569",
              animation: "spin 0.9s linear infinite",
              position: "absolute", inset: 0,
            }} />
            <div style={{
              position: "absolute", inset: 8,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #1e293b 0%, #475569 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 13, fontWeight: 800,
            }}>
              A
            </div>
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", letterSpacing: "-0.01em" }}>
            Facidance Admin
          </p>
          <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
            Loading admin portal…
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #f8fafc 0%, #f1f5f9 40%, #eaeff5 100%)",
      position: "relative",
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

      <Navbar role="admin" name={adminName} />

      <main style={{
        position: "relative",
        zIndex: 1,
        width: "100%",
        maxWidth: 1600,
        margin: "0 auto",
        padding: "clamp(20px, 3vw, 36px) clamp(16px, 4vw, 40px)",
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