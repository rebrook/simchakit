// UI constants — action colors, search, calendar, and form helpers

const ACTION_COLORS = {
  "Added":     { bg: "var(--green-light)",  color: "var(--green)"  },
  "Updated":   { bg: "var(--blue-light)",   color: "var(--blue)"   },
  "Deleted":   { bg: "var(--red-light)",    color: "var(--red)"    },
  "Completed": { bg: "var(--gold-light)",   color: "var(--gold)"   },
};

const TL_HOURS   = ["12","1","2","3","4","5","6","7","8","9","10","11"];

const TL_MINUTES = ["00","15","30","45"];

const FOLLOW_UP_STATUSES = new Set(["Booked","Deposit Paid","Paid in Full"]);

const SEARCH_GROUPS = [
  { key: "households",     label: "Guests",       icon: "guests", tab: "guests"         },
  { key: "people",         label: "People",        icon: "people", tab: "guests"         },
  { key: "vendors",        label: "Vendors",       icon: "vendors", tab: "vendors"        },
  { key: "expenses",       label: "Expenses",      icon: "budget", tab: "budget"         },
  { key: "tasks",          label: "Tasks",         icon: "tasks", tab: "tasks"          },
  { key: "prep",           label: "Prep",          icon: "prep", tab: "prep"           },
  { key: "gifts",          label: "Gifts",         icon: "gifts", tab: "gifts"          },
  { key: "favors",         label: "Favors",        icon: "favors", tab: "favors"         },
  { key: "calendar",       label: "Calendar",      icon: "calendar", tab: "calendar"       },
];

const SEARCH_PER_GROUP = 4;

const CAL_SOURCES = [
  { key:"timeline",  label:"Events",     dotCls:"cal-dot-timeline",  tagCls:"cal-source-timeline"  },
  { key:"task",      label:"Tasks",      dotCls:"cal-dot-task",      tagCls:"cal-source-task"      },
  { key:"payment",   label:"Payments",   dotCls:"cal-dot-payment",   tagCls:"cal-source-payment"   },
  { key:"milestone", label:"Milestones", dotCls:"cal-dot-milestone", tagCls:"cal-source-milestone" },
  { key:"prep",      label:"Prep",       dotCls:"cal-dot-prep",      tagCls:"cal-source-prep"      },
];

export {
  ACTION_COLORS,
  TL_HOURS,
  TL_MINUTES,
  FOLLOW_UP_STATUSES,
  SEARCH_GROUPS,
  SEARCH_PER_GROUP,
  CAL_SOURCES,
};
