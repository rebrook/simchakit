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

export {
  DAY_OF_TIME_BLOCKS,
  EVENT_TYPE_LABELS_MAP,
  EVENT_TYPE_ICONS,
  MITZVAH_TYPES,
};
