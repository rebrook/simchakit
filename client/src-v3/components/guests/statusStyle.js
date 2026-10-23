// Moved verbatim from GuestsTab.jsx (V4.45.0 module split) — no behavior changes.


// Shared RSVP status color mapping — used by the main household RsvpPill and the
// per-sub-event RsvpPill in both GuestsTab and HouseholdModal, so colors never
// drift between the two.
export const statusStyle = {
  "Invited":  { bg:"var(--blue-light)",   color:"var(--blue)"   },
  "RSVP Yes": { bg:"var(--green-light)",  color:"var(--green)"  },
  "RSVP No":  { bg:"var(--red-light)",    color:"var(--red)"    },
  "Pending":  { bg:"var(--orange-light)", color:"var(--orange)" },
  "Maybe":    { bg:"var(--gold-light)",   color:"var(--gold)"   },
};
