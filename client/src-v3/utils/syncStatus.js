// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.18.1 — utils/syncStatus.js
// Tiny module-level store backing the topbar/footer sync indicator.
//
// This is deliberately NOT React state living in one component — it's fed by
// whichever useEventData() instance happens to be mounted (only one at a
// time, since AppShell renders exactly one active tab), so a plain
// subscribable module-level store is the simplest way for AppShell to read
// it without threading props through every tab.
//
// Three derived states (see getSyncState()):
//   "offline" — not navigator.onLine, OR the active collection's Realtime
//               channel has reported anything other than SUBSCRIBED.
//               Takes priority over "saving": if we're offline/disconnected,
//               we don't get to claim things are saving successfully.
//   "saving"  — inFlight > 0 (a save() or remove() call is in progress).
//   "synced"  — neither of the above.
//
// Channel connectivity is tracked per key (`${collection}:${eventId}`) so
// that navigating away from a tab removes its channel from consideration
// instead of leaving a stale disconnected flag behind.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";

let inFlight = 0;
const channelConnected = new Map(); // key -> boolean
let online = typeof navigator !== "undefined" ? navigator.onLine : true;

const listeners = new Set();

function emit() {
  const snapshot = getSyncState();
  listeners.forEach(fn => fn(snapshot));
}

export function beginSave() {
  inFlight += 1;
  emit();
}

export function endSave() {
  inFlight = Math.max(0, inFlight - 1);
  emit();
}

export function setChannelConnected(key, isConnected) {
  channelConnected.set(key, isConnected);
  emit();
}

export function removeChannelKey(key) {
  channelConnected.delete(key);
  emit();
}

export function getSyncState() {
  const anyDisconnected = Array.from(channelConnected.values()).some(v => v === false);
  const connected = online && !anyDisconnected;

  let state;
  if (!connected) {
    state = "offline";
  } else if (inFlight > 0) {
    state = "saving";
  } else {
    state = "synced";
  }

  return { state, inFlight, connected, online };
}

export function subscribeSyncState(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Track browser connectivity once at module load, not per-component.
if (typeof window !== "undefined") {
  window.addEventListener("online",  () => { online = true;  emit(); });
  window.addEventListener("offline", () => { online = false; emit(); });
}

// ── React hook for consuming components ───────────────────────────────────────
export function useSyncStatus() {
  const [state, setState] = useState(getSyncState);
  useEffect(() => subscribeSyncState(setState), []);
  return state;
}
