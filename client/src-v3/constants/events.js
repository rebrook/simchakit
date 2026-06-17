// Event type definitions, icons, and timeline constants

const DAY_OF_TIME_BLOCKS = ["Morning", "Midday", "Afternoon", "Evening", "Wrap-up"];

const EVENT_TYPE_LABELS_MAP = {
  "bat-mitzvah":  "Bat Mitzvah",
  "bar-mitzvah":  "Bar Mitzvah",
  "bnei-mitzvah": "B'nei Mitzvah",
  "wedding":      "Wedding",
  "baby-naming":  "Baby Naming",
  "graduation":   "Graduation",
  "anniversary":  "Anniversary",
  "birthday":     "Birthday",
  "other":        "Other Celebration",
};

// TODO: Event-type glyphs carry meaning and brand identity (✡ for mitzvahs,
// 💍 for weddings, etc.). These are stored as emoji strings in admin_config
// and in the database. Converting them to Lucide icons requires a data model
// decision and migration — handle separately from the Q1 icon system swap.
const EVENT_TYPE_ICONS = {
  "bat-mitzvah":  "✡",
  "bar-mitzvah":  "✡",
  "bnei-mitzvah": "✡",
  "wedding":      "💍",
  "baby-naming":  "👶",
  "graduation":   "🎓",
  "anniversary":  "🥂",
  "birthday":     "🎂",
  "other":        "🎉",
};

const MITZVAH_TYPES = new Set(["bat-mitzvah", "bar-mitzvah", "bnei-mitzvah"]);

// Line-icon keys for the event-type chip (maps type → iconMap.jsx key).
// Replaces emoji rendering in the identity chip for cross-platform consistency.
// The emoji map (EVENT_TYPE_ICONS) is kept for other consumers (timeline, exports).
const EVENT_TYPE_ICON_KEYS = {
  "bat-mitzvah":  "starOfDavid",
  "bar-mitzvah":  "starOfDavid",
  "bnei-mitzvah": "starOfDavid",
  "wedding":      "rings",
  "baby-naming":  "baby",
  "graduation":   "graduationCap",
  "anniversary":  "champagne",
  "birthday":     "cake",
  "other":        "partyPopper",
};

export {
  DAY_OF_TIME_BLOCKS,
  EVENT_TYPE_LABELS_MAP,
  EVENT_TYPE_ICONS,
  EVENT_TYPE_ICON_KEYS,
  MITZVAH_TYPES,
};
