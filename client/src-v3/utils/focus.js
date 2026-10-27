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
const NAV_LABEL = { addresses: "Add addresses \u2192", seating: "Open seating \u2192", vendors: "Open vendors \u2192", rsvps: "Open guests \u2192" };

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
      actionLabel: "Review replies \u2192",
      tone: "accent",
      icon: "mailCheck",
      title: `${pendingReplies} new RSVP repl${pendingReplies === 1 ? "y" : "ies"}`,
      detail: "Review and accept into the guest list",
      tab: "guests",
      priority: 2,
    });
  }

  // ── Tasks (collapsed: pick the most urgent signal) ──────────────────────
  const activeTasks = tasks.filter(t => !t.done && !t.dismissed);
  const overdueTasks = activeTasks.filter(t => t.due && new Date(t.due + "T00:00:00") < today);
  const dueThisWeek = activeTasks.filter(t => {
    if (!t.due) return false;
    const d = new Date(t.due + "T00:00:00");
    return d >= today && d <= endOfWeek;
  });

  const taskRow = (t) => ({
    key: t.id || t._rowId,
    rowId: t._rowId,
    title: truncate(t.task || t.title || "Untitled task", 80),
    due: t.due,
    overdue: new Date(t.due + "T00:00:00") < today,
  });
  const taskRows = [...overdueTasks, ...dueThisWeek].sort((a, b) => a.due.localeCompare(b.due)).map(taskRow);

  if (!canAct) {
    // viewers and archived events cannot complete tasks, so there is nothing to act on here
  } else if (overdueTasks.length > 0) {
    items.push({
      id: "tasks",
      domain: "tasks",
      type: "tasks",
      badge: "Overdue",
      actionLabel: "Mark done",
      payload: { rows: taskRows },
      tone: "red",
      icon: "alertTriangle",
      title: `${overdueTasks.length} task${overdueTasks.length !== 1 ? "s" : ""} overdue`,
      detail: overdueTasks.length === 1
        ? truncate(overdueTasks[0].task || overdueTasks[0].title || "Untitled task", 60)
        : `Oldest: ${truncate(overdueTasks[0].task || overdueTasks[0].title || "Untitled", 40)}`,
      tab: "tasks",
      priority: 1,
    });
  } else if (dueThisWeek.length > 0) {
    items.push({
      id: "tasks",
      domain: "tasks",
      type: "tasks",
      badge: "This week",
      actionLabel: "Mark done",
      payload: { rows: taskRows },
      tone: "gold",
      icon: "tasks",
      title: `${dueThisWeek.length} task${dueThisWeek.length !== 1 ? "s" : ""} due this week`,
      detail: dueThisWeek.length === 1
        ? truncate(dueThisWeek[0].task || dueThisWeek[0].title || "Untitled task", 60)
        : `Next: ${truncate(dueThisWeek[0].task || dueThisWeek[0].title || "Untitled", 40)}`,
      tab: "tasks",
      priority: 4,
    });
  }

  // ── Payments (overdue, or due within the next 14 days) ──────────────────
  // V4.38.2: built from getOpenPayments() so a scheduled expense is judged by
  // its own installment dates, the same rule as the Budget tab's Overdue tag
  // and the Budget nav badge (previously only the expense's own dueDate was
  // read, so a late installment on a scheduled expense could be missed). The
  // dollar figures now sum only the late or imminent installments, not the
  // expense's whole remaining balance.
  const openPayments = expenses.flatMap(e => getOpenPayments(e).map(p => ({ ...p, expense: e })));
  const dueOn = p => new Date(p.dueDate + "T00:00:00");
  const overdueOpen = openPayments.filter(p => dueOn(p) < today);
  const upcomingOpen = openPayments.filter(p => {
    const d = dueOn(p);
    return d >= today && d <= new Date(today.getTime() + 14 * 86400000);
  });
  const paymentRow = (p) => ({
    key: `${p.expense._rowId || p.expense.id}:${p.id || "single"}`,
    rowId: p.expense._rowId,
    paymentId: p.id || null,
    title: truncate(p.expense.description || p.expense.vendor || "Payment", 60),
    vendor: vendors.find(v => v.id === p.expense.vendorId)?.name || p.expense.vendor || "",
    label: p.label || "",
    amount: p.amount,
    dueDate: p.dueDate,
    overdue: dueOn(p) < today,
  });
  const paymentRows = (list) => [...list].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(paymentRow);

  if (!canAct) {
    // marking payments paid changes data: not offered to viewers or on archived events
  } else if (overdueOpen.length > 0) {
    const total = overdueOpen.reduce((s, p) => s + p.amount, 0);
    const n = overdueOpen.length;
    items.push({
      id: "payments",
      domain: "payments",
      type: "invoices",
      badge: "Overdue",
      actionLabel: "Mark paid",
      payload: { rows: paymentRows(overdueOpen) },
      tone: "red",
      icon: "alertTriangle",
      title: `${n} invoice${n !== 1 ? "s" : ""} overdue`,
      detail: `$${total.toLocaleString()} total`,
      tab: "budget",
      priority: 0,
    });
  } else if (upcomingOpen.length > 0) {
    const total = upcomingOpen.reduce((s, p) => s + p.amount, 0);
    const soonest = [...upcomingOpen].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    const name = truncate(soonest.expense.description || soonest.expense.vendor || "Payment", 40);
    const daysOut = Math.ceil((dueOn(soonest) - today) / 86400000);
    items.push({
      id: "payments",
      domain: "payments",
      type: "invoices",
      badge: "Due soon",
      actionLabel: "Mark paid",
      payload: { rows: paymentRows(upcomingOpen) },
      tone: "gold",
      icon: "banknote",
      title: `$${total.toLocaleString()} due within 2 weeks`,
      // A payment due today used to read "due tomorrow" (the check was daysOut <= 1).
      detail: daysOut <= 0
        ? `${name} due today`
        : daysOut === 1
          ? `${name} due tomorrow`
          : `${name} due in ${daysOut} days`,
      tab: "budget",
      priority: 3.5,
    });
  }

  // ── Gift thank-yous outstanding (post-event only) ───────────────────────
  // Once the event has passed, writing and mailing thank-yous is one of the
  // few things actually left to do, and it has no natural deadline of its own
  // the way a task or a payment does, so it needs its own signal here.
  // Priority 2.5 slots it between overdue payments and this-week tasks: real,
  // but not as urgent as something with an actual overdue date attached.
  // V4.38.0: a note counts as outstanding until it is both written AND
  // mailed (previously only unwritten notes counted), using the shared
  // countThankYousOutstanding() so the Gifts nav badge reads the same number.
  if (eventHasPassed && gifts.length > 0 && canAct) {
    const { total, toWrite, toMail } = countThankYousOutstanding(gifts);
    if (total > 0) {
      const rows = gifts.flatMap(g => getGiftGivers(g)
        .filter(gv => !gv.thankYouWritten || !gv.thankYouMailed)
        .map(gv => ({
          key: `${g._rowId || g.id}:${gv.id}`,
          giftRowId: g._rowId,
          giverId: gv.id,
          title: truncate(gv.name || "Unnamed giver", 60),
          gift: truncate(g.description || g.items?.[0]?.description || "", 50),
          stage: gv.thankYouWritten ? "mail" : "write",
        })));
      items.push({
        id: "gift-thankyous",
        domain: "gifts",
        type: "thankyous",
        badge: "Owed",
        actionLabel: rows.some(r => r.stage === "write") ? "Mark written" : "Mark mailed",
        payload: { rows },
        tone: "accent",
        icon: "gifts",
        title: `${total} thank-you note${total !== 1 ? "s" : ""} outstanding`,
        detail: [
          toWrite > 0 ? `${toWrite} to write` : null,
          toMail  > 0 ? `${toMail} to mail`  : null,
        ].filter(Boolean).join(", "),
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
        badge: daysToDeadline <= 7 ? "Due soon" : "Open",
        tone: daysToDeadline <= 7 ? "gold" : "accent",
        icon: "mailCheck",
        title: `${n} household${n !== 1 ? "s haven't" : " hasn't"} replied`,
        detail: daysToDeadline > 1 ? `Deadline in ${daysToDeadline} days` : daysToDeadline === 1 ? "Deadline is tomorrow" : daysToDeadline === 0 ? "Deadline is today" : `Deadline passed ${Math.abs(daysToDeadline)} day${Math.abs(daysToDeadline) !== 1 ? "s" : ""} ago`,
        tab: "guests",
        priority: daysToDeadline <= 7 ? 3 : 5.5,
        actionLabel: canAct ? "Send reminder \u2192" : "View guests \u2192",
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
        title: `${totalGap} more seat${totalGap !== 1 ? "s" : ""} needed`,
        detail: sections.length > 1
          ? `Largest gap in ${worstLabel} (${worstGap} seat${worstGap !== 1 ? "s" : ""})`
          : `${worstLabel}: ${worstGap} seat${worstGap !== 1 ? "s" : ""} short`,
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
        title: `${unbooked.length} vendor${unbooked.length !== 1 ? "s" : ""} not yet booked`,
        detail: unbooked.length === 1
          ? truncate(unbooked[0].name || "Unnamed vendor", 60)
          : `${unbooked.slice(0, 2).map(v => v.name || "Unnamed").join(", ")}${unbooked.length > 2 ? ", ..." : ""}`,
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
        title: `${missingAddr.length} household${missingAddr.length !== 1 ? "s" : ""} missing address`,
        detail: missingAddr.length === 1
          ? truncate(missingAddr[0].name || missingAddr[0].formalName || "Unnamed household", 60)
          : `${missingAddr.length} of ${households.length} households have no address on file`,
        tab: "guests",
        priority: 9,
      });
    }
  }

  // Items that only point at a tab are typed "nav", with one action: open that tab.
  items.forEach(it => {
    if (!it.type) { it.type = "nav"; it.badge = it.badge || "To do"; }
    if (it.type === "nav" && !it.actionLabel) it.actionLabel = NAV_LABEL[it.id] || `Open ${it.tab} \u2192`;
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
