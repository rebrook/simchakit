// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — DayOfOverlay.jsx
// Ported from V2. Collections loaded via useEventData.
// dayOf config (checklist + timelineChecks) stored as single doc in supabase.
// Print Brief: fully self-contained — generates printable HTML, opens iframe
// preview modal. No AppShell involvement needed.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { supabase }           from "@/lib/supabase.js";
import { useEventData }       from "@/hooks/useEventData.js";
import { DAY_OF_TIME_BLOCKS } from "@/constants/events.js";
import { formatTimeRange, sortTimeline } from "@/utils/dates.js";

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
  const sectionHead = (emoji, title) =>
    `<div class="section-head"><span>${emoji}</span> ${title}</div>`;

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
      <td class="money ${vBalance > 0 ? "red" : ""}">${vBalance > 0 ? fmt$(vBalance) : "✓"}</td>
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
          <td><span class="${isConf ? "badge-green" : "badge-gold"}">${isConf ? "✓" : "?"}</span> ${name}</td>
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

${sectionHead("📅", "Event Timeline")}
${timeline.length === 0
  ? `<p class="meta">No timeline entries configured.</p>`
  : `<table><thead><tr><th style="width:36px"></th><th>Event</th><th style="width:130px">Date</th></tr></thead><tbody>${timelineRows}</tbody></table>`}

${sectionHead("👥", "Guest Summary")}
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

${sectionHead("🏪", "Confirmed Vendors")}
${confirmedVendors.length === 0
  ? `<p class="meta">No confirmed vendors.</p>`
  : `<table><thead><tr><th>Vendor</th><th>Type</th><th class="money">Total</th><th class="money">Paid</th><th class="money">Balance</th></tr></thead><tbody>${vendorRows}</tbody></table>`}
${unpaidExpenses.length > 0 ? `
<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#888;margin:12px 0 6px">Upcoming Payments</div>
<table><thead><tr><th>Description</th><th>Vendor</th><th>Due Date</th><th class="money">Amount</th></tr></thead><tbody>${unpaidRows}</tbody></table>
<p class="meta" style="text-align:right">Total budget: ${fmt$(totalBudget)} · Paid: ${fmt$(totalPaid)} · Outstanding: ${fmt$(totalBudget - totalPaid)}</p>
` : ""}

${sectionHead("✅", `Tasks — ${tasksDone} of ${tasksTotal} complete`)}
${overdueTasks.length > 0 ? `
<div class="sub-section-label">⚠ Overdue (${overdueTasks.length})</div>
<table><thead><tr><th style="width:20px"></th><th>Task</th><th>Category</th><th>Due</th></tr></thead><tbody>${taskRows(overdueTasks)}</tbody></table>
` : ""}
${upcomingTasks.length > 0 ? `
<div class="sub-section-label">Upcoming (${upcomingTasks.length})</div>
<table><thead><tr><th style="width:20px"></th><th>Task</th><th>Category</th><th>Due</th></tr></thead><tbody>${taskRows(upcomingTasks)}</tbody></table>
` : upcomingTasks.length === 0 && overdueTasks.length === 0 ? `<p class="meta">All tasks complete! 🎉</p>` : ""}

${ceremonyRoles.length > 0 ? `
${sectionHead("✡", `Ceremony Roles — ${ceremonyRoles.filter(r => r.assignee?.trim()).length} of ${ceremonyRoles.length} assigned`)}
${ceremonySection}
` : ""}

<div class="print-footer">SimchaKit · ${eventName} · ${new Date().toLocaleDateString()}</div>
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
          <button className="icon-btn" onClick={onClose}>✕</button>
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

