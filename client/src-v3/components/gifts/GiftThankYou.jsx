// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.12.0 — components/gifts/GiftThankYou.jsx (V5-M3)
// Pieces of "Draft thank-you" on the Gifts tab:
//   GiverThankYouAction  the per-giver control in a gift row or card
//   GiftThankYouComposer the message composer opened on the Thank-you template
//                        with the chosen households fixed (loads the message log
//                        only while it is open, so the Gifts tab stays light)
// The Written / Mailed updates after a send are made by GiftsTab, which owns
// the gift records.
// ─────────────────────────────────────────────────────────────────────────────

import { MessageComposer } from "@/components/guests/MessageComposer.jsx";
import { useMessageLog } from "@/hooks/useMessageLog.js";
import { giverEmailState } from "@/utils/gifts.js";
import { Icon } from "@/utils/iconMap.jsx";

// What a giver's row offers for the thank-you note. Shown only to people who can
// edit; a giver whose note is already written shows its state as text instead.
export function GiverThankYouAction({ giver, households, canAct, onDraft, onMarkPaper }) {
  if (giver.thankYouWritten) {
    return giver.thankYouMessageId
      ? <span className="gift-ty-note"><Icon name="check" context="badge" /> Emailed</span>
      : null;
  }
  if (!canAct) return null;
  const { state } = giverEmailState(giver, households);
  if (state === "ready") {
    return (
      <div className="gift-ty-actions">
        <button type="button" className="btn btn-secondary btn-sm gift-ty-btn" onClick={onDraft}
          aria-label={`Draft thank-you for ${giver.name || "this giver"}`}>
          <Icon name="mail" context="inline" /> Draft thank-you
        </button>
      </div>
    );
  }
  return (
    <div className="gift-ty-actions">
      {state === "no_email"
        ? <button type="button" className="msg-link-btn gift-ty-link" onClick={onDraft}
            aria-label={`No email for ${giver.name || "this giver"}, add one`}>No email, add one</button>
        : <span className="gift-ty-note">Not on guest list</span>}
      <button type="button" className="btn btn-secondary btn-sm gift-ty-btn" onClick={onMarkPaper}
        aria-label={`Mark written (paper) for ${giver.name || "this giver"}`}>
        Mark written (paper)
      </button>
    </div>
  );
}

export function GiftThankYouComposer({
  eventId, households, adminConfig, entries, onSaveEmail, onSent, onClose, showToast, renderResultExtra,
}) {
  const msgLog = useMessageLog(eventId);
  const notes = Object.fromEntries(entries.map(e => [e.key, `Thank-you for ${e.names.filter(Boolean).join(" and ") || "this giver"}`]));
  return (
    <MessageComposer
      eventId={eventId} households={households} sections={[]} groups={[]}
      adminConfig={adminConfig} sentLookup={msgLog.sentLookup}
      initialIds={entries.map(e => e.key)} initialKind="thank_you" initialMethod="email"
      locked recipientNotes={notes} renderResultExtra={renderResultExtra}
      onSaveEmail={onSaveEmail} onSent={onSent} onClose={onClose} showToast={showToast}
    />
  );
}
