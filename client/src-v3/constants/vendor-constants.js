// Vendor types, statuses, and status styles

const VENDOR_TYPES = [
  "Baker",
  "Caterer",
  "Decorator",
  "DJ / Band",
  "Florist",
  "Hair & Makeup",
  "Invitation Designer",
  "Officiant / Clergy",
  "Party Planner",
  "Photo Booth",
  "Photographer",
  "Transportation",
  "Venue",
  "Videographer",
  "Other",
];

const VENDOR_STATUSES = [
  "Researching",
  "Contacted",
  "Booked",
  "Deposit Paid",
  "Paid in Full",
  "Cancelled",
];

const VENDOR_STATUS_STYLES = {
  "Researching": { bg: "var(--bg-muted)",      color: "var(--text-muted)"    },
  "Contacted":   { bg: "var(--blue-light)",     color: "var(--blue)"          },
  "Booked":      { bg: "var(--accent-light)",   color: "var(--accent-primary)"},
  "Deposit Paid":{ bg: "var(--gold-light)",     color: "var(--gold)"          },
  "Paid in Full":{ bg: "var(--green-light)",    color: "var(--green)"         },
  "Cancelled":   { bg: "var(--red-light)",      color: "var(--red)"           },
};

export {
  VENDOR_TYPES,
  VENDOR_STATUSES,
  VENDOR_STATUS_STYLES,
};
