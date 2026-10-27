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
// V5.8.2 (V5-O1b): full-width list, named rows, thank-yous open Gifts, greeting fix, 3-entry timeline,
// phone 2x2 stats and one-line banner, quiet "Planning another celebration?" row after the event.
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
import { getSectionHeadcount, getMealPopulation, isTrackingPerPerson } from "@/utils/sections.js";
import { setGuestsPreset, setGuestsView, setGuestsCompose } from "@/utils/guestsPreset.js";
import { setGiftsFilter } from "@/utils/giftsPreset.js";
import { firstNameFrom } from "@/utils/displayName.js";
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

const TIMELINE_SHOWN = 3;

// "Oct 17", and "11 days ago" / "145 days to go" for the banner line.
function shortDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function daysLabel(d) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const n = Math.round((new Date(d + "T00:00:00") - t) / 86400000);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `${n} days to go` : `${-n} days ago`;
}

// One quiet stat: a short label, "84 of 136" as text, and a small bar (the numbers carry the meaning, the bar is a glance).
function OvStat({ label, value, numeric, of, ofDisplay, fallback, onClick, title, info }) {
  const num = numeric ?? Number(value);
  const pct = of > 0 ? Math.max(0, Math.min(100, Math.round((num / of) * 100))) : 0;
  return (
    <div className="ov-stat">
      <button type="button" className="ov-stat-btn" onClick={onClick} title={title}>
        <span className="ov-stat-label">{label}</span>
        <span className="ov-stat-value">{value}{of > 0 && <small> of {ofDisplay ?? of}</small>}</span>
        <span className="ov-stat-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${label}: ${pct}%`}><i style={{ width: `${pct}%` }} /></span>
        {of > 0 ? null : <span className="ov-stat-pct">{fallback}</span>}
      </button>
      {info && <span className="ov-stat-info"><InfoPopover text={info} label={`How is ${label.toLowerCase()} counted?`} /></span>}
    </div>
  );
}

