// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.4.0 — rsvp/rsvpUi.jsx
// Small building blocks for the guest RSVP page. Every answer is words plus a shape
// (✓ Yes, ✕ No, ? Not sure; ○ when unchosen), never color alone, and every control is
// at least 44px tall (see styles/rsvp.css).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";

export const ANSWER_OPTIONS = [
  { key: "yes",    label: "Yes",      glyph: "✓" },
  { key: "no",     label: "No",       glyph: "✕" },
  { key: "unsure", label: "Not sure", glyph: "?" },
];
export const answerLabel = (key) => ANSWER_OPTIONS.find(o => o.key === key)?.label || "No answer yet";

// One question, one radio group, with a visible legend. `legend` is the full sentence a
// screen reader hears ("Rachel, Service"); `children` is what sighted guests see.
export function AnswerGroup({ name, legend, value, onChange, invalid, showUnsure = true }) {
  const options = showUnsure ? ANSWER_OPTIONS : ANSWER_OPTIONS.filter(o => o.key !== "unsure");
  return (
    <fieldset className={`rs-answer${invalid ? " invalid" : ""}`} data-answer-group={name}>
      <legend className="rs-answer-legend">{legend}</legend>
      <div className="rs-seg">
        {options.map(o => (
          <label key={o.key} className={`rs-seg-opt ${o.key}${value === o.key ? " on" : ""}`}>
            <input type="radio" name={name} value={o.key} checked={value === o.key} onChange={() => onChange(o.key)} />
            <span className="rs-seg-shape" aria-hidden="true">{value === o.key ? o.glyph : "○"}</span>
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Progress({ step, total = 3 }) {
  return (
    <div className="rs-progress" role="img" aria-label={`Step ${Math.min(step, total)} of ${total}`}>
      {Array.from({ length: total }, (_, i) => <span key={i} className={i < step ? "on" : ""} />)}
    </div>
  );
}

// The event's logo, or its first letter in a circle when it has none.
export function EventMark({ event }) {
  if (event.logoUrl) return <img className="rs-logo" src={event.logoUrl} alt={event.name} />;
  return <div className="rs-monogram" aria-hidden="true">{(event.name || "?").trim().charAt(0).toUpperCase()}</div>;
}

// Moves focus to the heading when a screen changes, so screen-reader users land at the top.
export function ScreenHeading({ children, className = "rs-h2" }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus({ preventScroll: false }); }, []);
  return <h1 ref={ref} tabIndex={-1} className={className}>{children}</h1>;
}

export function Notice({ tone = "info", children }) {
  return <div className={`rs-notice ${tone}`} role={tone === "error" ? "alert" : "status"}>{children}</div>;
}
