// Guide model: lookups, search, deep-link hash and the content check. Pure JS (no React) so
// scripts/check-guide.mjs can import it in Node.
import { GUIDE_SECTIONS, GUIDE_GROUPS, GUIDE_TASKS } from "@/constants/guideContent.js";

export const getSection = (id) => GUIDE_SECTIONS.find(s => s.id === id) || null;
export const getTopic = (sectionId, topicId) => getSection(sectionId)?.topics.find(t => t.id === topicId) || null;
export const sectionsInGroup = (group) => GUIDE_SECTIONS.filter(s => s.group === group);
export const newTopics = () => GUIDE_SECTIONS.flatMap(s => s.topics.filter(t => t.isNew).map(t => ({ section: s, topic: t })));

// The section (and, for a mixed section such as Tips, no topic) that a tab's help button opens.
export function guideForTab(tabId) {
  const s = GUIDE_SECTIONS.find(x => x.tabs?.includes(tabId)) || GUIDE_SECTIONS.find(x => x.topics.some(t => t.tabs?.includes(tabId)));
  return s ? { sectionId: s.id, fromTab: true } : null;
}

// ── Search ───────────────────────────────────────────────────────────────────
const fields = (t) => [t.title, t.summary, ...(t.steps || []), ...(t.body || []), t.tip || ""];
export function searchGuide(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out = [];
  GUIDE_SECTIONS.forEach(section => section.topics.forEach(topic => {
    const hit = fields(topic).findIndex(f => f.toLowerCase().includes(q));
    if (hit < 0) return;
    // title first, then summary matches, then body-only matches
    out.push({ section, topic, rank: hit === 0 ? 0 : hit === 1 ? 1 : 2, field: hit });
  }));
  return out.sort((a, b) => a.rank - b.rank);
}

// A short excerpt around the first match, for topics that match only in their steps, body or tip.
export function snippet(topic, query) {
  const q = query.trim().toLowerCase();
  const text = fields(topic).slice(2).find(f => f.toLowerCase().includes(q));
  if (!text) return "";
  const i = text.toLowerCase().indexOf(q);
  const from = Math.max(0, i - 40);
  return (from > 0 ? "…" : "") + text.slice(from, i + q.length + 60) + (i + q.length + 60 < text.length ? "…" : "");
}

// Splits text into plain and matching runs, for <mark>.
export function highlightRuns(text, query) {
  const q = query.trim();
  if (!q) return [{ text, hit: false }];
  const lower = text.toLowerCase(), needle = q.toLowerCase(), runs = [];
  let at = 0, i;
  while ((i = lower.indexOf(needle, at)) >= 0) {
    if (i > at) runs.push({ text: text.slice(at, i), hit: false });
    runs.push({ text: text.slice(i, i + needle.length), hit: true });
    at = i + needle.length;
  }
  if (at < text.length) runs.push({ text: text.slice(at), hit: false });
  return runs;
}

// ── Deep links: #/guide, #/guide/<section>, #/guide/<section>/<topic> ─────────
export function parseGuideHash(hash) {
  const m = String(hash || "").match(/^#\/guide(?:\/([^/]+))?(?:\/([^/]+))?\/?$/);
  if (!m) return null;
  const sectionId = m[1] && getSection(m[1]) ? m[1] : null;
  const topicId = sectionId && m[2] && getTopic(sectionId, m[2]) ? m[2] : null;
  return { sectionId, topicId };
}
export const guideHash = (sectionId, topicId) => `#/guide${sectionId ? "/" + sectionId : ""}${sectionId && topicId ? "/" + topicId : ""}`;

// ── Content check: runs on import in development, and in scripts/check-guide.mjs ──
export function checkGuideContent() {
  const bad = [];
  GUIDE_SECTIONS.forEach(s => {
    if (!GUIDE_GROUPS.includes(s.group)) bad.push(`${s.id}: unknown group ${s.group}`);
    if (!s.topics.length) bad.push(`${s.id}: no topics`);
    const titles = new Set(), ids = new Set();
    s.topics.forEach(t => {
      if (!t.summary) bad.push(`${s.id}/${t.id}: no summary`);
      if (t.summary && t.summary.length >= 80) bad.push(`${s.id}/${t.id}: summary is 80 characters or more`);
      if (titles.has(t.title)) bad.push(`${s.id}: duplicate topic title "${t.title}"`);
      if (ids.has(t.id)) bad.push(`${s.id}: duplicate topic id "${t.id}"`);
      titles.add(t.title); ids.add(t.id);
      (t.related || []).forEach(([rs, rt]) => { if (!getTopic(rs, rt)) bad.push(`${s.id}/${t.id}: related target ${rs}/${rt} does not exist`); });
    });
  });
  GUIDE_TASKS.forEach(k => { if (!getTopic(k.section, k.topic)) bad.push(`task card "${k.title}": ${k.section}/${k.topic} does not exist`); });
  ["seat", "import", "RSVP"].forEach(w => { if (!searchGuide(w).length) bad.push(`search finds nothing for "${w}"`); });
  return bad;
}

if (import.meta.env?.DEV) {
  const problems = checkGuideContent();
  if (problems.length) console.error("[Guide] content problems:\n  " + problems.join("\n  "));
}
