// Preparation item categories, statuses, and status styles

const PREP_CATEGORIES = [
  "Attire & Appearance",
  "Community / Service Project",
  "Milestones & Sessions",
  "Personal Preparation",
  "Rehearsals & Practice",
  "Religious Study",
  "Service Preparation",
  "Speeches & Toasts",
  "Other",
];

const PREP_STATUSES = ["Not Started", "In Progress", "Nearly Done", "Complete"];

const PREP_STATUS_STYLES = {
  "Not Started": { bg: "var(--bg-muted)",    color: "var(--text-muted)" },
  "In Progress":  { bg: "var(--blue-light)",  color: "var(--blue)"       },
  "Nearly Done":  { bg: "var(--gold-light)",  color: "var(--gold)"       },
  "Complete":     { bg: "var(--green-light)", color: "var(--green)"      },
};

export {
  PREP_CATEGORIES,
  PREP_STATUSES,
  PREP_STATUS_STYLES,
};
