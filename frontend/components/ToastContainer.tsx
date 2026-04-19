import { useEffect, useState } from "react";
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

export function ToastItem({ toast, onClose }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);

    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onClose(toast.id), 200);
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast, onClose]);

  const icons = {
    success: <CheckCircle2 size={18} />,
    error: <AlertCircle size={18} />,
    info: <Info size={18} />,
    warning: <AlertTriangle size={18} />,
  };

  const colors = {
    success: {
      bg: "rgba(16,185,129,0.08)",
      border: "rgba(16,185,129,0.25)",
      icon: "#10b981",
      glow: "rgba(16,185,129,0.25)",
    },
    error: {
      bg: "rgba(244,63,94,0.08)",
      border: "rgba(244,63,94,0.25)",
      icon: "#f43f5e",
      glow: "rgba(244,63,94,0.25)",
    },
    info: {
      bg: "rgba(59,130,246,0.08)",
      border: "rgba(59,130,246,0.25)",
      icon: "#3b82f6",
      glow: "rgba(59,130,246,0.25)",
    },
    warning: {
      bg: "rgba(245,158,11,0.08)",
      border: "rgba(245,158,11,0.25)",
      icon: "#f59e0b",
      glow: "rgba(245,158,11,0.25)",
    },
  };

  const c = colors[toast.type];

  return (
    <div
      style={{
        minWidth: 320,
        maxWidth: 380,
        marginBottom: 12,
        borderRadius: 16,
        padding: "14px 16px",
        backdropFilter: "blur(16px)",
        background: `linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)`,
        border: `1px solid rgba(0,0,0,0.06)`,
        boxShadow: `
          0 16px 40px rgba(0,49,53,0.16),
          0 0 0 1px ${c.bg},
          inset 0 1px 0 rgba(255,255,255,0.7)
        `,
        display: "flex",
        gap: 12,
        alignItems: "flex-start",

        transform: visible
          ? "translateY(0) scale(1)"
          : "translateY(-10px) scale(0.96)",
        opacity: visible ? 1 : 0,

        transition: "all 0.25s cubic-bezier(.22,.68,0,1.2)",
      }}
    >
      {/* ICON */}
      <div
        style={{
          height: 36,
          width: 36,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: c.bg,
          color: c.icon,
          boxShadow: `0 6px 18px ${c.glow}`,
          flexShrink: 0,
        }}
      >
        {icons[toast.type]}
      </div>

      {/* TEXT */}
      <div style={{ flex: 1 }}>
        <p
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#0f172a",
            letterSpacing: "-0.01em",
          }}
        >
          {toast.title}
        </p>
        {toast.description && (
          <p
            style={{
              fontSize: 12,
              marginTop: 4,
              color: "#475569",
              lineHeight: 1.5,
            }}
          >
            {toast.description}
          </p>
        )}
      </div>

      {/* CLOSE */}
      <button
        onClick={() => onClose(toast.id)}
        style={{
          opacity: 0.5,
          background: "transparent",
          border: "none",
          color: "#64748b",
          cursor: "pointer",
          padding: 4,
          borderRadius: 6,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "1";
          e.currentTarget.style.background = "rgba(0,0,0,0.05)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "0.5";
          e.currentTarget.style.background = "transparent";
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastContainer({
  toasts,
  onClose,
  offsetTop = 80, // 👈 default for pages WITH navbar
}: {
  toasts: Toast[];
  onClose: (id: string) => void;
  offsetTop?: number;
}) {
  return (
    <div
      style={{
        position: "fixed",
        top: offsetTop, // 👈 dynamic position
        right: 24,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      <div style={{ pointerEvents: "auto" }}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={onClose} />
        ))}
      </div>
    </div>
  );
}