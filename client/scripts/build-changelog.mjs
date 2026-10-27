// Builds the host-facing release notes from client/changelog/entries.json.
//   public/whats-new/index.json    latest release id, up to three highlights per month for the last
//                                  three months, and the list of months with counts
//   public/whats-new/YYYY-MM.json  every host entry for that month
// Only audience "host" entries are written. Fails (exit 1) on a host entry that breaks the writing
// rules in changelog/README.md. Run: node scripts/build-changelog.mjs (also runs from vite.config.v3.js).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

export const KINDS = ["new", "improved", "fixed"];
export const AREAS = ["Overview", "Guests", "Messaging", "Budget", "Tasks", "Gifts", "Seating", "Admin", "Setup", "Exports", "All tabs"];
export const TABS = ["overview", "guests", "budget", "vendors", "tasks", "prep", "ceremony", "seating", "gifts", "accommodations", "favors", "calendar"];
const ID_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/;
const BANNED = [
  [/\bv?\d+\.\d+(\.\d+)?\b/i, "a version number"],
  [/\b[a-z]+_[a-z0-9_]+\b/, "a table or column name"],
  [/\bmigrations?\b/i, "\"migration\""],
  [/\bRLS\b/, "\"RLS\""],
  [/\bendpoints?\b/i, "\"endpoint\""],
  [/\bAPI\b/i, "\"API\""],
];

// Returns a list of problems for one entry (empty when it is fine).
export function checkEntry(e) {
  const bad = [];
  if (!e.title || !String(e.title).trim()) bad.push("host entry has no title");
  if (e.highlight && !(e.body && String(e.body).trim())) bad.push("highlight has no body");
  if (e.audience !== "host") return bad;
  for (const field of ["title", "body"]) {
    for (const [re, label] of BANNED) if (e[field] && re.test(e[field])) bad.push(`${field} contains ${label}`);
  }
  if (e.title && e.title.length > 160) bad.push("title is longer than 160 characters");
  return bad;
}

export function buildChangelog({ write = true } = {}) {
  const src = path.join(root, "changelog/entries.json");
  const all = JSON.parse(fs.readFileSync(src, "utf8"));
  const errors = [];
  const seen = new Set();

  all.forEach((e, i) => {
    const at = `entries.json[${i}] (${e.id || "no id"})`;
    const fail = (m) => errors.push(`${at}: ${m}`);
    if (!ID_RE.test(e.id || "")) fail("id must look like YYYY-MM-DD-slug");
    else if (seen.has(e.id)) fail("duplicate id");
    seen.add(e.id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date || "") || !String(e.id).startsWith(e.date)) fail("date must be YYYY-MM-DD and match the id");
    if (!KINDS.includes(e.kind)) fail(`kind must be one of ${KINDS.join(", ")}`);
    if (!AREAS.includes(e.area)) fail(`area must be one of ${AREAS.join(", ")}`);
    if (e.audience !== "host" && e.audience !== "dev") fail('audience must be "host" or "dev"');
    if (e.show && !TABS.includes(e.show.tab)) fail(`show.tab must be one of ${TABS.join(", ")}`);
    checkEntry(e).forEach(fail);
  });

  const host = all.filter(e => e.audience === "host").sort((a, b) => (a.id < b.id ? 1 : -1));
  const byMonth = new Map();
  host.forEach(e => { const m = e.date.slice(0, 7); if (!byMonth.has(m)) byMonth.set(m, []); byMonth.get(m).push(e); });
  for (const [m, list] of byMonth) {
    if (list.filter(e => e.highlight).length > 3) errors.push(`${m}: more than three highlights in one month`);
  }
  if (errors.length) { const err = new Error("Release notes failed validation:\n  " + errors.join("\n  ")); err.errors = errors; throw err; }

  const strip = ({ audience, ...rest }) => rest;
  const months = [...byMonth.keys()];
  const index = {
    latestRelease: host[0] ? host[0].id : null,
    latestDate: host[0] ? host[0].date : null,
    highlights: months.slice(0, 3).flatMap(m => byMonth.get(m).filter(e => e.highlight).slice(0, 3).map(strip)),
    months: months.map(m => ({ month: m, count: byMonth.get(m).length })),
    areas: host.reduce((acc, e) => { acc[e.area] = (acc[e.area] || 0) + 1; return acc; }, {}),
  };
  if (write) {
    const out = path.join(root, "public/whats-new");
    fs.rmSync(out, { recursive: true, force: true });
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, "index.json"), JSON.stringify(index));
    for (const [m, list] of byMonth) fs.writeFileSync(path.join(out, `${m}.json`), JSON.stringify({ month: m, entries: list.map(strip) }));
  }
  return { index, hostCount: host.length, months: months.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const r = buildChangelog();
    console.log(`whats-new: ${r.hostCount} host entries in ${r.months} months, latest ${r.index.latestRelease}`);
  } catch (err) { console.error(err.message); process.exit(1); }
}
