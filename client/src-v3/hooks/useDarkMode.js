import { useState, useEffect } from "react";

// Dark mode hook — manages theme preference with system detection and localStorage persistence

function useDarkMode() {
  const [mode, setMode] = useState(() => localStorage.getItem("mk-theme") || "system");

  useEffect(() => {
    const apply = () => {
      let dark = false;
      if (mode === "dark")   dark = true;
      if (mode === "light")  dark = false;
      if (mode === "system") dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    };
    apply();
    localStorage.setItem("mk-theme", mode);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mode === "system") mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [mode]);

  return [mode, setMode];
}

export { useDarkMode };
