// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.13.0 — components/shared/Toast.jsx (V5-O2)
// The app's toast system. showToast(message) keeps working as before (2.5s).
// showToast(message, { undo, key, duration }) adds an Undo button and keeps the
// toast for 8 seconds. A toast pauses its timer while the pointer is over it or
// focus is inside it. The host is a polite live region, so each toast is read
// out by screen readers when it appears.
//
// One toast per action type: a new toast replaces any visible toast with the same
// key (plain messages share one key; undo toasts default to "undo"; callers pass
// a key such as "task-done" or "delete"). At most three show at once.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback, useEffect } from "react";
import { Icon } from "@/utils/iconMap.jsx";

const PLAIN_MS = 2500;
export const UNDO_MS = 8000;
const MAX_TOASTS = 3;

export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const showToast = useCallback((message, opts = {}) => {
    const id = ++idRef.current;
    const key = opts.key || (opts.undo ? "undo" : "message");
    const duration = opts.duration || (opts.undo ? UNDO_MS : PLAIN_MS);
    setToasts(prev => [...prev.filter(t => t.key !== key), { id, key, message, undo: opts.undo, duration }].slice(-MAX_TOASTS));
  }, []);

  const dismissToast = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);
  return { toasts, showToast, dismissToast };
}

function ToastItem({ toast, onDismiss }) {
  const remaining = useRef(toast.duration);
  const startedAt = useRef(0);
  const timer     = useRef(null);
  const hover     = useRef(false);
  const focus     = useRef(false);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  const start = () => {
    startedAt.current = Date.now();
    timer.current = setTimeout(() => dismissRef.current(), remaining.current);
  };
  const pause = () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
  };
  const resume = () => { if (!timer.current && !hover.current && !focus.current) start(); };

  useEffect(() => { start(); return () => clearTimeout(timer.current); }, []);

  return (
    <div className="app-toast"
      onMouseEnter={() => { hover.current = true; pause(); }}
      onMouseLeave={() => { hover.current = false; resume(); }}
      onFocus={() => { focus.current = true; pause(); }}
      onBlur={() => { focus.current = false; resume(); }}>
      <Icon name="check" context="inline" style={{ marginRight: 6, flexShrink: 0 }} />
      <span className="app-toast-text">{toast.message}</span>
      {toast.undo && (
        <button type="button" className="app-toast-undo"
          onClick={() => { const fn = toast.undo; dismissRef.current(); fn(); }}>
          Undo
        </button>
      )}
    </div>
  );
}

export function ToastHost({ toasts, onDismiss }) {
  return (
    <div className="toast-host" role="status" aria-live="polite" aria-relevant="additions text">
      {toasts.map(t => <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />)}
    </div>
  );
}
