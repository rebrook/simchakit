// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.7.0 — CreateEventForm.jsx
// First-run create screen: type, name, date, optional venue and the events to
// track (seeded by type), with a live countdown preview. Appears above the
// event grid; on phones the preview drops below the form.
// Writes: events (INSERT, with the sub-events as the timeline) + user_profiles.event_count (increment).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { supabase } from "@/lib/supabase.js";
import { Icon } from "@/utils/iconMap.jsx";
import { EVENT_TYPE_ICON_KEYS } from "@/constants/events.js";
import { seedSubEventNames, buildSeedTimeline } from "@/utils/eventSeeds.js";
import { formatDate } from "@/utils/dates.js";

const EVENT_TYPES = [
  { value: "bat-mitzvah",  label: "Bat Mitzvah" },
  { value: "bar-mitzvah",  label: "Bar Mitzvah" },
  { value: "wedding",      label: "Wedding" },
  { value: "bnei-mitzvah", label: "B'nei Mitzvah" },
  { value: "baby-naming",  label: "Baby Naming" },
  { value: "graduation",   label: "Graduation" },
  { value: "anniversary",  label: "Anniversary" },
  { value: "birthday",     label: "Birthday" },
  { value: "other",        label: "Other Celebration" },
];
const TYPES_SHOWN = 3;

const seedEvents = (t) => seedSubEventNames(t).map(n => ({ name: n, on: true }));

function daysUntil(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d) - today) / 86400000);
}

