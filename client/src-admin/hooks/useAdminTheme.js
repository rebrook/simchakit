// SimchaKit Admin: light/dark preference. Unset follows the system; the toggle stores an explicit choice.
import { useState, useCallback } from "react";

const KEY = "simchakit.admin.theme";

function read() {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch { return null; }
}

export function applyStoredTheme() {
  const v = read();
  if (v) document.documentElement.setAttribute("data-theme", v);
}

const systemDark = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches;

export function useAdminTheme() {
  const [theme, setTheme] = useState(() => read() || (systemDark() ? "dark" : "light"));
  const toggle = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(KEY, next); } catch { /* storage blocked: the choice lasts this page view */ }
    setTheme(next);
  }, [theme]);
  return { theme, toggle };
}
