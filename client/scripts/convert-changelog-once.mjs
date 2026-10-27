// One-time conversion of the legacy changelog.json into client/changelog/entries.json (host copy)
// and client/changelog/dev.json (everything else). Run once: node scripts/convert-changelog-once.mjs
// After this, entries.json is the single authoring source (see changelog/README.md).
// Releases from V5.0 on are written by hand (CURATED below); older host entries are first sentences of
// the old lines, filtered by the same rules the build enforces, and should get an editorial pass.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkEntry } from "./build-changelog.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const legacy = JSON.parse(fs.readFileSync(path.join(root, "public/changelog.json"), "utf8"));

const MONTHS = { Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6, Jul:7, Aug:8, Sep:9, Oct:10, Nov:11, Dec:12 };
const isoDate = (s) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^([A-Za-z]{3}) (\d{1,2}), (\d{4})$/);
  return m ? `${m[3]}-${String(MONTHS[m[1]]).padStart(2, "0")}-${m[2].padStart(2, "0")}` : s;
};

const newest = legacy.changelog.map(r => isoDate(r.date)).sort().pop();
const cutoff = new Date(new Date(newest + "T00:00:00Z").getTime() - 90 * 864e5).toISOString().slice(0, 10);

const DEV_LINE = /no visible changes|^internal|\bmodule|split into|refactor|migration|\.sql|\bRLS\b|row.level|endpoint|\bapi\/|\btable\b|\bcolumn\b|env(ironment)? var|supabase|no database changes|v3 app only|vercel|\bjsx?\b|\bcss\b|\bhook\b|\bprop\b|\bcomponent\b|root cause|architecture|cleanup|verified|audit|roadmap|guide:|bundle|build\b/i;
// Lines that do not read on their own, or describe plumbing a host would not notice.
const NOT_STANDALONE = /\b(same|this kind|these|also|helper|lint|logged|shared (helper|list)|previously|used to|follows|moved|is removed|no longer built|rendering|accessible name|screen readers|drift|sort order|alphabetiz|parsing|stat cards|nav badge|existing|main action for each tab|each row shows|matching Add button|overview share brief|more than one giver)\b|^(the|a|an) [a-z ]{0,30} (is|are) (now )?(removed|hidden)/i;
const area = (t) => {
  const s = t.toLowerCase();
  const table = [
    ["Seating", /seating|table|seat\b/], ["Gifts", /gift|thank-you/], ["Budget", /budget|expense|invoice|payment|vendor/],
    ["Tasks", /\btask|prep|checklist/], ["Messaging", /email|message|reminder|invitation|mailing/],
    ["Guests", /guest|household|rsvp|dietary|meal/], ["Exports", /export|csv|pdf|print|backup/],
    ["Admin", /admin|settings|co-planner|invite|role/], ["Setup", /setup|getting ready|first run|onboarding/],
    ["Overview", /overview|countdown|dashboard|hero/],
  ];
  return (table.find(([, re]) => re.test(s)) || ["All tabs"])[0];
};

// Written by hand: releases from V5.0 on. Titles start with what the host can now do.
const D = (date, release, n, slug, kind, ar, title, extra = {}) =>
  ({ id: `${date}-${String(n).padStart(2, "0")}-${slug}`, release, date, kind, area: ar, audience: "host", highlight: false, title, ...extra });
const H = (date, release, n, slug, kind, ar, title, body, show, guide) =>
  D(date, release, n, slug, kind, ar, title, { highlight: true, body, show, ...(guide ? { guide } : {}) });

