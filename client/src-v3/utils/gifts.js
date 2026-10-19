// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.33.0 — utils/gifts.js
// Shared helpers for multi-giver gifts. A gift can be given by more than one
// household (e.g. three families pooling together on one gift), so a gift's
// "from" is now a givers array rather than a single fromName/householdId pair.
//
// Legacy shape (pre-V4.33.0): fromName, householdId, address1/2, city,
// stateProvince, postalCode, country, thankYouWritten, thankYouMailed all
// lived at the top level of the gift record, one giver per gift.
//
// New shape: gift.givers = [{ id, name, householdId, address1, address2,
// city, stateProvince, postalCode, country, thankYouWritten, thankYouMailed }]
//
// No Supabase migration is run for this change. getGiftGivers() reads a
// legacy-shape gift and synthesizes a one-item givers array on the fly, the
// same pattern utils/guests.js already uses for migrateCityStateZip(). Every
// gift upgrades to the new shape the next time it is saved, since GiftModal
// and the inline thank-you toggles always write gift.givers going forward.
// ─────────────────────────────────────────────────────────────────────────────

const LEGACY_GIVER_FIELDS = [
  "fromName", "householdId", "address1", "address2", "city",
  "stateProvince", "postalCode", "country", "thankYouWritten", "thankYouMailed",
];

// ── ID generator — self-contained, does not depend on utils/ids.js ──────────
function newGiverId() {
  return "giv_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── Read a gift's givers, migrating a legacy-shape gift on the fly ──────────
function getGiftGivers(gift) {
  if (Array.isArray(gift?.givers) && gift.givers.length > 0) return gift.givers;
  if (!gift) return [];
  return [{
    id:              newGiverId(),
    name:            gift.fromName || "",
    householdId:     gift.householdId || null,
    address1:        gift.address1 || "",
    address2:        gift.address2 || "",
    city:            gift.city || "",
    stateProvince:   gift.stateProvince || "",
    postalCode:      gift.postalCode || "",
    country:         gift.country || "",
    thankYouWritten: !!gift.thankYouWritten,
    thankYouMailed:  !!gift.thankYouMailed,
  }];
}

// ── Return a gift with legacy top-level giver fields stripped and the given
//    givers array set. Used whenever a legacy-shape gift is saved, so the row
//    fully cuts over to the new shape instead of carrying both. ─────────────
function withGivers(gift, givers) {
  const clean = { ...gift };
  LEGACY_GIVER_FIELDS.forEach(f => delete clean[f]);
  return { ...clean, givers };
}

// ── Display helpers ──────────────────────────────────────────────────────────
function lastNameOf(name) {
  return (name || "").trim().split(" ").pop();
}

function formatGiverNames(givers) {
  const names = (givers || []).map(g => g.name).filter(Boolean);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

// ── Thank-you status, evaluated across all givers on a gift ──────────────────
function anyGiverNeedsWritten(givers) {
  return (givers || []).some(g => !g.thankYouWritten);
}

function anyGiverNeedsMailed(givers) {
  return (givers || []).some(g => g.thankYouWritten && !g.thankYouMailed);
}

function allGiversComplete(givers) {
  return (givers || []).length > 0 && givers.every(g => g.thankYouWritten && g.thankYouMailed);
}

// ── Outstanding thank-you notes across a list of gifts (V4.38.0) ─────────────
// One shared definition for the Overview focus panel and the Gifts nav badge,
// so the two can never disagree. Counted per giver, since each giver is
// thanked separately. A note is outstanding until it is both written and
// mailed. toWrite and toMail partition the outstanding notes: toWrite is any
// giver not yet written, toMail is written but not yet mailed.
function countThankYousOutstanding(gifts) {
  let toWrite = 0;
  let toMail = 0;
  (gifts || []).forEach(g => {
    getGiftGivers(g).forEach(gv => {
      if (!gv.thankYouWritten) toWrite += 1;
      else if (!gv.thankYouMailed) toMail += 1;
    });
  });
  return { total: toWrite + toMail, toWrite, toMail };
}

export {
  newGiverId,
  getGiftGivers,
  withGivers,
  lastNameOf,
  formatGiverNames,
  anyGiverNeedsWritten,
  anyGiverNeedsMailed,
  allGiversComplete,
  countThankYousOutstanding,
};
