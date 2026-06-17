// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.11.0 — AppShell.jsx
// Sidebar navigation architecture.
// Desktop (>900px): 248px left sidebar + top bar + main content grid.
// Mobile (<=900px): existing bottom bar + More drawer (unchanged UX).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase }        from "@/lib/supabase.js";
import { useDarkMode }     from "@/hooks/useDarkMode.js";
import { useCollaboratorRole } from "@/hooks/useCollaboratorRole.js";
import { usePresence }    from "@/hooks/usePresence.js";
import { useNotifications } from "@/hooks/useNotifications.js";
import { ThemeProvider }   from "@/components/shared/ThemeProvider.jsx";
import { PlaceholderTab }  from "@/components/shared/PlaceholderTab.jsx";
import { AdminLogin, AdminPanel } from "@/components/AdminPanel.jsx";
import { SearchOverlay }         from "@/components/SearchOverlay.jsx";
import { GuideModal, ActivityLogModal, WhatsNewModal } from "@/components/Modals.jsx";
import { DayOfOverlay }          from "@/components/DayOfOverlay.jsx";
import { InviteModal }           from "@/components/shared/InviteModal.jsx";
import { NotificationPanel }     from "@/components/shared/NotificationPanel.jsx";
import { Icon }                  from "@/utils/iconMap.jsx";

// ── Tab components ──────────────────────────────────────────────────────────
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

// ── Event type icons (domain content — intentionally emoji, not Lucide) ─────
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

// ── Tab labels for the top bar ──────────────────────────────────────────────
const TAB_LABELS = {
  overview:       "Overview",
  guests:         "Guests",
  budget:         "Budget",
  vendors:        "Vendors",
  tasks:          "Tasks",
  prep:           "Prep",
  ceremony:       "Ceremony",
  seating:        "Seating",
  gifts:          "Gifts",
  accommodations: "Stay & Travel",
  favors:         "Favors",
  calendar:       "Calendar",
};

// ── Mobile bottom bar tab IDs (fixed, matches V2 exactly) ──────────────────
const BOTTOM_BAR_IDS = ["overview", "guests", "budget", "vendors", "tasks"];

// ── Sidebar nav groups ─────────────────────────────────────────────────────
const SIDEBAR_GROUPS = [
  {
    label: "Planning",
    tabs: [
      { id: "overview",       icon: "overview",       label: "Overview"      },
      { id: "guests",         icon: "guests",         label: "Guests"        },
      { id: "budget",         icon: "budget",         label: "Budget"        },
      { id: "vendors",        icon: "vendors",        label: "Vendors"       },
      { id: "tasks",          icon: "tasks",          label: "Tasks"         },
      { id: "prep",           icon: "prep",           label: "Prep"          },
    ],
  },
  {
    label: "The Celebration",
    tabs: [
      { id: "ceremony",       icon: "ceremony",       label: "Ceremony"      },
      { id: "seating",        icon: "seating",        label: "Seating"       },
      { id: "gifts",          icon: "gifts",          label: "Gifts"         },
      { id: "accommodations", icon: "accommodations", label: "Stay & Travel" },
      { id: "favors",         icon: "favors",         label: "Favors"        },
      { id: "calendar",       icon: "calendar",       label: "Calendar"      },
    ],
  },
];

// Flat list of all tabs (derived from groups, used for filtering)
const ALL_TABS = SIDEBAR_GROUPS.flatMap(g => g.tabs);

// ── Co-planner avatar helpers ──────────────────────────────────────────────
const AVATAR_FILLS = [
  "#9b2335",  // rose
  "#0d1b2e",  // navy
  "#2d6a4f",  // forest
  "#5b3a8c",  // purple
  "#4a5568",  // slate
  "#8b4c2a",  // copper
  "#1a6b6b",  // teal
  "#2d3748",  // charcoal
  "#8c5a6e",  // blush
];

function avatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return AVATAR_FILLS[Math.abs(hash) % AVATAR_FILLS.length];
}

