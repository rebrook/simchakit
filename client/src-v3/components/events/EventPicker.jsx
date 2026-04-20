// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — EventPicker.jsx
// Full-page event picker. Matches V2 index.html visual design exactly.
// Lists user's events, handles create + delete, routes into selected event.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { supabase }              from "@/lib/supabase.js";
import { CreateEventForm }       from "./CreateEventForm.jsx";
import { DeleteEventConfirm }    from "./DeleteEventConfirm.jsx";
import { PaywallGate }           from "./PaywallGate.jsx";

// ── Palette + type maps (mirrors V2 index.html exactly) ──────────────────────
const PALETTES = {
  "rose":      { accent: "#c4637a", light: "#fdf0f3" },
  "navy-gold": { accent: "#b8962e", light: "#fdf8ec" },
  "forest":    { accent: "#3d7a5e", light: "#eef6f1" },
  "purple":    { accent: "#6b4fa0", light: "#f3eefa" },
  "slate":     { accent: "#3d5a80", light: "#eef2f8" },
  "copper":    { accent: "#b06030", light: "#fdf4ee" },
  "teal":      { accent: "#2a8a8a", light: "#eaf6f6" },
  "charcoal":  { accent: "#4a4a4a", light: "#f4f4f4" },
  "blush":     { accent: "#c47a8a", light: "#fdf0f3" },
};

const EVENT_TYPE_LABELS = {
  "bat-mitzvah":  "Bat Mitzvah",
  "bar-mitzvah":  "Bar Mitzvah",
  "bnei-mitzvah": "B'nei Mitzvah",
  "wedding":      "Wedding",
  "baby-naming":  "Baby Naming",
  "graduation":   "Graduation",
  "anniversary":  "Anniversary",
  "birthday":     "Birthday",
  "other":        "Celebration",
};

const EVENT_TYPE_ICONS = {
  "bat-mitzvah":  "✡",
  "bar-mitzvah":  "✡",
  "bnei-mitzvah": "✡",
  "wedding":      "💍",
  "baby-naming":  "👶",
  "graduation":   "🎓",
  "anniversary":  "🥂",
  "birthday":     "🎂",
  "other":        "🎉",
};

function formatDate(d) {
  if (!d) return "";
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const m = parseInt(parts[1], 10) - 1;
  return months[m] + " " + parseInt(parts[2], 10) + ", " + parts[0];
}

