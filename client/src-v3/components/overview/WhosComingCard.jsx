// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.9.0 — components/overview/WhosComingCard.jsx
// RSVP replies at a glance, in the app's guest-count vocabulary (constants/metrics.js):
// Confirmed, Declined, Awaiting, each with a shape and a word, never color alone. One bar, an
// image with an aria-label that states the three numbers. Per-sub-event counts live in the
// schedule. Day zero: a short sentence and an import button. Replaced after the event.
// ─────────────────────────────────────────────────────────────────────────────

import { InfoPopover } from "@/components/shared/InfoPopover.jsx";
import { METRIC_HELP } from "@/constants/metrics.js";

export function WhosComingCard({ stage, confirmed, declined, awaiting, guests, households, outOfTown, precise, go, canImport, onImport, onOpenGuests }) {
  if (stage === "new" || guests === 0) {
    return (
      <section className="ov-card ov-a-w ov-who" aria-labelledby="ov-who-title">
        <div className="ov-who-head"><h2 id="ov-who-title">Who's coming</h2></div>
        <div className="ov-sm">No guests yet. Import your list and replies will show here as they arrive.</div>
        {canImport && <button type="button" className="btn ov-btn-fill" style={{ width: "100%" }} onClick={onImport}>Import a spreadsheet</button>}
      </section>
    );
  }
  const total = Math.max(1, confirmed + declined + awaiting);
  const seg = (n) => ({ flex: Math.max(n, 0), minWidth: n > 0 ? 4 : 0 });
  return (
    <section className="ov-card ov-a-w ov-who" aria-labelledby="ov-who-title">
      <div className="ov-who-head">
        <h2 id="ov-who-title">Who's coming</h2>
        <span className="ov-sm">{guests} guest{guests !== 1 ? "s" : ""} in {households} household{households !== 1 ? "s" : ""}</span>
      </div>
      <div className="ov-big2">{confirmed} <small>confirmed <InfoPopover text={METRIC_HELP.confirmed({ precise })} label="How is confirmed counted?" /></small></div>
      <div className="ov-seg3" role="img" aria-label={`${confirmed} confirmed, ${declined} declined, ${awaiting} awaiting`}>
        <i style={{ ...seg(confirmed), background: "var(--green)", "--s": go ? 1 : 0 }} />
        <i style={{ ...seg(declined), background: "var(--red)", "--s": go ? 1 : 0 }} />
        <i style={{ ...seg(awaiting), background: "var(--gold-medium)", "--s": go ? 1 : 0 }} />
      </div>
      <div className="ov-legend">
        <span><b>{"●"} {confirmed}</b> Confirmed</span>
        <span><b>{"✕"} {declined}</b> Declined</span>
        <span><b>{"○"} {awaiting}</b> Awaiting</span>
      </div>
      {outOfTown > 0 && <div className="ov-sm">{outOfTown} household{outOfTown !== 1 ? "s are" : " is"} traveling in from out of town.</div>}
      <button type="button" className="ov-link" style={{ justifySelf: "start", padding: 0 }} onClick={onOpenGuests}>Open the guest list</button>
      <span className="ov-vh">{total}</span>
    </section>
  );
}
