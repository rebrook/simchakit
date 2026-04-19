// Expense categories and tippable vendor categories

const EXPENSE_CATEGORIES = [
  "Attire & Accessories",
  "Cake & Desserts",
  "Catering & Bar",
  "DJ / Band / Entertainment",
  "Florals & Decor",
  "Gifts",
  "Gratuities & Tips",
  "Hair & Makeup",
  "Hotel / Accommodations",
  "Invitations & Stationery",
  "Kiddush / Luncheon",
  "Lighting",
  "Miscellaneous",
  "Party Favors",
  "Photography",
  "Torah Portion Tutoring",
  "Transportation",
  "Venue",
  "Videography",
  "Custom",
];

const TIPPABLE_CATEGORIES = new Set([
  "Catering & Bar",
  "DJ / Band / Entertainment",
  "Hair & Makeup",
  "Photography",
  "Videography",
  "Transportation",
]);

export {
  EXPENSE_CATEGORIES,
  TIPPABLE_CATEGORIES,
};
