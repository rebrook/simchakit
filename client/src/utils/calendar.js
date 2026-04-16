import { sortTimeline, formatEntryMeta } from "./dates.js";
import { fmt$ } from "./vendors.js";

// Calendar event builder — aggregates all collections into calendar entries

function buildCalendarEvents(state, adminConfig, showCompleted) {
  const events    = [];
  const today     = new Date(); today.setHours(0,0,0,0);
  const tasks     = (state?.tasks    || []).filter(t => !t.dismissed);
  const expenses  = state?.expenses  || [];
  const vendors   = state?.vendors   || [];
  const prep      = state?.prep      || [];
  const timeline  = adminConfig?.timeline || [];

  const diff = (dateStr) =>
    Math.ceil((new Date(dateStr+"T00:00:00") - today) / (1000*60*60*24));

  const badge = (d) => {
    if (d < 0)  return { label:`Overdue ${Math.abs(d)}d`, cls:"cal-badge-overdue"  };
    if (d === 0) return { label:"Today",                   cls:"cal-badge-soon"    };
    if (d <= 14) return { label:`${d}d`,                   cls:"cal-badge-soon"    };
    return               { label:`${d}d`,                  cls:"cal-badge-future"  };
  };

  // Helper: returns true if a task already covers this title
  // Mirrors the alreadyHasTask logic in computeSuggestions
  const taskCovers = (title) =>
    tasks.some(t => (t.task || "").toLowerCase().includes((title || "").toLowerCase()));

  // ── Timeline events ────────────────────────────────────────────────────────
  sortTimeline(timeline).forEach(e => {
    if (!e.startDate) return;
    events.push({
      id:        `tl-${e.id||e.title}`,
      source:    "timeline",
      date:      e.startDate,
      title:     e.title || "Event",
      meta:      formatEntryMeta(e) + (e.venue ? ` · ${e.venue}` : ""),
      icon:      e.icon || "📅",
      isMain:    !!e.isMainEvent,
      diff:      diff(e.startDate),
      tab:       "overview",
      itemId:    null,
    });
  });

  // ── Tasks ──────────────────────────────────────────────────────────────────
  tasks.filter(t => t.due && (showCompleted || !t.done)).forEach(t => {
    const d = diff(t.due);
    events.push({
      id:     `task-${t.id}`,
      source: "task",
      date:   t.due,
      title:  t.task || "Task",
      meta:   t.category || "",
      icon:   t.done ? "✅" : "✓",
      done:   t.done,
      badge:  t.done ? null : badge(d),
      diff:   d,
      tab:    "tasks",
      itemId: t.id,
    });
  });

  // ── Payments (unpaid expenses with due dates) ──────────────────────────────
  expenses.filter(e => e.dueDate && (showCompleted || !e.paid)).forEach(e => {
    const d = diff(e.dueDate);
    const amt = parseFloat(e.amount) || 0;
    events.push({
      id:     `pay-${e.id}`,
      source: "payment",
      date:   e.dueDate,
      title:  e.description || "Payment",
      meta:   `${e.vendor || e.category || ""}${amt > 0 ? ` · ${fmt$(amt)}` : ""}`,
      icon:   e.paid ? "💳" : "💰",
      done:   e.paid,
      badge:  e.paid ? null : badge(d),
      diff:   d,
      tab:    "budget",
      itemId: e.id,
    });
  });

  // ── Vendor milestones ──────────────────────────────────────────────────────
  // Only shown when no task already covers the milestone title (Option A + fallback)
  vendors.forEach(v => {
    (v.milestones || []).forEach(m => {
      if (!m.date) return;
      if (taskCovers(m.title)) return;
      const d = diff(m.date);
      events.push({
        id:     `ms-${v.id}-${m.id}`,
        source: "milestone",
        date:   m.date,
        title:  m.title || "Milestone",
        meta:   v.name + (m.notes ? ` · ${m.notes}` : ""),
        icon:   "📌",
        done:   false,
        badge:  badge(d),
        diff:   d,
        tab:    "vendors",
        itemId: v.id,
      });
    });
  });

  // ── Prep target dates ──────────────────────────────────────────────────────
  // Only shown when no task already covers the prep item title (Option A + fallback)
  prep.filter(p => p.targetDate && (showCompleted || p.status !== "Complete")).forEach(p => {
    if (taskCovers(p.title)) return;
    const d = diff(p.targetDate);
    events.push({
      id:     `prep-${p.id}`,
      source: "prep",
      date:   p.targetDate,
      title:  p.title || "Prep item",
      meta:   `${p.category || ""}${p.status ? ` · ${p.status}` : ""}`,
      icon:   p.status === "Complete" ? "📗" : "📖",
      done:   p.status === "Complete",
      badge:  p.status === "Complete" ? null : badge(d),
      diff:   d,
      tab:    "prep",
      itemId: p.id,
    });
  });

  // Sort by date, then by diff within same date
  return events.sort((a, b) =>
    (a.date || "").localeCompare(b.date || "") ||
    (a.diff  - b.diff)
  );
}

export { buildCalendarEvents };
