// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.9.0 — OverviewTab.jsx (V5-O3 rebuild)
// Reads aggregated data from Supabase collections. Notes are saved to events.quick_notes.
//
// The page is: a hero (stage from the main event date), then cards placed with CSS grid areas
// in reading order: Needs you now (or Getting ready on day zero), Celebration schedule,
// Who's coming, Readiness, Quick Notes. computeFocusItems() in utils/focus.js stays the single
// source of the action list. This file gathers the data and composes the pieces in
// components/overview/ and components/shared/FocusPanel.jsx. History: V4.34.0 past-tense hero,
// V5.8.x "Needs you now" first, V5.9.0 hero, schedule, Who's coming, Readiness.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase }           from "@/lib/supabase.js";
import { useEventData }       from "@/hooks/useEventData.js";
import { useMessageLog }      from "@/hooks/useMessageLog.js";
import { useRsvpReplies }     from "@/hooks/useRsvpReplies.js";
import { useOverviewAnimation } from "@/hooks/useOverviewAnimation.js";
import { EVENT_MOTIF }        from "@/constants/events.js";
import { GetStartedCard }     from "@/components/shared/GetStartedCard.jsx";
import { readSetupState, mergeSetupState, migrateLegacyDismissal, resolveSteps } from "@/utils/setupState.js";
import { generateEventBriefHTML } from "@/utils/exports.js";
import { FocusPanel }        from "@/components/shared/FocusPanel.jsx";
import { OverviewHero }      from "@/components/overview/OverviewHero.jsx";
import { ScheduleCard }      from "@/components/overview/ScheduleCard.jsx";
import { WhosComingCard }    from "@/components/overview/WhosComingCard.jsx";
import { ReadinessCard }     from "@/components/overview/ReadinessCard.jsx";
import { computeFocusItems, computeNextUp } from "@/utils/focus.js";
import { UndoToast } from "@/components/guests/UndoToast.jsx";
import { amountPaid, hasPayments } from "@/utils/expensePayments.js";
import { countThankYousOutstanding } from "@/utils/gifts.js";
import { getSectionHeadcount, getMealPopulation, resolveMainEvent } from "@/utils/sections.js";
import { setGuestsView, setGuestsCompose } from "@/utils/guestsPreset.js";
import { setGiftsFilter } from "@/utils/giftsPreset.js";
import { setCalendarFocus } from "@/utils/calendarFocus.js";
import { overviewStage, buildSchedule, buildRunway, readinessTakeaways, localIso, daysBetween, shortMonthDay } from "@/utils/overview.js";
import { getHebrewInfo, getShabbatTimes, zipFromAddress } from "@/utils/hebcal.js";
import { printDocument, isTouchPrimary } from "@/utils/printDocument.js";
import { PrintPreviewModal } from "@/components/shared/PrintPreviewModal.jsx";

