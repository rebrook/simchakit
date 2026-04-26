// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — OverviewTab.jsx
// Ported from V2. Reads aggregated data from Supabase collections.
// Notes are saved directly to events.quick_notes.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase }           from "@/lib/supabase.js";
import { useEventData }       from "@/hooks/useEventData.js";
import { EVENT_TYPE_ICONS }   from "@/constants/events.js";
import { getCountdown, formatDate, formatEntryMeta, sortTimeline } from "@/utils/dates.js";
import { GetStartedCard }     from "@/components/shared/GetStartedCard.jsx";
import { generateEventBriefHTML } from "@/utils/exports.js";

export function OverviewTab({ eventId, event, adminConfig, showToast, setActiveTab, onOpenAdmin, onOpenAdminTo, onOpenGuide, onPrintBrief }) {
  const config    = adminConfig || {};
  const mainEvent = (config.timeline || []).find(e => e.isMainEvent) || null;
  const eventDate = mainEvent?.startDate || null;
  const eventVenue = mainEvent?.venue || null;

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

  // Load aggregated data for stat cards and seating warning
  const { items: households }  = useEventData(eventId, "households");
  const { items: people }      = useEventData(eventId, "people");
  const { items: expenses }    = useEventData(eventId, "expenses");
  const { items: tasks }       = useEventData(eventId, "tasks");
  const { items: vendors }     = useEventData(eventId, "vendors");
  const { items: tables }      = useEventData(eventId, "tables");
  const { items: seatingRows } = useEventData(eventId, "seating");

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
  const printFrameRef = useRef(null);

  const handlePrintBrief = () => {
    const state = { people, households, expenses, vendors, tasks, ceremonyRoles };
    setBriefHTML(generateEventBriefHTML(state, adminConfig));
  };

  const timelineEntries = sortTimeline(config.timeline || []);

  // Sub-event counts
  const getSubEventCounts = (sectionId) => {
    const invitedHHIds = new Set(
      households.filter(h => (h.invitedSections || []).includes(sectionId)).map(h => h.id)
    );
    const invitedPeople  = people.filter(p => invitedHHIds.has(p.householdId));
    const confirmedCount = people.filter(p => (p.attendingSections || []).includes(sectionId)).length;
    return { invited: invitedPeople.length, confirmed: confirmedCount };
  };

  const navCard = (tab) => ({
    onClick:  () => setActiveTab && setActiveTab(tab),
    style:    { cursor: "pointer", display: "block", textAlign: "left", font: "inherit" },
    title:    `Go to ${tab} tab`,
    type:     "button",
  });

  // Stats
  const totalBudget  = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalPaid    = expenses.filter(e => e.paid).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const tasksDone    = tasks.filter(t => t.done && !t.dismissed).length;
  const tasksTotal   = tasks.filter(t => !t.dismissed).length;
  const vendorsBooked = vendors.filter(v => ["Booked","Deposit Paid","Paid in Full"].includes(v.status)).length;
  const confirmedCount = people.filter(p => (p.attendingSections || []).length > 0).length;
  const outOfTownCount = households.filter(h => h.outOfTown).length;

  // seatingRows used inline in seating gap warning below

  return (
    <div>
      {/* Section header */}
      <div className="section-header" style={{ marginBottom: 20 }}>
        <div>
          <div className="section-title">Overview</div>
          <div className="section-subtitle">Event summary and countdown</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handlePrintBrief}
          style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          🖨 Print Brief
        </button>
      </div>

      {/* Get Started card */}
      <GetStartedCard
        state={{ households, people }}
        adminConfig={config}
        setActiveTab={setActiveTab}
        onOpenAdmin={onOpenAdmin}
        onOpenGuide={onOpenGuide}
      />

      {/* Countdown */}
      {eventDate && countdown ? (
        <div className="countdown-card">
          <div style={{ position: "absolute", right: 28, top: "50%", transform: "translateY(-50%)", fontSize: 80, opacity: 0.08, lineHeight: 1, pointerEvents: "none", userSelect: "none" }}>
            {EVENT_TYPE_ICONS[config.type] || "✡"}
          </div>
          <div className="countdown-label">Counting down to</div>
          <div className="countdown-title">{mainEvent?.title || config.name || "The Big Day"}</div>
          <div className="countdown-date">{formatDate(eventDate)}{eventVenue ? ` · ${eventVenue}` : ""}</div>
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
            <span className="tag" style={{ background: "rgba(255,255,255,0.2)", color: "white", fontSize: 12 }}>
              ⚙ Click the gear icon in the header to configure your event
            </span>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
        <button type="button" className="stat-card" {...navCard("guests")}>
          <div className="stat-label">Guests Invited</div>
          <div className="stat-value stat-accent">{people.length}</div>
          <div className="stat-sub">{households.length} households</div>
        </button>
        <button type="button" className="stat-card" {...navCard("guests")}>
          <div className="stat-label">RSVPs Confirmed</div>
          <div className="stat-value stat-green">{confirmedCount}</div>
          <div className="stat-sub">of {people.length} invited</div>
        </button>
        <button type="button" className="stat-card" {...navCard("budget")}>
          <div className="stat-label">Budget Paid</div>
          <div className="stat-value stat-green">${totalPaid.toLocaleString()}</div>
          <div className="stat-sub">of ${totalBudget.toLocaleString()} total</div>
        </button>
        <button type="button" className="stat-card" {...navCard("tasks")}>
          <div className="stat-label">Tasks Done</div>
          <div className="stat-value stat-gold">{tasksDone}</div>
          <div className="stat-sub">of {tasksTotal} tasks</div>
        </button>
        <button type="button" className="stat-card" {...navCard("vendors")}>
          <div className="stat-label">Vendors Booked</div>
          <div className="stat-value">{vendorsBooked}</div>
          <div className="stat-sub">of {vendors.length} vendors</div>
        </button>
        <button type="button" className="stat-card" {...navCard("accommodations")}>
          <div className="stat-label">Out of Town</div>
          <div className="stat-value stat-gold">{outOfTownCount}</div>
          <div className="stat-sub">households travelling</div>
        </button>
      </div>

      {/* Seating gap warning — one per enabled section that has a gap */}
      {(() => {
        const seatingCfg = (seatingRows[0]) || {};
        const hasSeat    = !!seatingCfg.hasSeating;
        const sections   = seatingCfg.enabledSections || (seatingCfg.eventSectionId ? [seatingCfg.eventSectionId] : []);
        if (!hasSeat || sections.length === 0 || tables.length === 0) return null;

        const warnings = sections.map(sid => {
          const sectionTables = tables.filter(t => t.sectionId === sid || !t.sectionId);
          const totalSeats    = sectionTables.reduce((s, t) => s + (parseInt(t.capacity) || 0), 0);
          const confirmed     = people.filter(p => (p.attendingSections||[]).includes(sid)).length;
          const gap           = confirmed - totalSeats;
          if (sectionTables.length === 0 || confirmed === 0 || gap <= 0) return null;
          const entry = (config.timeline||[]).find(e => e.id === sid);
          const label = entry ? `${entry.icon||"📅"} ${entry.title}` : sid;
          return { label, totalSeats, confirmed, gap };
        }).filter(Boolean);

        if (warnings.length === 0) return null;
        return warnings.map((w, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
            background: "var(--red-light)", border: "1px solid var(--red)",
            borderRadius: "var(--radius-md)", padding: "12px 16px", marginBottom: 12,
            fontSize: 13, color: "var(--red)",
          }}>
            <span style={{ fontSize: 16 }}>⚠</span>
            <span style={{ flex: 1 }}>
              <strong>Seating gap ({w.label}) —</strong> {w.totalSeats} seat{w.totalSeats !== 1 ? "s" : ""} configured
              for <strong>{w.confirmed}</strong> confirmed guest{w.confirmed !== 1 ? "s" : ""}. {w.gap} additional seat{w.gap !== 1 ? "s" : ""} needed.
            </span>
            <button className="btn btn-sm" onClick={() => setActiveTab && setActiveTab("seating")}
              style={{ background: "var(--red)", color: "white", border: "none", flexShrink: 0, fontSize: 12 }}>
              → Seating
            </button>
          </div>
        ));
      })()}

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
                <div style={{ fontSize: 24, marginBottom: 8 }}>📅</div>
                <div style={{ fontSize: 13, marginBottom: 8 }}>No events scheduled yet.</div>
                {onOpenAdmin && (
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={onOpenAdmin}>
                    ⚙ Add timeline in Admin Mode
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
                    <div className="timeline-icon">{item.icon || "📅"}</div>
                    <div className="timeline-content">
                      <div className="timeline-title">{item.title}</div>
                      <div className="timeline-meta">{formatEntryMeta(item)}</div>
                      {counts.invited > 0 && (
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                          👥 {counts.invited} invited · {counts.confirmed} confirmed
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
                className="btn btn-secondary" style={{ width: "100%", justifyContent: "center" }}>
                📬 RSVP Website →
              </a>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">Quick Notes</div>
          <div className="card-subtitle">Your private planning notes — saved automatically</div>
          <textarea
            className="notes-area"
            style={{ minHeight: 240 }}
            value={localNotes}
            placeholder="Jot down ideas, reminders, open questions, things to follow up on, or anything you want to remember…"
            onChange={e => handleNotes(e.target.value)}
          />
          {config.notes && (
            <>
              <div className="divider" />
              <div style={{ background: "var(--gold-light)", border: "1px solid var(--gold)", borderRadius: "var(--radius-sm)", padding: "8px 12px", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                <span style={{ fontWeight: 700, color: "var(--gold)", marginRight: 6 }}>📌 Admin Note</span>
                {config.notes}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Print Brief preview modal */}
      {briefHTML && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }} onMouseDown={e => { if (e.target === e.currentTarget) setBriefHTML(null); }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--bg-surface)", borderRadius: "var(--radius-lg)",
            width: "95%", maxWidth: 960, height: "90vh",
            display: "flex", flexDirection: "column", boxShadow: "var(--shadow-lg)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>
                Print Preview — Event Brief
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary" style={{ fontSize: 12 }}
                  onClick={() => { if (printFrameRef.current?.contentWindow) printFrameRef.current.contentWindow.print(); }}>
                  🖨 Print / Save PDF
                </button>
                <button className="icon-btn" title="Close" onClick={() => setBriefHTML(null)}>✕</button>
              </div>
            </div>
            <iframe ref={printFrameRef} srcDoc={briefHTML}
              style={{ flex: 1, border: "none", borderRadius: "0 0 var(--radius-lg) var(--radius-lg)" }}
              title="Event Brief Print Preview" />
          </div>
        </div>
      )}
    </div>
  );
}
