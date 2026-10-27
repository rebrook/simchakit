// One-time "New" pill on a feature. { key, area, since }: shown for 14 days after `since`, or until the
// person opens the feature, remembered per browser under NEW_SEEN_KEY (the only localStorage key this uses).
export const NEW_FEATURES = [
  { key: "celebration-schedule", area: "overview", since: "2026-10-27" },
];

export const NEW_PILL_DAYS = 14;
export const NEW_SEEN_KEY = "simchakit.newSeen";

const readSeen = () => {
  try { return JSON.parse(localStorage.getItem(NEW_SEEN_KEY) || "[]"); } catch { return []; }
};

export function isNewFeature(key, now = Date.now()) {
  const f = NEW_FEATURES.find(x => x.key === key);
  if (!f) return false;
  if (now - new Date(f.since + "T00:00:00").getTime() > NEW_PILL_DAYS * 864e5) return false;
  return !readSeen().includes(key);
}

export function markFeatureSeen(key) {
  try {
    const seen = readSeen();
    if (!seen.includes(key)) localStorage.setItem(NEW_SEEN_KEY, JSON.stringify([...seen, key]));
  } catch { /* storage unavailable: the pill simply stays until it expires */ }
}
