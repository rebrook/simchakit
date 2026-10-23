// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.10.0 — DayOfOverlay.jsx
// V3 only. Collections loaded via useEventData.
// dayOf config (checklist + timelineChecks) stored as single doc in supabase.
// Print Brief: fully self-contained — generates printable HTML, opens iframe
// preview modal. No AppShell involvement needed.
//
// Mobile Day-of Mode (<=900px):
//   Full-screen, phone-optimized layout with auto-advancing now/next,
//   one-tap vendor contacts, ceremony roles, and "Running late" CTA.
//   Caches event data to localStorage for flaky venue wifi.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase.js";
import { useEventData } from "@/hooks/useEventData.js";
import { DAY_OF_TIME_BLOCKS } from "@/constants/events.js";
import { formatTimeRange, sortTimeline } from "@/utils/dates.js";
import { Icon } from "@/utils/iconMap.jsx";
import { printDocument, isTouchPrimary } from "@/utils/printDocument.js";
import { PrintPreviewModal } from "@/components/shared/PrintPreviewModal.jsx";
import { generatePrintBriefHTML } from "@/utils/dayofBrief.js";
import { MobileDayOf } from "@/components/dayof/MobileDayOf.jsx";
import { groupTimelineByDate } from "@/utils/dayofTime.js";
import { InfoPopover } from "@/components/shared/InfoPopover.jsx";
import { METRIC_HELP } from "@/constants/metrics.js";
import { getMealPopulation } from "@/utils/sections.js";

// ── Cache helpers ────────────────────────────────────────────────────────────
const CACHE_VERSION = "v1";
function cacheKey(eventId) { return `simchakit-dayof-cache-${CACHE_VERSION}-${eventId}`; }

