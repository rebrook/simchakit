// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — CreateEventForm.jsx
// Inline form for creating a new event. Appears above the event grid.
// Writes: events (INSERT) + user_profiles.event_count (increment).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { supabase } from "@/lib/supabase.js";

const EVENT_TYPES = [
  { value: "bat-mitzvah",  label: "Bat Mitzvah" },
  { value: "bar-mitzvah",  label: "Bar Mitzvah" },
  { value: "bnei-mitzvah", label: "B'nei Mitzvah" },
  { value: "wedding",      label: "Wedding" },
  { value: "baby-naming",  label: "Baby Naming" },
  { value: "graduation",   label: "Graduation" },
  { value: "anniversary",  label: "Anniversary" },
  { value: "birthday",     label: "Birthday" },
  { value: "other",        label: "Other Celebration" },
];

export function CreateEventForm({ userId, onCreated, onCancel }) {
  const [name,    setName]    = useState("");
  const [type,    setType]    = useState("bat-mitzvah");
  const [date,    setDate]    = useState("");
  const [status,  setStatus]  = useState("idle"); // idle | loading | error
  const [errorMsg, setErrorMsg] = useState("");

  const canSubmit = name.trim().length > 0 && status !== "loading";

  async function handleCreate() {
    if (!canSubmit) return;
    setStatus("loading");
    setErrorMsg("");

    // Build admin_config with timeline entry if date provided
    const adminConfig = {
      name: name.trim(),
      type,
      theme: { palette: "rose", name: "", icon: "" },
      timeline: date ? [{
        id:          "tl_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
        isMainEvent: true,
        title:       name.trim(),
        startDate:   date,
        endDate:     date,
        startTime:   "",
        endTime:     "",
        venue:       "",
        notes:       "",
      }] : [],
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
      .select()
      .single();

    if (insertError) {
      setStatus("error");
      setErrorMsg(insertError.message || "Could not create event.");
      return;
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

  return (
    <div style={styles.wrap}>
      <div style={styles.title}>Create New Event</div>

      <div style={styles.fieldRow}>
        {/* Event Name */}
        <div style={{ ...styles.fieldWrap, flex: 2, minWidth: 200 }}>
          <label style={styles.label}>Event Name *</label>
          <input
            style={styles.input}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Brook Bat Mitzvah"
            autoFocus
            autoComplete="off"
            disabled={status === "loading"}
          />
        </div>

        {/* Event Type */}
        <div style={{ ...styles.fieldWrap, flex: 1, minWidth: 160 }}>
          <label style={styles.label}>Event Type</label>
          <select
            style={styles.select}
            value={type}
            onChange={e => setType(e.target.value)}
            disabled={status === "loading"}
          >
            {EVENT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Main Event Date */}
        <div style={{ ...styles.fieldWrap, flex: 1, minWidth: 160 }}>
          <label style={styles.label}>Main Event Date</label>
          <input
            style={styles.input}
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            disabled={status === "loading"}
          />
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          <button
            style={{
              ...styles.btnCreate,
              opacity: canSubmit ? 1 : 0.45,
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
            onClick={handleCreate}
            disabled={!canSubmit}
          >
            {status === "loading" ? "Creating…" : "Create"}
          </button>
          <button style={styles.btnCancel} onClick={onCancel} disabled={status === "loading"}>
            Cancel
          </button>
        </div>
      </div>

      {status === "error" && (
        <div style={styles.errorMsg}>{errorMsg}</div>
      )}

      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.6 }}>
        Your default admin password is <strong>admin</strong>. You can change it anytime in Admin Mode once you're in your dashboard.
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    background:   "var(--bg-surface)",
    border:       "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    padding:      "20px",
    marginBottom: "24px",
    boxShadow:    "var(--shadow-sm)",
  },
  title: {
    fontFamily:   "var(--font-display)",
    fontSize:     16,
    fontWeight:   600,
    color:        "var(--text-primary)",
    marginBottom: 14,
  },
  fieldRow: {
    display:    "flex",
    gap:        10,
    alignItems: "flex-end",
    flexWrap:   "wrap",
  },
  fieldWrap: {
    display:       "flex",
    flexDirection: "column",
    gap:           5,
  },
  label: {
    fontSize:      11,
    fontWeight:    600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color:         "var(--text-muted)",
  },
  input: {
    width:        "100%",
    padding:      "9px 12px",
    border:       "1px solid var(--border-strong)",
    borderRadius: "var(--radius-sm)",
    fontFamily:   "var(--font-body)",
    fontSize:     14,
    color:        "var(--text-primary)",
    background:   "var(--bg-surface)",
    outline:      "none",
    WebkitAppearance: "none",
  },
  select: {
    width:        "100%",
    padding:      "9px 12px",
    border:       "1px solid var(--border-strong)",
    borderRadius: "var(--radius-sm)",
    fontFamily:   "var(--font-body)",
    fontSize:     14,
    color:        "var(--text-primary)",
    background:   "var(--bg-surface)",
    outline:      "none",
    WebkitAppearance: "none",
    cursor:       "pointer",
  },
  actions: {
    display:    "flex",
    gap:        8,
    alignItems: "center",
    paddingBottom: 2,
    flexShrink: 0,
  },
  btnCreate: {
    padding:      "9px 18px",
    background:   "var(--green)",
    color:        "white",
    border:       "none",
    borderRadius: "var(--radius-sm)",
    fontFamily:   "var(--font-body)",
    fontSize:     13,
    fontWeight:   600,
    minHeight:    36,
    whiteSpace:   "nowrap",
    transition:   "opacity var(--transition)",
  },
  btnCancel: {
    background:  "none",
    border:      "none",
    fontFamily:  "var(--font-body)",
    fontSize:    13,
    color:       "var(--text-muted)",
    cursor:      "pointer",
    padding:     "4px 0",
    transition:  "color var(--transition)",
  },
  errorMsg: {
    fontSize:   12,
    color:      "var(--red)",
    marginTop:  10,
  },
};