// Abbreviate currency: $11,831.63 -> $11.8k
function fmtCurrency(n) {
  if (n < 10000) return `$${Math.round(n).toLocaleString()}`;
  if (n < 1000000) return `$${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `$${(n / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
}

export function OverviewTab({ eventId, event, adminConfig, showToast, setActiveTab, onOpenAdminTo, onOpenGuide, isViewer, isArchived, collaboratorRole, coPlanners, userId, onConfigSaved, onLogoSaved, openInvite, openDayOf, setTopbarSubtitle, preferredName }) {
  const config    = adminConfig || {};
  const mainEvent = resolveMainEvent(config.timeline);
  const eventDate = mainEvent?.startDate || null;
  const todayIso  = localIso();
  const [localNotes, setLocalNotes] = useState(event?.quick_notes || "");
  const notesTimer = useRef(null);
  const anim = useOverviewAnimation();

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


  // Load aggregated data
  const { items: households, loading: householdsLoading }  = useEventData(eventId, "households");
  const { items: people, loading: peopleLoading }          = useEventData(eventId, "people");
  const { items: expenses, loading: expensesLoading, save: saveExpense } = useEventData(eventId, "expenses");
  const { items: tasks, loading: tasksLoading, save: saveTask }          = useEventData(eventId, "tasks");
  const { items: vendors, loading: vendorsLoading }         = useEventData(eventId, "vendors");
  const { items: tables, loading: tablesLoading }           = useEventData(eventId, "tables");
  const { items: seatingRows, loading: seatingLoading }     = useEventData(eventId, "seating");
  const { items: gifts, loading: giftsLoading }             = useEventData(eventId, "gifts");
  // V5-R3: guests' RSVP replies waiting for review (read-only here; an error just means none to show)
  const { pending: pendingReplyRows, replies: replyRows } = useRsvpReplies(eventId);
  const pendingReplies = pendingReplyRows.length;
  // Households that already replied through their link (pending review or accepted): not "unreplied".
  const repliedHouseholdIds = useMemo(() => new Set(replyRows.filter(r => r.status === "pending" || r.status === "accepted").map(r => r.household_id)), [replyRows]);
  // Invitation send dates for the runway (message_log; an error just means none to show)
  const { logs: messageLogs } = useMessageLog(eventId);
  // Owner or editor on a live event: may resolve items that change data. Viewers see only links.
  const canAct = !isViewer && !isArchived && !event?.archived;

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


  // ── Stage, hero data ──────────────────────────────────────────────────────
  const stage = overviewStage({ mainDate: eventDate, guestCount: households.length, todayIso });
  const days  = eventDate && stage !== "post" && stage !== "today" ? daysBetween(todayIso, eventDate) : null;

  // Hebrew date and parashah (Hebcal, cached per event; never blocks the hero)
  const [hebrew, setHebrew] = useState(null);
  useEffect(() => {
    let off = false;
    setHebrew(null);
    if (eventDate) getHebrewInfo(eventId, eventDate).then(h => { if (!off) setHebrew(h); });
    return () => { off = true; };
  }, [eventId, eventDate]);

  // Havdalah: only when an entry on the main date starts in the evening and a venue ZIP is known
  const eveningEntries = useMemo(
    () => (config.timeline || []).filter(e => e.startDate === eventDate && e.startTime && e.startTime >= "16:00"),
    [config.timeline, eventDate]
  );
  const venueZip = zipFromAddress(eveningEntries[0]?.address) || zipFromAddress(mainEvent?.address);
  const [shabbat, setShabbat] = useState(null);
  useEffect(() => {
    let off = false;
    setShabbat(null);
    if (eventDate && eveningEntries.length && venueZip && stage !== "post") getShabbatTimes(eventId, eventDate, venueZip).then(t => { if (!off) setShabbat(t); });
    return () => { off = true; };
  }, [eventId, eventDate, eveningEntries.length, venueZip, stage]);

  // ── Schedule (the same timeline entries Calendar uses; counts from getSectionHeadcount) ──
  const schedule = useMemo(() => {
    const now = new Date();
    const sched = buildSchedule({
      timeline: config.timeline, mainDate: eventDate, todayIso,
      nowMinutes: stage === "today" ? now.getHours() * 60 + now.getMinutes() : null,
      headcountOf: (e) => getSectionHeadcount(households, people, e),
    });
    // Havdalah goes only on entries that start after Shabbat or the festival ends.
    if (shabbat) sched.days.forEach(d => d.rows.forEach(r => {
      if (r.date === eventDate && r.startTime && r.startTime.split(":").reduce((h, m) => h * 60 + Number(m)) >= shabbat.minutes) r.havdalah = shabbat.havdalah;
    }));
    return sched;
  }, [config.timeline, eventDate, todayIso, stage, households, people, shabbat]);

  const dayRows = useMemo(
    () => schedule.days.flatMap(d => d.rows).filter(r => r.date === todayIso && (r.state === "next" || r.state === "later")),
    [schedule, todayIso]
  );

  // ── Runway and the phone "Next" line ──────────────────────────────────────
  const runway = useMemo(() => buildRunway({
    mainDate: eventDate, todayIso,
    invitationDates: (messageLogs || []).filter(l => l.kind === "invitation").map(l => localIso(new Date(l.sent_at))),
    rsvpDeadline: config.rsvpDeadline, timeline: config.timeline,
  }), [eventDate, todayIso, messageLogs, config.rsvpDeadline, config.timeline]);

  const nextLine = useMemo(() => {
    if (stage === "new") return "add your guests";
    if (stage === "soon") {
      const r = schedule.days.flatMap(d => d.rows).find(x => x.date >= todayIso);
      if (r) return `${r.title}, ${r.date === todayIso ? "today" : shortMonthDay(r.date)}${r.time ? ` ${r.time}` : ""}${r.building ? `, ${r.building}` : ""}`;
    }
    const dl = config.rsvpDeadline;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dl || "") && dl >= todayIso) {
      const n = daysBetween(todayIso, dl);
      return `reply deadline ${n === 0 ? "is today" : `in ${n} day${n !== 1 ? "s" : ""}`}, ${shortMonthDay(dl)}`;
    }
    return null;
  }, [stage, schedule, todayIso, config.rsvpDeadline]);

  // ── Who's coming, Readiness ───────────────────────────────────────────────
  // Confirmed is the same shared meal population as the Catering Summary and Day-of Mode: each
  // guest's own Yes for a meal-serving sub-event; with none flagged it follows household RSVP.
  const mealPop = useMemo(
    () => getMealPopulation(households, people, (config.timeline || []).filter(e => e.servesMeal)),
    [households, people, config.timeline]
  );
  const confirmedCount = mealPop.confirmed.length;
  const expectedCount  = mealPop.relevant.length;
  const declinedHouseholds = useMemo(() => new Set(households.filter(h => h.rsvpStatus === "RSVP No").map(h => h.id)), [households]);
  const declinedCount = mealPop.preciseMode ? people.length - expectedCount : people.filter(p => declinedHouseholds.has(p.householdId)).length;
  const awaitingCount = mealPop.preciseMode ? expectedCount - confirmedCount : Math.max(0, people.length - confirmedCount - declinedCount);
  const outOfTown = households.filter(h => h.outOfTown).length;

  const ready = useMemo(() => {
    const t0 = new Date(todayIso + "T00:00:00");
    const weekEnd = localIso(new Date(t0.getTime() + ((7 - t0.getDay()) % 7) * 86400000));
    const open = tasks.filter(t => !t.done && !t.dismissed && t.due);
    return {
      mealsChosen: mealPop.relevant.filter(p => p.mealChoice).length, mealsTotal: expectedCount,
      budgetTotal: expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0),
      budgetPaid:  expenses.reduce((s, e) => s + amountPaid(e), 0),
      tasksDone: tasks.filter(t => t.done && !t.dismissed).length, tasksTotal: tasks.filter(t => !t.dismissed).length,
      tasksOverdue: open.filter(t => t.due < todayIso).length,
      tasksDueWeek: open.filter(t => t.due >= todayIso && t.due <= weekEnd).length,
      vendorsBooked: vendors.filter(v => ["Booked", "Deposit Paid", "Paid in Full"].includes(v.status)).length, vendorsTotal: vendors.length,
    };
  }, [mealPop, expectedCount, expenses, tasks, vendors, todayIso]);
  const takeaways = readinessTakeaways(ready);

  // After the event: the thank-you count is the hero figure
  const thankyouToWrite = useMemo(() => countThankYousOutstanding(gifts).toWrite, [gifts]);

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

  // The Getting ready card (one-line banner when a single step is left; hidden when done or dismissed)
  const SetupCard = () => (
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
  );


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


  // ── Greeting ──────────────────────────────────────────────────────────────
  // Never built from the account's display name: a host who sets it to "The Brook Family" so
  // invitations read well must not be greeted as "Brook". It uses the optional preferred name.
  const greeting = preferredName ? `Welcome back, ${preferredName}.` : "Welcome back.";
  const subtitle = `${greeting} Here's where things stand.`;
  useEffect(() => {
    setTopbarSubtitle(subtitle);
    return () => setTopbarSubtitle(null);
  }, [subtitle, setTopbarSubtitle]);

  const goTo = (tab) => setActiveTab && setActiveTab(tab);
  const cardInSlot = stage === "new" && showSetupCard && setupSummary.remaining > 1;

  return (
    <div className="ov">
      <h1 className="ov-vh ov-mobile-h1">Overview</h1>
      <div className="ov-head">
        <span className="mobile-tab-subtitle" style={{ margin: 0 }}>{greeting}</span>
        <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {showSetupReopen && (
            <button type="button" className="btn" onClick={() => updateSetup({ dismissed: false })}>Getting ready</button>
          )}
          {/* Touch devices: the system print sheet (print, share, or save as PDF). Desktop has Print brief in the top bar. */}
          {isTouchPrimary() && <button type="button" className="btn" onClick={handlePrintBrief}>Print brief</button>}
        </span>
      </div>

      <OverviewHero
        stage={stage} name={config.name || mainEvent?.title || "Your event"} logoUrl={config.logoUrl}
        motif={EVENT_MOTIF[config.type] || "none"} mainDate={eventDate} venue={mainEvent?.venue || ""}
        hebrew={hebrew} days={days} runway={stage === "post" || stage === "today" ? null : runway}
        nextLine={nextLine} dayRows={dayRows} preferredName={preferredName}
        thankyou={thankyouToWrite} canAct={canAct} anim={anim}
        onOpenDayOf={openDayOf}
        onThankYous={() => { setGiftsFilter(eventId, "needs-written"); goTo("gifts"); }}
      />

      {/* The Getting ready card sits above everything unless it is day zero, when it takes the Needs you now slot. */}
      {showSetupCard && !cardInSlot && <SetupCard />}

      <div className="ov-main" data-stage={stage === "post" ? "post" : "live"}>
        {cardInSlot ? <div className="ov-a-n"><SetupCard /></div> : (
          <FocusPanel
            items={focusItems}
            loading={dataLoading}
            nextUp={nextUp || (stage === "new" ? { text: "add your guests", tab: "guests" } : null)}
            readOnly={!canAct}
            holdResolved={!!undo}
            onResolve={handleResolve}
            onNavigate={(tab, item) => {
              if (item?.id === "rsvp-replies") setGuestsView(eventId, "replies");
              if (item?.id === "rsvp-reminder" && item.type === "unreplied") setGuestsCompose(eventId, item.compose.kind, item.compose.ids);
              if (item?.giftsFilter) setGiftsFilter(eventId, item.giftsFilter);
              goTo(tab);
            }}
          />
        )}

        {stage !== "post" && (
          <ScheduleCard
            stage={stage} schedule={schedule} mainDate={eventDate} eventName={config.name || ""}
            noGuests={households.length === 0} canEditTimeline={canAct}
            onOpenEntry={(id) => { setCalendarFocus(eventId, id); goTo("calendar"); }}
            onAddTime={() => onOpenAdminTo && onOpenAdminTo("timeline")}
          />
        )}

        {stage !== "post" && (
          <WhosComingCard
            stage={stage} confirmed={confirmedCount} declined={declinedCount} awaiting={awaitingCount}
            guests={people.length} households={households.length} outOfTown={outOfTown}
            precise={mealPop.preciseMode} go={anim.go} canImport={canAct}
            onImport={() => goTo("guests")} onOpenGuests={() => goTo("guests")}
          />
        )}

        {stage !== "post" && stage !== "new" && (
          <ReadinessCard
            meals={{ value: ready.mealsChosen, of: ready.mealsTotal }}
            budget={{ value: fmtCurrency(ready.budgetPaid), of: fmtCurrency(ready.budgetTotal), raw: ready.budgetPaid, rawOf: ready.budgetTotal }}
            tasks={{ value: ready.tasksDone, of: ready.tasksTotal }}
            vendors={{ value: ready.vendorsBooked, of: ready.vendorsTotal }}
            line={takeaways} go={anim.go} nav={goTo}
          />
        )}

        <section className="ov-card ov-a-q ov-qn" aria-labelledby="ov-notes-title">
          <h2 id="ov-notes-title">Quick Notes</h2>
          <textarea
            className="notes-area"
            style={{ minHeight: 160, marginTop: 8, opacity: isViewer ? 0.6 : 1 }}
            value={localNotes}
            aria-label="Quick Notes: your private planning notes, saved automatically"
            placeholder="Jot down ideas, reminders, open questions, things to follow up on, or anything you want to remember…"
            onChange={e => !isViewer && handleNotes(e.target.value)}
            readOnly={isViewer}
          />
          {config.notes && (
            <div style={{ background: "var(--gold-light)", border: "1px solid var(--gold)", borderRadius: "var(--radius-sm)", padding: "8px 12px", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, marginTop: 10 }}>
              <b style={{ marginRight: 6 }}>Admin note</b>{config.notes}
            </div>
          )}
        </section>
      </div>

      {stage === "post" && (
        <section className="ov-card ov-plan" aria-label="Start another event">
          <b style={{ fontSize: 15 }}>Planning another celebration?</b>
          <a href="/" className="btn btn-secondary">Start a new event</a>
        </section>
      )}

      {undo && <UndoToast message={undo.message} onUndo={handleUndo} onExpire={() => setUndo(null)} />}

      {/* Print Brief preview modal */}
      {briefHTML && (
        <PrintPreviewModal html={briefHTML} title="Print Preview — Event Brief" onClose={() => setBriefHTML(null)} zIndex={1100} />
      )}
    </div>
  );
}
