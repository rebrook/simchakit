// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 - AppShell.jsx
// Full app shell rendered after an event is selected.
// Loads event from Supabase, provides nav, header, tab routing, mobile nav.
// Phase 5: shell + nav + stubs. Phase 6 will fill tabs with real data.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase }        from "@/lib/supabase.js";
import { useDarkMode }     from "@/hooks/useDarkMode.js";
import { useCollaboratorRole } from "@/hooks/useCollaboratorRole.js";
import { ThemeProvider }   from "@/components/shared/ThemeProvider.jsx";
import { PlaceholderTab }  from "@/components/shared/PlaceholderTab.jsx";
import { AdminLogin, AdminPanel } from "@/components/AdminPanel.jsx";
import { SearchOverlay }         from "@/components/SearchOverlay.jsx";
import { GuideModal, ActivityLogModal, WhatsNewModal } from "@/components/Modals.jsx";
import { DayOfOverlay }          from "@/components/DayOfOverlay.jsx";
import { Icon }                  from "@/utils/iconMap.js";

// ── Tab components (stubs in Phase 5, filled in Phase 6) ─────────────────────
import { OverviewTab }        from "@/components/tabs/OverviewTab.jsx";
import { GuestsTab }          from "@/components/tabs/GuestsTab.jsx";
import { BudgetTab }          from "@/components/tabs/BudgetTab.jsx";
import { VendorsTab }         from "@/components/tabs/VendorsTab.jsx";
import { TasksTab }           from "@/components/tabs/TasksTab.jsx";
import { PrepTab }            from "@/components/tabs/PrepTab.jsx";
import { CeremonyRolesTab }   from "@/components/tabs/CeremonyRolesTab.jsx";
import { SeatingTab }         from "@/components/tabs/SeatingTab.jsx";
import { GiftsTab }           from "@/components/tabs/GiftsTab.jsx";
import { AccommodationsTab }  from "@/components/tabs/AccommodationsTab.jsx";
import { FavorsTab }          from "@/components/tabs/FavorsTab.jsx";
import { CalendarTab }        from "@/components/tabs/CalendarTab.jsx";

// ── Event type icons (mirrors V2 constants/events.js) ────────────────────────
const EVENT_TYPE_ICONS = {
  "bat-mitzvah":  "✡",
  "bar-mitzvah":  "✡",
  "bnei-mitzvah": "✡",
  "wedding":      "💍",
  "baby-naming":  "👶",
  "graduation":   "🎓",
  "anniversary":  "🥂",
  "birthday":     "🎂",
  "other":        "🎉",
};

// ── Bottom bar tab IDs (fixed, matches V2 exactly) ───────────────────────────
const BOTTOM_BAR_IDS = ["overview", "guests", "budget", "vendors", "tasks"];

// ─────────────────────────────────────────────────────────────────────────────
import { displayNameWithEmail } from "@/utils/displayName.js";

