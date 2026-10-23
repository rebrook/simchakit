// Moved verbatim from AppShell.jsx (V4.47.0 module split) — no behavior changes.

// ── Tab labels for the top bar ──────────────────────────────────────────────
export const TAB_LABELS = {
  overview:       "Overview",
  guests:         "Guests",
  budget:         "Budget",
  vendors:        "Vendors",
  tasks:          "Tasks",
  prep:           "Prep",
  ceremony:       "Ceremony",
  seating:        "Seating",
  gifts:          "Gifts",
  accommodations: "Stay & Travel",
  favors:         "Favors",
  calendar:       "Calendar",
};

// ── Mobile bottom bar tab IDs (fixed, matches V2 exactly) ──────────────────
export const BOTTOM_BAR_IDS = ["overview", "guests", "budget", "vendors", "tasks"];

// ── Sidebar nav groups ─────────────────────────────────────────────────────
export const SIDEBAR_GROUPS = [
  {
    label: "Planning",
    tabs: [
      { id: "overview",       icon: "overview",       label: "Overview"      },
      { id: "guests",         icon: "guests",         label: "Guests"        },
      { id: "budget",         icon: "budget",         label: "Budget"        },
      { id: "vendors",        icon: "vendors",        label: "Vendors"       },
      { id: "tasks",          icon: "tasks",          label: "Tasks"         },
      { id: "prep",           icon: "prep",           label: "Prep"          },
    ],
  },
  {
    label: "The Celebration",
    tabs: [
      { id: "ceremony",       icon: "ceremony",       label: "Ceremony"      },
      { id: "seating",        icon: "seating",        label: "Seating"       },
      { id: "gifts",          icon: "gifts",          label: "Gifts"         },
      { id: "accommodations", icon: "accommodations", label: "Stay & Travel" },
      { id: "favors",         icon: "favors",         label: "Favors"        },
      { id: "calendar",       icon: "calendar",       label: "Calendar"      },
    ],
  },
];

// Flat list of all tabs (derived from groups, used for filtering)
export const ALL_TABS = SIDEBAR_GROUPS.flatMap(g => g.tabs);
