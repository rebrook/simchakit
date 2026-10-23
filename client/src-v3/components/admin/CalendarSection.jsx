// Moved verbatim from AdminPanel.jsx (V4.44.0 module split) — no behavior changes.
import { Icon }                          from "@/utils/iconMap.jsx";

// ── Calendar ──
export function CalendarSection({ calendarToken, setCalendarToken, calTokenCopied, setCalTokenCopied, calTokenRegen, setCalTokenRegen, calTokenLoading, setCalTokenLoading, calTokenError, setCalTokenError, eventId, userId, onClose }) {
  return (
      <>
        <div className="admin-section">
          <div className="admin-section-title">Calendar Subscription</div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.6 }}>
            Subscribe to your planning calendar in Google Calendar, Apple Calendar, Outlook, or any app that supports webcal. Your calendar app will automatically stay in sync as you add tasks, payments, and events.
          </p>

          {calendarToken ? (
            <>
              <div className="form-group">
                <label className="form-label">Your Subscribe URL</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="form-input"
                    readOnly
                    value={`webcal://app.simcha-kit.com/api/calendar/subscribe?token=${calendarToken}`}
                    onFocus={e => e.target.select()}
                    style={{ fontFamily: "monospace", fontSize: 12 }}
                  />
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ flexShrink: 0 }}
                    onClick={() => {
                      navigator.clipboard.writeText(`webcal://app.simcha-kit.com/api/calendar/subscribe?token=${calendarToken}`)
                        .then(() => { setCalTokenCopied(true); setTimeout(() => setCalTokenCopied(false), 2500); })
                        .catch(() => {});
                    }}
                  >
                    {calTokenCopied ? <><Icon name="check" context="badge" /> Copied</> : "Copy"}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                  Paste this URL into your calendar app's "Subscribe" or "Add by URL" feature.
                </div>
              </div>

              <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
                <div className="admin-section-title" style={{ color: "var(--red)", fontSize: 13 }}>Regenerate Link</div>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.6 }}>
                  Regenerating creates a new subscribe URL and permanently invalidates the current one. Any calendar apps already subscribed will stop updating.
                </p>
                {calTokenError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{calTokenError}</div>}
                {!calTokenRegen ? (
                  <button className="btn btn-danger btn-sm" onClick={() => setCalTokenRegen(true)}>
                    Regenerate Link
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Are you sure? This cannot be undone.</span>
                    <button
                      className="btn btn-danger btn-sm"
                      disabled={calTokenLoading}
                      onClick={async () => {
                        setCalTokenLoading(true); setCalTokenError("");
                        try {
                          const res = await fetch("/api/calendar/generate-token", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ eventId, userId }),
                          });
                          const json = await res.json();
                          if (!res.ok) { setCalTokenError(json.error || "Could not regenerate."); }
                          else { setCalendarToken(json.token); setCalTokenRegen(false); }
                        } catch (e) { setCalTokenError("Request failed. Check your connection."); }
                        setCalTokenLoading(false);
                      }}
                    >
                      {calTokenLoading ? "Regenerating…" : "Yes, Regenerate"}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setCalTokenRegen(false)}>Cancel</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "20px 0" }}>
              No calendar token found for this event. Try closing and reopening Admin Mode. If the issue persists, contact <a href="mailto:support@brook-creative.com" style={{ color: "var(--text-muted)" }}>support@brook-creative.com</a>.
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </>
  );
}
