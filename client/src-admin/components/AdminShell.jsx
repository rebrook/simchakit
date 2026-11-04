// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit Admin — AdminShell.jsx
// One responsive nav (sidebar on wide screens, drawer under 900px) and page routing.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { supabase }          from "@/lib/supabase.js";
import { useBriefing }       from "@/hooks/useBriefing.js";
import { useAdminTheme }     from "@/hooks/useAdminTheme.js";
import { BriefingPage }      from "@/components/pages/BriefingPage.jsx";
import { DashboardPage }     from "@/components/pages/DashboardPage.jsx";
import { UsersPage }         from "@/components/pages/UsersPage.jsx";
import { EventsPage }        from "@/components/pages/EventsPage.jsx";
import { PurchasesPage }     from "@/components/pages/PurchasesPage.jsx";
import { CouponsPage }       from "@/components/pages/CouponsPage.jsx";
import {
  IconBriefing, IconDashboard, IconUsers, IconEvents, IconPurchases, IconCoupons,
  IconMenu, IconClose, IconSun, IconMoon, IconSignOut,
} from "@/components/Icons.jsx";

const NAV = [
  { id: "briefing",  label: "Weekly briefing", Icon: IconBriefing },
  { id: "dashboard", label: "Dashboard",       Icon: IconDashboard },
  { id: "users",     label: "Users",           Icon: IconUsers },
  { id: "events",    label: "Events",          Icon: IconEvents },
  { id: "purchases", label: "Purchases",       Icon: IconPurchases },
  { id: "coupons",   label: "Coupons",         Icon: IconCoupons },
];

function Brand() {
  return (
    <div className="ax-brand">
      <img src="/icon-192.png" alt="" width="40" height="40" />
      <div>
        <div className="ax-brand-name">SimchaKit</div>
        <div className="ax-brand-sub">Admin</div>
      </div>
    </div>
  );
}

export function AdminShell({ session }) {
  const [page,     setPage]     = useState("briefing");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtn = useRef(null);
  const briefing = useBriefing();
  const { theme, toggle } = useAdminTheme();
  const token = session?.access_token;

  // Escape closes the drawer and returns focus to the button that opened it.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === "Escape") { setMenuOpen(false); menuBtn.current?.focus(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const go = (id) => { setPage(id); setMenuOpen(false); };

  return (
    <div className="ax-shell">
      <header className="ax-topbar">
        <Brand />
        <button ref={menuBtn} type="button" className="ax-icon-btn" aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen} aria-controls="ax-nav" onClick={() => setMenuOpen(o => !o)}>
          {menuOpen ? <IconClose /> : <IconMenu />}
        </button>
      </header>
      <div className="ax-scrim" data-open={menuOpen} onClick={() => setMenuOpen(false)} />

      <nav id="ax-nav" className="ax-nav" data-open={menuOpen} aria-label="Admin">
        <div className="ax-nav-brand"><Brand /></div>
        <div className="ax-links">
          {NAV.map(({ id, label, Icon }) => (
            <button key={id} type="button" className="ax-link" aria-current={page === id ? "page" : undefined} onClick={() => go(id)}>
              <Icon />
              <span>{label}</span>
              {id === "briefing" && briefing.undecided > 0 && (
                <span className="ax-badge" aria-label={`${briefing.undecided} undecided`}>{briefing.undecided}</span>
              )}
            </button>
          ))}
        </div>
        <div className="ax-nav-foot">
          <div className="ax-email">{session.user.email}</div>
          <button type="button" className="ax-btn" onClick={toggle}>
            {theme === "dark" ? <IconSun /> : <IconMoon />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <button type="button" className="ax-btn" onClick={() => supabase.auth.signOut()}>
            <IconSignOut /> Sign out
          </button>
        </div>
      </nav>

      <main className="ax-main">
        {page === "briefing" && <BriefingPage briefing={briefing} />}
        {page !== "briefing" && (
          <div className="ax-legacy">
            {page === "dashboard" && <DashboardPage token={token} />}
            {page === "users"     && <UsersPage     token={token} />}
            {page === "events"    && <EventsPage    token={token} />}
            {page === "purchases" && <PurchasesPage token={token} />}
            {page === "coupons"   && <CouponsPage   token={token} />}
          </div>
        )}
      </main>
    </div>
  );
}
