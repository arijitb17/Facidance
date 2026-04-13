"use client";

/**
 * Unified Navbar — supports "teacher", "student", and "admin" roles.
 * All roles share the same teal brand color scheme.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import Image from "next/image";
import {
  LayoutDashboard, BookOpen, CheckSquare,
  Users, BarChart3, LogOut, Menu, X,
  ClipboardList, User, GraduationCap, Building2,
  BookMarked,
} from "lucide-react";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const SPRING      = "cubic-bezier(.22,.68,0,1.2)";
const EASE        = `all 0.25s ${SPRING}`;
const ICON_GRAD   = "linear-gradient(135deg, #003135 0%, #0FA4AF 100%)";
const ACTIVE_GRAD = "linear-gradient(135deg, #003135 0%, #024950 50%, #0FA4AF 100%)";
const ACTIVE_SHADOW = "0 4px 18px rgba(15,164,175,0.32), inset 0 1px 0 rgba(255,255,255,0.12)";

// ─── Nav route tables ──────────────────────────────────────────────────────────
const TEACHER_NAV = [
  { href: "/teacher",            label: "Dashboard",  Icon: LayoutDashboard },
  { href: "/teacher/courses",    label: "My Courses", Icon: BookOpen        },
  { href: "/teacher/attendance", label: "Attendance", Icon: CheckSquare     },
  { href: "/teacher/students",   label: "Students",   Icon: Users           },
  { href: "/teacher/reports",    label: "Reports",    Icon: BarChart3       },
];

const STUDENT_NAV = [
  { href: "/student",          label: "Dashboard",          Icon: LayoutDashboard },
  { href: "/student/courses",  label: "My Courses",         Icon: BookOpen        },
  { href: "/student/history",  label: "Attendance History", Icon: ClipboardList   },
  { href: "/student/profile",  label: "Profile",            Icon: User            },
];

const ADMIN_NAV = [
  { href: "/admin",             label: "Overview",    Icon: LayoutDashboard },
  { href: "/admin/teachers",    label: "Teachers",    Icon: Users           },
  { href: "/admin/departments", label: "Departments", Icon: Building2       },
  { href: "/admin/programs",    label: "Programs",    Icon: BookMarked      },
  { href: "/admin/courses",     label: "Courses",     Icon: BookOpen        },
  { href: "/admin/students",    label: "Students",    Icon: GraduationCap   },
];

type NavItem = { href: string; label: string; Icon: React.ElementType };

// ─── Teacher API ───────────────────────────────────────────────────────────────
const TEACHER_BASE = process.env.NEXT_PUBLIC_TEACHER_API_URL ?? "http://localhost:8002";

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  return { Authorization: `Bearer ${token}` };
}

async function fetchTeacherMe() {
  const res = await fetch(`${TEACHER_BASE}/teacher/me`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Unauthorized");
  return res.json() as Promise<{ id: string; name: string; department?: string }>;
}

// ─── Public props ──────────────────────────────────────────────────────────────
interface NavbarProps {
  role: "teacher" | "student" | "admin";
  name?: string;
  department?: string;
}

// ─── Default export ────────────────────────────────────────────────────────────
export default function Navbar({ role, name, department }: NavbarProps) {
  if (role === "teacher") return <TeacherNavbar nameProp={name} deptProp={department} />;
  if (role === "admin")   return <AdminNavbar nameProp={name} />;
  return <StudentNavbar nameProp={name} />;
}

// ─── Teacher branch ───────────────────────────────────────────────────────────
function TeacherNavbar({ nameProp, deptProp }: { nameProp?: string; deptProp?: string }) {
  const { data: me } = useQuery({
    queryKey: ["teacher-me"],
    queryFn:  fetchTeacherMe,
    retry: 1,
  });
  return (
    <NavbarShell
      nav={TEACHER_NAV}
      homeHref="/teacher"
      role="teacher"
      displayName={nameProp ?? me?.name      ?? "Teacher"}
      subtitle={deptProp   ?? me?.department ?? "Teacher"}
    />
  );
}

// ─── Admin branch ─────────────────────────────────────────────────────────────
function AdminNavbar({ nameProp }: { nameProp?: string }) {
  const [adminName, setAdminName] = useState(nameProp ?? "Admin");
  useEffect(() => {
    if (nameProp) return;
    try {
      const token = localStorage.getItem("token") ?? "";
      const decoded = JSON.parse(atob(token.split(".")[1]));
      if (decoded.name) setAdminName(decoded.name);
    } catch { /* fallback to "Admin" */ }
  }, [nameProp]);
  return (
    <NavbarShell
      nav={ADMIN_NAV}
      homeHref="/admin"
      role="admin"
      displayName={nameProp ?? adminName}
      subtitle="Administrator"
    />
  );
}

