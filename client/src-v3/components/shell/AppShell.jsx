// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.13.0 — AppShell.jsx
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
import { AdminPanel } from "@/components/AdminPanel.jsx";
import { SearchOverlay }         from "@/components/SearchOverlay.jsx";
import { GuideModal, ActivityLogModal, WhatsNewModal } from "@/components/Modals.jsx";
import { DayOfOverlay }          from "@/components/DayOfOverlay.jsx";
import { InviteModal }           from "@/components/shared/InviteModal.jsx";
import { NotificationPanel }     from "@/components/shared/NotificationPanel.jsx";
import { Icon }                  from "@/utils/iconMap.jsx";
import { ErrorBoundary }         from "@/components/shared/ErrorBoundary.jsx";
import { useSyncStatus }         from "@/utils/syncStatus.js";
import { getDueStatus }          from "@/utils/vendors.js";
import { countThankYousOutstanding } from "@/utils/gifts.js";
import { parseEventRoute, pushEventPath } from "@/utils/router.js";

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

// ── Event type icons — imported from shared constants ─────────────────────
import { EVENT_TYPE_ICON_KEYS } from "@/constants/events.js";
import { MobileHeader }         from "@/components/shell/MobileHeader.jsx";
import { Sidebar }              from "@/components/shell/Sidebar.jsx";
import { AppFooter }            from "@/components/shell/AppFooter.jsx";
import { MoreDrawer }           from "@/components/shell/MoreDrawer.jsx";
import { TopBar }               from "@/components/shell/TopBar.jsx";
import { BottomNav }            from "@/components/shell/BottomNav.jsx";
import { ShellBanners, DayOfReminderBanner } from "@/components/shell/ShellBanners.jsx";
import { BOTTOM_BAR_IDS, SIDEBAR_GROUPS, ALL_TABS } from "@/components/shell/shellConfig.js";
import { formatSwitcherDate, getDaysToEvent, localDateString } from "@/components/shell/shellDates.js";
import { avatarColor, avatarInitials } from "@/components/shell/avatarHelpers.js";
import { getPaletteHint, clearPaletteHint } from "@/utils/userEvents.js";



// ─────────────────────────────────────────────────────────────────────────────