// ─────────────────────────────────────────────────────────────────────────────
export function EventPicker({ session, onSelectEvent }) {
  const [events,         setEvents]         = useState([]);
  const [loadStatus,     setLoadStatus]     = useState("loading"); // loading | ready | error
  const [loadError,      setLoadError]      = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deleteTarget,   setDeleteTarget]   = useState(null);  // { event, anchorRect }
  const [eventCount,     setEventCount]     = useState(0);     // for paywall gate
  const [pendingPurchaseId, setPendingPurchaseId] = useState(null); // set after Stripe return

  const userId = session.user.id;

  // ── Payment return URL handling ───────────────────────────────────────────
  const [paymentNotice, setPaymentNotice] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("payment");
    if (status === "success")   return "success";
    if (status === "cancelled") return "cancelled";
    return null;
  });

  // Clean ?payment= param from URL without triggering a reload
  useEffect(() => {
    if (paymentNotice) {
      const url = new URL(window.location.href);
      url.searchParams.delete("payment");
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url.toString());
    }
  }, [paymentNotice]);

  // On successful payment return, find the completed purchase with no event_id
  // and open CreateEventForm directly — user has already paid
  useEffect(() => {
    if (paymentNotice !== "success") return;
    async function checkPendingPurchase() {
      const { data } = await supabase
        .from("purchases")
        .select("id")
        .eq("owner_id", userId)
        .eq("status", "completed")
        .is("event_id", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (data?.id) {
        setPendingPurchaseId(data.id);
        setShowCreateForm(true);
      }
    }
    checkPendingPurchase();
  }, [paymentNotice, userId]);

  // ── Load events ────────────────────────────────────────────────────────────
  const loadEvents = useCallback(async () => {
    setLoadStatus("loading");
    const { data, error } = await supabase
      .from("events")
      .select("id, name, type, archived, admin_config, created_at, updated_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      setLoadStatus("error");
      setLoadError(error.message || "Could not load events.");
      return;
    }

    // Sort: active events first, archived last
    const sorted = [...(data || [])].sort((a, b) => {
      if (a.archived !== b.archived) return a.archived ? 1 : -1;
      return new Date(a.created_at) - new Date(b.created_at);
    });

    setEvents(sorted);
    setEventCount(sorted.filter(e => !e.archived).length);
    setLoadStatus("ready");
  }, [userId]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // ── Helpers to derive display values from event row ───────────────────────
  function getEventMeta(ev) {
    const cfg      = ev.admin_config || {};
    const palette  = PALETTES[cfg.theme?.palette] || PALETTES["rose"];
    const typeIcon = cfg.theme?.icon || EVENT_TYPE_ICONS[ev.type] || "🎉";
    const timeline = cfg.timeline || [];
    const mainEntry = timeline.find(t => t.isMainEvent);
    const dateStr  = formatDate(mainEntry?.startDate || "");
    return { palette, typeIcon, dateStr, themeName: cfg.theme?.name || "" };
  }

  // ── Event created callback ────────────────────────────────────────────────
  function handleCreated(newEvent) {
    setShowCreateForm(false);
    setEvents(prev => [...prev, newEvent]);
    setEventCount(prev => prev + 1);

    // If this event was created after a Stripe payment, stamp the purchase row
    if (pendingPurchaseId) {
      supabase
        .from("purchases")
        .update({ event_id: newEvent.id, updated_at: new Date().toISOString() })
        .eq("id", pendingPurchaseId)
        .then(({ error }) => {
          if (error) console.warn("[SimchaKit] Could not stamp event_id on purchase:", error.message);
        });
      setPendingPurchaseId(null);
    }

    // Navigate directly into the new event
    onSelectEvent(newEvent.id);
  }

  // ── Event deleted callback ────────────────────────────────────────────────
  function handleDeleted(deletedId) {
    setDeleteTarget(null);
    setEvents(prev => prev.filter(e => e.id !== deletedId));
    setEventCount(prev => Math.max(0, prev - 1));
  }

  // ── Free coupon granted — reload events and show create form ─────────────
  function handleFreeEventGranted() {
    setShowCreateForm(false);
    loadEvents();
  }

  // ── Paywall check: does the user already have an active event? ────────────
  const hasUsedFreeEvent = eventCount >= 1;
  // After a Stripe payment return, pendingPurchaseId is set — always show CreateEventForm
  const paymentCleared = !!pendingPurchaseId;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Page-level font import ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=DM+Sans:wght@300;400;500;600;700&display=swap');

        .sk-picker-card {
          background:    var(--bg-surface);
          border:        1px solid var(--border);
          border-radius: var(--radius-lg);
          box-shadow:    var(--shadow-sm);
          overflow:      hidden;
          text-decoration: none;
          color:         inherit;
          display:       flex;
          flex-direction: column;
          transition:    transform 0.18s ease, box-shadow 0.18s ease;
          cursor:        pointer;
          position:      relative;
        }
        .sk-picker-card:hover {
          transform:  translateY(-2px);
          box-shadow: var(--shadow-md);
        }
        .sk-picker-card:hover .sk-card-arrow { transform: translateX(4px); }
        .sk-picker-card:hover .sk-delete-btn { opacity: 1; }

        .sk-delete-btn {
          position:      absolute;
          top:           10px;
          right:         10px;
          width:         26px;
          height:        26px;
          border-radius: 50%;
          background:    rgba(0,0,0,0.08);
          border:        none;
          cursor:        pointer;
          font-size:     13px;
          display:       flex;
          align-items:   center;
          justify-content: center;
          opacity:       0;
          transition:    opacity 0.18s ease, background 0.18s ease;
          color:         var(--text-secondary);
          line-height:   1;
        }
        .sk-delete-btn:hover {
          background: rgba(155,35,53,0.15);
          color:      var(--red);
        }

        @media (max-width: 600px) {
          .sk-delete-btn { opacity: 1; }
        }

        .sk-card-arrow {
          font-size:  16px;
          transition: transform 0.18s ease;
        }

        .sk-tag {
          display:      inline-flex;
          align-items:  center;
          gap:          4px;
          padding:      2px 8px;
          border-radius:20px;
          font-size:    11px;
          font-weight:  600;
        }
      `}</style>

      <div style={styles.page}>

        {/* ── Page header ── */}
        <div style={styles.pageHeader}>
          <div>
            <div style={styles.pageTitle}>Your Events</div>
            <div style={styles.pageSub}>Select an event to open its planning dashboard.</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              style={styles.btnNewEvent}
              onClick={() => setShowCreateForm(v => !v)}
            >
              ＋ New Event
            </button>
            <button
              style={styles.btnSignOut}
              onClick={() => supabase.auth.signOut()}
            >
              Sign out
            </button>
          </div>
        </div>

        {/* ── Payment return notices ── */}
        {paymentNotice === "cancelled" && (
          <div style={styles.noticeCancelled}>
            Payment was cancelled — no charge was made.
            <button style={styles.noticeDismiss} onClick={() => setPaymentNotice(null)}>✕</button>
          </div>
        )}
        {paymentNotice === "success" && (
          <div style={styles.noticeSuccess}>
            ✓ Payment confirmed — you can now create your event below.
            <button style={styles.noticeDismiss} onClick={() => setPaymentNotice(null)}>✕</button>
          </div>
        )}

        {/* ── Create event form / paywall ── */}
        {showCreateForm && (
          hasUsedFreeEvent && !paymentCleared ? (
            <PaywallGate
              session={session}
              onFreeEventGranted={handleFreeEventGranted}
              onCancel={() => setShowCreateForm(false)}
            />
          ) : (
            <CreateEventForm
              userId={userId}
              onCreated={handleCreated}
              onCancel={() => setShowCreateForm(false)}
            />
          )
        )}

        {/* ── Event grid ── */}
        {loadStatus === "loading" && (
          <div style={styles.stateBox}>
            <div style={styles.spinner} />
            <div style={styles.stateDesc}>Loading events…</div>
          </div>
        )}

        {loadStatus === "error" && (
          <div style={styles.stateBox}>
            <div style={styles.stateIcon}>⚠</div>
            <div style={styles.stateTitle}>Could not load events</div>
            <div style={styles.stateDesc}>{loadError}</div>
            <button style={styles.btnRetry} onClick={loadEvents}>Try again</button>
          </div>
        )}

        {loadStatus === "ready" && events.length === 0 && (
          <div style={styles.stateBox}>
            <div style={styles.stateIcon}>✡</div>
            <div style={styles.stateTitle}>No events yet</div>
            <div style={styles.stateDesc}>
              Click <strong>＋ New Event</strong> above to create your first event.
            </div>
          </div>
        )}

        {loadStatus === "ready" && events.length > 0 && (
          <div style={styles.eventGrid}>
            {events.map(ev => (
              <EventCard
                key={ev.id}
                event={ev}
                meta={getEventMeta(ev)}
                onSelect={() => onSelectEvent(ev.id)}
                onDeleteClick={(anchorRect) => setDeleteTarget({ event: ev, anchorRect })}
              />
            ))}
          </div>
        )}

        {/* ── Footer ── */}
        <div style={styles.footer}>
          Designed &amp; Built by Ryan Brook &nbsp;·&nbsp; Powered by Claude
        </div>
      </div>

      {/* ── Delete confirm overlay ── */}
      {deleteTarget && (
        <DeleteEventConfirm
          event={deleteTarget.event}
          anchorRect={deleteTarget.anchorRect}
          userId={userId}
          onDeleted={handleDeleted}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}

// ── EventCard ─────────────────────────────────────────────────────────────────
function EventCard({ event, meta, onSelect, onDeleteClick }) {
  const { palette, typeIcon, dateStr, themeName } = meta;
  const typeLabel = EVENT_TYPE_LABELS[event.type] || "Celebration";

  function handleDeleteClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.closest(".sk-picker-card")?.getBoundingClientRect();
    onDeleteClick(rect);
  }

  return (
    <div
      className="sk-picker-card"
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onSelect(); }}
      aria-label={`Open ${event.name || "Unnamed Event"}`}
    >
      {/* Accent stripe */}
      <div style={{ height: 4, background: palette.accent }} />

      {/* Card header */}
      <div style={{ padding: "20px 20px 16px", background: palette.light, position: "relative" }}>
        <span style={{ fontSize: 28, lineHeight: 1, display: "block", marginBottom: 10 }}>
          {typeIcon}
        </span>
        {event.name
          ? <div style={styles.cardName}>{event.name}</div>
          : <div style={styles.cardUnnamed}>Unnamed Event</div>
        }
        {themeName && (
          <div style={styles.cardTheme}>{themeName}</div>
        )}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          <span className="sk-tag" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
            {typeLabel}
          </span>
          {event.archived && (
            <span className="sk-tag" style={{ background: "var(--gold-light)", color: "var(--gold)" }}>
              🔒 Archived
            </span>
          )}
        </div>

        {/* Delete button */}
        <button
          className="sk-delete-btn"
          title="Delete event"
          onClick={handleDeleteClick}
          aria-label="Delete event"
        >
          ✕
        </button>
      </div>

      {/* Card body */}
      <div style={{ padding: "16px 20px", flex: 1, display: "flex", flexDirection: "column", gap: 6, justifyContent: "center" }}>
        {dateStr && (
          <div style={styles.cardDetail}>
            <span style={{ fontSize: 13 }}>📅</span>
            {dateStr}
          </div>
        )}
      </div>

      {/* Card footer */}
      <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", background: palette.light, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: palette.accent }}>
          Open Dashboard
        </span>
        <span className="sk-card-arrow" style={{ color: palette.accent }}>→</span>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  page: {
    maxWidth: 1000,
    margin:   "0 auto",
    padding:  "40px 24px 64px",
    fontFamily: "var(--font-body)",
  },
  pageHeader: {
    display:        "flex",
    alignItems:     "flex-start",
    justifyContent: "space-between",
    gap:            16,
    marginBottom:   6,
    flexWrap:       "wrap",
  },
  pageTitle: {
    fontFamily:   "var(--font-display)",
    fontSize:     28,
    fontWeight:   600,
    color:        "var(--text-primary)",
    marginBottom: 6,
  },
  pageSub: {
    fontSize:     14,
    color:        "var(--text-muted)",
    marginBottom: 32,
  },
  btnNewEvent: {
    display:      "inline-flex",
    alignItems:   "center",
    gap:          6,
    padding:      "8px 16px",
    background:   "var(--text-primary)",
    color:        "var(--bg-surface)",
    border:       "none",
    borderRadius: "var(--radius-md)",
    fontFamily:   "var(--font-body)",
    fontSize:     13,
    fontWeight:   600,
    cursor:       "pointer",
    whiteSpace:   "nowrap",
    minHeight:    36,
    flexShrink:   0,
  },
  btnSignOut: {
    display:      "inline-flex",
    alignItems:   "center",
    padding:      "8px 14px",
    background:   "none",
    color:        "var(--text-muted)",
    border:       "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    fontFamily:   "var(--font-body)",
    fontSize:     13,
    cursor:       "pointer",
    whiteSpace:   "nowrap",
    minHeight:    36,
    flexShrink:   0,
  },
  eventGrid: {
    display:               "grid",
    gridTemplateColumns:   "repeat(auto-fill, minmax(280px, 1fr))",
    gap:                   20,
  },
  stateBox: {
    textAlign:  "center",
    padding:    "64px 24px",
    color:      "var(--text-muted)",
  },
  stateIcon: { fontSize: 40, marginBottom: 16 },
  stateTitle: {
    fontFamily:   "var(--font-display)",
    fontSize:     20,
    fontWeight:   600,
    color:        "var(--text-primary)",
    marginBottom: 8,
  },
  stateDesc: { fontSize: 14, lineHeight: 1.6, maxWidth: 400, margin: "0 auto" },
  btnRetry: {
    marginTop:    16,
    padding:      "8px 18px",
    background:   "var(--text-primary)",
    color:        "var(--bg-surface)",
    border:       "none",
    borderRadius: "var(--radius-sm)",
    fontFamily:   "var(--font-body)",
    fontSize:     13,
    fontWeight:   600,
    cursor:       "pointer",
  },
  spinner: {
    display:      "inline-block",
    width:        32,
    height:       32,
    border:       "3px solid var(--border)",
    borderTopColor: "var(--text-muted)",
    borderRadius: "50%",
    animation:    "spin 0.8s linear infinite",
    marginBottom: 16,
  },
  footer: {
    textAlign:  "center",
    padding:    "20px",
    fontSize:   11,
    color:      "var(--text-muted)",
    borderTop:  "1px solid var(--border)",
    marginTop:  40,
  },
  noticeSuccess: {
    display:      "flex",
    alignItems:   "center",
    justifyContent: "space-between",
    gap:          12,
    background:   "var(--green-light, #eaf6ee)",
    border:       "1px solid var(--green)",
    borderRadius: "var(--radius-md)",
    padding:      "10px 14px",
    fontSize:     13,
    fontWeight:   600,
    color:        "var(--green)",
    marginBottom: 16,
  },
  noticeCancelled: {
    display:      "flex",
    alignItems:   "center",
    justifyContent: "space-between",
    gap:          12,
    background:   "var(--bg-subtle)",
    border:       "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    padding:      "10px 14px",
    fontSize:     13,
    color:        "var(--text-secondary)",
    marginBottom: 16,
  },
  noticeDismiss: {
    background:  "none",
    border:      "none",
    cursor:      "pointer",
    fontSize:    13,
    color:       "inherit",
    padding:     0,
    flexShrink:  0,
  },
  cardName: {
    fontFamily:   "var(--font-display)",
    fontSize:     20,
    fontWeight:   600,
    color:        "var(--text-primary)",
    lineHeight:   1.2,
    marginBottom: 4,
  },
  cardUnnamed: {
    fontFamily:  "var(--font-display)",
    fontSize:    18,
    fontWeight:  400,
    color:       "var(--text-muted)",
    fontStyle:   "italic",
  },
  cardTheme: {
    fontSize:     12,
    color:        "var(--text-muted)",
    marginBottom: 2,
  },
  cardDetail: {
    display:    "flex",
    alignItems: "center",
    gap:        6,
    fontSize:   12,
    color:      "var(--text-secondary)",
  },
};
