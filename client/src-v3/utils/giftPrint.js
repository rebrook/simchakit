// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.11.0 — utils/giftPrint.js (V5-X1)
// The printable gift list: one compact table, one row per giver (co-givers get
// their own rows, as in the CSV export), with empty boxes to tick off thank-yous.
//
// Browsers cannot count pages for us ("Page X of Y" needs a counter that Safari
// and Firefox do not support, and the print preview is sandboxed from scripts),
// so the pages are laid out here: every row is measured in a hidden copy of the
// table at the real paper width, packed into pages, and each page is written out
// with its own column header and footer. The result is still one plain HTML
// string, so it prints through window.print() with no PDF library.
//
// Black and white safe: no colour anywhere, every state is a shape or a word.
// ─────────────────────────────────────────────────────────────────────────────

import { formatAddress, migrateCityStateZip } from "./guests.js";
import { getGiftGivers, getGiftItems, getGiftTotal, summaryGiftType, summaryDescription } from "./gifts.js";

export const DEFAULT_GIFT_PRINT_OPTIONS = {
  sort: "surname",            // "surname" | "date" | "type"
  includeAddresses: true,
  groupByType: false,
  onlyUnwritten: false,       // only givers whose thank-you is not yet written
  showAttendance: false,
};

// Paper sizes at 96 dpi, with a 0.4in margin all round. Heights are trimmed a
// few pixels so rounding can never push a page over and print a blank sheet.
const PAPER = {
  letter: { css: "letter", w: 739, h: 975 },
  a4:     { css: "A4",     w: 716, h: 1041 },
};
const SAFETY = 6;

// Letter in the US, Canada and Mexico (and when the locale is unknown); A4 elsewhere.
export function detectPaper(locale) {
  const loc = locale || (typeof navigator !== "undefined" ? navigator.language : "") || "";
  const region = (loc.split(/[-_]/)[1] || "").toUpperCase();
  if (!region) return "letter";
  return ["US", "CA", "MX"].includes(region) ? "letter" : "a4";
}

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const money = (n) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function parseYMD(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || "");
  return m ? { y: +m[1], mo: +m[2] - 1, d: +m[3] } : null;
}

// "Mon D" in the event's year, otherwise "Mon D, YYYY".
function formatReceived(dateStr, eventYear) {
  const p = parseYMD(dateStr);
  if (!p) return "";
  const base = `${MONTHS[p.mo]} ${p.d}`;
  return p.y === eventYear ? base : `${base}, ${p.y}`;
}

