import { buildCalendarEvents } from "./calendar.js";

// Global search across all collections

function searchCollection(state, query) {
  const q = query.toLowerCase().trim();
  if (!q) return {};
  const results = {};

  const match = (...fields) =>
    fields.some(f => (f || "").toLowerCase().includes(q));

  // Households
  const hhResults = (state?.households || []).filter(h =>
    match(h.formalName, h.name2, h.group, h.status, h.notes, h.address1, h.cityStateZip)
  ).map(h => ({
    id: h.id, tab: "guests", collection: "households",
    primary: h.formalName || h.name || "Unnamed",
    secondary: [h.group, h.status].filter(Boolean).join(" · "),
  }));
  if (hhResults.length) results.households = hhResults;

  // People
  const peopleResults = (state?.people || []).filter(p => {
    const name = [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "";
    return match(name, p.dietary, p.notes, p.mealChoice);
  }).map(p => {
    const name = [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "Unnamed";
    const hh   = (state?.households || []).find(h => h.id === p.householdId);
    return {
      id: p.id, tab: "guests", collection: "people",
      householdId: p.householdId || null,
      primary: name,
      secondary: hh ? hh.formalName : "",
    };
  });
  if (peopleResults.length) results.people = peopleResults;

  // Vendors
  const vendorResults = (state?.vendors || []).filter(v =>
    match(v.name, v.contactName, v.type, v.status, v.notes, v.email, v.phone)
  ).map(v => ({
    id: v.id, tab: "vendors", collection: "vendors",
    primary: v.name,
    secondary: [v.type, v.status].filter(Boolean).join(" · "),
  }));
  if (vendorResults.length) results.vendors = vendorResults;

  // Expenses
  const expenseResults = (state?.expenses || []).filter(e =>
    match(e.description, e.vendor, e.category, e.notes)
  ).map(e => ({
    id: e.id, tab: "budget", collection: "expenses",
    primary: e.description,
    secondary: [e.category, e.amount ? `$${parseFloat(e.amount).toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0})}` : ""].filter(Boolean).join(" · "),
  }));
  if (expenseResults.length) results.expenses = expenseResults;

  // Tasks
  const taskResults = (state?.tasks || []).filter(t =>
    !t.dismissed && match(t.task, t.category, t.notes)
  ).map(t => ({
    id: t.id, tab: "tasks", collection: "tasks",
    primary: t.task,
    secondary: [t.category, t.due ? new Date(t.due+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : ""].filter(Boolean).join(" · "),
  }));
  if (taskResults.length) results.tasks = taskResults;

  // Prep
  const prepResults = (state?.prep || []).filter(p =>
    match(p.title, p.category, p.notes, p.status)
  ).map(p => ({
    id: p.id, tab: "prep", collection: "prep",
    primary: p.title || "Untitled",
    secondary: [p.category, p.status].filter(Boolean).join(" · "),
  }));
  if (prepResults.length) results.prep = prepResults;

  // Gifts
  const giftResults = (state?.gifts || []).filter(g =>
    match(g.fromName, g.giftType, g.description, g.notes)
  ).map(g => ({
    id: g.id, tab: "gifts", collection: "gifts",
    primary: g.fromName || "Unknown",
    secondary: [g.giftType, g.amount ? `$${parseFloat(g.amount).toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0})}` : ""].filter(Boolean).join(" · "),
  }));
  if (giftResults.length) results.gifts = giftResults;

  // Favors
  const favorItems = (state?.favors?.items || []);
  const favorResults = favorItems.filter(f =>
    match(f.guestName, f.printName, f.category, f.size)
  ).map(f => ({
    id: f.id, tab: "favors", collection: "favors",
    primary: f.guestName,
    secondary: [f.size, f.category].filter(Boolean).join(" · "),
  }));
  if (favorResults.length) results.favors = favorResults;

  // Calendar (derived view — aggregates all sources, searched by title + meta)
  const calEvents = buildCalendarEvents(state, state?.adminConfig || {}, true);
  const calResults = calEvents.filter(e =>
    match(e.title, e.meta)
  ).map(e => {
    const srcLabel = { timeline:"Event", task:"Task", payment:"Payment",
                       milestone:"Milestone", prep:"Prep" }[e.source] || e.source;
    const dateStr  = e.date
      ? new Date(e.date+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})
      : "";
    return {
      id:        `cal-${e.id}`,
      tab:       "calendar",
      collection:"calendar",
      primary:   e.title,
      secondary: [srcLabel, dateStr].filter(Boolean).join(" · "),
    };
  });
  if (calResults.length) results.calendar = calResults;

  return results;
}

export { searchCollection };
