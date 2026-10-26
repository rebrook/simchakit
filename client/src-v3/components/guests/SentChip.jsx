// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.2.0 — components/guests/SentChip.jsx
// Labeled sent-status chip (text plus shape, never color alone), same pattern as
// the Gifts thank-you chips. Shapes: ○ not sent, ● sent, ▲ failed.
//
// Full chip (default) is two-part and names its kind on screen:
//   "Save the Date | ○ Not sent"   "Invitation | ● Sent by email, Mar 3"
// The text is all visible, so there is no aria-label to duplicate it; the title
// repeats the full sentence for hover. showKind={false} drops the kind part where
// the surrounding row already names it (the Messages log).
// `compact` is the tight desktop-row form: "STD: Manual".
// ─────────────────────────────────────────────────────────────────────────────

import { statusText } from "@/utils/messageStatus.js";

const SHAPE = { none: "○", sent: "●", failed: "▲" };

const SHORT = { email: "Email", mail: "Mail", elsewhere: "Elsewhere", manual: "Manual", failed: "Failed", sending: "Sending", none: "Not sent" };

export function SentChip({ status, kindLabel, compact = false, showKind = true }) {
  const full = statusText(status);
  const shape = <span className="msg-chip-shape" aria-hidden="true">{SHAPE[status.tone] || SHAPE.none}</span>;

  if (compact) {
    return (
      <span className={`msg-chip ${status.tone} compact`} title={`${kindLabel}: ${full}`}>
        {shape}
        <span>{`${kindLabel}: ${SHORT[status.state] || status.label}`}</span>
      </span>
    );
  }
  return (
    <span className={`msg-chip ${status.tone}${showKind ? " has-kind" : ""}`} title={`${kindLabel}: ${full}`}>
      {showKind && <span className="msg-chip-kind">{kindLabel}</span>}
      {shape}
      <span>{full}</span>
    </span>
  );
}
