// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.9.0 — hooks/useOverviewAnimation.js
// The Overview's count-down and bar-fill animation plays once per browser session, on the first
// load of the Overview, not on every visit to the tab, and never under prefers-reduced-motion.
// Returns { play, go }: `play` is whether to animate at all; `go` flips true on the next frame so
// bars and counters can start from 0 and move.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";

const KEY = "simchakit-overview-animated";

function shouldPlay() {
  try {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    return sessionStorage.getItem(KEY) !== "1";
  } catch { return false; }
}

export function useOverviewAnimation() {
  const [play] = useState(shouldPlay);
  const [go, setGo] = useState(!play);   // without animation everything is simply at its final value
  useEffect(() => {
    if (!play) return undefined;
    try { sessionStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    let r2;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setGo(true)); });
    return () => { cancelAnimationFrame(r1); if (r2) cancelAnimationFrame(r2); };
  }, [play]);
  return { play, go };
}
