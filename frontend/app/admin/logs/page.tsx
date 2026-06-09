"use client";

import { useState, useEffect, useRef } from "react";
import { Terminal, RefreshCw, AlertCircle, Trash2 } from "lucide-react";

// The allowed services
const SERVICES = [
  "facidance-admin",
  "facidance-auth",
  "facidance-face",
  "facidance-frontend",
  "facidance-student",
  "facidance-teacher",
];

const EASE_ALL = "all 0.25s cubic-bezier(.22,.68,0,1.2)";

export default function AdminLogsPage() {
  const [service, setService] = useState("facidance-frontend");
  const [logType, setLogType] = useState<"out" | "error">("out");
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Fetch logs from our Next.js API
  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`/api/admin/logs?service=${service}&type=${logType}&lines=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to fetch logs");
      }

      setLogs(data.logs || []);
    } catch (err: any) {
      setError(err.message || "Something went wrong fetching logs.");
    } finally {
      setLoading(false);
    }
  };

  // Auto scroll to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Initial fetch and dependency fetch
  useEffect(() => {
    setLogs([]); // Clear old logs immediately to prevent UI color glitches
    fetchLogs();
  }, [service, logType]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchLogs(), 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, service, logType]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, height: "calc(100vh - 120px)" }}>
      {/* Header section */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <Terminal size={26} color="#0FA4AF" /> System Logs
          </h1>
          <p style={{ fontSize: 13.5, color: "#475569", marginTop: 4 }}>
            Monitor real-time application and server logs for debugging.
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* Service Dropdown */}
          <select
            value={service}
            onChange={(e) => setService(e.target.value)}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid rgba(226,232,240,0.8)",
              background: "#fff",
              fontSize: 13,
              fontWeight: 600,
              color: "#334155",
              outline: "none",
              cursor: "pointer",
            }}
          >
            {SERVICES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Type Toggle */}
          <div style={{ display: "flex", background: "#e2e8f0", padding: 3, borderRadius: 10 }}>
            <button
              onClick={() => setLogType("out")}
              style={{
                padding: "6px 14px", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                transition: EASE_ALL,
                background: logType === "out" ? "#fff" : "transparent",
                color: logType === "out" ? "#0FA4AF" : "#64748b",
                boxShadow: logType === "out" ? "0 2px 6px rgba(0,0,0,0.05)" : "none",
              }}
            >
              Info (out)
            </button>
            <button
              onClick={() => setLogType("error")}
              style={{
                padding: "6px 14px", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                transition: EASE_ALL,
                background: logType === "error" ? "#fff" : "transparent",
                color: logType === "error" ? "#ef4444" : "#64748b",
                boxShadow: logType === "error" ? "0 2px 6px rgba(0,0,0,0.05)" : "none",
              }}
            >
              Errors
            </button>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#475569", cursor: "pointer", marginLeft: 8 }}>
            <input 
              type="checkbox" 
              checked={autoRefresh} 
              onChange={(e) => setAutoRefresh(e.target.checked)} 
              style={{ accentColor: "#0FA4AF", width: 16, height: 16 }}
            />
            Auto-refresh
          </label>

          <button
            onClick={fetchLogs}
            disabled={loading && !autoRefresh}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 10,
              background: "#0FA4AF", color: "#fff", border: "none",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              opacity: loading && !autoRefresh ? 0.7 : 1,
            }}
          >
            <RefreshCw size={14} className={loading && !autoRefresh ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13, fontWeight: 500 }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Terminal Window */}
      <div style={{
        flex: 1,
        background: "#0f172a",
        borderRadius: 16,
        border: "1px solid #1e293b",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
      }}>
        {/* Terminal Header */}
        <div style={{ display: "flex", alignItems: "center", padding: "10px 16px", background: "#1e293b", borderBottom: "1px solid #334155" }}>
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ef4444" }} />
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#f59e0b" }} />
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#10b981" }} />
          </div>
          <span style={{ margin: "0 auto", fontSize: 12, fontWeight: 600, color: "#94a3b8", fontFamily: "monospace" }}>
            docker logs {service}-1
          </span>
          <button 
            onClick={() => setLogs([])}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
            title="Clear output"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Terminal Body */}
        <div 
          ref={scrollContainerRef}
          style={{ 
            flex: 1, 
            padding: "16px", 
            overflowY: "auto",
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
            fontSize: 13,
            lineHeight: 1.5,
            color: logType === "error" ? "#fca5a5" : "#e2e8f0",
          }}
        >
          {logs.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#475569" }}>
              {loading ? "Fetching logs..." : "No logs found for this service."}
            </div>
          ) : (
            logs.map((line, i) => {
              // Mask IP addresses (with optional ports)
              const maskedLine = line.replace(/\b(?:\d{1,3}\.){3}\d{1,3}(:\d+)?\b/g, '[USER_IP]');
              return (
                <div key={i} style={{ wordBreak: "break-all", marginBottom: 2 }}>
                  {maskedLine}
                </div>
              );
            })
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
