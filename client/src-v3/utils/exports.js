import { sortTimeline, formatEntryMeta } from "./dates.js";
import { getHouseholdAttending, formatAddress, migrateCityStateZip } from "./guests.js";
import { computeVendorFinancials, fmt$ } from "./vendors.js";
import { PALETTES } from "@/constants/theme.js";

// Export and print HTML generators for all tabs

function csvEsc(val) {
  const s = String(val == null ? "" : val);
  return (s.includes(",") || s.includes('"') || s.includes("\n"))
    ? '"' + s.replace(/"/g, '""') + '"'
    : s;
}

function exportExpensesCSV(expenses) {
  const headers = ["Description","Category","Vendor","Budgeted","Amount","Variance","Paid","Date","Due Date","Notes"];
  const esc = v => { const s = String(v||""); return (s.includes(",")||s.includes('"')) ? '"'+s.replace(/"/g,'""')+'"' : s; };
  const rows = [...expenses]
    .sort((a,b) => (a.category||"").localeCompare(b.category||""))
    .map(e => {
      const amt      = parseFloat(e.amount)    || 0;
      const budgeted = parseFloat(e.budgeted)  || 0;
      const variance = budgeted > 0 ? amt - budgeted : "";
      return [
        e.description||"",
        e.category||"",
        e.vendor||"",
        budgeted > 0 ? budgeted.toFixed(2) : "",
        amt.toFixed(2),
        variance !== "" ? variance.toFixed(2) : "",
        e.paid ? "Yes" : "No",
        e.date||"",
        e.dueDate||"",
        e.notes||"",
      ];
    });
  return [headers.map(esc).join(","), ...rows.map(r => r.map(esc).join(","))].join("\n");
}

function exportSeatingByTable(tables, people, households, sectionId) {
  const hhMap = Object.fromEntries(households.map(h => [h.id, h]));

  const getDisplayName = (p) =>
    (p.firstName || p.lastName)
      ? `${p.firstName || ""} ${p.lastName || ""}`.trim()
      : (p.name || "Unnamed");

  const getTableId = (p) => sectionId ? (p.tableAssignments?.[sectionId] || null) : p.tableId;

  // Build column arrays — one per table, plus Unassigned
  const cols = tables.map(t => ({
    header: t.name,
    names:  people.filter(p => getTableId(p) === t.id).map(getDisplayName),
  }));
  const unassigned = people.filter(p => !getTableId(p)).map(getDisplayName);
  if (unassigned.length > 0) cols.push({ header: "Unassigned", names: unassigned });

  if (cols.length === 0) return "No tables or people found.";

  const maxRows = Math.max(...cols.map(c => c.names.length));
  const rows = [];
  rows.push(cols.map(c => csvEsc(c.header)).join(","));
  for (let i = 0; i < maxRows; i++) {
    rows.push(cols.map(c => csvEsc(c.names[i] || "")).join(","));
  }
  return rows.join("\n");
}

function exportSeatingByPerson(tables, people, households, sectionId) {
  const hhMap    = Object.fromEntries(households.map(h => [h.id, h]));
  const tableMap = Object.fromEntries(tables.map(t => [t.id, t]));

  const getTableId = (p) => sectionId ? (p.tableAssignments?.[sectionId] || null) : p.tableId;

  const getDisplayName = (p) =>
    (p.firstName || p.lastName)
      ? `${p.firstName || ""} ${p.lastName || ""}`.trim()
      : (p.name || "Unnamed");

  const getLastName = (p) =>
    p.lastName || (p.name || "").split(" ").pop() || "";

  const headers = ["Last Name", "First Name", "Household", "Group", "Table", "Table Type", "Meal Choice", "Kosher", "Dietary Notes"];
  const sorted  = [...people].sort((a, b) => getLastName(a).localeCompare(getLastName(b)));

  const rows = sorted.map(p => {
    const hh    = hhMap[p.householdId] || {};
    const tid   = getTableId(p);
    const table = tid ? tableMap[tid] : null;
    return [
      getLastName(p),
      p.firstName || "",
      hh.formalName || "",
      hh.group || "",
      table ? table.name : "Unassigned",
      table ? table.type : "",
      p.mealChoice || "",
      p.kosher ? "Yes" : "No",
      p.dietary || "",
    ].map(csvEsc).join(",");
  });

  return [headers.map(csvEsc).join(","), ...rows].join("\n");
}

function generateSeatingPrintHTML(tables, people, households, eventName, eventDate, theme, sectionTitle, sectionId) {
  const pal = PALETTES[theme?.palette] || PALETTES.rose;
  const hhMap = Object.fromEntries(households.map(h => [h.id, h]));

  const getDisplayName = (p) =>
    (p.firstName || p.lastName)
      ? `${p.firstName || ""} ${p.lastName || ""}`.trim()
      : (p.name || "Unnamed");

  const getTableId = (p) => sectionId ? (p.tableAssignments?.[sectionId] || null) : p.tableId;

  const titleLine = eventName
    ? (sectionTitle ? `${eventName} · ${sectionTitle}` : eventName)
    : "Seating Chart";

  const unassigned = people.filter(p => !getTableId(p));

  const tableCards = tables.map(t => {
    const occupants = people.filter(p => getTableId(p) === t.id);
    const rows = occupants.map(p => {
      const hh = hhMap[p.householdId] || {};
      const flags = [];
      if (p.kosher) flags.push('<span style="background:#d8f3dc;color:#2d6a4f;font-size:10px;font-weight:700;padding:1px 6px;border-radius:99px;margin-left:4px">Kosher</span>');
      if (p.dietary) flags.push(`<span style="background:#fef0e6;color:#9c4a12;font-size:10px;padding:1px 6px;border-radius:99px;margin-left:4px">${p.dietary}</span>`);
      return `
        <tr>
          <td style="padding:5px 8px;border-bottom:1px solid #f0ece6;font-weight:500">${getDisplayName(p)}${flags.join("")}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f0ece6;color:#5c5248;font-size:12px">${hh.formalName || ""}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f0ece6;color:#5c5248;font-size:12px">${hh.group || ""}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f0ece6;color:#5c5248;font-size:12px">${p.mealChoice || "—"}</td>
        </tr>`;
    }).join("");

    const cap    = parseInt(t.capacity) || 0;
    const filled = occupants.length;
    const over   = filled > cap ? ` <span style="color:#9b2335;font-weight:700">(over capacity)</span>` : "";

    return `
      <div style="margin-bottom:24px;page-break-inside:avoid">
        <div style="display:flex;justify-content:space-between;align-items:baseline;padding:8px 10px;background:linear-gradient(135deg,${pal["header-bg"]}22,${pal["accent-light"]});border-radius:8px 8px 0 0;border:1px solid ${pal["accent-medium"]};border-bottom:none">
          <span style="font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;font-weight:700;color:#1c1614">${t.name}</span>
          <span style="font-size:12px;color:#5c5248">${t.type} · ${filled}/${cap} seats${over}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2ddd5;border-radius:0 0 8px 8px;overflow:hidden">
          <thead>
            <tr style="background:#faf8f5">
              <th style="padding:6px 8px;text-align:left;font-size:11px;font-weight:700;color:#9c9188;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2ddd5">Name</th>
              <th style="padding:6px 8px;text-align:left;font-size:11px;font-weight:700;color:#9c9188;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2ddd5">Household</th>
              <th style="padding:6px 8px;text-align:left;font-size:11px;font-weight:700;color:#9c9188;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2ddd5">Group</th>
              <th style="padding:6px 8px;text-align:left;font-size:11px;font-weight:700;color:#9c9188;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2ddd5">Meal</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="4" style="padding:10px 8px;color:#9c9188;font-style:italic">No guests assigned</td></tr>'}</tbody>
        </table>
      </div>`;
  }).join("");

  const unassignedSection = unassigned.length > 0 ? `
    <div style="margin-bottom:24px;page-break-inside:avoid">
      <div style="padding:8px 10px;background:#fde8e8;border-radius:8px 8px 0 0;border:1px solid #e2ddd5;border-bottom:none">
        <span style="font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;font-weight:700;color:#9b2335">Unassigned (${unassigned.length})</span>
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2ddd5;border-radius:0 0 8px 8px;overflow:hidden">
        <thead>
          <tr style="background:#faf8f5">
            <th style="padding:6px 8px;text-align:left;font-size:11px;font-weight:700;color:#9c9188;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2ddd5">Name</th>
            <th style="padding:6px 8px;text-align:left;font-size:11px;font-weight:700;color:#9c9188;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2ddd5">Household</th>
            <th style="padding:6px 8px;text-align:left;font-size:11px;font-weight:700;color:#9c9188;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2ddd5">Group</th>
            <th style="padding:6px 8px;text-align:left;font-size:11px;font-weight:700;color:#9c9188;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2ddd5">Meal</th>
          </tr>
        </thead>
        <tbody>
          ${unassigned.map(p => {
            const hh = hhMap[p.householdId] || {};
            const flags = [];
            if (p.kosher) flags.push('<span style="background:#d8f3dc;color:#2d6a4f;font-size:10px;font-weight:700;padding:1px 6px;border-radius:99px;margin-left:4px">Kosher</span>');
            if (p.dietary) flags.push(`<span style="background:#fef0e6;color:#9c4a12;font-size:10px;padding:1px 6px;border-radius:99px;margin-left:4px">${p.dietary}</span>`);
            return `<tr>
              <td style="padding:5px 8px;border-bottom:1px solid #f0ece6;font-weight:500">${getDisplayName(p)}${flags.join("")}</td>
              <td style="padding:5px 8px;border-bottom:1px solid #f0ece6;color:#5c5248;font-size:12px">${hh.formalName || ""}</td>
              <td style="padding:5px 8px;border-bottom:1px solid #f0ece6;color:#5c5248;font-size:12px">${hh.group || ""}</td>
              <td style="padding:5px 8px;border-bottom:1px solid #f0ece6;color:#5c5248;font-size:12px">${p.mealChoice || "—"}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>` : "";

  const dateStr = eventDate
    ? new Date(eventDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "";

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>Seating Chart${eventName ? " — " + eventName : ""}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "DM Sans", sans-serif; color: #1c1614; background: #faf8f5; padding: 24px; font-size: 13px; }
  @media print {
    body { padding: 12px; background: white; }
    .no-print { display: none !important; }
    @page { margin: 1.5cm; }
  }
</style>
</head><body>

<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid ${pal["accent-medium"]}">
  <div>
    <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;font-weight:700;color:#1c1614">${titleLine}</div>
    ${dateStr ? `<div style="font-size:13px;color:#5c5248;margin-top:2px">${dateStr}</div>` : ""}
  </div>
  <div style="text-align:right">
    <div style="font-size:11px;color:#9c9188">${tables.length} tables · ${people.filter(p=>getTableId(p)).length} seated · ${unassigned.length} unassigned</div>
    <div style="font-size:11px;color:#9c9188;margin-top:2px">Generated ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
  </div>
</div>

<button class="no-print" onclick="window.print()"
  style="margin-bottom:20px;padding:8px 18px;background:${pal.accent};color:${pal["accent-text"]};border:none;border-radius:6px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer">
  🖨 Print
</button>

${tableCards}
${unassignedSection}

<div style="margin-top:32px;padding-top:12px;border-top:1px solid ${pal["accent-medium"]};text-align:center;font-size:11px;color:#9c9188">
  SimchaKit by Brook Creative LLC · Seating Chart Export
</div>
</body></html>`;
}

function exportGiftsCSV(gifts, households) {
  const hhMap = Object.fromEntries(households.map(h => [h.id, h]));
  const getAddress = (g) => {
    if (g.householdId && hhMap[g.householdId]) {
      const hh = hhMap[g.householdId];
      return formatAddress(migrateCityStateZip(hh));
    }
    return formatAddress(g);
  };
  const getLastName = (name) => (name || "").trim().split(" ").pop();
  const headers = ["From","Address","Gift Type","Description","Amount","Date Received","Attended","Thank You Written","Thank You Mailed","Notes"];
  const sorted  = [...gifts].sort((a,b) => getLastName(a.fromName).localeCompare(getLastName(b.fromName)));
  const rows    = sorted.map(g => [
    g.fromName || "",
    getAddress(g),
    g.giftType || "",
    g.description || "",
    g.amount != null ? g.amount : "",
    g.dateReceived || "",
    g.attended === true ? "Yes" : g.attended === false ? "No" : "",
    g.thankYouWritten ? "Yes" : "No",
    g.thankYouMailed  ? "Yes" : "No",
    g.notes || "",
  ].map(csvEsc).join(","));
  return [headers.map(csvEsc).join(","), ...rows].join("\n");
}

function generateGiftPrintHTML(gifts, households, eventName, eventDate, theme) {
  const pal = PALETTES[theme?.palette] || PALETTES.rose;
  const hhMap = Object.fromEntries(households.map(h => [h.id, h]));

  const getAddress = (g) => {
    if (g.householdId && hhMap[g.householdId]) {
      const hh = hhMap[g.householdId];
      return formatAddress(migrateCityStateZip(hh));
    }
    return formatAddress(g);
  };

  const getLastName = (name) => (name || "").trim().split(" ").pop();
  const sorted = [...gifts].sort((a,b) => getLastName(a.fromName).localeCompare(getLastName(b.fromName)));

  const totalMonetary = gifts.reduce((s,g) => s + (parseFloat(g.amount)||0), 0);

  const dateStr = eventDate
    ? new Date(eventDate + "T00:00:00").toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" })
    : "";

  const donorBlocks = sorted.map(g => {
    const addr    = getAddress(g);
    const amt     = g.amount != null ? `<span style="font-weight:700;color:#2d6a4f">$${parseFloat(g.amount).toLocaleString()}</span>` : "";
    const writtenBadge = g.thankYouWritten
      ? `<span style="background:#d8f3dc;color:#2d6a4f;font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;margin-left:6px">✓ Written</span>` : "";
    const mailedBadge  = g.thankYouMailed
      ? `<span style="background:#dbeafe;color:#1e4d8c;font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;margin-left:4px">✓ Mailed</span>` : "";
    const pendingBadge = (!g.thankYouWritten)
      ? `<span style="background:#fde8e8;color:#9b2335;font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;margin-left:6px">Pending</span>` : "";
    const attendedStr  = g.attended === true ? "Attended" : g.attended === false ? "Did not attend" : "";

    return `
      <div style="margin-bottom:18px;page-break-inside:avoid;border:1px solid ${pal["accent-medium"]};border-radius:8px;overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:8px 12px;background:${pal["accent-light"]};border-bottom:1px solid ${pal["accent-medium"]}">
          <div>
            <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;font-weight:700;color:#1c1614">
              ${g.fromName || "Unknown"}${pendingBadge}${writtenBadge}${mailedBadge}
            </div>
            ${addr ? `<div style="font-size:12px;color:#5c5248;margin-top:2px">${addr}</div>` : `<div style="font-size:12px;color:#c9c2b6;font-style:italic;margin-top:2px">No address on file</div>`}
          </div>
          <div style="text-align:right;font-size:11px;color:#9c9188">
            ${attendedStr ? `<div>${attendedStr}</div>` : ""}
            ${g.dateReceived ? `<div>${new Date(g.dateReceived+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>` : ""}
          </div>
        </div>
        <div style="padding:8px 12px;font-size:13px">
          <span style="font-weight:600;color:#1c1614">${g.giftType || "Gift"}</span>
          ${g.description ? `<span style="color:#5c5248"> — ${g.description}</span>` : ""}
          ${amt ? `<span style="margin-left:8px">${amt}</span>` : ""}
          ${g.notes ? `<div style="margin-top:4px;font-size:11px;color:#9c9188;font-style:italic">${g.notes}</div>` : ""}
        </div>
      </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>Gift List${eventName ? " — " + eventName : ""}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:"DM Sans",sans-serif; color:#1c1614; background:#faf8f5; padding:24px; font-size:13px; }
  @media print {
    body { padding:12px; background:white; }
    .no-print { display:none !important; }
    @page { margin:1.5cm; }
  }
</style>
</head><body>

<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid ${pal["accent-medium"]}">
  <div>
    <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;font-weight:700;color:#1c1614">${eventName ? eventName + " — Gift List" : "Gift List"}</div>
    ${dateStr ? `<div style="font-size:13px;color:#5c5248;margin-top:2px">${dateStr}</div>` : ""}
  </div>
  <div style="text-align:right">
    <div style="font-size:11px;color:#9c9188">${gifts.length} gift${gifts.length!==1?"s":""} · Total monetary value: $${totalMonetary.toLocaleString()}</div>
    <div style="font-size:11px;color:#9c9188;margin-top:2px">Generated ${new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>
  </div>
</div>

<button class="no-print" onclick="window.print()"
  style="margin-bottom:20px;padding:8px 18px;background:${pal.accent};color:${pal["accent-text"]};border:none;border-radius:6px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer">
  🖨 Print
</button>

${donorBlocks || '<p style="color:#9c9188;font-style:italic">No gifts recorded yet.</p>'}

<div style="margin-top:32px;padding-top:12px;border-top:2px solid ${pal["accent-medium"]};display:flex;justify-content:space-between;align-items:center">
  <div style="font-size:11px;color:#9c9188">SimchaKit by Brook Creative LLC · Gift List Export</div>
  <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;font-weight:700;color:#1c1614">
    Total: $${totalMonetary.toLocaleString()}
  </div>
</div>
</body></html>`;
}

function exportFavorsCSV(favors, favorConfig) {
  const getLastName = (name) => (name||"").trim().split(" ").pop();
  const sorted = [...favors].sort((a,b) => getLastName(a.personName).localeCompare(getLastName(b.personName)));
  const headers = [
    ...(favorConfig.needsSizing     ? ["Size"]      : []),
    "Guest Name",
    ...(favorConfig.isPersonalized  ? ["Name on Favor","Pre-Printed?"] : []),
    ...(favorConfig.trackAttendance ? ["Attending"]  : []),
    "Notes",
  ];
  const rows = sorted.map(f => [
    ...(favorConfig.needsSizing     ? [f.size || ""]           : []),
    f.personName || "",
    ...(favorConfig.isPersonalized  ? [f.printName||"", f.preprint||"TBD"] : []),
    ...(favorConfig.trackAttendance ? [f.attending||"TBD"]      : []),
    f.notes || "",
  ].map(csvEsc).join(","));
  return [headers.map(csvEsc).join(","), ...rows].join("\n");
}

function generateFavorPrintHTML(favors, favorConfig, eventName, eventDate, theme) {
  const pal = PALETTES[theme?.palette] || PALETTES.rose;
  const getLastName = (name) => (name||"").trim().split(" ").pop();
  const sorted = [...favors].sort((a,b) => getLastName(a.personName).localeCompare(getLastName(b.personName)));

  const dateStr = eventDate
    ? new Date(eventDate + "T00:00:00").toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" })
    : "";

  // Size summary
  let sizeSummaryHTML = "";
  if (favorConfig.needsSizing) {
    const sizeCounts = {};
    sorted.forEach(f => { sizeCounts[f.size||"TBD"] = (sizeCounts[f.size||"TBD"]||0) + 1; });
    const badges = Object.entries(sizeCounts)
      .sort((a,b) => a[0].localeCompare(b[0]))
      .map(([size, count]) => `<span style="display:inline-block;background:${pal["accent-light"]};border:1px solid ${pal["accent-medium"]};border-radius:6px;padding:3px 10px;font-size:12px;font-weight:600;margin:2px 4px 2px 0">${size}: ${count}</span>`)
      .join("");
    sizeSummaryHTML = `
      <div style="margin-bottom:20px;padding:12px 16px;background:${pal["accent-light"]};border:1px solid ${pal["accent-medium"]};border-radius:8px">
        <div style="font-size:11px;font-weight:700;color:#9c9188;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Size Totals</div>
        <div>${badges}</div>
        <div style="margin-top:8px;font-size:12px;color:#5c5248;font-weight:600">Total: ${sorted.length}</div>
      </div>`;
  }

  // Group by size if sizing on, otherwise flat
  let bodyHTML = "";
  if (favorConfig.needsSizing) {
    const bySize = {};
    sorted.forEach(f => {
      const s = f.size || "TBD";
      if (!bySize[s]) bySize[s] = [];
      bySize[s].push(f);
    });
    bodyHTML = Object.entries(bySize).sort((a,b) => a[0].localeCompare(b[0])).map(([size, items]) => `
      <div style="margin-bottom:20px;page-break-inside:avoid">
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;font-weight:700;color:#1c1614;padding:6px 10px;background:${pal["accent-light"]};border-radius:6px 6px 0 0;border:1px solid ${pal["accent-medium"]};border-bottom:none">
          ${size} <span style="font-size:12px;font-weight:400;color:#5c5248">(${items.length})</span>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid ${pal["accent-medium"]};border-radius:0 0 6px 6px;overflow:hidden;font-size:12px">
          <thead><tr style="background:${pal["accent-light"]}">
            <th style="padding:5px 8px;text-align:left;font-weight:700;color:#9c9188;font-size:11px;text-transform:uppercase;border-bottom:1px solid ${pal["accent-medium"]}">Name</th>
            ${favorConfig.isPersonalized ? `<th style="padding:5px 8px;text-align:left;font-weight:700;color:#9c9188;font-size:11px;text-transform:uppercase;border-bottom:1px solid ${pal["accent-medium"]}">Name on Favor</th><th style="padding:5px 8px;text-align:center;font-weight:700;color:#9c9188;font-size:11px;text-transform:uppercase;border-bottom:1px solid ${pal["accent-medium"]}">Pre-Printed?</th>` : ""}
            ${favorConfig.trackAttendance ? `<th style="padding:5px 8px;text-align:center;font-weight:700;color:#9c9188;font-size:11px;text-transform:uppercase;border-bottom:1px solid ${pal["accent-medium"]}">Attending</th>` : ""}
          </tr></thead>
          <tbody>
            ${items.map(f => `<tr style="border-bottom:1px solid #f0ece6">
              <td style="padding:5px 8px;font-weight:500">${f.personName||""}</td>
              ${favorConfig.isPersonalized ? `<td style="padding:5px 8px;color:#5c5248">${f.printName||""}</td><td style="padding:5px 8px;text-align:center;color:#5c5248">${f.preprint||"TBD"}</td>` : ""}
              ${favorConfig.trackAttendance ? `<td style="padding:5px 8px;text-align:center;color:#5c5248">${f.attending||"TBD"}</td>` : ""}
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`).join("");
  } else {
    bodyHTML = `
      <table style="width:100%;border-collapse:collapse;border:1px solid ${pal["accent-medium"]};border-radius:6px;overflow:hidden;font-size:12px">
        <thead><tr style="background:${pal["accent-light"]}">
          <th style="padding:5px 8px;text-align:left;font-weight:700;color:#9c9188;font-size:11px;text-transform:uppercase;border-bottom:1px solid ${pal["accent-medium"]}">Name</th>
          ${favorConfig.isPersonalized ? `<th style="padding:5px 8px;text-align:left;font-weight:700;color:#9c9188;font-size:11px;text-transform:uppercase;border-bottom:1px solid ${pal["accent-medium"]}">Name on Favor</th><th style="padding:5px 8px;text-align:center;font-weight:700;color:#9c9188;font-size:11px;text-transform:uppercase;border-bottom:1px solid ${pal["accent-medium"]}">Pre-Printed?</th>` : ""}
          ${favorConfig.trackAttendance ? `<th style="padding:5px 8px;text-align:center;font-weight:700;color:#9c9188;font-size:11px;text-transform:uppercase;border-bottom:1px solid ${pal["accent-medium"]}">Attending</th>` : ""}
        </tr></thead>
        <tbody>
          ${sorted.map(f => `<tr style="border-bottom:1px solid #f0ece6">
            <td style="padding:5px 8px;font-weight:500">${f.personName||""}</td>
            ${favorConfig.isPersonalized ? `<td style="padding:5px 8px;color:#5c5248">${f.printName||""}</td><td style="padding:5px 8px;text-align:center;color:#5c5248">${f.preprint||"TBD"}</td>` : ""}
            ${favorConfig.trackAttendance ? `<td style="padding:5px 8px;text-align:center;color:#5c5248">${f.attending||"TBD"}</td>` : ""}
          </tr>`).join("")}
        </tbody>
      </table>`;
  }

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>Favor List${eventName ? " — " + eventName : ""}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:"DM Sans",sans-serif; color:#1c1614; background:#faf8f5; padding:24px; font-size:13px; }
  @media print { body { padding:12px; background:white; } .no-print { display:none !important; } @page { margin:1.5cm; } }
</style>
</head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid ${pal["accent-medium"]}">
  <div>
    <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;font-weight:700">${eventName ? eventName + " — " : ""}${favorConfig.favorDescription || "Favor List"}</div>
    ${dateStr ? `<div style="font-size:13px;color:#5c5248;margin-top:2px">${dateStr}</div>` : ""}
  </div>
  <div style="text-align:right">
    <div style="font-size:11px;color:#9c9188">${sorted.length} recipient${sorted.length!==1?"s":""}</div>
    <div style="font-size:11px;color:#9c9188;margin-top:2px">Generated ${new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>
  </div>
</div>
<button class="no-print" onclick="window.print()" style="margin-bottom:20px;padding:8px 18px;background:${pal.accent};color:${pal["accent-text"]};border:none;border-radius:6px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer">🖨 Print</button>
${sizeSummaryHTML}
${bodyHTML}
<div style="margin-top:32px;padding-top:12px;border-top:1px solid ${pal["accent-medium"]};font-size:11px;color:#9c9188">SimchaKit by Brook Creative LLC · Favor List Export</div>
</body></html>`;
}

function generateEventBriefHTML(state, adminConfig) {
  const config     = adminConfig || {};
  const pal        = PALETTES[config.theme?.palette] || PALETTES.rose;
  const people     = state?.people     || [];
  const households = state?.households || [];
  const expenses   = state?.expenses   || [];
  const vendors    = state?.vendors    || [];
  const tasks      = state?.tasks      || [];
  const ceremonyRoles = state?.ceremonyRoles || [];

  const timeline    = sortTimeline(config.timeline || []);
  const mainEvent   = timeline.find(e => e.isMainEvent) || null;
  const eventName   = config.name || "Event";
  const eventDate   = mainEvent?.startDate || "";
  const eventVenue  = mainEvent?.venue || "";
  const generatedAt = new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" });

  const dateStr = eventDate
    ? new Date(eventDate + "T00:00:00").toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" })
    : "";

  // ── Guest summary ──────────────────────────────────────────────────────────
  const totalPeople   = people.length;
  const confirmedHH   = households.filter(h => h.status === "RSVP Yes");
  const pendingHH     = households.filter(h => h.status === "Invited" || h.status === "Pending");
  const confirmedPpl  = confirmedHH.reduce((s, h) => {
    const a = getHouseholdAttending(h, people); return s + a.adults + a.kids;
  }, 0);
  const totalKids     = people.filter(p => p.isChild).length;
  const totalKosher   = people.filter(p => p.kosher).length;
  const dietaryPpl    = people.filter(p => p.dietary && p.dietary.trim());
  const outOfTown     = households.filter(h => h.outOfTown).length;

  // ── Vendor section (confirmed only) ───────────────────────────────────────
  const CONFIRMED_STATUSES = new Set(["Booked", "Deposit Paid", "Paid in Full"]);
  const confirmedVendors   = vendors.filter(v => CONFIRMED_STATUSES.has(v.status));
  const unconfirmedCount   = vendors.length - confirmedVendors.length;

  // ── Tasks section (incomplete, sorted by due date) ─────────────────────────
  const realTasks    = tasks.filter(t => !t.dismissed);
  const openTasks    = realTasks
    .filter(t => !t.done && t.due)
    .sort((a, b) => new Date(a.due) - new Date(b.due));
  const today        = new Date(); today.setHours(0,0,0,0);
  const overdue      = openTasks.filter(t => new Date(t.due + "T00:00:00") < today);
  const upcoming     = openTasks.filter(t => new Date(t.due + "T00:00:00") >= today).slice(0, 10);

  // ── HTML helpers ───────────────────────────────────────────────────────────
  const badge = (text, bg, color) =>
    `<span style="display:inline-block;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;background:${bg};color:${color};margin-left:4px">${text}</span>`;

  const sectionHead = (title) =>
    `<div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;font-weight:700;color:#1c1614;
      margin:32px 0 12px;padding-bottom:8px;border-bottom:2px solid ${pal["accent-medium"]}">${title}</div>`;

  // ── Timeline HTML ──────────────────────────────────────────────────────────
  const timelineRows = timeline.map(e => {
    const d = e.startDate
      ? new Date(e.startDate + "T00:00:00").toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" })
      : "";
    const mainBadge = e.isMainEvent ? badge("Main Event", pal["accent-light"], pal["accent"]) : "";
    return `<tr>
      <td style="padding:7px 10px;border-bottom:1px solid #f0ece6;font-size:18px;width:32px">${e.icon || "📅"}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f0ece6;font-weight:600;color:#1c1614">${e.title || ""}${mainBadge}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f0ece6;color:#5c5248;font-size:12px;white-space:nowrap">${d}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f0ece6;color:#5c5248;font-size:12px">${formatEntryMeta(e).replace(d, "").replace(/^[·\s]+/, "")}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f0ece6;color:#5c5248;font-size:12px">${e.venue || ""}</td>
    </tr>`;
  }).join("");

  // ── Sub-Event Attendance ────────────────────────────────────────────────────
  const subEventAttendance = timeline.map(e => {
    // Find households invited to this sub-event
    const invitedHH = households.filter(h => (h.invitedSections || []).includes(e.id));
    const invitedHouseholdIds = new Set(invitedHH.map(h => h.id));
    
    // Count people in those households (invited) - use normalized model
    const invitedPeople = people.filter(p => invitedHouseholdIds.has(p.householdId));
    const invitedAdults = invitedPeople.filter(p => !p.isChild).length;
    const invitedKids = invitedPeople.filter(p => p.isChild).length;
    
    // Count people confirmed for this sub-event
    const confirmedPeople = people.filter(p => (p.attendingSections || []).includes(e.id));
    const confirmedAdults = confirmedPeople.filter(p => !p.isChild).length;
    const confirmedKids = confirmedPeople.filter(p => p.isChild).length;
    return {
      id: e.id,
      icon: e.icon || "📅",
      title: e.title,
      date: e.startDate ? new Date(e.startDate + "T00:00:00").toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" }) : "",
      invitedAdults,
      invitedKids,
      invitedTotal: invitedAdults + invitedKids,
      confirmedAdults,
      confirmedKids,
      confirmedTotal: confirmedAdults + confirmedKids,
      pending: (invitedAdults + invitedKids) - (confirmedAdults + confirmedKids),
    };
  }).filter(e => e.invitedTotal > 0); // Only show sub-events that have invitations

  const subEventHTML = subEventAttendance.length > 0
    ? subEventAttendance.map(e => `
        <div style="margin-bottom:14px;padding:12px 14px;background:#faf8f5;border:1px solid #e2ddd5;border-radius:8px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="font-size:16px">${e.icon}</span>
            <span style="font-weight:600;font-size:14px;color:#1c1614">${e.title}</span>
            ${e.date ? `<span style="font-size:11px;color:#9c9188;margin-left:auto">${e.date}</span>` : ""}
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:12px">
            <div>
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#9c9188;margin-bottom:2px">Invited</div>
              <div style="font-weight:600;color:#1c1614">${e.invitedTotal} <span style="font-weight:400;color:#5c5248">(${e.invitedAdults} adults, ${e.invitedKids} kids)</span></div>
            </div>
            <div>
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#9c9188;margin-bottom:2px">Confirmed</div>
              <div style="font-weight:600;color:#2d6a4f">${e.confirmedTotal} <span style="font-weight:400;color:#5c5248">(${e.confirmedAdults} adults, ${e.confirmedKids} kids)</span></div>
            </div>
            <div>
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#9c9188;margin-bottom:2px">Pending</div>
              <div style="font-weight:600;color:${e.pending > 0 ? "#b8962e" : "#2d6a4f"}">${e.pending}</div>
            </div>
          </div>
        </div>
      `).join("")
    : "";

  // ── Guest summary HTML ─────────────────────────────────────────────────────
  const statBox = (label, value, color) =>
    `<div style="background:#faf8f5;border:1px solid #e2ddd5;border-radius:8px;padding:14px 16px;text-align:center;min-width:100px">
      <div style="font-size:24px;font-weight:800;color:${color || "#1c1614"};font-family:'Cormorant Garamond',Georgia,serif">${value}</div>
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#9c9188;margin-top:4px">${label}</div>
    </div>`;

  const dietaryRows = dietaryPpl.length > 0
    ? `<div style="margin-top:14px">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#9c9188;margin-bottom:6px">Dietary Requirements</div>
        ${dietaryPpl.map(p => {
          const hh = households.find(h => h.id === p.householdId);
          const name = (p.firstName || p.lastName) ? `${p.firstName||""} ${p.lastName||""}`.trim() : (p.name || "");
          return `<div style="display:flex;gap:12px;padding:5px 0;border-bottom:1px solid #f0ece6;font-size:12px">
            <span style="font-weight:600;min-width:140px">${name}</span>
            <span style="color:#5c5248">${hh?.formalName || ""}</span>
            <span style="color:#9c4a12;margin-left:auto">${p.dietary}</span>
          </div>`;
        }).join("")}
      </div>` : "";

  // ── Vendor HTML ────────────────────────────────────────────────────────────
  const vendorCards = confirmedVendors.map(v => {
    const fin = computeVendorFinancials(v, expenses);
    const paidPct = fin.contractAmt > 0 ? Math.min(100, (fin.totalPaid / fin.contractAmt) * 100) : 0;
    const contact = [v.contactName, v.phone, v.email].filter(Boolean).join(" · ");
    return `<div style="border:1px solid #e2ddd5;border-radius:8px;padding:14px 16px;break-inside:avoid">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div>
          <div style="font-weight:700;font-size:14px;color:#1c1614">${v.name}</div>
          <div style="font-size:11px;color:#9c9188;margin-top:2px">${v.type} · ${v.status}</div>
        </div>
        ${fin.contractAmt > 0 ? `<div style="text-align:right;font-size:12px">
          <div style="font-weight:700;color:#1c1614">${fmt$(fin.contractAmt)}</div>
          <div style="color:${fin.totalScheduled > 0 ? "#b8962e" : "#3d7a5e"};font-size:11px">
            ${fin.totalScheduled > 0 ? fmt$(fin.totalScheduled) + " outstanding" : "Paid in full"}
          </div>
        </div>` : ""}
      </div>
      ${contact ? `<div style="font-size:12px;color:#5c5248;margin-bottom:6px">${contact}</div>` : ""}
      ${fin.contractAmt > 0 ? `<div style="background:#f0ece6;border-radius:99px;height:4px;overflow:hidden;margin-top:6px">
        <div style="height:100%;border-radius:99px;background:${pal["accent"]};width:${paidPct}%"></div>
      </div>` : ""}
    </div>`;
  }).join("");

  const unconfirmedNote = unconfirmedCount > 0
    ? `<div style="margin-top:12px;font-size:12px;color:#9c9188;font-style:italic">
        + ${unconfirmedCount} vendor${unconfirmedCount !== 1 ? "s" : ""} still in Researching or Contacted status not shown.
      </div>` : "";

  // ── Tasks HTML ─────────────────────────────────────────────────────────────
  const taskRow = (t, isOverdue) => {
    const dueDate = t.due
      ? new Date(t.due + "T00:00:00").toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })
      : "";
    const color = isOverdue ? "#9b2335" : "#b8962e";
    const bg    = isOverdue ? "#fde8e8" : "#fef8ec";
    return `<tr>
      <td style="padding:6px 10px;border-bottom:1px solid #f0ece6;font-size:13px;color:#1c1614">${t.name || t.task || ""}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f0ece6;font-size:11px;color:#9c9188;white-space:nowrap">${t.category || ""}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f0ece6;white-space:nowrap">
        <span style="font-size:11px;font-weight:700;color:${color};background:${bg};padding:2px 7px;border-radius:99px">${dueDate}</span>
      </td>
    </tr>`;
  };

  const overdueSection = overdue.length > 0
    ? `<div style="margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#9b2335;margin-bottom:6px">⚠ Overdue (${overdue.length})</div>
        <table style="width:100%;border-collapse:collapse">${overdue.map(t => taskRow(t, true)).join("")}</table>
      </div>` : "";

  const upcomingSection = upcoming.length > 0
    ? `<div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#9c9188;margin-bottom:6px">Upcoming</div>
        <table style="width:100%;border-collapse:collapse">${upcoming.map(t => taskRow(t, false)).join("")}</table>
      </div>` : "";

  const noTasksMsg = overdue.length === 0 && upcoming.length === 0
    ? `<div style="color:#9c9188;font-size:13px;font-style:italic">No open tasks with due dates.</div>` : "";

  // ── Ceremony Roles HTML ────────────────────────────────────────────────────
  const ceremonySections = [...new Set(ceremonyRoles.map(r => r.section).filter(Boolean))];
  const sortedRoles = [...ceremonyRoles].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const ceremonyHTML = ceremonySections.map(sec => {
    const sectionRoles = sortedRoles.filter(r => r.section === sec);
    const rows = sectionRoles.map(r => `<tr>
      <td style="padding:7px 10px;border-bottom:1px solid #f0ece6;font-weight:600;color:#1c1614;font-size:13px">${r.role || ""}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f0ece6;color:${r.assignee?.trim() ? pal["accent"] : "#9c9188"};font-size:13px;font-style:${r.assignee?.trim() ? "normal" : "italic"}">${r.assignee?.trim() || "Unassigned"}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f0ece6;color:#5c5248;font-size:12px">${r.hebrewName || ""}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f0ece6;color:#9c9188;font-size:11px">${r.notes || ""}</td>
    </tr>`).join("");
    return `<div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#9c9188;margin-bottom:6px">${sec}</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2ddd5;border-radius:8px;overflow:hidden">
        <thead><tr style="background:#faf8f5">
          <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#9c9188;border-bottom:2px solid #e2ddd5">Role</th>
          <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#9c9188;border-bottom:2px solid #e2ddd5">Assignee</th>
          <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#9c9188;border-bottom:2px solid #e2ddd5">Hebrew Name</th>
          <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#9c9188;border-bottom:2px solid #e2ddd5">Notes</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>Event Brief — ${eventName}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "DM Sans", sans-serif; color: #1c1614; background: white; padding: 28px 32px; font-size: 13px; }
  .vendor-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .stat-row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
  @media print {
    body { padding: 16px; }
    .no-print { display: none !important; }
    @page { margin: 1.5cm; size: letter; }
    .vendor-grid { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 600px) { .vendor-grid { grid-template-columns: 1fr; } }
</style>
</head><body>

<!-- Header -->
<div style="padding:20px 24px;background:linear-gradient(135deg,${pal["header-bg"]},${pal["accent"]});border-radius:10px;color:white;margin-bottom:8px">
  <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:30px;font-weight:700;line-height:1.1">${eventName}</div>
  ${dateStr ? `<div style="font-size:14px;opacity:0.9;margin-top:4px">${dateStr}</div>` : ""}
  ${eventVenue ? `<div style="font-size:13px;opacity:0.8;margin-top:2px">📍 ${eventVenue}</div>` : ""}
</div>
<div style="text-align:right;font-size:11px;color:#9c9188;margin-bottom:4px">
  Event brief generated ${generatedAt} · SimchaKit by Brook Creative LLC
</div>

<button class="no-print" onclick="window.print()"
  style="margin-bottom:20px;padding:8px 18px;background:${pal["accent"]};color:white;border:none;border-radius:6px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer">
  🖨 Print / Save as PDF
</button>

<!-- Timeline -->
${sectionHead("📅 Event Timeline")}
${timeline.length > 0
  ? `<table style="width:100%;border-collapse:collapse;border:1px solid #e2ddd5;border-radius:8px;overflow:hidden">
      <thead>
        <tr style="background:#faf8f5">
          <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#9c9188;border-bottom:2px solid #e2ddd5"></th>
          <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#9c9188;border-bottom:2px solid #e2ddd5">Event</th>
          <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#9c9188;border-bottom:2px solid #e2ddd5">Date</th>
          <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#9c9188;border-bottom:2px solid #e2ddd5">Time</th>
          <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#9c9188;border-bottom:2px solid #e2ddd5">Venue</th>
        </tr>
      </thead>
      <tbody>${timelineRows}</tbody>
    </table>`
  : `<div style="color:#9c9188;font-size:13px;font-style:italic">No timeline events configured.</div>`}

${subEventAttendance.length > 0 ? `
<!-- Sub-Event Attendance -->
${sectionHead("📊 Sub-Event Attendance")}
${subEventHTML}
` : ""}

<!-- Guest Summary -->
${sectionHead("👥 Guest Summary")}
<div class="stat-row">
  ${statBox("Invited", totalPeople, "#1c1614")}
  ${statBox("Confirmed", confirmedPpl, "#2d6a4f")}
  ${statBox("Pending", pendingHH.reduce((s,h)=>s+(h.adultCount||0)+(h.kidCount||0),0)||pendingHH.length, "#b8962e")}
  ${statBox("Kids", totalKids, "#1c1614")}
  ${statBox("Kosher Meals", totalKosher, "#1c1614")}
  ${statBox("Out of Town", outOfTown, "#1c1614")}
</div>
${dietaryRows}

<!-- Vendors -->
${sectionHead("🏪 Confirmed Vendors")}
${confirmedVendors.length > 0
  ? `<div class="vendor-grid">${vendorCards}</div>${unconfirmedNote}`
  : `<div style="color:#9c9188;font-size:13px;font-style:italic">No confirmed vendors yet.</div>`}

<!-- Open Tasks -->
${sectionHead("✅ Open Tasks")}
${overdueSection}${upcomingSection}${noTasksMsg}
${realTasks.filter(t=>!t.done&&!t.due).length > 0
  ? `<div style="margin-top:10px;font-size:12px;color:#9c9188;font-style:italic">
      + ${realTasks.filter(t=>!t.done&&!t.due).length} task${realTasks.filter(t=>!t.done&&!t.due).length!==1?"s":""} with no due date not shown.
    </div>` : ""}

${ceremonyRoles.length > 0 ? `
<!-- Ceremony Roles -->
${sectionHead("✡ Ceremony Roles")}
${ceremonyHTML}
` : ""}

${config.notes && config.notes.trim() ? `
<!-- Organizer Notes -->
${sectionHead("📝 Organizer Notes")}
<div style="background:#faf8f5;border:1px solid #e2ddd5;border-radius:8px;padding:14px 16px;font-size:13px;color:#1c1614;line-height:1.7;white-space:pre-wrap">${config.notes.trim()}</div>
` : ""}

<div style="margin-top:36px;padding-top:12px;border-top:1px solid #e2ddd5;text-align:center;font-size:11px;color:#9c9188">
  SimchaKit by Brook Creative LLC · Event Brief · ${generatedAt}
</div>
</body></html>`;
}

export {
  csvEsc,
  exportExpensesCSV,
  exportSeatingByTable,
  exportSeatingByPerson,
  generateSeatingPrintHTML,
  exportGiftsCSV,
  generateGiftPrintHTML,
  exportFavorsCSV,
  generateFavorPrintHTML,
  generateEventBriefHTML,
};