export function CreateEventForm({ userId, userEmail, onCreated, onCancel }) {
  const [name,    setName]    = useState("");
  const [type,    setType]    = useState("bat-mitzvah");
  const [date,    setDate]    = useState("");
  const [venue,   setVenue]   = useState("");
  const [events,  setEvents]  = useState(() => seedEvents("bat-mitzvah"));
  const [edited,  setEdited]  = useState(false);   // true once the user touches the events list
  const [adding,  setAdding]  = useState(false);
  const [newName, setNewName] = useState("");
  const [showAllTypes, setShowAllTypes] = useState(false);
  const [status,  setStatus]  = useState("idle"); // idle | loading | error
  const [errorMsg, setErrorMsg] = useState("");

  const canSubmit = name.trim().length > 0 && status !== "loading";
  const busy = status === "loading";

  function pickType(t) {
    setType(t);
    if (!edited) setEvents(seedEvents(t));
  }

  function toggleEvent(i) {
    setEdited(true);
    setEvents(list => list.map((e, j) => j === i ? { ...e, on: !e.on } : e));
  }

  function addEvent() {
    const n = newName.trim();
    setNewName(""); setAdding(false);
    if (!n || events.some(e => e.name.toLowerCase() === n.toLowerCase())) return;
    setEdited(true);
    setEvents(list => [...list, { name: n, on: true }]);
  }

  async function handleCreate() {
    if (!canSubmit) return;
    setStatus("loading");
    setErrorMsg("");

    // Sub-events chosen on the form become the timeline, so RSVP per sub-event
    // works from day one. The first one is the main event (the countdown).
    const chosen   = events.filter(e => e.on).map(e => e.name);
    const timeline = buildSeedTimeline(chosen.length ? chosen : [name.trim()], date, venue.trim());
    const adminConfig = {
      name: name.trim(),
      type,
      theme: { palette: "rose", name: "", icon: "" },
      timeline,
    };

    // INSERT event
    const { data: event, error: insertError } = await supabase
      .from("events")
      .insert({
        owner_id:     userId,
        name:         name.trim(),
        type,
        admin_config: adminConfig,
      })
      .select("id, name, type, archived, admin_config, created_at, updated_at")
      .single();

    if (insertError) {
      setStatus("error");
      setErrorMsg(insertError.message || "Could not create event.");
      return;
    }

    // Send admin notification (best-effort, non-blocking)
    fetch("/api/notify", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        type: "new_event",
        data: {
          eventName: name.trim(),
          eventType: type,
          eventId:   event.id,
          userId,
        },
      }),
    }).catch(() => {});

    // Brevo contact sync — update with event details and mark as purchaser (best-effort, non-blocking)
    // userEmail prop required — if missing, skip sync gracefully
    if (userEmail) {
      fetch("/api/brevo-sync", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          email:     userEmail,
          isNewUser: false,
          attributes: {
            EVENT_NAME:    name.trim(),
            EVENT_TYPE:    type,
            EVENT_DATE:    date || "",
            HAS_PURCHASED: true,
          },
        }),
      }).catch(() => {});
    }

    // Increment event_count on user_profiles (best-effort, non-blocking)
    supabase.rpc("increment_event_count", { user_id: userId }).then(({ error }) => {
      if (error) console.warn("[SimchaKit] Could not increment event_count:", error.message);
    });

    setStatus("idle");
    onCreated(event);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && canSubmit) handleCreate();
    if (e.key === "Escape") onCancel();
  }

  const typeLabel   = EVENT_TYPES.find(t => t.value === type)?.label || "";
  const visibleTypes = showAllTypes || EVENT_TYPES.findIndex(t => t.value === type) >= TYPES_SHOWN
    ? EVENT_TYPES : EVENT_TYPES.slice(0, TYPES_SHOWN);
  const days = date ? daysUntil(date) : null;

  return (
    <div className="create-event">
      <div className="create-event-form">
        <div className="create-event-title">Let's set up your celebration</div>

        <div>
          <div className="create-event-label" id="ce-type-label">What are you celebrating?</div>
          <div className="create-event-chips" role="group" aria-labelledby="ce-type-label">
            {visibleTypes.map(t => (
              <button key={t.value} type="button" className={`create-chip${type === t.value ? " on" : ""}`}
                aria-pressed={type === t.value} onClick={() => pickType(t.value)} disabled={busy}>
                {type === t.value && <Icon name="check" context="badge" />}
                {t.label}
              </button>
            ))}
            {visibleTypes.length < EVENT_TYPES.length && (
              <button type="button" className="create-chip" onClick={() => setShowAllTypes(true)}>
                + {EVENT_TYPES.length - visibleTypes.length} more
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="create-event-label" htmlFor="ce-name">Name *</label>
          <input id="ce-name" className="create-input" type="text" value={name}
            onChange={e => setName(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={`e.g. Maya's ${typeLabel}`} autoFocus autoComplete="off" disabled={busy} />
        </div>

        <div className="create-event-row">
          <div>
            <label className="create-event-label" htmlFor="ce-date">Date</label>
            <input id="ce-date" className="create-input" type="date" value={date}
              onChange={e => setDate(e.target.value)} disabled={busy} />
          </div>
          <div>
            <label className="create-event-label" htmlFor="ce-venue">Venue (optional)</label>
            <input id="ce-venue" className="create-input" type="text" value={venue}
              onChange={e => setVenue(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="e.g. Beth Shalom" autoComplete="off" disabled={busy} />
          </div>
        </div>

        <div>
          <div className="create-event-label" id="ce-events-label">Events to track</div>
          <div className="create-event-chips" role="group" aria-labelledby="ce-events-label">
            {events.map((e, i) => (
              <button key={e.name} type="button" className={`create-chip${e.on ? " on" : ""}`}
                aria-pressed={e.on} onClick={() => toggleEvent(i)} disabled={busy}>
                {e.on && <Icon name="check" context="badge" />}
                {e.name}
              </button>
            ))}
            {adding ? (
              <input className="create-input create-input-inline" autoFocus value={newName}
                onChange={e => setNewName(e.target.value)} placeholder="e.g. Rehearsal dinner"
                aria-label="New event name" maxLength={60}
                onBlur={addEvent}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addEvent(); } if (e.key === "Escape") { setNewName(""); setAdding(false); } }} />
            ) : (
              <button type="button" className="create-chip" onClick={() => setAdding(true)} disabled={busy}>
                <Icon name="plus" context="badge" /> Add
              </button>
            )}
          </div>
          <div className="create-event-hint">Guests can reply per event. You can change these any time in Admin.</div>
        </div>

        <button type="button" className="btn btn-primary create-event-submit" onClick={handleCreate} disabled={!canSubmit}>
          {busy ? "Creating…" : "Create event"}
        </button>
        <button type="button" className="create-event-cancel" onClick={onCancel} disabled={busy}>Cancel</button>
        {status === "error" && <div className="create-event-error" role="alert">{errorMsg}</div>}
      </div>

      <div className="create-event-side">
        <div className="create-event-label">Preview</div>
        <div className="create-preview" aria-live="polite">
          <div className="create-preview-label">Counting down to</div>
          <div className="create-preview-title">
            <Icon name={EVENT_TYPE_ICON_KEYS[type] || "sparkles"} size={22} strokeWidth={1.5} />
            {name.trim() || `Your ${typeLabel}`}
          </div>
          <div className="create-preview-date">
            {date ? formatDate(date) : "Pick a date to start the countdown"}
            {venue.trim() ? ` · ${venue.trim()}` : ""}
          </div>
          {days !== null && days >= 0 && (
            <div className="create-preview-days">{days}<span>{days === 1 ? "day" : "days"}</span></div>
          )}
          {days !== null && days < 0 && <div className="create-preview-date">That date has passed</div>}
        </div>
        <p className="create-event-hint">Dates and details can change later.</p>
      </div>
    </div>
  );
}