function readCache(eventId) {
  try {
    const raw = localStorage.getItem(cacheKey(eventId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Sanity: must have a timeline array
    if (!parsed || !Array.isArray(parsed.timeline)) return null;
    return parsed;
  } catch { return null; }
}

function writeCache(eventId, data) {
  try { localStorage.setItem(cacheKey(eventId), JSON.stringify(data)); } catch { /* quota exceeded, ignore */ }
}

// ── Mobile detection (matches AppShell 900px breakpoint) ─────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 900);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}


// ── DayOfItemModal ─────────────────────────────────────────────────────────────
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
          <button className="icon-btn" title="Close" aria-label="Close" onClick={onClose}><Icon name="x" context="button" /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Task *</label>
            <input className="form-input" value={form.task} onChange={e => setF("task", e.target.value)} placeholder="e.g. Confirm DJ setup complete" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Time Block</label>
            <select className="form-select" value={form.timeBlock} onChange={e => setF("timeBlock", e.target.value)}>
              {DAY_OF_TIME_BLOCKS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!form.task.trim()} onClick={e => { e.stopPropagation(); if (form.task.trim()) onSave(form); }}>
              {isEdit ? "Save Changes" : "Add Item"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


// ── DayOfOverlay ──────────────────────────────────────────────────────────────
export function DayOfOverlay({ eventId, event, adminConfig, onClose, onPrintBrief, coPlanners }) {
  const { items: vendors }    = useEventData(eventId, "vendors");
  const { items: people }     = useEventData(eventId, "people");
  const { items: households } = useEventData(eventId, "households");
  const { items: expenses }   = useEventData(eventId, "expenses");
  const { items: tasks }      = useEventData(eventId, "tasks");

  // dayOf config — single document
  const [dayOf,      setDayOf]      = useState({ checklist: [], timelineChecks: {} });
  const [dayOfRowId, setDayOfRowId] = useState(null);

  // Ceremony roles — single document
  const [ceremonyRoles, setCeremonyRoles] = useState([]);

  // Notes
  const [localNotes, setLocalNotes] = useState(event?.quick_notes || "");
  const notesTimer = useRef(null);

  // Print Brief state
  const [printHTML,  setPrintHTML]  = useState(null);

  const [showAddItem, setShowAddItem] = useState(false);
  const [editItem,    setEditItem]    = useState(null);

  // Mobile detection
  const isMobile = useIsMobile();


  // Load dayOf config
  useEffect(() => {
    if (!eventId) return;
    async function load() {
      const { data: rows } = await supabase.from("dayof").select("id, data").eq("event_id", eventId).order("updated_at", { ascending: false }).limit(1);
      if (rows && rows.length > 0) {
        setDayOfRowId(rows[0].id);
        setDayOf(rows[0].data || { checklist: [], timelineChecks: {} });
      }
    }
    load();
  }, [eventId]);

  // Load ceremony roles
  useEffect(() => {
    if (!eventId) return;
    async function load() {
      const { data: rows } = await supabase.from("ceremony_roles").select("data").eq("event_id", eventId).order("updated_at", { ascending: false });
      if (rows && rows.length > 0) {
        const arrayRow = rows.find(r => Array.isArray(r.data?.roles));
        const row = arrayRow || rows[0];
        setCeremonyRoles(row.data?.roles || []);
      }
    }
    load();
  }, [eventId]);

  // Sync notes
  useEffect(() => { setLocalNotes(event?.quick_notes || ""); }, [event?.quick_notes]);
  useEffect(() => () => clearTimeout(notesTimer.current), []);

  const saveDayOf = async (next) => {
    setDayOf(next);
    const row = {
      ...(dayOfRowId ? { id: dayOfRowId } : {}),
      event_id:   eventId,
      data:       next,
      updated_at: new Date().toISOString(),
    };
    const { data: saved, error } = await supabase.from("dayof").upsert(row, { onConflict: "id" }).select("id").single();
    if (!error && saved && !dayOfRowId) setDayOfRowId(saved.id);
  };

  const handleNotesChange = (val) => {
    setLocalNotes(val);
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(async () => {
      await supabase.from("events").update({ quick_notes: val, updated_at: new Date().toISOString() }).eq("id", eventId);
    }, 600);
  };

  const timeline       = sortTimeline(adminConfig?.timeline || []);
  const confirmedVendors = vendors.filter(v => ["Booked","Deposit Paid","Paid in Full"].includes(v.status));
  const checklist      = dayOf.checklist || [];
  const timelineChecks = dayOf.timelineChecks || {};

  // Same shared population as the Catering Summary (see sections.js).
  const pop             = getMealPopulation(households, people, timeline.filter(e => e.servesMeal));
  const confirmedPeople = pop.confirmed;
  const confirmedIds    = new Set(confirmedPeople.map(p => p.id));
  const kosherCount     = confirmedPeople.filter(p => p.kosher).length;
  const dietaryPeople   = pop.relevant
    .filter(p => (p.dietary && p.dietary.trim()) || p.kosher)
    .sort((a, b) => {
      const lastNameOf = (p) => (p.lastName || (p.name||"").split(" ").pop() || "").toLowerCase();
      return lastNameOf(a).localeCompare(lastNameOf(b));
    });
  const totalConfirmed  = confirmedPeople.length;
  const totalInvited    = pop.relevant.length;

  const mainEvent = timeline.find(e => e.isMainEvent);
  const mainEventDate = mainEvent?.startDate || timeline[0]?.startDate || null;
  const eventDate = mainEventDate
    ? new Date(mainEventDate+"T00:00:00").toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" })
    : "";
  const eventName = adminConfig?.name || event?.name || "Event";

  const grouped = {};
  DAY_OF_TIME_BLOCKS.forEach(b => { grouped[b] = []; });
  checklist.forEach(c => { const b = c.timeBlock||"Morning"; if (!grouped[b]) grouped[b]=[]; grouped[b].push(c); });

  const checkedCount = Object.values(timelineChecks).filter(Boolean).length;

  const toggleTimeline = (id) =>
    saveDayOf({ ...dayOf, timelineChecks: { ...timelineChecks, [id]: !timelineChecks[id] } });

  const toggleItem = (id) =>
    saveDayOf({ ...dayOf, checklist: checklist.map(c => c.id===id ? {...c,done:!c.done} : c) });

  const handleSaveItem = (item) => {
    const next = editItem ? checklist.map(c => c.id===item.id ? item : c) : [...checklist, item];
    saveDayOf({ ...dayOf, checklist: next });
    setShowAddItem(false); setEditItem(null);
  };

  const handleDeleteItem = (id) =>
    saveDayOf({ ...dayOf, checklist: checklist.filter(c => c.id!==id) });

  // ── Print Brief handler ───────────────────────────────────────────────────
  const handlePrintBrief = () => {
    const html = generatePrintBriefHTML({
      adminConfig,
      timeline,
      households,
      people,
      vendors,
      expenses,
      tasks,
      ceremonyRoles,
    });
    if (isTouchPrimary()) printDocument(html); else setPrintHTML(html);
  };

  // ── Offline cache: write on successful data load ──────────────────────────
  const cachedData = useRef(null);
  if (!cachedData.current && eventId) {
    cachedData.current = readCache(eventId);
  }

  useEffect(() => {
    // Only cache when we have meaningful data loaded (successful fetch)
    if (!eventId || !timeline.length || (!vendors.length && !people.length)) return;
    const payload = {
      timeline,
      confirmedVendors,
      ceremonyRoles,
      confirmedPeople,
      dietaryPeople,
      kosherCount,
      totalConfirmed,
      totalInvited,
      eventName,
      eventDate,
      adminConfig,
    };
    writeCache(eventId, payload);
    cachedData.current = payload;
  }, [eventId, timeline, confirmedVendors, ceremonyRoles, confirmedPeople, dietaryPeople, kosherCount, totalConfirmed, totalInvited, eventName, eventDate, adminConfig]);

  // Determine if live data is still loading (hooks returned empty)
  const liveDataReady = timeline.length > 0 || vendors.length > 0 || people.length > 0;
  const effectiveData = liveDataReady ? {
    timeline, confirmedVendors, ceremonyRoles, confirmedPeople, dietaryPeople,
    kosherCount, totalConfirmed, totalInvited, eventName, eventDate, adminConfig,
  } : cachedData.current || {
    timeline, confirmedVendors, ceremonyRoles, confirmedPeople, dietaryPeople,
    kosherCount, totalConfirmed, totalInvited, eventName, eventDate, adminConfig,
  };

  // ── Mobile: render via portal to document.body (escapes .app-shell stacking) ──
  if (isMobile) {
    return createPortal(
      <>
      <MobileDayOf
        timeline={effectiveData.timeline}
        adminConfig={effectiveData.adminConfig}
        confirmedVendors={effectiveData.confirmedVendors}
        ceremonyRoles={effectiveData.ceremonyRoles}
        confirmedPeople={effectiveData.confirmedPeople}
        dietaryPeople={effectiveData.dietaryPeople}
        kosherCount={effectiveData.kosherCount}
        totalConfirmed={effectiveData.totalConfirmed}
        totalInvited={effectiveData.totalInvited}
        eventName={effectiveData.eventName}
        eventDate={effectiveData.eventDate}
        coPlanners={coPlanners}
        onClose={onClose}
      />
      {(showAddItem || editItem) && (
        <DayOfItemModal
          item={editItem}
          onSave={handleSaveItem}
          onClose={() => { setShowAddItem(false); setEditItem(null); }}
        />
      )}
      </>,
      document.body
    );
  }

  // ── Desktop: existing panel layout ────────────────────────────────────────
  return (
    <>
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dayof-panel" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="dayof-panel-header">
          <div>
            <div className="dayof-panel-title"><Icon name="clipboardList" context="menu" style={{ marginRight: 6 }} /> Day-of Mode</div>
            {eventDate && <div className="dayof-panel-meta">{eventDate}</div>}
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.2)", border:"1px solid rgba(255,255,255,0.35)", color:"#fff", padding:"5px 14px", borderRadius:"var(--radius-sm)", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"var(--font-body)" }}>
            <Icon name="x" context="inline" style={{ marginRight: 4 }} /> Close
          </button>
        </div>

        <div className="dayof-panel-body">

          {/* Print Brief */}
          <button onClick={handlePrintBrief} style={{ width:"100%", display:"flex", alignItems:"center", gap:12, background:"var(--accent-light)", border:"1px solid var(--accent-medium)", borderRadius:"var(--radius-md)", padding:"12px 16px", cursor:"pointer", textAlign:"left", fontFamily:"var(--font-body)", flexShrink:0 }}>
            <span style={{ fontSize:20, lineHeight:1, flexShrink:0 }}><Icon name="printer" context="button" /></span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:"var(--accent-primary)" }}>Print Event Brief</div>
              <div style={{ fontSize:11, color:"var(--accent-primary)", opacity:0.8, marginTop:1 }}>Generate a printable summary to share with your team</div>
            </div>
          </button>

          {/* 1. Timeline */}
          <div className="dayof-section">
            <div className="dayof-section-header">
              <div className="dayof-section-title"><Icon name="calendar" context="inline" style={{ marginRight: 6 }} /> Event Timeline</div>
              <div style={{ fontSize:11, color:"var(--text-muted)" }}>{checkedCount}/{timeline.length} confirmed</div>
            </div>
            {timeline.length === 0 ? (
              <div style={{ padding:"14px 16px", fontSize:13, color:"var(--text-muted)", fontStyle:"italic" }}>No timeline entries — add them in Admin Mode.</div>
            ) : (() => {
              const dayGroups = groupTimelineByDate(timeline, mainEventDate, Date.now());
              if (!dayGroups) {
                // Single-day: flat render (unchanged)
                return timeline.map(entry => {
                  const checked = !!timelineChecks[entry.id];
                  const timeStr = formatTimeRange(entry.startTime, entry.endTime);
                  return (
                    <div key={entry.id} className={`dayof-timeline-row ${checked?"done":""}`} onClick={() => toggleTimeline(entry.id)}>
                      <div className={`dayof-check ${checked?"checked":""}`}>{checked?<Icon name="check" context="badge" />:""}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          {entry.icon && <span style={{ fontSize:15 }}>{entry.icon}</span>}
                          <span style={{ fontWeight:600, color:"var(--text-primary)", fontSize:13 }}>{entry.title}</span>
                          {entry.isMainEvent && <span style={{ fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:99, background:"var(--accent-light)", color:"var(--accent-primary)" }}>MAIN</span>}
                        </div>
                        {(timeStr || entry.venue) && (
                          <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:1 }}>{[timeStr, entry.venue].filter(Boolean).join(" · ")}</div>
                        )}
                      </div>
                    </div>
                  );
                });
              }
              // Multi-day: grouped with date headers
              return dayGroups.map(group => (
                <div key={group.dateStr} style={group.isDayPast ? { opacity: 0.4 } : undefined}>
                  <div
                    className="dayof-day-header"
                    style={group.isToday ? { color: "var(--accent-primary)" } : undefined}
                  >
                    {group.label}
                  </div>
                  {group.entries.map(entry => {
                    const checked = !!timelineChecks[entry.id];
                    const timeStr = formatTimeRange(entry.startTime, entry.endTime);
                    return (
                      <div key={entry.id} className={`dayof-timeline-row ${checked?"done":""}`} onClick={() => toggleTimeline(entry.id)}>
                        <div className={`dayof-check ${checked?"checked":""}`}>{checked?<Icon name="check" context="badge" />:""}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            {entry.icon && <span style={{ fontSize:15 }}>{entry.icon}</span>}
                            <span style={{ fontWeight:600, color:"var(--text-primary)", fontSize:13 }}>{entry.title}</span>
                            {entry.isMainEvent && <span style={{ fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:99, background:"var(--accent-light)", color:"var(--accent-primary)" }}>MAIN</span>}
                          </div>
                          {(timeStr || entry.venue) && (
                            <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:1 }}>{[timeStr, entry.venue].filter(Boolean).join(" · ")}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ));
            })()}
          </div>

          {/* 2. Hot Sheet */}
          <div className="dayof-section">
            <div className="dayof-section-header"><div className="dayof-section-title"><Icon name="bellRing" context="inline" style={{ marginRight: 6 }} /> Hot Sheet</div></div>

            {/* Key numbers */}
            <div style={{ padding:"12px 14px", borderBottom:"1px solid var(--border)" }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", color:"var(--text-muted)", marginBottom:8 }}>Key Numbers</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {[
                  { label:"Confirmed", value:totalConfirmed, cls:"stat-green", info: METRIC_HELP.confirmed({ precise: pop.preciseMode }) },
                  { label:"Expected",  value:totalInvited,   cls:"",           info: METRIC_HELP.expected({ precise: pop.preciseMode }) },
                  { label:"Kosher",    value:kosherCount,    cls:kosherCount>0?"stat-gold":"", info: METRIC_HELP.kosherDayOf() },
                  { label:"Dietary",   value:dietaryPeople.length, cls:dietaryPeople.length>0?"stat-accent":"", info: METRIC_HELP.dietary() },
                ].map(s => (
                  <div key={s.label} className="stat-card" style={{ padding:"8px 10px", textAlign:"center", position:"relative" }}>
                    <div className="stat-label">{s.label}</div>
                    <div className={`stat-value ${s.cls}`} style={{ fontSize:18 }}>{s.value}</div>
                    <InfoPopover text={s.info} style={{ position:"absolute", top:6, right:6 }} />
                  </div>
                ))}
              </div>
              {dietaryPeople.length > 0 && (
                <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:3 }}>
                  {dietaryPeople.map(p => {
                    const name = [p.firstName,p.lastName].filter(Boolean).join(" ") || p.name || "Guest";
                    const isConf = confirmedIds.has(p.id);
                    return (
                      <div key={p.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"4px 0", borderTop:"1px solid var(--border)", fontSize:12 }}>
                        <span style={{ fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:99, flexShrink:0, background:isConf?"var(--green-light)":"var(--gold-light)", color:isConf?"var(--green)":"var(--gold)" }}>{isConf?<Icon name="check" context="badge" />:"?"}</span>
                        <span style={{ fontWeight:600, color:"var(--text-primary)" }}>{name}</span>
                        <span style={{ color:"var(--orange)", marginLeft:"auto", fontSize:11 }}>{p.dietary || "Kosher meal"}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Vendor contacts */}
            <div style={{ padding:"6px 14px 4px", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", color:"var(--text-muted)", borderBottom:"1px solid var(--border)", background:"var(--bg-base)" }}>Vendor Contacts</div>
            {confirmedVendors.length === 0 ? (
              <div style={{ padding:"12px 14px", fontSize:13, color:"var(--text-muted)", fontStyle:"italic" }}>No confirmed vendors yet.</div>
            ) : confirmedVendors.map(v => (
              <div key={v.id} className="dayof-hotsheet-row">
                <div style={{ flex:1, minWidth:0 }}>
                  <div className="dayof-hotsheet-name">{v.name}</div>
                  {v.contactName && <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:1 }}>{v.contactName}</div>}
                </div>
                {v.phone && (
                  <a href={`tel:${v.phone}`} className="dayof-hotsheet-phone" onClick={e => e.stopPropagation()}><Icon name="phone" context="badge" style={{ marginRight: 3 }} /> {v.phone}</a>
                )}
              </div>
            ))}
          </div>

          {/* 3. Ceremony Roles */}
          {ceremonyRoles.length > 0 && (
            <div className="dayof-section">
              <div className="dayof-section-header">
                <div className="dayof-section-title">✡ Ceremony Roles</div>
                <div style={{ fontSize:11, color:"var(--text-muted)" }}>{ceremonyRoles.filter(r=>r.assignee?.trim()).length}/{ceremonyRoles.length} assigned</div>
              </div>
              {(() => {
                const sections = [...new Set(ceremonyRoles.map(r=>r.section).filter(Boolean))];
                const sorted   = [...ceremonyRoles].sort((a,b) => (a.sortOrder??0)-(b.sortOrder??0));
                return sections.map(sec => {
                  const sectionRoles = sorted.filter(r => r.section===sec);
                  return (
                    <div key={sec}>
                      <div style={{ padding:"6px 14px", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", color:"var(--text-muted)", background:"var(--bg-subtle)", borderBottom:"1px solid var(--border)" }}>{sec}</div>
                      {sectionRoles.map(role => (
                        <div key={role.id} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"8px 14px", borderBottom:"1px solid var(--border)" }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:600, color:"var(--text-primary)" }}>{role.role}</div>
                            {role.hebrewName && <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:1 }}>{role.hebrewName}</div>}
                          </div>
                          <div style={{ fontSize:12, color:role.assignee?.trim()?"var(--accent-primary)":"var(--text-muted)", fontStyle:role.assignee?.trim()?"normal":"italic", fontWeight:role.assignee?.trim()?500:400, textAlign:"right", minWidth:100, flexShrink:0 }}>
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
              <div className="dayof-section-title"><Icon name="tasks" context="inline" style={{ marginRight: 6 }} /> Day-of Checklist</div>
              <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); setShowAddItem(true); }}>+ Add Item</button>
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
                      <div className={`dayof-check ${c.done?"checked":""}`} onClick={e => { e.stopPropagation(); toggleItem(c.id); }}>{c.done&&<Icon name="check" context="badge" />}</div>
                      <div className="dayof-task-text" onClick={e => { e.stopPropagation(); toggleItem(c.id); }}>{c.task}</div>
                      <div style={{ display:"flex", gap:3, flexShrink:0 }}>
                        <button className="icon-btn" style={{ width:26, height:26 }} onClick={e => { e.stopPropagation(); setEditItem(c); }}><Icon name="pencil" context="badge" /></button>
                        <button className="icon-btn" style={{ width:26, height:26 }} onClick={e => { e.stopPropagation(); handleDeleteItem(c.id); }}><Icon name="trash2" context="button" /></button>
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
              <div className="dayof-section-title"><Icon name="pencil" context="inline" style={{ marginRight: 6 }} /> Notes</div>
              <div style={{ fontSize:11, color:"var(--text-muted)" }}>Synced in real time</div>
            </div>
            <div style={{ padding:14 }}>
              <textarea className="form-textarea" style={{ width:"100%", minHeight:80, resize:"vertical" }}
                value={localNotes}
                onChange={e => handleNotesChange(e.target.value)}
                placeholder="Anything to remember on the day..."
                onClick={e => e.stopPropagation()} />
            </div>
          </div>

        </div>
      </div>
    </div>

    {/* Print Brief preview modal */}
    {printHTML && (
        <PrintPreviewModal html={printHTML} title="Print Event Brief" onClose={() => setPrintHTML(null)} zIndex={1100} />
    )}

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
