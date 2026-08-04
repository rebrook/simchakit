// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.23.3 — components/shared/Modal.jsx
// Reusable modal wrapper providing the accessibility behavior every hand-
// rolled modal-backdrop div in this codebase was missing: portal to body,
// role="dialog" aria-modal="true" aria-labelledby, a trapped focus loop,
// initial focus on mount, Escape to close, and focus restored to whatever
// triggered the modal on close.
//
// Reuses the existing .modal / .modal-backdrop CSS as-is — this component
// changes behavior, not visual output. Backdrop mousedown-on-self-closes is
// preserved exactly as it already worked (onMouseDown checking
// e.target === e.currentTarget, not onClick, per the May 2026 drag-select
// fix — clicking and dragging text that ends outside the modal must not
// close it).
//
// No body scroll-lock: none of the modals being migrated in this pass had
// one (checked all nine call sites before building this), so adding one
// here would be a behavior change, not a faithful wrapper. Worth adding as
// a deliberate follow-up if wanted, not bundled in silently here.
//
// Two header modes:
//   1. Pass `title` (a string) — Modal renders the standard header itself
//      (title text + close X button) and wires aria-labelledby to it
//      internally. This is what ConfirmDialog uses.
//   2. Omit `title`, pass `ariaLabel` instead, and render your own custom
//      header (icon + title, no close button, whatever the existing modal
//      needs) as part of `children`. This is the "wrapper-only" path for
//      migrating bigger, more custom modals without restructuring their
//      existing markup.
//
// `unstyled`: for modals that don't use .modal/.modal-lg at all — e.g. a
// full-custom print-preview panel with its own inline-styled dimensions,
// no card chrome, no entrance animation. Skips the .modal/.modal-lg class
// entirely so the caller's own className/inline styles are the only thing
// controlling appearance, while still getting the portal, dialog
// semantics, focus trap, Escape, and focus restore. Forcing .modal's CSS
// (max-height: 85vh, the slide-up animation) onto a caller that never had
// them would be a real visual change, not a faithful wrapper — this option
// exists so that never has to happen.
//
// Usage (simple):
//   <Modal onClose={onClose} title="Delete Household" maxWidth={400}>
//     <div className="modal-body">...</div>
//   </Modal>
//
// Usage (wrapper-only, custom header):
//   <Modal onClose={onClose} ariaLabel="SimchaKit Guide" className="modal-lg">
//     <div className="modal-header">...custom markup...</div>
//     <div className="modal-body">...</div>
//   </Modal>
//
// Usage (unstyled, fully custom panel):
//   <Modal onClose={onClose} ariaLabel="Print Preview" unstyled
//     className="print-preview-panel" style={{ width: "95%", ... }}>
//     ...
//   </Modal>
// Stacked modals (e.g. Admin Mode's Export Full Backup, opened on top of the
// Admin Mode panel itself): a module-level stack tracks every currently-
// mounted Modal instance in open order. Only the TOPMOST instance's Escape
// and Tab handling is active. Without this, two simultaneously-mounted
// Modal instances each independently register their own window-level
// keydown listener — Escape would fire both onClose handlers at once, and
// the OUTER modal's Tab-trap listener stays fully live the whole time an
// inner modal is open (it never unmounts), competing with the inner one's
// own trap instead of getting out of the way.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useLayoutEffect, useRef, useId } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/utils/iconMap.jsx";

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// Open-modal stack, most-recently-mounted last. Plain module-level array,
// not React state — read live at keydown time, not captured in a closure.
let modalStack = [];
let nextModalId = 0;

export function Modal({
  onClose,
  title,
  ariaLabel,
  className = "",
  maxWidth,
  unstyled = false,
  style,
  initialFocusRef,
  children,
}) {
  const modalRef              = useRef(null);
  const previouslyFocusedRef  = useRef(null);
  const titleId                = useId();
  const instanceIdRef          = useRef(null);
  if (instanceIdRef.current == null) {
    instanceIdRef.current = ++nextModalId;
  }

  // Register in the open-modal stack on mount, deregister on unmount, so
  // stacked modals know which one is topmost.
  useEffect(() => {
    modalStack.push(instanceIdRef.current);
    return () => {
      modalStack = modalStack.filter(id => id !== instanceIdRef.current);
    };
  }, []);

  // Capture whatever had focus before the modal opened, restore it on close.
  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement;
    return () => {
      const el = previouslyFocusedRef.current;
      if (el && typeof el.focus === "function") el.focus();
    };
  }, []);

  // Initial focus, before paint so there's no visible flash of the wrong
  // element being focused. Prefers an explicit initialFocusRef (e.g.
  // ConfirmDialog pointing at Cancel rather than the close X); otherwise
  // the first focusable element inside the modal in DOM order.
  useLayoutEffect(() => {
    const target = initialFocusRef?.current
      || modalRef.current?.querySelector(FOCUSABLE_SELECTOR);
    target?.focus();
    // Only on mount — re-focusing on every render would fight the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape closes. Tab / Shift+Tab is trapped inside the modal. Both are
  // gated to the topmost modal in the stack — otherwise an outer modal's
  // listener would also fire while an inner one is open on top of it.
  // Focusable elements are re-queried on every keypress rather than cached
  // once, so this stays correct even if the modal's content changes shape
  // (e.g. a form transitioning to a success state with different buttons).
  useEffect(() => {
    const handler = (e) => {
      if (modalStack[modalStack.length - 1] !== instanceIdRef.current) return;

      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !modalRef.current) return;

      const focusables = Array.from(modalRef.current.querySelectorAll(FOCUSABLE_SELECTOR))
        .filter(el => !el.disabled && el.offsetParent !== null);
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last  = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={modalRef}
        className={unstyled ? (className || undefined) : (className ? `modal ${className}` : "modal")}
        style={unstyled ? style : (maxWidth ? { maxWidth } : undefined)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="modal-header">
            <div className="modal-title" id={titleId}>{title}</div>
            <button className="icon-btn" title="Close" onClick={onClose}>
              <Icon name="x" context="button" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}
