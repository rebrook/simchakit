// Guards the rule that a guest never sees host-only timeline fields. Builds the guest-facing view
// from an event whose timeline carries audience, arriveBy, room and address, and fails if any of
// them (or their values) appears in the response. Run: node scripts/check-guest-strip.mjs
import { buildView, HOST_ONLY_TIMELINE_FIELDS } from "../api/_lib/rsvp-shared.js";

const SECRET = ["family", "07:45", "Green Room", "99 Private Lane"];
const event = {
  id: "e1", name: "Test", archived: false,
  admin_config: {
    rsvpDeadline: "2030-01-01",
    timeline: [
      { id: "t1", title: "Photos", startDate: "2030-02-01", startTime: "08:30", venue: "Temple", room: SECRET[2], address: SECRET[3], audience: "family", arriveBy: SECRET[1], isMainEvent: true },
      { id: "t2", title: "Service", startDate: "2030-02-01", startTime: "09:30", venue: "Temple", room: SECRET[2], address: SECRET[3], arriveBy: SECRET[1] },
    ],
  },
};
const household = { id: "h1", formalName: "The Cohens", rsvpStatus: "Invited" };
const view = buildView({ event, household, people: [], pending: null, settings: {} });
// The household's own mailing "address" legitimately appears in the view, so field names are checked
// on the timeline-derived parts only (the event and its sub-events); the secret values are checked
// across the whole response.
const timelineParts = JSON.stringify({ event: view.event, sections: view.sections });
const json = JSON.stringify(view);
let bad = HOST_ONLY_TIMELINE_FIELDS.filter(k => timelineParts.includes(`"${k}"`));
bad = bad.concat(SECRET.slice(1).filter(v => json.includes(v)));
if (bad.length) { console.error("Host-only data reached the guest view:", bad); process.exit(1); }

// V5-G1: the guest event page. A household invited only to the reception sees only the reception,
// shared lodging only, with the host-written guest fields and a derived directions link.
const g = {
  id: "e2", name: "Test", archived: false,
  admin_config: {
    guestWelcomeNote: "Welcome!",
    hotelBlocks: [
      { id: "h1", name: "Shared Inn", groupCode: "COHEN", phone: "(555) 123-4567", website: "https://inn.example", shareWithGuests: true, internalNote: "HOST-ONLY-NOTE" },
      { id: "h2", name: "Private Inn", shareWithGuests: false },
      { id: "h3", name: "Unflagged Inn" },
    ],
    timeline: [
      { id: "t1", title: "Service", startDate: "2030-02-01", startTime: "09:30", venue: "Temple", guestAddress: "1 Temple Rd", inviteAllByDefault: false, isMainEvent: true },
      { id: "t2", title: "Reception", startDate: "2030-02-01", startTime: "18:00", venue: "Hall", guestAddress: "2 Hall St", dressCode: "Cocktail", parkingNote: "Lot B", mapUrl: "javascript:alert(1)", address: "99 Private Lane", inviteAllByDefault: false },
    ],
  },
};
const rec = buildView({ event: g, household: { id: "h1", formalName: "Cohens", invitedSections: ["t2"] }, people: [], pending: null, settings: {} });
const info = JSON.stringify(rec.info);
const problems = [];
if (rec.info?.schedule?.length !== 1 || rec.info.schedule[0].id !== "t2") problems.push("info lists a sub-event the household is not invited to");
if (/Service|Temple|1 Temple Rd/.test(info)) problems.push("info leaks the uninvited Service");
if (!/Cocktail/.test(info) || !/Lot B/.test(info) || !/2 Hall St/.test(info)) problems.push("info is missing the guest-facing reception fields");
if (/javascript:/.test(info) || !/google\.com\/maps/.test(info)) problems.push("a non-https map link was not replaced by a safe directions link");
if (/99 Private Lane/.test(info)) problems.push("info leaks the host-only address");
if (rec.info?.lodging?.length !== 1 || /Private Inn|Unflagged|HOST-ONLY-NOTE/.test(info)) problems.push("info lodging is not limited to blocks shared with guests");
const none = buildView({ event: { ...g, admin_config: { timeline: [], hotelBlocks: [] } }, household: { id: "h1" }, people: [], pending: null, settings: {} });
if (none.info !== null) problems.push("info should be null when the host shared nothing");
if (problems.length) { console.error("Guest event page problems:\n  " + problems.join("\n  ")); process.exit(1); }
console.log("OK: no host-only timeline fields in the guest view; guest event page respects invitations");
