// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3 — utils/focus.js
// Derives the "What Needs You Next" focus items for OverviewTab.
//
// Design rules:
//   - One row per domain max (tasks, payments, rsvps, seating, vendors, gifts).
//   - Sorted by urgency: red (overdue) > orange/gold (due soon) > accent (attention).
//   - Capped at 3 visible, with expandable overflow.
//   - Field names and status checks mirror computeSuggestions in tasks.js
//     so the two engines share vocabulary and don't drift.
//
// V4.34.0: once the main event's date has passed (see dates.js hasEventPassed,
// mirrored here as eventHasPassed since this file only has daysToEvent to work
// with), pre-event-only concerns stop being useful signals. Seating is fixed
// by then, and guests who hadn't RSVP'd or vendors who weren't booked already
// aren't actionable the same way anymore. The RSVP-gap and vendor-not-booked
// items were already gated to daysToEvent > 0, so they already stop on their
// own; seating gets that same gate added here. A new gift thank-you item
// surfaces in their place, since that is the thing actually left to do.
//
// V5.8.0 (V5-O1): items are typed and carry what the Overview needs to resolve
// them in place. type is "replies" | "unreplied" | "invoices" | "tasks" |
// "thankyous" | "nav". The first five are actions only an owner or editor can
// take (canAct), so they are left out for viewers and archived events; "nav"
// items only point at a tab and stay visible. Each item has one primary action
// (actionLabel). invoices, tasks and thankyous carry payload.rows so the card can
// list them and complete each one without leaving Overview; badge is the status
// word shown next to a shape, so urgency is never color alone.
//
// V5.8.1: urgency order is overdue invoices, overdue tasks, new replies, unreplied
// households near the deadline, tasks due this week, thank-yous. Items that finish
// in place are labeled with the verb ("Mark paid"); items that leave Overview end in
// an arrow ("Review replies →").
// ─────────────────────────────────────────────────────────────────────────────

import { getOpenPayments } from "./vendors.js";
import { getConfirmedPeopleForSection, getAwaitingSummary, describeAwaitingSections } from "./sections.js";
import { countThankYousOutstanding, getGiftGivers } from "./gifts.js";
import { unrepliedHouseholds, daysUntil } from "./rsvpReminders.js";
import { householdKey } from "./messageStatus.js";

// Items that leave Overview end in an arrow.
const NAV_LABEL = { addresses: "Add address", seating: "Open seating", vendors: "Open vendors", rsvps: "Open guests" };

const BOOKED_STATUSES = ["Booked", "Deposit Paid", "Paid in Full"];

/**
 * Compute focus items from event data.
 * Returns an array sorted by urgency, one per domain, uncapped (caller caps at 3).
 *
 * @param {Object} data — { tasks, expenses, people, households, vendors, tables, seatingRows, gifts }
 * @param {Object} adminConfig — event admin_config (timeline, etc.)
 * @returns {Array<FocusItem>}
 *
 * FocusItem shape:
 *   { id, domain, type, tone, badge, title, detail, tab, priority, actionLabel, payload? }
 *   tone: "red" | "gold" | "accent"
 *   priority: lower = more urgent
 */
