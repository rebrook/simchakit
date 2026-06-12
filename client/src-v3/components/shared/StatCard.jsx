// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.2.0 — StatCard.jsx
// Reusable stat card with optional progress bar for fractional values.
// Props:
//   label        — uppercase stat label (required)
//   value        — primary display value (number or formatted string, required)
//   numericValue — raw number for pct calc when value is a formatted string
//   total        — denominator (number); when provided, renders fraction + bar
//   totalDisplay — optional formatted string for denominator (e.g. "$28,000")
//   tone         — "green" | "accent" | "gold" (default "accent")
//   sub          — verb/caption for pct ("confirmed", "paid", etc.)
//   subFallback  — caption when total is 0 or absent ("No budget set")
//   onClick, title, className, style — passthrough to the button wrapper
//   secondary    — if true, renders in the lighter secondary treatment
// ─────────────────────────────────────────────────────────────────────────────

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
}) {
  const hasFraction = total !== undefined && total !== null;
  const numVal      = numericValue !== undefined ? numericValue : (typeof value === "number" ? value : parseFloat(value) || 0);
  const pct         = hasFraction && total > 0 ? Math.round((numVal / total) * 100) : 0;
  const isEmpty     = hasFraction && total === 0;

  const cardClass = secondary
    ? `stat-card-secondary ${className}`
    : `stat-card ${className}`;

  const colorClass = TONE_CLASSES[tone] || "stat-accent";
  const fillColor  = TONE_COLORS[tone] || "var(--accent-primary)";

  return (
    <button
      type="button"
      className={cardClass}
      onClick={onClick}
      title={title}
      style={{ cursor: "pointer", display: "block", textAlign: "left", font: "inherit", ...style }}
    >
      <div className="stat-label">{label}</div>

      <div className={`stat-value ${colorClass}`}>
        {hasFraction ? (
          <>
            {value} <span className="stat-denom">/ {totalDisplay ?? total}</span>
          </>
        ) : (
          value
        )}
      </div>

      {hasFraction && !isEmpty && (
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

      {hasFraction && !isEmpty && sub && (
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
    </button>
  );
}
