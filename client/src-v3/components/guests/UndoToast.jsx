// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.1.0 — components/guests/UndoToast.jsx
// A short-lived toast with an Undo button (8 seconds), used by "Mark as sent"
// and by Clear on a "Sent (manual)" chip. The shared showToast has no action
// button, so this stays local to the Guests tab. role="status" announces it.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";

const UNDO_MS = 8000;

export function UndoToast({ message, onUndo, onExpire }) {
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    const t = setTimeout(() => onExpireRef.current?.(), UNDO_MS);
    return () => clearTimeout(t);
  }, [message]);

  return (
    <div className="msg-undo-toast" role="status">
      <span>{message}</span>
      <button type="button" onClick={onUndo}>Undo</button>
    </div>
  );
}
