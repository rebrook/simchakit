// Dialog behavior for the Guide: focus a starting element, keep Tab inside, close on Escape,
// and return focus to whatever opened it.
import { useEffect, useRef } from "react";

export function useDialog(dialogRef, { onClose, initialFocus }) {
  const opener = useRef(typeof document !== "undefined" ? document.activeElement : null);
  useEffect(() => {
    const prev = opener.current;
    initialFocus?.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const f = [...dialogRef.current.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled && el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); if (prev && prev.focus && document.contains(prev)) prev.focus(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);
}