const CURATED = [
  H("2026-10-27", "V5.9.0", 1, "celebration-schedule", "new", "Overview", "See your whole weekend on the Overview",
    "The Overview opens with your countdown, the Hebrew date, and every time and venue for the weekend. Copy the schedule to send to family.",
    { tab: "overview", focus: "celebration-schedule" }, "getting-started/how-simchakit-works"),
  D("2026-10-27", "V5.9.0", 2, "preferred-name", "new", "Overview", "Add a preferred name and greetings say Welcome back, Sam instead of using your account name"),
  D("2026-10-27", "V5.9.0", 3, "family-only-times", "new", "Admin", "Mark a timeline entry family only, or set an arrive-by time, and guests never see either"),
  D("2026-10-27", "V5.8.1", 4, "needs-you-undo", "improved", "Overview", "Needs you now names each invoice or task, and every Mark action has an 8-second Undo"),
  D("2026-10-27", "V5.8.2", 5, "greeting-the", "fixed", "Overview", "The greeting no longer says Welcome back, The"),
  D("2026-10-27", "V5.9.2", 6, "getting-ready-keeps-typing", "fixed", "Setup", "The Getting ready card keeps what you are typing when the page updates"),
  H("2026-10-27", "V5.6.0", 7, "remind-waiting", "new", "Guests", "Remind only the households still waiting",
    "Send a reminder to just the households that have not replied, with each one's private reply link included.",
    { tab: "guests", focus: "send-reminder" }),
  D("2026-10-27", "V5.5.0", 8, "review-replies", "new", "Guests", "Review RSVP replies, accept or reject them, and undo an accept"),
  D("2026-10-27", "V5.7.0", 9, "import-review", "improved", "Guests", "Importing a guest list shows missing emails, missing addresses and possible duplicates before anything is saved"),
  D("2026-10-27", "V5.7.0", 10, "getting-ready-card", "new", "Setup", "A Getting ready card walks you through setup and is saved for everyone on the event"),
  D("2026-10-27", "V5.6.0", 11, "rsvp-page-settings", "new", "Guests", "Choose whether guests can add people or change their reply on the RSVP page"),
  D("2026-10-27", "V5.7.0", 12, "first-event-flow", "improved", "Setup", "Create your first event in one screen, and add your name afterwards"),
  H("2026-10-26", "V5.4.0", 1, "private-reply-link", "new", "Guests", "Guests reply from a private link",
    "Each household gets its own link. No account, no password. Replies wait for your approval before they change your list.",
    { tab: "guests", focus: "rsvp-replies" }),
  D("2026-10-26", "V5.1.0", 2, "message-guests", "new", "Messaging", "Message your guests from SimchaKit, or record what you sent by paper mail or on another platform"),
  D("2026-10-26", "V5.2.0", 3, "emails-event-colors", "improved", "Messaging", "Guest emails use your event's colors and logo"),
  D("2026-10-26", "V5.1.2", 4, "mailing-chips", "improved", "Messaging", "Mailing chips say which mailing they are"),
  D("2026-10-23", "V4.49.0", 1, "top-bar-action", "improved", "All tabs", "The main action for each tab sits in the top bar on desktop"),
  D("2026-10-23", "V4.49.1", 2, "csv-safe", "fixed", "Exports", "CSV exports open safely in Excel and Sheets"),
  D("2026-10-23", "V4.49.3", 3, "tab-top", "fixed", "All tabs", "Switching tabs starts at the top"),
  D("2026-10-18", "V4.33.0", 1, "multi-gift", "new", "Gifts", "Record more than one gift from the same giver in one gift record"),
  D("2026-10-20", "V4.42.0", 2, "thank-you-status", "improved", "Gifts", "Thank-you status is clearer, and the list can be sorted"),
  D("2026-10-19", "V4.40.0", 1, "switch-events", "new", "All tabs", "Switch events from the sidebar without going back to the event picker"),
];

const entries = [...CURATED];
const dev = [];

for (const r of legacy.changelog) {
  const date = isoDate(r.date);
  const isV5 = /^V5\./.test(r.version);
  const lines = [];
  r.changes.forEach((line, i) => {
    const m = line.match(/^(New|Fix(?:ed)?|Change(?:d)?|Improvement|Feature|Bug(?: fix)?)\s*[:—-]\s*(.*)$/i);
    const kind = !m ? null : /^new|feature/i.test(m[1]) ? "new" : /^fix|bug/i.test(m[1]) ? "fixed" : "improved";
    let title = m ? m[2] : "";
    title = title.split(/(?<=[a-z0-9)])\.\s|\s[—–]\s|;\s/)[0].replace(/\.$/, "").trim();
    title = title.charAt(0).toUpperCase() + title.slice(1);
    const candidate = { id: `${date}-a${String(entries.length).padStart(4, "0")}`, release: r.version, date, kind, area: area(title), audience: "host", highlight: false, title };
    const host = !isV5 && date >= cutoff && kind && title.length >= 20 && title.length <= 120 && !DEV_LINE.test(line.slice(0, 220)) && !NOT_STANDALONE.test(title) && title.length >= 30 && checkEntry(candidate).length === 0;
    if (host) entries.push(candidate); else lines.push(line);
  });
  dev.push({ version: r.version, date, summary: r.summary, changes: lines.length ? lines : [], hostCopy: r.changes.length - lines.length });
}

entries.sort((a, b) => (a.id < b.id ? 1 : -1));
const dir = path.join(root, "changelog");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "entries.json"), JSON.stringify(entries, null, 2) + "\n");
fs.writeFileSync(path.join(dir, "dev.json"), JSON.stringify({
  note: "Developer notes. Never shipped in the app. Release history, migrations, RLS, endpoints and refactors live here and in README.md.",
  current: legacy.current, releases: dev, roadmap: legacy.roadmap, knownIssues: legacy.knownIssues, auditItems: legacy.auditItems, versioning: legacy.versioning,
}, null, 2) + "\n");
console.log(`entries.json: ${entries.length} host entries (cutoff ${cutoff}); dev.json: ${dev.length} releases`);
