// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.7.0 — components/shared/GetStartedCard.jsx
// The "Getting ready" card on Overview (replaces the Get Started checklist).
// Five steps; each expands in place and does its work there (import, invite,
// palette and logo) with no trip to Admin. Progress is saved on the event
// (events.setup_state) so co-planners see the same state.
//
// Status is always a labeled word plus a shape (check / arrow / hollow circle),
// never color alone. Viewers and archived events see the state read-only.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from "react";
import { supabase } from "@/lib/supabase.js";
import { Icon } from "@/utils/iconMap.jsx";
import { PALETTES } from "@/constants/theme.js";
import { SETUP_STEPS } from "@/utils/setupState.js";
import { buildSeedTimeline } from "@/utils/eventSeeds.js";
import { resolveMainEvent } from "@/utils/sections.js";
import { formatDate } from "@/utils/dates.js";
import { EventLogoControl } from "@/components/shared/EventLogoControl.jsx";
import { ImportModal } from "@/components/guests/ImportModal.jsx";
import { useEventData, householdPromoteColumns, peoplePromoteColumns } from "@/hooks/useEventData.js";
import { applyGuestImport } from "@/utils/guestImport.js";

const STATUS_LABEL = { done: "Done", skipped: "Skipped", todo: "To do" };
const STATUS_ICON  = { done: "check", skipped: "arrowRight" };

function StatusChip({ status }) {
  return (
    <span className={`gr-status gr-status-${status}`}>
      {STATUS_ICON[status] ? <Icon name={STATUS_ICON[status]} context="badge" /> : <span className="gr-dot" aria-hidden="true" />}
      {STATUS_LABEL[status]}
    </span>
  );
}

// Mounts its own households/people hooks only while the import is open, with the
// same promoted-column options the Guests tab uses, so rows are saved identically.
function ImportHost({ eventId, adminConfig, onClose, onImported }) {
  const { items: households, save: saveHouseholdRow, remove: removeHouseholdRow } = useEventData(eventId, "households", { promoteColumns: householdPromoteColumns });
  const { items: people,     save: savePersonRow,    remove: removePersonRow }     = useEventData(eventId, "people", { promoteColumns: peoplePromoteColumns });
  const handleImport = async (payload, mode) => {
    await applyGuestImport({ eventId, payload, mode, households, people, saveHouseholdRow, savePersonRow, removeHouseholdRow, removePersonRow });
    onImported();
  };
  return <ImportModal adminConfig={adminConfig} existingHouseholds={households} onImport={handleImport} onClose={onClose} />;
}

// The import modal lives outside the card body so it stays open when the last
// step completes and the card itself collapses or disappears.
export function GetStartedCard(props) {
  const [showImport, setShowImport] = useState(false);
  const { eventId, adminConfig, onSetStep, showToast } = props;
  return (
    <>
      <CardBody {...props} openImport={() => setShowImport(true)} />
      {showImport && (
        <ImportHost eventId={eventId} adminConfig={adminConfig}
          onClose={() => setShowImport(false)}
          onImported={() => { onSetStep("guests", "done"); showToast?.("Guest list imported"); }} />
      )}
    </>
  );
}

