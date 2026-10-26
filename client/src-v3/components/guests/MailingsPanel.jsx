// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.2.0 — components/guests/MailingsPanel.jsx
// The Mailings block for one household: one row per kind in a fixed order (Save
// the Date, Invitation, RSVP reminder, Thank-you), each a chip that names its
// kind, with Clear at the end of the row for a "Sent (manual)" mark. Used by the
// expanded Guests row (with actions) and by the household edit window
// (read-only), so both look identical.
// ─────────────────────────────────────────────────────────────────────────────

import { SentChip } from "@/components/guests/SentChip.jsx";
import { MESSAGE_KINDS } from "@/utils/messageTemplates.js";

export function MailingsPanel({ household, sentLookup, canEdit = false, onClear, onMessage, onMark, note }) {
  return (
    <div className="msg-mail-panel">
      <div className="msg-chip-label" id={`mailings-${household._rowId || household.id}`}>Mailings</div>
      <div className="msg-mail-grid" role="list" aria-labelledby={`mailings-${household._rowId || household.id}`}>
        {MESSAGE_KINDS.filter(k => k.manual).map(k => {
          const status = sentLookup(household, k.key);
          return (
            <div key={k.key} className="msg-mail-item" role="listitem">
              <SentChip status={status} kindLabel={k.label} />
              <span className="msg-mail-action">
                {status.state === "manual" && canEdit && onClear && (
                  <button type="button" className="btn btn-ghost btn-sm msg-clear-btn"
                    aria-label={`Clear ${k.label} (manual) mark`} onClick={() => onClear(k.key)}>
                    Clear
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>
      {note && <div className="msg-mail-note">{note}</div>}
      {canEdit && (onMessage || onMark) && (
        <div className="msg-mail-row">
          {onMessage && <button type="button" className="btn btn-secondary btn-sm" onClick={onMessage}>Message this household</button>}
          {onMark && <button type="button" className="btn btn-secondary btn-sm" onClick={onMark}>Mark as sent</button>}
        </div>
      )}
    </div>
  );
}