export function AppShell({ session, eventId, onBack, onSelectEvent = null, isDemoMode = false, displayName: userDisplayName = null }) {
  const [activeTab,       setActiveTab]       = useState(() => {
    const route = parseEventRoute(window.location.pathname);
    const tab   = route?.tab;
    return tab && ALL_TABS.some(t => t.id === tab) ? tab : "overview";
  });
  const [event,           setEvent]           = useState(null);
  const [adminConfig,     setAdminConfig]     = useState(null);
  const [loadStatus,      setLoadStatus]      = useState("loading");
  const [showMoreDrawer,  setShowMoreDrawer]  = useState(false);
  const [dayOfBannerDismissed, setDayOfBannerDismissed] = useState(false);
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
  // V4.18.0: refetches on live changes instead of on tab change (V4.38.0:
  // households/tasks/expenses/gifts, previously people/tasks).
  // badgeRealtimeOk tracks whether that channel ever confirmed SUBSCRIBED —
  // if it never does (Realtime unavailable, demo/anon degrade, etc.), the
  // tab-change effect below keeps acting as a fallback so counts don't go
  // stale indefinitely either way.
  const [badgeCounts, setBadgeCounts] = useState({});
  const badgeRealtimeOk = useRef(false);

  const fetchBadgeCounts = useCallback(async () => {
    if (!eventId) return;
    const [hh, tsk, exp, gft] = await Promise.all([
      // Guests badge: households awaiting RSVP, not a bare total headcount.
      // Reads data->>rsvpStatus, the canonical field the Guests tab and
      // focus.js both use. It deliberately does NOT read the promoted
      // status column: that column is a denormalized copy that was found
      // stale on 91 of 92 households in live data (V4.37.1).
      // Built as IS NULL OR NOT IN (...) rather than a bare NOT IN, because
      // SQL's three-valued logic would silently drop households with no
      // rsvpStatus key at all instead of counting them as awaiting.
      supabase.from("households").select("*", { count: "exact", head: true })
        .eq("event_id", eventId)
        .or('data->>rsvpStatus.is.null,data->>rsvpStatus.not.in.("RSVP Yes","RSVP No")'),
      // Tasks badge: was filtering on data->>completed, a field no consumer
      // in this codebase (focus.js, DayOfOverlay.jsx) actually writes or
      // reads; the real fields are done and dismissed, matching focus.js's
      // own !t.done && !t.dismissed definition of "active."
      supabase.from("tasks").select("*", { count: "exact", head: true }).eq("event_id", eventId)
        .or("data->>done.is.null,data->>done.neq.true")
        .or("data->>dismissed.is.null,data->>dismissed.neq.true"),
      // Budget badge: overdue expenses, judged by the same getDueStatus() the
      // Budget tab uses for its Overdue tag. That rule reads a scheduled
      // expense's own installment dates, which live inside the payments
      // array, so it can't be a jsonb column filter (V4.38.2: this used to
      // prefilter on the expense's own dueDate and could miss a late
      // installment). An event's expense list is small, so fetch the rows
      // and apply the real rule client-side.
      supabase.from("expenses").select("data").eq("event_id", eventId),
      // Gifts badge: thank-you notes outstanding (not yet written or not yet
      // mailed). Uses the same shared countThankYousOutstanding() as the
      // focus panel, so the two always agree, and runs client-side because
      // the givers live in a jsonb array. Only displayed once the event has
      // passed; see withBadge below.
      supabase.from("gifts").select("data").eq("event_id", eventId),
    ]);
    // Surface failed badge queries instead of silently showing no badge, so a
    // broken filter is diagnosable (same convention as the other background
    // sync warnings). Expected and harmless for coordinators, whose role
    // cannot read these tables.
    [["guests", hh], ["tasks", tsk], ["budget", exp], ["gifts", gft]].forEach(([name, res]) => {
      if (res.error) console.warn(`[SimchaKit] badge count failed (${name}):`, res.error.message);
    });
    const overdueUnpaid = (exp.data || [])
      .map(row => row.data)
      .filter(e => getDueStatus(e)?.diff < 0).length;
    const thankYousOwed = countThankYousOutstanding((gft.data || []).map(row => row.data)).total;
    setBadgeCounts({
      guests: hh.count ?? null,
      tasks:  tsk.count ?? null,
      budget: overdueUnpaid,
      gifts:  thankYousOwed,
    });
  }, [eventId]);

  // Initial fetch once the event is ready
  useEffect(() => {
    if (!eventId || loadStatus !== "ready") return;
    fetchBadgeCounts();
  }, [eventId, loadStatus, fetchBadgeCounts]);

  // Realtime-triggered refetches are debounced: a bulk action (a CSV import
  // saves households one at a time) fires one event per row, and each refetch
  // runs four queries. Waiting for a quiet moment turns that burst into one.
  const badgeRefetchTimer = useRef(null);
  const scheduleBadgeRefetch = useCallback(() => {
    clearTimeout(badgeRefetchTimer.current);
    badgeRefetchTimer.current = setTimeout(fetchBadgeCounts, 400);
  }, [fetchBadgeCounts]);

  // Live updates: refetch whenever a relevant row changes
  useEffect(() => {
    if (!eventId || loadStatus !== "ready") return;
    badgeRealtimeOk.current = false;
    const channel = supabase
      .channel(`badges:${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "households", filter: `event_id=eq.${eventId}` }, scheduleBadgeRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks",      filter: `event_id=eq.${eventId}` }, scheduleBadgeRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses",   filter: `event_id=eq.${eventId}` }, scheduleBadgeRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "gifts",      filter: `event_id=eq.${eventId}` }, scheduleBadgeRefetch)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          badgeRealtimeOk.current = true;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("[SimchaKit] Realtime unavailable for tab badges — falling back to tab-change refresh");
        }
      });
    return () => {
      clearTimeout(badgeRefetchTimer.current);
      supabase.removeChannel(channel);
    };
  }, [eventId, loadStatus, scheduleBadgeRefetch]);

  // Fallback only: if Realtime never confirmed SUBSCRIBED above, tab changes
  // still nudge a refresh so badges don't go stale indefinitely (e.g. demo/
  // anon mode). No-ops once live updates are confirmed working.
  useEffect(() => {
    if (!eventId || loadStatus !== "ready" || badgeRealtimeOk.current) return;
    fetchBadgeCounts();
  }, [activeTab]);

  // ── Sync indicator (V4.18.1) ───────────────────────────────────────────────
  // Backed by utils/syncStatus.js — in-flight save()/remove() count plus the
  // active tab's Realtime channel status plus navigator.onLine. Maps to the
  // existing .sync-dot.connected/.connecting/.disconnected CSS (connecting's
  // gold pulse doubles nicely as the "in progress" look for "saving").
  const syncState = useSyncStatus();
  const SYNC_DISPLAY = {
    synced:  { dotClass: "connected",    topbarClass: "",         label: "All changes synced" },
    saving:  { dotClass: "connecting",   topbarClass: "saving",   label: "Saving\u2026" },
    offline: { dotClass: "disconnected", topbarClass: "offline",  label: "Offline: changes not saved" },
  };
  const syncDisplay = SYNC_DISPLAY[syncState.state] || SYNC_DISPLAY.synced;

  // ── Admin state ───────────────────────────────────────────────────────────
  const [showAdminPanel,  setShowAdminPanel]  = useState(false);
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

  // ── Save conflict listener ─────────────────────────────────────────────────
  // Fired by useEventData.js when a save is rejected because another
  // co-planner changed (or deleted) the same row first. The hook already
  // replaces the local item with the current server copy, so this is just
  // the user-facing notice — no reload is needed here.
  useEffect(() => {
    const handler = (e) => {
      const deleted = e?.detail?.deleted;
      showToast(
        deleted
          ? "This item was deleted by someone else"
          : "This item was changed by someone else — showing the latest version"
      );
    };
    window.addEventListener("simchakit:save-conflict", handler);
    return () => window.removeEventListener("simchakit:save-conflict", handler);
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
        clearPaletteHint();
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
      clearPaletteHint();
    }
    load();
  }, [eventId, session?.user?.id]);

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

  // ── Day-of reminder banner: hydrate dismissal from localStorage ──────────
  // Stored value is the date (local Y-M-D) it was dismissed on, not a bare
  // boolean, so a stale dismissal from a prior day never carries forward.
  // This is what makes the banner "return each morning" without any timer.
  useEffect(() => {
    if (!eventId) return;
    try {
      const stored = localStorage.getItem(`simchakit-dayof-banner-dismissed-${eventId}`);
      setDayOfBannerDismissed(stored === localDateString(new Date()));
    } catch {
      setDayOfBannerDismissed(false);
    }
  }, [eventId]);

  const dismissDayOfBanner = useCallback(() => {
    if (eventId) {
      try {
        localStorage.setItem(`simchakit-dayof-banner-dismissed-${eventId}`, localDateString(new Date()));
      } catch { /* localStorage unavailable; dismissal just won't persist */ }
    }
    setDayOfBannerDismissed(true);
  }, [eventId]);

  // ── Build visible tabs from adminConfig.visibleTabs ──────────────────────
  const visibleTabIds = adminConfig?.visibleTabs;
  const isCoordinator = collaboratorRole === "coordinator";
  const daysToEvent = getDaysToEvent(adminConfig?.timeline);
  // Not dismissible on the day itself (daysToEvent === 0). The copy and
  // the lack of a close button both reflect that intentionally.
  const showDayOfBanner = !isCoordinator
    && daysToEvent !== null
    && daysToEvent >= 0
    && daysToEvent <= 7
    && (daysToEvent === 0 || !dayOfBannerDismissed);

  let tabs;
  if (isCoordinator) {
    tabs = ALL_TABS.filter(t => t.id === "ceremony" || t.id === "prep");
  } else if (visibleTabIds && visibleTabIds.length > 0) {
    tabs = ALL_TABS.filter(t => t.id === "overview" || visibleTabIds.includes(t.id));
  } else {
    tabs = ALL_TABS;
  }

  const visibleTabIdSet = new Set(tabs.map(t => t.id));

  // Merge live badge counts onto tab objects. One helper for every nav
  // surface so the badge rules cannot diverge between them. Each badge also
  // carries a plain-language label (badgeLabel) for screen readers and
  // desktop tooltips, since a bare number does not say what it counts.
  // Gifts is post-event only, matching focus.js, which only surfaces
  // thank-yous once the event has passed.
  const eventHasPassed = daysToEvent !== null && daysToEvent < 0;
  const BADGE_MAP = { guests: "guests", tasks: "tasks", budget: "budget", gifts: "gifts" };
  const BADGE_LABELS = {
    guests: n => `${n} household${n !== 1 ? "s" : ""} awaiting RSVP`,
    tasks:  n => `${n} open task${n !== 1 ? "s" : ""}`,
    budget: n => `${n} overdue payment${n !== 1 ? "s" : ""}`,
    gifts:  n => `${n} thank-you note${n !== 1 ? "s" : ""} outstanding`,
  };
  const withBadge = t => {
    const countKey = BADGE_MAP[t.id];
    if (!countKey || (t.id === "gifts" && !eventHasPassed)) return t;
    const count = badgeCounts[countKey];
    return count != null && count > 0
      ? { ...t, badge: count, badgeLabel: BADGE_LABELS[countKey](count) }
      : t;
  };
  const tabsWithBadges = tabs.map(withBadge);

  // Sidebar groups filtered to visible tabs
  const sidebarGroups = isCoordinator
    ? [{ label: "Ceremony & Prep", tabs: tabsWithBadges }]
    : SIDEBAR_GROUPS.map(g => ({
        ...g,
        tabs: g.tabs.filter(t => visibleTabIdSet.has(t.id)).map(withBadge),
      })).filter(g => g.tabs.length > 0);

  // Mobile bottom bar / More drawer splits
  let bottomBarTabs = tabsWithBadges.filter(t => BOTTOM_BAR_IDS.includes(t.id));
  if (bottomBarTabs.length === 0) bottomBarTabs = tabsWithBadges.slice(0, 5);
  const moreDrawerTabs = tabsWithBadges.filter(t => !bottomBarTabs.includes(t));
  const moreIsActive   = moreDrawerTabs.some(t => t.id === activeTab);

  // ── Tab permission check (V4.20.1) ────────────────────────────────────────
  // Single source of truth for "can the current role/config access this
  // tab," reused by navigateTo (covers sidebar clicks, SearchOverlay's
  // onNavigate, and NotificationPanel's onNavigateToTab, since all three
  // already route through navigateTo), the popstate listener (browser back/
  // forward, or a hand-typed URL), and the one-time mount check below
  // (a pasted deep link on first load). visibleTabIdSet already reflects
  // both the coordinator restriction and any adminConfig.visibleTabs
  // restriction, so this protects against both, not just the coordinator
  // case the ticket named.
  //
  // Denied requests stay on the current tab if it's still permitted;
  // otherwise they fall back to a tab we know is safe (ceremony for
  // coordinators, overview for everyone else, since overview is always
  // included in visibleTabIdSet). Returns the tab that was actually applied,
  // so callers that also touch the URL (navigateTo, popstate) know whether
  // to reflect the requested tab or the fallback.
  const applyTabWithPermissionCheck = (requestedTab) => {
    if (visibleTabIdSet.has(requestedTab)) {
      setActiveTab(requestedTab);
      return requestedTab;
    }
    const fallback = visibleTabIdSet.has(activeTab) ? activeTab : (isCoordinator ? "ceremony" : "overview");
    if (fallback !== activeTab) setActiveTab(fallback);
    showToast("That section isn't available for your role");
    return fallback;
  };

  // ── Navigate to tab ───────────────────────────────────────────────────────
  const navigateTo = (tabId) => {
    const applied = applyTabWithPermissionCheck(tabId);
    // Demo mode's entry point is the fixed /demo path (App.v3.jsx checks
    // pathname === "/demo" exactly); pushing /e/<demoEventId>/tab here would
    // break out of that on refresh, since demo has no session to fall back
    // on. Tab state still changes normally, just without a URL change.
    if (eventId && !isDemoMode) pushEventPath(eventId, applied);
    setShowMoreDrawer(false);
    window.scrollTo(0, 0);
    // Refresh notification count on tab change (lightweight count-only query)
    refreshNotifCount();
  };

  // ── Popstate: tab-level routing (V4.19.0, permission-checked V4.20.1) ────
  // Only concerned with which tab, if any, the URL now points to for the
  // CURRENT event. Cross-event navigation (a different eventId in the path)
  // is App.v3.jsx's popstate listener's job — it updates the eventId prop
  // this component receives, and the existing event-load effect above
  // already re-runs off that prop change. Covers a hand-typed URL or
  // browser back/forward landing on a tab the role can't access.
  useEffect(() => {
    const handler = () => {
      const route = parseEventRoute(window.location.pathname);
      const requestedTab = route?.tab && ALL_TABS.some(t => t.id === route.tab) ? route.tab : "overview";
      const applied = applyTabWithPermissionCheck(requestedTab);
      if (applied !== requestedTab && eventId && !isDemoMode) {
        // Permission denied what the URL asked for — correct the URL to
        // match what we actually applied. replaceState, not push: this is
        // a correction, not a navigation the user asked for.
        window.history.replaceState({}, "", `/e/${eventId}/${applied}`);
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [applyTabWithPermissionCheck, eventId, isDemoMode]);

  // ── One-time initial-load permission check (V4.20.1) ─────────────────────
  // Replaces the old always-running coordinator-redirect effect, which fired
  // on every activeTab change and would silently fight navigateTo's own
  // corrected navigation. This runs exactly once, as soon as collaboratorRole
  // resolves from its initial null/loading state, and corrects the tab
  // hydrated from the URL on first load (e.g. a coordinator's notification
  // deep-link straight to a non-permitted tab) — the "mount-time redirect"
  // the ticket asked to keep. Never fires again after that, so it can't
  // clobber a deliberate later navigation.
  const didInitialPermissionCheck = useRef(false);
  useEffect(() => {
    if (didInitialPermissionCheck.current) return;
    if (collaboratorRole === null) return; // still loading — wait for it to resolve
    didInitialPermissionCheck.current = true;

    const applied = applyTabWithPermissionCheck(activeTab);
    if (applied !== activeTab && eventId && !isDemoMode) {
      window.history.replaceState({}, "", `/e/${eventId}/${applied}`);
    }
  }, [collaboratorRole, activeTab, applyTabWithPermissionCheck, eventId, isDemoMode]);

  // ── Palette from adminConfig ──────────────────────────────────────────────
  const palette     = adminConfig?.theme?.palette     || "rose";
  const customColor = adminConfig?.theme?.customColor || "";

  // ── Event type icon + date for sidebar switcher ───────────────────────────
  const eventTypeIconKey = EVENT_TYPE_ICON_KEYS[adminConfig?.type] || "sparkles";
  const switcherDate  = formatSwitcherDate(adminConfig?.timeline);

  // ── Loading / error states ────────────────────────────────────────────────
  if (loadStatus === "loading") {
    // After a switcher selection, borrow the target event's palette so the
    // loading screen does not flash rose. Null for picker selections and
    // reloads, which keep the default rose.
    const paletteHint = getPaletteHint(eventId);
    return (
      <div className="app-shell">
        <ThemeProvider palette={paletteHint?.palette || "rose"} customColor={paletteHint?.customColor || ""} />
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

  const onLogoSaved = (newLogoUrl) => {
    setAdminConfig(prev => {
      const updated = { ...(prev || {}), logoUrl: newLogoUrl || null };
      setEvent(ev => ev ? { ...ev, admin_config: updated } : ev);
      return updated;
    });
    showToast(newLogoUrl ? "Logo updated" : "Logo removed");
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

      <ShellBanners isDemoMode={isDemoMode} event={event} />

      {/* ── Mobile header (<=900px only, two-row) ── */}
      <MobileHeader adminConfig={adminConfig} eventTypeIconKey={eventTypeIconKey} onBack={onBack} onlineUsers={onlineUsers} setShowNotifPanel={setShowNotifPanel} setShowSearch={setShowSearch} unreadCount={unreadCount} />

      <DayOfReminderBanner showDayOfBanner={showDayOfBanner} setShowDayOf={setShowDayOf} daysToEvent={daysToEvent} dismissDayOfBanner={dismissDayOfBanner} />

      {/* ── Sidebar (desktop only, >900px) ── */}
      <Sidebar activeTab={activeTab} adminConfig={adminConfig} coPlanners={coPlanners} collaboratorRole={collaboratorRole} darkMode={darkMode} event={event} eventId={eventId} eventTypeIconKey={eventTypeIconKey} isCoordinator={isCoordinator} isDemoMode={isDemoMode} navigateTo={navigateTo} onBack={onBack} onLogoSaved={onLogoSaved} onSelectEvent={onSelectEvent} onlineUserIds={onlineUserIds} openAdmin={openAdmin} session={session} setDarkMode={setDarkMode} setShowAccountMenu={setShowAccountMenu} setShowActivityLog={setShowActivityLog} setShowDayOf={setShowDayOf} setShowGuide={setShowGuide} setShowInviteModal={setShowInviteModal} setShowWhatsNew={setShowWhatsNew} showAccountMenu={showAccountMenu} sidebarGroups={sidebarGroups} switcherDate={switcherDate} userBg={userBg} userInit={userInit} userName={userName} />

      {/* ── Main content column ── */}
      <div className="app-main">

        {/* ── Top bar (desktop only, pinned) ── */}
        <TopBar activeTab={activeTab} setShowNotifPanel={setShowNotifPanel} setShowSearch={setShowSearch} syncDisplay={syncDisplay} topbarSubtitle={topbarSubtitle} unreadCount={unreadCount} />

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
          <ErrorBoundary
            key={activeTab}
            source={`tab:${activeTab}`}
            title="Something went wrong with this tab"
            message="This part of SimchaKit hit an unexpected error. You can try again, or head back and continue elsewhere."
            eventId={eventId}
            activeTab={activeTab}
            collaboratorRole={collaboratorRole}
            session={session}
            onNavigateAway={activeTab === "overview" ? onBack : () => navigateTo("overview")}
            navigateAwayLabel={activeTab === "overview" ? "Back to Events" : "Back to Overview"}
          >
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
          </ErrorBoundary>
        </main>

        {/* ── Footer ── */}
        <AppFooter syncDisplay={syncDisplay} />
        </div>{/* /.app-main-scroll */}
      </div>

      {/* ── Mobile bottom bar (<=900px only) ── */}
      <BottomNav activeTab={activeTab} bottomBarTabs={bottomBarTabs} moreDrawerTabs={moreDrawerTabs} moreIsActive={moreIsActive} navigateTo={navigateTo} setShowMoreDrawer={setShowMoreDrawer} showMoreDrawer={showMoreDrawer} />

      <MoreDrawer activeTab={activeTab} collaboratorRole={collaboratorRole} darkMode={darkMode} isCoordinator={isCoordinator} moreDrawerTabs={moreDrawerTabs} navigateTo={navigateTo} onBack={onBack} openAdmin={openAdmin} setDarkMode={setDarkMode} setShowActivityLog={setShowActivityLog} setShowDayOf={setShowDayOf} setShowGuide={setShowGuide} setShowInviteModal={setShowInviteModal} setShowMoreDrawer={setShowMoreDrawer} setShowWhatsNew={setShowWhatsNew} showMoreDrawer={showMoreDrawer} />

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

      {/* ── Admin Panel ── */}
      {showAdminPanel && (
        <AdminPanel
          eventId={eventId}
          userId={session?.user?.id}
          calendarToken={event?.calendar_token}
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
