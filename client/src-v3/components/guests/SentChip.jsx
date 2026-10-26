// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.1.0 — components/guests/SentChip.jsx
// Labeled sent-status chip (text plus shape, never color alone), same pattern as
// the Gifts thank-you chips. Shapes: ○ not sent, ● sent, ▲ failed.
// `compact` prefixes a short kind label and shortens the status for the tight
// desktop row; the full text is always in the title and the accessible label.
// ─────────────────────────────────────────────────────────────────────────────

import { statusText } from "@/utils/messageStatus.js";

const SHAPE = { none: "○", sent: "●", failed: "▲" };

const SHORT = { email: "Email", mail: "Mail", elsewhere: "Elsewhere", manual: "Manual", failed: "Failed", sending: "Sending", none: "Not sent" };

export function SentChip({ status, kindLabel, compact = false }) {
  const full = statusText(status);
  const text = compact ? `${kindLabel}: ${SHORT[status.state] || status.label}` : full;
  return (
    <span className={`msg-chip ${status.tone}${compact ? " compact" : ""}`}
      title={`${kindLabel}: ${full}`} aria-label={`${kindLabel}: ${full}`}>
      <span className="msg-chip-shape" aria-hidden="true">{SHAPE[status.tone] || SHAPE.none}</span>
      <span>{text}</span>
    </span>
  );
}
