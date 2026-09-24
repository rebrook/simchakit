import { useState } from "react";
import { DEFAULT_MEALS } from "@/constants/guest-constants.js";
import { isInvited, getPersonSectionStatus } from "@/utils/sections.js";
import { sortTimeline } from "@/utils/dates.js";

export function CateringSummary({ people, households, adminConfig }) {
  const [open,    setOpen]    = useState(false);
  const [copyMsg, setCopyMsg] = useState({}); // keyed per-section id, plus "all"

  const style      = adminConfig?.cateringStyle || "plated";
  const meals      = adminConfig?.mealChoices   || DEFAULT_MEALS;
  const eventName  = adminConfig?.name          || "Event";
  const mainEvent  = (adminConfig?.timeline || []).find(e => e.isMainEvent) || null;
  const eventDate  = mainEvent?.startDate
    ? new Date(mainEvent.startDate + "T00:00:00").toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" })
    : "";

  const hhById = (id) => households.find(h => h.id === id);
  const getPersonName = (p) =>
    (p.firstName||p.lastName) ? `${p.firstName||""} ${p.lastName||""}`.trim() : (p.name||"");
  const getHHName = (p) => hhById(p.householdId)?.formalName || "";

  const setMsg = (key, msg) => setCopyMsg(m => ({ ...m, [key]: msg }));

  // ── Sub-event resolution ──────────────────────────────────────────────
  // A timeline entry becomes a "meal section" once flagged servesMeal in
  // Admin Mode -> Timeline. Multiple sections are common (Friday night
  // dinner, Sunday brunch, main reception can all be separate catering
  // orders), so each gets its own breakout below rather than one merged
  // number that would conflate different meals with different vendors.
  const mealSections = sortTimeline(adminConfig?.timeline || []).filter(e => e.servesMeal);
  const preciseMode  = mealSections.length > 0;

  // ── Precise mode: one breakout per flagged sub-event ───────────────────
  const sectionBreakouts = preciseMode ? mealSections.map(section => {
    const relevant = people.filter(p => {
      const hh = hhById(p.householdId);
      if (!hh || !isInvited(hh, section)) return false;
      return getPersonSectionStatus(p, section) !== "No"; // declined this section -> excluded entirely
    });
    const confirmed = relevant.filter(p => getPersonSectionStatus(p, section) === "Yes");

    const mealCounts = {};
    confirmed.forEach(p => { const m = p.mealChoice||""; if (m) mealCounts[m] = (mealCounts[m]||0)+1; });
    const mealTotals = {};
    relevant.forEach(p => { const m = p.mealChoice||""; if (m) mealTotals[m] = (mealTotals[m]||0)+1; });
    const noMealChoice = confirmed.filter(p => !p.mealChoice).length;

    const kosherConfirmed = confirmed.filter(p => p.kosher).length;
    const kosherTotal     = relevant.filter(p => p.kosher).length;

    return { section, relevant, confirmed, mealCounts, mealTotals, noMealChoice, kosherConfirmed, kosherTotal };
  }) : [];

  // ── Fallback mode: no sub-event flagged yet, behaves exactly as before ──
  const confirmedHHIds        = new Set(households.filter(h => h.rsvpStatus === "RSVP Yes").map(h => h.id));
  const fallbackConfirmed     = people.filter(p => confirmedHHIds.has(p.householdId));
  const fallbackMealCounts    = {};
  fallbackConfirmed.forEach(p => { const m = p.mealChoice||""; if (m) fallbackMealCounts[m] = (fallbackMealCounts[m]||0)+1; });
  const fallbackMealTotals    = {};
  people.forEach(p => { const m = p.mealChoice||""; if (m) fallbackMealTotals[m] = (fallbackMealTotals[m]||0)+1; });
  const fallbackNoMealChoice     = fallbackConfirmed.filter(p => !p.mealChoice).length;
  const fallbackKosherConfirmed  = fallbackConfirmed.filter(p => p.kosher).length;
  const fallbackKosherTotal      = people.filter(p => p.kosher).length;

  // ── Top-of-card numbers: deduped union across sections in precise mode --
  // this is the number that answers "how many people are you inviting" ----
  let unionRelevantPeople, unionConfirmedPeople;
  if (preciseMode) {
    const relevantMap  = new Map();
    const confirmedMap = new Map();
    sectionBreakouts.forEach(b => {
      b.relevant.forEach(p => relevantMap.set(p.id, p));
      b.confirmed.forEach(p => confirmedMap.set(p.id, p));
    });
    unionRelevantPeople  = [...relevantMap.values()];
    unionConfirmedPeople = [...confirmedMap.values()];
  } else {
    unionRelevantPeople  = people;
    unionConfirmedPeople = fallbackConfirmed;
  }
  const totalConfirmed    = unionConfirmedPeople.length;
  const totalInvited      = unionRelevantPeople.length;
  const unconfirmed       = totalInvited - totalConfirmed;
  const unionConfirmedIds = new Set(unionConfirmedPeople.map(p => p.id));

  // ── Unified Dietary Requirements list, tagged per section ──────────────
  // dietary/kosher are single fields on the person record (don't vary by
  // sub-event), so each person appears once, tagged with every meal section
  // they're relevant for.
  const dietaryPeople = unionRelevantPeople
    .filter(p => (p.dietary && p.dietary.trim()) || p.kosher)
    .map(p => ({
      person: p,
      tags: preciseMode
        ? sectionBreakouts
            .filter(b => b.relevant.some(rp => rp.id === p.id))
            .map(b => ({ section: b.section, confirmed: b.confirmed.some(cp => cp.id === p.id) }))
        : [],
    }))
    .sort((a, b) => {
      const lastNameOf = (p) => (p.lastName || (p.name||"").split(" ").pop() || "").toLowerCase();
      return lastNameOf(a.person).localeCompare(lastNameOf(b.person));
    });

  // ── Copy handlers ────────────────────────────────────────────────────
  const buildHeaderLines = () => ([
    `CATERING SUMMARY: ${eventName}${eventDate ? ` (${eventDate})` : ""}`,
    `Generated: ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}`,
  ]);

  const buildSectionLines = (b) => {
    const lines = [];
    lines.push(`${b.section.icon ? b.section.icon + " " : ""}${b.section.title.toUpperCase()}`);
    lines.push(`  Confirmed: ${b.confirmed.length}    Invited: ${b.relevant.length}`);
    if (style === "plated") {
      lines.push("  Meal Choices (confirmed):");
      [...new Set([...meals, ...Object.keys(b.mealCounts)])].forEach(m => {
        const cnt = b.mealCounts[m] || 0;
        if (cnt > 0) lines.push(`    ${m.padEnd(20)} ${cnt}`);
      });
      if (b.noMealChoice > 0) lines.push(`    ${"No selection".padEnd(20)} ${b.noMealChoice}`);
    }
    if (style !== "buffet-headcount") {
      lines.push(`  Kosher meals: ${b.kosherConfirmed}${b.kosherTotal!==b.kosherConfirmed?` (${b.kosherTotal} total invited)`:""}`);
    }
    return lines;
  };

  const buildDietaryLines = () => {
    if (dietaryPeople.length === 0) return [];
    const lines = ["", "DIETARY REQUIREMENTS"];
    dietaryPeople.forEach(({ person: p, tags }) => {
      const tagText = preciseMode
        ? tags.map(t => `${t.section.title}: ${t.confirmed ? "✓" : "?"}`).join(", ")
        : (unionConfirmedIds.has(p.id) ? "✓ Confirmed" : "? Pending");
      lines.push(`  ${getPersonName(p)} (${getHHName(p)}): ${p.dietary || "Kosher meal"} [${tagText}]`);
    });
    lines.push("  (✓ = confirmed attending that sub-event, ? = RSVP pending)");
    return lines;
  };

  const handleCopyAll = () => {
    const lines = [...buildHeaderLines(), ""];
    lines.push(`CONFIRMED ATTENDING: ${totalConfirmed}`);
    lines.push(`TOTAL INVITED:       ${totalInvited}`);
    if (unconfirmed > 0) lines.push(`AWAITING RSVP:       ${unconfirmed}`);
    if (preciseMode) {
      sectionBreakouts.forEach(b => { lines.push(""); lines.push(...buildSectionLines(b)); });
    } else {
      if (style === "plated") {
        lines.push("");
        lines.push("MEAL CHOICES (confirmed attending)");
        [...new Set([...meals, ...Object.keys(fallbackMealCounts)])].forEach(m => {
          const cnt = fallbackMealCounts[m] || 0;
          if (cnt > 0) lines.push(`  ${m.padEnd(20)} ${cnt}`);
        });
        if (fallbackNoMealChoice > 0) lines.push(`  ${"No selection".padEnd(20)} ${fallbackNoMealChoice}`);
      }
      if (style !== "buffet-headcount") {
        lines.push("");
        lines.push(`KOSHER MEALS: ${fallbackKosherConfirmed}${fallbackKosherTotal!==fallbackKosherConfirmed?` (${fallbackKosherTotal} total invited)`:""}`);
      }
    }
    lines.push(...buildDietaryLines());
    navigator.clipboard.writeText(lines.join("\n"))
      .then(() => { setMsg("all","Copied!"); setTimeout(()=>setMsg("all",""),2500); })
      .catch(() => setMsg("all","Copy failed"));
  };

  const handleCopySection = (b) => {
    const lines = [...buildHeaderLines(), "", ...buildSectionLines(b)];
    navigator.clipboard.writeText(lines.join("\n"))
      .then(() => { setMsg(b.section.id,"Copied!"); setTimeout(()=>setMsg(b.section.id,""),2500); })
      .catch(() => setMsg(b.section.id,"Copy failed"));
  };

  if (people.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom:16 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer" }}
        onClick={() => setOpen(o => !o)}>
        <div>
          <div className="card-title" style={{ marginBottom:0 }}>🍽 Catering Summary</div>
          {!open && (
            <div className="card-subtitle" style={{ marginBottom:0, marginTop:3 }}>
              {totalConfirmed} confirmed · {totalInvited} invited
              {!preciseMode && style === "plated" && Object.keys(fallbackMealCounts).length > 0 &&
                ` · ${Object.keys(fallbackMealCounts).length} meal choice${Object.keys(fallbackMealCounts).length!==1?"s":""}`}
              {!preciseMode && style !== "buffet-headcount" && fallbackKosherTotal > 0 && ` · ${fallbackKosherConfirmed} kosher`}
              {preciseMode && ` · ${mealSections.length} sub-event${mealSections.length!==1?"s":""}`}
              {" · click to expand"}
            </div>
          )}
        </div>
        <button style={{ background:"none", border:"none", cursor:"pointer",
          fontSize:18, color:"var(--text-muted)", padding:"0 4px", lineHeight:1 }}>
          {open ? "▴" : "▾"}
        </button>
      </div>

      {open && (
        <div style={{ marginTop:16 }}>
          <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:16 }}>
            {[
              { label:"Confirmed Attending", value:totalConfirmed, cls:"stat-green" },
              { label:"Total Invited",        value:totalInvited,   cls:""           },
              { label:"Awaiting RSVP",        value:unconfirmed,    cls:unconfirmed>0?"stat-gold":"stat-green" },
            ].map(s => (
              <div key={s.label} className="stat-card" style={{ flex:"1 1 110px", minWidth:100, padding:"12px 14px" }}>
                <div className="stat-label">{s.label}</div>
                <div className={`stat-value ${s.cls}`} style={{ fontSize:22 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {!preciseMode && (
            <div className="alert alert-info" style={{ marginBottom:16, fontSize:13 }}>
              Flag a sub-event as "Meal served at this sub-event" in Admin Mode → Timeline for precise per-event catering counts. Showing totals for the whole guest list until then.
            </div>
          )}

          {!preciseMode && style === "plated" && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", color:"var(--text-muted)", marginBottom:8 }}>
                Meal Choices — Confirmed Attending
              </div>
              <div style={{ border:"1px solid var(--border)", borderRadius:"var(--radius-md)", overflow:"hidden" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                  <thead>
                    <tr style={{ background:"var(--bg-subtle)" }}>
                      {["Meal","Confirmed","Total Invited"].map((h,i) => (
                        <th key={h} style={{ padding:"8px 12px", textAlign:i===0?"left":"right", fontWeight:700, fontSize:11, textTransform:"uppercase", letterSpacing:"0.05em", color:"var(--text-muted)", borderBottom:"1px solid var(--border)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...new Set([...meals,...Object.keys(fallbackMealCounts)])].map((m,i,arr) => (
                      <tr key={m} style={{ borderBottom:i<arr.length-1?"1px solid var(--border)":"none" }}>
                        <td style={{ padding:"8px 12px", fontWeight:500 }}>{m}</td>
                        <td style={{ padding:"8px 12px", textAlign:"right", fontWeight:700, color:(fallbackMealCounts[m]||0)>0?"var(--text-primary)":"var(--text-muted)" }}>{fallbackMealCounts[m]||0}</td>
                        <td style={{ padding:"8px 12px", textAlign:"right", color:"var(--text-muted)" }}>{fallbackMealTotals[m]||0}</td>
                      </tr>
                    ))}
                    {fallbackNoMealChoice > 0 && (
                      <tr style={{ borderTop:"1px solid var(--border)", background:"var(--bg-subtle)" }}>
                        <td style={{ padding:"8px 12px", color:"var(--text-muted)", fontStyle:"italic" }}>No selection</td>
                        <td style={{ padding:"8px 12px", textAlign:"right", color:"var(--orange)", fontWeight:700 }}>{fallbackNoMealChoice}</td>
                        <td style={{ padding:"8px 12px", textAlign:"right", color:"var(--text-muted)" }}>—</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!preciseMode && style !== "buffet-headcount" && (
            <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:16, padding:"10px 14px", background:"var(--bg-subtle)", borderRadius:"var(--radius-md)", border:"1px solid var(--border)" }}>
              <span style={{ fontSize:16 }}>✡</span>
              <span style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)" }}>Kosher meals required:</span>
              <span style={{ fontSize:18, fontWeight:800, color:"var(--accent-primary)", fontFamily:"var(--font-display)" }}>{fallbackKosherConfirmed}</span>
              {fallbackKosherTotal !== fallbackKosherConfirmed && (
                <span style={{ fontSize:12, color:"var(--text-muted)" }}>({fallbackKosherTotal} total invited · {fallbackKosherTotal-fallbackKosherConfirmed} RSVP pending)</span>
              )}
            </div>
          )}

          {!preciseMode && style === "buffet-headcount" && (
            <div style={{ fontSize:13, color:"var(--text-muted)", fontStyle:"italic", padding:"10px 14px", background:"var(--bg-subtle)", borderRadius:"var(--radius-md)", border:"1px solid var(--border)", marginBottom:16 }}>
              Buffet style. No individual meal selections tracked. Provide confirmed headcount to caterer.
            </div>
          )}

          {preciseMode && sectionBreakouts.map(b => (
            <div key={b.section.id} style={{ marginBottom:20, border:"1px solid var(--border)", borderRadius:"var(--radius-md)", padding:14, background:"var(--bg-subtle)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, flexWrap:"wrap", gap:8 }}>
                <div style={{ fontSize:14, fontWeight:700, color:"var(--text-primary)" }}>
                  {b.section.icon ? b.section.icon + " " : ""}{b.section.title}
                  <span style={{ fontWeight:400, fontSize:12, color:"var(--text-muted)", marginLeft:8 }}>
                    {b.confirmed.length} confirmed · {b.relevant.length} invited
                  </span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={()=>handleCopySection(b)}>{copyMsg[b.section.id] || "📋 Copy this section"}</button>
              </div>

              {style === "plated" && (
                <div style={{ marginBottom:12 }}>
                  <div style={{ border:"1px solid var(--border)", borderRadius:"var(--radius-md)", overflow:"hidden", background:"var(--bg-surface)" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                      <thead>
                        <tr style={{ background:"var(--bg-subtle)" }}>
                          {["Meal","Confirmed","Invited"].map((h,i) => (
                            <th key={h} style={{ padding:"7px 10px", textAlign:i===0?"left":"right", fontWeight:700, fontSize:11, textTransform:"uppercase", letterSpacing:"0.05em", color:"var(--text-muted)", borderBottom:"1px solid var(--border)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...new Set([...meals,...Object.keys(b.mealCounts)])].map((m,i,arr) => (
                          <tr key={m} style={{ borderBottom:i<arr.length-1?"1px solid var(--border)":"none" }}>
                            <td style={{ padding:"7px 10px", fontWeight:500 }}>{m}</td>
                            <td style={{ padding:"7px 10px", textAlign:"right", fontWeight:700, color:(b.mealCounts[m]||0)>0?"var(--text-primary)":"var(--text-muted)" }}>{b.mealCounts[m]||0}</td>
                            <td style={{ padding:"7px 10px", textAlign:"right", color:"var(--text-muted)" }}>{b.mealTotals[m]||0}</td>
                          </tr>
                        ))}
                        {b.noMealChoice > 0 && (
                          <tr style={{ borderTop:"1px solid var(--border)", background:"var(--bg-subtle)" }}>
                            <td style={{ padding:"7px 10px", color:"var(--text-muted)", fontStyle:"italic" }}>No selection</td>
                            <td style={{ padding:"7px 10px", textAlign:"right", color:"var(--orange)", fontWeight:700 }}>{b.noMealChoice}</td>
                            <td style={{ padding:"7px 10px", textAlign:"right", color:"var(--text-muted)" }}>—</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {style !== "buffet-headcount" && (
                <div style={{ display:"flex", gap:8, alignItems:"center", padding:"8px 12px", background:"var(--bg-surface)", borderRadius:"var(--radius-md)", border:"1px solid var(--border)" }}>
                  <span style={{ fontSize:15 }}>✡</span>
                  <span style={{ fontSize:12, fontWeight:600, color:"var(--text-primary)" }}>Kosher meals required:</span>
                  <span style={{ fontSize:16, fontWeight:800, color:"var(--accent-primary)", fontFamily:"var(--font-display)" }}>{b.kosherConfirmed}</span>
                  {b.kosherTotal !== b.kosherConfirmed && (
                    <span style={{ fontSize:11, color:"var(--text-muted)" }}>({b.kosherTotal} total invited · {b.kosherTotal-b.kosherConfirmed} RSVP pending)</span>
                  )}
                </div>
              )}

              {style === "buffet-headcount" && (
                <div style={{ fontSize:12, color:"var(--text-muted)", fontStyle:"italic", padding:"8px 12px", background:"var(--bg-surface)", borderRadius:"var(--radius-md)", border:"1px solid var(--border)" }}>
                  Buffet style. No individual meal selections tracked. Provide confirmed headcount to caterer.
                </div>
              )}
            </div>
          ))}

          {dietaryPeople.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", color:"var(--text-muted)", marginBottom:8 }}>
                Dietary Requirements ({dietaryPeople.length} guest{dietaryPeople.length!==1?"s":""})
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                {dietaryPeople.map(({ person: p, tags }) => (
                  <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 12px", borderRadius:"var(--radius-sm)", background:"var(--bg-surface)", border:"1px solid var(--border)", fontSize:13, flexWrap:"wrap" }}>
                    {preciseMode ? (
                      <div style={{ display:"flex", gap:4, flexWrap:"wrap", flexShrink:0 }}>
                        {tags.map(t => (
                          <span key={t.section.id} style={{ fontSize:10, fontWeight:700, padding:"2px 6px", borderRadius:99, background:t.confirmed?"var(--green-light)":"var(--gold-light)", color:t.confirmed?"var(--green)":"var(--gold)" }}>
                            {t.section.title}: {t.confirmed?"✓":"?"}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize:10, fontWeight:700, padding:"2px 6px", borderRadius:99, flexShrink:0, background:unionConfirmedIds.has(p.id)?"var(--green-light)":"var(--gold-light)", color:unionConfirmedIds.has(p.id)?"var(--green)":"var(--gold)" }}>
                        {unionConfirmedIds.has(p.id)?"✓ Confirmed":"? Pending"}
                      </span>
                    )}
                    <span style={{ fontWeight:600, color:"var(--text-primary)" }}>{getPersonName(p)}</span>
                    <span style={{ color:"var(--text-muted)", fontSize:12 }}>{getHHName(p)}</span>
                    <span style={{ color:"var(--orange)", fontWeight:500, marginLeft:"auto", fontSize:12 }}>{p.dietary || "Kosher meal"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display:"flex", justifyContent:"flex-end" }}>
            <button className="btn btn-secondary btn-sm" onClick={handleCopyAll}>{copyMsg.all || (preciseMode ? "📋 Copy for caterer (all)" : "📋 Copy for caterer")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
