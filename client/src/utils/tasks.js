import { computeVendorFinancials, fmt$ } from "./vendors.js";

// Task utilities — due status and smart suggestions computation

function getTaskDueStatus(task) {
  if (task.done || !task.due) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const due   = new Date(task.due + "T00:00:00");
  const diff  = Math.ceil((due - today) / (1000*60*60*24));
  if (diff < 0)  return { label: `Overdue ${Math.abs(diff)}d`, cls: "overdue", diff };
  if (diff === 0) return { label: "Due today",                  cls: "soon",    diff };
  if (diff <= 7)  return { label: `Due in ${diff}d`,            cls: "soon",    diff };
  return { label: new Date(task.due+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}), cls: "future", diff };
}

function computeSuggestions(state) {
  const suggestions = [];
  const expenses    = state?.expenses     || [];
  const vendors     = state?.vendors      || [];
  const households  = state?.households   || [];
  const tasks       = state?.tasks        || [];
  const prep        = state?.prep         || [];
  const tables      = state?.tables       || [];
  const people      = state?.people       || [];
  const favors      = state?.favors?.items  || [];
  const favorConfig = state?.favors?.config || {};
  const config      = state?.adminConfig  || {};

  const today = new Date(); today.setHours(0,0,0,0);

  // Helper: check if a task already exists covering this topic (simple name match)
  const alreadyHasTask = (keyword) =>
    tasks.some(t => (t.task||"").toLowerCase().includes(keyword.toLowerCase()));

  // ── Budget: unpaid expenses with due dates ─────────────────────────────────
  expenses.filter(e => !e.paid && e.dueDate).forEach(e => {
    const keyword = e.vendor || e.description;
    if (alreadyHasTask(e.description)) return;
    const due  = new Date(e.dueDate + "T00:00:00");
    const diff = Math.ceil((due - today) / (1000*60*60*24));
    const amt  = parseFloat(e.amount) || 0;
    const priority = diff <= 14 ? "High" : "Medium";
    const dueCls   = diff < 0 ? "urgent" : diff <= 14 ? "soon" : "";
    const dueLabel = diff < 0
      ? `Overdue by ${Math.abs(diff)} day${Math.abs(diff)!==1?"s":""}`
      : diff === 0 ? "Due today"
      : `Due ${new Date(e.dueDate+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;
    suggestions.push({
      id:               `budget-due-${e.id}`,
      icon:             "💳",
      text:             `Pay ${e.description}${e.vendor ? ` (${e.vendor})` : ""} — ${fmt$(amt)}`,
      meta:             dueLabel,
      metaCls:          dueCls,
      category:         "Budget",
      priority,
      due:              e.dueDate,
      sortKey:          diff,
      sourceTab:        "budget",
      sourceId:         e.id,
      sourceCollection: "expenses",
    });
  });

  // ── Budget: unpaid expenses without due dates ──────────────────────────────
  expenses.filter(e => !e.paid && !e.dueDate).forEach(e => {
    if (alreadyHasTask(e.description)) return;
    const amt = parseFloat(e.amount) || 0;
    suggestions.push({
      id:               `budget-nodue-${e.id}`,
      icon:             "📋",
      text:             `Schedule payment for ${e.description}${e.vendor ? ` (${e.vendor})` : ""} — ${fmt$(amt)}`,
      meta:             "No due date set",
      metaCls:          "",
      category:         "Budget",
      priority:         "Low",
      due:              "",
      sortKey:          9999,
      sourceTab:        "budget",
      sourceId:         e.id,
      sourceCollection: "expenses",
    });
  });

  // ── Vendors: unscheduled balance ───────────────────────────────────────────
  vendors.forEach(v => {
    const fin = computeVendorFinancials(v, expenses);
    if (fin.unscheduled <= 0) return;
    if (alreadyHasTask(v.name)) return;
    suggestions.push({
      id:               `vendor-unscheduled-${v.id}`,
      icon:             "📊",
      text:             `Enter remaining payments for ${v.name} — ${fmt$(fin.unscheduled)} unscheduled`,
      meta:             `${fmt$(fin.totalPaid)} paid · ${fmt$(fin.contractAmt)} contracted`,
      metaCls:          "",
      category:         "Vendor",
      priority:         "Low",
      due:              "",
      sortKey:          9990,
      sourceTab:        "vendors",
      sourceId:         v.id,
      sourceCollection: "vendors",
    });
  });

  // ── Vendors: still in Researching or Contacted status ─────────────────────
  vendors.filter(v => ["Researching","Contacted"].includes(v.status)).forEach(v => {
    if (alreadyHasTask(v.name)) return;
    suggestions.push({
      id:               `vendor-unbooked-${v.id}`,
      icon:             "🏪",
      text:             `Confirm booking for ${v.name}`,
      meta:             `Status: ${v.status}`,
      metaCls:          "",
      category:         "Vendor",
      priority:         "Medium",
      due:              "",
      sortKey:          9980,
      sourceTab:        "vendors",
      sourceId:         v.id,
      sourceCollection: "vendors",
    });
  });

  // ── Vendors: milestone deadlines ──────────────────────────────────────────
  vendors.forEach(v => {
    (v.milestones || []).forEach(m => {
      if (!m.title || !m.date) return;
      if (alreadyHasTask(m.title)) return;
      const due  = new Date(m.date + "T00:00:00");
      const diff = Math.ceil((due - today) / (1000*60*60*24));
      if (diff > 60) return; // not actionable yet
      const priority = diff < 0 ? "High" : diff <= 30 ? "High" : "Medium";
      const dueCls   = diff < 0 ? "urgent" : diff <= 14 ? "soon" : "";
      const dueLabel = diff < 0
        ? `Overdue by ${Math.abs(diff)} day${Math.abs(diff)!==1?"s":""}`
        : diff === 0 ? "Due today"
        : `Due ${new Date(m.date+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;
      suggestions.push({
        id:               `vendor-milestone-${v.id}-${m.id}`,
        icon:             "📌",
        text:             `${m.title} — ${v.name}`,
        meta:             `${dueLabel}${m.notes ? ` · ${m.notes}` : ""}`,
        metaCls:          dueCls,
        category:         "Vendor",
        priority,
        due:              m.date,
        sortKey:          diff,
        sourceTab:        "vendors",
        sourceId:         v.id,
        sourceCollection: "vendors",
      });
    });
  });

  // ── Guests: missing addresses ──────────────────────────────────────────────
  const missingAddr = households.filter(h => !h.address1).length;
  if (missingAddr > 0 && !alreadyHasTask("missing address")) {
    suggestions.push({
      id:               "guests-missing-addr",
      icon:             "📍",
      text:             `Add missing addresses — ${missingAddr} household${missingAddr!==1?"s":""} incomplete`,
      meta:             "Required for invitation mailing",
      metaCls:          "",
      category:         "Planning",
      priority:         "Medium",
      due:              "",
      sortKey:          9970,
      sourceTab:        "guests",
      sourceId:         null,
      sourceCollection: null,
    });
  }

  // ── Guests: RSVP deadline passed with pending households ──────────────────
  const rsvpDeadline = config.rsvpDeadline;
  const rsvpPending  = households.filter(h => h.status==="Invited"||h.status==="Pending").length;
  if (rsvpDeadline && rsvpPending > 0) {
    const due  = new Date(rsvpDeadline + "T00:00:00");
    const diff = Math.ceil((due - today) / (1000*60*60*24));
    if (diff <= 0 && !alreadyHasTask("outstanding RSVP")) {
      suggestions.push({
        id:               "guests-rsvp-overdue",
        icon:             "📬",
        text:             `Follow up on outstanding RSVPs — ${rsvpPending} household${rsvpPending!==1?"s":""} haven't responded`,
        meta:             `RSVP deadline passed ${Math.abs(diff)} day${Math.abs(diff)!==1?"s":""} ago`,
        metaCls:          "urgent",
        category:         "Planning",
        priority:         "High",
        due:              "",
        sortKey:          -1,
        sourceTab:        "guests",
        sourceId:         null,
        sourceCollection: null,
      });
    }
  }

  // ── Prep: items with a target date that are not Complete ─────────────────
  prep.filter(p => p.targetDate && p.status !== "Complete").forEach(p => {
    if (alreadyHasTask(p.title)) return;
    const due  = new Date(p.targetDate + "T00:00:00");
    const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    const priority = diff < 0 ? "High" : diff <= 14 ? "Medium" : "Low";
    const metaCls  = diff < 0 ? "urgent" : diff <= 14 ? "soon" : "";
    const dueLabel = diff < 0
      ? `Target overdue by ${Math.abs(diff)} day${Math.abs(diff) !== 1 ? "s" : ""}`
      : diff === 0 ? "Target date is today"
      : `Target: ${new Date(p.targetDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    suggestions.push({
      id:               `prep-target-${p.id}`,
      icon:             "📖",
      text:             `Work on "${p.title}" — ${p.progress || 0}% complete`,
      meta:             dueLabel,
      metaCls,
      category:         "Planning",
      priority,
      due:              p.targetDate,
      sortKey:          diff,
      sourceTab:        "prep",
      sourceId:         p.id,
      sourceCollection: "prep",
    });
  });

  // ── Prep: Not Started items with no target date set ───────────────────────
  prep.filter(p => p.status === "Not Started" && !p.targetDate).forEach(p => {
    if (alreadyHasTask(p.title)) return;
    suggestions.push({
      id:               `prep-nodate-${p.id}`,
      icon:             "📖",
      text:             `Set a target date for "${p.title}"`,
      meta:             "No target date — add one to track progress",
      metaCls:          "",
      category:         "Planning",
      priority:         "Low",
      due:              "",
      sortKey:          9960,
      sourceTab:        "prep",
      sourceId:         p.id,
      sourceCollection: "prep",
    });
  });

  // ── Seating: unseated people after RSVP deadline or within 60 days ─────────
  if (people.length > 0 && tables.length > 0) {
    const unseatedCount = people.filter(p => !p.tableId).length;
    if (unseatedCount > 0) {
      const rsvpDeadline = config.rsvpDeadline;
      const mainEvt      = (config.timeline||[]).find(e => e.isMainEvent);
      const eventDate    = mainEvt?.startDate ? new Date(mainEvt.startDate + "T00:00:00") : null;
      const daysToEvent  = eventDate ? Math.ceil((eventDate - today) / (1000*60*60*24)) : null;
      const deadlinePassed = rsvpDeadline && new Date(rsvpDeadline + "T00:00:00") < today;

      if (deadlinePassed && !alreadyHasTask("seating")) {
        suggestions.push({
          id:               "seating-unseated-deadline",
          icon:             "🪑",
          text:             `Finalize seating — ${unseatedCount} person${unseatedCount !== 1 ? "s" : ""} still need${unseatedCount === 1 ? "s" : ""} a table`,
          meta:             "RSVP deadline has passed",
          metaCls:          "urgent",
          category:         "Planning",
          priority:         "High",
          due:              "",
          sortKey:          -2,
          sourceTab:        "seating",
          sourceId:         null,
          sourceCollection: null,
        });
      } else if (!deadlinePassed && daysToEvent !== null && daysToEvent <= 60 && !alreadyHasTask("seating")) {
        suggestions.push({
          id:               "seating-unseated-soon",
          icon:             "🪑",
          text:             `Assign remaining seats — ${unseatedCount} person${unseatedCount !== 1 ? "s" : ""} unseated`,
          meta:             `Event is ${daysToEvent} day${daysToEvent !== 1 ? "s" : ""} away`,
          metaCls:          daysToEvent <= 14 ? "soon" : "",
          category:         "Planning",
          priority:         "Medium",
          due:              "",
          sortKey:          9955,
          sourceTab:        "seating",
          sourceId:         null,
          sourceCollection: null,
        });
      }
    }
  }

  // ── Seating: tables over capacity ─────────────────────────────────────────
  tables.forEach(t => {
    const filled = people.filter(p => p.tableId === t.id).length;
    const cap    = parseInt(t.capacity) || 0;
    if (filled > cap && !alreadyHasTask(t.name)) {
      suggestions.push({
        id:               `seating-overcap-${t.id}`,
        icon:             "⚠️",
        text:             `"${t.name}" is over capacity — ${filled} assigned, ${cap} seats`,
        meta:             `Move ${filled - cap} person${filled - cap !== 1 ? "s" : ""} to another table`,
        metaCls:          "urgent",
        category:         "Planning",
        priority:         "High",
        due:              "",
        sortKey:          5,
        sourceTab:        "seating",
        sourceId:         null,
        sourceCollection: null,
      });
    }
  });

  // ── Favors: missing sizes ─────────────────────────────────────────────────
  if (favorConfig.givingFavors && favorConfig.needsSizing && favors.length > 0) {
    const missingSizes = favors.filter(f => !f.size).length;
    if (missingSizes > 0 && !alreadyHasTask("favor")) {
      suggestions.push({
        id:               "favors-missing-size",
        icon:             "⭐",
        text:             `${missingSizes} favor recipient${missingSizes !== 1 ? "s are" : " is"} missing a size`,
        meta:             "Required before placing the favor order",
        metaCls:          "",
        category:         "Planning",
        priority:         "Medium",
        due:              "",
        sortKey:          9950,
        sourceTab:        "favors",
        sourceId:         null,
        sourceCollection: null,
      });
    }
  }

  // ── Favors: preprint not confirmed ────────────────────────────────────────
  if (favorConfig.givingFavors && favorConfig.isPersonalized && favors.length > 0) {
    const unprintedCount = favors.filter(f => f.preprint === "TBD").length;
    if (unprintedCount > 0 && !alreadyHasTask("favor")) {
      const eventDate   = (config.timeline||[]).find(e=>e.isMainEvent)?.startDate
                        ? new Date((config.timeline||[]).find(e=>e.isMainEvent).startDate + "T00:00:00") : null;
      const daysToEvent = eventDate ? Math.ceil((eventDate - today) / (1000*60*60*24)) : null;
      if (daysToEvent === null || daysToEvent <= 60) {
        const priority = daysToEvent !== null && daysToEvent <= 30 ? "High" : "Medium";
        const metaCls  = daysToEvent !== null && daysToEvent <= 30 ? "soon" : "";
        suggestions.push({
          id:               "favors-preprint-tbd",
          icon:             "⭐",
          text:             `${unprintedCount} favor preprint${unprintedCount !== 1 ? "s" : ""} not yet confirmed`,
          meta:             daysToEvent !== null ? `${daysToEvent} day${daysToEvent !== 1 ? "s" : ""} until event` : "Confirm before placing order",
          metaCls,
          category:         "Planning",
          priority,
          due:              "",
          sortKey:          daysToEvent !== null ? daysToEvent + 100 : 9945,
          sourceTab:        "favors",
          sourceId:         null,
          sourceCollection: null,
        });
      }
    }
  }

  // ── Accommodations: room block cut-off approaching ───────────────────────
  const accomCutoff = config.accomCutoffDate;
  if (accomCutoff && !alreadyHasTask("room block")) {
    const cutoff     = new Date(accomCutoff + "T00:00:00");
    const diffCutoff = Math.ceil((cutoff - today) / (1000*60*60*24));
    const unnotified = (state?.households||[]).filter(h => h.outOfTown && !h.accomNotified).length;
    if (diffCutoff <= 60 && unnotified > 0) {
      const priority = diffCutoff <= 14 ? "High" : "Medium";
      const metaCls  = diffCutoff <= 14 ? "soon" : "";
      suggestions.push({
        id:               "accom-cutoff",
        icon:             "🧳",
        text:             `Remind out-of-town guests about hotel room block cut-off (${unnotified} not yet notified)`,
        meta:             diffCutoff <= 0
                            ? `Cut-off date passed ${Math.abs(diffCutoff)} day${Math.abs(diffCutoff)!==1?"s":""} ago`
                            : `Cut-off: ${new Date(accomCutoff+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})} · ${diffCutoff} day${diffCutoff!==1?"s":""} remaining`,
        metaCls,
        category:         "Guests",
        priority,
        due:              accomCutoff,
        sortKey:          diffCutoff,
        sourceTab:        "accommodations",
        sourceId:         null,
        sourceCollection: null,
      });
    }
  }

  // Sort: by sortKey ascending (overdue first, then soonest due, then misc)
  return suggestions.sort((a,b) => a.sortKey - b.sortKey);
}

export {
  getTaskDueStatus,
  computeSuggestions,
};
