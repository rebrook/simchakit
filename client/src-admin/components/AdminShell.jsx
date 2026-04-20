// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit Admin — AdminShell.jsx
// Sidebar nav + page routing for the admin dashboard.
// ─────────────────────────────────────────────────────────────────────────────

import { useState }          from "react";
import { supabase }          from "@/lib/supabase.js";
import { DashboardPage }     from "@/components/pages/DashboardPage.jsx";
import { UsersPage }         from "@/components/pages/UsersPage.jsx";
import { EventsPage }        from "@/components/pages/EventsPage.jsx";
import { PurchasesPage }     from "@/components/pages/PurchasesPage.jsx";
import { CouponsPage }       from "@/components/pages/CouponsPage.jsx";

const NAV = [
  { id: "dashboard", label: "Dashboard",  icon: "▦" },
  { id: "users",     label: "Users",      icon: "👤" },
  { id: "events",    label: "Events",     icon: "✡" },
  { id: "purchases", label: "Purchases",  icon: "💳" },
  { id: "coupons",   label: "Coupons",    icon: "🎟" },
];

export function AdminShell({ session }) {
  const [page, setPage] = useState("dashboard");

  // Pass the session token to all pages for admin-query API calls
  const token = session?.access_token;

  return (
    <div style={styles.shell}>
      {/* ── Sidebar ── */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.sidebarLogo}>SimchaKit</div>
          <div style={styles.sidebarSub}>Admin</div>
        </div>

        <nav style={styles.nav}>
          {NAV.map(item => (
            <button
              key={item.id}
              style={{
                ...styles.navItem,
                ...(page === item.id ? styles.navItemActive : {}),
              }}
              onClick={() => setPage(item.id)}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div style={styles.sidebarFooter}>
          <div style={styles.sidebarEmail}>{session.user.email}</div>
          <button style={styles.signOutBtn} onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={styles.main}>
        {page === "dashboard" && <DashboardPage token={token} />}
        {page === "users"     && <UsersPage     token={token} />}
        {page === "events"    && <EventsPage    token={token} />}
        {page === "purchases" && <PurchasesPage token={token} />}
        {page === "coupons"   && <CouponsPage   token={token} />}
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>
    </div>
  );
}

const styles = {
  shell: {
    display:   "flex",
    minHeight: "100vh",
    fontFamily: "system-ui, -apple-system, sans-serif",
    background: "#f8f9fa",
  },
  sidebar: {
    width:      220,
    flexShrink: 0,
    background: "#111",
    display:    "flex",
    flexDirection: "column",
    position:   "sticky",
    top:        0,
    height:     "100vh",
  },
  sidebarHeader: {
    padding: "24px 20px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  sidebarLogo: {
    fontSize: 18, fontWeight: 700, color: "white",
  },
  sidebarSub: {
    fontSize: 11, color: "#888", marginTop: 2, letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  nav: {
    flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2,
  },
  navItem: {
    display:    "flex",
    alignItems: "center",
    gap:        10,
    padding:    "9px 12px",
    borderRadius: 8,
    border:     "none",
    background: "none",
    color:      "#aaa",
    fontSize:   14,
    fontWeight: 500,
    cursor:     "pointer",
    textAlign:  "left",
    width:      "100%",
    transition: "background 0.15s, color 0.15s",
  },
  navItemActive: {
    background: "rgba(255,255,255,0.1)",
    color:      "white",
  },
  navIcon: {
    fontSize: 16, width: 20, textAlign: "center", flexShrink: 0,
  },
  sidebarFooter: {
    padding: "16px 20px",
    borderTop: "1px solid rgba(255,255,255,0.08)",
  },
  sidebarEmail: {
    fontSize: 12, color: "#666", marginBottom: 8,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  signOutBtn: {
    background: "none", border: "1px solid rgba(255,255,255,0.15)",
    color: "#888", fontSize: 12, padding: "5px 10px", borderRadius: 6,
    cursor: "pointer", width: "100%",
  },
  main: {
    flex: 1, padding: "32px", overflowY: "auto", minWidth: 0,
  },
};
