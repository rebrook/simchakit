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
import { Icon }               from "@/utils/iconMap.jsx";
import { StatCard }          from "@/components/shared/StatCard.jsx";
import { FocusPanel }        from "@/components/shared/FocusPanel.jsx";
import { computeFocusItems } from "@/utils/focus.js";

export function OverviewTab({ eventId, event, adminConfig, showToast, setActiveTab, onOpenAdmin, onOpenAdminTo, onOpenGuide, onPrintBrief, isViewer }) {
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

  // Load aggregated data for stat cards and focus panel
  const { items: households }  = useEventData(eventId, "households");
  const { items: people }      = useEventData(eventId, "people");
  const { items: expenses }    = useEventData(eventId, "expenses");
  const { items: tasks, loading: tasksLoading } = useEventData(eventId, "tasks");
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


  // Stats
  const totalBudget  = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalPaid    = expenses.filter(e => e.paid).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const tasksDone    = tasks.filter(t => t.done && !t.dismissed).length;
  const tasksTotal   = tasks.filter(t => !t.dismissed).length;
  const vendorsBooked = vendors.filter(v => ["Booked","Deposit Paid","Paid in Full"].includes(v.status)).length;
  const confirmedCount = people.filter(p => (p.attendingSections || []).length > 0).length;
  const outOfTownCount = households.filter(h => h.outOfTown).length;

  // Completion tone: green when done, baseTone otherwise.
  // Uses >= and rounds to cents for currency (floats).
  const completionTone = (done, total, baseTone) =>
    total > 0 && Math.round(done * 100) >= Math.round(total * 100) ? "green" : baseTone;

  // Focus panel items — "What needs you next"
  const focusItems = computeFocusItems(
    { tasks, expenses, people, households, vendors, tables, seatingRows },
    config,
  );

  const STORAGE_KEY = `simchakit-getstarted-dismissed-${eventId || "default"}`;
  const [showChecklist, setShowChecklist] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) !== "1"; } catch { return true; }
  });

  return (
    <div>
      {/* Setup checklist restore button (shown only when checklist is dismissed) */}
      {!showChecklist && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => {
            try { localStorage.removeItem(`simchakit-getstarted-dismissed-${eventId || "default"}`); } catch {}
            setShowChecklist(true);
          }}
            style={{ fontSize: 12 }}>
            <Icon name="hand" context="inline" style={{ marginRight: 4 }} /> Setup checklist
          </button>
        </div>
      )}

      {/* Get Started card */}
      {showChecklist && (
        <GetStartedCard
          state={{ households, people }}
          adminConfig={config}
          setActiveTab={setActiveTab}
          onOpenAdmin={onOpenAdmin}
          onOpenGuide={onOpenGuide}
          eventId={eventId}
          onDismissedChange={(isDismissed) => setShowChecklist(!isDismissed)}
        />
      )}

      {/* Hero row: countdown + focus panel */}
      <div className="overview-hero-row">
        {/* Countdown */}
        {eventDate && countdown ? (
          <div className="countdown-card">
            <div style={{ position: "absolute", right: 28, top: "50%", transform: "translateY(-50%)", fontSize: 80, opacity: 0.08, lineHeight: 1, pointerEvents: "none", userSelect: "none" }}>
              {/* TODO: event-type glyph — decide icon vs emoji separately (data model decision) */}
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
              <span className="tag" style={{ background: "rgba(255,255,255,0.2)", color: "white", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Icon name="settings" context="inline" /> Click the settings icon in the header to configure your event
              </span>
            </div>
          </div>
        )}

        {/* Focus panel — "What needs you next" */}
        <FocusPanel
          items={focusItems}
          loading={tasksLoading}
          onNavigate={setActiveTab}
        />
      </div>

      {/* Stat cards — primary (fractional with progress bars) */}
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <StatCard
          label="RSVPs Confirmed"
          value={confirmedCount}
          total={people.length}
          tone="green"
          sub="confirmed"
          subFallback="No guests added"
          onClick={() => setActiveTab && setActiveTab("guests")}
          title="Go to guests tab"
        />
        <StatCard
          label="Budget Paid"
          value={`$${totalPaid.toLocaleString()}`}
          numericValue={totalPaid}
          total={totalBudget}
          totalDisplay={`$${totalBudget.toLocaleString()}`}
          tone={completionTone(totalPaid, totalBudget, "accent")}
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
          sub="booked"
          subFallback="No vendors yet"
          onClick={() => setActiveTab && setActiveTab("vendors")}
          title="Go to vendors tab"
        />
      </div>

      {/* Stat cards — secondary (simple counts) */}
      <div className="stat-grid-secondary">
        <StatCard
          label="Guests Invited"
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
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                          <Icon name="guests" context="inline" /> {counts.invited} invited · {counts.confirmed} confirmed
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
        <div className="modal-backdrop" style={{ zIndex: 1100 }} onMouseDown={e => { if (e.target === e.currentTarget) setBriefHTML(null); }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--bg-surface)", borderRadius: "var(--radius-lg)",
            width: "95%", maxWidth: 960, height: "90vh",
            display: "flex", flexDirection: "column", boxShadow: "var(--shadow-lg)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>
                Print Preview — Event Brief
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary" style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                  onClick={() => { if (printFrameRef.current?.contentWindow) printFrameRef.current.contentWindow.print(); }}>
                  <Icon name="printer" context="inline" /> Print / Save PDF
                </button>
                <button className="icon-btn" title="Close" onClick={() => setBriefHTML(null)}><Icon name="x" context="button" /></button>
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