export function OverviewTab({ eventId, event, adminConfig, showToast, setActiveTab, onOpenAdmin, onOpenAdminTo, onOpenGuide, onPrintBrief, isViewer, isArchived, collaboratorRole, coPlanners, userId, onConfigSaved, onLogoSaved, openInvite, setTopbarSubtitle, userName, userDisplayName }) {
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
  const { items: gifts, loading: giftsLoading }                           = useEventData(eventId, "gifts");

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
  // Next 3 entries (the most recent 3 once the event is over), with a link to the rest.
  const shownTimeline = (() => {
    if (eventPassed) return [...timelineEntries].reverse().slice(0, TIMELINE_SHOWN);
    const todayStr = new Date().toLocaleDateString("en-CA");
    const upcoming = timelineEntries.filter(e => !e.startDate || e.startDate >= todayStr);
    return (upcoming.length ? upcoming : timelineEntries).slice(0, TIMELINE_SHOWN);
  })();

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
  // Same writes the Tasks and Budget tabs make. Every one shows an 8-second Undo, which puts back
  // only the fields the action changed, onto the row as it is now, so it does not collide with the
  // save that just happened. Returns true when saved. Thank-yous are not resolved here: that
  // work happens in Gifts.
  const latest = useRef({});
  latest.current = { tasks, expenses };
  const [undo, setUndo] = useState(null);   // { message, run }

  const handleResolve = useCallback(async (item, row) => {
    if (!canAct) return false;
    const today = new Date().toISOString().slice(0, 10);
    const fresh = (list, rowId) => latest.current[list].find(x => x._rowId === rowId);
    let result, message, run;
    if (item.type === "tasks") {
      const t = fresh("tasks", row.rowId);
      if (!t) return false;
      result = await saveTask({ ...t, done: true });
      message = `Marked done: ${row.title}`;
      run = () => { const c = fresh("tasks", row.rowId); return c && saveTask({ ...c, done: false }); };
    } else if (item.type === "invoices") {
      const e = fresh("expenses", row.rowId);
      if (!e) return false;
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
    } else return false;
    if (result?.error) { showToast("Couldn't save that change. Try again."); return false; }
    if (result?.conflict) return false;   // AppShell already surfaces a conflict toast
    setUndo({ message, run });
    return true;
  }, [canAct, saveTask, saveExpense, showToast]);

  const handleUndo = async () => {
    const u = undo;
    setUndo(null);
    if (!u) return;
    const result = await u.run();
    if (result?.error) showToast("Couldn't undo that. Try again.");
  };

  const nextUp = useMemo(() => computeNextUp({ tasks, expenses }), [tasks, expenses]);

  // ── Topbar subtitle ──────────────────────────────────────────────────────
  const first = firstNameFrom(userDisplayName);
  const subtitle = first
    ? `Welcome back, ${first}. Here's where things stand.`
    : "Welcome back.";
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

      {/* Two columns on desktop: Needs you now, stats and totals on the left (the list owns the column);
          the event banner with a three-entry Timeline on the right. Quick Notes spans the full width
          below. On phones everything is one column, in the order the ov-s-* classes give:
          list, banner line, stats, totals, timeline, notes, then the new-event row. */}
      <div className="ov-grid">
        <div className="ov-col ov-col-main">
          <div className="ov-slot ov-s-needs">
            <FocusPanel
              items={focusItems}
              loading={dataLoading}
              nextUp={nextUp}
              hideWhenEmpty={showSetupCard && setupSummary.remaining > 1}
              holdResolved={!!undo}
              onResolve={handleResolve}
              onNavigate={(tab, item) => {
                if (item?.id === "rsvp-replies") setGuestsView(eventId, "replies");
                if (item?.id === "rsvp-reminder" && item.type === "unreplied") setGuestsCompose(eventId, item.compose.kind, item.compose.ids);
                if (item?.giftsFilter) setGiftsFilter(eventId, item.giftsFilter);
                setActiveTab(tab);
              }}
            />
          </div>

          {/* Quiet stats row: a short label, a count and a small bar */}
          <div className="ov-slot ov-s-stats">
            <div className="ov-stats">
              <OvStat
                label={mealPop.preciseMode ? "Meals" : "Confirmed"}
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
                label="Vendors"
                value={vendorsBooked} of={vendors.length}
                fallback="No vendors yet"
                onClick={() => setActiveTab && setActiveTab("vendors")} title="Go to vendors tab"
              />
            </div>
          </div>

          <div className="ov-slot ov-s-totals">
            <div className="stat-grid-secondary">
              <StatCard
                label="Total Guests"
                value={people.length}
                tone="accent"
                sub={`${households.length} household${households.length !== 1 ? "s" : ""}`}
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
          </div>

          {/* Planning another celebration? A quiet row, shown only once the event has happened.
              A plain anchor: this file has no prop for returning to the Event Picker. */}
          {eventPassed && (
            <div className="ov-slot ov-s-next">
              <div className="ov-next-row">
                <span>Planning another celebration?</span>
                <a href="/" className="btn btn-secondary btn-sm">Start a new event</a>
              </div>
            </div>
          )}
        </div>

        <div className="ov-col ov-col-side">
          {/* Event banner: a solid accent fill, so one text color works across it */}
          <div className="ov-slot ov-s-banner">
            <div className="ov-banner">
              {config.logoUrl && <img src={config.logoUrl} alt="" className="countdown-logo-img ov-banner-logo" />}
              <div className="ov-banner-text">
                <div className="ov-banner-title">{config.name || mainEvent?.title || "The Big Day"}</div>
                <div className="ov-banner-line">
                  {eventDate ? (
                    <>
                      <span className="ov-line-long">{formatDate(eventDate)}</span>
                      <span className="ov-line-short">{shortDate(eventDate)}</span>
                      {eventVenue ? ` \u00b7 ${eventVenue}` : ""}
                      {" \u00b7 "}{daysLabel(eventDate)}
                    </>
                  ) : "Mark a main event in Admin Mode to start the countdown"}
                </div>
              </div>
              {eventDate && !eventPassed && countdown && (
                <div className="ov-banner-days" aria-hidden="true">
                  <span className="ov-banner-num">{countdown.days}</span>
                  <span className="ov-banner-unit">{countdown.days === 1 ? "day" : "days"}</span>
                </div>
              )}
            </div>
          </div>

          <div className="ov-slot ov-s-timeline">
        <div className="card ov-timeline">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Event Timeline</div>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {timelineEntries.length > TIMELINE_SHOWN && (
                <button type="button" className="ov-link" onClick={() => setActiveTab("calendar")}>
                  All {timelineEntries.length} events {"\u2192"}
                </button>
              )}
              {onOpenAdminTo && !isViewer && (
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: "3px 8px" }}
                  onClick={() => onOpenAdminTo("timeline")}>
                  + Add Event
                </button>
              )}
            </span>
          </div>
          <div className="card-subtitle">
            {timelineEntries.length > TIMELINE_SHOWN
              ? (eventPassed ? `Most recent ${TIMELINE_SHOWN}` : `Next ${TIMELINE_SHOWN}`)
              : (timelineEntries.length > 0 ? `${timelineEntries.length} event${timelineEntries.length !== 1 ? "s" : ""} scheduled` : "")}
          </div>
          <div className="timeline">
            {timelineEntries.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 12px", color: "var(--text-secondary)" }}>
                <div style={{ marginBottom: 8 }}><Icon name="calendar" context="empty" /></div>
                <div style={{ fontSize: 13, marginBottom: 8 }}>No events scheduled yet.</div>
                {onOpenAdmin && (
                  <button className="btn btn-ghost" style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }} onClick={onOpenAdmin}>
                    <Icon name="settings" context="inline" /> Add timeline in Admin Mode
                  </button>
                )}
              </div>
            ) : (
              shownTimeline.map((item, i) => {
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
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
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

        <div className="ov-slot ov-s-notes">
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
        </div>
      </div>

      {undo && <UndoToast message={undo.message} onUndo={handleUndo} onExpire={() => setUndo(null)} />}

      {/* Print Brief preview modal */}
      {briefHTML && (
        <PrintPreviewModal html={briefHTML} title="Print Preview — Event Brief" onClose={() => setBriefHTML(null)} zIndex={1100} />
      )}
    </div>
  );
}
