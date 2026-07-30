// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.21.0 — components/shared/ConfirmDialog.jsx
// Replaces the near-identical delete-confirm modal that was duplicated
// across nine tabs (GuestsTab, BudgetTab, VendorsTab, TasksTab, PrepTab,
// GiftsTab, FavorsTab, SeatingTab, CeremonyRolesTab) and Modals.jsx's
// clear-log confirm. Markup matches the original exactly (modal-header /
// modal-body / modal-footer, btn-ghost Cancel + btn-danger or btn-primary
// confirm) — only the accessibility behavior is new, inherited from Modal.
//
// maxWidth is fixed at 400 here rather than left per-caller. The nine
// originals varied between 380 and 400 with no apparent reason, which is
// exactly the kind of drift collapsing this to one component is meant to
// remove — the 20px difference isn't visually meaningful.
//
// Initial focus goes to Cancel, not whatever's literally first in the DOM
// (which would be the header's close X button). Pre-focusing the safe
// option on a destructive-action dialog is both more standard practice and
// safer than Modal's generic "first focusable" default.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef } from "react";
import { Modal } from "@/components/shared/Modal.jsx";

/**
 * @param {string} title
 * @param {import("react").ReactNode} message - plain text or JSX (bolded
 *   names, a conditional extra warning line, etc.) — callers pass whatever
 *   they already had inline in the old markup.
 * @param {string} [confirmLabel="Delete"]
 * @param {boolean} [danger=true] - true → btn-danger, false → btn-primary
 *   (for non-destructive confirmations, e.g. a reset-to-template action).
 * @param {() => void} onConfirm - called on confirm; ConfirmDialog does not
 *   close itself afterward, since callers vary on whether the confirm
 *   handler itself clears state or the caller wraps it — matches each
 *   original file's own existing behavior rather than imposing one.
 * @param {() => void} onClose
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  danger = true,
  onConfirm,
  onClose,
}) {
  const cancelRef = useRef(null);

  return (
    <Modal onClose={onClose} title={title} maxWidth={400} initialFocusRef={cancelRef}>
      <div className="modal-body">
        <p style={{ fontSize: 14, color: "var(--text-primary)", marginBottom: 8 }}>
          {message}
        </p>
        <div className="modal-footer">
          <button ref={cancelRef} className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className={danger ? "btn btn-danger" : "btn btn-primary"} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
