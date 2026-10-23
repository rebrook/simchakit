// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit — usePrimaryAction.js
// Per-tab primary action in the desktop top bar (V4.49.0). The shell's top bar
// button dispatches PRIMARY_ACTION_EVENT; the active tab listens and opens its
// existing add modal. Same CustomEvent pattern as "simchakit:print-brief".
//
// A tab can also report that its action is currently unavailable (e.g. Seating
// before seating is enabled) so the top bar button is disabled to match the
// in-content button's conditions.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";

export const PRIMARY_ACTION_EVENT       = "simchakit:primary-action";
export const PRIMARY_ACTION_STATE_EVENT = "simchakit:primary-action-state";

// Run `handler` whenever the top bar's primary action fires.
export function usePrimaryAction(handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const listener = () => ref.current();
    window.addEventListener(PRIMARY_ACTION_EVENT, listener);
    return () => window.removeEventListener(PRIMARY_ACTION_EVENT, listener);
  }, []);
}

// Tell the top bar the primary action is unavailable while `blocked` is true.
export function usePrimaryActionBlocked(blocked) {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(PRIMARY_ACTION_STATE_EVENT, { detail: { blocked: !!blocked } }));
    return () => window.dispatchEvent(new CustomEvent(PRIMARY_ACTION_STATE_EVENT, { detail: { blocked: false } }));
  }, [blocked]);
}
