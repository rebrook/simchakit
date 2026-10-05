// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.32.0: InfoPopover.jsx
// A small "i" button that opens a short explanation of how a number is counted.
//
// Design rules (see the V4.32.0 UX research notes):
//   - Opens on tap or click, not hover, so it works on phones and tablets.
//   - Only for detail that is NOT essential to reading the number. Anything a
//     reader needs (which event, what is excluded) stays in the visible label
//     or sub-line.
//   - Rendered in a portal on document.body and positioned from the button's
//     screen position, so a card's hover transform or overflow can never
//     displace or clip it. z-index sits above every app layer, including Day-of Mode.
//   - Because the popover lives outside the app container, it copies the theme
//     colors from the button's own context when it opens, so it matches dark
//     mode and every color palette wherever the theme variables are defined.
//   - Keyboard accessible: Escape closes and returns focus to the button, and
//     a tap or click outside closes it. The text is announced through a
//     visually hidden live region, the usual "toggletip" pattern.
//
// Props:
//   text  : string, or array of strings (one paragraph each)
//   label : accessible name for the button (default "How is this counted?")
//   style : extra styles for the wrapper (e.g. absolute positioning on a card)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useLayoutEffect, useCallback, useId } from "react";
import { createPortal } from "react-dom";

const POP_WIDTH = 280;
const GAP       = 8;
const MARGIN    = 8;

const VISUALLY_HIDDEN = {
  position: "absolute", width: 1, height: 1, margin: -1, padding: 0,
  overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0,
};

export function InfoPopover({ text, label = "How is this counted?", style }) {
  const [open,    setOpen]    = useState(false);
  const [pos,     setPos]     = useState(null);   // { top, left, width, arrowLeft, above }
  const [kbFocus, setKbFocus] = useState(false);
  const [theme,   setTheme]   = useState({});     // colors resolved at the button
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const id     = useId();

  const paragraphs = (Array.isArray(text) ? text : [text]).filter(Boolean);

  const close = useCallback(() => { setOpen(false); setPos(null); }, []);

  // Measure the open popover and place it under the button (or above it when
  // there is no room), clamped inside the viewport.
  const place = useCallback(() => {
    const btn = btnRef.current;
    const pop = popRef.current;
    if (!btn || !pop) return;
    const cs = getComputedStyle(btn);
    const pick = (name) => cs.getPropertyValue(name).trim();
    setTheme({
      bg: pick("--bg-surface"), text: pick("--text-primary"), border: pick("--border"),
      radius: pick("--radius-md"), shadow: pick("--shadow-md"),
    });
    const r     = btn.getBoundingClientRect();
    const vw    = window.innerWidth;
    const vh    = window.innerHeight;
    const width = Math.min(POP_WIDTH, vw - MARGIN * 2);
    const h     = pop.offsetHeight;
    const left  = Math.max(MARGIN, Math.min(r.left + r.width / 2 - width / 2, vw - width - MARGIN));
    const below = r.bottom + GAP;
    const above = r.top - GAP - h;
    const useAbove = below + h > vh - MARGIN && above >= MARGIN;
    const arrowLeft = Math.max(14, Math.min(r.left + r.width / 2 - left, width - 14));
    setPos({ top: useAbove ? above : below, left, width, arrowLeft, above: useAbove });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place, paragraphs.join("|")]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (btnRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
      close();
    };
    const onKey = (e) => {
      if (e.key === "Escape") { close(); btnRef.current?.focus(); }
    };
    const onMove = () => place();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, close, place]);

  if (paragraphs.length === 0) return null;

  const width = pos ? pos.width : Math.min(POP_WIDTH, (typeof window !== "undefined" ? window.innerWidth : POP_WIDTH) - MARGIN * 2);

  return (
    <span style={{ display: "inline-flex", alignItems: "center", lineHeight: 1, ...style }}>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={(e) => { e.stopPropagation(); if (open) close(); else setOpen(true); }}
        onFocus={(e) => setKbFocus(e.currentTarget.matches(":focus-visible"))}
        onBlur={() => setKbFocus(false)}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 28, height: 28, margin: -6, padding: 0,
          background: "transparent", border: "none", borderRadius: "50%",
          cursor: "pointer", textTransform: "none", letterSpacing: 0,
          outline: kbFocus ? "2px solid var(--accent-primary)" : "none", outlineOffset: -2,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-block", width: 16, height: 16, boxSizing: "border-box",
            borderRadius: "50%", border: "1.5px solid currentColor",
            color: open ? "var(--accent-primary)" : "var(--text-muted)",
            fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 700,
            fontSize: 11, lineHeight: "13px", textAlign: "center",
          }}
        >
          i
        </span>
      </button>

      {/* Announces the text to screen readers when opened */}
      <span role="status" style={VISUALLY_HIDDEN}>{open ? paragraphs.join(" ") : ""}</span>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={popRef}
          id={id}
          aria-hidden="true"
          style={{
            position: "fixed", zIndex: 100000,
            top: pos ? pos.top : 0, left: pos ? pos.left : 0, width,
            visibility: pos ? "visible" : "hidden",
            boxSizing: "border-box", padding: "10px 12px",
            background: theme.bg || "var(--bg-surface)", color: theme.text || "var(--text-primary)",
            border: `1px solid ${theme.border || "var(--border)"}`, borderRadius: theme.radius || "var(--radius-md)",
            boxShadow: theme.shadow || "0 8px 24px rgba(0,0,0,0.18)",
            fontSize: 12.5, lineHeight: 1.45, fontWeight: 400, textAlign: "left",
            textTransform: "none", letterSpacing: 0,
          }}
        >
          {pos && (
            <span
              style={{
                position: "absolute", left: pos.arrowLeft - 5,
                [pos.above ? "bottom" : "top"]: -6,
                width: 10, height: 10, background: theme.bg || "var(--bg-surface)",
                transform: "rotate(45deg)",
                ...(pos.above
                  ? { borderBottom: `1px solid ${theme.border || "var(--border)"}`, borderRight: `1px solid ${theme.border || "var(--border)"}` }
                  : { borderTop: `1px solid ${theme.border || "var(--border)"}`, borderLeft: `1px solid ${theme.border || "var(--border)"}` }),
              }}
            />
          )}
          {paragraphs.map((p, i) => (
            <p key={i} style={{ margin: i === paragraphs.length - 1 ? 0 : "0 0 6px" }}>{p}</p>
          ))}
        </div>,
        document.body
      )}
    </span>
  );
}
