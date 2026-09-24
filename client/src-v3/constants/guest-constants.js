// Guest list constants — statuses, titles, and default config values

const RSVP_STATUSES    = ["Pending","Invited","RSVP Yes","RSVP No","Maybe"];

const TITLES           = ["","Mr.","Mrs.","Miss","Ms.","Dr.","Rabbi","Cantor","Mx."];

const DEFAULT_GROUPS   = ["Family","Friends","Other"];

const DEFAULT_MEALS    = ["Chicken","Fish","Vegetarian","Kids Meal"];

// Shared match rule for "which Meal Choice value counts as kosher".
// Used by CateringSummary.jsx, GuestsTab.jsx, and AdminPanel.jsx so the
// Meal Choice dropdown and the Kosher checkbox can never independently
// disagree about which meal option is the kosher one.
// adminConfig.kosherMealLabel (set in Admin Mode → Guests) takes priority;
// falls back to a case-insensitive "kosher" substring match on the value
// itself when the admin hasn't set an explicit label.
function isKosherMealChoice(value, adminConfig) {
  if (!value) return false;
  const label = adminConfig?.kosherMealLabel;
  if (label) return value === label;
  return value.toLowerCase().includes("kosher");
}

export {
  RSVP_STATUSES,
  TITLES,
  DEFAULT_GROUPS,
  DEFAULT_MEALS,
  isKosherMealChoice,
};
