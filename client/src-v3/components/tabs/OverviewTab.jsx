// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — OverviewTab.jsx
// Ported from V2. Reads aggregated data from Supabase collections.
// Notes are saved directly to events.quick_notes.
//
// V4.34.0: once the main event's date has passed, the countdown hero switches
// to a past-tense "it happened" treatment instead of sitting frozen at
// 00:00:00:00, and a quiet "planning another celebration?" card appears
// below the stat cards linking back to the Event Picker. The actual
// reprioritization of "What Needs You Next" toward gift thank-yous lives in
// utils/focus.js, not here. This file just needs to also fetch gifts and
// pass them through.
//
// V5.8.1: every Mark action shows an 8-second Undo; Timeline sits under the countdown, Quick Notes below.
// V5.8.0 (V5-O1): the Overview now leads with "Needs you now" (FocusPanel), each
// item resolvable in place; the countdown compacts to one row; the four ring
// cards become one quiet row of labeled stats with small progress bars.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase }           from "@/lib/supabase.js";
import { useEventData }       from "@/hooks/useEventData.js";
import { EVENT_TYPE_ICON_KEYS } from "@/constants/events.js";
import { getCountdown, hasEventPassed, formatDate, formatEntryMeta, sortTimeline } from "@/utils/dates.js";
import { GetStartedCard }     from "@/components/shared/GetStartedCard.jsx";
import { readSetupState, mergeSetupState, migrateLegacyDismissal, resolveSteps } from "@/utils/setupState.js";
import { generateEventBriefHTML } from "@/utils/exports.js";
import { Icon }               from "@/utils/iconMap.jsx";
import { StatCard }          from "@/components/shared/StatCard.jsx";
import { FocusPanel }        from "@/components/shared/FocusPanel.jsx";
import { computeFocusItems, computeNextUp } from "@/utils/focus.js";
import { UndoToast } from "@/components/guests/UndoToast.jsx";
import { amountPaid, hasPayments } from "@/utils/expensePayments.js";
import { getGiftGivers, withGivers } from "@/utils/gifts.js";
import { getSectionHeadcount, getMealPopulation, isTrackingPerPerson } from "@/utils/sections.js";
import { setGuestsPreset, setGuestsView, setGuestsCompose } from "@/utils/guestsPreset.js";
import { useRsvpReplies } from "@/hooks/useRsvpReplies.js";
import { InfoPopover } from "@/components/shared/InfoPopover.jsx";
import { METRIC_HELP } from "@/constants/metrics.js";
import { printDocument, isTouchPrimary } from "@/utils/printDocument.js";
import { PrintPreviewModal } from "@/components/shared/PrintPreviewModal.jsx";

