import { useState } from "react";
import { DEFAULT_MEALS } from "@/constants/guest-constants.js";

export function CateringSummary({ people, households, adminConfig }) {
  const [open,    setOpen]    = useState(false);
  const [copyMsg, setCopyMsg] = useState("");

  const style      = adminConfig?.cateringStyle || "plated";
  const meals      = adminConfig?.mealChoices   || DEFAULT_MEALS;
  const eventName  = adminConfig?.name          || "Event";
  const mainEvent  = (adminConfig?.timeline || []).find(e => e.isMainEvent) || null;
  const eventDate  = mainEvent?.startDate
    ? new Date(mainEvent.startDate + "T00:00:00").toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" })
    : "";

  const confirmedHHIds  = new Set(households.filter(h => h.status === "RSVP Yes").map(h => h.id));
  const confirmedPeople = people.filter(p => confirmedHHIds.has(p.householdId));
  const totalConfirmed  = confirmedPeople.length;
  const totalInvited    = people.length;
  const unconfirmed     = totalInvited - totalConfirmed;

  const kosherConfirmed = confirmedPeople.filter(p => p.kosher).length;
  const kosherTotal     = people.filter(p => p.kosher).length;

  const mealCounts = {};
  confirmedPeople.forEach(p => { const m = p.mealChoice||""; if (m) mealCounts[m] = (mealCounts[m]||0)+1; });
  const mealTotals = {};
  people.forEach(p => { const m = p.mealChoice||""; if (m) mealTotals[m] = (mealTotals[m]||0)+1; });
  const noMealChoice    = confirmedPeople.filter(p => !p.mealChoice).length;
  const dietaryPeople   = people.filter(p => p.dietary && p.dietary.trim());
  const dietaryConfirmed = dietaryPeople.filter(p => confirmedHHIds.has(p.householdId));

  const getPersonName = (p) =>
    (p.firstName||p.lastName) ? `${p.firstName||""} ${p.lastName||""}`.trim() : (p.name||"");
  const getHHName = (p) =>
    households.find(h => h.id === p.householdId)?.formalName || "";

  const handleCopy = () => {
    const lines = [];
    lines.push(`CATERING SUMMARY — ${eventName}${eventDate ? ` (${eventDate})` : ""}`);
    lines.push(`Generated: ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}`);
    lines.push("");
    lines.push(`CONFIRMED ATTENDING: ${totalConfirmed}`);
    lines.push(`TOTAL INVITED:       ${totalInvited}`);
    if (unconfirmed > 0) lines.push(`AWAITING RSVP:       ${unconfirmed}`);
    if (style === "plated") {
      lines.push("");
      lines.push("MEAL CHOICES (confirmed attending)");
      [...new Set([...meals, ...Object.keys(mealCounts)])].forEach(m => {
        const cnt = mealCounts[m] || 0;
        if (cnt > 0) lines.push(`  ${m.padEnd(20)} ${cnt}`);
      });
      if (noMealChoice > 0) lines.push(`  ${"No selection".padEnd(20)} ${noMealChoice}`);
    }
    if (style !== "buffet-headcount") {
      lines.push("");
      lines.push(`KOSHER MEALS: ${kosherConfirmed}${kosherTotal!==kosherConfirmed?` (${kosherTotal} total invited)`:""}`);
      if (dietaryPeople.length > 0) {
        lines.push("");
        const list = style === "buffet-exceptions" ? dietaryPeople : dietaryPeople;
        lines.push(`DIETARY REQUIREMENTS (${style==="buffet-exceptions"?"all guests":"all guests"})`);
        list.forEach(p => {
          const flag = confirmedHHIds.has(p.householdId) ? "✓" : "?";
          lines.push(`  [${flag}] ${getPersonName(p)} (${getHHName(p)}) — ${p.dietary}`);
        });
        lines.push("  (✓ = confirmed attending, ? = RSVP pending)");
      }
    }
    navigator.clipboard.writeText(lines.join("\n"))
      .then(() => { setCopyMsg("Copied!"); setTimeout(()=>setCopyMsg(""),2500); })
      .catch(() => setCopyMsg("Copy failed"));
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
              {style === "plated" && Object.keys(mealCounts).length > 0 &&
                ` · ${Object.keys(mealCounts).length} meal choice${Object.keys(mealCounts).length!==1?"s":""}`}
              {style !== "buffet-headcount" && kosherTotal > 0 && ` · ${kosherConfirmed} kosher`}
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
          {/* Headcount stat row */}
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

          {/* Plated — meal choice table */}
          {style === "plated" && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, textTransform:"uppercase",
                letterSpacing:"0.05em", color:"var(--text-muted)", marginBottom:8 }}>
                Meal Choices — Confirmed Attending
              </div>
              <div style={{ border:"1px solid var(--border)", borderRadius:"var(--radius-md)", overflow:"hidden" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                  <thead>
                    <tr style={{ background:"var(--bg-subtle)" }}>
                      {["Meal","Confirmed","Total Invited"].map((h,i) => (
                        <th key={h} style={{ padding:"8px 12px", textAlign:i===0?"left":"right",
                          fontWeight:700, fontSize:11, textTransform:"uppercase",
                          letterSpacing:"0.05em", color:"var(--text-muted)",
                          borderBottom:"1px solid var(--border)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...new Set([...meals,...Object.keys(mealCounts)])].map((m,i,arr) => (
                      <tr key={m} style={{ borderBottom:i<arr.length-1?"1px solid var(--border)":"none" }}>
                        <td style={{ padding:"8px 12px", fontWeight:500 }}>{m}</td>
                        <td style={{ padding:"8px 12px", textAlign:"right", fontWeight:700,
                          color:(mealCounts[m]||0)>0?"var(--text-primary)":"var(--text-muted)" }}>
                          {mealCounts[m]||0}
                        </td>
                        <td style={{ padding:"8px 12px", textAlign:"right", color:"var(--text-muted)" }}>
                          {mealTotals[m]||0}
                        </td>
                      </tr>
                    ))}
                    {noMealChoice > 0 && (
                      <tr style={{ borderTop:"1px solid var(--border)", background:"var(--bg-subtle)" }}>
                        <td style={{ padding:"8px 12px", color:"var(--text-muted)", fontStyle:"italic" }}>No selection</td>
                        <td style={{ padding:"8px 12px", textAlign:"right", color:"var(--orange)", fontWeight:700 }}>
                          {noMealChoice}
                        </td>
                        <td style={{ padding:"8px 12px", textAlign:"right", color:"var(--text-muted)" }}>—</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Kosher row — plated + buffet-exceptions */}
          {style !== "buffet-headcount" && (
            <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:16,
              padding:"10px 14px", background:"var(--bg-subtle)",
              borderRadius:"var(--radius-md)", border:"1px solid var(--border)" }}>
              <span style={{ fontSize:16 }}>✡</span>
              <span style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)" }}>Kosher meals required:</span>
              <span style={{ fontSize:18, fontWeight:800, color:"var(--accent-primary)",
                fontFamily:"var(--font-display)" }}>{kosherConfirmed}</span>
              {kosherTotal !== kosherConfirmed && (
                <span style={{ fontSize:12, color:"var(--text-muted)" }}>
                  ({kosherTotal} total invited · {kosherTotal-kosherConfirmed} RSVP pending)
                </span>
              )}
            </div>
          )}

          {/* Dietary requirements — plated + buffet-exceptions */}
          {style !== "buffet-headcount" && dietaryPeople.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, textTransform:"uppercase",
                letterSpacing:"0.05em", color:"var(--text-muted)", marginBottom:8 }}>
                Dietary Requirements ({dietaryPeople.length} guest{dietaryPeople.length!==1?"s":""})
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                {dietaryPeople.map(p => {
                  const confirmed = confirmedHHIds.has(p.householdId);
                  return (
                    <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10,
                      padding:"7px 12px", borderRadius:"var(--radius-sm)",
                      background:confirmed?"var(--bg-surface)":"var(--bg-subtle)",
                      border:"1px solid var(--border)", fontSize:13, flexWrap:"wrap" }}>
                      <span style={{ fontSize:10, fontWeight:700, padding:"2px 6px",
                        borderRadius:99, flexShrink:0,
                        background:confirmed?"var(--green-light)":"var(--gold-light)",
                        color:confirmed?"var(--green)":"var(--gold)" }}>
                        {confirmed?"✓ Confirmed":"? Pending"}
                      </span>
                      <span style={{ fontWeight:600, color:"var(--text-primary)" }}>
                        {getPersonName(p)}
                      </span>
                      <span style={{ color:"var(--text-muted)", fontSize:12 }}>
                        {getHHName(p)}
                      </span>
                      <span style={{ color:"var(--orange)", fontWeight:500,
                        marginLeft:"auto", fontSize:12 }}>
                        {p.dietary}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Buffet headcount only — note */}
          {style === "buffet-headcount" && (
            <div style={{ fontSize:13, color:"var(--text-muted)", fontStyle:"italic",
              padding:"10px 14px", background:"var(--bg-subtle)",
              borderRadius:"var(--radius-md)", border:"1px solid var(--border)", marginBottom:16 }}>
              Buffet style — no individual meal selections tracked.
              Provide confirmed headcount to caterer.
            </div>
          )}

          {/* Copy for caterer */}
          <div style={{ display:"flex", justifyContent:"flex-end" }}>
            <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
              {copyMsg || "📋 Copy for caterer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
