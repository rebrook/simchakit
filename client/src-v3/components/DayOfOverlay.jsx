// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.10.0 — DayOfOverlay.jsx
// V3 only. Collections loaded via useEventData.
// dayOf config (checklist + timelineChecks) stored as single doc in supabase.
// Print Brief: fully self-contained — generates printable HTML, opens iframe
// preview modal. No AppShell involvement needed.
//
// Mobile Day-of Mode (<=900px):
//   Full-screen, phone-optimized layout with auto-advancing now/next,
//   one-tap vendor contacts, ceremony roles, and "Running late" CTA.
//   Caches event data to localStorage for flaky venue wifi.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useMemo } from "react";
import { supabase }           from "@/lib/supabase.js";
import { useEventData }       from "@/hooks/useEventData.js";
import { DAY_OF_TIME_BLOCKS } from "@/constants/events.js";
import { formatTimeRange, sortTimeline } from "@/utils/dates.js";
import { Icon } from "@/utils/iconMap.jsx";
import { iconSvg } from "@/utils/iconSvg.js";

// ── Cache helpers ────────────────────────────────────────────────────────────
const CACHE_VERSION = "v1";
function cacheKey(eventId) { return `simchakit-dayof-cache-${CACHE_VERSION}-${eventId}`; }

function readCache(eventId) {
  try {
    const raw = localStorage.getItem(cacheKey(eventId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Sanity: must have a timeline array
    if (!parsed || !Array.isArray(parsed.timeline)) return null;
    return parsed;
  } catch { return null; }
}

function writeCache(eventId, data) {
  try { localStorage.setItem(cacheKey(eventId), JSON.stringify(data)); } catch { /* quota exceeded, ignore */ }
}

// ── Time helpers for now/next detection ──────────────────────────────────────
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  // Accepts "HH:MM", "H:MM AM/PM", "HH:MM AM/PM"
  const cleaned = timeStr.trim().toUpperCase();
  let hours, minutes;

  const ampmMatch = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (ampmMatch) {
    hours = parseInt(ampmMatch[1], 10);
    minutes = parseInt(ampmMatch[2], 10);
    if (ampmMatch[3] === "PM" && hours !== 12) hours += 12;
    if (ampmMatch[3] === "AM" && hours === 12) hours = 0;
  } else {
    const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
    if (!match24) return null;
    hours = parseInt(match24[1], 10);
    minutes = parseInt(match24[2], 10);
  }
  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function getNowMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function formatClock() {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ── Mobile detection (matches AppShell 900px breakpoint) ─────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 900);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}


// ── Print Brief HTML generator ────────────────────────────────────────────────
function generatePrintBriefHTML({ adminConfig, timeline, households, people, vendors, expenses, tasks, ceremonyRoles }) {
  const config   = adminConfig || {};
  const eventName = config.name || "Event";
  const mainEvent = timeline.find(e => e.isMainEvent) || timeline[0] || null;
  const eventDate  = mainEvent?.startDate
    ? new Date(mainEvent.startDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "";

  // ── Guest stats ──────────────────────────────────────────────────────────
  const confirmedHHIds  = new Set(households.filter(h => h.status === "RSVP Yes").map(h => h.id));
  const confirmedPeople = people.filter(p => confirmedHHIds.has(p.householdId));
  const totalInvited    = people.length;
  const totalConfirmed  = confirmedPeople.length;
  const kosherCount     = confirmedPeople.filter(p => p.kosher).length;
  const dietaryPeople   = people.filter(p => p.dietary && p.dietary.trim());
  const adultsConfirmed = confirmedPeople.filter(p => !p.isChild).length;
  const kidsConfirmed   = confirmedPeople.filter(p => p.isChild).length;

  // ── Sub-event counts ──────────────────────────────────────────────────────
  const subEventCounts = (sectionId) => {
    const invitedHHIds  = new Set(households.filter(h => (h.invitedSections || []).includes(sectionId)).map(h => h.id));
    const invitedCount  = people.filter(p => invitedHHIds.has(p.householdId)).length;
    const confirmedCount = people.filter(p => (p.attendingSections || []).includes(sectionId)).length;
    return { invited: invitedCount, confirmed: confirmedCount };
  };

  // ── Vendors ───────────────────────────────────────────────────────────────
  const confirmedVendors = vendors.filter(v => ["Booked", "Deposit Paid", "Paid in Full"].includes(v.status));

  // Outstanding payments
  const fmt$ = (n) => "$" + (parseFloat(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const totalBudget   = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalPaid     = expenses.filter(e => e.paid).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const unpaidExpenses = expenses
    .filter(e => !e.paid)
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
      <td class="tl-icon">${entry.icon || "📅"}</td>
      <td>
        <strong>${entry.title}</strong>${entry.isMainEvent ? ' <span class="main-badge">MAIN</span>' : ""}
        ${meta ? `<br><span class="meta">${meta}</span>` : ""}
        ${countStr ? `<br>${countStr}` : ""}
      </td>
      <td class="tl-date">${date}</td>
    </tr>`;
  }).join("");

  const vendorRows = confirmedVendors.map(v => {
    const linked   = expenses.filter(e => e.vendorId === v.id);
    const vTotal   = linked.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const vPaid    = linked.filter(e => e.paid).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const vBalance = vTotal - vPaid;
    const contact  = [v.contactName, v.phone, v.email].filter(Boolean).join(" · ");
    return `<tr>
      <td><strong>${v.name}</strong>${contact ? `<br><span class="meta">${contact}</span>` : ""}</td>
      <td>${v.type || ""}</td>
      <td class="money">${vTotal > 0 ? fmt$(vTotal) : "—"}</td>
      <td class="money green">${vPaid > 0 ? fmt$(vPaid) : "—"}</td>
      <td class="money ${vBalance > 0 ? "red" : ""}">${vBalance > 0 ? fmt$(vBalance) : iconSvg("check", "badge", { color: "#2d6a4f" })}</td>
    </tr>`;
  }).join("");

  const unpaidRows = unpaidExpenses.map(e => {
    const vendorName = e.vendorId ? vendors.find(v => v.id === e.vendorId)?.name || "" : "";
    return `<tr>
      <td>${e.description}</td>
      <td>${vendorName}</td>
      <td class="money">${fmtDate(e.dueDate)}</td>
      <td class="money red">${fmt$(e.amount)}</td>
    </tr>`;
  }).join("");

  const taskRows = (list) => list.map(t => {
    const due = t.due ? fmtDate(t.due) : "—";
    const isOvr = t.due && new Date(t.due + "T00:00:00") < today;
    return `<tr>
      <td>☐</td>
      <td>${t.task}</td>
      <td>${t.category || ""}</td>
      <td class="${isOvr ? "red" : "meta"}">${due}</td>
    </tr>`;
  }).join("");

  const ceremonySection = sections.length > 0 ? sections.map(sec => {
    const secRoles = sortedRoles.filter(r => r.section === sec);
    const rows = secRoles.map(r => `<tr>
      <td>${r.role}${r.hebrewName ? `<br><span class="meta">${r.hebrewName}</span>` : ""}</td>
      <td class="${r.assignee?.trim() ? "" : "unassigned"}">${r.assignee?.trim() || "— Unassigned —"}</td>
    </tr>`).join("");
    return `<div class="sub-section-label">${sec}</div>
    <table><thead><tr><th>Role</th><th>Assignee</th></tr></thead><tbody>${rows}</tbody></table>`;
  }).join("") : "";

  const dietaryRows = dietaryPeople.length > 0
    ? dietaryPeople.map(p => {
        const name = [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "Guest";
        const isConf = confirmedHHIds.has(p.householdId);
        return `<tr>
          <td><span class="${isConf ? "badge-green" : "badge-gold"}">${isConf ? iconSvg("check", "badge", { color: "#2d6a4f" }) : "?"}</span> ${name}</td>
          <td>${p.dietary}</td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="2" class="meta">No dietary requirements recorded.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${eventName} — Event Brief</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #1a1a1a; background: #fff; padding: 24px; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 26px; font-weight: 800; color: #1a1a1a; margin-bottom: 4px; }
  .event-meta { font-size: 13px; color: #666; margin-bottom: 24px; }
  .section-head { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 800; color: #1a1a1a; background: #f8f8f8; border-left: 4px solid #3b82f6; padding: 8px 12px; margin: 24px 0 12px; border-radius: 2px; }
  .sub-section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #888; padding: 8px 0 4px; border-bottom: 1px solid #eee; margin-top: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 12px; }
  th { background: #f5f5f5; text-align: left; padding: 6px 10px; font-size: 11px; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 2px solid #ddd; }
  td { padding: 7px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .meta { color: #888; font-size: 11px; }
  .tl-icon { width: 36px; font-size: 18px; text-align: center; }
  .tl-date { white-space: nowrap; color: #555; font-weight: 600; font-size: 11px; }
  .main-badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 99px; background: #eff6ff; color: #2563eb; margin-left: 6px; }
  .money { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .green { color: #16a34a; font-weight: 600; }
  .red { color: #dc2626; font-weight: 600; }
  .guest-count { font-size: 11px; color: #2563eb; font-weight: 600; }
  .stat-row { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
  .stat-box { background: #f8f8f8; border: 1px solid #e5e5e5; border-radius: 6px; padding: 12px 20px; text-align: center; min-width: 100px; }
  .stat-num { font-size: 28px; font-weight: 800; color: #1a1a1a; line-height: 1; }
  .stat-lbl { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #888; margin-top: 4px; }
  .badge-green { display: inline-block; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 99px; background: #dcfce7; color: #16a34a; }
  .badge-gold  { display: inline-block; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 99px; background: #fef9c3; color: #a16207; }
  .unassigned { color: #d97706; font-style: italic; }
  .progress-wrap { background: #f0f0f0; border-radius: 99px; height: 8px; overflow: hidden; width: 100px; display: inline-block; vertical-align: middle; margin-left: 8px; }
  .progress-fill { height: 100%; background: #3b82f6; border-radius: 99px; }
  .print-footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; font-size: 11px; color: #aaa; text-align: center; }
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
<h1>${eventName}</h1>
<div class="event-meta">${eventDate ? eventDate + " · " : ""}Event Brief · Generated ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>

${sectionHead("calendar", "Event Timeline")}
${timeline.length === 0
  ? `<p class="meta">No timeline entries configured.</p>`
  : `<table><thead><tr><th style="width:36px"></th><th>Event</th><th style="width:130px">Date</th></tr></thead><tbody>${timelineRows}</tbody></table>`}

${sectionHead("guests", "Guest Summary")}
<div class="stat-row">
  <div class="stat-box"><div class="stat-num">${totalConfirmed}</div><div class="stat-lbl">Confirmed</div></div>
  <div class="stat-box"><div class="stat-num">${totalInvited}</div><div class="stat-lbl">Invited</div></div>
  <div class="stat-box"><div class="stat-num">${adultsConfirmed}</div><div class="stat-lbl">Adults</div></div>
  <div class="stat-box"><div class="stat-num">${kidsConfirmed}</div><div class="stat-lbl">Kids</div></div>
  <div class="stat-box"><div class="stat-num">${kosherCount}</div><div class="stat-lbl">Kosher</div></div>
  <div class="stat-box"><div class="stat-num">${dietaryPeople.length}</div><div class="stat-lbl">Dietary</div></div>
</div>
${dietaryPeople.length > 0 ? `
<table><thead><tr><th>Guest</th><th>Dietary Requirement</th></tr></thead><tbody>${dietaryRows}</tbody></table>
` : ""}

${sectionHead("vendors", "Confirmed Vendors")}
${confirmedVendors.length === 0
  ? `<p class="meta">No confirmed vendors.</p>`
  : `<table><thead><tr><th>Vendor</th><th>Type</th><th class="money">Total</th><th class="money">Paid</th><th class="money">Balance</th></tr></thead><tbody>${vendorRows}</tbody></table>`}
${unpaidExpenses.length > 0 ? `
<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#888;margin:12px 0 6px">Upcoming Payments</div>
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
${sectionHead("✡", `Ceremony Roles — ${ceremonyRoles.filter(r => r.assignee?.trim()).length} of ${ceremonyRoles.length} assigned`)}
${ceremonySection}
` : ""}

<div class="print-footer">SimchaKit · ${eventName} · ${new Date().toLocaleDateString()} · support@brook-creative.com</div>
</body>
</html>`;
}

// ── DayOfItemModal ─────────────────────────────────────────────────────────────
export function DayOfItemModal({ item, onSave, onClose }) {
  const isEdit = !!item;
  const [form, setForm] = useState(item || {
    id: "doi_" + Date.now() + "_" + Math.random().toString(36).slice(2,7),
    task: "", timeBlock: "Morning", done: false,
  });
  const setF = (k, v) => setForm(f => ({...f, [k]: v}));

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? "Edit Item" : "Add Day-of Item"}</div>
          <button className="icon-btn" title="Close" onClick={onClose}><Icon name="x" context="button" /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Task *</label>
            <input className="form-input" value={form.task} onChange={e => setF("task", e.target.value)} placeholder="e.g. Confirm DJ setup complete" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Time Block</label>
            <select className="form-select" value={form.timeBlock} onChange={e => setF("timeBlock", e.target.value)}>
              {DAY_OF_TIME_BLOCKS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!form.task.trim()} onClick={e => { e.stopPropagation(); if (form.task.trim()) onSave(form); }}>
              {isEdit ? "Save Changes" : "Add Item"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


// ── Mobile Day-of View ────────────────────────────────────────────────────────
function MobileDayOf({ timeline, adminConfig, confirmedVendors, ceremonyRoles, confirmedPeople, dietaryPeople, kosherCount, totalConfirmed, totalInvited, eventName, eventDate, coPlanners, onClose }) {
  const [clock, setClock] = useState(formatClock);
  const [nowMinutes, setNowMinutes] = useState(getNowMinutes);
  const nowRef = useRef(null);

  // iOS body scroll lock: prevent page content from scrolling behind the overlay
  useEffect(() => {
    const scrollY = window.scrollY;
    const body = document.body;
    const html = document.documentElement;
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    return () => {
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.overflow = "";
      html.style.overflow = "";
      window.scrollTo(0, scrollY);
    };
  }, []);

  // Clock + now-detection interval (every 30s)
  useEffect(() => {
    const tick = () => {
      setClock(formatClock());
      setNowMinutes(getNowMinutes());
    };
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  // Scroll to "now" entry on mount
  useEffect(() => {
    if (nowRef.current) {
      nowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  // Determine now/next from timeline
  const { nowEntry, nextEntry, progress } = useMemo(() => {
    let now = null, next = null, prog = 0;
    const mins = nowMinutes;

    for (let i = 0; i < timeline.length; i++) {
      const entry = timeline[i];
      const start = parseTimeToMinutes(entry.startTime);
      const end   = parseTimeToMinutes(entry.endTime);

      if (start !== null && end !== null && mins >= start && mins < end) {
        now = entry;
        prog = Math.round(((mins - start) / (end - start)) * 100);
        if (i + 1 < timeline.length) next = timeline[i + 1];
        break;
      }
    }

    // If nothing is "now", find the next upcoming
    if (!now) {
      for (const entry of timeline) {
        const start = parseTimeToMinutes(entry.startTime);
        if (start !== null && start > mins) {
          next = entry;
          break;
        }
      }
    }

    return { nowEntry: now, nextEntry: next, progress: prog };
  }, [timeline, nowMinutes]);

  // Clergy from adminConfig
  const clergyContacts = useMemo(() => {
    const cfg = adminConfig || {};
    const contacts = [];
    if (cfg.clergyName)     contacts.push({ name: cfg.clergyName,     role: cfg.clergyTitle || "Clergy",     phone: cfg.clergyPhone,     email: cfg.clergyEmail });
    if (cfg.clergy2Name)    contacts.push({ name: cfg.clergy2Name,    role: cfg.clergy2Title || "Clergy",    phone: cfg.clergy2Phone,    email: cfg.clergy2Email });
    if (cfg.tutorName)      contacts.push({ name: cfg.tutorName,      role: cfg.tutorTitle || "Tutor",       phone: cfg.tutorPhone,      email: cfg.tutorEmail });
    if (cfg.coordinatorName) contacts.push({ name: cfg.coordinatorName, role: "Day-of coordinator", phone: cfg.coordinatorPhone, email: cfg.coordinatorEmail });
    return contacts;
  }, [adminConfig]);

  // Notify CTA: mailto to co-planners (excluding current user, but we don't have userId here so include all)
  const notifyHref = useMemo(() => {
    const emails = (coPlanners || []).filter(c => c.email && c.role !== "owner").map(c => c.email);
    // Also include the owner for notification
    const ownerEmail = (coPlanners || []).find(c => c.role === "owner")?.email;
    const allEmails = ownerEmail ? [ownerEmail, ...emails] : emails;
    if (allEmails.length === 0) return null;

    const name = eventName || "the event";
    const subject = encodeURIComponent(`Running late - ${name}`);
    const body = encodeURIComponent(`Hi team,\n\nI'm running a few minutes late to ${name}. Will update when I'm close.\n\nSent from SimchaKit`);
    return `mailto:${allEmails.join(",")}?subject=${subject}&body=${body}`;
  }, [coPlanners, eventName]);

  // Ceremony roles: show section matching current "now" entry, or all sections if no match
  const ceremonyDisplay = useMemo(() => {
    if (!ceremonyRoles || ceremonyRoles.length === 0) return null;
    const sorted = [...ceremonyRoles].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const allSections = [...new Set(sorted.map(r => r.section).filter(Boolean))];

    // Try to match now entry title to a ceremony section
    if (nowEntry) {
      const nowTitle = nowEntry.title?.toLowerCase() || "";
      const matchedSection = allSections.find(s => nowTitle.includes(s.toLowerCase()) || s.toLowerCase().includes(nowTitle));
      if (matchedSection) {
        return { sections: [matchedSection], roles: sorted };
      }
    }

    // No match: show all sections
    return { sections: allSections, roles: sorted };
  }, [ceremonyRoles, nowEntry]);

  const nextTimeStr = nextEntry ? formatTimeRange(nextEntry.startTime, nextEntry.endTime)?.split("–")[0]?.trim() || "" : "";

  return (
    <div className="dayof-m-root">
      {/* ── Sticky header ── */}
      <div className="dayof-m-header">
        <div className="dayof-m-header-row">
          <div className="dayof-m-mode">
            <Icon name="clipboardList" context="badge" style={{ marginRight: 4 }} />
            Day-of mode
          </div>
          <button className="dayof-m-exit" onClick={onClose}>Exit</button>
        </div>
        <div className="dayof-m-header-row" style={{ marginTop: 6 }}>
          <div className="dayof-m-event-name">{eventName}</div>
          <div className="dayof-m-clock">{clock}</div>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="dayof-m-body">

        {/* ── Now card ── */}
        {nowEntry ? (
          <div className="dayof-m-now">
            <div className="dayof-m-now-tag">
              <Icon name="clock" context="badge" style={{ marginRight: 4 }} />
              Happening now
            </div>
            <div className="dayof-m-now-title">{nowEntry.title}</div>
            <div className="dayof-m-now-meta">
              <Icon name="mapPin" context="badge" style={{ marginRight: 4 }} />
              {[nowEntry.venue, formatTimeRange(nowEntry.startTime, nowEntry.endTime)].filter(Boolean).join(" · ")}
            </div>
            <div className="dayof-m-progress">
              <div className="dayof-m-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            {nextEntry && (
              <div className="dayof-m-now-next">
                Next: {nextEntry.title}{nextTimeStr ? ` at ${nextTimeStr}` : ""}
              </div>
            )}
          </div>
        ) : nextEntry ? (
          <div className="dayof-m-now" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <div className="dayof-m-now-tag" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
              <Icon name="clock" context="badge" style={{ marginRight: 4 }} />
              Coming up next
            </div>
            <div className="dayof-m-now-title" style={{ color: "var(--text-primary)" }}>{nextEntry.title}</div>
            <div className="dayof-m-now-meta" style={{ color: "var(--text-secondary)" }}>
              <Icon name="mapPin" context="badge" style={{ marginRight: 4 }} />
              {[nextEntry.venue, formatTimeRange(nextEntry.startTime, nextEntry.endTime)].filter(Boolean).join(" · ")}
            </div>
          </div>
        ) : null}

        {/* ── Run of show ── */}
        <div className="dayof-m-card">
          <div className="dayof-m-card-label">
            <Icon name="calendar" context="badge" style={{ marginRight: 5 }} />
            Run of show
          </div>
          {timeline.length === 0 ? (
            <div className="dayof-m-empty">No timeline entries configured.</div>
          ) : timeline.map((entry, i) => {
            const start = parseTimeToMinutes(entry.startTime);
            const end   = parseTimeToMinutes(entry.endTime);
            const isNow  = start !== null && end !== null && nowMinutes >= start && nowMinutes < end;
            const isPast = end !== null && nowMinutes >= end;
            const timeStr = entry.startTime ? entry.startTime.replace(/^0/, "") : "";
            return (
              <div
                key={entry.id || i}
                ref={isNow ? nowRef : null}
                className={`dayof-m-run-row ${isNow ? "now" : ""} ${isPast ? "past" : ""}`}
              >
                <div className="dayof-m-run-time" style={isNow ? { color: "var(--accent-primary)", fontWeight: 700 } : undefined}>
                  {timeStr}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={`dayof-m-run-title ${isNow ? "now" : ""}`}>{entry.title}</div>
                  {(entry.venue) && (
                    <div className="dayof-m-run-venue">{entry.venue}{entry.isMainEvent ? "" : ""}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Key contacts ── */}
        {(confirmedVendors.length > 0 || clergyContacts.length > 0) && (
          <div className="dayof-m-card">
            <div className="dayof-m-card-label">
              <Icon name="bellRing" context="badge" style={{ marginRight: 5 }} />
              Key contacts
            </div>
            {clergyContacts.map((c, i) => (
              <div key={`clergy-${i}`} className="dayof-m-contact">
                <div className="dayof-m-contact-icon">
                  <Icon name="sparkles" context="button" />
                </div>
                <div className="dayof-m-contact-info">
                  <div className="dayof-m-contact-name">{c.name}</div>
                  <div className="dayof-m-contact-role">{c.role}</div>
                </div>
                <div className="dayof-m-contact-actions">
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="dayof-m-action-btn call" aria-label={`Call ${c.name}`}>
                      <Icon name="phone" context="badge" />
                    </a>
                  )}
                  {c.phone && (
                    <a href={`sms:${c.phone}`} className="dayof-m-action-btn text" aria-label={`Text ${c.name}`}>
                      <Icon name="messageSquare" context="badge" />
                    </a>
                  )}
                  {!c.phone && c.email && (
                    <a href={`mailto:${c.email}`} className="dayof-m-action-btn text" aria-label={`Email ${c.name}`}>
                      <Icon name="mail" context="badge" />
                    </a>
                  )}
                </div>
              </div>
            ))}
            {confirmedVendors.map(v => (
              <div key={v.id} className="dayof-m-contact">
                <div className="dayof-m-contact-icon">
                  <Icon name="store" context="button" />
                </div>
                <div className="dayof-m-contact-info">
                  <div className="dayof-m-contact-name">{v.name}</div>
                  <div className="dayof-m-contact-role">{v.type || "Vendor"}{v.contactName ? ` · ${v.contactName}` : ""}</div>
                </div>
                <div className="dayof-m-contact-actions">
                  {v.phone && (
                    <a href={`tel:${v.phone}`} className="dayof-m-action-btn call" aria-label={`Call ${v.name}`}>
                      <Icon name="phone" context="badge" />
                    </a>
                  )}
                  {v.phone && (
                    <a href={`sms:${v.phone}`} className="dayof-m-action-btn text" aria-label={`Text ${v.name}`}>
                      <Icon name="messageSquare" context="badge" />
                    </a>
                  )}
                  {!v.phone && v.email && (
                    <a href={`mailto:${v.email}`} className="dayof-m-action-btn text" aria-label={`Email ${v.name}`}>
                      <Icon name="mail" context="badge" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Ceremony roles ── */}
        {ceremonyDisplay && ceremonyDisplay.sections.length > 0 && (
          <div className="dayof-m-card">
            <div className="dayof-m-card-label">
              ✡ Ceremony roles
            </div>
            {ceremonyDisplay.sections.map(sec => {
              const sectionRoles = ceremonyDisplay.roles.filter(r => r.section === sec);
              return (
                <div key={sec}>
                  <div className="dayof-m-section-label">{sec}</div>
                  {sectionRoles.map(role => (
                    <div key={role.id} className="dayof-m-role-row">
                      <div className="dayof-m-role-name">
                        {role.role}
                        {role.hebrewName && <span className="dayof-m-role-hebrew">{role.hebrewName}</span>}
                      </div>
                      <div className={`dayof-m-role-assignee ${role.assignee?.trim() ? "" : "empty"}`}>
                        {role.assignee?.trim() || "Unassigned"}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Quick numbers ── */}
        <div className="dayof-m-card">
          <div className="dayof-m-card-label">
            <Icon name="users" context="badge" style={{ marginRight: 5 }} />
            Guest snapshot
          </div>
          <div className="dayof-m-stats-grid">
            <div className="dayof-m-stat"><div className="dayof-m-stat-value">{totalConfirmed}</div><div className="dayof-m-stat-label">Confirmed</div></div>
            <div className="dayof-m-stat"><div className="dayof-m-stat-value">{totalInvited}</div><div className="dayof-m-stat-label">Invited</div></div>
            <div className="dayof-m-stat"><div className="dayof-m-stat-value">{kosherCount}</div><div className="dayof-m-stat-label">Kosher</div></div>
            <div className="dayof-m-stat"><div className="dayof-m-stat-value">{dietaryPeople.length}</div><div className="dayof-m-stat-label">Dietary</div></div>
          </div>
        </div>

      </div>

      {/* ── Sticky bottom CTA ── */}
      {notifyHref && (
        <a href={notifyHref} className="dayof-m-notify">
          <Icon name="bellRing" context="button" style={{ marginRight: 8 }} />
          Running late? Notify the team
        </a>
      )}
    </div>
  );
}


// ── DayOfOverlay ──────────────────────────────────────────────────────────────
export function DayOfOverlay({ eventId, event, adminConfig, onClose, onPrintBrief, coPlanners }) {
  const { items: vendors }    = useEventData(eventId, "vendors");
  const { items: people }     = useEventData(eventId, "people");
  const { items: households } = useEventData(eventId, "households");
  const { items: expenses }   = useEventData(eventId, "expenses");
  const { items: tasks }      = useEventData(eventId, "tasks");

  // dayOf config — single document
  const [dayOf,      setDayOf]      = useState({ checklist: [], timelineChecks: {} });
  const [dayOfRowId, setDayOfRowId] = useState(null);

  // Ceremony roles — single document
  const [ceremonyRoles, setCeremonyRoles] = useState([]);

  // Notes
  const [localNotes, setLocalNotes] = useState(event?.quick_notes || "");
  const notesTimer = useRef(null);

  // Print Brief state
  const [printHTML,  setPrintHTML]  = useState(null);
  const printFrameRef = useRef(null);

  const [showAddItem, setShowAddItem] = useState(false);
  const [editItem,    setEditItem]    = useState(null);

  // Mobile detection
  const isMobile = useIsMobile();

  // Load dayOf config
  useEffect(() => {
    if (!eventId) return;
    async function load() {
      const { data: rows } = await supabase.from("dayof").select("id, data").eq("event_id", eventId).order("updated_at", { ascending: false }).limit(1);
      if (rows && rows.length > 0) {
        setDayOfRowId(rows[0].id);
        setDayOf(rows[0].data || { checklist: [], timelineChecks: {} });
      }
    }
    load();
  }, [eventId]);

  // Load ceremony roles
  useEffect(() => {
    if (!eventId) return;
    async function load() {
      const { data: rows } = await supabase.from("ceremony_roles").select("data").eq("event_id", eventId).order("updated_at", { ascending: false });
      if (rows && rows.length > 0) {
        const arrayRow = rows.find(r => Array.isArray(r.data?.roles));
        const row = arrayRow || rows[0];
        setCeremonyRoles(row.data?.roles || []);
      }
    }
    load();
  }, [eventId]);

  // Sync notes
  useEffect(() => { setLocalNotes(event?.quick_notes || ""); }, [event?.quick_notes]);
  useEffect(() => () => clearTimeout(notesTimer.current), []);

  const saveDayOf = async (next) => {
    setDayOf(next);
    const row = {
      ...(dayOfRowId ? { id: dayOfRowId } : {}),
      event_id:   eventId,
      data:       next,
      updated_at: new Date().toISOString(),
    };
    const { data: saved, error } = await supabase.from("dayof").upsert(row, { onConflict: "id" }).select("id").single();
    if (!error && saved && !dayOfRowId) setDayOfRowId(saved.id);
  };

  const handleNotesChange = (val) => {
    setLocalNotes(val);
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(async () => {
      await supabase.from("events").update({ quick_notes: val, updated_at: new Date().toISOString() }).eq("id", eventId);
    }, 600);
  };

  const timeline       = sortTimeline(adminConfig?.timeline || []);
  const confirmedVendors = vendors.filter(v => ["Booked","Deposit Paid","Paid in Full"].includes(v.status));
  const checklist      = dayOf.checklist || [];
  const timelineChecks = dayOf.timelineChecks || {};

  const confirmedHHIds  = new Set(households.filter(h => h.status === "RSVP Yes").map(h => h.id));
  const confirmedPeople = people.filter(p => confirmedHHIds.has(p.householdId));
  const kosherCount     = confirmedPeople.filter(p => p.kosher).length;
  const dietaryPeople   = people.filter(p => p.dietary && p.dietary.trim());
  const totalConfirmed  = confirmedPeople.length;
  const totalInvited    = people.length;

  const mainEvent = timeline.find(e => e.isMainEvent);
  const eventDate = mainEvent?.startDate
    ? new Date(mainEvent.startDate+"T00:00:00").toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" })
    : "";
  const eventName = adminConfig?.name || event?.name || "Event";

  const grouped = {};
  DAY_OF_TIME_BLOCKS.forEach(b => { grouped[b] = []; });
  checklist.forEach(c => { const b = c.timeBlock||"Morning"; if (!grouped[b]) grouped[b]=[]; grouped[b].push(c); });

  const checkedCount = Object.values(timelineChecks).filter(Boolean).length;

  const toggleTimeline = (id) =>
    saveDayOf({ ...dayOf, timelineChecks: { ...timelineChecks, [id]: !timelineChecks[id] } });

  const toggleItem = (id) =>
    saveDayOf({ ...dayOf, checklist: checklist.map(c => c.id===id ? {...c,done:!c.done} : c) });

  const handleSaveItem = (item) => {
    const next = editItem ? checklist.map(c => c.id===item.id ? item : c) : [...checklist, item];
    saveDayOf({ ...dayOf, checklist: next });
    setShowAddItem(false); setEditItem(null);
  };

  const handleDeleteItem = (id) =>
    saveDayOf({ ...dayOf, checklist: checklist.filter(c => c.id!==id) });

  // ── Print Brief handler ───────────────────────────────────────────────────
  const handlePrintBrief = () => {
    const html = generatePrintBriefHTML({
      adminConfig,
      timeline,
      households,
      people,
      vendors,
      expenses,
      tasks,
      ceremonyRoles,
    });
    setPrintHTML(html);
  };

  // ── Offline cache: write on successful data load ──────────────────────────
  const cachedData = useRef(null);
  if (!cachedData.current && eventId) {
    cachedData.current = readCache(eventId);
  }

  useEffect(() => {
    // Only cache when we have meaningful data loaded (successful fetch)
    if (!eventId || !timeline.length || (!vendors.length && !people.length)) return;
    const payload = {
      timeline,
      confirmedVendors,
      ceremonyRoles,
      confirmedPeople,
      dietaryPeople,
      kosherCount,
      totalConfirmed,
      totalInvited,
      eventName,
      eventDate,
      adminConfig,
    };
    writeCache(eventId, payload);
    cachedData.current = payload;
  }, [eventId, timeline, confirmedVendors, ceremonyRoles, confirmedPeople, dietaryPeople, kosherCount, totalConfirmed, totalInvited, eventName, eventDate, adminConfig]);

  // Determine if live data is still loading (hooks returned empty)
  const liveDataReady = timeline.length > 0 || vendors.length > 0 || people.length > 0;
  const effectiveData = liveDataReady ? {
    timeline, confirmedVendors, ceremonyRoles, confirmedPeople, dietaryPeople,
    kosherCount, totalConfirmed, totalInvited, eventName, eventDate, adminConfig,
  } : cachedData.current || {
    timeline, confirmedVendors, ceremonyRoles, confirmedPeople, dietaryPeople,
    kosherCount, totalConfirmed, totalInvited, eventName, eventDate, adminConfig,
  };

  // ── Mobile: render dedicated mobile layout ────────────────────────────────
  if (isMobile) {
    return (
      <>
      <MobileDayOf
        timeline={effectiveData.timeline}
        adminConfig={effectiveData.adminConfig}
        confirmedVendors={effectiveData.confirmedVendors}
        ceremonyRoles={effectiveData.ceremonyRoles}
        confirmedPeople={effectiveData.confirmedPeople}
        dietaryPeople={effectiveData.dietaryPeople}
        kosherCount={effectiveData.kosherCount}
        totalConfirmed={effectiveData.totalConfirmed}
        totalInvited={effectiveData.totalInvited}
        eventName={effectiveData.eventName}
        eventDate={effectiveData.eventDate}
        coPlanners={coPlanners}
        onClose={onClose}
      />
      {(showAddItem || editItem) && (
        <DayOfItemModal
          item={editItem}
          onSave={handleSaveItem}
          onClose={() => { setShowAddItem(false); setEditItem(null); }}
        />
      )}
      </>
    );
  }

  // ── Desktop: existing panel layout ────────────────────────────────────────
  return (
    <>
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dayof-panel" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="dayof-panel-header">
          <div>
            <div className="dayof-panel-title"><Icon name="clipboardList" context="menu" style={{ marginRight: 6 }} /> Day-of Mode</div>
            {eventDate && <div className="dayof-panel-meta">{eventDate}</div>}
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.2)", border:"1px solid rgba(255,255,255,0.35)", color:"#fff", padding:"5px 14px", borderRadius:"var(--radius-sm)", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"var(--font-body)" }}>
            <Icon name="x" context="inline" style={{ marginRight: 4 }} /> Close
          </button>
        </div>

        <div className="dayof-panel-body">

          {/* Print Brief */}
          <button onClick={handlePrintBrief} style={{ width:"100%", display:"flex", alignItems:"center", gap:12, background:"var(--accent-light)", border:"1px solid var(--accent-medium)", borderRadius:"var(--radius-md)", padding:"12px 16px", cursor:"pointer", textAlign:"left", fontFamily:"var(--font-body)", flexShrink:0 }}>
            <span style={{ fontSize:20, lineHeight:1, flexShrink:0 }}><Icon name="printer" context="button" /></span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:"var(--accent-primary)" }}>Print Event Brief</div>
              <div style={{ fontSize:11, color:"var(--accent-primary)", opacity:0.8, marginTop:1 }}>Generate a printable summary to share with your team</div>
            </div>
          </button>

          {/* 1. Timeline */}
          <div className="dayof-section">
            <div className="dayof-section-header">
              <div className="dayof-section-title"><Icon name="calendar" context="inline" style={{ marginRight: 6 }} /> Event Timeline</div>
              <div style={{ fontSize:11, color:"var(--text-muted)" }}>{checkedCount}/{timeline.length} confirmed</div>
            </div>
            {timeline.length === 0 ? (
              <div style={{ padding:"14px 16px", fontSize:13, color:"var(--text-muted)", fontStyle:"italic" }}>No timeline entries — add them in Admin Mode.</div>
            ) : timeline.map(entry => {
              const checked = !!timelineChecks[entry.id];
              const timeStr = formatTimeRange(entry.startTime, entry.endTime);
              return (
                <div key={entry.id} className={`dayof-timeline-row ${checked?"done":""}`} onClick={() => toggleTimeline(entry.id)}>
                  <div className={`dayof-check ${checked?"checked":""}`}>{checked?<Icon name="check" context="badge" />:""}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      {entry.icon && <span style={{ fontSize:15 }}>{entry.icon}</span>}
                      <span style={{ fontWeight:600, color:"var(--text-primary)", fontSize:13 }}>{entry.title}</span>
                      {entry.isMainEvent && <span style={{ fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:99, background:"var(--accent-light)", color:"var(--accent-primary)" }}>MAIN</span>}
                    </div>
                    {(timeStr || entry.venue) && (
                      <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:1 }}>{[timeStr, entry.venue].filter(Boolean).join(" · ")}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 2. Hot Sheet */}
          <div className="dayof-section">
            <div className="dayof-section-header"><div className="dayof-section-title"><Icon name="bellRing" context="inline" style={{ marginRight: 6 }} /> Hot Sheet</div></div>

            {/* Key numbers */}
            <div style={{ padding:"12px 14px", borderBottom:"1px solid var(--border)" }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", color:"var(--text-muted)", marginBottom:8 }}>Key Numbers</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {[
                  { label:"Confirmed", value:totalConfirmed, cls:"stat-green" },
                  { label:"Invited",   value:totalInvited,   cls:""           },
                  { label:"Kosher",    value:kosherCount,    cls:kosherCount>0?"stat-gold":"" },
                  { label:"Dietary",   value:dietaryPeople.length, cls:dietaryPeople.length>0?"stat-accent":"" },
                ].map(s => (
                  <div key={s.label} className="stat-card" style={{ padding:"8px 10px", textAlign:"center" }}>
                    <div className="stat-label">{s.label}</div>
                    <div className={`stat-value ${s.cls}`} style={{ fontSize:18 }}>{s.value}</div>
                  </div>
                ))}
              </div>
              {dietaryPeople.length > 0 && (
                <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:3 }}>
                  {dietaryPeople.map(p => {
                    const name = [p.firstName,p.lastName].filter(Boolean).join(" ") || p.name || "Guest";
                    const isConf = confirmedHHIds.has(p.householdId);
                    return (
                      <div key={p.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"4px 0", borderTop:"1px solid var(--border)", fontSize:12 }}>
                        <span style={{ fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:99, flexShrink:0, background:isConf?"var(--green-light)":"var(--gold-light)", color:isConf?"var(--green)":"var(--gold)" }}>{isConf?<Icon name="check" context="badge" />:"?"}</span>
                        <span style={{ fontWeight:600, color:"var(--text-primary)" }}>{name}</span>
                        <span style={{ color:"var(--orange)", marginLeft:"auto", fontSize:11 }}>{p.dietary}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Vendor contacts */}
            <div style={{ padding:"6px 14px 4px", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", color:"var(--text-muted)", borderBottom:"1px solid var(--border)", background:"var(--bg-page)" }}>Vendor Contacts</div>
            {confirmedVendors.length === 0 ? (
              <div style={{ padding:"12px 14px", fontSize:13, color:"var(--text-muted)", fontStyle:"italic" }}>No confirmed vendors yet.</div>
            ) : confirmedVendors.map(v => (
              <div key={v.id} className="dayof-hotsheet-row">
                <div style={{ flex:1, minWidth:0 }}>
                  <div className="dayof-hotsheet-name">{v.name}</div>
                  {v.contactName && <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:1 }}>{v.contactName}</div>}
                </div>
                {v.phone && (
                  <a href={`tel:${v.phone}`} className="dayof-hotsheet-phone" onClick={e => e.stopPropagation()}><Icon name="phone" context="badge" style={{ marginRight: 3 }} /> {v.phone}</a>
                )}
              </div>
            ))}
          </div>

          {/* 3. Ceremony Roles */}
          {ceremonyRoles.length > 0 && (
            <div className="dayof-section">
              <div className="dayof-section-header">
                <div className="dayof-section-title">✡ Ceremony Roles</div>
                <div style={{ fontSize:11, color:"var(--text-muted)" }}>{ceremonyRoles.filter(r=>r.assignee?.trim()).length}/{ceremonyRoles.length} assigned</div>
              </div>
              {(() => {
                const sections = [...new Set(ceremonyRoles.map(r=>r.section).filter(Boolean))];
                const sorted   = [...ceremonyRoles].sort((a,b) => (a.sortOrder??0)-(b.sortOrder??0));
                return sections.map(sec => {
                  const sectionRoles = sorted.filter(r => r.section===sec);
                  return (
                    <div key={sec}>
                      <div style={{ padding:"6px 14px", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", color:"var(--text-muted)", background:"var(--bg-subtle)", borderBottom:"1px solid var(--border)" }}>{sec}</div>
                      {sectionRoles.map(role => (
                        <div key={role.id} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"8px 14px", borderBottom:"1px solid var(--border)" }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:600, color:"var(--text-primary)" }}>{role.role}</div>
                            {role.hebrewName && <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:1 }}>{role.hebrewName}</div>}
                          </div>
                          <div style={{ fontSize:12, color:role.assignee?.trim()?"var(--accent-primary)":"var(--text-muted)", fontStyle:role.assignee?.trim()?"normal":"italic", fontWeight:role.assignee?.trim()?500:400, textAlign:"right", minWidth:100, flexShrink:0 }}>
                            {role.assignee?.trim() || "Unassigned"}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {/* 4. Day-of Checklist */}
          <div className="dayof-section">
            <div className="dayof-section-header">
              <div className="dayof-section-title"><Icon name="tasks" context="inline" style={{ marginRight: 6 }} /> Day-of Checklist</div>
              <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); setShowAddItem(true); }}>+ Add Item</button>
            </div>
            {checklist.length === 0 ? (
              <div style={{ padding:"16px 14px", textAlign:"center", color:"var(--text-muted)", fontSize:13 }}>
                <div style={{ marginBottom:4 }}>No checklist items yet.</div>
                <div style={{ fontSize:12 }}>Add items — vendor confirmations, setup checks, timing reminders.</div>
              </div>
            ) : DAY_OF_TIME_BLOCKS.map(block => {
              const items = grouped[block] || [];
              if (items.length === 0) return null;
              const done = items.filter(c => c.done).length;
              return (
                <div key={block}>
                  <div className="dayof-block-heading">{block} — {done}/{items.length}</div>
                  {items.map(c => (
                    <div key={c.id} className={`dayof-checklist-row ${c.done?"done":""}`}>
                      <div className={`dayof-check ${c.done?"checked":""}`} onClick={e => { e.stopPropagation(); toggleItem(c.id); }}>{c.done&&<Icon name="check" context="badge" />}</div>
                      <div className="dayof-task-text" onClick={e => { e.stopPropagation(); toggleItem(c.id); }}>{c.task}</div>
                      <div style={{ display:"flex", gap:3, flexShrink:0 }}>
                        <button className="icon-btn" style={{ width:26, height:26 }} onClick={e => { e.stopPropagation(); setEditItem(c); }}><Icon name="pencil" context="badge" /></button>
                        <button className="icon-btn" style={{ width:26, height:26 }} onClick={e => { e.stopPropagation(); handleDeleteItem(c.id); }}><Icon name="x" context="button" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* 5. Notes */}
          <div className="dayof-section">
            <div className="dayof-section-header">
              <div className="dayof-section-title"><Icon name="pencil" context="inline" style={{ marginRight: 6 }} /> Notes</div>
              <div style={{ fontSize:11, color:"var(--text-muted)" }}>Synced in real time</div>
            </div>
            <div style={{ padding:14 }}>
              <textarea className="form-textarea" style={{ width:"100%", minHeight:80, resize:"vertical" }}
                value={localNotes}
                onChange={e => handleNotesChange(e.target.value)}
                placeholder="Anything to remember on the day..."
                onClick={e => e.stopPropagation()} />
            </div>
          </div>

        </div>
      </div>
    </div>

    {/* Print Brief preview modal */}
    {printHTML && (
      <div className="modal-backdrop" style={{ zIndex: 1100 }} onMouseDown={e => { if (e.target === e.currentTarget) setPrintHTML(null); }}>
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: "var(--bg-surface)",
            borderRadius: "var(--radius-lg)",
            width: "95%",
            maxWidth: 960,
            height: "90vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {/* Preview header */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 20px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
            <div style={{ fontSize:17, fontWeight:700, color:"var(--text-primary)" }}>
              <Icon name="printer" context="inline" style={{ marginRight: 4 }} /> Print Event Brief
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button
                className="btn btn-primary"
                style={{ fontSize:12 }}
                onClick={() => {
                  const frame = printFrameRef.current;
                  if (frame && frame.contentWindow) frame.contentWindow.print();
                }}
              >
                <Icon name="printer" context="inline" style={{ marginRight: 4 }} /> Print / Save PDF
              </button>
              <button className="icon-btn" title="Close" onClick={() => setPrintHTML(null)}><Icon name="x" context="button" /></button>
            </div>
          </div>
          {/* Preview iframe */}
          <iframe
            ref={printFrameRef}
            srcDoc={printHTML}
            style={{ flex:1, border:"none", borderRadius:"0 0 var(--radius-lg) var(--radius-lg)" }}
            title="Event Brief Preview"
          />
        </div>
      </div>
    )}

    {(showAddItem || editItem) && (
      <DayOfItemModal
        item={editItem}
        onSave={handleSaveItem}
        onClose={() => { setShowAddItem(false); setEditItem(null); }}
      />
    )}
    </>
  );
}