export function AppShell({ session, eventId, onBack, isDemoMode = false, displayName: userDisplayName = null }) {
  const [activeTab,       setActiveTab]       = useState("overview");
  const [event,           setEvent]           = useState(null);   // raw events row
  const [adminConfig,     setAdminConfig]     = useState(null);   // events.admin_config
  const [loadStatus,      setLoadStatus]      = useState("loading");
  const [showOverflow,    setShowOverflow]    = useState(false);
  const [showMoreDrawer,  setShowMoreDrawer]  = useState(false);
  const [showNavMore,     setShowNavMore]     = useState(false);
  const [navMoreAnchor,   setNavMoreAnchor]   = useState(null);
  const [overflowFromIdx, setOverflowFromIdx] = useState(null);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [toastMsg,        setToastMsg]        = useState("");
  const [toastVisible,    setToastVisible]    = useState(false);
  const [darkMode,        setDarkMode]        = useDarkMode();

  // ── Collaborator role (null until event loads; 'owner' | 'editor' | 'viewer') ──
  const collaboratorRole = useCollaboratorRole(
    event?.owner_id ?? null,
    eventId,
    session?.user?.id ?? null
  );

  // ── Admin state ───────────────────────────────────────────────────────────
  const [showAdminLogin,  setShowAdminLogin]  = useState(false);
  const [showAdminPanel,  setShowAdminPanel]  = useState(false);
  const [adminPassword,   setAdminPassword]   = useState(null);
  const [adminSection,    setAdminSection]    = useState("event");

  // ── Overlay state ─────────────────────────────────────────────────────────
  const [showSearch,      setShowSearch]      = useState(false);
  const [showGuide,       setShowGuide]       = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [showWhatsNew,    setShowWhatsNew]    = useState(false);
  const [showDayOf,       setShowDayOf]       = useState(false);
  const [searchHighlight, setSearchHighlight] = useState(null); // { tab, itemId, collection, householdId }

  const navInnerRef = useRef(null);
  const toastTimer  = useRef(null);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = useCallback((message) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(message);
    setToastVisible(true);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2500);
  }, []);

  // ── Listen for audit log write failures from useEventData ─────────────────
  useEffect(() => {
    const handler = () => showToast("Activity log entry could not be saved");
    window.addEventListener("simchakit:audit-error", handler);
    return () => window.removeEventListener("simchakit:audit-error", handler);
  }, [showToast]);

  // ── Load event from Supabase ──────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      let query = supabase
        .from("events")
        .select("id, name, type, archived, admin_config, quick_notes, calendar_token, owner_id")
        .eq("id", eventId);

      // RLS handles access control. No owner_id filter needed here.
      // Collaborators have access via the "Collaborator can read event" SELECT policy.
      // Demo mode uses the anon key which has its own scoped policy.

      const { data, error } = await query.single();

      if (error || !data) {
        setLoadStatus("error");
        return;
      }

      setEvent(data);
      // Seed name/type into adminConfig from top-level columns if not already in jsonb
      const cfg = data.admin_config || {};
      setAdminConfig({
        ...cfg,
        name: cfg.name || data.name || "",
        type: cfg.type || data.type || "other",
      });
      setLoadStatus("ready");
    }
    load();
  }, [eventId, session?.user?.id]);

  // ── Coordinators may only view Ceremony and Prep. The default activeTab is
  // "overview", which they cannot access, so redirect to "ceremony" once the
  // role resolves if the current tab is not one of the two permitted tabs. ──
  useEffect(() => {
    if (collaboratorRole === "coordinator" && activeTab !== "ceremony" && activeTab !== "prep") {
      setActiveTab("ceremony");
    }
  }, [collaboratorRole, activeTab]);

  // ── Mobile header collapse on scroll ─────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth >= 640) return;
    let lastY = window.scrollY;
    let rafId = null;
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y > lastY && y > 60)      setHeaderCollapsed(true);
        else if (y < lastY)           setHeaderCollapsed(false);
        lastY = y;
        rafId = null;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (rafId) cancelAnimationFrame(rafId); };
  }, []);

  // ── ⌘K / Ctrl+K search shortcut (wired up in Phase 6) ────────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Close overflow menu on outside click ─────────────────────────────────
  useEffect(() => {
    if (!showOverflow) return;
    const handler = (e) => { if (!e.target.closest(".header-overflow-wrap")) setShowOverflow(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, [showOverflow]);

  // ── Close nav More dropdown on outside click ──────────────────────────────
  useEffect(() => {
    if (!showNavMore) return;
    const handler = (e) => {
      if (!e.target.closest(".nav-more-wrap") && !e.target.closest(".nav-more-menu")) setShowNavMore(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, [showNavMore]);

  // ── Close More drawer on Escape ───────────────────────────────────────────
  useEffect(() => {
    if (!showMoreDrawer) return;
    const handler = (e) => { if (e.key === "Escape") setShowMoreDrawer(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showMoreDrawer]);

  // ── ResizeObserver: compute nav overflow index ────────────────────────────
  useEffect(() => {
    const el = navInnerRef.current;
    if (!el) return;
    const compute = () => {
      const children = Array.from(el.children).filter(c => c.classList.contains("nav-tab"));
      if (!children.length) return;
      const available = el.clientWidth - 92; // reserve ~88px for More button
      let total = 0;
      let cutoff = null;
      for (let i = 0; i < children.length; i++) {
        total += children[i].offsetWidth + 2;
        if (total > available && cutoff === null) cutoff = i;
      }
      setOverflowFromIdx(cutoff);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loadStatus]); // re-run when tabs become available

  // ── Build tab list from adminConfig.visibleTabs ───────────────────────────
  const ALL_TABS = [
    { id: "overview",       icon: "overview",       label: "Overview"      },
    { id: "guests",         icon: "guests",         label: "Guests"        },
    { id: "budget",         icon: "budget",         label: "Budget"        },
    { id: "vendors",        icon: "vendors",        label: "Vendors"       },
    { id: "tasks",          icon: "tasks",          label: "Tasks"         },
    { id: "prep",           icon: "prep",           label: "Prep"          },
    { id: "ceremony",       icon: "ceremony",       label: "Ceremony"      },
    { id: "seating",        icon: "seating",        label: "Seating"       },
    { id: "gifts",          icon: "gifts",          label: "Gifts"         },
    { id: "accommodations", icon: "accommodations", label: "Stay & Travel" },
    { id: "favors",         icon: "favors",         label: "Favors"        },
    { id: "calendar",       icon: "calendar",       label: "Calendar"      },
  ];

  const visibleTabIds = adminConfig?.visibleTabs;
  let tabs = (visibleTabIds && visibleTabIds.length > 0)
    ? ALL_TABS.filter(t => t.id === "overview" || visibleTabIds.includes(t.id))
    : ALL_TABS;

  // Ritual Coordinators see only Ceremony and Prep. Applied only once the
  // role has resolved to "coordinator" (never while null/loading), so owner and
  // editor/viewer tab sets are never affected.
  const isCoordinator = collaboratorRole === "coordinator";
  if (isCoordinator) {
    tabs = ALL_TABS.filter(t => t.id === "ceremony" || t.id === "prep");
  }

  const bottomBarTabs  = tabs.filter(t => BOTTOM_BAR_IDS.includes(t.id));
  const moreDrawerTabs = tabs.filter(t => !BOTTOM_BAR_IDS.includes(t.id));
  const moreIsActive   = moreDrawerTabs.some(t => t.id === activeTab);

  // ── Navigate to tab ───────────────────────────────────────────────────────
  const navigateTo = (tabId) => {
    setActiveTab(tabId);
    setShowMoreDrawer(false);
    setShowNavMore(false);
    window.scrollTo(0, 0);
  };

  // ── Palette from adminConfig ──────────────────────────────────────────────
  const palette     = adminConfig?.theme?.palette     || "rose";
  const customColor = adminConfig?.theme?.customColor || "";

  // ── Loading / error states ────────────────────────────────────────────────
  if (loadStatus === "loading") {
    return (
      <div className="app-shell">
        <ThemeProvider palette="rose" customColor="" />
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", gap:16 }}>
          <img src="/apple-touch-icon.png" alt="SimchaKit" style={{ width: 48, height: 48, borderRadius: 10 }} />
          <div style={{ fontFamily:"var(--font-display)", fontSize:20, color:"var(--text-primary)" }}>Loading…</div>
          <div style={{ fontSize:13, color:"var(--text-muted)" }}>Connecting to SimchaKit</div>
        </div>
      </div>
    );
  }

  if (loadStatus === "error") {
    return (
      <div className="app-shell">
        <ThemeProvider palette="rose" customColor="" />
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", gap:16, padding:24, textAlign:"center" }}>
          <div style={{ fontSize:40 }}><Icon name="alertTriangle" context="empty" /></div>
          <div style={{ fontFamily:"var(--font-display)", fontSize:20, color:"var(--text-primary)" }}>Could not load event</div>
          <div style={{ fontSize:13, color:"var(--text-muted)" }}>Check your connection or go back and try again.</div>
          <button className="btn btn-secondary" onClick={onBack}><Icon name="arrowLeft" context="inline" style={{ marginRight: 4 }} /> Back to Events</button>
        </div>
      </div>
    );
  }

  // ── Open admin (from gear button or tab callbacks) ────────────────────────
  const openAdmin = (section = "event") => {
    // Only the event owner can access Admin Mode
    if (collaboratorRole !== null && collaboratorRole !== "owner") {
      showToast("Admin Mode is only available to the event owner");
      return;
    }
    setAdminSection(section);
    if (adminPassword) { setShowAdminPanel(true); }
    else               { setShowAdminLogin(true); }
  };

  const onAdminLoginSuccess = (pwd) => {
    setAdminPassword(pwd);
    setShowAdminLogin(false);
    setShowAdminPanel(true);
  };

  const onConfigSaved = (newConfig) => {
    setAdminConfig(newConfig);
    // Also refresh event row so name/type stay in sync
    setEvent(ev => ev ? { ...ev, name: newConfig.name || ev.name, type: newConfig.type || ev.type, admin_config: newConfig } : ev);
    showToast("Configuration saved");
  };

  // Clergy/tutor update from PrepTab (owners + coordinators via /api/update-clergy)
  const onClergyUpdated = (clergyData) => {
    setAdminConfig(prev => {
      const updated = { ...prev, ...clergyData };
      setEvent(ev => ev ? { ...ev, admin_config: updated } : ev);
      return updated;
    });
  };

  // ── Shared props passed to every tab ─────────────────────────────────────
  const tabProps = {
    eventId,
    event,
    adminConfig,
    showToast,
    isArchived:    !!(event?.archived),
    collaboratorRole,
    isViewer:      collaboratorRole === "viewer",
    setActiveTab:  navigateTo,
    onOpenAdmin:   () => openAdmin("event"),
    onOpenAdminTo: openAdmin,
    onOpenGuide:          () => setShowGuide(true),
    onConfigSaved,
    onClergyUpdated,
    searchHighlight,
    clearSearchHighlight: () => setSearchHighlight(null),
    setSearchHighlight,
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      <ThemeProvider palette={palette} customColor={customColor} />

      {/* ── Demo banner ── */}
      {isDemoMode && (
        <div className="archived-banner" style={{
          background: "var(--accent-primary)",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          flexWrap: "wrap",
        }}>
          <span><Icon name="clipboardList" context="inline" style={{ marginRight: 6 }} />You're viewing the SimchaKit demo · Data resets nightly</span>
          <a href="https://app.simcha-kit.com" style={{
            color: "white",
            fontWeight: 700,
            textDecoration: "underline",
            whiteSpace: "nowrap",
          }}>Create your account</a>
        </div>
      )}

      {/* ── Archived banner ── */}
      {event?.archived && (
        <div className="archived-banner">
          <Icon name="lock" context="inline" style={{ marginRight: 6 }} /> This event is archived and read-only.
        </div>
      )}

      {/* ── Header ── */}
      <header className={`app-header${headerCollapsed ? " header-collapsed" : ""}`}>
        <div className="header-inner">

          {/* ← Events */}
          <button
            onClick={onBack}
            style={{
              display:"flex", alignItems:"center", gap:4,
              fontSize:12, fontWeight:600, color:"var(--text-muted)",
              background:"none", cursor:"pointer", flexShrink:0,
              padding:"4px 8px", borderRadius:"var(--radius-sm)",
              border:"1px solid var(--border)", fontFamily:"var(--font-body)",
              transition:"all 0.15s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.color="var(--accent-primary)"; e.currentTarget.style.borderColor="var(--accent-primary)"; }}
            onMouseLeave={e => { e.currentTarget.style.color="var(--text-muted)"; e.currentTarget.style.borderColor="var(--border)"; }}
          ><Icon name="arrowLeft" context="inline" style={{ marginRight: 2 }} /> Events</button>

          {/* Brand */}
          <div className="header-brand">
            <img src="/apple-touch-icon.png" alt="SimchaKit" className="header-star" style={{ width: 40, height: 40, borderRadius: 8, display: "block" }} />
            <div>
              <div className="header-title">SimchaKit</div>
            </div>
          </div>

          {/* Event name + theme */}
          {adminConfig?.name && (<>
            <div className="header-divider" />
            <div>
              <div className="header-event-name">{adminConfig.name}</div>
              {adminConfig?.theme?.name && (
                <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:1 }}>
                  {adminConfig.theme.name}{adminConfig.theme.icon ? ` ${adminConfig.theme.icon}` : ""}
                </div>
              )}
            </div>
          </>)}

          <div className="header-spacer" />

          {/* Collaborator role badge -- visible to editors and viewers only */}
          {collaboratorRole && collaboratorRole !== "owner" && (
            <div style={{
              display:      "inline-flex",
              alignItems:   "center",
              gap:          4,
              padding:      "3px 10px",
              borderRadius: "var(--radius-pill, 999px)",
              background:   "var(--accent-light)",
              border:       "1px solid var(--accent-primary)",
              fontSize:     11,
              fontWeight:   600,
              color:        "var(--accent-primary)",
              flexShrink:   0,
              whiteSpace:   "nowrap",
            }}>
              {collaboratorRole === "editor"      ? <><Icon name="pencil" context="badge" /> Editor</>
               : collaboratorRole === "coordinator" ? <><Icon name="ceremony" context="badge" /> Coordinator</>
               : <><Icon name="eye" context="badge" /> Viewer</>}
            </div>
          )}

          {/* Header actions */}
          <div className="header-actions">
            {/* Search */}
            <button className="icon-btn" title="Search (⌘K)" onClick={() => setShowSearch(true)}>
              <Icon name="search" context="button" />
            </button>

            {/* Admin Mode */}
            <button className="icon-btn" title="Admin Mode" onClick={() => openAdmin("event")}>
              <Icon name="settings" context="button" />
            </button>

            {/* Overflow menu */}
            <div className="header-overflow-wrap">
              <button
                className={`icon-btn ${showOverflow ? "active" : ""}`}
                title="More options"
                onClick={() => setShowOverflow(s => !s)}
              ><Icon name="moreHorizontal" context="button" /></button>

              {showOverflow && (
                <div className="header-overflow-menu">
                  {/* Theme switcher */}
                  <div className="header-overflow-dark">
                    <span className="header-overflow-dark-label">Theme</span>
                    <div className="header-overflow-dark-btns">
                      {[
                        { mode:"light",  icon:"sun",     title:"Light"  },
                        { mode:"dark",   icon:"moon",    title:"Dark"   },
                        { mode:"system", icon:"monitor", title:"System" },
                      ].map(({ mode, icon, title }) => (
                        <button key={mode} title={title}
                          onClick={() => setDarkMode(mode)}
                          style={{
                            width:30, height:30, border:"none", borderRadius:4,
                            cursor:"pointer", fontSize:14, display:"flex",
                            alignItems:"center", justifyContent:"center",
                            transition:"all 0.15s ease",
                            background: darkMode === mode ? "var(--accent-light)" : "var(--bg-subtle)",
                            color:      darkMode === mode ? "var(--accent-primary)" : "var(--text-muted)",
                          }}
                        >{<Icon name={icon} context="inline" />}</button>
                      ))}
                    </div>
                  </div>

                  <button className="header-overflow-item"
                    onClick={() => { setShowOverflow(false); setShowGuide(true); }}>
                    <Icon name="bookOpen" context="menu" /> <span>Guide</span>
                  </button>

                  <button className="header-overflow-item"
                    onClick={() => { setShowOverflow(false); setShowWhatsNew(true); }}>
                    <Icon name="sparkles" context="menu" /> <span>What's New</span>
                  </button>

                  {!isCoordinator && (
                    <button className="header-overflow-item"
                      onClick={() => { setShowOverflow(false); setShowDayOf(true); }}>
                      <Icon name="clipboardList" context="menu" /> <span>Day-of Mode</span>
                    </button>
                  )}

                  {!isCoordinator && (
                    <button className="header-overflow-item"
                      onClick={() => { setShowOverflow(false); setShowActivityLog(true); }}>
                      <Icon name="barChart3" context="menu" /> <span>Activity Log</span>
                    </button>
                  )}

                  <button className="header-overflow-item"
                    onClick={() => { setShowOverflow(false); onBack(); }}>
                    <Icon name="arrowLeft" context="menu" /> <span>Back to Events</span>
                  </button>

                  <button className="header-overflow-item"
                    onClick={() => { setShowOverflow(false); supabase.auth.signOut(); }}>
                    <Icon name="logOut" context="menu" /> <span>Sign out</span>
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
            const activeInOverflow = overflowFromIdx !== null &&
              tabs.findIndex(t => t.id === activeTab) >= overflowFromIdx;
            const lastVisibleIdx = overflowFromIdx !== null ? overflowFromIdx - 1 : null;
            const isPromoted        = activeInOverflow && tab.id === activeTab;
            const isHiddenByPromotion = activeInOverflow && lastVisibleIdx !== null && idx === lastVisibleIdx;
            const hidden = (isOverflow && !isPromoted) || isHiddenByPromotion;

            return (
              <button key={tab.id}
                className={`nav-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => navigateTo(tab.id)}
                style={hidden ? { visibility:"hidden", pointerEvents:"none", position:"absolute" } : {}}
              >
                <span className="tab-icon"><Icon name={tab.icon} context="nav" /></span>
                {tab.label}
                {tab.badge != null && tab.badge > 0 && (
                  <span className="tab-badge">{tab.badge}</span>
                )}
              </button>
            );
          })}

          {/* Desktop More dropdown trigger */}
          {overflowFromIdx !== null && (() => {
            const overflowTabs   = tabs.slice(overflowFromIdx).filter(t => t.id !== activeTab);
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
                  }}
                >
                  <Icon name="moreHorizontal" context="nav" /> More
                  {overflowHasBadge && <span className="tab-badge">!</span>}
                </button>
              </div>
            );
          })()}
        </div>
      </nav>

      {/* ── Desktop nav More dropdown (fixed position) ── */}
      {showNavMore && overflowFromIdx !== null && navMoreAnchor && (
        <div className="nav-more-menu" style={{
          position: "fixed",
          top:   navMoreAnchor.top,
          right: navMoreAnchor.right,
          zIndex: 300,
        }}>
          {tabs.slice(overflowFromIdx).filter(t => t.id !== activeTab).map(tab => (
            <button key={tab.id}
              className={`header-overflow-item ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => navigateTo(tab.id)}
            >
              <span><Icon name={tab.icon} context="menu" /></span>
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span className="tab-badge" style={{ marginLeft:"auto" }}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Page content ── */}
      <main className="page-content">
        {/* Viewer read-only banner */}
        {collaboratorRole === "viewer" && (
          <div style={{
            background:   "var(--accent-light)",
            borderBottom: "1px solid var(--accent-primary)",
            padding:      "8px 20px",
            fontSize:     12,
            color:        "var(--accent-primary)",
            fontWeight:   600,
            textAlign:    "center",
          }}>
            <Icon name="eye" context="inline" /> You have view-only access to this event.
          </div>
        )}
        {/* Coordinator scoped-access banner */}
        {collaboratorRole === "coordinator" && (
          <div style={{
            background:   "var(--accent-light)",
            borderBottom: "1px solid var(--accent-primary)",
            padding:      "8px 20px",
            fontSize:     12,
            color:        "var(--accent-primary)",
            fontWeight:   600,
            textAlign:    "center",
          }}>
            <Icon name="ceremony" context="inline" /> As Ritual Coordinator, you can view and edit Ceremony and Prep for this event.
          </div>
        )}
        {activeTab === "overview"       && <OverviewTab       {...tabProps} />}
        {activeTab === "guests"         && <GuestsTab         {...tabProps} />}
        {activeTab === "budget"         && <BudgetTab         {...tabProps} />}
        {activeTab === "vendors"        && <VendorsTab        {...tabProps} />}
        {activeTab === "tasks"          && <TasksTab          {...tabProps} />}
        {activeTab === "prep"           && <PrepTab           {...tabProps} />}
        {activeTab === "ceremony"       && <CeremonyRolesTab  {...tabProps} />}
        {activeTab === "seating"        && <SeatingTab        {...tabProps} />}
        {activeTab === "gifts"          && <GiftsTab          {...tabProps} />}
        {activeTab === "accommodations" && <AccommodationsTab {...tabProps} />}
        {activeTab === "favors"         && <FavorsTab         {...tabProps} />}
        {activeTab === "calendar"       && <CalendarTab       {...tabProps} />}
      </main>

      {/* ── Footer ── */}
      <footer className="app-footer">
        <span style={{ fontSize:11, color:"var(--text-muted)" }}>
          Designed &amp; Built by{" "}
          <a href="mailto:hello@simcha-kit.com" className="footer-link">Brook Creative LLC</a>
        </span>
        <span>·</span>
        <span style={{ fontSize:11, color:"var(--text-muted)" }}>Powered by Claude</span>
        <span>·</span>
        <a href="https://about.simcha-kit.com" target="_blank" rel="noopener" className="footer-link" style={{ fontSize:11 }}>about.simcha-kit.com</a>
        <span>·</span>
        <span className="footer-event-id" style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"monospace" }}>
          {eventId}
        </span>
        {session?.user?.email && (
          <>
            <span>·</span>
            <span style={{ fontSize:11, color:"var(--text-muted)" }}>
              {displayNameWithEmail(userDisplayName, session.user.email)}
            </span>
          </>
        )}
        <span>·</span>
        <div className="footer-sync" title="Sync status">
          <div className="sync-dot connected" />
          <span>Supabase</span>
        </div>
      </footer>

      {/* ── Mobile bottom bar ── */}
      <div className="bottom-nav">
        {bottomBarTabs.map(tab => (
          <button key={tab.id}
            className={`bottom-nav-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => navigateTo(tab.id)}
          >
            <span className="bottom-nav-icon"><Icon name={tab.icon} context="navMobile" /></span>
            <span className="bottom-nav-label">{tab.label}</span>
            {tab.badge != null && tab.badge > 0 && (
              <span className="bottom-nav-badge">{tab.badge}</span>
            )}
          </button>
        ))}
        <button
          className={`bottom-nav-tab ${moreIsActive || showMoreDrawer ? "active" : ""}`}
          onClick={() => setShowMoreDrawer(s => !s)}
        >
          <span className="bottom-nav-icon"><Icon name="moreHorizontal" context="navMobile" /></span>
          <span className="bottom-nav-label">More</span>
        </button>
      </div>

      {/* ── More drawer backdrop ── */}
      {showMoreDrawer && (
        <div className="more-drawer-backdrop" onClick={() => setShowMoreDrawer(false)} />
      )}

      {/* ── More drawer ── */}
      <div className={`more-drawer ${showMoreDrawer ? "open" : ""}`}>
        <div className="more-drawer-header">
          <span className="more-drawer-title">More</span>
          <button className="more-drawer-close" onClick={() => setShowMoreDrawer(false)}><Icon name="x" context="button" /></button>
        </div>
        {moreDrawerTabs.map(tab => (
          <button key={tab.id}
            className={`more-drawer-item ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => navigateTo(tab.id)}
          >
            <span className="more-drawer-item-icon"><Icon name={tab.icon} context="menu" /></span>
            <span className="more-drawer-item-label">{tab.label}</span>
            {tab.badge != null && tab.badge > 0 && (
              <span className="more-drawer-item-badge">{tab.badge}</span>
            )}
            <span className="more-drawer-item-chevron"><Icon name="chevronRight" context="inline" /></span>
          </button>
        ))}
      </div>

      {/* ── Search Overlay ── */}
      {showSearch && (
        <SearchOverlay
          eventId={eventId}
          adminConfig={adminConfig}
          onNavigate={(tab, id, collection, householdId) => {
            setShowSearch(false);
            navigateTo(tab);
            setTimeout(() => {
              setSearchHighlight({ tab, itemId: id, collection, householdId: householdId || null });
            }, 150);
          }}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* ── Guide Modal ── */}
      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}

      {/* ── What's New Modal ── */}
      {showWhatsNew && <WhatsNewModal onClose={() => setShowWhatsNew(false)} />}

      {/* ── Activity Log Modal ── */}
      {showActivityLog && (
        <ActivityLogModal
          eventId={eventId}
          isArchived={!!(event?.archived)}
          onClose={() => setShowActivityLog(false)}
        />
      )}

      {/* ── Day-of Overlay ── */}
      {showDayOf && (
        <DayOfOverlay
          eventId={eventId}
          event={event}
          adminConfig={adminConfig}
          onClose={() => setShowDayOf(false)}
          onPrintBrief={() => showToast("Print brief coming soon")}
        />
      )}

      {/* ── Admin Login ── */}
      {showAdminLogin && (
        <AdminLogin
          eventId={eventId}
          onSuccess={onAdminLoginSuccess}
          onClose={() => setShowAdminLogin(false)}
        />
      )}

      {/* ── Admin Panel ── */}
      {showAdminPanel && (
        <AdminPanel
          eventId={eventId}
          userId={session?.user?.id}
          calendarToken={event?.calendar_token}
          password={adminPassword}
          config={adminConfig}
          onClose={() => setShowAdminPanel(false)}
          onConfigSaved={onConfigSaved}
          initialSection={adminSection}
        />
      )}

      {/* ── Toast ── */}
      <div style={{
        position:   "fixed",
        bottom:     typeof window !== "undefined" && window.innerWidth < 640 ? 88 : 24,
        left:       "50%",
        background: "var(--text-primary)",
        color:      "var(--bg-surface)",
        padding:    "10px 20px",
        borderRadius: "var(--radius-md)",
        fontSize:   13,
        fontWeight: 600,
        fontFamily: "var(--font-body)",
        boxShadow:  "var(--shadow-lg)",
        zIndex:     9999,
        whiteSpace: "nowrap",
        pointerEvents: "none",
        transition: "opacity 0.2s ease, transform 0.2s ease",
        opacity:    toastVisible ? 1 : 0,
        transform:  toastVisible ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(8px)",
      }}>
        <Icon name="check" context="inline" style={{ marginRight: 6 }} /> {toastMsg}
      </div>
    </div>
  );
}
