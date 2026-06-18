// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit — useIsMobile.js
// Shared hook: returns true when the viewport is ≤760px (table→card breakpoint).
// This is deliberately different from the 900px shell/sidebar breakpoint used
// in OverviewTab and AppShell. Two intentional thresholds, not four accidental.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 760);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}
