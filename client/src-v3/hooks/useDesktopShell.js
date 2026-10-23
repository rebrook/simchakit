// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit — useDesktopShell.js
// True when the desktop shell is showing (viewport >900px), i.e. when the pinned
// top bar is visible. Matches the 900px shell breakpoint in styles/shell/main.css
// (not the 760px useIsMobile breakpoint). Tabs use it to drop their in-content
// add button only where the top bar already carries that action.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";

export function useDesktopShell() {
  const [desktop, setDesktop] = useState(() => window.innerWidth >= 901);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 901px)");
    const handler = (e) => setDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return desktop;
}
