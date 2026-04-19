// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — DeleteEventConfirm.jsx
// Positioned overlay: user must type the event name to confirm deletion.
// Matches V2 index.html delete-confirm pattern exactly.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase.js";

export function DeleteEventConfirm({ event, anchorRect, userId, onDeleted, onClose }) {
  const [typed,    setTyped]    = useState("");
  const [status,   setStatus]   = useState("idle"); // idle | loading | error
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef(null);

  const confirmText = event.name || event.id;
  const canDelete   = typed.trim() === confirmText && status !== "loading";

  // Focus input on mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Position: below anchor if space, above if near bottom
  const overlayWidth = 280;
  let top  = (anchorRect?.bottom ?? 0) + 8;
  let left = anchorRect?.left ?? 0;
  if (typeof window !== "undefined") {
    if (top + 260 > window.innerHeight) top = (anchorRect?.top ?? 260) - 268;
    left = Math.min(left, window.innerWidth - overlayWidth - 8);
    left = Math.max(8, left);
  }

  async function handleDelete() {
    if (!canDelete) return;
    setStatus("loading");
    setErrorMsg("");

    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", event.id)
      .eq("owner_id", userId);

    if (error) {
      setStatus("error");
      setErrorMsg(error.message || "Could not delete event.");
      return;
    }

    // Decrement event_count (best-effort)
    supabase.rpc("decrement_event_count", { user_id: userId }).then(({ error: rpcErr }) => {
      if (rpcErr) console.warn("[SimchaKit] Could not decrement event_count:", rpcErr.message);
    });

    onDeleted(event.id);
  }

  return (
    <>
      {/* Backdrop */}
      <div style={styles.backdrop} onClick={onClose} />

      {/* Overlay */}
      <div style={{ ...styles.overlay, top, left, width: overlayWidth }}>
        <div style={styles.title}>⚠ Delete this event?</div>
        <div style={styles.desc}>
          This permanently deletes all data for <strong>{confirmText}</strong>. This cannot be undone.
        </div>
        <div style={{ ...styles.desc, marginTop: -4 }}>
          Type the event name to confirm:
        </div>
        <input
          ref={inputRef}
          style={{
            ...styles.confirmInput,
            borderColor: typed && !canDelete ? "var(--red)" : "var(--border-strong)",
          }}
          value={typed}
          onChange={e => { setTyped(e.target.value); setErrorMsg(""); }}
          onKeyDown={e => { if (e.key === "Enter" && canDelete) handleDelete(); }}
          placeholder={confirmText}
          autoComplete="off"
        />
        <div style={styles.actions}>
          <button
            style={{
              ...styles.btnDelete,
              opacity: canDelete ? 1 : 0.45,
              cursor:  canDelete ? "pointer" : "not-allowed",
            }}
            onClick={handleDelete}
            disabled={!canDelete}
          >
            {status === "loading" ? "Deleting…" : "Delete"}
          </button>
          <button style={styles.btnCancel} onClick={onClose}>
            Cancel
          </button>
        </div>
        {status === "error" && (
          <div style={styles.errorMsg}>{errorMsg}</div>
        )}
      </div>
    </>
  );
}

const styles = {
  backdrop: {
    position:   "fixed",
    inset:      0,
    zIndex:     999,
    background: "transparent",
  },
  overlay: {
    position:     "fixed",
    zIndex:       1000,
    background:   "var(--bg-surface)",
    border:       "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    padding:      20,
    boxShadow:    "var(--shadow-lg)",
    display:      "flex",
    flexDirection:"column",
    gap:          10,
  },
  title: {
    fontFamily: "var(--font-display)",
    fontSize:   15,
    fontWeight: 600,
    color:      "var(--red)",
  },
  desc: {
    fontSize:   12,
    color:      "var(--text-secondary)",
    lineHeight: 1.5,
  },
  confirmInput: {
    width:        "100%",
    padding:      "8px 10px",
    border:       "1px solid var(--border-strong)",
    borderRadius: "var(--radius-sm)",
    fontFamily:   "monospace",
    fontSize:     13,
    color:        "var(--text-primary)",
    background:   "var(--bg-surface)",
    outline:      "none",
    WebkitAppearance: "none",
    boxSizing:    "border-box",
  },
  actions: {
    display:    "flex",
    gap:        8,
    alignItems: "center",
  },
  btnDelete: {
    padding:      "7px 14px",
    background:   "var(--red)",
    color:        "white",
    border:       "none",
    borderRadius: "var(--radius-sm)",
    fontFamily:   "var(--font-body)",
    fontSize:     12,
    fontWeight:   600,
    minHeight:    32,
    transition:   "opacity var(--transition)",
  },
  btnCancel: {
    background:  "none",
    border:      "none",
    fontFamily:  "var(--font-body)",
    fontSize:    12,
    color:       "var(--text-muted)",
    cursor:      "pointer",
    padding:     "4px 0",
  },
  errorMsg: {
    fontSize: 11,
    color:    "var(--red)",
    minHeight: 14,
  },
};
