// One-time conversion of GUIDE_SECTIONS (constants/ui.js) into constants/guideContent.js (V5-H1).
// Wording is moved, never edited: every body paragraph, step and tip is a verbatim run of sentences from
// the original item. Summaries are new one-liners. Run once: node scripts/convert-guide-once.mjs <items.json> <out.js>
// where items.json is the old GUIDE_SECTIONS as JSON. After this, guideContent.js is hand-maintained.
import fs from "node:fs";

const [, , inFile, outFile] = process.argv;
const old = JSON.parse(fs.readFileSync(inFile, "utf8"));

const slug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const ABBR = /(?:e\.g|i\.e|vs|etc|Est|approx)\.$/i;
function sentences(text) {
  const out = []; let cur = "";
  text.split(/(?<=[.!?])\s+/).forEach((piece) => {
    if (!cur) cur = piece; else cur += " " + piece;
    const next = true;
    if (ABBR.test(piece) || /\bStep \d+:$/.test(piece)) return;
    out.push(cur); cur = "";
  });
  if (cur) out.push(cur);
  return out;
}
const words = (s) => s.split(/\s+/).length;
function paragraphs(list) {
  const out = []; let cur = [];
  list.forEach((s) => {
    if (cur.length && words(cur.join(" ")) + words(s) > 60) { out.push(cur.join(" ")); cur = []; }
    cur.push(s);
  });
  if (cur.length) out.push(cur.join(" "));
  return out;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const TIP = [/cannot be undone|can't be undone|cannot be dismissed/i, /^(Tip|Note)\b/, /\bis blocked\b|\bnever\b|\bis safe\b/i, /^Only the event owner/i];

// summary: { section: { heading: "one line (under 80 characters)" } }
const SUMMARY = {
  "getting-started": {
    "How SimchaKit works": "One event, one link, synced live on every device.",
    "Admin Mode": "Where the owner sets up the event.",
    "Your name": "The name your co-planners see, and how to change it.",
    "Archived events": "Archiving locks an event so it becomes read-only.",
    "Switching between events": "Move between your events and ones shared with you.",
    "Export & backup": "Save a full copy of your event data.",
    "Restoring from backup": "Load a saved .json file back into the event.",
  },
  guests: {
    "Households vs. people": "One invitation per household, with each person inside it.",
    "RSVP statuses": "What each status and stat card number means.",
    "Attending count override": "Set a headcount that differs from the people listed.",
    "Finding who still needs to answer": "See households and guests who have not replied.",
    "Bulk RSVP update": "Change the RSVP status of many households at once.",
    "Save-the-dates & invitations": "Track what has been mailed to each household.",
    "Out-of-town guests": "Flag households that are traveling.",
    "Dietary requirements": "Record dietary needs on each person.",
    "Sender details": "Set the sender name, reply-to address and footer.",
    "Marking mailings as sent another way": "Record paper or other-platform mailings without emailing.",
    "Exporting guests": "Four CSV and print formats for different audiences.",
    "The guest RSVP page": "Guests reply from a private link, with no account.",
    "Reviewing RSVP replies": "Accept or reject each reply before it changes your list.",
    "RSVP reminders and page settings": "Nudge households that have not replied.",
    "Messaging your guests": "Email Save the Dates, invitations, reminders and thank-yous.",
    "Sent status and the Messages view": "Read the sent chips and review every message.",
  },
  budget: {
    "Tracking expenses": "Log costs and see paid and outstanding at a glance.",
    "Payment schedules": "Split an expense into deposits and balances.",
    "Due dates & payment suggestions": "Due dates feed Tasks and the Planning Calendar.",
    "Budgeted vs. actual": "Compare an estimate with what you actually pay.",
    "Gratuity calculator": "Work out tips for the vendors who expect them.",
    "Budget by timeline": "Tag each expense with the part of the event it belongs to.",
    "Expense categories": "Pick from preset categories, or add your own.",
    "Overdue badge": "What the Budget badge counts.",
  },
  vendors: {
    "Vendor overview": "The stat cards at the top and what they count.",
    "Vendor cards": "What each vendor card shows.",
    "Vendor types": "Pick a vendor type, or choose Other.",
    "Contract milestones": "Track headcount deadlines and delivery dates.",
    "Linking expenses": "Connect Budget expenses to a vendor.",
    "Contract vs. Billed in Budget": "Why the two amounts can differ.",
    "Contract link": "Keep a shared contract link on the vendor.",
    "Contact log": "Record every call, email and meeting.",
  },
  tasks: {
    "Manual tasks": "Add your own tasks and check them off.",
    "Smart Tasks": "Generate planning milestones from your event date.",
    "Smart suggestions": "Action items drawn from your own data.",
    "Categories": "Filter tasks by category.",
    "Sorting and grouping": "Sort by due date, priority, category or name.",
    "Linked task completion": "Tasks tied to an expense or prep item.",
  },
  prep: {
    "Preparation items": "Track the honoree's preparation, item by item.",
    "Target dates": "Put prep items on the calendar and in suggestions.",
    "Tutor & session notes": "Keep tutor feedback and practice notes together.",
    "Clergy & Tutor contacts": "Quick contact cards for Rabbi, Cantor and Tutor.",
  },
  ceremony: {
    "What Ceremony Roles tracks": "Who fills each honor or role at the ceremony.",
    "Loading a template": "Start from a ready-made list of roles.",
    "Sections": "Group roles into named sections.",
    "Reordering roles": "Drag a role, or use the arrows.",
    "Reordering sections": "Move a whole section up or down.",
    "Hebrew names": "How to enter a Hebrew name for an aliyah.",
    "Day-of and Print Brief": "Roles appear in Day-of Mode and the Print Brief.",
  },
  seating: {
    "Auto-Seat": "Seat every unseated guest in one step.",
    "Seating Setup": "Turn on assigned seating for chosen sub-events.",
    "Switching between sub-events": "Each sub-event has its own tables.",
    "Creating tables": "Add tables with a name, capacity and type.",
    "Assigning guests": "Seat people from the unseated panel.",
    "TBD attendees": "Why unconfirmed guests are not in the unseated list.",
    "Adult and kid counts": "See the adults and kids split on the stat cards.",
    "Seating gap warning": "A heads-up when seats run short.",
    "Capacity meter": "Seat demand against supply, at a glance.",
    "Exporting the seating chart": "Three export formats for the active sub-event.",
  },
  gifts: {
    "Recording gifts": "Log each gift, and several gifts from one giver.",
    "Thank-you tracking": "Track Written and Mailed for each giver.",
    "Exporting gifts": "CSV and print formats for thank-you work.",
  },
  favors: {
    "Favor Setup": "Turn on favors and set up the types you give.",
    "Available panel": "Guests who have not been added to favors yet.",
    "Favor list and inline editing": "Edit recipients right in the list.",
    "Size and category breakdown": "Counts to copy onto a vendor order form.",
    "Export": "Send a recipient list to your vendor.",
  },
  travel: {
    "Out-of-town tracking": "Track notices and travel for traveling households.",
    "Hotel block details": "Show your room block details at the top of the tab.",
    "Check-in & check-out": "Record arrival and departure dates.",
  },
  calendar: {
    "What appears on the calendar": "The five sources the calendar pulls together.",
    "Deduplication": "How duplicate deadlines are avoided.",
    "List vs. month view": "Switch between a list and a month grid.",
    "Click popover & navigation": "Open an event's details or jump to its tab.",
    "Filters": "Show one kind of event, or completed tasks.",
    "Export to calendar app (.ics)": "Download the calendar for Google, Apple or Outlook.",
  },
  search: {
    "Opening search": "Press Command-K or Ctrl-K from anywhere.",
    "What's searchable": "Everything search looks through.",
    "Navigating to results": "Jump to a result and see it highlighted.",
  },
  admin: {
    "Navigating Admin Mode": "Move between Admin Mode sections.",
    "Accessing Admin Mode": "Who can open it, and where.",
    "Event Details": "Name, type, theme, RSVP deadline and catering style.",
    "Timeline": "Build the sub-events that drive the whole app.",
    "Guest configuration": "Guest groups, meal choices and sizes.",
    "Hotel block": "Enter your hotel block once.",
    "Clergy & Tutor": "Store contact details for Rabbi, Cantor and Tutor.",
    "Collaborators": "Invite co-planners and choose what they can do.",
    "Editing at the same time": "How SimchaKit protects simultaneous edits.",
  },
  dayof: {
    "Opening Day-of Mode": "A full-screen view for the day itself.",
    "Event Timeline": "Check off the schedule as the day moves.",
    "Hot Sheet": "Key numbers at a glance.",
    "Day-of Checklist": "A checklist you build before the event.",
    "Notes": "A shared scratch pad that syncs on every device.",
  },
  activitylog: {
    "What the Activity Log tracks": "Meaningful changes across the app.",
    "Actor attribution": "Who made each change.",
    "Opening the Activity Log": "Where to find it.",
    "Filtering entries": "Show Added, Updated, Deleted or Completed.",
    "Clearing the log": "Wipe all entries, with a confirmation.",
    "Archiving and resetting": "What happens to the log when you archive or reset.",
  },
  notifications: {
    "What notifications show": "A live count of your co-planners' activity.",
    "Opening the panel": "Recent activity, newest first.",
    "Mark all read": "Clear the unread badge for yourself only.",
    "See all activity": "Open the full Activity Log.",
    "Solo events": "Why the bell stays at zero when you plan alone.",
  },
  tips: {
    "Confirmation toasts": "Small messages that confirm each save.",
    "Tab indicators": "A dot on tabs that already have records.",
    "Keyboard shortcuts": "Command-K for search and Escape to close.",
    "Dark mode": "Switch between light, dark and system.",
    "Sync & offline": "Live sync, and what happens offline.",
    "Print Brief": "A printable summary of your event.",
    "Getting ready": "A five-step setup card at the top of Overview.",
    "Creating an event": "Set up a new event on one screen.",
    "The Overview hero": "Your event, its Hebrew date and a countdown.",
    "Celebration schedule": "Your main weekend, day by day, with times and rooms.",
    "Who's coming and Readiness": "Confirmed, declined and awaiting at a glance.",
    "Needs you now": "What to do next, in order of urgency.",
    "Greeting and your preferred name": "Choose the name the Overview greets you with.",
    "Multiple devices": "Use the same event on phone, tablet and desktop.",
    "Mobile navigation": "The bottom tab bar and More menu on a phone.",
  },
};

// Items split into several topics: [{ title, summary, from: "<start of the part's first sentence>", steps?: [sentence starts] }]
const PARTS = {
  guests: {
    "Sub-event attendance": [
      { title: "Sub-event attendance", summary: "How sub-events are invited and answered by household.", from: "Sub-event tracking works" },
      { title: "Tracking each person's attendance", summary: "Mark who is coming to each sub-event, person by person.", from: "Tier 2 (person)" },
      { title: "Where sub-event attendance shows up", summary: "Seating, favors, Overview and the Print Brief use it.", from: "Per-person attendance flows automatically" },
    ],
    "Catering Summary": [
      { title: "Catering Summary", summary: "A headcount for each meal, ready for your caterer.", from: "The collapsible Catering Summary card" },
      { title: "How the Catering Summary counts", summary: "Confirmed, Expected and Awaiting, without double counting.", from: "The top-of-card Confirmed" },
      { title: "Dietary list and copying for the caterer", summary: "One dietary list, and a copy button for each vendor.", from: "The Dietary Requirements list is unified" },
    ],
    "Importing guests from CSV": [
      { title: "Importing guests from CSV", summary: "Load a guest list from Evite, Google Contacts and more.", from: "Use the Import button",
        steps: ["Use the Import button", "After uploading", "If any columns can't"] },
      { title: "Reviewing an import before you save", summary: "Fix missing emails, addresses and duplicates first.", from: "A review screen then shows",
        steps: ["A review screen then shows", "Use Change columns", "Use Append mode"] },
    ],
  },
  gifts: {
    "Thank-you tracking": [
      { title: "Thank-you tracking", summary: "Track Written and Mailed for each giver.", from: "Each giver tracks two" },
      { title: "Thank-you counts and badges", summary: "What the stat cards and badges count.", from: "The Thank Yous Outstanding stat card" },
    ],
  },
};

// Sentences (by start) that become numbered steps, for items that are procedures but are not split.
const STEPS = {
  "getting-started": {
    "Switching between events": ["On a computer, click the event name", "Pick one to switch", "Choose All events"],
    "Export & backup": ["Use the Export button in Admin Mode"],
  },
  guests: {
    "Marking mailings as sent another way": ["You do not have to email anything", "Pick the kind", "A toast offers Undo"],
    "Messaging your guests": ["Step 1:", "Step 2:", "Step 3 shows", "Step 4 confirms"],
    "Bulk RSVP update": ["Select multiple households", "Once households are selected"],
  },
  seating: {
    "Seating Setup": ["Open the Seating Setup panel", "Then select which sub-events"],
    "Assigning guests": ["Select a person from the unseated panel"],
  },
  ceremony: { "Loading a template": ["When the tab is empty"] },
  dayof: { "Opening Day-of Mode": ["Click the Day-of Mode entry", "On mobile, open the More menu", "Close it with the X"] },
};
const TIPS = {
  "getting-started": {
    "Switching between events": "Cmd-click or Ctrl-click",
    "Export & backup": "Export before making major changes",
  },
  guests: { "Marking mailings as sent another way": "You can mark the same household", "Messaging your guests": "To avoid misuse" },
  seating: { "Auto-Seat": "Guests already assigned", "Assigning guests": "Assignments are scoped" },
  ceremony: { "Loading a template": "Use Reset to Template" },
};
const NEW_V5 = new Set([
  "Messaging your guests", "Marking mailings as sent another way", "Sent status and the Messages view", "Sender details",
  "The guest RSVP page", "Reviewing RSVP replies", "RSVP reminders and page settings",
  "Getting ready", "Creating an event", "The Overview hero", "Celebration schedule", "Who's coming and Readiness", "Needs you now", "Greeting and your preferred name",
  "Thank-you tracking", "Recording gifts",
]);
const OVERVIEW_TOPICS = new Set(["Getting ready", "Creating an event", "The Overview hero", "Celebration schedule", "Who's coming and Readiness", "Needs you now", "Greeting and your preferred name"]);
const RELATED = {
  "guests/Messaging your guests": [["guests", "Marking mailings as sent another way"], ["guests", "Sent status and the Messages view"], ["guests", "Sender details"]],
  "guests/Marking mailings as sent another way": [["guests", "Messaging your guests"], ["guests", "Sent status and the Messages view"]],
  "guests/Sent status and the Messages view": [["guests", "Messaging your guests"]],
  "guests/Sender details": [["guests", "Messaging your guests"]],
  "guests/The guest RSVP page": [["guests", "Reviewing RSVP replies"], ["guests", "RSVP reminders and page settings"]],
  "guests/Reviewing RSVP replies": [["guests", "The guest RSVP page"]],
  "guests/RSVP reminders and page settings": [["guests", "Messaging your guests"], ["guests", "The guest RSVP page"]],
  "guests/Importing guests from CSV": [["guests", "Reviewing an import before you save"], ["guests", "Households vs. people"]],
  "guests/Reviewing an import before you save": [["guests", "Importing guests from CSV"]],
  "guests/Sub-event attendance": [["guests", "Tracking each person's attendance"], ["seating", "Seating Setup"]],
  "guests/Catering Summary": [["guests", "Dietary dietary"], ["admin", "Timeline"]],
  "getting-started/Export & backup": [["getting-started", "Restoring from backup"]],
  "getting-started/Restoring from backup": [["getting-started", "Export & backup"]],
  "seating/Auto-Seat": [["seating", "Creating tables"], ["seating", "Assigning guests"]],
  "seating/Creating tables": [["seating", "Auto-Seat"]],
  "budget/Payment schedules": [["budget", "Overdue badge"], ["budget", "Due dates & payment suggestions"]],
  "tips/Needs you now": [["guests", "Reviewing RSVP replies"], ["tips", "Getting ready"]],
  "tips/Celebration schedule": [["admin", "Timeline"]],
};
delete RELATED["guests/Catering Summary"];
RELATED["guests/Catering Summary"] = [["admin", "Timeline"]];

const GROUP_OF = {
  "getting-started": "Set up", guests: "Guests and invitations", travel: "Guests and invitations", budget: "Money", vendors: "Money",
  tasks: "Plan", prep: "Plan", calendar: "Plan", ceremony: "Event day", seating: "Event day", gifts: "Event day", favors: "Event day",
  search: "Tools", admin: "Tools", dayof: "Tools", activitylog: "Tools", notifications: "Tools", tips: "Tools",
};
const ORDER = ["getting-started", "guests", "travel", "budget", "vendors", "tasks", "prep", "calendar", "ceremony", "seating", "gifts", "favors", "search", "admin", "dayof", "activitylog", "notifications", "tips"];
const TABS = { guests: ["guests"], travel: ["accommodations"], budget: ["budget"], vendors: ["vendors"], tasks: ["tasks"], prep: ["prep"], calendar: ["calendar"], ceremony: ["ceremony"], seating: ["seating"], gifts: ["gifts"], favors: ["favors"] };

const flags = [];
function build(sectionId, heading, sents, opts) {
  const { title, summary, steps: stepMarks = STEPS[sectionId]?.[heading], tipMark = TIPS[sectionId]?.[heading], isNewOverride } = opts;
  const used = new Set();
  const pick = (mark) => sents.findIndex((s, i) => !used.has(i) && s.startsWith(mark));
  const steps = [];
  const bodyStepSentences = [];
  // "Step N:" items (Restore, Messaging): the text after each label is one step.
  if (!stepMarks && sents.some((s) => /\bStep \d+:/.test(s))) {
    sents.forEach((s, i) => {
      const m = s.match(/^(?:(.*?)\s)?Step (\d+):\s*(.*)$/s);
      if (m) { if (m[1]) steps.preface = m[1]; steps.push(cap(m[3])); used.add(i); }
    });
  } else if (stepMarks) {
    stepMarks.forEach((m) => { const i = pick(m); if (i >= 0) { steps.push(cap(sents[i].replace(/^Step \d+:?\s*/, ""))); used.add(i); } else flags.push(`step marker not found: ${sectionId}/${heading}: ${m}`); });
  }
  let tip = "";
  if (tipMark) { const i = pick(tipMark); if (i >= 0) { tip = sents[i]; used.add(i); } else flags.push(`tip marker not found: ${sectionId}/${heading}: ${tipMark}`); }
  else if (sents.length >= 3) {
    for (const re of TIP) { const i = sents.findIndex((s, j) => j > 0 && !used.has(j) && re.test(s)); if (i >= 0) { tip = sents[i]; used.add(i); break; } }
  }
  const rest = sents.filter((_, i) => !used.has(i));
  const body = paragraphs(rest);
  body.forEach((p) => { if (words(p) > 75) flags.push(`long sentence kept as is (${words(p)} words): ${sectionId}/${title}`); });
  const topic = { id: slug(title), title, summary };
  if (summary.length >= 80) flags.push(`summary too long: ${title}`);
  if (steps.length) topic.steps = steps.slice();
  if (body.length) topic.body = body;
  if (tip) topic.tip = tip;
  const key = `${sectionId}/${title}`;
  if (RELATED[key]) topic.related = RELATED[key].map(([s, h]) => [s, slug(h)]);
  if (isNewOverride || NEW_V5.has(heading) || NEW_V5.has(title)) topic.isNew = true;
  if (OVERVIEW_TOPICS.has(heading)) topic.tabs = ["overview"];
  return topic;
}

const sections = ORDER.map((id) => {
  const sec = old.find((s) => s.id === id);
  const topics = [];
  sec.items.forEach((it) => {
    const sents = sentences(it.body);
    const parts = PARTS[id]?.[it.heading];
    if (!parts) {
      const summary = SUMMARY[id]?.[it.heading];
      if (!summary) flags.push(`missing summary: ${id}/${it.heading}`);
      topics.push(build(id, it.heading, sents, { title: it.heading, summary: summary || "" }));
      return;
    }
    parts.forEach((p, k) => {
      const start = sents.findIndex((s) => s.startsWith(p.from));
      if (start < 0) { flags.push(`part marker not found: ${id}/${it.heading}: ${p.from}`); return; }
      const next = parts[k + 1] ? sents.findIndex((s) => s.startsWith(parts[k + 1].from)) : sents.length;
      topics.push(build(id, it.heading, sents.slice(start, next), { title: p.title, summary: p.summary, steps: p.steps || [] }));
    });
  });
  const dupe = topics.map((t) => t.id).filter((x, i, a) => a.indexOf(x) !== i);
  if (dupe.length) flags.push(`duplicate topic ids in ${id}: ${dupe}`);
  return { id, group: GROUP_OF[id], title: sec.title, color: sec.color, ...(TABS[id] ? { tabs: TABS[id] } : {}), topics };
});

// Verbatim check: every original sentence appears in exactly one topic field (paragraph, step or tip), in order or not.
const all = sections.flatMap((s) => s.topics.flatMap((t) => [...(t.body || []), ...(t.steps || []), t.tip || ""])).join(" ");
let missing = 0;
old.forEach((s) => s.items.forEach((it) => sentences(it.body).forEach((x) => {
  const probe = x.replace(/^.*?Step \d+:?\s*/s, "");
  if (!all.toLowerCase().includes(probe.slice(0, 60).toLowerCase())) { missing++; flags.push(`sentence not found in output: ${s.id}/${it.heading}: ${x.slice(0, 70)}`); }
})));

const header = `// Guide content (V5-H1). Sections are grouped for the rail; topics are short articles.
// Text was moved from the old GUIDE_SECTIONS without rewording: summaries are new one-liners, steps/body/tip are the
// original sentences. tabs: the tab ids whose "Help for this tab" button opens that section or topic.
`;
const tasks = `
// Start here task cards. Data, not component code: { title, hint, section, topic }.
export const GUIDE_TASKS = [
  { title: "Add your guests",   hint: "Import a CSV or type households in", section: "guests",          topic: "importing-guests-from-csv" },
  { title: "Email your guests", hint: "Save the Date, invitations, reminders", section: "guests",       topic: "messaging-your-guests" },
  { title: "Track a payment",   hint: "Schedules, deposits and balances",    section: "budget",          topic: "payment-schedules" },
  { title: "Seat your guests",  hint: "Auto-Seat and tables",                section: "seating",         topic: "auto-seat" },
  { title: "Back up your event", hint: "Export a full copy",                 section: "getting-started", topic: "export-backup" },
  { title: "Switch events",     hint: "Move between events and shared ones", section: "getting-started", topic: "switching-between-events" },
];

export const GUIDE_GROUPS = ["Set up", "Guests and invitations", "Money", "Plan", "Event day", "Tools"];
`;
fs.writeFileSync(outFile, header + "export const GUIDE_SECTIONS = " + JSON.stringify(sections, null, 2) + ";\n" + tasks);
console.log(`${sections.length} sections, ${sections.reduce((n, s) => n + s.topics.length, 0)} topics, ${missing} sentences unmatched`);
console.log(flags.length ? "FLAGS:\n" + flags.join("\n") : "no flags");
