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
//
// V4.42.0: a gift record can also hold more than one gift. A family that gives
// a check and a book set is one record with two items, thanked once, instead of
// two records with two thank-you toggles.
//
// gift.items = [{ id, giftType, description, amount }] is the source of truth.
// withItems() also writes giftType, description, and amount at the top level as
// DERIVED summary fields (the single type, or "Combination" when the types
// differ; the descriptions joined; the amounts summed), so the CSV export, the
// print list, global search, and the audit log, which read those fields,
// keep working unchanged. Like givers, no migration is run: getGiftItems()
// reads a record saved before V4.42.0 as a one-item list, and the record
// upgrades the next time GiftModal saves it.
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

// ── Gift items (V4.42.0) ─────────────────────────────────────────────────────
function newItemId() {
  return "itm_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Read a gift's items. A record saved before V4.42.0 has one gift described by
// its top-level giftType, description, and amount, so it reads as one item.
// The synthesized id is stable (derived from the gift's id) so React keys do
// not change between renders.
function getGiftItems(gift) {
  if (!gift) return [];
  if (Array.isArray(gift.items) && gift.items.length > 0) return gift.items;
  return [{
    id:          gift.id ? `${gift.id}_item` : newItemId(),
    giftType:    gift.giftType || "",
    description: gift.description || "",
    amount:      gift.amount != null && gift.amount !== "" ? gift.amount : null,
  }];
}

// An item's amount as a number, or null when it has none.
function itemAmount(item) {
  const n = parseFloat(item?.amount);
  return Number.isFinite(n) ? n : null;
}

// Sum of the amounts that are present, rounded to cents; null when no item has one.
function sumItemAmounts(items) {
  let total = 0;
  let any = false;
  (items || []).forEach(it => {
    const n = itemAmount(it);
    if (n !== null) { total += n; any = true; }
  });
  return any ? Math.round(total * 100) / 100 : null;
}

// A record's total value across its items.
function getGiftTotal(gift) {
  return sumItemAmounts(getGiftItems(gift));
}

// Summary type for a list of items: the one type when they all match,
// "Combination" when they differ, empty when none is set.
function summaryGiftType(items) {
  const types = [...new Set((items || []).map(it => it.giftType).filter(Boolean))];
  if (types.length === 0) return "";
  return types.length === 1 ? types[0] : "Combination";
}

// Summary description: a single item's own description as typed; with several
// items, each item's description (or its type when it has none), joined.
function summaryDescription(items) {
  const list = items || [];
  if (list.length === 1) return list[0].description || "";
  return list.map(it => it.description || it.giftType).filter(Boolean).join("; ");
}

// Return the gift with its items set and the derived top-level summary fields
// (giftType, description, amount) recomputed from them.
function withItems(gift, items) {
  return {
    ...gift,
    items,
    giftType:    summaryGiftType(items),
    description: summaryDescription(items),
    amount:      sumItemAmounts(items),
  };
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

// ── Thank-you messages (V5.12.0, V5-M3) ──────────────────────────────────────
// A thank-you email goes to a giver's guest-list household, one message per
// household. Messages are sent through /api/guest, which identifies a household
// by its database row id (householdKey); a giver links to it by the app id
// stored inside the household's data (giver.householdId). The server fills
// {{household_name}} and {{gift_description}} from the household and its gifts.
//
// giver.thankYouMessageId (new, optional) holds the message_log id of the send
// that set Written. It lives in the gift's JSON, so there is no database change
// and older gifts read as having none.

const rowKeyOf = (household) => household?._rowId || household?.id;

// Where a giver's thank-you can go: "ready" (household with an email),
// "no_email" (household without one) or "no_guest" (not linked to a household).
function giverEmailState(giver, households) {
  const hh = giver?.householdId ? (households || []).find(h => h.id === giver.householdId) : null;
  if (!hh) return { state: "no_guest", household: null, key: null };
  const email = String(hh.email || "").trim();
  return { state: email ? "ready" : "no_email", household: hh, key: rowKeyOf(hh), email };
}

// refs: [{ giftId, giverId }]. Returns the households to message (deduplicated,
// so two givers in one household get one message) and the givers left out
// because they have no guest-list household.
function buildThankYouBatch(gifts, households, refs) {
  const byKey = new Map();   // household row key -> { household, refs[], names[] }
  const unlinked = [];
  (refs || []).forEach(({ giftId, giverId }) => {
    const gift = (gifts || []).find(g => g.id === giftId);
    const giver = gift ? getGiftGivers(gift).find(gv => gv.id === giverId) : null;
    if (!giver || giver.thankYouWritten) return;
    const info = giverEmailState(giver, households);
    if (!info.key) { unlinked.push({ giftId, giverId, name: giver.name || "" }); return; }
    const entry = byKey.get(info.key) || { key: info.key, household: info.household, refs: [], names: [] };
    entry.refs.push({ giftId, giverId });
    entry.names.push(giver.name || "");
    byKey.set(info.key, entry);
  });
  return { entries: [...byKey.values()], unlinked };
}

// Returns the gifts to save after a send: every giver in a household whose
// message went out gets Written set and the log id recorded. Mailed is never
// touched. sentKeys: Set of household row keys that were sent.
function applyThankYouSent(gifts, entries, sentKeys, messageId) {
  const wanted = new Map();   // giftId -> Set(giverId)
  (entries || []).forEach(e => {
    if (!sentKeys.has(e.key)) return;
    e.refs.forEach(r => {
      if (!wanted.has(r.giftId)) wanted.set(r.giftId, new Set());
      wanted.get(r.giftId).add(r.giverId);
    });
  });
  const changed = [];
  wanted.forEach((giverIds, giftId) => {
    const gift = (gifts || []).find(g => g.id === giftId);
    if (!gift) return;
    const givers = getGiftGivers(gift).map(gv => giverIds.has(gv.id)
      ? { ...gv, thankYouWritten: true, ...(messageId ? { thankYouMessageId: messageId } : {}) }
      : gv);
    changed.push(withGivers(gift, givers));
  });
  return changed;
}

export {
  newGiverId,
  getGiftGivers,
  withGivers,
  newItemId,
  getGiftItems,
  itemAmount,
  sumItemAmounts,
  getGiftTotal,
  summaryGiftType,
  summaryDescription,
  withItems,
  lastNameOf,
  formatGiverNames,
  anyGiverNeedsWritten,
  anyGiverNeedsMailed,
  allGiversComplete,
  countThankYousOutstanding,
  giverEmailState,
  buildThankYouBatch,
  applyThankYouSent,
};