function CardBody({
  eventId, adminConfig, summary, canEdit, isArchived, collaboratorRole,
  onSetStep, onDismiss, onConfigSaved, onLogoSaved, openInvite, openImport, setActiveTab, onOpenGuide, showToast,
}) {
  const { status, remaining, doneCount, total } = summary;
  const firstTodo = SETUP_STEPS.find(s => status[s.id] === "todo")?.id || null;
  const [open,       setOpen]       = useState(firstTodo);
  const [expanded,   setExpanded]   = useState(false);   // banner -> full card
  const [busy,       setBusy]       = useState(false);
  const [err,        setErr]        = useState("");
  const [newEvent,   setNewEvent]   = useState("");

  const timeline = useMemo(() => adminConfig?.timeline || [], [adminConfig?.timeline]);
  const main     = resolveMainEvent(timeline);
  const [venue, setVenue] = useState(main?.venue || "");

  const details = useMemo(() => ({
    "event":        `${adminConfig?.name || "Your event"}${main?.startDate ? ` · ${formatDate(main.startDate)}` : ""}`,
    "events-venue": timeline.length
      ? `${timeline.map(t => t.title).filter(Boolean).join(", ")}${main?.venue ? ` · ${main.venue}` : ""}`
      : "Add the parts of your celebration so guests can reply to each.",
    "guests":       "Import a spreadsheet or add one household.",
    "coplanner":    "Share the work with a spouse or family.",
    "look":         "Used on guest pages and printouts.",
  }), [adminConfig, timeline, main]);

  // Hidden entirely when nothing is left, same as before: the caller also checks.
  if (remaining === 0) return null;

  // One step left: a single-line banner that opens the full card on click.
  if (remaining === 1 && !expanded) {
    const last = SETUP_STEPS.find(s => status[s.id] === "todo");
    return (
      <div className="gr-banner" role="status">
        <span className="gr-banner-text"><strong>Getting ready</strong> · {doneCount} of {total} · 1 step left: {last.label}</span>
        <span className="gr-banner-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => { setExpanded(true); setOpen(last.id); }}>Open</button>
          {canEdit && <button className="btn btn-ghost btn-sm" onClick={onDismiss}>Dismiss</button>}
        </span>
      </div>
    );
  }

  async function saveConfig(next) {
    const { error } = await supabase.from("events")
      .update({ admin_config: next, updated_at: new Date().toISOString() }).eq("id", eventId);
    if (error) throw error;
    onConfigSaved(next);
  }

  async function run(fn) {
    setBusy(true); setErr("");
    try { await fn(); } catch (e) { setErr(e?.message || "Could not save. Please try again."); }
    setBusy(false);
  }

  const saveEventsVenue = () => run(async () => {
    let tl = timeline.map(t => ({ ...t }));
    if (!tl.length) tl = buildSeedTimeline([adminConfig?.name || "Event"], "", "");
    const v = venue.trim();
    // venue fills the sub-events that don't have one yet; it never overwrites one the host typed
    tl = tl.map(t => ({ ...t, venue: t.venue || v }));
    const extra = newEvent.trim();
    if (extra && !tl.some(t => t.title.toLowerCase() === extra.toLowerCase())) {
      const base = resolveMainEvent(tl);
      tl.push(...buildSeedTimeline([extra], base?.startDate || "", v).map(t => ({ ...t, isMainEvent: false })));
    }
    await saveConfig({ ...adminConfig, timeline: tl });
    setNewEvent("");
    await onSetStep("events-venue", "done");
    showToast?.("Events and venue saved");
  });

  const pickPalette = (key) => run(async () => {
    await saveConfig({ ...adminConfig, theme: { ...(adminConfig?.theme || {}), palette: key } });
    await onSetStep("look", "done");
  });

  const actionFor = {
    "guests":    { label: "Import",   run: openImport },
    "coplanner": { label: "Invite",   run: openInvite },
    "events-venue": { label: "Add details", run: () => setOpen("events-venue") },
    "look":      { label: "Choose",   run: () => setOpen("look") },
  };

  function renderPanel(id) {
    const disabled = !canEdit || busy;
    if (id === "events-venue") return (
      <div className="gr-panel-body">
        <label className="gr-field">Venue (optional)
          <input className="form-input" value={venue} onChange={e => setVenue(e.target.value)} placeholder="e.g. Beth Shalom" disabled={disabled} />
        </label>
        <label className="gr-field">Add another event
          <input className="form-input" value={newEvent} onChange={e => setNewEvent(e.target.value)} placeholder="e.g. Rehearsal dinner" maxLength={60} disabled={disabled} />
        </label>
        <div className="gr-hint">Date, times and the rest are in Admin whenever you want them.</div>
        <div className="gr-panel-actions">
          <button className="btn btn-primary" onClick={saveEventsVenue} disabled={disabled}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    );
    if (id === "guests") return (
      <div className="gr-panel-body">
        <div className="gr-hint">We flag rows with no email or address and possible duplicates before anything is saved.</div>
        <div className="gr-panel-actions">
          <button className="btn btn-primary" onClick={openImport} disabled={disabled}>Import a spreadsheet</button>
          <button className="btn btn-secondary" onClick={() => setActiveTab("guests")}>Add one household</button>
        </div>
      </div>
    );
    if (id === "coplanner") return (
      <div className="gr-panel-body">
        <div className="gr-hint">Editors can plan alongside you, viewers can only look, coordinators see Ceremony and Prep.</div>
        <div className="gr-panel-actions">
          <button className="btn btn-primary" onClick={openInvite} disabled={!canEdit}>Invite someone</button>
        </div>
      </div>
    );
    if (id === "look") {
      const current = adminConfig?.theme?.palette || "rose";
      return (
        <div className="gr-panel-body">
          <div className="gr-swatches" role="group" aria-label="Color scheme">
            {Object.entries(PALETTES).map(([key, p]) => (
              <button key={key} className={`gr-swatch${current === key ? " on" : ""}`} aria-pressed={current === key}
                onClick={() => pickPalette(key)} disabled={disabled}>
                <span className="gr-swatch-chip" style={{ background: p.accent }} />
                {current === key && <Icon name="check" context="badge" />}
                {p.name}
              </button>
            ))}
          </div>
          <div className="gr-logo">
            <EventLogoControl eventId={eventId} adminConfig={adminConfig} collaboratorRole={collaboratorRole} isArchived={isArchived}
              onLogoSaved={(url) => { onLogoSaved(url); if (url) onSetStep("look", "done"); }} />
          </div>
          <div className="gr-panel-actions">
            <button className="btn btn-secondary" onClick={() => onSetStep("look", "done")} disabled={disabled}>Looks good as is</button>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <section className="gr-card" aria-labelledby="gr-title">
      <div className="gr-head">
        <h2 id="gr-title" className="gr-title">Getting ready</h2>
        <span className="gr-count">{doneCount} of {total} · saved for everyone</span>
        {canEdit && <button className="gr-dismiss" onClick={onDismiss}>Dismiss</button>}
      </div>
      <div className="gr-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={doneCount} aria-label={`${doneCount} of ${total} steps done`}>
        {SETUP_STEPS.map(s => <i key={s.id} className={status[s.id] === "done" ? "on" : ""} />)}
      </div>

      <div className="gr-steps">
        {SETUP_STEPS.map((s, i) => {
          const st = status[s.id];
          const isOpen = open === s.id && st !== "done" && s.id !== "event";
          const current = s.id === firstTodo;
          const act = actionFor[s.id];
          return (
            <div key={s.id} className={`gr-step gr-step-${st}${current ? " now" : ""}`}>
              <div className="gr-row">
                <span className="gr-num" aria-hidden="true">{st === "done" ? <Icon name="check" context="badge" /> : i + 1}</span>
                <div className="gr-text">
                  <b>{s.label}</b>
                  <span>{details[s.id]}</span>
                </div>
                <StatusChip status={st} />
                {st !== "done" && canEdit && (
                  <>
                    {current && act && !isOpen && <button className="btn btn-primary gr-btn" onClick={act.run}>{act.label}</button>}
                    {!(current && act && !isOpen) && (
                      <button className="btn btn-secondary gr-btn" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : s.id)}>
                        {isOpen ? "Close" : st === "skipped" ? "Do it now" : "Open"}
                      </button>
                    )}
                    {st === "todo" && <button className="btn btn-ghost gr-btn" onClick={() => onSetStep(s.id, "skipped")}>Skip</button>}
                  </>
                )}
              </div>
              {isOpen && canEdit && renderPanel(s.id)}
            </div>
          );
        })}
      </div>

      {err && <div className="alert alert-error" role="alert" style={{ marginTop: 10 }}>{err}</div>}
      {!canEdit && <div className="gr-hint" style={{ marginTop: 10 }}>{isArchived ? "This event is archived." : "Only owners and editors can change these steps."}</div>}
      <button className="gr-guide" onClick={onOpenGuide}><Icon name="bookOpen" context="badge" /> Open the SimchaKit Guide</button>

    </section>
  );
}
