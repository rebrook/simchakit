// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit — App.jsx  (V2 Vite build — Phase 7 complete)
// App shell only. All components, hooks, constants, and utils are extracted.
// ─────────────────────────────────────────────────────────────────────────────

// Extract event path from URL for API calls (without simcha- prefix)
const EVENT_PATH = (() => {
  const parts = window.location.pathname.split("/").filter(Boolean);
  // URL: /simcha/your-event-id/ → parts: ["simcha", "your-event-id"]
  return parts[1] || "default";
})();

// Full boardId for WebSocket subscription (with simcha- prefix)
const EVENT_ID = "simcha-" + EVENT_PATH;

// ─────────────────────────────────────────────────────────────────────────────
// REACT + HOOKS
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from "react";
import { useSimchaSync } from "@/hooks/useSimchaSync.js";
import { useDarkMode } from "@/hooks/useDarkMode.js";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
import { EVENT_TYPE_ICONS } from "@/constants/events.js";

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
import { generateEventBriefHTML } from "@/utils/exports.js";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
import { ThemeProvider } from "@/components/shared/ThemeProvider.jsx";
import { PlaceholderTab } from "@/components/shared/PlaceholderTab.jsx";

// ─────────────────────────────────────────────────────────────────────────────
// TAB COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
import { SearchOverlay } from "@/components/tabs/SearchOverlay.jsx";
import { AccommodationsTab } from "@/components/tabs/AccommodationsTab.jsx";
import { TasksTab } from "@/components/tabs/TasksTab.jsx";
import { PrepTab } from "@/components/tabs/PrepTab.jsx";
import { SeatingTab } from "@/components/tabs/SeatingTab.jsx";
import { GiftsTab } from "@/components/tabs/GiftsTab.jsx";
import { FavorsTab } from "@/components/tabs/FavorsTab.jsx";
import { CeremonyRolesTab } from "@/components/tabs/CeremonyRolesTab.jsx";
import { BudgetTab } from "@/components/tabs/BudgetTab.jsx";
import { VendorsTab } from "@/components/tabs/VendorsTab.jsx";
import { CalendarTab } from "@/components/tabs/CalendarTab.jsx";
import { OverviewTab } from "@/components/tabs/OverviewTab.jsx";
import { GuestsTab } from "@/components/tabs/GuestsTab.jsx";
import { AdminLogin, AdminPanel } from "@/components/tabs/AdminPanel.jsx";
import { DayOfOverlay } from "@/components/tabs/DayOfOverlay.jsx";
import { GuideModal, ActivityLogModal, WhatsNewModal } from "@/components/tabs/Modals.jsx";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab]         = useState("overview");
  const [showAdmin, setShowAdmin]             = useState(false);
  const [adminInitialSection, setAdminInitialSection] = useState("event");
  const [adminPassword, setAdminPassword] = useState(null);
  const [adminConfig, setAdminConfig]     = useState(null);
  const [favorConfig, setFavorConfig]     = useState(null);
  const [showWhatsNew,    setShowWhatsNew]    = useState(false);
  const [showGuide,       setShowGuide]       = useState(false);
  const [showDayOf,       setShowDayOf]       = useState(false);
  const [showSearch,      setShowSearch]      = useState(false);
  const [showOverflow,    setShowOverflow]    = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [showMoreDrawer,  setShowMoreDrawer]  = useState(false);
  const [briefHTML,       setBriefHTML]       = useState(null);
  const [searchHighlight, setSearchHighlight] = useState(null);
  const [passcodeUnlocked, setPasscodeUnlocked] = useState(false);
  const [passcodeInput,    setPasscodeInput]    = useState("");
  const [passcodeError,    setPasscodeError]    = useState("");
  const [publicConfig,     setPublicConfig]     = useState(null); // GL-06: non-sensitive config fetched before WebSocket
  const [darkMode, setDarkMode]           = useDarkMode();
  const [appVersion,      setAppVersion]      = useState("");
  const [toastMsg,        setToastMsg]        = useState("");
  const [toastVisible,    setToastVisible]    = useState(false);
  const [calendarView,    setCalendarView]    = useState("list");
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const toastTimer = useRef(null);
  const navInnerRef = useRef(null);
  const [overflowFromIdx, setOverflowFromIdx] = useState(null);
  const [showNavMore,     setShowNavMore]     = useState(false);
  const [navMoreAnchor,   setNavMoreAnchor]   = useState(null);

  const showToast = useCallback((message) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(message);
    setToastVisible(true);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2500);
  }, []);

  // Fetch version from changelog — single source of truth
  useEffect(() => {
    fetch("/simcha/changelog")
      .then(r => r.json())
      .then(d => { if (d.current) setAppVersion(d.current); })
      .catch(() => {});
  }, []);

  // GL-06: Fetch public (non-sensitive) config on mount — determines if passcode is required
  useEffect(() => {
    fetch(`/simcha/${EVENT_PATH}/api/public-config`)
      .then(r => r.json())
      .then(cfg => setPublicConfig(cfg))
      .catch(() => setPublicConfig({ error: true }));
  }, []);

  // ⌘K / Ctrl+K opens search on desktop
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(s => !s);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Mobile header collapse — hide event name row on scroll down, reveal on scroll up
  useEffect(() => {
    if (window.innerWidth >= 640) return;
    let lastY = window.scrollY;
    let rafId = null;
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        const currentY = window.scrollY;
        if (currentY > lastY && currentY > 60) {
          setHeaderCollapsed(true);
        } else if (currentY < lastY) {
          setHeaderCollapsed(false);
        }
        lastY = currentY;
        rafId = null;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // GL-06: Only connect WebSocket after passcode is verified (or if no passcode required)
  const shouldConnect = publicConfig && (!publicConfig.requiresPasscode || passcodeUnlocked);
  const { state, syncStatus, queueSize, updateNotes, updateData, lastSavedAt } = useSimchaSync(EVENT_ID, shouldConnect);

  // Tick every 10s so the "Saved Xm ago" label stays fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!lastSavedAt) return;
    const interval = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, [lastSavedAt]);

  const appendAuditLog = useCallback((action, detail) => {
    const current = state?.auditLog || [];
    const entry = {
      id:        "al_" + Date.now() + "_" + Math.random().toString(36).slice(2,7),
      timestamp: new Date().toISOString(),
      action,
      detail,
    };
    updateData("auditLog", [entry, ...current]);
  }, [state?.auditLog, updateData]);

  useEffect(() => {
    if (state?.adminConfig) setAdminConfig(state.adminConfig);
  }, [state?.adminConfig]);

  useEffect(() => {
    if (state?.favors?.config) setFavorConfig(state.favors.config);
  }, [state?.favors?.config]);

  // Show a user-facing warning if an audit log write fails on the server
  useEffect(() => {
    if (state?.auditError) showToast("⚠ Activity log entry could not be saved");
  }, [state?.auditError]);

  const displayState = state ? { ...state, adminConfig: adminConfig||state.adminConfig, favorConfig: favorConfig||state.favors?.config } : null;
  const guestBadge   = displayState ? (displayState.people||[]).length : null;

  // True on any day that matches a timeline entry date — surfaces Day-of Mode directly in header
  const todayStr       = new Date().toISOString().slice(0, 10);
  const isTodayEventDay = (adminConfig?.timeline || []).some(e => e.startDate === todayStr);

  // Last saved label — desktop (full) and mobile (abbreviated)
  const savedLabel = (() => {
    if (!lastSavedAt) return null;
    const secs = Math.floor((Date.now() - lastSavedAt) / 1000);
    if (secs < 10)  return { desktop: "Saved just now", mobile: "✓ now" };
    if (secs < 60)  return { desktop: `Saved ${secs}s ago`,          mobile: `✓ ${secs}s` };
    const mins = Math.floor(secs / 60);
    if (mins < 60)  return { desktop: `Saved ${mins}m ago`,          mobile: `✓ ${mins}m` };
    const hrs  = Math.floor(mins / 60);
    return              { desktop: `Saved ${hrs}h ago`,              mobile: `✓ ${hrs}h`  };
  })();

  const ALL_TABS = [
    { id:"overview", icon:"✦",  label:"Overview" },
    { id:"guests",        icon:"👥", label:"Guests",  badge:guestBadge },
    { id:"budget",   icon:"💰", label:"Budget",
      badge: displayState ? ((displayState.expenses||[]).filter(e=>!e.paid).length||null) : null },
    { id:"vendors",  icon:"🏪", label:"Vendors" },
    { id:"tasks",    icon:"✅", label:"Tasks",
      badge: displayState ? (displayState.tasks||[]).filter(t=>!t.done).length||null : null },
    { id:"prep",     icon:"📖", label:"Prep" },
    { id:"ceremony", icon:"📜",  label:"Ceremony" },
    { id:"seating",  icon:"🪑", label:"Seating" },
    { id:"gifts",    icon:"🎁", label:"Gifts" },
    { id:"accommodations", icon:"🧳", label:"Stay & Travel",
      badge: displayState ? ((displayState.households||[]).filter(h=>h.outOfTown && !h.accomNotified).length||null) : null },
    { id:"favors",   icon:"⭐", label:"Favors" },
    { id:"calendar", icon:"📅", label:"Calendar" },
  ];

  // Filter tabs by adminConfig.visibleTabs — default all visible if unset
  const visibleTabIds = adminConfig?.visibleTabs;
  const tabs = (visibleTabIds && visibleTabIds.length > 0)
    ? ALL_TABS.filter(t => t.id === "overview" || visibleTabIds.includes(t.id))
    : ALL_TABS;

  const PLACEHOLDERS = {};

  // ── Mobile bottom nav split ───────────────────────────────────────────────
  const BOTTOM_BAR_IDS = ["overview", "guests", "budget", "vendors", "tasks"];
  const bottomBarTabs  = tabs.filter(t => BOTTOM_BAR_IDS.includes(t.id));
  const moreDrawerTabs = tabs.filter(t => !BOTTOM_BAR_IDS.includes(t.id));
  const moreIsActive   = moreDrawerTabs.some(t => t.id === activeTab);
  const moreBadge      = moreDrawerTabs.some(t => t.badge != null && t.badge > 0);

  // Close more drawer on Escape
  useEffect(() => {
    if (!showMoreDrawer) return;
    const handler = (e) => { if (e.key === "Escape") setShowMoreDrawer(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showMoreDrawer]);

  // If the active tab gets hidden via visibleTabs, redirect to overview
  useEffect(() => {
    if (visibleTabIds && visibleTabIds.length > 0 && !tabs.some(t => t.id === activeTab)) {
      setActiveTab("overview");
    }
  }, [visibleTabIds]);

  // Close overflow menu on outside click
  useEffect(() => {
    if (!showOverflow) return;
    const handler = (e) => {
      if (!e.target.closest(".header-overflow-wrap")) setShowOverflow(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [showOverflow]);

  // Close nav More dropdown on outside click
  useEffect(() => {
    if (!showNavMore) return;
    const handler = (e) => {
      if (!e.target.closest(".nav-more-wrap") && !e.target.closest(".nav-more-menu")) setShowNavMore(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [showNavMore]);

  // ResizeObserver — measures rendered tab widths and computes overflow index
  useEffect(() => {
    const el = navInnerRef.current;
    if (!el) return;
    const compute = () => {
      const children = Array.from(el.children).filter(c => c.classList.contains("nav-tab"));
      if (!children.length) return;
      // Reserve space for the More button (~88px) plus a small buffer
      const available = el.clientWidth - 92;
      let total = 0;
      let cutoff = null;
      for (let i = 0; i < children.length; i++) {
        total += children[i].offsetWidth + 2; // 2px gap
        if (total > available && cutoff === null) {
          cutoff = i;
        }
      }
      setOverflowFromIdx(cutoff);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tabs.length, !!publicConfig]);

  // GL-06: Passcode verification function — calls server endpoint
  const verifyPasscode = () => {
    fetch(`/simcha/${EVENT_PATH}/api/verify-passcode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: passcodeInput }),
    })
      .then(r => r.json())
      .then(result => {
        if (result.ok) {
          setPasscodeUnlocked(true);
        } else {
          setPasscodeError("Incorrect passcode. Please try again.");
          setPasscodeInput("");
        }
      })
      .catch(() => {
        setPasscodeError("Could not verify passcode. Please try again.");
      });
  };

  // GL-06: Loading screen while fetching public config
  if (!publicConfig) {
    return (
      <div className="app-shell">
        <ThemeProvider palette="rose" customColor="" />
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          minHeight: "100vh", padding: 24, textAlign: "center",
        }}>
          <img src="/simcha/apple-touch-icon.png" alt="SimchaKit" style={{ width: 48, height: 48, borderRadius: 10, marginBottom: 16 }} />
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text-primary)", marginBottom: 8 }}>
            Loading...
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Connecting to SimchaKit
          </div>
        </div>
      </div>
    );
  }

  // GL-06: Passcode lock screen — shown BEFORE WebSocket connects (no data exposed)
  if (publicConfig.requiresPasscode && !passcodeUnlocked) {
    return (
      <div className="app-shell">
        <ThemeProvider palette={publicConfig.palette || "rose"} customColor="" />
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          minHeight: "100vh", padding: 24, textAlign: "center",
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>
            {publicConfig.icon || EVENT_TYPE_ICONS[publicConfig.type] || "✡"}
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
            {publicConfig.name || "Event Dashboard"}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
            This event is protected. Enter the access passcode to continue.
          </div>
          <input
            type="password"
            className="form-input"
            placeholder="Enter passcode"
            value={passcodeInput}
            onChange={e => { setPasscodeInput(e.target.value); setPasscodeError(""); }}
            onKeyDown={e => { if (e.key === "Enter") verifyPasscode(); }}
            style={{ textAlign: "center", letterSpacing: "0.15em", marginBottom: 8, maxWidth: 280 }}
            autoFocus
          />
          {passcodeError && (
            <div style={{ fontSize: 12, color: "var(--red)", fontWeight: 600, marginBottom: 8 }}>
              {passcodeError}
            </div>
          )}
          <button
            className="btn btn-primary"
            style={{ width: "100%", maxWidth: 280, marginTop: 4, justifyContent: "center" }}
            onClick={verifyPasscode}
          >Unlock</button>
          <a href="/simcha/" style={{
            display: "block", marginTop: 16, fontSize: 12, fontWeight: 600,
            color: "var(--text-muted)", textDecoration: "none",
          }}>← Back to events</a>
        </div>
      </div>
    );
  }


  return (
    <div className="app-shell">
      <ThemeProvider palette={adminConfig?.theme?.palette || "rose"} customColor={adminConfig?.theme?.customColor || ""} />

      {displayState?.archived && (
        <div className="archived-banner">
          🔒 This event is archived and read-only.
          {adminPassword && (
            <button
              onClick={() => setShowAdmin("panel")}
              style={{ marginLeft:12, background:"var(--gold)", color:"white", border:"none",
                borderRadius:"var(--radius-sm)", padding:"3px 12px", fontSize:12,
                fontWeight:700, cursor:"pointer", fontFamily:"var(--font-body)" }}>
              Unarchive
            </button>
          )}
          {!adminPassword && (
            <button
              onClick={() => setShowAdmin(true)}
              style={{ marginLeft:12, background:"var(--gold)", color:"white", border:"none",
                borderRadius:"var(--radius-sm)", padding:"3px 12px", fontSize:12,
                fontWeight:700, cursor:"pointer", fontFamily:"var(--font-body)" }}>
              Admin Login to Unarchive
            </button>
          )}
        </div>
      )}
      <header className={`app-header${headerCollapsed ? " header-collapsed" : ""}`}>
        <div className="header-inner">
          <a href="/simcha/" title="All Events"
            style={{
              display:"flex", alignItems:"center", gap:4,
              fontSize:12, fontWeight:600, color:"var(--text-muted)",
              textDecoration:"none", flexShrink:0,
              padding:"4px 8px", borderRadius:"var(--radius-sm)",
              border:"1px solid var(--border)",
              transition:"all 0.15s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.color="var(--accent-primary)"; e.currentTarget.style.borderColor="var(--accent-primary)"; }}
            onMouseLeave={e => { e.currentTarget.style.color="var(--text-muted)"; e.currentTarget.style.borderColor="var(--border)"; }}
          >← Events</a>
          <div className="header-brand">
            <img src="/simcha/apple-touch-icon.png" alt="SimchaKit" className="header-star" style={{ width: 28, height: 28, borderRadius: 6, display: "block" }} />
            <div>
              <div className="header-title">SimchaKit</div>
            </div>
          </div>
          {adminConfig?.name && (<>
            <div className="header-divider" />
            <div>
              <div className="header-event-name">{adminConfig.name}</div>
              {(adminConfig?.theme?.name) && (
                <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:1 }}>
                  {adminConfig.theme.name}{adminConfig.theme.icon ? ` ${adminConfig.theme.icon}` : ""}
                </div>
              )}
            </div>
          </>)}
          <div className="header-spacer" />
          <div className="header-actions">
            <button className={`icon-btn ${showSearch?"active":""}`}
              title={typeof window !== "undefined" && window.innerWidth < 640 ? "Search" : "Search (⌘K)"}
              onClick={()=>setShowSearch(s=>!s)}>🔍</button>
            <button className={`icon-btn ${adminPassword?"active":""}`} title="Admin Mode"
              onClick={()=>setShowAdmin(true)}>⚙</button>
            {adminPassword && (
              <button className="icon-btn" title="Exit Admin Mode"
                onClick={()=>setAdminPassword(null)}>🔓</button>
            )}
            {/* Day-of Mode — surfaces directly in header on event days */}
            {isTodayEventDay && (
              <button
                className={`icon-btn ${showDayOf?"active":""}`}
                title="Day-of Mode"
                onClick={()=>setShowDayOf(s=>!s)}
                style={{
                  position: "relative",
                  background: showDayOf ? "var(--accent-primary)" : "var(--accent-light)",
                  color: showDayOf ? "white" : "var(--accent-primary)",
                  borderRadius: "var(--radius-sm)",
                }}>
                📋
                <span style={{
                  position: "absolute", top: -4, right: -4,
                  width: 8, height: 8, borderRadius: "50%",
                  background: "var(--green)", border: "2px solid var(--bg-surface)",
                }} />
              </button>
            )}
            <div className="header-overflow-wrap">
              <button className={`icon-btn ${showOverflow?"active":""}`} title="More options"
                onClick={()=>setShowOverflow(s=>!s)}>⋯</button>
              {showOverflow && (
                <div className="header-overflow-menu">
                  <div className="header-overflow-dark">
                    <span className="header-overflow-dark-label">Theme</span>
                    <div className="header-overflow-dark-btns">
                      {[
                        { mode:"light",  icon:"☀",  title:"Light"  },
                        { mode:"dark",   icon:"🌙", title:"Dark"   },
                        { mode:"system", icon:"💻", title:"System" },
                      ].map(({ mode, icon, title }) => (
                        <button key={mode} title={title} onClick={()=>{ setDarkMode(mode); }}
                          style={{
                            width:30, height:30, border:"none", borderRadius:4, cursor:"pointer",
                            fontSize:14, display:"flex", alignItems:"center", justifyContent:"center",
                            transition:"all 0.15s ease",
                            background: darkMode===mode ? "var(--accent-light)" : "var(--bg-subtle)",
                            color: darkMode===mode ? "var(--accent-primary)" : "var(--text-muted)",
                          }}
                        >{icon}</button>
                      ))}
                    </div>
                  </div>
                  <button className="header-overflow-item"
                    onClick={()=>{ setShowWhatsNew(true); setShowOverflow(false); }}>
                    ✨ <span>What's New</span>
                  </button>
                  <button className="header-overflow-item"
                    onClick={()=>{ setShowGuide(true); setShowOverflow(false); }}>
                    📖 <span>SimchaKit Guide</span>
                  </button>
                  {(adminConfig?.timeline||[]).length > 0 && !isTodayEventDay && (
                    <button className={`header-overflow-item ${showDayOf?"active":""}`}
                      onClick={()=>{ setShowDayOf(s=>!s); setShowOverflow(false); }}>
                      📋 <span>Day-of Mode</span>
                    </button>
                  )}
                  <button className="header-overflow-item"
                    onClick={()=>{ setShowActivityLog(true); setShowOverflow(false); }}>
                    📊 <span>Activity Log</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Desktop tab strip ── */}
      <nav className="app-nav">
        <div className="nav-inner" ref={navInnerRef}>
          {tabs.map((tab, idx) => {
            const isOverflow = overflowFromIdx !== null && idx >= overflowFromIdx;
            // If active tab is in overflow, promote it: swap with last visible slot
            const activeInOverflow = overflowFromIdx !== null &&
              tabs.findIndex(t => t.id === activeTab) >= overflowFromIdx;
            const lastVisibleIdx = overflowFromIdx !== null ? overflowFromIdx - 1 : null;
            const isPromoted = activeInOverflow && tab.id === activeTab;
            const isHiddenByPromotion = activeInOverflow &&
              lastVisibleIdx !== null && idx === lastVisibleIdx;
            const hidden = isOverflow && !isPromoted || isHiddenByPromotion;
            return (
              <button key={tab.id}
                className={`nav-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => { setActiveTab(tab.id); setShowNavMore(false); window.scrollTo(0, 0); }}
                style={hidden ? { visibility: "hidden", pointerEvents: "none", position: "absolute" } : {}}>
                <span className="tab-icon">{tab.icon}</span>
                {tab.label}
                {tab.badge != null && tab.badge > 0 && <span className="tab-badge">{tab.badge}</span>}
              </button>
            );
          })}
          {overflowFromIdx !== null && (() => {
            const overflowTabs = tabs.slice(overflowFromIdx).filter(t => t.id !== activeTab);
            if (!overflowTabs.length) return null;
            const overflowIsActive = overflowTabs.some(t => t.id === activeTab);
            const overflowHasBadge = overflowTabs.some(t => t.badge != null && t.badge > 0);
            return (
              <div className="nav-more-wrap">
                <button
                  className={`nav-tab nav-more-btn ${overflowIsActive ? "active" : ""}`}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setNavMoreAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                    setShowNavMore(s => !s);
                  }}>
                  ⋯ More
                  {overflowHasBadge && <span className="tab-badge">!</span>}
                </button>
              </div>
            );
          })()}
        </div>
      </nav>

      {/* ── Nav More dropdown (fixed position to avoid stacking context issues) ── */}
      {showNavMore && overflowFromIdx !== null && navMoreAnchor && (
        <div className="nav-more-menu" style={{
          position: "fixed",
          top: navMoreAnchor.top,
          right: navMoreAnchor.right,
          zIndex: 300,
        }}>
          {tabs.slice(overflowFromIdx).filter(t => t.id !== activeTab).map(tab => (
            <button key={tab.id}
              className={`header-overflow-item ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => { setActiveTab(tab.id); setShowNavMore(false); window.scrollTo(0, 0); }}>
              <span>{tab.icon}</span>
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span className="tab-badge" style={{ marginLeft: "auto" }}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Mobile bottom bar ── */}
      <div className="bottom-nav">
        {bottomBarTabs.map(tab => (
          <button key={tab.id}
            className={`bottom-nav-tab ${activeTab===tab.id ? "active" : ""}`}
            onClick={() => { setActiveTab(tab.id); setShowMoreDrawer(false); window.scrollTo(0,0); }}>
            <span className="bottom-nav-icon">{tab.icon}</span>
            <span className="bottom-nav-label">{tab.label}</span>
            {tab.badge != null && tab.badge > 0 && (
              <span className="bottom-nav-badge">{tab.badge}</span>
            )}
          </button>
        ))}
        <button
          className={`bottom-nav-tab ${moreIsActive || showMoreDrawer ? "active" : ""}`}
          onClick={() => setShowMoreDrawer(s => !s)}>
          <span className="bottom-nav-icon">⋯</span>
          <span className="bottom-nav-label">More</span>
          {moreBadge && !moreIsActive && !showMoreDrawer && (
            <span className="bottom-nav-dot" />
          )}
        </button>
      </div>

      {/* ── More drawer (mobile) ── */}
      {showMoreDrawer && (
        <div className="more-drawer-backdrop" onClick={() => setShowMoreDrawer(false)} />
      )}
      <div className={`more-drawer ${showMoreDrawer ? "open" : ""}`}>
        <div className="more-drawer-header">
          <span className="more-drawer-title">More</span>
          <button className="more-drawer-close" onClick={() => setShowMoreDrawer(false)}>✕</button>
        </div>
        {moreDrawerTabs.map(tab => (
          <button key={tab.id}
            className={`more-drawer-item ${activeTab===tab.id ? "active" : ""}`}
            onClick={() => { setActiveTab(tab.id); setShowMoreDrawer(false); window.scrollTo(0,0); }}>
            <span className="more-drawer-item-icon">{tab.icon}</span>
            <span className="more-drawer-item-label">{tab.label}</span>
            {tab.badge != null && tab.badge > 0 && (
              <span className="more-drawer-item-badge">{tab.badge}</span>
            )}
            <span className="more-drawer-item-chevron">›</span>
          </button>
        ))}
      </div>

      <main className="page-content">
        {activeTab==="overview" && displayState && (
          <OverviewTab state={displayState} updateNotes={updateNotes} setActiveTab={setActiveTab} onOpenAdmin={() => setShowAdmin(true)} onOpenAdminTo={(sec) => { setAdminInitialSection(sec); setShowAdmin(true); }} onOpenGuide={() => setShowGuide(true)} onPrintBrief={() => setBriefHTML(generateEventBriefHTML(displayState, adminConfig))} />
        )}
        {activeTab==="overview" && !displayState && (
          <div style={{textAlign:"center",padding:"80px 24px",color:"var(--text-muted)"}}>
            <img src="/simcha/apple-touch-icon.png" alt="SimchaKit" style={{ width: 48, height: 48, borderRadius: 10, marginBottom: 12 }} />
            <div style={{fontFamily:"var(--font-display)",fontSize:20,marginBottom:8}}>Connecting to server...</div>
            <div style={{fontSize:13}}>Please wait while we load your event data.</div>
          </div>
        )}
        {activeTab==="guests" && displayState && (
          <GuestsTab state={displayState} updateData={updateData} adminConfig={adminConfig} appendAuditLog={appendAuditLog} isArchived={!!displayState?.archived}
            showToast={showToast}
            searchHighlight={searchHighlight} clearSearchHighlight={() => setSearchHighlight(null)} />
        )}
        {activeTab==="accommodations" && displayState && (
          <AccommodationsTab state={displayState} updateData={updateData} adminConfig={adminConfig} setActiveTab={setActiveTab} isArchived={!!displayState?.archived}
            showToast={showToast}
            searchHighlight={searchHighlight} clearSearchHighlight={() => setSearchHighlight(null)} />
        )}
        {activeTab==="budget" && displayState && (
          <BudgetTab state={displayState} updateData={updateData} appendAuditLog={appendAuditLog} isArchived={!!displayState?.archived}
            adminConfig={adminConfig}
            showToast={showToast}
            searchHighlight={searchHighlight} clearSearchHighlight={() => setSearchHighlight(null)} />
        )}
        {activeTab==="vendors" && displayState && (
          <VendorsTab state={displayState} updateData={updateData} appendAuditLog={appendAuditLog} isArchived={!!displayState?.archived}
            showToast={showToast}
            searchHighlight={searchHighlight} clearSearchHighlight={() => setSearchHighlight(null)} />
        )}
        {activeTab==="tasks" && displayState && (
          <TasksTab state={displayState} updateData={updateData} appendAuditLog={appendAuditLog} isArchived={!!displayState?.archived}
            showToast={showToast}
            searchHighlight={searchHighlight} clearSearchHighlight={() => setSearchHighlight(null)}
            setActiveTab={setActiveTab} setSearchHighlight={setSearchHighlight} />
        )}
        {activeTab==="prep" && displayState && (
          <PrepTab state={displayState} updateData={updateData} isArchived={!!displayState?.archived}
            showToast={showToast}
            searchHighlight={searchHighlight} clearSearchHighlight={() => setSearchHighlight(null)} />
        )}
        {activeTab==="seating" && displayState && (
          <SeatingTab state={displayState} updateData={updateData} setActiveTab={setActiveTab} isArchived={!!displayState?.archived}
            showToast={showToast}
            searchHighlight={searchHighlight} clearSearchHighlight={() => setSearchHighlight(null)} />
        )}
        {activeTab==="gifts" && displayState && (
          <GiftsTab state={displayState} updateData={updateData} appendAuditLog={appendAuditLog} isArchived={!!displayState?.archived}
            showToast={showToast}
            searchHighlight={searchHighlight} clearSearchHighlight={() => setSearchHighlight(null)} />
        )}
        {activeTab==="ceremony" && displayState && (
          <CeremonyRolesTab state={displayState} updateData={updateData} isArchived={!!displayState?.archived}
            adminConfig={adminConfig}
            showToast={showToast} />
        )}
        {activeTab==="favors" && displayState && (
          <FavorsTab state={displayState} updateData={updateData} setActiveTab={setActiveTab} isArchived={!!displayState?.archived}
            adminConfig={adminConfig}
            showToast={showToast}
            searchHighlight={searchHighlight} clearSearchHighlight={() => setSearchHighlight(null)} />
        )}
        {activeTab==="calendar" && displayState && (
          <CalendarTab state={displayState} adminConfig={adminConfig} setActiveTab={setActiveTab} isArchived={!!displayState?.archived}
            calendarView={calendarView} setCalendarView={setCalendarView}
            searchHighlight={searchHighlight} clearSearchHighlight={() => setSearchHighlight(null)}
            onNavigateToSource={(tab, itemId, collection) => {
              setActiveTab(tab);
              setSearchHighlight({ tab, itemId, collection, householdId: null });
            }} />
        )}
        {activeTab!=="overview" && activeTab!=="guests" && activeTab!=="accommodations" && activeTab!=="budget" && activeTab!=="vendors" && activeTab!=="tasks" && activeTab!=="prep" && activeTab!=="ceremony" && activeTab!=="seating" && activeTab!=="gifts" && activeTab!=="favors" && activeTab!=="calendar" && PLACEHOLDERS[activeTab] && (
          <PlaceholderTab {...PLACEHOLDERS[activeTab]} />
        )}
      </main>

      <footer className="app-footer">
        <span style={{ fontSize:11, color:"var(--text-muted)" }}>
          Designed & Built by <a href="mailto:support@brook-creative.com" className="footer-link">Ryan Brook</a>
        </span>
        <span>·</span>
        <span style={{ fontSize:11, color:"var(--text-muted)" }}>Powered by Claude</span>
        <span>·</span>
        <span className="footer-event-id">Event ID: {EVENT_ID}</span>
        <span>·</span>
        <a href="https://github.com/rebrook/simchakit" target="_blank" rel="noopener" className="footer-link">GitHub</a>
        {adminPassword && (<>
          <span>·</span>
          <a href="/logs" target="_blank" rel="noopener" className="footer-link">Server Logs</a>
        </>)}
        <span>·</span>
        <button onClick={()=>setShowWhatsNew(true)}
          style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",fontSize:11,fontFamily:"var(--font-body)"}}>
          {appVersion || "—"}
        </button>
        <span>·</span>
        <div className="footer-sync" title={
          syncStatus === "disconnected"
            ? "You are offline — changes will sync automatically when your connection is restored."
            : queueSize > 0
              ? `${queueSize} save(s) queued — will sync when reconnected`
              : lastSavedAt
                ? `Last saved ${new Date(lastSavedAt).toLocaleTimeString()}`
                : ""
        }>
          <div className={`sync-dot ${syncStatus}`} />
          {syncStatus === "connected"    && queueSize === 0 && savedLabel && <span>{savedLabel.desktop}</span>}
          {syncStatus === "connected"    && queueSize === 0 && !savedLabel  && <span>Live</span>}
          {syncStatus === "connected"    && queueSize > 0                   && <span>Syncing...</span>}
          {syncStatus === "connecting"                                       && <span>Connecting</span>}
          {syncStatus === "disconnected" && queueSize === 0                 && <span>Offline</span>}
          {syncStatus === "disconnected" && queueSize > 0                   && <span style={{ color:"var(--gold)" }}>⏳ {queueSize} pending</span>}
        </div>
      </footer>

      {showAdmin && !adminPassword && (
        <AdminLogin eventId={EVENT_ID}
          onSuccess={pw=>{setAdminPassword(pw);setShowAdmin(false);setShowAdmin("panel");}}
          onClose={()=>setShowAdmin(false)} />
      )}
      {showAdmin==="panel" && adminPassword && (
        <AdminPanel eventId={EVENT_ID} password={adminPassword} config={adminConfig} state={displayState}
          appVersion={appVersion} initialSection={adminInitialSection}
          onClose={()=>{ setShowAdmin(false); setAdminInitialSection("event"); }} onConfigSaved={cfg=>setAdminConfig(cfg)}
          onResetCollection={(col, val) => updateData(col, val)}
          onResetNotes={() => updateNotes("")} />
      )}
      {showAdmin && adminPassword && showAdmin!=="panel" && (
        <AdminPanel eventId={EVENT_ID} password={adminPassword} config={adminConfig} state={displayState}
          appVersion={appVersion} initialSection={adminInitialSection}
          onClose={()=>{ setShowAdmin(false); setAdminInitialSection("event"); }} onConfigSaved={cfg=>setAdminConfig(cfg)}
          onResetCollection={(col, val) => updateData(col, val)}
          onResetNotes={() => updateNotes("")} />
      )}

      {showWhatsNew    && <WhatsNewModal    onClose={()=>setShowWhatsNew(false)}    />}
      {showGuide       && <GuideModal       onClose={()=>setShowGuide(false)}       />}
      {showActivityLog  && <ActivityLogModal
          auditLog={displayState?.auditLog || []}
          isArchived={!!displayState?.archived}
          onClear={()=>{ updateData("auditLog", []); }}
          onClose={()=>setShowActivityLog(false)}
        />}
      {showDayOf    && displayState && (
        <DayOfOverlay
          state={displayState}
          adminConfig={adminConfig}
          updateData={updateData}
          updateNotes={updateNotes}
          onClose={() => setShowDayOf(false)}
          onPrintBrief={() => setBriefHTML(generateEventBriefHTML(displayState, adminConfig))}
        />
      )}
      {showSearch && displayState && (
        <SearchOverlay
          state={displayState}
          onNavigate={(tab, itemId, collection, householdId) => {
            setActiveTab(tab);
            setSearchHighlight({ tab, itemId, collection, householdId: householdId || null });
          }}
          onClose={() => setShowSearch(false)}
        />
      )}
      {briefHTML && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) { setBriefHTML(null); } }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--bg-surface)", borderRadius: "var(--radius-lg)",
            width: "95%", maxWidth: 960, height: "90vh",
            display: "flex", flexDirection: "column",
            boxShadow: "var(--shadow-lg)",
          }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
              padding:"14px 20px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
              <div style={{ fontFamily:"var(--font-display)", fontSize:17, fontWeight:700,
                color:"var(--text-primary)" }}>Print Preview — Event Brief</div>
              <div style={{ display:"flex", gap:8 }}>
                <button className="btn btn-primary" style={{ fontSize:12 }}
                  onClick={() => { const f = document.getElementById("brief-print-frame"); if (f?.contentWindow) f.contentWindow.print(); }}>
                  🖨 Print / Save PDF
                </button>
                <button className="icon-btn" title="Close" onClick={() => setBriefHTML(null)}>✕</button>
              </div>
            </div>
            <iframe id="brief-print-frame" srcDoc={briefHTML}
              style={{ flex:1, border:"none", borderRadius:"0 0 var(--radius-lg) var(--radius-lg)" }}
              title="Event Brief Print Preview" />
          </div>
        </div>
      )}
      {/* ── Toast notification ── */}
      <div style={{
        position: "fixed",
        bottom: typeof window !== "undefined" && window.innerWidth < 640 ? 88 : 24,
        left: "50%",
        background: "var(--text-primary)",
        color: "var(--bg-surface)",
        padding: "10px 20px",
        borderRadius: "var(--radius-md)",
        fontSize: 13,
        fontWeight: 600,
        fontFamily: "var(--font-body)",
        boxShadow: "var(--shadow-lg)",
        zIndex: 9999,
        whiteSpace: "nowrap",
        pointerEvents: "none",
        transition: "opacity 0.2s ease, transform 0.2s ease",
        opacity: toastVisible ? 1 : 0,
        transform: toastVisible ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(8px)",
      }}>
        ✓ {toastMsg}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────────────────────────
