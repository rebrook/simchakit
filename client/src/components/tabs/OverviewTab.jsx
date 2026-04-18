import { useState, useEffect, useRef } from "react";
import { EVENT_TYPE_ICONS } from "@/constants/events.js";
import { getCountdown, formatDate, formatEntryMeta, sortTimeline } from "@/utils/dates.js";

import { GetStartedCard } from "@/components/shared/GetStartedCard.jsx";

export function OverviewTab({ state, updateNotes, setActiveTab, onOpenAdmin, onOpenAdminTo, onOpenGuide, onPrintBrief }) {
  const config      = state?.adminConfig || {};
  const mainEvent   = (config.timeline || []).find(e => e.isMainEvent) || null;
  const eventDate   = mainEvent?.startDate || null;
  const eventVenue  = mainEvent?.venue || null;
  const [countdown, setCountdown] = useState(() => eventDate ? getCountdown(eventDate) : null);

  useEffect(() => {
    if (!eventDate) { setCountdown(null); return; }
    setCountdown(getCountdown(eventDate));
    const timer = setInterval(() => setCountdown(getCountdown(eventDate)), 1000);
    return () => clearInterval(timer);
  }, [eventDate]);

  const notesTimeout = useRef(null);
  const handleNotes = (val) => {
    clearTimeout(notesTimeout.current);
    notesTimeout.current = setTimeout(() => updateNotes(val), 600);
  };

  const [localNotes, setLocalNotes] = useState(state?.quickNotes || "");
  useEffect(() => {
    setLocalNotes(state?.quickNotes || "");
  }, [state?.quickNotes]);

  const timelineEntries = sortTimeline(config.timeline || []);

  // Compute invited/confirmed counts per sub-event
  const getSubEventCounts = (eventId) => {
    const households = state?.households || [];
    const people = state?.people || [];
    
    // Find households invited to this sub-event
    const invitedHouseholdIds = new Set(
      households
        .filter(h => (h.invitedSections || []).includes(eventId))
        .map(h => h.id)
    );
    
    // Count people in those households (invited)
    const invitedPeople = people.filter(p => invitedHouseholdIds.has(p.householdId));
    const invited = invitedPeople.length;
    
    // Count people confirmed for this sub-event
    const confirmed = people.filter(p => 
      (p.attendingSections || []).includes(eventId)
    ).length;
    
    return { invited, confirmed };
  };

  const navCard = (tab) => ({
    onClick: () => setActiveTab(tab),
    style: { cursor: "pointer" },
    title: `Go to ${tab} tab`,
  });

  return (
    <div>
      {/* Section header */}
      <div className="section-header" style={{ marginBottom: 20 }}>
        <div>
          <div className="section-title">Overview</div>
          <div className="section-subtitle">Event summary and countdown</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={onPrintBrief}
          style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
          🖨 Print Brief
        </button>
      </div>

      {/* Get Started card */}
      <GetStartedCard
        state={state}
        adminConfig={state?.adminConfig}
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

      {/* Stats — each card navigates to its tab on click */}
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
        <div className="stat-card" {...navCard("guests")}>
          <div className="stat-label">Guests Invited</div>
          <div className="stat-value stat-accent">{(state?.people || []).length}</div>
          <div className="stat-sub">{(state?.households || []).length} households</div>
        </div>
        <div className="stat-card" {...navCard("guests")}>
          <div className="stat-label">RSVPs Confirmed</div>
          <div className="stat-value stat-green">
            {(state?.people||[]).filter(p=>(p.attendingSections||[]).length > 0).length}
          </div>
          <div className="stat-sub">of {(state?.people || []).length} invited</div>
        </div>
        <div className="stat-card" {...navCard("budget")}>
          <div className="stat-label">Budget Paid</div>
          <div className="stat-value stat-green">
            ${(state?.expenses || []).filter(e => e.paid).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0).toLocaleString()}
          </div>
          <div className="stat-sub">
            of ${(state?.expenses || []).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0).toLocaleString()} total
          </div>
        </div>
        <div className="stat-card" {...navCard("tasks")}>
          <div className="stat-label">Tasks Done</div>
          <div className="stat-value stat-gold">
            {(state?.tasks || []).filter(t => t.done).length}
          </div>
          <div className="stat-sub">of {(state?.tasks || []).length} tasks</div>
        </div>
        <div className="stat-card" {...navCard("vendors")}>
          <div className="stat-label">Vendors Booked</div>
          <div className="stat-value">
            {(state?.vendors || []).filter(v => ["Booked","Deposit Paid","Paid in Full"].includes(v.status)).length}
          </div>
          <div className="stat-sub">of {(state?.vendors || []).length} vendors</div>
        </div>
        <div className="stat-card" {...navCard("guests")}>
          <div className="stat-label">Out of Town</div>
          <div className="stat-value stat-gold">
            {(state?.households||[]).filter(h => h.outOfTown).length}
          </div>
          <div className="stat-sub">households travelling</div>
        </div>
      </div>

      {/* Seating gap warning */}
      {(() => {
        const tables       = state?.tables || [];
        const people       = state?.people || [];
        const seatingCfg   = state?.seating?.config || {};
        const hasSeat      = !!seatingCfg.hasSeating;
        const seatSection  = seatingCfg.eventSectionId || "";
        const totalSeats   = tables.reduce((s, t) => s + (parseInt(t.capacity) || 0), 0);
        // Only show gap warning when seating is configured for a specific sub-event
        if (!hasSeat || !seatSection) return null;
        const confirmed    = people.filter(p => (p.attendingSections||[]).includes(seatSection)).length;
        const gap = confirmed - totalSeats;
        if (tables.length === 0 || confirmed === 0 || gap <= 0) return null;
        return (
          <div style={{
            display:"flex", alignItems:"center", gap:12, flexWrap:"wrap",
            background:"var(--red-light)", border:"1px solid var(--red)",
            borderRadius:"var(--radius-md)", padding:"12px 16px", marginBottom:20,
            fontSize:13, color:"var(--red)",
          }}>
            <span style={{fontSize:16}}>⚠</span>
            <span style={{flex:1}}>
              <strong>Seating gap —</strong> {totalSeats} seat{totalSeats!==1?"s":""} configured
              for <strong>{confirmed}</strong> confirmed guest{confirmed!==1?"s":""}. {gap} additional seat{gap!==1?"s":""} needed.
            </span>
            <button className="btn btn-sm" onClick={() => setActiveTab("seating")}
              style={{
                background:"var(--red)", color:"white", border:"none",
                flexShrink:0, fontSize:12,
              }}>
              → Seating
            </button>
          </div>
        );
      })()}

      {/* Two-column: timeline + notes */}
      <div className="two-col">
        <div className="card">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
            <div className="card-title" style={{ marginBottom:0 }}>Event Timeline</div>
            {!state?.archived && (
              <button className="btn btn-ghost btn-sm" style={{ fontSize:11, padding:"3px 8px" }}
                onClick={() => onOpenAdminTo ? onOpenAdminTo("timeline") : onOpenAdmin()}>
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
              <div style={{ textAlign:"center", padding:"24px 12px", color:"var(--text-muted)" }}>
                <div style={{ fontSize:24, marginBottom:8 }}>📅</div>
                <div style={{ fontSize:13, marginBottom:8 }}>No events scheduled yet.</div>
                <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={onOpenAdmin}>
                  ⚙ Add timeline in Admin Mode
                </button>
              </div>
            ) : (
              timelineEntries.map((item, i) => {
                const dateStr = item.startDate
                  ? new Date(item.startDate + "T00:00:00").toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })
                  : "";
                const counts = getSubEventCounts(item.id);
                return (
                  <div className="timeline-item" key={item.id || i}>
                    <div className="timeline-icon">{item.icon || "📅"}</div>
                    <div className="timeline-content">
                      <div className="timeline-title">{item.title}</div>
                      <div className="timeline-meta">{formatEntryMeta(item)}</div>
                      {counts.invited > 0 && (
                        <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:4 }}>
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
          <div className="card-subtitle">Your private planning notes — synced in real time across all devices</div>
          <textarea
            className="notes-area"
            style={{ minHeight: 240 }}
            value={localNotes}
            placeholder="Jot down ideas, reminders, open questions, things to follow up on, or anything you want to remember…"
            onChange={e => {
              setLocalNotes(e.target.value);
              handleNotes(e.target.value);
            }}
          />
          {config.notes && (
            <>
              <div className="divider" />
              <div style={{
                background: "var(--gold-light)", border: "1px solid var(--gold)",
                borderRadius: "var(--radius-sm)", padding: "8px 12px",
                fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6,
              }}>
                <span style={{ fontWeight: 700, color: "var(--gold)", marginRight: 6 }}>📌 Admin Note</span>
                {config.notes}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