// ── DayOfOverlay ──────────────────────────────────────────────────────────────
export function DayOfOverlay({ eventId, event, adminConfig, onClose, onPrintBrief }) {
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

  // Load dayOf config
  useEffect(() => {
    if (!eventId) return;
    async function load() {
      const { data: rows } = await supabase.from("dayof").select("id, data").eq("event_id", eventId).limit(1);
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
      const { data: rows } = await supabase.from("ceremony_roles").select("data").eq("event_id", eventId).limit(1);
      if (rows && rows.length > 0) setCeremonyRoles(rows[0].data?.roles || []);
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

  return (
    <>
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dayof-panel" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="dayof-panel-header">
          <div>
            <div className="dayof-panel-title">📋 Day-of Mode</div>
            {eventDate && <div className="dayof-panel-meta">{eventDate}</div>}
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.2)", border:"1px solid rgba(255,255,255,0.35)", color:"#fff", padding:"5px 14px", borderRadius:"var(--radius-sm)", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"var(--font-body)" }}>
            ✕ Close
          </button>
        </div>

        <div className="dayof-panel-body">

          {/* Print Brief */}
          <button onClick={handlePrintBrief} style={{ width:"100%", display:"flex", alignItems:"center", gap:12, background:"var(--accent-light)", border:"1px solid var(--accent-medium)", borderRadius:"var(--radius-md)", padding:"12px 16px", cursor:"pointer", textAlign:"left", fontFamily:"var(--font-body)", flexShrink:0 }}>
            <span style={{ fontSize:20, lineHeight:1, flexShrink:0 }}>🖨</span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:"var(--accent-primary)" }}>Print Event Brief</div>
              <div style={{ fontSize:11, color:"var(--accent-primary)", opacity:0.8, marginTop:1 }}>Generate a printable summary to share with your team</div>
            </div>
          </button>

          {/* 1. Timeline */}
          <div className="dayof-section">
            <div className="dayof-section-header">
              <div className="dayof-section-title">📅 Event Timeline</div>
              <div style={{ fontSize:11, color:"var(--text-muted)" }}>{checkedCount}/{timeline.length} confirmed</div>
            </div>
            {timeline.length === 0 ? (
              <div style={{ padding:"14px 16px", fontSize:13, color:"var(--text-muted)", fontStyle:"italic" }}>No timeline entries — add them in Admin Mode.</div>
            ) : timeline.map(entry => {
              const checked = !!timelineChecks[entry.id];
              const timeStr = formatTimeRange(entry.startTime, entry.endTime);
              return (
                <div key={entry.id} className={`dayof-timeline-row ${checked?"done":""}`} onClick={() => toggleTimeline(entry.id)}>
                  <div className={`dayof-check ${checked?"checked":""}`}>{checked?"✓":""}</div>
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
            <div className="dayof-section-header"><div className="dayof-section-title">🔥 Hot Sheet</div></div>

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
                        <span style={{ fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:99, flexShrink:0, background:isConf?"var(--green-light)":"var(--gold-light)", color:isConf?"var(--green)":"var(--gold)" }}>{isConf?"✓":"?"}</span>
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
                  <a href={`tel:${v.phone}`} className="dayof-hotsheet-phone" onClick={e => e.stopPropagation()}>📞 {v.phone}</a>
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
              <div className="dayof-section-title">✅ Day-of Checklist</div>
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
                      <div className={`dayof-check ${c.done?"checked":""}`} onClick={e => { e.stopPropagation(); toggleItem(c.id); }}>{c.done&&"✓"}</div>
                      <div className="dayof-task-text" onClick={e => { e.stopPropagation(); toggleItem(c.id); }}>{c.task}</div>
                      <div style={{ display:"flex", gap:3, flexShrink:0 }}>
                        <button className="icon-btn" style={{ width:26, height:26 }} onClick={e => { e.stopPropagation(); setEditItem(c); }}>✎</button>
                        <button className="icon-btn" style={{ width:26, height:26 }} onClick={e => { e.stopPropagation(); handleDeleteItem(c.id); }}>✕</button>
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
              <div className="dayof-section-title">📝 Notes</div>
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
            <div style={{ fontFamily:"var(--font-display)", fontSize:17, fontWeight:700, color:"var(--text-primary)" }}>
              🖨 Print Event Brief
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
                🖨 Print / Save PDF
              </button>
              <button className="icon-btn" title="Close" onClick={() => setPrintHTML(null)}>✕</button>
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
