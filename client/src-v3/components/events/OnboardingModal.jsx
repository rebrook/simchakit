// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3 — components/events/OnboardingModal.jsx
// Shown after the first event is created (variant="account-setup", V5.7.0) and
// when editing the name. Never blocks event creation: Skip for now is the default.
// Saves display_name to user_profiles via Supabase.
//
// Props:
//   userId        {string}   -- auth user ID
//   isRequired    {boolean}  -- true = cannot dismiss without entering name (new user)
//                              false = can dismiss (edit mode or existing user)
//   initialName   {string}   -- pre-fill if editing existing name
//   onSave        {fn}       -- called with the saved name string
//   onDismiss     {fn}       -- called when dismissed without saving (isRequired=false only)
//   variant       {string}   -- "account-setup": "Your event is ready" step, Skip for now is the primary action
//   eventName     {string}   -- account-setup only: the event just created
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { supabase }  from "@/lib/supabase.js";

export function OnboardingModal({ userId, isRequired, initialName = "", onSave, onDismiss, variant, eventName }) {
  const [name,    setName]    = useState(initialName);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);

  const isEdit = !!initialName;
  const isSetup = variant === "account-setup";
  const heading = isSetup ? "Your event is ready" : isEdit ? "Update your name" : "What should we call you?";
  const subheading = isSetup
    ? `${eventName ? `"${eventName}" is created. ` : ""}One optional thing before you start: what should we call you? Your name appears in invitation emails to your co-planners.`
    : isEdit
    ? "Your name appears in invitation emails and the collaborator panel."
    : "Your name will appear in invitation emails sent to your co-planners and in the app footer.";

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a name.");
      return;
    }
    setSaving(true);
    setError(null);

    const { error: dbError } = await supabase
      .from("user_profiles")
      .update({ display_name: trimmed, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (dbError) {
      console.error("[SimchaKit] OnboardingModal: save failed:", dbError.message);
      setError("Could not save your name. Please try again.");
      setSaving(false);
      return;
    }

    setSaving(false);
    onSave(trimmed);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") { if (isSetup && !name.trim()) onDismiss?.(); else handleSave(); }
    if (e.key === "Escape" && !isRequired) onDismiss?.();
  }

  return (
    <div
      style={{
        position:        "fixed",
        inset:           0,
        background:      "rgba(13,27,46,0.55)",
        zIndex:          1000,
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        padding:         "24px 16px",
      }}
      onMouseDown={e => { if (!isRequired && e.target === e.currentTarget) onDismiss?.(); }}
    >
      <div style={{
        background:   "var(--bg-surface)",
        borderRadius: "var(--radius-lg)",
        border:       "1px solid var(--border)",
        padding:      "36px 40px",
        width:        "100%",
        maxWidth:     440,
        boxShadow:    "0 8px 32px rgba(13,27,46,0.18)",
      }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontFamily: "var(--font-display)",
            fontSize:   22,
            fontWeight: 600,
            color:      "var(--text-primary)",
            marginBottom: 8,
          }}>
            {heading}
          </div>
          <div style={{
            fontSize:   14,
            color:      "var(--text-secondary)",
            lineHeight: 1.5,
          }}>
            {subheading}
          </div>
        </div>

        {/* Input */}
        <div className="form-group" style={{ marginBottom: 8 }}>
          <label className="form-label">Your name</label>
          <input
            className="form-input"
            type="text"
            placeholder="e.g. Homer or Homer Simpson"
            value={name}
            onChange={e => { setName(e.target.value); setError(null); }}
            onKeyDown={handleKeyDown}
            autoFocus={!isSetup}
            maxLength={80}
          />
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            This can be a first name, full name, or nickname -- whatever you prefer.
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            fontSize:     12,
            color:        "var(--red)",
            marginBottom: 12,
            padding:      "6px 10px",
            background:   "var(--red-light)",
            borderRadius: "var(--radius-sm)",
            border:       "1px solid var(--red)",
          }}>
            {error}
          </div>
        )}

        {/* Actions */}
        {isSetup ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 20, flexWrap: "wrap" }}>
            <button
              className={name.trim() ? "btn btn-secondary" : "btn btn-primary"}
              onClick={onDismiss}
              disabled={saving}
              style={{ flex: 1, minHeight: 44 }}
            >
              Skip for now
            </button>
            {name.trim() && (
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
                style={{ flex: 1, minHeight: 44 }}
              >
                {saving ? "Saving…" : "Save name & open event"}
              </button>
            )}
          </div>
        ) : (
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 20 }}>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !name.trim()}
            style={{ flex: 1 }}
          >
            {saving ? "Saving…" : isEdit ? "Save" : "Get Started"}
          </button>
          {!isRequired && (
            <button
              className="btn btn-ghost"
              onClick={onDismiss}
              disabled={saving}
            >
              {isEdit ? "Cancel" : "Skip for now"}
            </button>
          )}
        </div>
        )}

        {/* Fine print for new users */}
        {!isEdit && !isRequired && !isSetup && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12, textAlign: "center" }}>
            You can update this at any time from the event picker.
          </div>
        )}
      </div>
    </div>
  );
}
