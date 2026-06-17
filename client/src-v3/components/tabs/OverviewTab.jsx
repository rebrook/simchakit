// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — OverviewTab.jsx
// Ported from V2. Reads aggregated data from Supabase collections.
// Notes are saved directly to events.quick_notes.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase }           from "@/lib/supabase.js";
import { useEventData }       from "@/hooks/useEventData.js";
import { EVENT_TYPE_ICON_KEYS } from "@/constants/events.js";
import { getCountdown, formatDate, formatEntryMeta, sortTimeline } from "@/utils/dates.js";
import { GetStartedCard }     from "@/components/shared/GetStartedCard.jsx";
import { generateEventBriefHTML } from "@/utils/exports.js";
import { Icon }               from "@/utils/iconMap.jsx";
import { StatCard }          from "@/components/shared/StatCard.jsx";
import { FocusPanel }        from "@/components/shared/FocusPanel.jsx";
import { computeFocusItems } from "@/utils/focus.js";

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

export function OverviewTab({ eventId, event, adminConfig, showToast, setActiveTab, onOpenAdmin, onOpenAdminTo, onOpenGuide, onPrintBrief, isViewer, setTopbarSubtitle, userName }) {
  const config    = adminConfig || {};
  const isMobile  = useIsMobile();
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
  const { items: households, loading: householdsLoading }  = useEventData(eventId, "households");
  const { items: people, loading: peopleLoading }          = useEventData(eventId, "people");
  const { items: expenses, loading: expensesLoading }      = useEventData(eventId, "expenses");
  const { items: tasks, loading: tasksLoading }             = useEventData(eventId, "tasks");
  const { items: vendors, loading: vendorsLoading }         = useEventData(eventId, "vendors");
  const { items: tables, loading: tablesLoading }           = useEventData(eventId, "tables");
  const { items: seatingRows, loading: seatingLoading }     = useEventData(eventId, "seating");

  const dataLoading = householdsLoading || peopleLoading || expensesLoading
    || tasksLoading || vendorsLoading || tablesLoading || seatingLoading;

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

  const handlePrintBrief = useCallback(() => {
    const state = { people, households, expenses, vendors, tasks, ceremonyRoles };
    setBriefHTML(generateEventBriefHTML(state, adminConfig));
  }, [people, households, expenses, vendors, tasks, ceremonyRoles, adminConfig]);

  // Listen for top-bar Print Brief trigger (desktop)
  useEffect(() => {
    const handler = () => handlePrintBrief();
    window.addEventListener("simchakit:print-brief", handler);
    return () => window.removeEventListener("simchakit:print-brief", handler);
  }, [handlePrintBrief]);

  // Share brief (mobile) — text+link via OS share sheet, fallback to print modal
  const handleShareBrief = async () => {
    const eventName = config.name || "My Event";
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${eventName} — Event Brief`,
          text: `${eventName} event brief on SimchaKit`,
          url: window.location.href,
        });
        return; // success or user completed
      }
    } catch (err) {
      if (err.name === "AbortError") return; // user cancelled — no-op
      // any other error — fall through to print
    }
    handlePrintBrief();
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


  // Stats — memoized so the 1s countdown tick doesn't refilter
  const {
    totalBudget, totalPaid, tasksDone, tasksTotal,
    vendorsBooked, confirmedCount, outOfTownCount,
  } = useMemo(() => ({
    totalBudget:    expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0),
    totalPaid:      expenses.filter(e => e.paid).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0),
    tasksDone:      tasks.filter(t => t.done && !t.dismissed).length,
    tasksTotal:     tasks.filter(t => !t.dismissed).length,
    vendorsBooked:  vendors.filter(v => ["Booked","Deposit Paid","Paid in Full"].includes(v.status)).length,
    confirmedCount: people.filter(p => (p.attendingSections || []).length > 0).length,
    outOfTownCount: households.filter(h => h.outOfTown).length,
  }), [expenses, tasks, vendors, people, households]);

  // Completion tone: green when done, baseTone otherwise.
  // Uses >= and rounds to cents for currency (floats).
  const completionTone = (done, total, baseTone) =>
    total > 0 && Math.round(done * 100) >= Math.round(total * 100) ? "green" : baseTone;

  // Focus panel items — memoized
  const focusItems = useMemo(
    () => computeFocusItems({ tasks, expenses, people, households, vendors, tables, seatingRows }, config),
    [tasks, expenses, people, households, vendors, tables, seatingRows, config],
  );

  const STORAGE_KEY = `simchakit-getstarted-dismissed-${eventId || "default"}`;
  const [showChecklist, setShowChecklist] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) !== "1"; } catch { return true; }
  });

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

      {/* Action row */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
        {!showChecklist && (
          <button className="btn btn-ghost btn-sm" onClick={() => {
            try { localStorage.removeItem(`simchakit-getstarted-dismissed-${eventId || "default"}`); } catch {}
            setShowChecklist(true);
          }}
            style={{ fontSize: 12 }}>
            <Icon name="hand" context="inline" style={{ marginRight: 4 }} /> Setup checklist
          </button>
        )}
        {/* Mobile only — desktop uses the top-bar Print Brief */}
        {isMobile && (
          <button className="btn btn-secondary btn-sm" onClick={handleShareBrief}
            style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, fontSize: 12 }}>
            <Icon name="share" context="inline" /> Share brief
          </button>
        )}
      </div>

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
            <div style={{ position: "absolute", right: -10, top: "50%", transform: "translateY(-50%)", opacity: 0.10, pointerEvents: "none", userSelect: "none", color: "currentColor" }}>
              <Icon name={EVENT_TYPE_ICON_KEYS[config.type] || "sparkles"} size={80} strokeWidth={1.25} />
            </div>
            <div className="countdown-label">Counting down to</div>
            <div className="countdown-title">{config.name || mainEvent?.title || "The Big Day"}</div>
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
          onNavigate={setActiveTab}
        />
      </div>

      {/* Stat cards — primary (fractional with completion rings) */}
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <StatCard
          label="RSVPs Confirmed"
          value={confirmedCount}
          total={people.length}
          tone="green"
          display="ring"
          sub="confirmed"
          subFallback="No guests added"
          onClick={() => setActiveTab && setActiveTab("guests")}
          title="Go to guests tab"
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
