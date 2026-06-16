// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3 — utils/focus.js
// Derives the "What Needs You Next" focus items for OverviewTab.
//
// Design rules:
//   - One row per domain max (tasks, payments, rsvps, seating, vendors).
//   - Sorted by urgency: red (overdue) > orange/gold (due soon) > accent (attention).
//   - Capped at 3 visible, with expandable overflow.
//   - Field names and status checks mirror computeSuggestions in tasks.js
//     so the two engines share vocabulary and don't drift.
// ─────────────────────────────────────────────────────────────────────────────

const BOOKED_STATUSES = ["Booked", "Deposit Paid", "Paid in Full"];

/**
 * Compute focus items from event data.
 * Returns an array sorted by urgency, one per domain, uncapped (caller caps at 3).
 *
 * @param {Object} data — { tasks, expenses, people, households, vendors, tables, seatingRows }
 * @param {Object} adminConfig — event admin_config (timeline, etc.)
 * @returns {Array<FocusItem>}
 *
 * FocusItem shape:
 *   { id, domain, tone, title, detail, tab, priority }
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
  } = data;

  const config = adminConfig || {};
  const now = new Date();
  const today = stripTime(now);
  const endOfWeek = getEndOfWeek(today);
  const mainEvent = (config.timeline || []).find(e => e.isMainEvent) || null;
  const eventDate = mainEvent?.startDate ? new Date(mainEvent.startDate + "T00:00:00") : null;
  const daysToEvent = eventDate ? Math.ceil((eventDate - today) / 86400000) : null;

  const items = [];

  // ── Tasks (collapsed: pick the most urgent signal) ──────────────────────
  const activeTasks = tasks.filter(t => !t.done && !t.dismissed);
  const overdueTasks = activeTasks.filter(t => t.due && new Date(t.due + "T00:00:00") < today);
  const dueThisWeek = activeTasks.filter(t => {
    if (!t.due) return false;
    const d = new Date(t.due + "T00:00:00");
    return d >= today && d <= endOfWeek;
  });

  if (overdueTasks.length > 0) {
    items.push({
      id: "tasks",
      domain: "tasks",
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
      tone: "gold",
      icon: "tasks",
      title: `${dueThisWeek.length} task${dueThisWeek.length !== 1 ? "s" : ""} due this week`,
      detail: dueThisWeek.length === 1
        ? truncate(dueThisWeek[0].task || dueThisWeek[0].title || "Untitled task", 60)
        : `Next: ${truncate(dueThisWeek[0].task || dueThisWeek[0].title || "Untitled", 40)}`,
      tab: "tasks",
      priority: 3,
    });
  }

  // ── Payments due soon (unpaid expenses with dueDate in next 14 days) ────
  const unpaidWithDue = expenses.filter(e => !e.paid && e.dueDate);
  const overduePayments = unpaidWithDue.filter(e => new Date(e.dueDate + "T00:00:00") < today);
  const upcomingPayments = unpaidWithDue.filter(e => {
    const d = new Date(e.dueDate + "T00:00:00");
    return d >= today && d <= new Date(today.getTime() + 14 * 86400000);
  });

  if (overduePayments.length > 0) {
    const total = overduePayments.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    items.push({
      id: "payments",
      domain: "payments",
      tone: "red",
      icon: "alertTriangle",
      title: `$${total.toLocaleString()} in overdue payments`,
      detail: overduePayments.length === 1
        ? truncate(overduePayments[0].description || overduePayments[0].vendor || "Payment", 60)
        : `${overduePayments.length} payment${overduePayments.length !== 1 ? "s" : ""} past due`,
      tab: "budget",
      priority: 2,
    });
  } else if (upcomingPayments.length > 0) {
    const total = upcomingPayments.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const soonest = upcomingPayments.sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    const daysOut = Math.ceil((new Date(soonest.dueDate + "T00:00:00") - today) / 86400000);
    items.push({
      id: "payments",
      domain: "payments",
      tone: "gold",
      icon: "banknote",
      title: `$${total.toLocaleString()} due within 2 weeks`,
      detail: daysOut <= 1
        ? `${truncate(soonest.description || soonest.vendor || "Payment", 40)} due tomorrow`
        : `${truncate(soonest.description || soonest.vendor || "Payment", 40)} due in ${daysOut} days`,
      tab: "budget",
      priority: 4,
    });
  }

  // ── RSVP gap (only surface when event is within 60 days) ────────────────
  // Uses household rsvpStatus to identify non-responders. Counts people (not
  // households) to match the RSVP stat card unit. Excludes declined.
  if (daysToEvent !== null && daysToEvent <= 60 && daysToEvent > 0 && people.length > 0) {
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
        priority: 5,
      });
    }
  }

  // ── Seating gap (subsumes the standalone banner) ────────────────────────
  const seatingCfg = seatingRows[0] || {};
  const hasSeat = !!seatingCfg.hasSeating;
  const sections = seatingCfg.enabledSections || (seatingCfg.eventSectionId ? [seatingCfg.eventSectionId] : []);

  if (hasSeat && sections.length > 0 && tables.length > 0) {
    let worstGap = 0;
    let worstLabel = "";
    let totalGap = 0;

    sections.forEach(sid => {
      const sectionTables = tables.filter(t =>
        t.sectionId === sid || (sections.length === 1 && !t.sectionId)
      );
      const totalSeats = sectionTables.reduce((s, t) => s + (parseInt(t.capacity) || 0), 0);
      const confirmed = people.filter(p => (p.attendingSections || []).includes(sid)).length;
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
        priority: 6,
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
        priority: 7,
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
        priority: 8,
      });
    }
  }

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
