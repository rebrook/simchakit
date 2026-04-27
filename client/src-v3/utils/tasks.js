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

// ── getSmartTaskTemplates ─────────────────────────────────────────────────────
// Returns date-anchored milestone templates based on the main event date and
// event type. Templates are deduped against existing tasks.
//
// Parameters:
//   eventDate     — ISO date string of the main event (e.g. "2026-10-17")
//   eventType     — adminConfig.type: "bar-mitzvah"|"bat-mitzvah"|"wedding"|other
//   existingTasks — current tasks array (used to skip already-covered items)
//
// Each returned template:
//   { id, text, category, icon, due, daysOffset, priority, tier,
//     preChecked, alreadyCovered, isPast }

function getSmartTaskTemplates(eventDate, eventType, existingTasks) {
  if (!eventDate) return [];

  const event  = new Date(eventDate + "T00:00:00");
  const today  = new Date(); today.setHours(0, 0, 0, 0);
  const isMitz = eventType === "bar-mitzvah" || eventType === "bat-mitzvah";
  const isWed  = eventType === "wedding";
  const tasks  = existingTasks || [];

  // A template is already covered if any non-done task contains any keyword
  const covered = (keywords) =>
    tasks.some(t => !t.done && keywords.some(kw =>
      (t.task || "").toLowerCase().includes(kw.toLowerCase())
    ));

  // Calculate ISO date from offset in days relative to event
  const calcDue = (offset) => {
    const d = new Date(event);
    d.setDate(d.getDate() + offset);
    return d.toISOString().split("T")[0];
  };

  // ── Raw template definitions ───────────────────────────────────────────────
  // tier 1 = universal, tier 2 = event-specific, tier 3 = optional
  // preChecked: tier 1+2 = true, tier 3 = false
  const RAW = [

    // ── Tier 1: Universal ─────────────────────────────────────────────────
    { id:"tmpl-save-the-date",      tier:1, daysOffset:-365, priority:"High",   category:"Stationery", icon:"💌",
      text:"Send save-the-dates",
      keywords:["save-the-date","save the date"] },
    { id:"tmpl-hotel-block",        tier:1, daysOffset:-365, priority:"Medium", category:"Planning",   icon:"🏨",
      text:"Book hotel room block for out-of-town guests",
      keywords:["hotel","room block"] },
    { id:"tmpl-order-invitations",  tier:1, daysOffset:-120, priority:"High",   category:"Stationery", icon:"✉️",
      text:"Order invitations — design and print",
      keywords:["order invitation","print invitation","invitation design"] },
    { id:"tmpl-mail-invitations",   tier:1, daysOffset:-70,  priority:"High",   category:"Stationery", icon:"📬",
      text:"Mail invitations",
      keywords:["mail invitation","send invitation","invitations out"] },
    { id:"tmpl-rsvp-deadline",      tier:1, daysOffset:-70,  priority:"High",   category:"Planning",   icon:"📋",
      text:"Set and communicate RSVP deadline",
      keywords:["rsvp deadline"] },
    { id:"tmpl-followup-rsvp",      tier:1, daysOffset:-21,  priority:"High",   category:"Guests",     icon:"📞",
      text:"Follow up with guests who haven't RSVPd",
      keywords:["follow up","rsvp follow","non-rsvp","outstanding rsvp"] },
    { id:"tmpl-final-count",        tier:1, daysOffset:-14,  priority:"High",   category:"Catering",   icon:"🍽️",
      text:"Submit final guest count to venue and caterer",
      keywords:["final count","guest count","headcount"] },
    { id:"tmpl-dietary-caterer",    tier:1, daysOffset:-14,  priority:"High",   category:"Catering",   icon:"🥗",
      text:"Send allergy and dietary restrictions to caterer",
      keywords:["allergy","dietary","restrictions","caterer"] },
    { id:"tmpl-day-of-stationery",  tier:1, daysOffset:-42,  priority:"Medium", category:"Stationery", icon:"🪧",
      text:"Order day-of stationery — menus, place cards, programs",
      keywords:["place card","menu print","program print","day-of stationery"] },
    { id:"tmpl-seating-finalize",   tier:1, daysOffset:-21,  priority:"High",   category:"Planning",   icon:"🪑",
      text:"Finalize seating chart",
      keywords:["finalize seating","seating chart","finalize seat"] },
    { id:"tmpl-seating-deliver",    tier:1, daysOffset:-7,   priority:"High",   category:"Planning",   icon:"📤",
      text:"Deliver final seating chart to venue",
      keywords:["deliver seating","seating to venue"] },
    { id:"tmpl-confirm-vendors",    tier:1, daysOffset:-7,   priority:"High",   category:"Vendor",     icon:"📱",
      text:"Confirm all vendor details and send day-of timeline",
      keywords:["confirm vendor","day-of timeline","vendor details"] },
    { id:"tmpl-final-payments",     tier:1, daysOffset:-10,  priority:"High",   category:"Budget",     icon:"💳",
      text:"Make final payments to all vendors",
      keywords:["final payment","pay vendor","vendor payment"] },
    { id:"tmpl-tip-envelopes",      tier:1, daysOffset:-5,   priority:"Medium", category:"Budget",     icon:"💵",
      text:"Prepare vendor tip envelopes",
      keywords:["tip envelope","gratuity envelope"] },
    { id:"tmpl-shot-list",          tier:1, daysOffset:-42,  priority:"Medium", category:"Vendor",     icon:"📸",
      text:"Create shot list for photographer",
      keywords:["shot list","photo list","photographer list"] },
    { id:"tmpl-parent-speech",      tier:1, daysOffset:-42,  priority:"Medium", category:"Planning",   icon:"📝",
      text:"Write parent speech or prayer",
      keywords:["parent speech","parent prayer","speech","blessing"] },

    // ── Tier 2: Mitzvah-specific ──────────────────────────────────────────
    ...(isMitz ? [
      { id:"tmpl-begin-tutoring",   tier:2, daysOffset:-270, priority:"High",   category:"Planning",   icon:"📖",
        text:"Begin Torah portion tutoring",
        keywords:["tutor","torah portion","tutoring"] },
      { id:"tmpl-cantor-family",    tier:2, daysOffset:-180, priority:"High",   category:"Planning",   icon:"🕍",
        text:"Family meeting with cantor — service planning, Torah readers, mitzvah project",
        keywords:["cantor","family meeting","service planning"] },
      { id:"tmpl-cantor-4mo",       tier:2, daysOffset:-120, priority:"Medium", category:"Planning",   icon:"🕍",
        text:"Cantor check-in — 4-month review",
        keywords:["cantor check","4-month","4 month","cantor session"] },
      { id:"tmpl-cantor-2mo",       tier:2, daysOffset:-60,  priority:"Medium", category:"Planning",   icon:"🕍",
        text:"Cantor check-in — 2-month review and d'var Torah draft",
        keywords:["cantor check","2-month","2 month","d'var torah","dvar torah"] },
      { id:"tmpl-cantor-final",     tier:2, daysOffset:-30,  priority:"High",   category:"Planning",   icon:"🕍",
        text:"Final cantor session — polish readings and d'var Torah",
        keywords:["final cantor","final session"] },
      { id:"tmpl-aliyot-list",      tier:2, daysOffset:-42,  priority:"Medium", category:"Ceremony",   icon:"📜",
        text:"Assign aliyot and Torah readers — send list to rabbi with Hebrew names",
        keywords:["aliyot","aliyah","torah reader","hebrew name"] },
      { id:"tmpl-order-kippot",     tier:2, daysOffset:-120, priority:"Medium", category:"Planning",   icon:"🔵",
        text:"Order custom kippot",
        keywords:["kippot","kippah","yarmulke"] },
      { id:"tmpl-pickup-kippot",    tier:2, daysOffset:-7,   priority:"Medium", category:"Planning",   icon:"🔵",
        text:"Pick up kippot",
        keywords:["pick up kippot","pickup kippot","collect kippot"] },
      { id:"tmpl-collect-montage",  tier:2, daysOffset:-90,  priority:"Medium", category:"Vendor",     icon:"🎞️",
        text:"Collect photos and videos for mitzvah montage",
        keywords:["montage photo","montage video","collect photo","collect video"] },
      { id:"tmpl-submit-montage",   tier:2, daysOffset:-49,  priority:"High",   category:"Vendor",     icon:"🎞️",
        text:"Submit montage to DJ/videographer (avoid rush fees)",
        keywords:["submit montage","send montage","montage to dj"] },
      { id:"tmpl-friday-dinner",    tier:2, daysOffset:-150, priority:"Medium", category:"Planning",   icon:"🕯️",
        text:"Plan Friday night dinner — venue, menu, guest list",
        keywords:["friday dinner","friday night dinner","shabbat dinner"] },
      { id:"tmpl-morning-minyan",   tier:2, daysOffset:-28,  priority:"Low",    category:"Planning",   icon:"🌅",
        text:"Morning Minyan — mitzvah child takes aliyah",
        keywords:["morning minyan","minyan"] },
      { id:"tmpl-rehearsal",        tier:2, daysOffset:-9,   priority:"High",   category:"Planning",   icon:"🎤",
        text:"Final rehearsal at synagogue",
        keywords:["rehearsal","final rehearsal","synagogue rehearsal"] },
      { id:"tmpl-steam-tallit",     tier:2, daysOffset:-4,   priority:"Low",    category:"Planning",   icon:"🌿",
        text:"Steam or press tallit",
        keywords:["tallit","steam tallit","press tallit"] },
      { id:"tmpl-challah",          tier:2, daysOffset:-14,  priority:"Medium", category:"Catering",   icon:"🍞",
        text:"Order challah and/or cake",
        keywords:["challah","order cake","order challah"] },
    ] : []),

    // ── Tier 2: Wedding-specific ──────────────────────────────────────────
    ...(isWed ? [
      { id:"tmpl-hair-makeup-trial", tier:2, daysOffset:-90, priority:"Medium", category:"Attire",    icon:"💄",
        text:"Schedule hair and makeup trial",
        keywords:["hair trial","makeup trial","beauty trial"] },
      { id:"tmpl-final-fitting",    tier:2, daysOffset:-42,  priority:"High",   category:"Attire",    icon:"👗",
        text:"Final dress/suit fitting",
        keywords:["final fitting","dress fitting","suit fitting"] },
      { id:"tmpl-marriage-license", tier:2, daysOffset:-45,  priority:"High",   category:"Planning",  icon:"📄",
        text:"Apply for marriage license",
        keywords:["marriage license"] },
      { id:"tmpl-menu-tasting",     tier:2, daysOffset:-180, priority:"Medium", category:"Catering",  icon:"🍷",
        text:"Schedule menu tasting with caterer",
        keywords:["menu tasting","food tasting","tasting"] },
      { id:"tmpl-honeymoon",        tier:2, daysOffset:-14,  priority:"Medium", category:"Planning",  icon:"✈️",
        text:"Confirm honeymoon travel and documents",
        keywords:["honeymoon","travel document","passport"] },
    ] : []),

    // ── Tier 3: Optional (pre-unchecked) ──────────────────────────────────
    { id:"tmpl-portrait-session",   tier:3, daysOffset:-180, priority:"Low",    category:"Vendor",     icon:"📷",
      text:"Schedule family portrait session",
      keywords:["portrait session","family photo session"] },
    { id:"tmpl-transportation",     tier:3, daysOffset:-42,  priority:"Low",    category:"Planning",   icon:"🚌",
      text:"Finalize guest transportation details",
      keywords:["transportation","shuttle","bus","car service"] },
    { id:"tmpl-welcome-baskets",    tier:3, daysOffset:-14,  priority:"Low",    category:"Planning",   icon:"🎁",
      text:"Assemble welcome baskets for out-of-town guests",
      keywords:["welcome basket","welcome bag","gift bag"] },
    { id:"tmpl-party-gifts",        tier:3, daysOffset:-14,  priority:"Low",    category:"Planning",   icon:"🎀",
      text:"Purchase gifts for wedding party / Torah readers",
      keywords:["party gift","torah reader gift","wedding party gift"] },
    { id:"tmpl-sunday-brunch",      tier:3, daysOffset:-180, priority:"Low",    category:"Planning",   icon:"🥞",
      text:"Plan Sunday brunch (if applicable)",
      keywords:["sunday brunch","brunch","day after"] },
  ];

  // ── Build and return template list ────────────────────────────────────────
  return RAW.map(tmpl => {
    const due        = calcDue(tmpl.daysOffset);
    const isPast     = new Date(due + "T00:00:00") < today;
    const isCovered  = covered(tmpl.keywords);
    return {
      ...tmpl,
      due,
      isPast,
      alreadyCovered: isCovered,
      preChecked:     tmpl.tier < 3 && !isCovered,
    };
  });
}

export {
  getTaskDueStatus,
  computeSuggestions,
  getSmartTaskTemplates,
};