// Abbreviate currency for mobile ring cards: $11,831.63 -> $11.8k
function fmtCurrency(n, compact) {
  if (!compact || n < 10000) return `$${n.toLocaleString()}`;
  if (n < 1000000) return `$${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `$${(n / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
}

function useIsMobile() {
  const [m, setM] = useState(() => window.innerWidth <= 900);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const h = (e) => setM(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return m;
}

// One quiet stat: label, "84 of 136", a small bar, and "62%" as text so the bar is never the only cue.
function OvStat({ label, value, numeric, of, ofDisplay, fallback, onClick, title, info }) {
  const num = numeric ?? Number(value);
  const pct = of > 0 ? Math.max(0, Math.min(100, Math.round((num / of) * 100))) : 0;
  return (
    <div className="ov-stat">
      <button type="button" className="ov-stat-btn" onClick={onClick} title={title}>
        <span className="ov-stat-label">{label}</span>
        <span className="ov-stat-value">{value}{of > 0 && <small> of {ofDisplay ?? of}</small>}</span>
        <span className="ov-stat-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${label}: ${pct}%`}><i style={{ width: `${pct}%` }} /></span>
        <span className="ov-stat-pct">{of > 0 ? `${pct}% complete` : fallback}</span>
      </button>
      {info && <span className="ov-stat-info"><InfoPopover text={info} label={`How is ${label.toLowerCase()} counted?`} /></span>}
    </div>
  );
}

export function OverviewTab({ eventId, event, adminConfig, showToast, setActiveTab, onOpenAdmin, onOpenAdminTo, onOpenGuide, onPrintBrief, isViewer, isArchived, collaboratorRole, coPlanners, userId, onConfigSaved, onLogoSaved, openInvite, setTopbarSubtitle, userName }) {
  const config    = adminConfig || {};
  const isMobile  = useIsMobile();
  const mainEvent = (config.timeline || []).find(e => e.isMainEvent) || null;
  const eventDate = mainEvent?.startDate || null;
  const eventVenue = mainEvent?.venue || null;
  const eventPassed = eventDate ? hasEventPassed(eventDate) : false;

  const [countdown, setCountdown] = useState(() => eventDate ? getCountdown(eventDate) : null);
  const [localNotes, setLocalNotes] = useState(event?.quick_notes || "");
  const notesTimer = useRef(null);

  // Countdown ticker
  useEffect(() => {
    if (!eventDate) { setCountdown(null); return; }
    setCountdown(getCountdown(eventDate));
    const timer = setInterval(() => setCountdown(getCountdown(eventDate)), 30000);   // days and hours only, so no per-second tick
    return () => clearInterval(timer);
  }, [eventDate]);

  // Sync notes from event row
  useEffect(() => {
    setLocalNotes(event?.quick_notes || "");
  }, [event?.quick_notes]);

  // Debounced notes save to events.quick_notes
  const handleNotes = useCallback((val) => {
    setLocalNotes(val);
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(async () => {
      const { error } = await supabase
        .from("events")
        .update({ quick_notes: val, updated_at: new Date().toISOString() })
        .eq("id", eventId);
      if (error) console.warn("[SimchaKit] Notes save failed:", error.message);
    }, 600);
  }, [eventId]);

  // Load aggregated data for stat cards and focus panel
  const { items: households, loading: householdsLoading }  = useEventData(eventId, "households");
  const { items: people, loading: peopleLoading }          = useEventData(eventId, "people");
  const { items: expenses, loading: expensesLoading, save: saveExpense } = useEventData(eventId, "expenses");
  const { items: tasks, loading: tasksLoading, save: saveTask }          = useEventData(eventId, "tasks");
  const { items: vendors, loading: vendorsLoading }         = useEventData(eventId, "vendors");
  const { items: tables, loading: tablesLoading }           = useEventData(eventId, "tables");
  const { items: seatingRows, loading: seatingLoading }     = useEventData(eventId, "seating");
  // V5-R3: guests' RSVP replies waiting for review (read-only here; an error just means none to show)
  const { pending: pendingReplyRows, replies: replyRows } = useRsvpReplies(eventId);
  const pendingReplies = pendingReplyRows.length;
  // Households that already replied through their link (pending review or accepted): not "unreplied".
  const repliedHouseholdIds = useMemo(() => new Set(replyRows.filter(r => r.status === "pending" || r.status === "accepted").map(r => r.household_id)), [replyRows]);
  // Owner or editor on a live event: may resolve items that change data. Viewers see only links.
  const canAct = !isViewer && !isArchived && !event?.archived;
  const { items: gifts, loading: giftsLoading, save: saveGift }          = useEventData(eventId, "gifts");

  const dataLoading = householdsLoading || peopleLoading || expensesLoading
    || tasksLoading || vendorsLoading || tablesLoading || seatingLoading || giftsLoading;

  // Ceremony roles — single document, needed for Print Brief
  const [ceremonyRoles, setCeremonyRoles] = useState([]);
  useEffect(() => {
    if (!eventId) return;
    supabase.from("ceremony_roles").select("data").eq("event_id", eventId)
      .order("updated_at", { ascending: false })
      .then(({ data: rows }) => {
        if (rows && rows.length > 0) {
          const arrayRow = rows.find(r => Array.isArray(r.data?.roles));
          const row = arrayRow || rows[0];
          setCeremonyRoles(row.data?.roles || []);
        }
      });
  }, [eventId]);

  // Print Brief
  const [briefHTML,    setBriefHTML]    = useState(null);

  const handlePrintBrief = useCallback(() => {
    const state = { people, households, expenses, vendors, tasks, ceremonyRoles };
    const html = generateEventBriefHTML(state, adminConfig);
    if (isTouchPrimary()) printDocument(html); else setBriefHTML(html);
  }, [people, households, expenses, vendors, tasks, ceremonyRoles, adminConfig]);

  // Listen for top-bar Print Brief trigger (desktop)
  useEffect(() => {
    const handler = () => handlePrintBrief();
    window.addEventListener("simchakit:print-brief", handler);
    return () => window.removeEventListener("simchakit:print-brief", handler);
  }, [handlePrintBrief]);

  const timelineEntries = sortTimeline(config.timeline || []);

  // Sub-event counts
  const getSubEventCounts = (sectionId) => {
    const section = timelineEntries.find(e => e.id === sectionId);
    if (!section) return { invited: 0, confirmed: 0, awaiting: 0, invitedAdults: 0, invitedKids: 0, confirmedAdults: 0, confirmedKids: 0 };
    const hc = getSectionHeadcount(households, people, section);
    return {
      invited: hc.invited.total,     invitedAdults: hc.invited.adults,     invitedKids: hc.invited.kids,
      confirmed: hc.confirmed.total, confirmedAdults: hc.confirmed.adults, confirmedKids: hc.confirmed.kids,
      awaiting: hc.awaiting.total,
    };
  };

  // V4.41.0: the awaiting count on each sub-event row only appears once guests
  // are tracked one by one for sub-events. Before that every guest reads as
  // TBD, which would show the whole guest list as awaiting.
  const awaitingTracked = isTrackingPerPerson(people, timelineEntries);


  // Stats — memoized so the 1s countdown tick doesn't refilter
  const {
    totalBudget, totalPaid, tasksDone, tasksTotal,
    vendorsBooked, outOfTownCount,
  } = useMemo(() => ({
    totalBudget:    expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0),
    totalPaid:      expenses.reduce((s, e) => s + amountPaid(e), 0),
    tasksDone:      tasks.filter(t => t.done && !t.dismissed).length,
    tasksTotal:     tasks.filter(t => !t.dismissed).length,
    vendorsBooked:  vendors.filter(v => ["Booked","Deposit Paid","Paid in Full"].includes(v.status)).length,
    outOfTownCount: households.filter(h => h.outOfTown).length,
  }), [expenses, tasks, vendors, people, households]);

  // Confirmed ring: the same shared meal population as the Catering
  // Summary and Day-of Mode. Confirmed is each guest's own Yes for a
  // meal-serving sub-event; the total excludes guests who declined, so the
  // ring can reach 100% once every guest has answered. With no sub-event
  // flagged Meal served, it falls back to household RSVP status.
  const mealPop = useMemo(
    () => getMealPopulation(households, people, (config.timeline || []).filter(e => e.servesMeal)),
    [households, people, config.timeline]
  );
  const confirmedCount = mealPop.confirmed.length;
  const invitedCount   = mealPop.relevant.length;

  // Focus panel items — memoized
  const focusItems = useMemo(
    () => computeFocusItems({ tasks, expenses, people, households, vendors, tables, seatingRows, gifts, pendingReplies, repliedHouseholdIds, canAct }, config),
    [tasks, expenses, people, households, vendors, tables, seatingRows, gifts, pendingReplies, repliedHouseholdIds, canAct, config],
  );

  // ── Getting ready card (V5.7.0) ───────────────────────────────────────────
  // Progress lives on the event (events.setup_state) so co-planners see the same
  // state. It is re-read when the tab regains focus, so another device's changes show up.
  const canEditSetup = (collaboratorRole === "owner" || collaboratorRole === "editor") && !isArchived;
  const [setupState, setSetupState] = useState(null); // null = not loaded (or column missing): card stays hidden
  useEffect(() => {
    if (!eventId) return undefined;
    let cancelled = false;
    const load = async () => {
      const st = await readSetupState(eventId);
      if (cancelled || !st) return;
      setSetupState(st);
      if (canEditSetup) {
        // First load per event: move the old per-browser "dismissed" flag onto the event, then ignore it.
        try { const migrated = await migrateLegacyDismissal(eventId, st); if (migrated && !cancelled) setSetupState(migrated); } catch { /* retried next load */ }
      }
    };
    load();
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", load);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", load); };
  }, [eventId, canEditSetup]);

  const setupSummary = useMemo(
    () => resolveSteps({ adminConfig: config, households, coPlanners, userId, setupState }),
    [config, households, coPlanners, userId, setupState],
  );
  const updateSetup = useCallback(async (patch) => {
    try { setSetupState(await mergeSetupState(eventId, patch)); }
    catch (e) { showToast?.("Could not save your progress. Check your connection."); }
  }, [eventId, showToast]);
  const showSetupCard = !!setupState && !householdsLoading && !!collaboratorRole && collaboratorRole !== "coordinator" && !setupState.dismissed;
  const showSetupReopen = !!setupState && !householdsLoading && canEditSetup && setupState.dismissed && setupSummary.remaining > 0;

  // ── Resolve a "Needs you now" row in place ────────────────────────────────
  // Same writes the Tasks, Budget and Gifts tabs make. Every one shows an 8-second Undo.
  // Undo puts back only the fields the action changed, onto the row as it is now, so it
  // does not collide with the save that just happened.
  const latest = useRef({});
  latest.current = { tasks, expenses, gifts };
  const [undo, setUndo] = useState(null);   // { message, run }

  const handleResolve = useCallback(async (item, row) => {
    if (!canAct) return;
    const today = new Date().toISOString().slice(0, 10);
    const fresh = (list, rowId) => latest.current[list].find(x => x._rowId === rowId);
    let result, message, run;
    if (item.type === "tasks") {
      const t = fresh("tasks", row.rowId);
      if (!t) return;
      result = await saveTask({ ...t, done: true });
      message = `Marked done: ${row.title}`;
      run = () => { const c = fresh("tasks", row.rowId); return c && saveTask({ ...c, done: false }); };
    } else if (item.type === "invoices") {
      const e = fresh("expenses", row.rowId);
      if (!e) return;
      const before = row.paymentId ? (e.payments || []).find(p => p.id === row.paymentId) : null;
      const prev = { paid: e.paid, datePaid: e.datePaid };
      result = await saveExpense(hasPayments(e) && row.paymentId
        ? { ...e, payments: e.payments.map(p => p.id === row.paymentId ? { ...p, status: "paid", paidDate: p.paidDate || today } : p) }
        : { ...e, paid: true, datePaid: e.datePaid || today });
      message = `Marked paid: ${row.title}`;
      run = () => {
        const c = fresh("expenses", row.rowId);
        if (!c) return null;
        if (before) {
          return saveExpense({ ...c, payments: (c.payments || []).map(p => p.id === row.paymentId ? { ...p, status: before.status || "scheduled", paidDate: before.paidDate ?? null } : p) });
        }
        return saveExpense({ ...c, paid: !!prev.paid, datePaid: prev.datePaid || "" });
      };
    } else if (item.type === "thankyous") {
      const g = fresh("gifts", row.giftRowId);
      if (!g) return;
      const field = row.stage === "write" ? "thankYouWritten" : "thankYouMailed";
      result = await saveGift(withGivers(g, getGiftGivers(g).map(gv => gv.id === row.giverId ? { ...gv, [field]: true } : gv)));
      message = `${row.stage === "write" ? "Marked written" : "Marked mailed"}: ${row.title}`;
      run = () => { const c = fresh("gifts", row.giftRowId); return c && saveGift(withGivers(c, getGiftGivers(c).map(gv => gv.id === row.giverId ? { ...gv, [field]: false } : gv))); };
    } else return;
    if (result?.error) { showToast("Couldn't save that change. Try again."); return; }
    if (result?.conflict) return;   // AppShell already surfaces a conflict toast
    setUndo({ message, run });
  }, [canAct, saveTask, saveExpense, saveGift, showToast]);

  const handleUndo = async () => {
    const u = undo;
    setUndo(null);
    if (!u) return;
    const result = await u.run();
    if (result?.error) showToast("Couldn't undo that. Try again.");
  };

  const nextUp = useMemo(() => computeNextUp({ tasks, expenses }), [tasks, expenses]);

  // ── Topbar subtitle ──────────────────────────────────────────────────────
  const subtitle = userName
    ? `Welcome back, ${userName.split(/\s+/)[0]}. Here's where things stand.`
    : "Here's where things stand.";
  useEffect(() => {
    setTopbarSubtitle(subtitle);
    return () => setTopbarSubtitle(null);
  }, [subtitle, setTopbarSubtitle]);

  return (
    <div>
      {/* Mobile subtitle (≤900px only, where topbar is hidden) */}
      <div className="mobile-tab-subtitle">{subtitle}</div>

      {/* Action row — only render when at least one child is visible */}
      {(showSetupReopen || isMobile) && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
          {showSetupReopen && (
            <button className="btn btn-ghost btn-sm" onClick={() => updateSetup({ dismissed: false })}
              style={{ fontSize: 12 }}>
              <Icon name="hand" context="inline" style={{ marginRight: 4 }} /> Getting ready
            </button>
          )}
          {/* Touch devices — opens the system print sheet (print, share, or save as PDF) */}
          {isTouchPrimary() && (
            <button className="btn btn-sm btn-secondary" onClick={handlePrintBrief}
              style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, fontSize: 12 }}>
              <Icon name="printer" context="inline" /> Print brief
            </button>
          )}
        </div>
      )}

      {/* Getting ready card */}
      {showSetupCard && (
        <GetStartedCard
          eventId={eventId}
          adminConfig={config}
          summary={setupSummary}
          canEdit={canEditSetup}
          isArchived={isArchived}
          collaboratorRole={collaboratorRole}
          onSetStep={(id, val) => updateSetup({ steps: { [id]: val } })}
          onDismiss={() => updateSetup({ dismissed: true })}
          onConfigSaved={onConfigSaved}
          onLogoSaved={onLogoSaved}
          openInvite={openInvite}
          setActiveTab={setActiveTab}
          onOpenGuide={onOpenGuide}
          showToast={showToast}
        />
      )}

      {/* Two columns on desktop: Needs you now, stats and the rest on the left; countdown with the
          Timeline under it on the right. On phones one column in this order: list, countdown, stats,
          timeline. Quick Notes spans the full width below. */}
      <div className="ov-grid">
        <div className="ov-col ov-col-main">
        <FocusPanel
          items={focusItems}
          loading={dataLoading}
          nextUp={nextUp}
          hideWhenEmpty={showSetupCard && setupSummary.remaining > 1}
          onResolve={handleResolve}
          onNavigate={(tab, item) => {
            if (item?.id === "rsvp-replies") setGuestsView(eventId, "replies");
            if (item?.id === "rsvp-reminder" && item.type === "unreplied") setGuestsCompose(eventId, item.compose.kind, item.compose.ids);
            setActiveTab(tab);
          }}
        />

      {/* Quiet stats row: labeled text, a count, a small bar and the percent in words */}
      <div className="ov-stats">
        <OvStat
          label={mealPop.preciseMode ? "Confirmed for meals" : "Confirmed"}
          value={confirmedCount} of={invitedCount}
          fallback="No guests added"
          onClick={() => setActiveTab && setActiveTab("guests")} title="Go to guests tab"
          info={METRIC_HELP.confirmed({ precise: mealPop.preciseMode })}
        />
        <OvStat
          label="Budget paid"
          value={fmtCurrency(totalPaid, true)} numeric={totalPaid}
          of={totalBudget} ofDisplay={fmtCurrency(totalBudget, true)}
          fallback="No budget set"
          onClick={() => setActiveTab && setActiveTab("budget")} title="Go to budget tab"
        />
        <OvStat
          label="Tasks done"
          value={tasksDone} of={tasksTotal}
          fallback="No tasks yet"
          onClick={() => setActiveTab && setActiveTab("tasks")} title="Go to tasks tab"
        />
        <OvStat
          label="Vendors booked"
          value={vendorsBooked} of={vendors.length}
          fallback="No vendors yet"
          onClick={() => setActiveTab && setActiveTab("vendors")} title="Go to vendors tab"
        />
      </div>


      {/* Stat cards — secondary (simple counts) */}
      <div className="stat-grid-secondary">
        <StatCard
          label="Total Guests"
          value={people.length}
          tone="accent"
          sub={`${households.length} household${households.length !== 1 ? "s" : ""}, everyone on the list`}
          onClick={() => setActiveTab && setActiveTab("guests")}
          title="Go to guests tab"
          secondary
        />
        <StatCard
          label="Out of Town"
          value={outOfTownCount}
          tone="gold"
          sub={`household${outOfTownCount !== 1 ? "s" : ""} travelling`}
          onClick={() => setActiveTab && setActiveTab("accommodations")}
          title="Go to accommodations tab"
          secondary
        />
      </div>

      {/* Planning another celebration? — quiet, post-event only, links back
          to the Event Picker. A plain anchor rather than a router call since
          this file has no prop for returning to the picker; it does a full
          navigation to "/" rather than an in-app transition. */}
      {eventPassed && (
        <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>Planning another celebration?</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Start a new event whenever you're ready.</div>
          </div>
          <a href="/" className="btn btn-secondary" style={{ flexShrink: 0 }}>
            Start a new event
          </a>
        </div>
      )}

        </div>
        <div className="ov-col ov-col-side">
        <div className="countdown-compact">
          {config.logoUrl && <img src={config.logoUrl} alt="" className="countdown-logo-img" />}
          <div className="countdown-compact-text">
            <div className="countdown-label">{eventDate && eventPassed ? "Mazel tov!" : eventDate ? "Counting down to" : "Welcome to SimchaKit"}</div>
            <div className="countdown-compact-title">{config.name || mainEvent?.title || "The Big Day"}</div>
            <div className="countdown-date">
              {eventDate ? formatDate(eventDate) : "Mark a main event in Admin Mode to start the countdown"}
              {eventDate && eventVenue ? ` · ${eventVenue}` : ""}
            </div>
          </div>
          {eventDate && !eventPassed && countdown && (
            <div className="countdown-compact-days" aria-label={`${countdown.days} days to go`}>
              <span className="countdown-compact-num">{countdown.days}</span>
              <span className="countdown-compact-unit">{countdown.days === 1 ? "day" : "days"}</span>
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Event Timeline</div>
            {onOpenAdminTo && (
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: "3px 8px" }}
                onClick={() => onOpenAdminTo("timeline")}>
                + Add Event
              </button>
            )}
          </div>
          <div className="card-subtitle">
            {timelineEntries.length > 0
              ? `${timelineEntries.length} event${timelineEntries.length !== 1 ? "s" : ""} scheduled`
              : ""}
          </div>
          <div className="timeline">
            {timelineEntries.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 12px", color: "var(--text-muted)" }}>
                <div style={{ marginBottom: 8 }}><Icon name="calendar" context="empty" /></div>
                <div style={{ fontSize: 13, marginBottom: 8 }}>No events scheduled yet.</div>
                {onOpenAdmin && (
                  <button className="btn btn-ghost" style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }} onClick={onOpenAdmin}>
                    <Icon name="settings" context="inline" /> Add timeline in Admin Mode
                  </button>
                )}
              </div>
            ) : (
              timelineEntries.map((item, i) => {
                const dateStr = item.startDate
                  ? new Date(item.startDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : "";
                const counts = getSubEventCounts(item.id);
                return (
                  <div className="timeline-item" key={item.id || i}>
                    {/* TODO: item.icon is user-configured from admin_config timeline — leave as emoji for now */}
                    <div className="timeline-icon">{item.icon || "📅"}</div>
                    <div className="timeline-content">
                      <div className="timeline-title">{item.title}</div>
                      <div className="timeline-meta">{formatEntryMeta(item)}</div>
                      {counts.invited > 0 && (
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                          <Icon name="guests" context="inline" /> {counts.invited} invited ({counts.invitedAdults} adults, {counts.invitedKids} kids) · {counts.confirmed} confirmed ({counts.confirmedAdults} adults, {counts.confirmedKids} kids)
                          {awaitingTracked && counts.awaiting > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <button
                                type="button"
                                className="timeline-awaiting-link"
                                title="Show these guests in the Guests tab"
                                onClick={() => { setGuestsPreset(eventId, [item.id]); setActiveTab("guests"); }}
                              >
                                {counts.awaiting} awaiting
                              </button>
                              <InfoPopover text={METRIC_HELP.awaitingSubEvent()} label="How is awaiting counted?" />
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <span className={`tag timeline-badge ${item.isMainEvent ? "tag-accent" : "tag-blue"}`}>{dateStr}</span>
                  </div>
                );
              })
            )}
          </div>
          {config.rsvpUrl && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <a href={config.rsvpUrl} target="_blank" rel="noopener noreferrer"
                className="btn btn-secondary" style={{ width: "100%", justifyContent: "center", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Icon name="externalLink" context="inline" /> RSVP Website
              </a>
            </div>
          )}
        </div>

        </div>
      </div>

      <div className="card ov-notes">
          <div className="card-title">Quick Notes</div>
          <div className="card-subtitle">Your private planning notes — saved automatically</div>
          <textarea
            className="notes-area"
            style={{ minHeight: 240, opacity: isViewer ? 0.6 : 1 }}
            value={localNotes}
            placeholder="Jot down ideas, reminders, open questions, things to follow up on, or anything you want to remember…"
            onChange={e => !isViewer && handleNotes(e.target.value)}
            readOnly={isViewer}
          />
          {config.notes && (
            <>
              <div className="divider" />
              <div style={{ background: "var(--gold-light)", border: "1px solid var(--gold)", borderRadius: "var(--radius-sm)", padding: "8px 12px", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                <span style={{ fontWeight: 700, color: "var(--gold)", marginRight: 6, display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="pin" context="inline" /> Admin Note</span>
                {config.notes}
              </div>
            </>
          )}
      </div>

      {undo && <UndoToast message={undo.message} onUndo={handleUndo} onExpire={() => setUndo(null)} />}

      {/* Print Brief preview modal */}
      {briefHTML && (
        <PrintPreviewModal html={briefHTML} title="Print Preview — Event Brief" onClose={() => setBriefHTML(null)} zIndex={1100} />
      )}
    </div>
  );
}
