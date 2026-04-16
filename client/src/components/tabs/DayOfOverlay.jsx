import { useState, useEffect, useRef } from "react";
import { DAY_OF_TIME_BLOCKS } from "@/constants/events.js";
import { formatTimeRange, sortTimeline } from "@/utils/dates.js";

export function DayOfItemModal({ item, onSave, onClose }) {
  const isEdit = !!item;
  const [form, setForm] = useState(item || {
    id: "doi_" + Date.now() + "_" + Math.random().toString(36).slice(2,7),
    task: "", timeBlock: "Morning", done: false,
  });
  const setF = (k, v) => setForm(f => ({...f, [k]: v}));
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? "Edit Item" : "Add Day-of Item"}</div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Task *</label>
            <input className="form-input" value={form.task}
              onChange={e => setF("task", e.target.value)}
              placeholder="e.g. Confirm DJ setup complete" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Time Block</label>
            <select className="form-select" value={form.timeBlock}
              onChange={e => setF("timeBlock", e.target.value)}>
              {DAY_OF_TIME_BLOCKS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary"
              disabled={!form.task.trim()}
              onClick={e => { e.stopPropagation(); if (form.task.trim()) onSave(form); }}>
              {isEdit ? "Save Changes" : "Add Item"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DayOfOverlay({ state, adminConfig, updateData, updateNotes, onClose, onPrintBrief }) {
  const timeline       = sortTimeline(adminConfig?.timeline || []);
  const vendors        = (state?.vendors  || []).filter(v =>
    ["Booked","Deposit Paid","Paid in Full"].includes(v.status));
  const people         = state?.people     || [];
  const households     = state?.households || [];
  const dayOf          = state?.dayOf      || {};
  const checklist      = dayOf.checklist       || [];
  const timelineChecks = dayOf.timelineChecks  || {};
  const notes          = state?.quickNotes || "";
  const ceremonyRoles  = state?.ceremonyRoles  || [];

  const [showAddItem,  setShowAddItem]  = useState(false);
  const [editItem,     setEditItem]     = useState(null);
  const [localNotes,   setLocalNotes]   = useState(notes);
  const notesTimer = useRef(null);

  // Sync localNotes if quickNotes changes externally (e.g. edited in Overview)
  useEffect(() => { setLocalNotes(state?.quickNotes || ""); }, [state?.quickNotes]);

  // Cleanup debounce timer on unmount
  useEffect(() => () => clearTimeout(notesTimer.current), []);

  const saveDayOf = (next) => updateData("dayOf", next);

  const toggleTimeline = (id) =>
    saveDayOf({ ...dayOf, timelineChecks: { ...timelineChecks, [id]: !timelineChecks[id] } });

  const toggleItem = (id) =>
    saveDayOf({ ...dayOf, checklist: checklist.map(c => c.id===id ? {...c,done:!c.done} : c) });

  const handleSaveItem = (item) => {
    const next = editItem
      ? checklist.map(c => c.id===item.id ? item : c)
      : [...checklist, item];
    saveDayOf({ ...dayOf, checklist: next });
    setShowAddItem(false);
    setEditItem(null);
  };

  const handleDeleteItem = (id) =>
    saveDayOf({ ...dayOf, checklist: checklist.filter(c => c.id!==id) });

  const handleNotesChange = (val) => {
    setLocalNotes(val);
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => updateNotes(val), 600);
  };

  const confirmedHHIds  = new Set(households.filter(h => h.status==="RSVP Yes").map(h => h.id));
  const confirmedPeople = people.filter(p => confirmedHHIds.has(p.householdId));
  const kosherCount     = confirmedPeople.filter(p => p.kosher).length;
  const dietaryPeople   = people.filter(p => p.dietary && p.dietary.trim());
  const totalConfirmed  = confirmedPeople.length;
  const totalInvited    = people.length;

  const mainEvent  = timeline.find(e => e.isMainEvent);
  const eventDate  = mainEvent?.startDate
    ? new Date(mainEvent.startDate+"T00:00:00").toLocaleDateString("en-US",
        { weekday:"long", month:"long", day:"numeric", year:"numeric" })
    : "";

  const grouped = {};
  DAY_OF_TIME_BLOCKS.forEach(b => { grouped[b] = []; });
  checklist.forEach(c => { const b = c.timeBlock||"Morning"; if (!grouped[b]) grouped[b]=[]; grouped[b].push(c); });

  const checkedCount = Object.values(timelineChecks).filter(Boolean).length;

  return (
    <>
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dayof-panel" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="dayof-panel-header">
          <div>
            <div className="dayof-panel-title">📋 Day-of Mode</div>
            {eventDate && <div className="dayof-panel-meta">{eventDate}</div>}
          </div>
          <button onClick={onClose}
            style={{ background:"rgba(255,255,255,0.2)", border:"1px solid rgba(255,255,255,0.35)",
              color:"#fff", padding:"5px 14px", borderRadius:"var(--radius-sm)",
              cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"var(--font-body)" }}>
            ✕ Close
          </button>
        </div>

        <div className="dayof-panel-body">

          {/* Print Brief */}
          <button onClick={onPrintBrief}
            style={{
              width:"100%", display:"flex", alignItems:"center", gap:12,
              background:"var(--accent-light)", border:"1px solid var(--accent-medium)",
              borderRadius:"var(--radius-md)", padding:"12px 16px",
              cursor:"pointer", textAlign:"left", fontFamily:"var(--font-body)",
              flexShrink:0,
            }}>
            <span style={{ fontSize:20, lineHeight:1, flexShrink:0 }}>🖨</span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:"var(--accent-primary)" }}>
                Print Event Brief
              </div>
              <div style={{ fontSize:11, color:"var(--accent-primary)", opacity:0.8, marginTop:1 }}>
                Generate a printable summary to share with your team
              </div>
            </div>
          </button>

          {/* 1. Timeline */}
          <div className="dayof-section">
            <div className="dayof-section-header">
              <div className="dayof-section-title">📅 Event Timeline</div>
              <div style={{ fontSize:11, color:"var(--text-muted)" }}>
                {checkedCount}/{timeline.length} confirmed
              </div>
            </div>
            {timeline.length === 0 ? (
              <div style={{ padding:"14px 16px", fontSize:13, color:"var(--text-muted)", fontStyle:"italic" }}>
                No timeline entries — add them in Admin Mode.
              </div>
            ) : timeline.map(entry => {
              const checked = !!timelineChecks[entry.id];
              const timeStr = formatTimeRange(entry.startTime, entry.endTime);
              return (
                <div key={entry.id}
                  className={`dayof-timeline-row ${checked ? "done" : ""}`}
                  onClick={() => toggleTimeline(entry.id)}>
                  <div className={`dayof-check ${checked ? "checked" : ""}`}>{checked ? "✓" : ""}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      {entry.icon && <span style={{ fontSize:15 }}>{entry.icon}</span>}
                      <span style={{ fontWeight:600, color:"var(--text-primary)", fontSize:13 }}>
                        {entry.title}
                      </span>
                      {entry.isMainEvent && (
                        <span style={{ fontSize:10, fontWeight:700, padding:"1px 6px",
                          borderRadius:99, background:"var(--accent-light)",
                          color:"var(--accent-primary)" }}>MAIN</span>
                      )}
                    </div>
                    {(timeStr || entry.venue) && (
                      <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:1 }}>
                        {[timeStr, entry.venue].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 2. Hot Sheet */}
          <div className="dayof-section">
            <div className="dayof-section-header">
              <div className="dayof-section-title">🔥 Hot Sheet</div>
            </div>

            {/* Key numbers */}
            <div style={{ padding:"12px 14px", borderBottom:"1px solid var(--border)" }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase",
                letterSpacing:"0.05em", color:"var(--text-muted)", marginBottom:8 }}>
                Key Numbers
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {[
                  { label:"Confirmed", value:totalConfirmed, cls:"stat-green" },
                  { label:"Invited",   value:totalInvited,   cls:""           },
                  { label:"Kosher",    value:kosherCount,    cls:kosherCount>0?"stat-gold":""  },
                  { label:"Dietary",   value:dietaryPeople.length, cls:dietaryPeople.length>0?"stat-accent":"" },
                ].map(s => (
                  <div key={s.label} className="stat-card"
                    style={{ padding:"8px 10px", textAlign:"center" }}>
                    <div className="stat-label">{s.label}</div>
                    <div className={`stat-value ${s.cls}`} style={{ fontSize:18 }}>{s.value}</div>
                  </div>
                ))}
              </div>
              {dietaryPeople.length > 0 && (
                <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:3 }}>
                  {dietaryPeople.map(p => {
                    const name = [p.firstName,p.lastName].filter(Boolean).join(" ") || p.name || "Guest";
                    const isConf = confirmedHHIds.has(p.householdId);
                    return (
                      <div key={p.id} style={{ display:"flex", alignItems:"center", gap:8,
                        padding:"4px 0", borderTop:"1px solid var(--border)", fontSize:12 }}>
                        <span style={{ fontSize:10, fontWeight:700, padding:"1px 6px",
                          borderRadius:99, flexShrink:0,
                          background:isConf?"var(--green-light)":"var(--gold-light)",
                          color:isConf?"var(--green)":"var(--gold)" }}>
                          {isConf?"✓":"?"}
                        </span>
                        <span style={{ fontWeight:600, color:"var(--text-primary)" }}>{name}</span>
                        <span style={{ color:"var(--orange)", marginLeft:"auto", fontSize:11 }}>{p.dietary}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Vendor contacts */}
            <div style={{ padding:"6px 14px 4px", fontSize:10, fontWeight:700,
              textTransform:"uppercase", letterSpacing:"0.05em", color:"var(--text-muted)",
              borderBottom:"1px solid var(--border)", background:"var(--bg-page)" }}>
              Vendor Contacts
            </div>
            {vendors.length === 0 ? (
              <div style={{ padding:"12px 14px", fontSize:13, color:"var(--text-muted)", fontStyle:"italic" }}>
                No confirmed vendors yet.
              </div>
            ) : vendors.map(v => (
              <div key={v.id} className="dayof-hotsheet-row">
                <div style={{ flex:1, minWidth:0 }}>
                  <div className="dayof-hotsheet-name">{v.name}</div>
                  {v.contactName && (
                    <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:1 }}>{v.contactName}</div>
                  )}
                </div>
                {v.phone && (
                  <a href={`tel:${v.phone}`} className="dayof-hotsheet-phone"
                    onClick={e => e.stopPropagation()}>
                    📞 {v.phone}
                  </a>
                )}
              </div>
            ))}
          </div>

          {/* 3. Ceremony Roles */}
          {ceremonyRoles.length > 0 && (
            <div className="dayof-section">
              <div className="dayof-section-header">
                <div className="dayof-section-title">✡ Ceremony Roles</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {ceremonyRoles.filter(r => r.assignee?.trim()).length}/{ceremonyRoles.length} assigned
                </div>
              </div>
              {(() => {
                const sections = [...new Set(ceremonyRoles.map(r => r.section).filter(Boolean))];
                const sorted   = [...ceremonyRoles].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
                return sections.map(sec => {
                  const sectionRoles = sorted.filter(r => r.section === sec);
                  return (
                    <div key={sec}>
                      <div style={{
                        padding: "6px 14px", fontSize: 10, fontWeight: 700,
                        textTransform: "uppercase", letterSpacing: "0.05em",
                        color: "var(--text-muted)", background: "var(--bg-subtle)",
                        borderBottom: "1px solid var(--border)",
                      }}>{sec}</div>
                      {sectionRoles.map(role => (
                        <div key={role.id} style={{
                          display: "flex", alignItems: "flex-start", gap: 12,
                          padding: "8px 14px", borderBottom: "1px solid var(--border)",
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                              {role.role}
                            </div>
                            {role.hebrewName && (
                              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                                {role.hebrewName}
                              </div>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: role.assignee?.trim() ? "var(--accent-primary)" : "var(--text-muted)", fontStyle: role.assignee?.trim() ? "normal" : "italic", fontWeight: role.assignee?.trim() ? 500 : 400, textAlign: "right", minWidth: 100, flexShrink: 0 }}>
                            {role.assignee?.trim() || "Unassigned"}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {/* 4. Day-of Checklist */}
          <div className="dayof-section">
            <div className="dayof-section-header">
              <div className="dayof-section-title">✅ Day-of Checklist</div>
              <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); setShowAddItem(true); }}>
                + Add Item
              </button>
            </div>
            {checklist.length === 0 ? (
              <div style={{ padding:"16px 14px", textAlign:"center", color:"var(--text-muted)", fontSize:13 }}>
                <div style={{ marginBottom:4 }}>No checklist items yet.</div>
                <div style={{ fontSize:12 }}>Add items — vendor confirmations, setup checks, timing reminders.</div>
              </div>
            ) : DAY_OF_TIME_BLOCKS.map(block => {
              const items = grouped[block] || [];
              if (items.length === 0) return null;
              const done = items.filter(c => c.done).length;
              return (
                <div key={block}>
                  <div className="dayof-block-heading">{block} — {done}/{items.length}</div>
                  {items.map(c => (
                    <div key={c.id} className={`dayof-checklist-row ${c.done?"done":""}`}>
                      <div className={`dayof-check ${c.done?"checked":""}`}
                        onClick={e => { e.stopPropagation(); toggleItem(c.id); }}>
                        {c.done && "✓"}
                      </div>
                      <div className="dayof-task-text"
                        onClick={e => { e.stopPropagation(); toggleItem(c.id); }}>
                        {c.task}
                      </div>
                      <div style={{ display:"flex", gap:3, flexShrink:0 }}>
                        <button className="icon-btn" style={{ width:26, height:26 }}
                          onClick={e => { e.stopPropagation(); setEditItem(c); }}>✎</button>
                        <button className="icon-btn" style={{ width:26, height:26 }}
                          onClick={e => { e.stopPropagation(); handleDeleteItem(c.id); }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* 5. Notes */}
          <div className="dayof-section">
            <div className="dayof-section-header">
              <div className="dayof-section-title">📝 Notes</div>
              <div style={{ fontSize:11, color:"var(--text-muted)" }}>Synced in real time</div>
            </div>
            <div style={{ padding:14 }}>
              <textarea className="form-textarea"
                style={{ width:"100%", minHeight:80, resize:"vertical" }}
                value={localNotes}
                onChange={e => handleNotesChange(e.target.value)}
                placeholder="Anything to remember on the day..."
                onClick={e => e.stopPropagation()}
              />
            </div>
          </div>

        </div>
      </div>

    </div>

    {/* Add/edit item — sibling of outer backdrop, not child, prevents click-bubbling */}
    {(showAddItem || editItem) && (
      <DayOfItemModal
        item={editItem}
        onSave={handleSaveItem}
        onClose={() => { setShowAddItem(false); setEditItem(null); }}
      />
    )}
    </>
  );
}
