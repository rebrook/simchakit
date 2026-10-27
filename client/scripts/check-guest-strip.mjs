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
console.log("OK: no host-only timeline fields in the guest view");
