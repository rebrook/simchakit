// Moved from AppShell.jsx (V4.47.0 module split); TAB_PRIMARY_ACTIONS added in V4.49.0.
import { PRIMARY_ACTION_EVENT } from "@/hooks/usePrimaryAction.js";

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

// Per-tab primary action shown in the desktop top bar (V4.49.0).
// event: CustomEvent the top bar dispatches (the active tab listens).
// requiresEdit: disabled for viewers and archived events.
// Tabs without an entry (Calendar, Stay & Travel) show no action.
const ADD = PRIMARY_ACTION_EVENT;
export const TAB_PRIMARY_ACTIONS = {
  overview: { label: "Print Brief",   icon: "printer", event: "simchakit:print-brief", requiresEdit: false },
  guests:   { label: "Add Household", icon: "plus",    event: ADD, requiresEdit: true },
  budget:   { label: "Add Expense",   icon: "plus",    event: ADD, requiresEdit: true },
  vendors:  { label: "Add Vendor",    icon: "plus",    event: ADD, requiresEdit: true },
  tasks:    { label: "Add Task",      icon: "plus",    event: ADD, requiresEdit: true },
  prep:     { label: "Add Item",      icon: "plus",    event: ADD, requiresEdit: true },
  ceremony: { label: "Add Role",      icon: "plus",    event: ADD, requiresEdit: true },
  seating:  { label: "Add Table",     icon: "plus",    event: ADD, requiresEdit: true },
  gifts:    { label: "Log Gift",      icon: "plus",    event: ADD, requiresEdit: true },
  favors:   { label: "Add Favor",     icon: "plus",    event: ADD, requiresEdit: true },
};