export function computeFocusItems(data, adminConfig) {
  const {
    tasks = [],
    expenses = [],
    people = [],
    households = [],
    vendors = [],
    tables = [],
    seatingRows = [],
    gifts = [],
    pendingReplies = 0,
    repliedHouseholdIds = new Set(),   // households with a pending or accepted RSVP reply
    canAct = false,                    // owner/editor on a live event: may resolve items that change data
  } = data;

  const config = adminConfig || {};
  const now = new Date();
  const today = stripTime(now);
  const endOfWeek = getEndOfWeek(today);
  const mainEvent = (config.timeline || []).find(e => e.isMainEvent) || null;
  const eventDate = mainEvent?.startDate ? new Date(mainEvent.startDate + "T00:00:00") : null;
  const daysToEvent = eventDate ? Math.ceil((eventDate - today) / 86400000) : null;
  const eventHasPassed = daysToEvent !== null && daysToEvent < 0;

  const items = [];

  // ── New RSVP replies (V5-R3): always first, since a guest is waiting on the host ──
  if (pendingReplies > 0 && canAct) {
    items.push({
      id: "rsvp-replies",
      domain: "rsvp-replies",
      type: "replies",
      badge: "New",
      actionLabel: "Review",
      tone: "accent",
      icon: "mailCheck",
      title: `${pendingReplies} new RSVP repl${pendingReplies === 1 ? "y" : "ies"}`,
      detail: "Review and accept into the guest list",
      tab: "guests",
      priority: 2,
    });
  }

  // ── Tasks: one row per task, named, with its due date (V5.8.2) ──────────
  // Overdue first, then due this week. "Mark done" completes the task in place (with Undo).
  const activeTasks = tasks.filter(t => !t.done && !t.dismissed && t.due);
  const dayOf = (d) => new Date(d + "T00:00:00");
  const taskItem = (t, i, overdue) => {
    const late = Math.round((today - dayOf(t.due)) / 86400000);
    const title = truncate(t.task || t.title || "Untitled task", 80);
    return {
      id: `task:${t._rowId || t.id}`,
      domain: "tasks",
      type: "tasks",
      badge: overdue ? overdueBadge(late) : null,
      actionLabel: "Mark done",
      payload: { rows: [{ key: t._rowId || t.id, rowId: t._rowId, title, due: t.due, overdue }] },
      tone: overdue ? "red" : "accent",
      icon: overdue ? "alertTriangle" : "tasks",
      title,
      detail: `Due ${fmtShort(t.due)}`,
      tab: "tasks",
      priority: (overdue ? 1 : 4) + i / 1000,
    };
  };
  if (canAct) {
    const byDue = (a, b) => a.due.localeCompare(b.due);
    activeTasks.filter(t => dayOf(t.due) < today).sort(byDue).forEach((t, i) => items.push(taskItem(t, i, true)));
    activeTasks.filter(t => dayOf(t.due) >= today && dayOf(t.due) <= endOfWeek).sort(byDue).forEach((t, i) => items.push(taskItem(t, i, false)));
  }

  // ── Payments: one row per invoice that is overdue or due within 14 days ───
  // V4.38.2: built from getOpenPayments() so a scheduled expense is judged by its own
  // installment dates, the same rule as the Budget tab's Overdue tag and nav badge.
  // V5.8.2: each row names the invoice (what, amount, due date). "Open invoice" opens its
  // detail under the list, where Mark paid lives.
  const openPayments = expenses.flatMap(e => getOpenPayments(e).map(p => ({ ...p, expense: e })));
  const dueOn = p => dayOf(p.dueDate);
  const inTwoWeeks = new Date(today.getTime() + 14 * 86400000);
  if (canAct) {
    openPayments
      .filter(p => dueOn(p) <= inTwoWeeks)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .forEach((p, i) => {
        const overdue = dueOn(p) < today;
        const late = Math.round((today - dueOn(p)) / 86400000);
        const what = truncate(p.expense.description || p.expense.vendor || "Payment", 50) + (p.label ? ` – ${p.label}` : "");
        const vendor = vendors.find(v => v.id === p.expense.vendorId)?.name || p.expense.vendor || "";
        const key = `${p.expense._rowId || p.expense.id}:${p.id || "single"}`;
        items.push({
          id: `invoice:${key}`,
          domain: "payments",
          type: "invoices",
          badge: overdue ? overdueBadge(late) : null,
          actionLabel: "Record payment",
          payload: { rows: [{ key, rowId: p.expense._rowId, paymentId: p.id || null, title: what, vendor, amount: p.amount, dueDate: p.dueDate, overdue }] },
          tone: overdue ? "red" : "accent",
          icon: overdue ? "alertTriangle" : "banknote",
          title: `${what} · $${(Number(p.amount) || 0).toLocaleString()}`,
          detail: `${vendor ? `${vendor} · ` : ""}Due ${fmtShort(p.dueDate)}`,
          tab: "budget",
          priority: (overdue ? 0 : 3.5) + i / 1000,
        });
      });
  }

  // ── Gift thank-yous outstanding (post-event only) ───────────────────────
  // Once the event has passed, writing and mailing thank-yous is one of the few things left
  // to do, and it has no deadline of its own, so it needs its own signal here.
  // V4.38.0: a note counts as outstanding until it is both written AND mailed, using the
  // shared countThankYousOutstanding() so the Gifts nav badge reads the same number.
  // V5.8.2: the title is the count (the one place a bare count is right) and the button opens
  // the Gifts tab filtered to notes still to write. There is no bulk "mark written" here.
  if (eventHasPassed && gifts.length > 0 && canAct) {
    const { total, toWrite, toMail } = countThankYousOutstanding(gifts);
    if (total > 0) {
      const writing = toWrite > 0;
      const n = writing ? toWrite : toMail;
      items.push({
        id: "gift-thankyous",
        domain: "gifts",
        type: "thankyous",
        actionLabel: writing ? "Write thank-yous" : "Mail thank-yous",
        giftsFilter: writing ? "needs-written" : "needs-mailed",
        tone: "accent",
        icon: "gifts",
        title: `${n} thank-you note${n !== 1 ? "s" : ""} to ${writing ? "write" : "mail"}`,
        detail: writing
          ? (toMail > 0 ? `${toMail} more written and waiting to be mailed` : "Gifts received, none marked written yet")
          : "Written, waiting to be mailed",
        tab: "gifts",
        priority: 5,
      });
    }
  }

  // ── Households that haven't replied (V5-R4) ─────────────────────────────
  // With an RSVP deadline set, this one card replaces the older "guests awaiting RSVP" row: it
  // names the households (the same set the composer preselects for a reminder) and the deadline.
  let reminderShown = false;
  const rsvpDeadline = config.rsvpDeadline;
  const daysToDeadline = daysUntil(rsvpDeadline, now);
  if (!eventHasPassed && daysToDeadline !== null && households.length > 0) {
    const unreplied = unrepliedHouseholds(households, people, config.timeline || [], repliedHouseholdIds);
    if (unreplied.length > 0) {
      reminderShown = true;
      const n = unreplied.length;
      items.push({
        id: "rsvp-reminder",
        domain: "rsvps",
        type: canAct ? "unreplied" : "nav",   // viewers get a plain link to the Guests tab
        tone: daysToDeadline <= 7 ? "gold" : "accent",
        icon: "mailCheck",
        title: `${n} household${n !== 1 ? "s haven't" : " hasn't"} replied`,
        detail: daysToDeadline > 1 ? `Deadline in ${daysToDeadline} days` : daysToDeadline === 1 ? "Deadline is tomorrow" : daysToDeadline === 0 ? "Deadline is today" : `Deadline passed ${Math.abs(daysToDeadline)} day${Math.abs(daysToDeadline) !== 1 ? "s" : ""} ago`,
        tab: "guests",
        priority: daysToDeadline <= 7 ? 3 : 5.5,
        actionLabel: canAct ? "Send reminder" : "View guests",
        compose: { kind: "rsvp_reminder", ids: unreplied.map(householdKey) },
      });
    }
  }

  // ── RSVP gap (only surface when event is within 60 days) ────────────────
  // Uses household rsvpStatus to identify non-responders. Counts people (not
  // households) to match the RSVP stat card unit. Excludes declined.
  if (!reminderShown && daysToEvent !== null && daysToEvent <= 60 && daysToEvent > 0 && people.length > 0) {
    const RESPONDED = new Set(["RSVP Yes", "RSVP No"]);
    const hhStatusMap = new Map(households.map(h => [h.id, h.rsvpStatus || "Invited"]));
    const awaitingPeople = people.filter(p => {
      const status = hhStatusMap.get(p.householdId) || "Invited";
      return !RESPONDED.has(status);
    });
    const respondedCount = people.length - awaitingPeople.length;
    if (awaitingPeople.length > 0) {
      items.push({
        id: "rsvps",
        domain: "rsvps",
        tone: "accent",
        icon: "guests",
        title: `${awaitingPeople.length} guest${awaitingPeople.length !== 1 ? "s" : ""} awaiting RSVP`,
        detail: `${respondedCount} of ${people.length} responded with ${daysToEvent} day${daysToEvent !== 1 ? "s" : ""} to go`,
        tab: "guests",
        priority: 6,
      });
    } else {
      // V4.41.0: every household has answered, but individual guests can still
      // be unset for a sub-event (a household Yes with one member TBD). One
      // rsvps row per domain, so this only appears when the household-level
      // row above does not.
      const summary = getAwaitingSummary(households, people, config.timeline || []);
      const n = summary.all.length;
      if (n > 0) {
        items.push({
          id: "rsvps",
          domain: "rsvps",
          tone: "accent",
          icon: "guests",
          title: `${n} guest${n !== 1 ? "s" : ""} still need${n === 1 ? "s" : ""} to answer`,
          detail: truncate(`${describeAwaitingSections(summary.bySection)}, ${daysToEvent} day${daysToEvent !== 1 ? "s" : ""} to go`, 60),
          tab: "guests",
          priority: 6,
        });
      }
    }
  }

  // ── Seating gap (subsumes the standalone banner) ────────────────────────
  // Suppressed once the event has passed, since seating is fixed by then,
  // and a leftover "more seats needed" nudge about an event that already
  // happened is just noise.
  const seatingCfg = seatingRows[0] || {};
  const hasSeat = !!seatingCfg.hasSeating;
  const sections = seatingCfg.enabledSections || (seatingCfg.eventSectionId ? [seatingCfg.eventSectionId] : []);

  if (!eventHasPassed && hasSeat && sections.length > 0 && tables.length > 0) {
    let worstGap = 0;
    let worstLabel = "";
    let totalGap = 0;

    sections.forEach(sid => {
      const sectionTables = tables.filter(t =>
        t.sectionId === sid || (sections.length === 1 && !t.sectionId)
      );
      const totalSeats = sectionTables.reduce((s, t) => s + (parseInt(t.capacity) || 0), 0);
      // Each guest's own Yes for this sub-event (sectionRsvp, V4.28.0+).
      const confirmed = getConfirmedPeopleForSection(people, { id: sid }).length;
      const gap = confirmed - totalSeats;
      if (gap > 0) {
        totalGap += gap;
        if (gap > worstGap) {
          worstGap = gap;
          const entry = (config.timeline || []).find(e => e.id === sid);
          worstLabel = entry?.title || sid;
        }
      }
    });

    if (totalGap > 0) {
      items.push({
        id: "seating",
        domain: "seating",
        tone: "accent",
        icon: "seating",
        title: `${worstLabel} is ${worstGap} seat${worstGap !== 1 ? "s" : ""} short`,
        detail: sections.length > 1 && totalGap > worstGap
          ? `${totalGap} seats short across all events`
          : "More confirmed guests than seats at your tables",
        tab: "seating",
        priority: 7,
      });
    }
  }

  // ── Unbooked vendors (only surface when event is within 90 days) ────────
  if (daysToEvent !== null && daysToEvent <= 90 && daysToEvent > 0) {
    const unbooked = vendors.filter(v => !BOOKED_STATUSES.includes(v.status));
    if (unbooked.length > 0 && vendors.length > 0) {
      items.push({
        id: "vendors",
        domain: "vendors",
        tone: "accent",
        icon: "vendors",
        title: unbooked.length === 1
          ? `${truncate(unbooked[0].name || "Unnamed vendor", 50)} is not booked yet`
          : `${truncate(unbooked[0].name || "A vendor", 40)} and ${unbooked.length - 1} more not booked yet`,
        detail: `${daysToEvent} day${daysToEvent !== 1 ? "s" : ""} to go`,
        tab: "vendors",
        priority: 8,
      });
    }
  }

  // ── Guests missing addresses ────────────────────────────────────────────
  if (households.length > 0) {
    const missingAddr = households.filter(h => !h.address1 || !h.address1.trim());
    if (missingAddr.length > 0) {
      items.push({
        id: "addresses",
        domain: "addresses",
        tone: "accent",
        icon: "guests",
        title: missingAddr.length === 1
          ? (() => { const nm = truncate(missingAddr[0].formalName || missingAddr[0].name || "A household", 60); return `${nm} ${/\band\b|&/i.test(nm) ? "need" : "needs"} an address`; })()
          : `${truncate(missingAddr[0].formalName || missingAddr[0].name || "A household", 50)} and ${missingAddr.length - 1} more need addresses`,
        detail: eventHasPassed ? "Needed for the thank-you mailing" : "Needed for invitations and mailings",
        tab: "guests",
        priority: 9,
      });
    }
  }

  // Items that only point at a tab are typed "nav", with one action: open that tab.
  items.forEach(it => {
    if (!it.type) it.type = "nav";
    if (it.type === "nav" && !it.actionLabel) it.actionLabel = NAV_LABEL[it.id] || `Open ${it.tab}`;
  });

  // Sort by priority (lower = more urgent)
  items.sort((a, b) => a.priority - b.priority);

  return items;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function stripTime(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getEndOfWeek(today) {
  const day = today.getDay(); // 0=Sun
  const daysUntilSun = day === 0 ? 0 : 7 - day;
  return new Date(today.getTime() + daysUntilSun * 86400000);
}

function fmtShort(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// "Overdue 18 days": a badge that carries information the title does not.
function overdueBadge(days) {
  return days <= 0 ? "Overdue" : `Overdue ${days} day${days !== 1 ? "s" : ""}`;
}

function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max - 1) + "\u2026" : str;
}

/**
 * The next dated thing coming up, for the empty state's link: the earliest open task or
 * payment that is not already a "Needs you now" item. Returns { text, tab } or null.
 */
export function computeNextUp({ tasks = [], expenses = [] }) {
  const today = stripTime(new Date());
  const fmt = d => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const cands = [];
  tasks.filter(t => !t.done && !t.dismissed && t.due && new Date(t.due + "T00:00:00") >= today)
    .forEach(t => cands.push({ date: t.due, text: `${truncate(t.task || t.title || "Task", 40)}, due ${fmt(t.due)}`, tab: "tasks" }));
  expenses.forEach(e => getOpenPayments(e)
    .filter(p => new Date(p.dueDate + "T00:00:00") >= today)
    .forEach(p => cands.push({ date: p.dueDate, text: `${truncate(e.description || e.vendor || "Payment", 40)}, due ${fmt(p.dueDate)}`, tab: "budget" })));
  cands.sort((a, b) => a.date.localeCompare(b.date));
  return cands[0] || null;
}
