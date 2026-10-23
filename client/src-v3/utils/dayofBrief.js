// Moved verbatim from DayOfOverlay.jsx (V4.46.0 module split) — no behavior changes.
import { formatTimeRange } from "@/utils/dates.js";
import { PALETTES } from "@/constants/theme.js";
import { iconSvg } from "@/utils/iconSvg.js";
import { amountPaid, isFullyPaid } from "@/utils/expensePayments.js";
import { getInvitedPeopleForSection, getConfirmedPeopleForSection, getMealPopulation, splitAdultsKids } from "@/utils/sections.js";

// ── HTML escaping for print brief (user-sourced field interpolation) ────────
function escHtml(val) {
  const s = String(val == null ? "" : val);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Print Brief HTML generator ────────────────────────────────────────────────
export function generatePrintBriefHTML({ adminConfig, timeline, households, people, vendors, expenses, tasks, ceremonyRoles }) {
  const config   = adminConfig || {};
  const pal      = PALETTES[config.theme?.palette] || PALETTES.rose;
  const eventName = config.name || "Event";
  const mainEvent = timeline.find(e => e.isMainEvent) || timeline[0] || null;
  const eventDate  = mainEvent?.startDate
    ? new Date(mainEvent.startDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "";

  // ── Guest stats ──────────────────────────────────────────────────────────
  // Guest numbers come from the same shared helper as the Catering Summary,
  // so both screens agree on who is relevant and who is confirmed: guests
  // invited to a meal-serving sub-event (and not declined) and each person's
  // own Yes for it. With no sub-event flagged, falls back to household RSVP.
  const pop             = getMealPopulation(households, people, timeline.filter(e => e.servesMeal));
  const confirmedPeople = pop.confirmed;
  const confirmedIds    = new Set(confirmedPeople.map(p => p.id));
  const totalInvited    = pop.relevant.length;
  const totalConfirmed  = confirmedPeople.length;
  const kosherCount     = confirmedPeople.filter(p => p.kosher).length;
  const dietaryPeople   = pop.relevant
    .filter(p => (p.dietary && p.dietary.trim()) || p.kosher)
    .sort((a, b) => {
      const lastNameOf = (p) => (p.lastName || (p.name||"").split(" ").pop() || "").toLowerCase();
      return lastNameOf(a).localeCompare(lastNameOf(b));
    });
  const { adults: adultsConfirmed, kids: kidsConfirmed } = splitAdultsKids(confirmedPeople);

  // ── Sub-event counts ──────────────────────────────────────────────────────
  const subEventCounts = (sectionId) => {
    const section = timeline.find(e => e.id === sectionId);
    if (!section) return { invited: 0, confirmed: 0 };
    const invitedCount   = getInvitedPeopleForSection(households, people, section).length;
    const confirmedCount = getConfirmedPeopleForSection(people, section).length;
    return { invited: invitedCount, confirmed: confirmedCount };
  };

  // ── Vendors ───────────────────────────────────────────────────────────────
  const confirmedVendors = vendors.filter(v => ["Booked", "Deposit Paid", "Paid in Full"].includes(v.status));

  // Outstanding payments
  const fmt$ = (n) => "$" + (parseFloat(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const totalBudget   = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalPaid     = expenses.reduce((s, e) => s + amountPaid(e), 0);
  const unpaidExpenses = expenses
    .filter(e => !isFullyPaid(e))
    .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"))
    .slice(0, 8);

  // ── Tasks ─────────────────────────────────────────────────────────────────
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const activeTasks = tasks.filter(t => !t.dismissed && !t.done);
  const overdueTasks = activeTasks.filter(t => t.due && new Date(t.due + "T00:00:00") < today);
  const upcomingTasks = activeTasks
    .filter(t => !t.due || new Date(t.due + "T00:00:00") >= today)
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"))
    .slice(0, 10);
  const tasksDone  = tasks.filter(t => !t.dismissed && t.done).length;
  const tasksTotal = tasks.filter(t => !t.dismissed).length;

  const fmtDate = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

  // ── Ceremony roles ────────────────────────────────────────────────────────
  const sections = [...new Set(ceremonyRoles.map(r => r.section).filter(Boolean))];
  const sortedRoles = [...ceremonyRoles].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  // ── HTML ──────────────────────────────────────────────────────────────────
  const sectionHead = (iconKey, title) =>
    `<div class="section-head"><span>${iconSvg(iconKey, "inline") || iconKey}</span> ${title}</div>`;

  const timelineRows = timeline.map(entry => {
    const time  = formatTimeRange(entry.startTime, entry.endTime);
    const meta  = [time, entry.venue].filter(Boolean).join(" · ");
    const date  = entry.startDate ? fmtDate(entry.startDate) : "";
    const counts = subEventCounts(entry.id);
    const countStr = counts.invited > 0
      ? `<span class="guest-count">${counts.confirmed} confirmed / ${counts.invited} invited</span>`
      : "";
    return `<tr>
      <td class="tl-icon">${escHtml(entry.icon || "📅")}</td>
      <td>
        <strong>${escHtml(entry.title)}</strong>${entry.isMainEvent ? ' <span class="main-badge">MAIN</span>' : ""}
        ${meta ? `<br><span class="meta">${escHtml(meta)}</span>` : ""}
        ${countStr ? `<br>${countStr}` : ""}
      </td>
      <td class="tl-date">${date}</td>
    </tr>`;
  }).join("");

  const vendorRows = confirmedVendors.map(v => {
    const linked   = expenses.filter(e => e.vendorId === v.id);
    const vTotal   = linked.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const vPaid    = linked.reduce((s, e) => s + amountPaid(e), 0);
    const vBalance = vTotal - vPaid;
    const contact  = [v.contactName, v.phone, v.email].filter(Boolean).join(" · ");
    return `<tr>
      <td><strong>${escHtml(v.name)}</strong>${contact ? `<br><span class="meta">${escHtml(contact)}</span>` : ""}</td>
      <td>${escHtml(v.type || "")}</td>
      <td class="money">${vTotal > 0 ? fmt$(vTotal) : "—"}</td>
      <td class="money green">${vPaid > 0 ? fmt$(vPaid) : "—"}</td>
      <td class="money ${vBalance > 0 ? "red" : ""}">${vBalance > 0 ? fmt$(vBalance) : iconSvg("check", "badge", { color: "#2d6a4f" })}</td>
    </tr>`;
  }).join("");

  const unpaidRows = unpaidExpenses.map(e => {
    const vendorName = e.vendorId ? vendors.find(v => v.id === e.vendorId)?.name || "" : "";
    return `<tr>
      <td>${escHtml(e.description)}</td>
      <td>${escHtml(vendorName)}</td>
      <td class="money">${fmtDate(e.dueDate)}</td>
      <td class="money red">${fmt$(e.amount)}</td>
    </tr>`;
  }).join("");

  const taskRows = (list) => list.map(t => {
    const due = t.due ? fmtDate(t.due) : "—";
    const isOvr = t.due && new Date(t.due + "T00:00:00") < today;
    return `<tr>
      <td>${iconSvg("square", "badge", { color: "#9c9188" })}</td>
      <td>${escHtml(t.task)}</td>
      <td>${escHtml(t.category || "")}</td>
      <td class="${isOvr ? "red" : "meta"}">${due}</td>
    </tr>`;
  }).join("");

  const ceremonySection = sections.length > 0 ? sections.map(sec => {
    const secRoles = sortedRoles.filter(r => r.section === sec);
    const rows = secRoles.map(r => `<tr>
      <td>${escHtml(r.role)}${r.hebrewName ? `<br><span class="meta">${escHtml(r.hebrewName)}</span>` : ""}</td>
      <td class="${r.assignee?.trim() ? "" : "unassigned"}">${escHtml(r.assignee?.trim() || "— Unassigned —")}</td>
    </tr>`).join("");
    return `<div class="sub-section-label">${escHtml(sec)}</div>
    <table><thead><tr><th>Role</th><th>Assignee</th></tr></thead><tbody>${rows}</tbody></table>`;
  }).join("") : "";

  const dietaryRows = dietaryPeople.length > 0
    ? dietaryPeople.map(p => {
        const name = [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "Guest";
        const isConf = confirmedIds.has(p.id);
        return `<tr>
          <td><span class="${isConf ? "badge-green" : "badge-gold"}">${isConf ? iconSvg("check", "badge", { color: "#2d6a4f" }) : "?"}</span> ${escHtml(name)}</td>
          <td>${escHtml(p.dietary || "Kosher meal")}</td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="2" class="meta">No dietary requirements recorded.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escHtml(eventName)} — Event Brief</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; font-size: 13px; color: #1c1614; background: #faf8f5; padding: 24px; max-width: 900px; margin: 0 auto; }
  h1 { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 30px; font-weight: 700; color: #1c1614; margin-bottom: 4px; }
  .event-meta { font-size: 13px; color: #5c5248; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid ${pal["accent-medium"]}; }
  .section-head { display: flex; align-items: center; gap: 8px; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 18px; font-weight: 700; color: #1c1614; background: ${pal["accent-light"]}; border-left: 4px solid ${pal.accent}; padding: 8px 12px; margin: 24px 0 12px; border-radius: 2px; }
  .sub-section-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #9c9188; padding: 8px 0 4px; border-bottom: 1px solid #e2ddd5; margin-top: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 12px; }
  th { background: ${pal["accent-light"]}; text-align: left; padding: 6px 10px; font-size: 11px; font-weight: 600; color: #5c5248; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 2px solid ${pal["accent-medium"]}; }
  td { padding: 7px 10px; border-bottom: 1px solid #e2ddd5; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .meta { color: #9c9188; font-size: 11px; }
  .tl-icon { width: 36px; font-size: 18px; text-align: center; }
  .tl-date { white-space: nowrap; color: #5c5248; font-weight: 600; font-size: 11px; }
  .main-badge { display: inline-block; font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 99px; background: ${pal["accent-light"]}; color: ${pal["accent-dark"]}; margin-left: 6px; }
  .money { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .green { color: #2d6a4f; font-weight: 600; }
  .red { color: #9b2335; font-weight: 600; }
  .guest-count { font-size: 11px; color: ${pal["accent-dark"]}; font-weight: 600; }
  .stat-row { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
  .stat-box { background: ${pal["accent-light"]}; border: 1px solid ${pal["accent-medium"]}; border-radius: 6px; padding: 12px 20px; text-align: center; min-width: 100px; }
  .stat-num { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 30px; font-weight: 700; color: #1c1614; line-height: 1; }
  .stat-lbl { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #9c9188; margin-top: 4px; }
  .badge-green { display: inline-block; font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 99px; background: #d8f3dc; color: #2d6a4f; }
  .badge-gold  { display: inline-block; font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 99px; background: #f5ecd5; color: #b5821a; }
  .unassigned { color: #b5821a; font-style: italic; }
  .progress-wrap { background: #e2ddd5; border-radius: 99px; height: 8px; overflow: hidden; width: 100px; display: inline-block; vertical-align: middle; margin-left: 8px; }
  .progress-fill { height: 100%; background: ${pal.accent}; border-radius: 99px; }
  .print-footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid ${pal["accent-medium"]}; font-size: 11px; color: #9c9188; text-align: center; }
  @media print {
    body { padding: 12px; }
    .no-print { display: none; }
    .section-head { break-after: avoid; }
    table { break-inside: auto; }
    tr { break-inside: avoid; }
  }
</style>
</head>
<body>
<h1>${escHtml(eventName)}</h1>
<div class="event-meta">${eventDate ? eventDate + " · " : ""}Event Brief · Generated ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>

${sectionHead("calendar", "Event Timeline")}
${timeline.length === 0
  ? `<p class="meta">No timeline entries configured.</p>`
  : `<table><thead><tr><th style="width:36px"></th><th>Event</th><th style="width:130px">Date</th></tr></thead><tbody>${timelineRows}</tbody></table>`}

${sectionHead("guests", "Guest Summary")}
<div class="stat-row">
  <div class="stat-box"><div class="stat-num">${totalConfirmed}</div><div class="stat-lbl">Confirmed</div></div>
  <div class="stat-box"><div class="stat-num">${totalInvited}</div><div class="stat-lbl">Expected</div></div>
  <div class="stat-box"><div class="stat-num">${adultsConfirmed}</div><div class="stat-lbl">Adults</div></div>
  <div class="stat-box"><div class="stat-num">${kidsConfirmed}</div><div class="stat-lbl">Kids</div></div>
  <div class="stat-box"><div class="stat-num">${kosherCount}</div><div class="stat-lbl">Kosher</div></div>
  <div class="stat-box"><div class="stat-num">${dietaryPeople.length}</div><div class="stat-lbl">Dietary</div></div>
</div>
<p style="font-size:10px;color:#5c5248;margin:6px 0 10px;">${timeline.some(e => e.servesMeal) ? "Expected = confirmed + awaiting. Guests who declined are not counted." : "Expected = everyone on the guest list (no sub-event is marked Meal served)."}</p>
${dietaryPeople.length > 0 ? `
<table><thead><tr><th>Guest</th><th>Dietary Requirement</th></tr></thead><tbody>${dietaryRows}</tbody></table>
` : ""}

${sectionHead("vendors", "Confirmed Vendors")}
${confirmedVendors.length === 0
  ? `<p class="meta">No confirmed vendors.</p>`
  : `<table><thead><tr><th>Vendor</th><th>Type</th><th class="money">Total</th><th class="money">Paid</th><th class="money">Balance</th></tr></thead><tbody>${vendorRows}</tbody></table>`}
${unpaidExpenses.length > 0 ? `
<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#9c9188;margin:12px 0 6px">Upcoming Payments</div>
<table><thead><tr><th>Description</th><th>Vendor</th><th>Due Date</th><th class="money">Amount</th></tr></thead><tbody>${unpaidRows}</tbody></table>
<p class="meta" style="text-align:right">Total budget: ${fmt$(totalBudget)} · Paid: ${fmt$(totalPaid)} · Outstanding: ${fmt$(totalBudget - totalPaid)}</p>
` : ""}

${sectionHead("tasks", `Tasks — ${tasksDone} of ${tasksTotal} complete`)}
${overdueTasks.length > 0 ? `
<div class="sub-section-label">${iconSvg("alertTriangle", "badge", { color: "#9b2335" })} Overdue (${overdueTasks.length})</div>
<table><thead><tr><th style="width:20px"></th><th>Task</th><th>Category</th><th>Due</th></tr></thead><tbody>${taskRows(overdueTasks)}</tbody></table>
` : ""}
${upcomingTasks.length > 0 ? `
<div class="sub-section-label">Upcoming (${upcomingTasks.length})</div>
<table><thead><tr><th style="width:20px"></th><th>Task</th><th>Category</th><th>Due</th></tr></thead><tbody>${taskRows(upcomingTasks)}</tbody></table>
` : upcomingTasks.length === 0 && overdueTasks.length === 0 ? `<p class="meta">All tasks complete! ${iconSvg("partyPopper", "inline")}</p>` : ""}

${ceremonyRoles.length > 0 ? `
${sectionHead("clipboardList", `Ceremony Roles — ${ceremonyRoles.filter(r => r.assignee?.trim()).length} of ${ceremonyRoles.length} assigned`)}
${ceremonySection}
` : ""}

<div class="print-footer">SimchaKit · ${escHtml(eventName)} · ${new Date().toLocaleDateString()} · support@brook-creative.com</div>
</body>
</html>`;
}