// ─── Student branch ───────────────────────────────────────────────────────────
function StudentNavbar({ nameProp }: { nameProp?: string }) {
  return (
    <NavbarShell
      nav={STUDENT_NAV}
      homeHref="/student"
      role="student"
      displayName={nameProp ?? "Student"}
      subtitle="Student"
    />
  );
}

// ─── Shared shell ─────────────────────────────────────────────────────────────
interface ShellProps {
  nav: NavItem[];
  homeHref: string;
  role: "teacher" | "student" | "admin";
  displayName: string;
  subtitle: string;
}

function NavbarShell({ nav, homeHref, displayName, subtitle }: ShellProps) {
  const pathname = usePathname();
  const router   = useRouter();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled,   setScrolled]   = useState(false);
  const [logoutHov,  setLogoutHov]  = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const isActive = (href: string) =>
    href === homeHref ? pathname === homeHref : pathname.startsWith(href);

  function handleSignOut() {
    localStorage.removeItem("token");
    router.push("/login");
  }

  return (
    <>
      {/* ── Sticky header ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100, height: 70,
        display: "flex", alignItems: "center",
        paddingLeft: "clamp(16px, 4vw, 40px)",
        paddingRight: "clamp(16px, 4vw, 40px)",
        backdropFilter: "blur(20px) saturate(200%)",
        WebkitBackdropFilter: "blur(20px) saturate(200%)",
        background: scrolled ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.78)",
        borderBottom: `1px solid ${scrolled ? "rgba(15,164,175,0.14)" : "rgba(226,232,240,0.6)"}`,
        boxShadow: scrolled
          ? "0 2px 24px rgba(0,49,53,0.08), inset 0 1px 0 rgba(255,255,255,0.6)"
          : "inset 0 1px 0 rgba(255,255,255,0.6)",
        transition: `background 0.3s ${SPRING}, box-shadow 0.3s ${SPRING}, border-color 0.3s ${SPRING}`,
        gap: 12,
      }}>

        {/* Logo — image + wordmark only, no role badge */}
        <Link href={homeHref} style={{
          display: "flex", alignItems: "center", gap: 6,
          textDecoration: "none", flexShrink: 0, transition: EASE,
        }} className="logo-link">
          <Image src="/logo.png" alt="Facidance" width={52} height={52}
            style={{ objectFit: "contain" }} />
          <span style={{
            fontWeight: 800, fontSize: 17,
            background: ICON_GRAD,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text", letterSpacing: "-0.02em",
          }}>
            Facidance
          </span>
        </Link>

        {/* Center nav — desktop */}
        <nav style={{
          flex: 1, display: "flex", alignItems: "center",
          justifyContent: "center", gap: 2,
        }} className="desktop-nav">
          {nav.map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <Link key={href} href={href}
                className={`nav-link${active ? " nav-active" : ""}`}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "8px 16px", borderRadius: 10,
                  fontSize: 13.5, fontWeight: active ? 700 : 500,
                  textDecoration: "none", letterSpacing: "-0.01em",
                  background: active ? ACTIVE_GRAD : "transparent",
                  color: active ? "#fff" : "#64748b",
                  boxShadow: active ? ACTIVE_SHADOW : "none",
                  transform: active ? "translateY(-1px)" : "translateY(0)",
                  transition: EASE,
                }}>
                <Icon size={14} strokeWidth={active ? 2.5 : 2} style={{ transition: EASE }} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, marginLeft: "auto" }}>

          <div style={{ textAlign: "right", lineHeight: 1 }} className="profile-text">
            <p style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", letterSpacing: "-0.01em", margin: 0 }}>
              {displayName}
            </p>
            <p style={{ fontSize: 11, color: "#94a3b8", margin: "3px 0 0" }}>{subtitle}</p>
          </div>

          <div className="profile-divider" style={{ width: 1, height: 28, background: "#e2e8f0", flexShrink: 0 }} />

          <button
            onClick={handleSignOut}
            onMouseEnter={() => setLogoutHov(true)}
            onMouseLeave={() => setLogoutHov(false)}
            title="Sign out"
            className="logout-btn"
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 13px", borderRadius: 10,
              background: logoutHov ? "#fef2f2" : "transparent",
              border: `1px solid ${logoutHov ? "rgba(239,68,68,0.25)" : "#e2e8f0"}`,
              color: logoutHov ? "#ef4444" : "#94a3b8",
              cursor: "pointer", fontWeight: 600, fontSize: 12.5,
              transition: EASE,
              transform: logoutHov ? "translateY(-1px)" : "translateY(0)",
              boxShadow: logoutHov ? "0 4px 12px rgba(239,68,68,0.12)" : "none",
              whiteSpace: "nowrap",
            }}
          >
            <LogOut size={14} strokeWidth={2} />
            <span className="logout-label">Sign out</span>
          </button>

          <button
            className="mobile-hamburger"
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: mobileOpen ? "#003135" : "#f8fafc",
              border: `1px solid ${mobileOpen ? "#003135" : "#e2e8f0"}`,
              cursor: "pointer",
              color: mobileOpen ? "#fff" : "#003135",
              display: "none",
              alignItems: "center", justifyContent: "center",
              boxShadow: mobileOpen ? "0 4px 14px rgba(0,49,53,0.2)" : "0 1px 4px rgba(0,0,0,0.04)",
              transition: EASE, flexShrink: 0,
            }}
          >
            <div style={{ transition: EASE, transform: mobileOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
              {mobileOpen ? <X size={17} /> : <Menu size={17} />}
            </div>
          </button>
        </div>
      </header>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <>
          <div style={{
            position: "fixed", inset: 0, zIndex: 40,
            background: "rgba(0,49,53,0.2)",
            backdropFilter: "blur(6px)",
            animation: "fadeIn 0.2s ease both",
          }} onClick={() => setMobileOpen(false)} />

          <div style={{
            position: "fixed", top: 70, left: 0, right: 0, zIndex: 45,
            background: "rgba(255,255,255,0.97)",
            backdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(15,164,175,0.12)",
            padding: "12px 16px 16px",
            display: "flex", flexDirection: "column", gap: 4,
            boxShadow: "0 12px 40px rgba(0,49,53,0.12)",
            animation: "slideDown 0.25s cubic-bezier(.22,.68,0,1.2) both",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px",
              background: "linear-gradient(135deg, rgba(0,49,53,0.04) 0%, rgba(15,164,175,0.06) 100%)",
              borderRadius: 12, border: "1px solid rgba(15,164,175,0.1)", marginBottom: 6,
            }}>
              <div>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b", margin: 0 }}>{displayName}</p>
                <p style={{ fontSize: 11.5, color: "#94a3b8", margin: "3px 0 0" }}>{subtitle}</p>
              </div>
              <button
                onClick={() => { setMobileOpen(false); handleSignOut(); }}
                style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "7px 12px",
                  borderRadius: 9, background: "#fff", border: "1px solid rgba(239,68,68,0.2)",
                  color: "#ef4444", cursor: "pointer", fontWeight: 600, fontSize: 12,
                }}
              >
                <LogOut size={13} strokeWidth={2} /> Sign out
              </button>
            </div>

            {nav.map(({ href, label, Icon }) => {
              const active = isActive(href);
              return (
                <Link key={href} href={href} onClick={() => setMobileOpen(false)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "11px 14px", borderRadius: 11,
                    fontSize: 14, fontWeight: active ? 700 : 500,
                    textDecoration: "none",
                    background: active ? ACTIVE_GRAD : "transparent",
                    color: active ? "#fff" : "#475569",
                    boxShadow: active ? ACTIVE_SHADOW : "none",
                    transition: EASE,
                  }}>
                  <Icon size={16} strokeWidth={active ? 2.5 : 2} /> {label}
                </Link>
              );
            })}
          </div>
        </>
      )}

      <style>{`
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .logo-link:hover { opacity: 0.85; }
        .nav-link:hover:not(.nav-active) {
          background: #f0f9fa !important;
          color: #003135 !important;
          transform: translateY(-2px) !important;
          box-shadow: 0 4px 12px rgba(0,49,53,0.08) !important;
        }
        @media (min-width: 768px)  { .mobile-hamburger { display: none !important; } }
        @media (max-width: 767px)  {
          .mobile-hamburger { display: flex !important; }
          .desktop-nav      { display: none !important; }
          .profile-text     { display: none !important; }
          .profile-divider  { display: none !important; }
          .logout-btn       { display: none !important; }
        }
        @media (max-width: 960px) and (min-width: 768px) {
          .logout-label { display: none !important; }
        }
      `}</style>
    </>
  );
}