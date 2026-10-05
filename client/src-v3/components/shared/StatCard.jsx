// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.32.0: StatCard.jsx
// Reusable stat card with optional conic-gradient ring or progress bar.
// Props:
//   label       : uppercase stat label (required)
//   value       : primary display value (number or formatted string, required)
//   numericValue: raw number for pct calc when value is a formatted string
//   total       : denominator (number); when provided, renders fraction + ring/bar
//   totalDisplay: optional formatted string for denominator (e.g. "$28,000")
//   tone        : "green" | "accent" | "gold" (default "accent")
//   sub         : verb/caption for pct ("confirmed", "paid", etc.)
//   subFallback : caption when total is 0 or absent ("No budget set")
//   display     : "ring" renders conic-gradient ring; otherwise progress bar
//   onClick, title, className, style: passthrough to the button wrapper
//   secondary   : if true, renders in the lighter secondary treatment (no ring/bar)
//   info        : optional string or array of strings: adds a small "i" button that
//                  opens a popover explaining how the number is counted. A card with
//                  info renders as a plain container with a transparent full-card
//                  button on top for onClick (a button cannot contain the "i" button),
//                  so the card looks and behaves the same. Cards without info render
//                  exactly as before, as a single button.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { InfoPopover } from "@/components/shared/InfoPopover.jsx";

const TONE_COLORS = {
  green:  "var(--green)",
  accent: "var(--accent-primary)",
  gold:   "var(--gold)",
};

const TONE_CLASSES = {
  green:  "stat-green",
  accent: "stat-accent",
  gold:   "stat-gold",
};

export function StatCard({
  label,
  value,
  numericValue,
  total,
  totalDisplay,
  tone = "accent",
  sub,
  subFallback,
  onClick,
  title,
  className = "",
  style,
  secondary = false,
  display,
  info,
}) {
  const [kbFocus, setKbFocus] = useState(false);
  const hasFraction = total !== undefined && total !== null;
  const numVal      = numericValue !== undefined ? numericValue : (typeof value === "number" ? value : parseFloat(value) || 0);
  const pct         = hasFraction && total > 0 ? Math.round((numVal / total) * 100) : 0;
  const isEmpty     = hasFraction && total === 0;
  const useRing     = display === "ring" && hasFraction && !secondary;

  const cardClass = secondary
    ? `stat-card-secondary ${className}`
    : `stat-card ${useRing ? "stat-card-ring" : ""} ${className}`;

  const colorClass = TONE_CLASSES[tone] || "stat-accent";
  const fillColor  = TONE_COLORS[tone] || "var(--accent-primary)";

  // Conic-gradient ring: arc = tone color, remainder = muted track
  const ringGradient = `conic-gradient(${fillColor} ${pct}%, var(--bg-muted) 0)`;

  // Keep the label clear of the "i" button on cards that have one
  const labelStyle = info ? { paddingRight: 22 } : undefined;

  const body = (
      useRing && !isEmpty ? (
        /* ── Ring layout: ring left, text stack right ───────────── */
        <div className="stat-ring-layout">
          <div
            className="stat-ring"
            style={{ background: ringGradient }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${label}: ${pct}%`}
          >
            <span className="stat-ring-pct">{pct}%</span>
          </div>
          <div className="stat-ring-text">
            <div className="stat-label" style={labelStyle}>{label}</div>
            <div className={`stat-value ${colorClass}`}>
              {value} <span className="stat-denom">/ {totalDisplay ?? total}</span>
            </div>
            {sub && (
              <div className="stat-pct" style={{ color: "var(--text-secondary)" }}>
                {pct}% {sub}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── Standard stacked layout (bar or no-fraction) ──────── */
        <>
          <div className="stat-label" style={labelStyle}>{label}</div>

          <div className={`stat-value ${colorClass}`}>
            {hasFraction ? (
              <>
                {value} <span className="stat-denom">/ {totalDisplay ?? total}</span>
              </>
            ) : (
              value
            )}
          </div>

          {hasFraction && !isEmpty && display !== "ring" && (
            <div
              className="stat-progress"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${label}: ${pct}%`}
            >
              <div
                className="stat-progress-fill"
                style={{ width: `${pct}%`, background: fillColor }}
              />
            </div>
          )}

          {hasFraction && !isEmpty && sub && display !== "ring" && (
            <div className="stat-pct" style={{ color: fillColor }}>
              {pct}% {sub}
            </div>
          )}

          {isEmpty && subFallback && (
            <div className="stat-sub">{subFallback}</div>
          )}

          {!hasFraction && sub && (
            <div className="stat-sub">{sub}</div>
          )}
        </>
      )
  );

  // No info popover: render exactly as before, a single button.
  if (!info) {
    return (
      <button
        type="button"
        className={cardClass}
        onClick={onClick}
        title={title}
        style={{ cursor: "pointer", display: "block", textAlign: "left", font: "inherit", ...style }}
      >
        {body}
      </button>
    );
  }

  // With an info popover: a plain container, with a transparent full-card
  // button on top for navigation and the "i" button as its sibling.
  return (
    <div
      className={cardClass}
      style={{ position: "relative", textAlign: "left", cursor: onClick ? "pointer" : "default", ...style }}
    >
      {body}
      {onClick && (
        <button
          type="button"
          onClick={onClick}
          title={title}
          aria-label={title || label}
          onFocus={(e) => setKbFocus(e.currentTarget.matches(":focus-visible"))}
          onBlur={() => setKbFocus(false)}
          style={{
            position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
            width: "100%", height: "100%", margin: 0, padding: 0,
            background: "transparent", border: "none", borderRadius: "inherit",
            cursor: "pointer", zIndex: 1,
            outline: kbFocus ? "2px solid var(--accent-primary)" : "none", outlineOffset: -2,
          }}
        />
      )}
      <InfoPopover text={info} style={{ position: "absolute", top: 10, right: 10, zIndex: 2 }} />
    </div>
  );
}
