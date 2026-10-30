// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.13.0 — utils/undo.js (V5-O2)
// Shows an Undo toast for a change made through useEventData's *Undoable
// helpers. `result` is what they return; when it carries no undo (the change
// failed, or there was nothing to restore) a plain toast is shown instead.
// `key` keeps one toast per action type (see components/shared/Toast.jsx).
// ─────────────────────────────────────────────────────────────────────────────

export const CANT_UNDO = "Can't undo, this was changed by someone else";

export function toastUndo(showToast, message, result, key) {
  if (!result?.undo) { showToast(message); return; }
  showToast(message, {
    key,
    undo: async () => {
      const r = await result.undo();
      showToast(r?.ok ? "Undone" : r?.conflict ? CANT_UNDO : "Couldn't undo. Try again.");
    },
  });
}
