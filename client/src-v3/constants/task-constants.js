// Task categories, priorities, and priority styles

const TASK_CATEGORIES = [
  "Attire",
  "Budget",
  "Catering",
  "Ceremony / Service",
  "Entertainment",
  "Florals & Decor",
  "Gifts & Favors",
  "Invitations & Stationery",
  "Mitzvah Project",
  "Photography & Video",
  "Planning",
  "Theme & Branding",
  "Transportation",
  "Vendor",
  "Venue",
  "Other",
];

const TASK_PRIORITIES = ["High", "Medium", "Low"];

const TASK_PRIORITY_STYLES = {
  "High":   { bg: "var(--red-light)",   color: "var(--red)"   },
  "Medium": { bg: "var(--gold-light)",  color: "var(--gold)"  },
  "Low":    { bg: "var(--bg-muted)",    color: "var(--text-muted)" },
};

export {
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_PRIORITY_STYLES,
};