const surnameOf = (name) => (name || "").trim().split(/\s+/).pop() || "";
const firstNamesOf = (name) => (name || "").trim().split(/\s+/).slice(0, -1).join(" ");
const cmp = (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" });
const byName = (a, b) => cmp(surnameOf(a.name), surnameOf(b.name)) || cmp(firstNamesOf(a.name), firstNamesOf(b.name)) || cmp(a.name, b.name);

const SORT_NOTE = {
  surname: "Sorted by surname, then first name",
  date:    "Sorted by date received",
  type:    "Sorted by gift type, then surname",
};

// ── Model ────────────────────────────────────────────────────────────────────
export function buildGiftPrintModel(gifts, households, eventName, eventDate, options = {}) {
  const opt = { ...DEFAULT_GIFT_PRINT_OPTIONS, ...options };
  const hhMap = Object.fromEntries((households || []).map(h => [h.id, h]));
  const addressOf = (giver) => (giver.householdId && hhMap[giver.householdId])
    ? formatAddress(migrateCityStateZip(hhMap[giver.householdId]))
    : formatAddress(giver);
  const eventYear = parseYMD(eventDate)?.y ?? null;

  let allGivers = 0, written = 0, mailed = 0;
  const rows = [];
  (gifts || []).forEach(g => {
    const items = getGiftItems(g);
    const rec = {
      id: g.id,
      type: summaryGiftType(items) || g.giftType || "Gift",
      description: summaryDescription(items) || g.description || "",
      amount: getGiftTotal(g),
      itemCount: items.length,
      moneyCount: items.filter(it => Number.isFinite(parseFloat(it.amount))).length,
    };
    getGiftGivers(g).forEach(gv => {
      allGivers += 1;
      if (gv.thankYouWritten) written += 1;
      if (gv.thankYouMailed) mailed += 1;
      if (opt.onlyUnwritten && gv.thankYouWritten) return;
      rows.push({
        rec,
        name: gv.name || "Unknown",
        address: opt.includeAddresses ? addressOf(gv) : "",
        written: !!gv.thankYouWritten,
        mailed: !!gv.thankYouMailed,
        date: g.dateReceived || "",
        received: formatReceived(g.dateReceived, eventYear),
        attended: g.attended === true ? "Yes" : g.attended === false ? "No" : "",
      });
    });
  });

  const dateCmp = (a, b) => (a.date && b.date) ? cmp(a.date, b.date) : (a.date ? -1 : b.date ? 1 : 0);
  const typeCmp = (a, b) => cmp(a.rec.type, b.rec.type);
  rows.sort((a, b) => {
    if (opt.sort === "date") return dateCmp(a, b) || byName(a, b);
    if (opt.sort === "type") return typeCmp(a, b) || byName(a, b);
    return byName(a, b);
  });
  if (opt.groupByType && opt.sort !== "type") {
    // Stable sort by type keeps the chosen order inside each type.
    rows.sort(typeCmp);
  }

  // Totals count each gift record once, however many givers share it.
  const seen = new Set();
  const byType = new Map();
  let giftCount = 0, moneyCount = 0, total = 0;
  rows.forEach(r => {
    if (seen.has(r.rec.id)) return;
    seen.add(r.rec.id);
    giftCount += r.rec.itemCount;
    moneyCount += r.rec.moneyCount;
    total += r.rec.amount || 0;
    const t = byType.get(r.rec.type) || { type: r.rec.type, gifts: 0, total: 0 };
    t.gifts += r.rec.itemCount;
    t.total += r.rec.amount || 0;
    byType.set(r.rec.type, t);
  });
  const types = [...byType.values()].sort((a, b) => cmp(a.type, b.type));
  const sharedGifts = rows.length > seen.size;

  // Units: the flat list that gets measured and packed into pages.
  const units = [];
  let n = 0;
  if (opt.groupByType) {
    types.forEach(t => {
      units.push({ kind: "band", group: t.type, label: t.type });
      rows.filter(r => r.rec.type === t.type).forEach(r => units.push({ kind: "row", group: t.type, row: r, alt: ++n % 2 === 0 }));
      units.push({ kind: "sub", group: t.type, type: t });
    });
  } else {
    rows.forEach(r => units.push({ kind: "row", row: r, alt: ++n % 2 === 0 }));
  }

  const noteBits = [SORT_NOTE[opt.sort] || SORT_NOTE.surname];
  if (opt.groupByType) noteBits.push("grouped by type");
  if (opt.onlyUnwritten) noteBits.push("only thank-yous not yet written");

  return {
    opt, eventName: eventName || "", eventDate: eventDate || "", units, types,
    stats: { giftCount, moneyCount, total, rowCount: rows.length, allGivers, written, mailed },
    sharedGifts,
    sortNote: noteBits.join(" · "),
    generated: (() => { const d = new Date(); return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; })(),
  };
}

// ── Rendering pieces ─────────────────────────────────────────────────────────
const CHECK = `<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M2 6.5 L5 9.5 L10 2.5" fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="square"/></svg>`;
const box = (on, label) => `<span class="gp-box" role="img" aria-label="${label}${on ? " done" : " not done"}">${on ? CHECK : ""}</span>`;

function longDate(s) {
  const p = parseYMD(s);
  if (!p) return "";
  return new Date(p.y, p.mo, p.d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function colgroup(att) {
  const w = att ? [9, 9, 29, 10, 15, 9, 10, 9] : [9, 9, 33, 11, 16, 10, 12];
  return `<colgroup>${w.map(x => `<col style="width:${x}%">`).join("")}</colgroup>`;
}

function theadHTML(att) {
  return `<thead><tr><th class="gp-c">Written</th><th class="gp-c">Mailed</th><th>From</th><th>Type</th><th>Description</th><th class="gp-r">Amount</th><th>Received</th>${att ? "<th>Attended</th>" : ""}</tr></thead>`;
}

function rowHTML(u, att) {
  const cols = att ? 8 : 7;
  if (u.kind === "band") {
    return `<tr class="gp-band"><td colspan="${cols}">${esc(u.label)}${u.continued ? " (continued)" : ""}</td></tr>`;
  }
  if (u.kind === "sub") {
    return `<tr class="gp-sub"><td colspan="5" class="gp-r">Subtotal, ${esc(u.type.type)} (${u.type.gifts} gift${u.type.gifts !== 1 ? "s" : ""})</td><td class="gp-r gp-amt">${money(u.type.total)}</td><td colspan="${cols - 6}"></td></tr>`;
  }
  const r = u.row;
  return `<tr class="gp-row${u.alt ? " gp-alt" : ""}">
<td class="gp-c">${box(r.written, "Thank-you written")}</td><td class="gp-c">${box(r.mailed, "Thank-you mailed")}</td>
<td class="gp-from"><div class="gp-name">${esc(r.name)}</div>${r.address ? `<div class="gp-addr">${esc(r.address)}</div>` : ""}</td>
<td>${esc(r.rec.type)}</td><td>${esc(r.rec.description)}</td>
<td class="gp-r gp-amt">${r.rec.amount != null ? money(r.rec.amount) : "—"}</td>
<td>${esc(r.received)}</td>${att ? `<td>${esc(r.attended)}</td>` : ""}</tr>`;
}

function headHTML(m) {
  const s = m.stats;
  const when = longDate(m.eventDate);
  return `<header class="gp-head">
<div class="gp-head-l"><div class="gp-title">${esc(m.eventName ? m.eventName + " — Gift List" : "Gift List")}</div>${when ? `<div class="gp-sub-title">${esc(when)}</div>` : ""}</div>
<div class="gp-head-r">
<div>${s.giftCount} gift${s.giftCount !== 1 ? "s" : ""} · ${s.moneyCount} monetary · <strong>${money(s.total)}</strong></div>
<div>Thank-yous: Written ${s.written} of ${s.allGivers} · Mailed ${s.mailed} of ${s.allGivers}</div>
<div>Generated ${esc(m.generated)}</div>
</div></header>`;
}

function contHeadHTML(m) {
  return `<header class="gp-head gp-head-cont"><div class="gp-title-sm">${esc(m.eventName ? m.eventName + " — Gift List" : "Gift List")} <span>(continued)</span></div></header>`;
}

function footHTML(m, page, pages) {
  return `<footer class="gp-foot"><span>${esc(m.sortNote)}</span><span>Page ${page} of ${pages}</span></footer>`;
}

function totalsHTML(m) {
  const s = m.stats;
  const body = m.types.map(t => `<tr><td>${esc(t.type)}</td><td class="gp-r">${t.gifts}</td><td class="gp-r gp-amt">${money(t.total)}</td></tr>`).join("");
  return `<section class="gp-totals"><div class="gp-totals-title">Totals by type</div>
<table class="gp-ttable"><thead><tr><th>Type</th><th class="gp-r">Gifts</th><th class="gp-r">Amount</th></tr></thead><tbody>${body}</tbody>
<tfoot><tr><td>Total monetary value</td><td class="gp-r">${s.giftCount}</td><td class="gp-r gp-amt">${money(s.total)}</td></tr></tfoot></table>
${m.sharedGifts ? `<div class="gp-note">A gift shared by several givers appears on each giver's row but is counted once in these totals.</div>` : ""}</section>`;
}

const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`;
const MONO = `ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`;

function css(paper) {
  const p = PAPER[paper];
  return `
@page { size: ${p.css} portrait; margin: 0.4in; }
.gp-doc, .gp-doc * { box-sizing: border-box; margin: 0; padding: 0; }
.gp-doc { font-family: ${FONT}; font-size: 10pt; line-height: 1.1; color: #000; background: #fff;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.gp-page { width: ${p.w}px; max-width: 100%; height: ${p.h}px; display: flex; flex-direction: column; background: #fff; overflow: hidden; break-after: page; page-break-after: always; }
.gp-page:last-child { break-after: auto; page-break-after: auto; }
.gp-main { flex: 1; min-height: 0; }
.gp-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; padding-bottom: 6px; margin-bottom: 4px; border-bottom: 1.5px solid #000; }
.gp-head-cont { align-items: baseline; padding-bottom: 4px; }
.gp-title { font-family: Georgia, "Times New Roman", serif; font-size: 18pt; font-weight: 700; line-height: 1.1; }
.gp-title-sm { font-family: Georgia, "Times New Roman", serif; font-size: 12pt; font-weight: 700; }
.gp-title-sm span { font-family: ${FONT}; font-size: 10pt; font-weight: 400; }
.gp-sub-title { margin-top: 2px; }
.gp-head-r { text-align: right; font-size: 10pt; line-height: 1.3; }
.gp-table { width: 100%; table-layout: fixed; border-collapse: collapse; }
.gp-table th { text-align: left; font-size: 10pt; font-weight: 700; padding: 3px 6px; border-bottom: 1.5px solid #000; white-space: nowrap; }
.gp-table td { padding: 1px 6px; vertical-align: middle; border-bottom: 0.5px solid #888; overflow-wrap: anywhere; }
.gp-row { break-inside: avoid; page-break-inside: avoid; }
.gp-alt td { background: #eee; }
.gp-c { text-align: center !important; padding-left: 2px !important; padding-right: 2px !important; }
.gp-r { text-align: right !important; }
.gp-amt { font-family: ${MONO}; font-variant-numeric: tabular-nums; white-space: nowrap; }
.gp-name { font-weight: 700; font-size: 11pt; }
.gp-addr { font-size: 10pt; color: #444; }
.gp-box { display: inline-flex; align-items: center; justify-content: center; width: 13px; height: 13px; border: 1.25px solid #000; background: #fff; vertical-align: middle; }
.gp-band td { background: #d8d8d8; font-weight: 700; padding: 3px 6px; border-top: 1px solid #000; border-bottom: 1px solid #000; }
.gp-sub td { font-weight: 700; border-bottom: 1px solid #000; }
.gp-totals { margin-top: 10px; break-inside: avoid; page-break-inside: avoid; }
.gp-totals-title { font-weight: 700; font-size: 11pt; padding-bottom: 3px; border-bottom: 1.5px solid #000; margin-bottom: 2px; }
.gp-ttable { width: 100%; border-collapse: collapse; }
.gp-ttable th { text-align: left; font-weight: 700; padding: 2px 6px; border-bottom: 0.5px solid #888; }
.gp-ttable td { padding: 2px 6px; border-bottom: 0.5px solid #888; }
.gp-ttable tfoot td { font-weight: 700; border-top: 1.5px solid #000; border-bottom: none; }
.gp-note { margin-top: 4px; }
.gp-empty { padding: 12px 6px; font-style: italic; }
.gp-foot { display: flex; justify-content: space-between; gap: 16px; padding-top: 4px; border-top: 0.5px solid #888; font-size: 10pt; }
@media screen {
  .gp-doc { background: #e5e5e5; padding: 12px 0; }
  .gp-page { width: calc(${p.w}px + 0.8in); height: calc(${p.h}px + 0.8in); margin: 0 auto 12px; padding: 0.4in; box-shadow: 0 1px 4px rgba(0,0,0,.3); }
  .gp-measure .gp-page { box-shadow: none; }
}
@media print { .gp-page { width: 100%; } }`;
}

// ── Measuring and packing ────────────────────────────────────────────────────
// Returns the pixel heights the page layout needs, measured in a hidden copy of
// the table at the paper's real width. Without a DOM (tests, server) it falls
// back to rough constants, which only affects where pages break.
function measure(model, paper) {
  const p = PAPER[paper];
  const att = model.opt.showAttendance;
  const units = model.units;
  if (typeof document === "undefined" || !document.body) {
    return {
      rows: units.map(u => u.kind === "row" ? (u.row.address ? 34 : 20) : 20),
      head: 70, cont: 30, thead: 24, foot: 22, totals: 60 + model.types.length * 18, band: 20,
    };
  }
  const host = document.createElement("div");
  host.className = "gp-doc gp-measure";
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = `position:absolute;left:-10000px;top:0;visibility:hidden;width:${p.w}px;padding:0;background:#fff`;
  const wrap = (cls, inner) => `<div class="${cls}" style="width:${p.w}px">${inner}</div>`;
  host.innerHTML = `<style>${css(paper)}</style>
${wrap("m-head", headHTML(model))}${wrap("m-cont", contHeadHTML(model))}${wrap("m-foot", footHTML(model, 99, 99))}${wrap("m-totals", totalsHTML(model))}
<table class="gp-table m-table" style="width:${p.w}px">${colgroup(att)}${theadHTML(att)}<tbody>${units.map(u => rowHTML(u, att)).join("")}<tr class="gp-band m-band"><td colspan="${att ? 8 : 7}">Band</td></tr></tbody></table>`;
  document.body.appendChild(host);
  try {
    const h = (sel) => host.querySelector(sel)?.getBoundingClientRect().height || 0;
    const trs = host.querySelectorAll(".m-table tbody tr");
    const rows = units.map((_, i) => trs[i]?.getBoundingClientRect().height || 0);
    return {
      rows, head: h(".m-head"), cont: h(".m-cont"), thead: h(".m-table thead"), foot: h(".m-foot"),
      totals: h(".m-totals") + 10, band: trs[units.length]?.getBoundingClientRect().height || 20,
    };
  } finally {
    host.remove();
  }
}

function paginate(model, paper, ms) {
  const p = PAPER[paper];
  const cap = (first) => p.h - SAFETY - ms.foot - ms.thead - (first ? ms.head : ms.cont);
  const units = model.units;
  const pages = [[]];
  let used = 0;
  let room = cap(true);
  units.forEach((u, i) => {
    const h = ms.rows[i];
    const need = u.kind === "band" ? h + (ms.rows[i + 1] || 0) : h;
    const page = pages[pages.length - 1];
    let item = u;
    if (page.length > 0 && used + need > room) {
      pages.push([]);
      room = cap(false);
      used = 0;
      if (u.kind !== "band" && u.group !== undefined) {
        pages[pages.length - 1].push({ kind: "band", group: u.group, label: u.group, continued: true });
        used += ms.band;
      }
    }
    pages[pages.length - 1].push(item);
    used += h;
  });
  let totalsOwnPage = false;
  if (used + ms.totals > room) { pages.push([]); totalsOwnPage = true; }
  return { pages, totalsOwnPage };
}

// ── Public entry point ───────────────────────────────────────────────────────
export function generateGiftPrintHTML(gifts, households, eventName, eventDate, options = {}) {
  const model = buildGiftPrintModel(gifts, households, eventName, eventDate, options);
  const paper = options.paper === "a4" || options.paper === "letter" ? options.paper : detectPaper(options.locale);
  const att = model.opt.showAttendance;
  const { pages } = paginate(model, paper, measure(model, paper));
  const total = pages.length;

  const body = pages.map((units, i) => {
    const last = i === total - 1;
    const table = units.length
      ? `<table class="gp-table">${colgroup(att)}${theadHTML(att)}<tbody>${units.map(u => rowHTML(u, att)).join("")}</tbody></table>`
      : (model.units.length === 0 && i === 0 ? `<div class="gp-empty">No gifts to print.</div>` : "");
    return `<section class="gp-page"><div class="gp-main">${i === 0 ? headHTML(model) : contHeadHTML(model)}${table}${last ? totalsHTML(model) : ""}</div>${footHTML(model, i + 1, total)}</section>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>Gift List${eventName ? " — " + esc(eventName) : ""}</title>
<style data-page-css>@page { size: ${PAPER[paper].css} portrait; margin: 0.4in; }</style>
<style>${css(paper).replace(/@page[^}]*\}/, "")}
html, body { margin: 0; background: #fff; }</style>
</head><body><div class="gp-doc">
${body}
</div></body></html>`;
}
