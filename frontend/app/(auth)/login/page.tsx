"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, EyeOff, ArrowRight, Sparkles, GraduationCap, Shield, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/lib/useToast";
import { ToastContainer } from "@/components/ToastContainer";

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:8000";

const SPRING   = "cubic-bezier(.22,.68,0,1.2)";
const EASE_ALL = `all 0.25s ${SPRING}`;

const C = {
  primary:    "#003135",
  accent:     "#0FA4AF",
  light:      "#AFDDE5",
  white:      "#ffffff",
  text:       "#0f172a",
  body:       "#475569",
  muted:      "#64748b",
  mutedLight: "#94a3b8",
  border:     "rgba(226,232,240,0.7)",
  borderHov:  "rgba(15,164,175,0.22)",
};

const ICON_GRAD   = `linear-gradient(135deg, ${C.primary} 0%, ${C.accent} 100%)`;
const SHADOW_REST = "0 2px 12px rgba(0,49,53,0.06)";
const SHADOW_ACT  = "0 16px 40px rgba(15,164,175,0.35)";

function InputField({
  label, type = "text", value, onChange, placeholder,
  autoComplete, required, suffix,
}: {
  label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
  autoComplete?: string; required?: boolean;
  suffix?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={{
        display: "block", fontSize: 11, fontWeight: 700,
        color: C.muted, textTransform: "uppercase",
        letterSpacing: "0.09em", marginBottom: 7,
      }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          style={{
            width: "100%",
            padding: suffix ? "12px 48px 12px 16px" : "12px 16px",
            borderRadius: 12,
            border: `1px solid ${focused ? C.borderHov : C.border}`,
            background: focused ? C.white : "#f8fafc",
            color: C.text, fontSize: 14, outline: "none",
            boxShadow: focused
              ? `0 0 0 3px rgba(15,164,175,0.12), ${SHADOW_REST}`
              : SHADOW_REST,
            transition: EASE_ALL,
            boxSizing: "border-box",
          }}
        />
        {suffix && (
          <div style={{
            position: "absolute", right: 12,
            top: "50%", transform: "translateY(-50%)",
          }}>
            {suffix}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [hovBtn,   setHovBtn]   = useState(false);
  const { toasts, toast, removeToast } = useToast();

  async function handleLogin(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const res  = await fetch(`${AUTH_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Login failed", data?.detail ?? "Invalid credentials. Please try again.");
        return;
      }
      localStorage.setItem("token", data.token ?? "");
      toast.success("Welcome back!", "Redirecting to your dashboard…");
      setTimeout(() => router.push(data.redirect_url ?? "/"), 1000);
    } catch (err) {
  console.error(err);
  toast.error("Connection error", "Could not reach the server. Please try again.");
} finally {
      setLoading(false);
    }
  }

  const features = [
    { Icon: Zap,           text: "AI face recognition attendance" },
    { Icon: Shield,        text: "Role-based secure access"       },
    { Icon: GraduationCap, text: "Smart analytics & reporting"    },
  ];

  return (
    <>
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* ── Root: fixed full-viewport, no overflow ── */}
      <div style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        fontFamily: "'Geist', 'Inter', system-ui, sans-serif",
      }}>

        {/* ── Left panel ── */}
        <div
          className="login-left"
          style={{
            width: "48%",
            height: "100vh",
            position: "relative",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "48px 52px",
            flexShrink: 0,
          }}
        >
          {/* bg.jpg */}
          <Image
            src="/bg.jpg"
            alt="Department of Information Technology, Gauhati University"
            fill
            priority
            style={{ objectFit: "cover", objectPosition: "center top" }}
          />

          {/* Dark overlay */}
          <div style={{
            position: "absolute", inset: 0, zIndex: 1,
            background: `linear-gradient(
              to bottom,
              rgba(0,49,53,0.90) 0%,
              rgba(0,49,53,0.52) 35%,
              rgba(0,49,53,0.52) 65%,
              rgba(0,49,53,0.94) 100%
            )`,
          }} />
          <div style={{
            position: "absolute", inset: 0, zIndex: 1,
            background: "rgba(15,164,175,0.07)",
          }} />

          {/* Top: logo + brand */}
          <div style={{ position: "relative", zIndex: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {/* WHITE logo background */}
              <div style={{
                width: 58, height: 58, borderRadius: 16,
                overflow: "hidden",
                background: "#ffffff",
                border: "1.5px solid rgba(175,221,229,0.3)",
                boxShadow: "0 8px 28px rgba(15,164,175,0.4)",
                flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Image src="/logo.png" alt="Facidance" width={50} height={50}
                  style={{ objectFit: "contain" }} />
              </div>
              <div>
                <p style={{
                  fontSize: 22, fontWeight: 800, color: "#fff",
                  letterSpacing: "-0.03em", lineHeight: 1,
                }}>
                  Facidance
                </p>
                <p style={{ fontSize: 12, color: "rgba(175,221,229,0.65)", marginTop: 3 }}>
                  Department of Information Technology
                </p>
              </div>
            </div>

            <div style={{
              marginTop: 24,
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(15,164,175,0.18)",
              border: "1px solid rgba(15,164,175,0.38)",
              borderRadius: 20, padding: "5px 13px",
            }}>
              <Sparkles size={12} color={C.light} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: C.light, letterSpacing: "0.04em" }}>
                AI-Powered Smart Attendance
              </span>
            </div>

            <p style={{
              marginTop: 18, fontSize: 30, fontWeight: 800, color: "#fff",
              letterSpacing: "-0.04em", lineHeight: 1.2, maxWidth: 340,
            }}>
              Gauhati University
            </p>
            <p style={{
              marginTop: 6, fontSize: 14,
              color: "rgba(175,221,229,0.65)",
              lineHeight: 1.65, maxWidth: 320,
            }}>
              Smart face recognition attendance — built for the Department of Information Technology.
            </p>
          </div>

          {/* Middle: features */}
          <div style={{
            position: "relative", zIndex: 2,
            display: "flex", flexDirection: "column", gap: 13,
          }}>
            {features.map(({ Icon, text }) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: "rgba(15,164,175,0.18)",
                  border: "1px solid rgba(15,164,175,0.32)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={15} color={C.light} />
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 500, color: "rgba(175,221,229,0.85)" }}>
                  {text}
                </span>
              </div>
            ))}
          </div>

          {/* Bottom: stats */}
          <div style={{
            position: "relative", zIndex: 2,
            display: "flex",
            borderTop: "1px solid rgba(175,221,229,0.14)",
            paddingTop: 24,
          }}>
            {[
              { val: "1500+", lbl: "Students" },
              { val: "98.2%",  lbl: "Accuracy" },
              { val: "10+",   lbl: "Courses"  },
            ].map(({ val, lbl }, i, arr) => (
              <div key={lbl} style={{
                flex: 1, textAlign: "center",
                borderRight: i < arr.length - 1
                  ? "1px solid rgba(175,221,229,0.14)"
                  : "none",
              }}>
                <p style={{
                  fontSize: 20, fontWeight: 800, color: C.light,
                  letterSpacing: "-0.03em", lineHeight: 1,
                }}>
                  {val}
                </p>
                <p style={{ fontSize: 11, color: "rgba(175,221,229,0.5)", marginTop: 4, fontWeight: 500 }}>
                  {lbl}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right panel: form ── */}
        <div style={{
          flex: 1,
          height: "100vh",
          overflowY: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 40px",
          background: "linear-gradient(160deg, #f8fafc 0%, #f0f9fa 50%, #eaf6f8 100%)",
          position: "relative",
        }}>
          {/* Ambient orb */}
          <div aria-hidden style={{
            position: "fixed", top: "-10%", right: "-5%",
            width: 400, height: 400, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(15,164,175,0.07) 0%, transparent 65%)",
            pointerEvents: "none",
          }} />

          <div style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 1 }}>

            {/* Mobile-only logo */}
            <div className="mobile-logo" style={{
              display: "none", alignItems: "center", gap: 12,
              marginBottom: 32, justifyContent: "center",
            }}>
              <div style={{
                width: 50, height: 50, borderRadius: 14,
                overflow: "hidden", background: "#ffffff",
                border: `1px solid ${C.border}`, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Image src="/logo.png" alt="Facidance" width={44} height={44}
                  style={{ objectFit: "contain" }} />
              </div>
              <p style={{ fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: "-0.02em" }}>
                Facidance
              </p>
            </div>

            {/* Heading */}
            <div style={{ marginBottom: 32 }}>
              <h1 style={{
                fontSize: 28, fontWeight: 800, color: C.text,
                letterSpacing: "-0.03em", lineHeight: 1.1,
              }}>
                Welcome back 👋
              </h1>
              <p style={{ fontSize: 14, color: C.body, marginTop: 6 }}>
                Sign in to access your Facidance portal.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <InputField
                label="Email address"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@gauhati.ac.in"
                autoComplete="email"
                required
              />
              <InputField
                label="Password"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={setPassword}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                suffix={
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    style={{
                      background: "none", border: "none",
                      cursor: "pointer", color: C.mutedLight,
                      display: "flex", alignItems: "center",
                      padding: 0, transition: "color 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = C.accent)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = C.mutedLight)}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />

              <button
                type="submit"
                disabled={loading}
                onMouseEnter={() => setHovBtn(true)}
                onMouseLeave={() => setHovBtn(false)}
                style={{
                  width: "100%", padding: "13px 20px",
                  borderRadius: 12, border: "none",
                  background: loading ? "#e2e8f0" : ICON_GRAD,
                  color: loading ? C.muted : "#fff",
                  fontSize: 14, fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 8,
                  boxShadow: !loading && hovBtn ? SHADOW_ACT
                    : !loading ? "0 8px 24px rgba(15,164,175,0.3)" : "none",
                  transform: !loading && hovBtn
                    ? "translateY(-2px) scale(1.01)" : "translateY(0) scale(1)",
                  transition: EASE_ALL,
                  opacity: loading ? 0.7 : 1,
                  marginTop: 4,
                }}
              >
                {loading ? (
                  <>
                    <div style={{
                      width: 16, height: 16, borderRadius: "50%",
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "#fff",
                      animation: "spin 0.8s linear infinite",
                    }} />
                    Signing in…
                  </>
                ) : (
                  <>Sign in <ArrowRight size={16} /></>
                )}
              </button>
            </form>

            {/* Divider */}
            <div style={{
              display: "flex", alignItems: "center",
              gap: 14, margin: "28px 0",
            }}>
              <div style={{ flex: 1, height: 1, background: C.border }} />
              <span style={{ fontSize: 12, color: C.mutedLight, fontWeight: 500 }}>or</span>
              <div style={{ flex: 1, height: 1, background: C.border }} />
            </div>

            {/* Register CTA */}
            <div style={{
              padding: "18px 20px", borderRadius: 14,
              background: "rgba(15,164,175,0.05)",
              border: `1px solid ${C.borderHov}`,
              textAlign: "center",
            }}>
              <p style={{ fontSize: 13.5, color: C.body }}>
                New faculty member?{" "}
                <button
                  onClick={() => router.push("/register-teacher")}
                  style={{
                    background: "none", border: "none",
                    cursor: "pointer", fontSize: 13.5,
                    fontWeight: 700, color: C.accent, padding: 0,
                    textDecoration: "underline",
                    textDecorationColor: "rgba(15,164,175,0.35)",
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = C.primary)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = C.accent)}
                >
                  Register here
                </button>
              </p>
              <p style={{ fontSize: 11.5, color: C.mutedLight, marginTop: 4 }}>
                Account pending admin approval after registration.
              </p>
            </div>

            <p style={{
              fontSize: 11.5, color: C.mutedLight,
              textAlign: "center", marginTop: 24, lineHeight: 1.6,
            }}>
              By signing in you agree to the Department's
              <br />terms of use and privacy policy.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .login-left  { display: none !important; }
          .mobile-logo { display: flex !important; }
        }
      `}</style>
    </>
  );
}