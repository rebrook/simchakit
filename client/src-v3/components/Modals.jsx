// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — Modals.jsx
// GuideModal: unchanged from V2.
// ActivityLogModal: reads from Supabase audit_log table directly.
// WhatsNewModal: fetches /changelog.json (Vercel static) instead of /simcha/changelog.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { supabase }            from "@/lib/supabase.js";
import { GUIDE_SECTIONS, ACTION_COLORS } from "@/constants/ui.js";

// ── GuideModal ────────────────────────────────────────────────────────────────
export function GuideModal({ onClose }) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const [collapsed, setCollapsed] = useState(() =>
    isMobile ? Object.fromEntries(GUIDE_SECTIONS.map(s => [s.id, true])) : {}
  );
  const toggle = (id) => setCollapsed(c => ({ ...c, [id]: !c[id] }));

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg" style={{ maxWidth:700, maxHeight:"92vh" }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">📖 SimchaKit Guide</div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ overflowY:"auto", maxHeight:"calc(92vh - 80px)", paddingTop:16 }}>

          <div style={{ background:"linear-gradient(135deg, var(--accent-dark) 0%, var(--accent-primary) 100%)", borderRadius:"var(--radius-md)", padding:"20px 24px", marginBottom:24 }}>
            <div style={{ fontSize:15, fontWeight:800, color:"#fff", marginBottom:6 }}>Welcome to SimchaKit</div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.85)", lineHeight:1.7 }}>
              SimchaKit is an event planning dashboard for B'nei Mitzvot, weddings, and other simchas. Everything you need — guests, budget, vendors, tasks, seating, gifts, and a planning calendar — in one place, synced across all your devices.
            </div>
          </div>

          {GUIDE_SECTIONS.map(section => {
            const isCollapsed = !!collapsed[section.id];
            return (
              <div key={section.id} style={{ border:"1px solid var(--border)", borderRadius:"var(--radius-md)", marginBottom:12, overflow:"hidden" }}>
                <button onClick={() => toggle(section.id)} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"13px 18px", background:isCollapsed?"var(--bg-surface)":"var(--bg-subtle)", border:"none", cursor:"pointer", borderBottom:isCollapsed?"none":"1px solid var(--border)", transition:"background 0.15s ease", textAlign:"left" }}>
                  <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:28, height:28, borderRadius:"var(--radius-sm)", background:section.colorLight, border:"1px solid var(--border)", fontSize:14, flexShrink:0 }}>{section.icon}</span>
                  <span style={{ fontFamily:"var(--font-display)", fontSize:15, fontWeight:600, color:"var(--text-primary)", flex:1 }}>{section.title}</span>
                  <span style={{ fontSize:12, color:"var(--text-muted)", transform:isCollapsed?"none":"rotate(180deg)", transition:"transform 0.2s ease", display:"inline-block" }}>▾</span>
                </button>
                {!isCollapsed && (
                  <div style={{ padding:"16px 18px", background:"var(--bg-surface)" }}>
                    {section.items.map((item, i) => (
                      <div key={i} style={{ marginBottom:i<section.items.length-1?16:0, paddingBottom:i<section.items.length-1?16:0, borderBottom:i<section.items.length-1?"1px solid var(--border)":"none" }}>
                        <div style={{ fontSize:13, fontWeight:700, color:section.color, marginBottom:4 }}>{item.heading}</div>
                        <div style={{ fontSize:13, color:"var(--text-secondary)", lineHeight:1.65 }}>{item.body}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ textAlign:"center", padding:"16px 0 8px", fontSize:12, color:"var(--text-muted)" }}>
            SimchaKit · Brook Creative LLC
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ActivityLogModal ──────────────────────────────────────────────────────────
export function ActivityLogModal({ eventId, isArchived, onClose }) {
  const [entries,          setEntries]          = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [filterAction,     setFilterAction]     = useState("All");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    async function load() {
      const { data } = await supabase
        .from("audit_log")
        .select("id, action, detail, created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(500);
      setEntries(data || []);
      setLoading(false);
    }
    load();
  }, [eventId]);

  const fmt = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }) +
      " · " + d.toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" });
  };

  const filtered = entries.filter(e =>
    filterAction === "All" || e.action === filterAction
  );

  const handleClear = async () => {
    await supabase.from("audit_log").delete().eq("event_id", eventId);
    setEntries([]);
    setShowClearConfirm(false);
  };

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg" style={{ maxWidth:640, maxHeight:"92vh" }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">📋 Activity Log</div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ overflowY:"auto", maxHeight:"calc(92vh - 80px)", paddingTop:16 }}>
          <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {["All","Added","Updated","Deleted","Completed"].map(a => (
                <button key={a} onClick={() => setFilterAction(a)} style={{ padding:"4px 12px", borderRadius:99, fontSize:12, fontWeight:600, cursor:"pointer", border:"none", transition:"all 0.15s", background:filterAction===a?"var(--accent-primary)":"var(--bg-subtle)", color:filterAction===a?"white":"var(--text-secondary)" }}>{a}</button>
              ))}
            </div>
            {!isArchived && entries.length > 0 && (
              <button onClick={() => setShowClearConfirm(true)} style={{ padding:"4px 12px", borderRadius:99, fontSize:12, fontWeight:600, cursor:"pointer", border:"1px solid var(--border)", background:"var(--bg-surface)", color:"var(--text-muted)" }}>Clear Log</button>
            )}
          </div>

          {showClearConfirm && (
            <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowClearConfirm(false); }}>
              <div className="modal" style={{ maxWidth:380 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header"><div className="modal-title">Clear Activity Log?</div><button className="icon-btn" onClick={() => setShowClearConfirm(false)}>✕</button></div>
                <div className="modal-body">
                  <p style={{ fontSize:14, color:"var(--text-secondary)", marginBottom:0 }}>This will permanently wipe all activity log entries. This cannot be undone.</p>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setShowClearConfirm(false)}>Cancel</button>
                  <button className="btn btn-danger" onClick={handleClear}>Clear Log</button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign:"center", padding:40, color:"var(--text-muted)", fontSize:14 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign:"center", padding:"48px 24px", color:"var(--text-muted)", fontSize:13 }}>
              <div style={{ fontSize:32, marginBottom:12 }}>📋</div>
              <div style={{ fontFamily:"var(--font-display)", fontSize:16, marginBottom:6, color:"var(--text-primary)" }}>
                {filterAction==="All" ? "No activity yet" : `No ${filterAction} entries`}
              </div>
              <div style={{ fontSize:12, lineHeight:1.6 }}>Changes to guests, expenses, vendors, tasks, and gifts will appear here.</div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              {filtered.map((entry, i) => {
                const ac = ACTION_COLORS[entry.action] || ACTION_COLORS["Updated"];
                return (
                  <div key={entry.id} style={{ display:"flex", gap:12, alignItems:"flex-start", padding:"10px 12px", background:i%2===0?"var(--bg-surface)":"var(--bg-subtle)", borderRadius:"var(--radius-sm)", border:"1px solid var(--border)" }}>
                    <span style={{ fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:99, flexShrink:0, marginTop:2, background:ac.bg, color:ac.color, whiteSpace:"nowrap" }}>{entry.action}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, color:"var(--text-primary)", lineHeight:1.5 }}>{entry.detail}</div>
                      <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:3 }}>{fmt(entry.created_at)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── WhatsNewModal ─────────────────────────────────────────────────────────────
export function WhatsNewModal({ onClose }) {
  const [data,             setData]             = useState(null);
  const [error,            setError]            = useState(false);
  const [collapsedGroups,  setCollapsedGroups]  = useState({});
  const [auditCollapsed,   setAuditCollapsed]   = useState(true);
  const [showOpenOnly,     setShowOpenOnly]      = useState(false);

  useEffect(() => {
    // V3: fetch from /changelog.json (static file served by Vercel from client/public/)
    fetch("/changelog.json")
      .then(r => r.json())
      .then(setData)
      .catch(() => setError(true));
  }, []);

  const toggleGroup = (key) => setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));

  const roadmapStatusColors = {
    "complete":    { bg:"var(--green-light)",  color:"var(--green)",       label:"✅ Complete"    },
    "in-progress": { bg:"var(--gold-light)",   color:"var(--gold)",        label:"🔨 In Progress" },
    "planned":     { bg:"var(--blue-light)",   color:"var(--blue)",        label:"📅 Planned"     },
    "future":      { bg:"var(--bg-muted)",     color:"var(--text-muted)",  label:"🔭 Future"      },
  };

  const versionLevelColors = {
    patch: { bg:"var(--bg-muted)",     color:"var(--text-muted)"     },
    minor: { bg:"var(--blue-light)",   color:"var(--blue)"           },
    major: { bg:"var(--accent-light)", color:"var(--accent-primary)" },
  };

  const auditStatusColors = {
    "queued":               { bg:"var(--blue-light)",  color:"var(--blue)",       label:"⏳ Queued"             },
    "pending-verification": { bg:"var(--gold-light)",  color:"var(--gold)",       label:"🔍 Needs Verification" },
    "future":               { bg:"var(--bg-muted)",    color:"var(--text-muted)", label:"🔭 Future"             },
    "complete":             { bg:"var(--green-light)", color:"var(--green)",      label:"✅ Complete"           },
  };

  const buildGroups = (entries) => {
    const groups = []; const groupMap = {};
    (entries || []).forEach(entry => {
      const parts    = entry.version.replace("V","").split(".");
      const groupKey = "V" + parts.slice(0,2).join(".");
      if (!groupMap[groupKey]) { groupMap[groupKey] = { key:groupKey, entries:[] }; groups.push(groupMap[groupKey]); }
      groupMap[groupKey].entries.push(entry);
    });
    return groups;
  };

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg" style={{ maxWidth:680, maxHeight:"88vh" }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">✨ What's New</div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <button onClick={() => setShowOpenOnly(v => !v)} style={{ fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:20, border:"1px solid var(--border)", cursor:"pointer", transition:"all 0.15s ease", background:showOpenOnly?"var(--accent-primary)":"var(--bg-subtle)", color:showOpenOnly?"white":"var(--text-muted)", fontFamily:"var(--font-body)", whiteSpace:"nowrap" }}>
              {showOpenOnly?"Showing open only":"Show open only"}
            </button>
            <button className="icon-btn" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="modal-body" style={{ overflowY:"auto", maxHeight:"calc(88vh - 80px)" }}>
          {error ? (
            <div className="alert alert-error">Could not load changelog. Make sure <code>changelog.json</code> is in the public folder.</div>
          ) : !data ? (
            <div style={{ textAlign:"center", padding:40, color:"var(--text-muted)", fontSize:14 }}>Loading...</div>
          ) : (<>
            {/* What's New banner */}
            <div style={{ background:"linear-gradient(135deg, var(--accent-dark) 0%, var(--accent-primary) 100%)", borderRadius:"var(--radius-md)", padding:"20px 24px", marginBottom:20 }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
                <div style={{ fontSize:15, fontWeight:800, color:"#fff" }}>✨ What's New in {data.current}</div>
                <span style={{ background:"rgba(255,255,255,0.2)", color:"#fff", fontSize:11, fontWeight:700, padding:"2px 10px", borderRadius:20 }}>{data.current}</span>
              </div>
              <ul style={{ margin:0, paddingLeft:20 }}>
                {(data.whatsNew||[]).map((item,i) => (
                  <li key={i} style={{ color:"rgba(255,255,255,0.9)", fontSize:13, lineHeight:1.8 }}>{item}</li>
                ))}
              </ul>
            </div>

            {/* Change Log */}
            <div style={{ background:"var(--bg-surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-md)", padding:"20px 24px", marginBottom:20 }}>
              <div style={{ fontSize:15, fontWeight:800, color:"var(--text-primary)", marginBottom:16 }}>🕓 Change Log</div>
              {buildGroups(data.changelog).map((group, gi) => {
                const isFirst     = gi === 0;
                const isCollapsed = collapsedGroups[group.key] !== undefined ? collapsedGroups[group.key] : !isFirst;
                const totalChanges = group.entries.reduce((sum,e) => sum+(e.changes||[]).length, 0);
                return (
                  <div key={group.key} style={{ marginBottom:gi<buildGroups(data.changelog).length-1?16:0 }}>
                    <div onClick={() => toggleGroup(group.key)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", padding:"8px 12px", borderRadius:"var(--radius-sm)", background:isFirst?"var(--accent-light)":"var(--bg-subtle)", border:`1px solid ${isFirst?"var(--accent-medium)":"var(--border)"}`, marginBottom:isCollapsed?0:12 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <span style={{ fontSize:13, fontWeight:800, color:isFirst?"var(--accent-primary)":"var(--text-primary)" }}>{group.key}</span>
                        <span style={{ fontSize:11, color:"var(--text-muted)" }}>{group.entries.length} {group.entries.length===1?"release":"releases"} · {totalChanges} {totalChanges===1?"change":"changes"}</span>
                        {isFirst && <span style={{ fontSize:11, fontWeight:700, color:"var(--green)" }}>● Latest</span>}
                      </div>
                      <span style={{ fontSize:13, color:"var(--text-muted)", display:"inline-block", transition:"transform 0.2s", transform:isCollapsed?"rotate(-90deg)":"rotate(0deg)" }}>▾</span>
                    </div>
                    {!isCollapsed && (
                      <div style={{ paddingLeft:4 }}>
                        {group.entries.map((entry, ei) => (
                          <div key={ei} style={{ marginBottom:ei<group.entries.length-1?16:0, paddingBottom:ei<group.entries.length-1?16:0, borderBottom:ei<group.entries.length-1?"1px solid var(--border)":"none" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                              <span style={{ background:gi===0&&ei===0?"var(--accent-primary)":"var(--bg-muted)", color:gi===0&&ei===0?"#fff":"var(--text-secondary)", fontSize:12, fontWeight:700, padding:"2px 10px", borderRadius:20 }}>{entry.version}</span>
                              <span style={{ fontSize:12, color:"var(--text-muted)" }}>{entry.date}</span>
                            </div>
                            <ul style={{ margin:0, paddingLeft:20 }}>
                              {(entry.changes||[]).map((change,j) => (
                                <li key={j} style={{ fontSize:13, color:"var(--text-secondary)", lineHeight:1.8 }}>{change}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Roadmap */}
            <div style={{ background:"var(--bg-surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-md)", padding:"20px 24px", marginBottom:20 }}>
              <div style={{ fontSize:15, fontWeight:800, color:"var(--text-primary)", marginBottom:16 }}>🗺 Roadmap</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {(data.roadmap||[]).filter(item => !showOpenOnly||item.status!=="complete").sort((a,b) => {
                  const sO={planned:0,future:1,complete:2}; const pO={P1:0,P2:1,P3:2,P4:3};
                  const sa=sO[a.status]??1; const sb=sO[b.status]??1; if(sa!==sb)return sa-sb;
                  const pa=pO[a.priority]??9; const pb=pO[b.priority]??9; if(pa!==pb)return pa-pb;
                  return (a.feature||"").localeCompare(b.feature||"");
                }).map((item,i) => {
                  const sc=roadmapStatusColors[item.status]||roadmapStatusColors["future"];
                  const pColors={P1:{bg:"var(--red-light)",color:"var(--red)"},P2:{bg:"var(--gold-light)",color:"var(--gold)"},P3:{bg:"var(--blue-light)",color:"var(--blue)"},P4:{bg:"var(--bg-muted)",color:"var(--text-muted)"}};
                  const pc=item.priority?(pColors[item.priority]||pColors.P4):null;
                  return (
                    <div key={i} style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, padding:"10px 14px", background:"var(--bg-subtle)", borderRadius:"var(--radius-sm)", border:"1px solid var(--border)" }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)", marginBottom:item.detail?3:0 }}>
                          {item.version&&<span style={{ fontFamily:"var(--font-mono,monospace)", fontSize:11, color:"var(--text-muted)", marginRight:8 }}>{item.version}</span>}
                          {item.feature}
                        </div>
                        {item.detail&&<div style={{ fontSize:11, color:"var(--text-muted)", lineHeight:1.5 }}>{item.detail}</div>}
                      </div>
                      <div style={{ display:"flex", gap:5, flexShrink:0, flexDirection:"column", alignItems:"flex-end" }}>
                        {pc&&<span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:pc.bg, color:pc.color, whiteSpace:"nowrap", letterSpacing:"0.04em" }}>{item.priority}</span>}
                        <span style={{ fontSize:11, fontWeight:700, padding:"2px 10px", borderRadius:20, background:sc.bg, color:sc.color, whiteSpace:"nowrap" }}>{sc.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Known Issues */}
            <div style={{ background:"var(--bg-surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-md)", padding:"20px 24px", marginBottom:8 }}>
              <div style={{ fontSize:15, fontWeight:800, color:"var(--text-primary)", marginBottom:12 }}>🐛 Known Issues</div>
              {(data.knownIssues||[]).length===0 ? (
                <div style={{ fontSize:13, color:"var(--green)", fontWeight:600 }}>✅ No known issues</div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {data.knownIssues.filter(issue => !showOpenOnly||issue.severity!=="resolved").map((issue,i) => (
                    <div key={i} style={{ background:"var(--bg-subtle)", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", padding:"10px 14px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                        <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:20, background:"var(--gold-light)", color:"var(--gold)", whiteSpace:"nowrap" }}>#{issue.id} · {issue.severity}</span>
                        <span style={{ fontSize:13, fontWeight:700, color:"var(--text-primary)" }}>{issue.summary}</span>
                      </div>
                      <div style={{ fontSize:12, color:"var(--text-muted)", lineHeight:1.6 }}>{issue.detail}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* UX Audit Items */}
            {(data.auditItems||[]).length>0 && (
              <div style={{ background:"var(--bg-surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-md)", marginTop:12 }}>
                <div onClick={() => setAuditCollapsed(c=>!c)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", padding:"16px 24px", borderBottom:auditCollapsed?"none":"1px solid var(--border)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:15, fontWeight:800, color:"var(--text-primary)" }}>🔍 UX Audit Items</span>
                    <span style={{ fontSize:11, fontWeight:700, padding:"2px 10px", borderRadius:20, background:"var(--blue-light)", color:"var(--blue)", whiteSpace:"nowrap" }}>
                      {showOpenOnly?(data.auditItems.filter(i=>i.status!=="complete").length+" open"):(data.auditItems.length+" items")}
                    </span>
                  </div>
                  <span style={{ fontSize:13, color:"var(--text-muted)", display:"inline-block", transition:"transform 0.2s", transform:auditCollapsed?"rotate(-90deg)":"rotate(0deg)" }}>▾</span>
                </div>
                {!auditCollapsed && (
                  <div style={{ padding:"16px 24px", display:"flex", flexDirection:"column", gap:8 }}>
                    {(data.auditItems||[]).filter(item=>!showOpenOnly||item.status!=="complete").map((item,i) => {
                      const sc=auditStatusColors[item.status]||auditStatusColors["future"];
                      const pColors={P1:{bg:"var(--red-light)",color:"var(--red)"},P2:{bg:"var(--gold-light)",color:"var(--gold)"},P3:{bg:"var(--blue-light)",color:"var(--blue)"},P4:{bg:"var(--bg-muted)",color:"var(--text-muted)"}};
                      const pc=item.priority?(pColors[item.priority]||pColors.P4):null;
                      return (
                        <div key={i} style={{ padding:"10px 14px", background:"var(--bg-subtle)", borderRadius:"var(--radius-sm)", border:"1px solid var(--border)" }}>
                          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)", marginBottom:3 }}>{item.title}</div>
                              <div style={{ fontSize:11, color:"var(--text-muted)", lineHeight:1.5 }}>{item.description}</div>
                            </div>
                            <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 }}>
                              {pc&&<span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:pc.bg, color:pc.color, whiteSpace:"nowrap" }}>{item.priority}</span>}
                              <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:sc.bg, color:sc.color, whiteSpace:"nowrap" }}>{sc.label}</span>
                              {item.area&&<span style={{ fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:20, background:"var(--bg-muted)", color:"var(--text-muted)", whiteSpace:"nowrap" }}>{item.area}</span>}
                              {item.effort&&<span style={{ fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:20, background:"var(--bg-muted)", color:"var(--text-muted)", whiteSpace:"nowrap" }}>{item.effort} effort</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Versioning */}
            {data.versioning && (
              <div style={{ background:"var(--bg-surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-md)", padding:"20px 24px", marginTop:12 }}>
                <div style={{ fontSize:15, fontWeight:800, color:"var(--text-primary)", marginBottom:4 }}>🔢 Versioning</div>
                <div style={{ fontSize:12, color:"var(--text-muted)", marginBottom:16 }}>Scheme: <code style={{ background:"var(--bg-muted)", padding:"1px 6px", borderRadius:4, fontSize:12 }}>{data.versioning.scheme}</code></div>
                <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:data.versioning.thresholds?16:0 }}>
                  {(data.versioning.rules||[]).map((rule,i) => {
                    const c=versionLevelColors[rule.level]||versionLevelColors.patch;
                    return (
                      <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"10px 14px", background:"var(--bg-subtle)", borderRadius:"var(--radius-sm)", border:"1px solid var(--border)" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:160, flexShrink:0 }}>
                          <span style={{ fontSize:11, fontWeight:700, padding:"2px 10px", borderRadius:20, background:c.bg, color:c.color, whiteSpace:"nowrap" }}>{rule.level}</span>
                          <code style={{ fontSize:11, color:"var(--text-muted)", background:"var(--bg-muted)", padding:"1px 6px", borderRadius:4 }}>{rule.example}</code>
                        </div>
                        <span style={{ fontSize:13, color:"var(--text-secondary)", lineHeight:1.6 }}>{rule.trigger}</span>
                      </div>
                    );
                  })}
                </div>
                {data.versioning.thresholds && (
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:2 }}>Upcoming Thresholds</div>
                    {data.versioning.thresholds.next_minor&&<div style={{ padding:"8px 14px", background:"var(--blue-light)", borderRadius:"var(--radius-sm)", fontSize:13, color:"var(--blue)", fontWeight:600 }}>📌 {data.versioning.thresholds.next_minor}</div>}
                    {data.versioning.thresholds.next_major&&<div style={{ padding:"8px 14px", background:"var(--accent-light)", borderRadius:"var(--radius-sm)", fontSize:13, color:"var(--accent-primary)", fontWeight:600 }}>🚀 {data.versioning.thresholds.next_major}</div>}
                  </div>
                )}
              </div>
            )}
          </>)}

          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
