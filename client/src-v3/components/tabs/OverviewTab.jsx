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
import { computeFocusItems } from "@/utils/focus.js";
import { amountPaid } from "@/utils/expensePayments.js";
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
    const timer = setInterval(() => setCountdown(getCountdown(eventDate)), 1000);
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
  const { items: expenses, loading: expensesLoading }      = useEventData(eventId, "expenses");
  const { items: tasks, loading: tasksLoading }             = useEventData(eventId, "tasks");
  const { items: vendors, loading: vendorsLoading }         = useEventData(eventId, "vendors");
  const { items: tables, loading: tablesLoading }           = useEventData(eventId, "tables");
  const { items: seatingRows, loading: seatingLoading }     = useEventData(eventId, "seating");
  // V5-R3: guests' RSVP replies waiting for review (read-only here; an error just means none to show)
  const { pending: pendingReplyRows, replies: replyRows } = useRsvpReplies(eventId);
  const pendingReplies = pendingReplyRows.length;
  // Households that already replied through their link (pending review or accepted): not "unreplied".
  const repliedHouseholdIds = useMemo(() => new Set(replyRows.filter(r => r.status === "pending" || r.status === "accepted").map(r => r.household_id)), [replyRows]);
  const canRemind = !isViewer && !event?.archived;
  const { items: gifts, loading: giftsLoading }             = useEventData(eventId, "gifts");

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

  // Completion tone: green when done, baseTone otherwise.
  // Uses >= and rounds to cents for currency (floats).
  const completionTone = (done, total, baseTone) =>
    total > 0 && Math.round(done * 100) >= Math.round(total * 100) ? "green" : baseTone;

  // Focus panel items — memoized
  const focusItems = useMemo(
    () => computeFocusItems({ tasks, expenses, people, households, vendors, tables, seatingRows, gifts, pendingReplies, repliedHouseholdIds, canRemind }, config),
    [tasks, expenses, people, households, vendors, tables, seatingRows, gifts, pendingReplies, repliedHouseholdIds, canRemind, config],
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

      {/* Hero row: countdown (or past-tense) + focus panel */}
      <div className="overview-hero-row">
        {/* Countdown / past-event hero */}
        {eventDate && eventPassed ? (
          <div className="countdown-card" style={{ textAlign: "center" }}>
            <div style={{ position: "absolute", right: -10, top: "50%", transform: "translateY(-50%)", opacity: 0.10, pointerEvents: "none", userSelect: "none", color: "currentColor" }}>
              <Icon name={EVENT_TYPE_ICON_KEYS[config.type] || "sparkles"} size={80} strokeWidth={1.25} />
            </div>
            <div className="countdown-label">Mazel tov!</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
              {config.logoUrl && (
                <img src={config.logoUrl} alt="" className="countdown-logo-img" />
              )}
              <div className="countdown-title">{config.name || mainEvent?.title || "The Big Day"}</div>
            </div>
            <div className="countdown-date">
              {formatDate(eventDate)}
              {mainEvent?.title && config.name && mainEvent.title.trim().toLowerCase() !== config.name.trim().toLowerCase() ? ` · ${mainEvent.title}` : ""}
              {eventVenue ? ` · ${eventVenue}` : ""}
            </div>
          </div>
        ) : eventDate && countdown ? (
          <div className="countdown-card">
            <div style={{ position: "absolute", right: -10, top: "50%", transform: "translateY(-50%)", opacity: 0.10, pointerEvents: "none", userSelect: "none", color: "currentColor" }}>
              <Icon name={EVENT_TYPE_ICON_KEYS[config.type] || "sparkles"} size={80} strokeWidth={1.25} />
            </div>
            <div className="countdown-label">Counting down to</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {config.logoUrl && (
                <img src={config.logoUrl} alt="" className="countdown-logo-img" />
              )}
              <div className="countdown-title">{config.name || mainEvent?.title || "The Big Day"}</div>
            </div>
            <div className="countdown-date">
              {formatDate(eventDate)}
              {mainEvent?.title && config.name && mainEvent.title.trim().toLowerCase() !== config.name.trim().toLowerCase() ? ` · ${mainEvent.title}` : ""}
              {eventVenue ? ` · ${eventVenue}` : ""}
            </div>
            <div className="countdown-units">
              {[
                { num: countdown.days,    label: "Days" },
                { num: countdown.hours,   label: "Hrs"  },
                { num: countdown.minutes, label: "Min"  },
                { num: countdown.seconds, label: "Sec"  },
              ].map(u => (
                <div className="countdown-unit" key={u.label}>
                  <div className="countdown-num">{String(u.num).padStart(2, "0")}</div>
                  <div className="countdown-unit-label">{u.label}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="countdown-card" style={{ textAlign: "center" }}>
            <div className="countdown-title" style={{ marginBottom: 8 }}>Welcome to SimchaKit</div>
            <div className="countdown-date">Add your event timeline and mark a main event in Admin Mode to start the countdown</div>
            <div style={{ marginTop: 16 }}>
              <span className="tag" style={{ background: "rgba(255,255,255,0.2)", color: "white", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Icon name="settings" context="inline" /> Click the settings icon in the header to configure your event
              </span>
            </div>
          </div>
        )}

        {/* Focus panel — "What needs you next" */}
        <FocusPanel
          items={focusItems}
          loading={dataLoading}
          onNavigate={(tab, item) => {
            if (item?.id === "rsvp-replies") setGuestsView(eventId, "replies");
            if (item?.id === "rsvp-reminder" && item.actionLabel) setGuestsCompose(eventId, item.compose.kind, item.compose.ids);
            setActiveTab(tab);
          }}
        />
      </div>

      {/* Stat cards — primary (fractional with completion rings) */}
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <StatCard
          label={mealPop.preciseMode ? "Confirmed for meals" : "Confirmed"}
          value={confirmedCount}
          total={invitedCount}
          totalDisplay={`${invitedCount} ${mealPop.preciseMode ? "expected" : "guests"}`}
          tone="green"
          display="ring"
          sub="confirmed"
          subFallback="No guests added"
          onClick={() => setActiveTab && setActiveTab("guests")}
          title="Go to guests tab"
          info={METRIC_HELP.confirmed({ precise: mealPop.preciseMode })}
        />
        <StatCard
          label="Budget Paid"
          value={fmtCurrency(totalPaid, isMobile)}
          numericValue={totalPaid}
          total={totalBudget}
          totalDisplay={fmtCurrency(totalBudget, isMobile)}
          tone={completionTone(totalPaid, totalBudget, "accent")}
          display="ring"
          sub="paid"
          subFallback="No budget set"
          onClick={() => setActiveTab && setActiveTab("budget")}
          title="Go to budget tab"
        />
        <StatCard
          label="Tasks Done"
          value={tasksDone}
          total={tasksTotal}
          tone={completionTone(tasksDone, tasksTotal, "gold")}
          display="ring"
          sub="complete"
          subFallback="No tasks yet"
          onClick={() => setActiveTab && setActiveTab("tasks")}
          title="Go to tasks tab"
        />
        <StatCard
          label="Vendors Booked"
          value={vendorsBooked}
          total={vendors.length}
          tone={completionTone(vendorsBooked, vendors.length, "accent")}
          display="ring"
          sub="booked"
          subFallback="No vendors yet"
          onClick={() => setActiveTab && setActiveTab("vendors")}
          title="Go to vendors tab"
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

      {/* Two-column: timeline + notes */}
      <div className="two-col">
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

        <div className="card">
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

      {/* Print Brief preview modal */}
      {briefHTML && (
        <PrintPreviewModal html={briefHTML} title="Print Preview — Event Brief" onClose={() => setBriefHTML(null)} zIndex={1100} />
      )}
    </div>
  );
}