function avatarInitials(displayName, email) {
  if (displayName) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return "?";
}

// ── Date helpers for sidebar event switcher ─────────────────────────────────
function formatSwitcherDate(timeline) {
  if (!timeline || !timeline.length) return null;
  const main = timeline.find(e => e.isMainEvent) || timeline[0];
  const raw = main?.startDate || main?.date;
  if (!raw) return null;
  const d = new Date(raw + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const dateStr = `${months[d.getMonth()]} ${d.getDate()}`;
  if (diffDays < 0) return `${dateStr} \u00b7 ${Math.abs(diffDays)}d ago`;
  if (diffDays === 0) return `${dateStr} \u00b7 Today`;
  return `${dateStr} \u00b7 ${diffDays}d out`;
}

// ─────────────────────────────────────────────────────────────────────────────
import { displayNameWithEmail } from "@/utils/displayName.js";

export function AppShell({ session, eventId, onBack, isDemoMode = false, displayName: userDisplayName = null }) {
  const [activeTab,       setActiveTab]       = useState("overview");
  const [event,           setEvent]           = useState(null);
  const [adminConfig,     setAdminConfig]     = useState(null);
  const [loadStatus,      setLoadStatus]      = useState("loading");
  const [showMoreDrawer,  setShowMoreDrawer]  = useState(false);
  const [topbarSubtitle,  setTopbarSubtitle]  = useState(null);
  const [toastMsg,        setToastMsg]        = useState("");
  const [toastVisible,    setToastVisible]    = useState(false);
  const [darkMode,        setDarkMode]        = useDarkMode();

  // ── Account menu state (sidebar footer) ──────────────────────────────────
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  // ── Collaborator role ────────────────────────────────────────────────────
  const collaboratorRole = useCollaboratorRole(
    event?.owner_id ?? null,
    eventId,
    session?.user?.id ?? null
  );

  // ── Co-planner list for avatar stack ────────────────────────────────────
  const [coPlanners, setCoPlanners] = useState(null);
  useEffect(() => {
    if (!eventId || collaboratorRole === null) return;
    // Fetch for all roles (not just owners) so presence + avatar stack works everywhere
    supabase.rpc("get_event_collaborators", { p_event_id: eventId })
      .then(({ data }) => setCoPlanners(data || []));
  }, [eventId, collaboratorRole]);

  // Re-fetch collaborator list (called after invite is sent)
  const refreshCollaborators = useCallback(() => {
    if (!eventId) return;
    supabase.rpc("get_event_collaborators", { p_event_id: eventId })
      .then(({ data }) => setCoPlanners(data || []));
  }, [eventId]);

  // ── Live presence (Supabase Realtime) ──────────────────────────────────
  // Build a stable array of collaborator user_ids for the roster gate.
  // useMemo avoids re-creating the array on every render.
  const collaboratorIds = useMemo(
    () => coPlanners ? coPlanners.map(c => c.user_id).filter(Boolean) : null,
    [coPlanners]
  );
  const { onlineUsers } = usePresence(eventId, session, userDisplayName, collaboratorIds);

  // Build a Set of online user_ids for O(1) lookup in the avatar stack
  const onlineUserIds = useMemo(
    () => new Set(onlineUsers.map(u => u.user_id)),
    [onlineUsers]
  );

  // ── Notifications (per-user unread layer over audit_log) ──────────────
  const {
    unreadCount,
    entries: notifEntries,
    loading: notifLoading,
    markAllRead,
    refreshCount: refreshNotifCount,
  } = useNotifications(eventId, session);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  // ── Tab badge counts (lightweight Supabase counts) ────────────────────────
  // TODO: refresh counts on mutation (currently refreshes on tab change)
  const [badgeCounts, setBadgeCounts] = useState({});
  useEffect(() => {
    if (!eventId || loadStatus !== "ready") return;
    async function fetchCounts() {
      const [ppl, tsk] = await Promise.all([
        supabase.from("people").select("*", { count: "exact", head: true }).eq("event_id", eventId),
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("event_id", eventId)
          .or("data->>completed.is.null,data->>completed.neq.true"),
      ]);
      setBadgeCounts({
        guests: ppl.count ?? null,
        tasks:  tsk.count ?? null,
      });
    }
    fetchCounts();
  }, [eventId, loadStatus, activeTab]);

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
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [searchHighlight, setSearchHighlight] = useState(null);

  const toastTimer  = useRef(null);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = useCallback((message) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(message);
    setToastVisible(true);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2500);
  }, []);

  // ── Audit log error listener ──────────────────────────────────────────────
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

      const { data, error } = await query.single();

      if (error || !data) {
        setLoadStatus("error");
        return;
      }

      setEvent(data);
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

  // ── Coordinator redirect ──────────────────────────────────────────────────
  useEffect(() => {
    if (collaboratorRole === "coordinator" && activeTab !== "ceremony" && activeTab !== "prep") {
      setActiveTab("ceremony");
    }
  }, [collaboratorRole, activeTab]);

  // ── Cmd+K / Ctrl+K search shortcut ────────────────────────────────────────
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

  // ── Close account menu on outside click ───────────────────────────────────
  useEffect(() => {
    if (!showAccountMenu) return;
    const handler = (e) => {
      if (!e.target.closest(".sidebar-account-menu") && !e.target.closest(".sidebar-account")) {
        setShowAccountMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, [showAccountMenu]);

  // ── Close More drawer on Escape ───────────────────────────────────────────
  useEffect(() => {
    if (!showMoreDrawer) return;
    const handler = (e) => { if (e.key === "Escape") setShowMoreDrawer(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showMoreDrawer]);

  // ── Build visible tabs from adminConfig.visibleTabs ──────────────────────
  const visibleTabIds = adminConfig?.visibleTabs;
  const isCoordinator = collaboratorRole === "coordinator";

  let tabs;
  if (isCoordinator) {
    tabs = ALL_TABS.filter(t => t.id === "ceremony" || t.id === "prep");
  } else if (visibleTabIds && visibleTabIds.length > 0) {
    tabs = ALL_TABS.filter(t => t.id === "overview" || visibleTabIds.includes(t.id));
  } else {
    tabs = ALL_TABS;
  }

  const visibleTabIdSet = new Set(tabs.map(t => t.id));

  // Merge live badge counts onto tab objects
  const BADGE_MAP = { guests: "guests", tasks: "tasks" };
  const tabsWithBadges = tabs.map(t => {
    const countKey = BADGE_MAP[t.id];
    const count = countKey ? badgeCounts[countKey] : undefined;
    return count != null && count > 0 ? { ...t, badge: count } : t;
  });

  // Sidebar groups filtered to visible tabs
  const sidebarGroups = isCoordinator
    ? [{ label: "Ceremony & Prep", tabs: tabsWithBadges }]
    : SIDEBAR_GROUPS.map(g => ({
        ...g,
        tabs: g.tabs.filter(t => visibleTabIdSet.has(t.id)).map(t => {
          const countKey = BADGE_MAP[t.id];
          const count = countKey ? badgeCounts[countKey] : undefined;
          return count != null && count > 0 ? { ...t, badge: count } : t;
        }),
      })).filter(g => g.tabs.length > 0);

  // Mobile bottom bar / More drawer splits
  let bottomBarTabs = tabsWithBadges.filter(t => BOTTOM_BAR_IDS.includes(t.id));
  if (bottomBarTabs.length === 0) bottomBarTabs = tabsWithBadges.slice(0, 5);
  const moreDrawerTabs = tabsWithBadges.filter(t => !bottomBarTabs.includes(t));
  const moreIsActive   = moreDrawerTabs.some(t => t.id === activeTab);

  // ── Navigate to tab ───────────────────────────────────────────────────────
  const navigateTo = (tabId) => {
    setActiveTab(tabId);
    setShowMoreDrawer(false);
    window.scrollTo(0, 0);
    // Refresh notification count on tab change (lightweight count-only query)
    refreshNotifCount();
  };

  // ── Palette from adminConfig ──────────────────────────────────────────────
  const palette     = adminConfig?.theme?.palette     || "rose";
  const customColor = adminConfig?.theme?.customColor || "";

  // ── Event type icon + date for sidebar switcher ───────────────────────────
  const eventTypeIcon = EVENT_TYPE_ICONS[adminConfig?.type] || "🎉";
  const switcherDate  = formatSwitcherDate(adminConfig?.timeline);

  // ── Loading / error states ────────────────────────────────────────────────
  if (loadStatus === "loading") {
    return (
      <div className="app-shell">
        <ThemeProvider palette="rose" customColor="" />
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", gap:16 }}>
          <img src="/apple-touch-icon.png" alt="SimchaKit" style={{ width: 48, height: 48, borderRadius: 10 }} />
          <div style={{ fontFamily:"var(--font-display)", fontSize:20, color:"var(--text-primary)" }}>Loading...</div>
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

  // ── Open admin ────────────────────────────────────────────────────────────
  const openAdmin = (section = "event") => {
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
    setEvent(ev => ev ? { ...ev, name: newConfig.name || ev.name, type: newConfig.type || ev.type, admin_config: newConfig } : ev);
    showToast("Configuration saved");
  };

  const onClergyUpdated = (clergyData) => {
    setAdminConfig(prev => {
      const updated = { ...prev, ...clergyData };
      setEvent(ev => ev ? { ...ev, admin_config: updated } : ev);
      return updated;
    });
  };

  // ── User identity (needed by tabProps and account row) ─────────────────
  const userEmail = session?.user?.email || "";
  const userName  = userDisplayName || userEmail.split("@")[0] || "";

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
    setTopbarSubtitle,
    userName,
  };

  // ── User identity for account row ─────────────────────────────────────────
  const userInit  = avatarInitials(userDisplayName, userEmail);
  const userBg    = avatarColor(userDisplayName || userEmail || "user");

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      <ThemeProvider palette={palette} customColor={customColor} />

      {/* ── Demo banner (spans full width above the grid) ── */}
      {isDemoMode && (
        <div className="archived-banner shell-banner" style={{
          background: "var(--accent-primary)",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          flexWrap: "wrap",
        }}>
          <span><Icon name="clipboardList" context="inline" style={{ marginRight: 6 }} />You are viewing the SimchaKit demo. Data resets nightly.</span>
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
        <div className="archived-banner shell-banner">
          <Icon name="lock" context="inline" style={{ marginRight: 6 }} /> This event is archived and read-only.
        </div>
      )}

      {/* ── Mobile header (<=900px only) ── */}
      <header className="mobile-header">
        <div className="mobile-header-inner">
          <button className="mobile-header-back" onClick={onBack}>
            <Icon name="arrowLeft" context="inline" style={{ marginRight: 2 }} /> Events
          </button>
          <div className="mobile-header-brand">
            <img src="/apple-touch-icon.png" alt="SimchaKit" style={{ width: 32, height: 32, borderRadius: 7 }} />
            <span className="mobile-header-title">SimchaKit</span>
          </div>
          {adminConfig?.name && (
            <div className="mobile-header-event" title={adminConfig.name}>{adminConfig.name}</div>
          )}
          <div style={{ flex: 1 }} />
          {/* Mobile presence badge — count of other online co-planners */}
          {onlineUsers.length > 0 && (
            <div className="mobile-presence-badge">
              <span className="mobile-presence-dot" />
              {onlineUsers.length}
            </div>
          )}
          <div className="mobile-header-actions">
            <button className="icon-btn notif-bell-btn" title="Notifications" onClick={() => setShowNotifPanel(s => !s)}>
              <Icon name="bell" context="button" />
              {unreadCount > 0 && (
                <span className="notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
              )}
            </button>
            <button className="icon-btn" title="Search" onClick={() => setShowSearch(true)}>
              <Icon name="search" context="button" />
            </button>
            <button className="icon-btn" title="Admin Mode" onClick={() => openAdmin("event")}>
              <Icon name="settings" context="button" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Sidebar (desktop only, >900px) ── */}
      <aside className="app-sidebar">

        {/* Brand */}
        <div className="sidebar-brand">
          <img src="/apple-touch-icon.png" alt="SimchaKit" style={{ width: 34, height: 34, borderRadius: 9 }} />
          <span className="sidebar-wordmark">SimchaKit</span>
        </div>

        {/* Event switcher */}
        <button className="sidebar-switcher" onClick={onBack} title="Back to Events">
          <span className="sidebar-switcher-emoji">{eventTypeIcon}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="sidebar-switcher-name">{adminConfig?.name || "Untitled Event"}</div>
            {switcherDate && <div className="sidebar-switcher-date">{switcherDate}</div>}
          </div>
          <span className="sidebar-switcher-chevron"><Icon name="chevronRight" context="inline" /></span>
          {/* TODO: inline event switcher dropdown */}
        </button>

        {/* Nav items */}
        <nav className="sidebar-nav">
          {sidebarGroups.map(group => (
            <div key={group.label}>
              <div className="sidebar-group-label">{group.label}</div>
              {group.tabs.map(tab => (
                <button
                  key={tab.id}
                  className={`sidebar-item${activeTab === tab.id ? " active" : ""}`}
                  onClick={() => navigateTo(tab.id)}
                >
                  <Icon name={tab.icon} context="nav" />
                  <span className="sidebar-item-label">{tab.label}</span>
                  {tab.badge != null && tab.badge > 0 && (
                    <span className="sidebar-item-badge">{tab.badge}</span>
                  )}
                </button>
              ))}
            </div>
          ))}

          {/* Day-of Mode — standalone emphasized entry */}
          {!isCoordinator && (
            <button className="sidebar-dayof" onClick={() => setShowDayOf(true)}>
              <Icon name="clipboardList" context="nav" />
              <span className="sidebar-item-label">Day-of Mode</span>
              <span className="sidebar-dayof-tag">Event day</span>
            </button>
          )}
        </nav>

        {/* Footer (pushed to bottom) */}
        <div className="sidebar-footer">

          {/* Co-planner row: avatars + gear */}
          {coPlanners !== null && (() => {
            // Filter self out of the display list
            const others = coPlanners.filter(c => c.user_id !== session?.user?.id);
            return (
              <div className="sidebar-team">
                {others.length > 0 ? (
                  <button type="button" className="sidebar-avatars" onClick={() => openAdmin("collaborators")} aria-label={`View ${others.length} co-planner${others.length !== 1 ? "s" : ""}`}>
                    {others.slice(0, 3).map((c, i) => (
                      <div
                        key={c.user_id || c.id || i}
                        className="sidebar-avatar"
                        style={{ background: avatarColor(c.display_name || c.email || ""), zIndex: 3 - i }}
                        aria-hidden="true"
                      >
                        {avatarInitials(c.display_name, c.email)}
                        {onlineUserIds.has(c.user_id) && (
                          <span className="sidebar-avatar-online" aria-label="Online" />
                        )}
                      </div>
                    ))}
                    {others.length > 3 && (
                      <div className="sidebar-avatar sidebar-avatar-more" aria-hidden="true">+{others.length - 3}</div>
                    )}
                  </button>
                ) : null}
                {collaboratorRole === "owner" && (
                  <button
                    className="sidebar-gear"
                    onClick={() => openAdmin("event")}
                    title="Event settings"
                  >
                    <Icon name="settings" context="inline" />
                  </button>
                )}
              </div>
            );
          })()}

          {/* Solo-event prompt OR standard invite button (never both) */}
          {(() => {
            const isInviter = collaboratorRole === "owner" || collaboratorRole === "editor";
            if (!isInviter) return null;
            const isSoloOwner = collaboratorRole === "owner"
              && coPlanners !== null
              && coPlanners.filter(c => c.user_id !== session?.user?.id).length === 0;
            if (isSoloOwner) {
              return (
                <button className="sidebar-solo-invite" onClick={() => setShowInviteModal(true)}>
                  <Icon name="userPlus" context="inline" />
                  <span>Planning with someone? Invite a co-planner.</span>
                </button>
              );
            }
            return (
              <button className="sidebar-invite" onClick={() => setShowInviteModal(true)}>
                <Icon name="userPlus" context="inline" /> Invite a co-planner
              </button>
            );
          })()}

          {/* Collaborator role badge (editors, viewers, coordinators) */}
          {collaboratorRole && collaboratorRole !== "owner" && (
            <div className="sidebar-role-badge">
              {collaboratorRole === "editor"      ? <><Icon name="pencil" context="badge" /> Editor</>
               : collaboratorRole === "coordinator" ? <><Icon name="ceremony" context="badge" /> Coordinator</>
               : <><Icon name="eye" context="badge" /> Viewer</>}
            </div>
          )}

          {/* Account row */}
          <button type="button" className="sidebar-account" onClick={() => setShowAccountMenu(s => !s)} aria-label="Account menu">
            <div className="sidebar-account-avatar" style={{ background: userBg }} aria-hidden="true">{userInit}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="sidebar-account-name">{userName}</div>
              <div className="sidebar-account-hint">Account, theme, sign out</div>
            </div>
            <span className="sidebar-account-chevron">
              <Icon name={showAccountMenu ? "chevronDown" : "chevronRight"} context="inline" />
            </span>
          </button>

          {/* Account menu popover */}
          {showAccountMenu && (
            <div className="sidebar-account-menu">
              {/* Theme switcher */}
              <div className="sidebar-account-theme">
                <span className="sidebar-account-theme-label">Theme</span>
                <div className="sidebar-account-theme-btns">
                  {[
                    { mode: "light",  icon: "sun",     title: "Light"  },
                    { mode: "dark",   icon: "moon",    title: "Dark"   },
                    { mode: "system", icon: "monitor", title: "System" },
                  ].map(({ mode, icon, title }) => (
                    <button key={mode} title={title}
                      onClick={() => setDarkMode(mode)}
                      className={`sidebar-account-theme-btn${darkMode === mode ? " active" : ""}`}
                    >
                      <Icon name={icon} context="inline" />
                    </button>
                  ))}
                </div>
              </div>

              <button className="sidebar-account-item"
                onClick={() => { setShowAccountMenu(false); setShowGuide(true); }}>
                <Icon name="bookOpen" context="menu" /> Guide
              </button>

              <button className="sidebar-account-item"
                onClick={() => { setShowAccountMenu(false); setShowWhatsNew(true); }}>
                <Icon name="sparkles" context="menu" /> What's New
              </button>

              {!isCoordinator && (
                <button className="sidebar-account-item"
                  onClick={() => { setShowAccountMenu(false); setShowActivityLog(true); }}>
                  <Icon name="barChart3" context="menu" /> Activity Log
                </button>
              )}

              <button className="sidebar-account-item"
                onClick={() => { setShowAccountMenu(false); onBack(); }}>
                <Icon name="arrowLeft" context="menu" /> Back to Events
              </button>

              <button className="sidebar-account-item"
                onClick={() => { setShowAccountMenu(false); supabase.auth.signOut(); }}>
                <Icon name="logOut" context="menu" /> Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main content column ── */}
      <div className="app-main">

        {/* ── Top bar (desktop only, pinned) ── */}
        <div className="app-topbar">
          <div className="topbar-inner">
            <div>
              <h1 className="topbar-title">{TAB_LABELS[activeTab] || "SimchaKit"}</h1>
              {topbarSubtitle && (
                <div className="topbar-sub">{topbarSubtitle}</div>
              )}
            </div>
            <div className="topbar-spacer" />
            <div className="topbar-actions">
              {/* Sync indicator */}
              <span className="topbar-sync">
                <span className="sync-dot connected" />
                All changes synced
              </span>

              {/* Search */}
              <button className="icon-btn" title="Search (⌘K)" onClick={() => setShowSearch(true)}>
                <Icon name="search" context="button" />
              </button>

              {/* Notification bell */}
              <button
                className="icon-btn notif-bell-btn"
                title="Notifications"
                onClick={() => setShowNotifPanel(s => !s)}
              >
                <Icon name="bell" context="button" />
                {unreadCount > 0 && (
                  <span className="notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
                )}
              </button>

              {/* TODO: standalone Print brief */}
            </div>
          </div>
        </div>

        {/* ── Scrollable area (pinned topbar above, content + footer scroll) ── */}
        <div className="app-main-scroll">

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
          <span>&middot;</span>
          <span style={{ fontSize:11, color:"var(--text-muted)" }}>Powered by Claude</span>
          <span>&middot;</span>
          <a href="https://about.simcha-kit.com" target="_blank" rel="noopener" className="footer-link" style={{ fontSize:11 }}>about.simcha-kit.com</a>
          <span>&middot;</span>
          <span className="footer-event-id" style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"monospace" }}>
            {eventId}
          </span>
          {session?.user?.email && (
            <>
              <span>&middot;</span>
              <span style={{ fontSize:11, color:"var(--text-muted)" }}>
                {displayNameWithEmail(userDisplayName, session.user.email)}
              </span>
            </>
          )}
          <span>&middot;</span>
          <div className="footer-sync" title="Sync status">
            <div className="sync-dot connected" />
            <span>Supabase</span>
          </div>
        </footer>
        </div>{/* /.app-main-scroll */}
      </div>

      {/* ── Mobile bottom bar (<=900px only) ── */}
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
        <div className="more-drawer-body">
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

        {/* Day-of Mode in More drawer for mobile */}
        {!isCoordinator && (
          <button
            className="more-drawer-item"
            onClick={() => { setShowMoreDrawer(false); setShowDayOf(true); }}
          >
            <span className="more-drawer-item-icon"><Icon name="clipboardList" context="menu" /></span>
            <span className="more-drawer-item-label">Day-of Mode</span>
            <span className="more-drawer-item-chevron"><Icon name="chevronRight" context="inline" /></span>
          </button>
        )}

        {/* Theme switcher in More drawer for mobile */}
        <div style={{ padding: "10px 18px 4px", display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid var(--border)" }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)" }}>Theme</span>
          <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
            {[
              { mode: "light",  icon: "sun",     title: "Light"  },
              { mode: "dark",   icon: "moon",    title: "Dark"   },
              { mode: "system", icon: "monitor", title: "System" },
            ].map(({ mode, icon, title }) => (
              <button key={mode} title={title}
                onClick={() => setDarkMode(mode)}
                style={{
                  width: 30, height: 30, border: "none", borderRadius: 4,
                  cursor: "pointer", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s ease",
                  background: darkMode === mode ? "var(--accent-light)" : "var(--bg-subtle)",
                  color:      darkMode === mode ? "var(--accent-primary)" : "var(--text-muted)",
                }}
              ><Icon name={icon} context="inline" /></button>
            ))}
          </div>
        </div>

        {/* Mobile utility links */}
        <button className="more-drawer-item"
          onClick={() => { setShowMoreDrawer(false); setShowGuide(true); }}>
          <span className="more-drawer-item-icon"><Icon name="bookOpen" context="menu" /></span>
          <span className="more-drawer-item-label">Guide</span>
          <span className="more-drawer-item-chevron"><Icon name="chevronRight" context="inline" /></span>
        </button>
        <button className="more-drawer-item"
          onClick={() => { setShowMoreDrawer(false); setShowWhatsNew(true); }}>
          <span className="more-drawer-item-icon"><Icon name="sparkles" context="menu" /></span>
          <span className="more-drawer-item-label">What's New</span>
          <span className="more-drawer-item-chevron"><Icon name="chevronRight" context="inline" /></span>
        </button>
        {!isCoordinator && (
          <button className="more-drawer-item"
            onClick={() => { setShowMoreDrawer(false); setShowActivityLog(true); }}>
            <span className="more-drawer-item-icon"><Icon name="barChart3" context="menu" /></span>
            <span className="more-drawer-item-label">Activity Log</span>
            <span className="more-drawer-item-chevron"><Icon name="chevronRight" context="inline" /></span>
          </button>
        )}
        {/* Invite a co-planner (mobile, owners and editors) */}
        {(collaboratorRole === "owner" || collaboratorRole === "editor") && (
          <button className="more-drawer-item"
            onClick={() => { setShowMoreDrawer(false); setShowInviteModal(true); }}>
            <span className="more-drawer-item-icon"><Icon name="userPlus" context="menu" /></span>
            <span className="more-drawer-item-label">Invite a co-planner</span>
            <span className="more-drawer-item-chevron"><Icon name="chevronRight" context="inline" /></span>
          </button>
        )}
        <button className="more-drawer-item"
          onClick={() => { setShowMoreDrawer(false); openAdmin("event"); }}>
          <span className="more-drawer-item-icon"><Icon name="settings" context="menu" /></span>
          <span className="more-drawer-item-label">Admin Mode</span>
          <span className="more-drawer-item-chevron"><Icon name="chevronRight" context="inline" /></span>
        </button>
        <button className="more-drawer-item"
          onClick={() => { setShowMoreDrawer(false); onBack(); }}>
          <span className="more-drawer-item-icon"><Icon name="arrowLeft" context="menu" /></span>
          <span className="more-drawer-item-label">Back to Events</span>
          <span className="more-drawer-item-chevron"><Icon name="chevronRight" context="inline" /></span>
        </button>
        <button className="more-drawer-item"
          onClick={() => { setShowMoreDrawer(false); supabase.auth.signOut(); }}>
          <span className="more-drawer-item-icon"><Icon name="logOut" context="menu" /></span>
          <span className="more-drawer-item-label">Sign out</span>
          <span className="more-drawer-item-chevron"><Icon name="chevronRight" context="inline" /></span>
        </button>
        </div>
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

      {/* ── Notification Panel (single instance, position:fixed) ── */}
      {showNotifPanel && (
        <NotificationPanel
          entries={notifEntries}
          loading={notifLoading}
          unreadCount={unreadCount}
          onMarkAllRead={markAllRead}
          onSeeAllActivity={() => { setShowNotifPanel(false); setShowActivityLog(true); }}
          onNavigateToTab={(tab) => { setShowNotifPanel(false); navigateTo(tab); }}
          onClose={() => setShowNotifPanel(false)}
        />
      )}

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
          coPlanners={coPlanners}
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

      {/* ── Invite Modal ── */}
      {showInviteModal && (
        <InviteModal
          eventId={eventId}
          eventName={adminConfig?.name || ""}
          userId={session?.user?.id}
          collaboratorRole={collaboratorRole}
          currentCollabCount={coPlanners ? coPlanners.filter(c => c.user_id !== session?.user?.id && c.role !== "coordinator").length : 0}
          onClose={() => setShowInviteModal(false)}
          onInviteSent={refreshCollaborators}
        />
      )}

      {/* ── Toast ── */}
      <div className="app-toast" style={{
        opacity:    toastVisible ? 1 : 0,
        transform:  toastVisible ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(8px)",
      }}>
        <Icon name="check" context="inline" style={{ marginRight: 6 }} /> {toastMsg}
      </div>
    </div>
  );
}
