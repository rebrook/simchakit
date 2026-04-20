// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — GuestsTab.jsx
// Ported from V2. Households and people via useEventData.
// appendAuditLog replaced with direct Supabase insert to audit_log table.
// All modals (HouseholdModal, ImportModal, etc.) are props-based — unchanged.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, LabelList,
} from "recharts";
import { supabase }           from "@/lib/supabase.js";
import { useEventData, peoplePromoteColumns } from "@/hooks/useEventData.js";
import { useSearchHighlight } from "@/hooks/useSearchHighlight.js";
import { RSVP_STATUSES, TITLES, DEFAULT_GROUPS, DEFAULT_MEALS } from "@/constants/guest-constants.js";
import { SHIRT_SIZES }        from "@/constants/theme.js";
import { TL_HOURS, TL_MINUTES } from "@/constants/ui.js";
import { parseTimeParts, buildTime } from "@/utils/dates.js";
import { newHouseholdId, newPersonId, newContactId, newTimelineId } from "@/utils/ids.js";
import {
  getPeopleForHousehold, isMaleTitle, computeHouseholdCounts, getHouseholdAttending,
  formatPhone, parseCSV, generateCSVTemplate, importCSVToGuestData, detectColumnMapping,
  constructFormalName, FIELD_ALIASES, exportToInvitationCSV, exportGuestsByHousehold,
  exportGuestsByPerson, generateGuestPrintHTML, getAddressFields, formatAddress,
  migrateCityStateZip, COUNTRIES,
} from "@/utils/guests.js";
import { ArchivedNotice }    from "@/components/shared/ArchivedNotice.jsx";
import { RsvpPill }          from "@/components/shared/RsvpPill.jsx";
import { CateringSummary }   from "@/components/shared/CateringSummary.jsx";

// ── GuestsTab ─────────────────────────────────────────────────────────────────
export function GuestsTab({ eventId, event, adminConfig, showToast, isArchived, searchHighlight, clearSearchHighlight }) {
  const { items: households, loading: hLoading, save: saveHouseholdRow, remove: removeHouseholdRow } = useEventData(eventId, "households");
  const { items: people,     loading: pLoading, save: savePersonRow,    remove: removePersonRow }     = useEventData(eventId, "people", { promoteColumns: peoplePromoteColumns });
  const { items: tables,     loading: tLoading }                                                       = useEventData(eventId, "tables");

  const groups   = adminConfig?.groups   || DEFAULT_GROUPS;
  const sections = (adminConfig?.timeline || []).map(e => ({ id: e.id, label: (e.icon ? e.icon + " " : "") + e.title }));

  const [search,               setSearch]               = useState("");
  const [groupFilter,          setGroupFilter]          = useState("All");
  const [statusFilter,         setStatusFilter]         = useState("All");
  const [expandedHH,           setExpandedHH]           = useState(null);
  const [showAdd,              setShowAdd]              = useState(false);
  const [editingHH,            setEditingHH]            = useState(null);
  const [showImport,           setShowImport]           = useState(false);
  const [showGuestExport,      setShowGuestExport]      = useState(false);
  const [guestPrintHTML,       setGuestPrintHTML]       = useState(null);
  const [deleteConfirm,        setDeleteConfirm]        = useState(null);
  const [openRsvp,             setOpenRsvp]             = useState(null);
  const [outOfTownFilter,      setOutOfTownFilter]      = useState(false);
  const [missingAddressFilter, setMissingAddressFilter] = useState(false);
  const [selectedHHIds,        setSelectedHHIds]        = useState(new Set());
  const [bulkStatus,           setBulkStatus]           = useState("RSVP Yes");

  useSearchHighlight(searchHighlight, clearSearchHighlight, "guests", { setExpandedHH });

  useEffect(() => { setSelectedHHIds(new Set()); }, [search, groupFilter, statusFilter, outOfTownFilter, missingAddressFilter]);

  // ── Audit log ─────────────────────────────────────────────────────────────
  const appendAuditLog = async (action, detail) => {
    try {
      await supabase.from("audit_log").insert({
        event_id:   eventId,
        action,
        detail,
        created_at: new Date().toISOString(),
      });
    } catch (e) { /* non-critical */ }
  };

  // ── RSVP status update ────────────────────────────────────────────────────
  const updateRsvpStatus = async (hhId, newStatus) => {
    if (isArchived) return;
    const hh = households.find(h => h.id === hhId);
    const oldStatus = hh?.status || "";
    await saveHouseholdRow({ ...hh, status: newStatus });
    appendAuditLog("Updated", `RSVP updated — ${hh?.formalName || "Household"}: ${oldStatus} → ${newStatus}`);
    showToast(`RSVP updated — ${newStatus}`);
    setOpenRsvp(null);
  };

  // ── Bulk RSVP update ──────────────────────────────────────────────────────
  const toggleSelect = (hhId) => {
    setSelectedHHIds(prev => {
      const next = new Set(prev);
      next.has(hhId) ? next.delete(hhId) : next.add(hhId);
      return next;
    });
  };

  const applyBulkRsvp = async () => {
    if (isArchived || selectedHHIds.size === 0) return;
    for (const hhId of selectedHHIds) {
      const hh = households.find(h => h.id === hhId);
      if (hh) await saveHouseholdRow({ ...hh, status: bulkStatus });
    }
    appendAuditLog("Updated", `Bulk RSVP update — ${selectedHHIds.size} household${selectedHHIds.size !== 1 ? "s" : ""} set to ${bulkStatus}`);
    showToast(`${selectedHHIds.size} household${selectedHHIds.size !== 1 ? "s" : ""} updated to ${bulkStatus}`);
    setSelectedHHIds(new Set());
  };

  // ── Inline mailing toggles ────────────────────────────────────────────────
  const toggleMailing = async (hhId, field) => {
    if (isArchived) return;
    const hh = households.find(h => h.id === hhId);
    if (hh) await saveHouseholdRow({ ...hh, [field]: !hh[field] });
  };

  // ── Save household + members ──────────────────────────────────────────────
  const saveHousehold = async ({ household, people: newPpl }) => {
    if (isArchived) return;
    const isEdit = households.some(h => h.id === household.id);

    // Save household row
    await saveHouseholdRow(household);

    // Remove old people for this household then upsert new ones
    const oldPpl = people.filter(p => p.householdId === household.id);
    for (const p of oldPpl) {
      if (!newPpl.find(np => np.id === p.id)) await removePersonRow(p._rowId);
    }
    for (const p of newPpl) await savePersonRow(p);

    appendAuditLog(isEdit ? "Updated" : "Added", `${isEdit ? "Updated" : "Added"} household — ${household.formalName || "Household"}`);
    showToast(isEdit ? "Household updated" : "Household added");
    setShowAdd(false);
    setEditingHH(null);
  };

  // ── Delete household ──────────────────────────────────────────────────────
  const deleteHousehold = async (id) => {
    if (isArchived) return;
    const hh = households.find(h => h.id === id);
    // Remove all people for this household
    const hhPeople = people.filter(p => p.householdId === id);
    for (const p of hhPeople) await removePersonRow(p._rowId);
    await removeHouseholdRow(hh._rowId);
    appendAuditLog("Deleted", `Deleted household — ${hh?.formalName || "Household"}`);
    showToast("Household deleted");
    setDeleteConfirm(null);
    if (expandedHH === id) setExpandedHH(null);
  };

  // ── Import ────────────────────────────────────────────────────────────────
  const handleImport = async ({ households: newHH, people: newPpl }, mode) => {
    if (isArchived) return;
    if (mode === "replace") {
      for (const h of households) await removeHouseholdRow(h._rowId);
      for (const p of people)     await removePersonRow(p._rowId);
    }
    for (const h of newHH)  await saveHouseholdRow(h);
    for (const p of newPpl) await savePersonRow(p);
    showToast("Guest list imported");
    setShowImport(false);
  };

  // ── Attending override clear ──────────────────────────────────────────────
  const clearAttendingOverride = async (hhId) => {
    const hh = households.find(h => h.id === hhId);
    if (hh) await saveHouseholdRow({ ...hh, attendingAdults: null, attendingKids: null });
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalPeople     = people.length;
  const totalOutOfTown  = households.filter(h => h.outOfTown).length;
  const totalAttending  = households.filter(h => h.status === "RSVP Yes").reduce((s, h) => {
    const a = getHouseholdAttending(h, people);
    return s + a.adults + a.kids;
  }, 0);
  const totalKosher     = people.filter(p => p.kosher).length;
  const totalKippot     = people.filter(p => isMaleTitle(p.title)).length;
  const totalAddresses  = households.filter(h => h.address1).length;
  const totalSTDSent    = households.filter(h => h.saveTheDateSent).length;
  const totalInviteSent = households.filter(h => h.inviteSent).length;
  const rsvpYes         = households.filter(h => h.status === "RSVP Yes").length;
  const rsvpPending     = households.filter(h => h.status === "Invited" || h.status === "Pending").length;

  // RSVP deadline banner
  const rsvpDeadline = adminConfig?.rsvpDeadline;
  const rsvpBanner = (() => {
    if (!rsvpDeadline) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    const due   = new Date(rsvpDeadline + "T00:00:00");
    const diff  = Math.ceil((due - today) / (1000*60*60*24));
    const allResponded = rsvpPending === 0 && households.length > 0;
    if (allResponded) return { cls:"done", icon:"✓", text:"All RSVPs received — no households are still pending." };
    const pendingText = `${rsvpPending} household${rsvpPending!==1?"s":""} haven't responded yet`;
    if (diff < 0)  return { cls:"urgent", icon:"⚠", text:`RSVP deadline passed ${Math.abs(diff)} day${Math.abs(diff)!==1?"s":""} ago · ${pendingText}` };
    if (diff === 0) return { cls:"urgent", icon:"⚠", text:`RSVP deadline is today · ${pendingText}` };
    if (diff <= 7)  return { cls:"urgent", icon:"⚠", text:`RSVP deadline in ${diff} day${diff!==1?"s":""} · ${pendingText}` };
    if (diff <= 14) return { cls:"warn",   icon:"📬", text:`RSVP deadline in ${diff} days · ${pendingText}` };
    return               { cls:"info",   icon:"📬", text:`RSVP deadline in ${diff} days · ${pendingText}` };
  })();

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = households.filter(hh => {
    if (groupFilter  !== "All" && hh.group  !== groupFilter)  return false;
    if (statusFilter !== "All" && hh.status !== statusFilter) return false;
    if (outOfTownFilter      && !hh.outOfTown) return false;
    if (missingAddressFilter &&  hh.address1)  return false;
    if (search) {
      const s = search.toLowerCase();
      const memberMatch = getPeopleForHousehold(people, hh.id).some(p => {
        const fullName = [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "";
        return fullName.toLowerCase().includes(s);
      });
      if (!(hh.formalName||"").toLowerCase().includes(s) && !memberMatch) return false;
    }
    return true;
  }).sort((a, b) => {
    const la = (a.formalName||"").trim().split(" ").filter(Boolean).pop()?.toLowerCase() || "";
    const lb = (b.formalName||"").trim().split(" ").filter(Boolean).pop()?.toLowerCase() || "";
    return la.localeCompare(lb);
  });

  const statusStyle = {
    "Invited":  { bg:"var(--blue-light)",   color:"var(--blue)"   },
    "RSVP Yes": { bg:"var(--green-light)",  color:"var(--green)"  },
    "RSVP No":  { bg:"var(--red-light)",    color:"var(--red)"    },
    "Pending":  { bg:"var(--orange-light)", color:"var(--orange)" },
    "Maybe":    { bg:"var(--gold-light)",   color:"var(--gold)"   },
  };

  if (hLoading || pLoading) return <div style={loadingStyle}>Loading guests…</div>;

  return (
    <div>
      {isArchived && <ArchivedNotice />}

      <div className="section-header">
        <div>
          <div className="section-title">Guest List</div>
          <div className="section-subtitle">{households.length} household{households.length!==1?"s":""} · {totalPeople} individual{totalPeople!==1?"s":""}</div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button className="btn btn-secondary btn-sm" disabled={isArchived} onClick={()=>setShowImport(true)}>Import</button>
          <button className="btn btn-secondary btn-sm" onClick={()=>setShowGuestExport(true)}>↓ Export Guests</button>
          <button className="btn btn-primary btn-sm" disabled={isArchived} onClick={()=>setShowAdd(true)}>+ Add Household</button>
        </div>
      </div>

      {rsvpBanner && (
        <div className={`rsvp-banner ${rsvpBanner.cls}`}>
          <span className="rsvp-banner-icon">{rsvpBanner.icon}</span>
          <span dangerouslySetInnerHTML={{__html: rsvpBanner.text.replace(/(\d+ households?)/g,'<strong>$1</strong>').replace(/(\d+ days?)/g,'<strong>$1</strong>')}} />
        </div>
      )}

      <div className="stat-grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",marginBottom:20}}>
        {[
          { label:"Total Guests",   value:totalPeople,    sub:`${households.length} households`,              cls:"stat-accent" },
          { label:"Attending",      value:totalAttending, sub:`${rsvpYes} households confirmed`,               cls:"stat-green"  },
          { label:"Out of Town",    value:totalOutOfTown, sub:"hotel block needed",                            cls:"stat-gold"   },
          { label:"STD Sent",       value:`${totalSTDSent}/${households.length}`,  sub:"save the dates",
            cls: totalSTDSent===households.length && households.length>0 ? "stat-green" : "" },
          { label:"Invites Sent",   value:`${totalInviteSent}/${households.length}`, sub:"invitations mailed",
            cls: totalInviteSent===households.length && households.length>0 ? "stat-green" : "" },
          { label:"Kippot Needed",  value:totalKippot,    sub:"males on guest list",                          cls:"stat-accent" },
          { label:"Kosher Meals",   value:totalKosher,    sub:"required",                                     cls:""            },
          { label:"Addresses",      value:`${totalAddresses}/${households.length}`, sub:"complete",
            cls: totalAddresses===households.length ? "stat-green" : "stat-red" },
        ].map(s=>(
          <div className="stat-card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-value ${s.cls}`}>{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <CateringSummary people={people} households={households} adminConfig={adminConfig} />
      <GuestInsights households={households} people={people} groups={groups} statusStyle={statusStyle} />

      {/* Filters */}
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {!isArchived && filtered.length > 0 && (
            <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",flexShrink:0,padding:"0 4px"}}
              title={selectedHHIds.size===filtered.length?"Deselect all":"Select all visible"}>
              <input type="checkbox"
                checked={filtered.length>0 && selectedHHIds.size===filtered.length}
                ref={el => { if (el) el.indeterminate = selectedHHIds.size>0 && selectedHHIds.size<filtered.length; }}
                onChange={e => { if (e.target.checked) setSelectedHHIds(new Set(filtered.map(h=>h.id))); else setSelectedHHIds(new Set()); }}
                style={{width:15,height:15,accentColor:"var(--accent-primary)",cursor:"pointer"}} />
              <span style={{fontSize:12,color:"var(--text-muted)",whiteSpace:"nowrap"}}>Select All</span>
            </label>
          )}
          <input className="form-input" style={{flex:1,padding:"8px 12px"}} type="text"
            placeholder="Search by name..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <select className="form-select" style={{flex:1,padding:"8px 12px"}} value={groupFilter} onChange={e=>setGroupFilter(e.target.value)}>
            <option value="All">All Groups</option>
            {groups.map(g=><option key={g} value={g}>{g}</option>)}
          </select>
          <select className="form-select" style={{flex:1,padding:"8px 12px"}} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
            <option value="All">All Statuses</option>
            {RSVP_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <button className={`btn btn-sm ${outOfTownFilter?"btn-primary":"btn-secondary"}`} onClick={()=>setOutOfTownFilter(f=>!f)}>🧳 Out of Town{outOfTownFilter?" ✓":""}</button>
          <button className={`btn btn-sm ${missingAddressFilter?"btn-primary":"btn-secondary"}`} onClick={()=>setMissingAddressFilter(f=>!f)}>📭 No Address{missingAddressFilter?" ✓":""}</button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedHHIds.size > 0 && (
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",padding:"10px 14px",marginBottom:8,background:"var(--accent-light)",border:"1px solid var(--accent-medium)",borderRadius:"var(--radius-md)"}}>
          <span style={{fontSize:13,fontWeight:600,color:"var(--accent-primary)",flex:1}}>{selectedHHIds.size} household{selectedHHIds.size!==1?"s":""} selected</span>
          <select className="form-select" value={bulkStatus} onChange={e=>setBulkStatus(e.target.value)} style={{fontSize:13,padding:"6px 10px",width:"auto"}} disabled={isArchived}>
            {RSVP_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={applyBulkRsvp} disabled={isArchived}>Apply</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>setSelectedHHIds(new Set())}>Clear</button>
        </div>
      )}

      {/* List */}
      {filtered.length===0 ? (
        <div style={{textAlign:"center",padding:"60px 24px",color:"var(--text-muted)"}}>
          <div style={{fontSize:36,marginBottom:12}}>👥</div>
          <div style={{fontFamily:"var(--font-display)",fontSize:18,marginBottom:8}}>
            {households.length===0 ? "No guests yet" : "No guests match your filters"}
          </div>
          <div style={{fontSize:13,marginBottom:households.length===0?20:0}}>
            {households.length===0 ? "Add your first household or import from CSV." : "Try adjusting your search or filters."}
          </div>
          {households.length===0 && !isArchived && (
            <button className="btn btn-primary" onClick={()=>setShowAdd(true)}>+ Add Household</button>
          )}
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:6}} onClick={()=>{ if(openRsvp) setOpenRsvp(null); }}>
          {filtered.map(hh => {
            const members    = getPeopleForHousehold(people, hh.id);
            const counts     = computeHouseholdCounts(people, hh.id);
            const isExpanded = expandedHH===hh.id;
            return (
              <div key={hh.id} id={`row-${hh.id}`} style={{background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",boxShadow:"var(--shadow-sm)",position:"relative"}}>
                <div className="hh-row-main"
                  style={{borderRadius: isExpanded ? "var(--radius-md) var(--radius-md) 0 0" : "var(--radius-md)"}}
                  onClick={()=>setExpandedHH(isExpanded?null:hh.id)}>
                  {!isArchived && (
                    <div style={{flexShrink:0,display:"flex",alignItems:"center",paddingRight:4}}>
                      <input type="checkbox" checked={selectedHHIds.has(hh.id)}
                        onClick={e=>e.stopPropagation()} onChange={()=>toggleSelect(hh.id)}
                        style={{width:14,height:14,accentColor:"var(--accent-primary)",cursor:"pointer"}} />
                    </div>
                  )}
                  <div style={{color:"var(--text-muted)",fontSize:12,flexShrink:0,width:16,textAlign:"center"}}>{isExpanded?"▾":"▸"}</div>
                  <div className="hh-row-name">
                    <div className="hh-row-name-primary">{hh.formalName}</div>
                    {hh.name2 && <div className="hh-row-name-secondary">{hh.name2}</div>}
                    <div className="hh-row-mobile-meta">
                      <span className="tag tag-muted">{hh.group}</span>
                      <RsvpPill hh={hh} open={openRsvp===hh.id}
                        onOpen={e=>{e.stopPropagation();setOpenRsvp(openRsvp===hh.id?null:hh.id);}}
                        onSelect={s=>updateRsvpStatus(hh.id,s)} statusStyle={statusStyle} />
                      {hh.outOfTown && <span title="Out of town" style={{fontSize:13}}>🧳</span>}
                      {!hh.address1 && <span title="No address on file" style={{fontSize:13}}>📭</span>}
                      <span style={{fontSize:12,color:"var(--text-muted)"}} title={`${counts.adults} Adults, ${counts.kids} Kids`}>
                        {counts.adults>0 && `${counts.adults}A `}{counts.kids>0 && `${counts.kids}K`}{counts.total===0 && "no members"}
                      </span>
                    </div>
                  </div>
                  <div className="hh-row-meta">
                    <span className="tag tag-muted">{hh.group}</span>
                    <RsvpPill hh={hh} open={openRsvp===hh.id}
                      onOpen={e=>{e.stopPropagation();setOpenRsvp(openRsvp===hh.id?null:hh.id);}}
                      onSelect={s=>updateRsvpStatus(hh.id,s)} statusStyle={statusStyle} />
                    <div className="hh-row-counts" title={`${counts.adults} Adults, ${counts.kids} Kids`}>
                      {counts.adults>0 && <span>{counts.adults}A </span>}
                      {counts.kids>0   && <span>{counts.kids}K </span>}
                      {counts.total===0 && <span style={{fontStyle:"italic"}}>no members</span>}
                    </div>
                    <div style={{display:"flex",gap:4}} onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>toggleMailing(hh.id,"saveTheDateSent")} title={hh.saveTheDateSent?"Save the Date sent — click to undo":"Mark Save the Date as sent"}
                        style={{width:26,height:26,borderRadius:6,cursor:"pointer",fontSize:13,display:"inline-flex",alignItems:"center",justifyContent:"center",border:hh.saveTheDateSent?"none":"1.5px solid var(--border-strong)",background:hh.saveTheDateSent?"var(--accent-primary)":"var(--bg-surface)",color:hh.saveTheDateSent?"white":"var(--text-muted)",transition:"all var(--transition)"}}>📅</button>
                      <button onClick={()=>toggleMailing(hh.id,"inviteSent")} title={hh.inviteSent?"Invite sent — click to undo":"Mark invite as sent"}
                        style={{width:26,height:26,borderRadius:6,cursor:"pointer",fontSize:13,display:"inline-flex",alignItems:"center",justifyContent:"center",border:hh.inviteSent?"none":"1.5px solid var(--border-strong)",background:hh.inviteSent?"var(--accent-primary)":"var(--bg-surface)",color:hh.inviteSent?"white":"var(--text-muted)",transition:"all var(--transition)"}}>✉</button>
                      {hh.accommodationNeeded && <span title="Accommodation needed" style={{fontSize:14}}>🏨</span>}
                      {hh.outOfTown       && <span title="Out of town"        style={{fontSize:14}}>🧳</span>}
                      {!hh.address1       && <span title="No address on file" style={{fontSize:14}}>📭</span>}
                    </div>
                  </div>
                  <div className="hh-row-actions" onClick={e=>e.stopPropagation()}>
                    <button className="icon-btn" style={{width:32,height:32,fontSize:13}} title="Edit" disabled={isArchived} onClick={()=>setEditingHH(hh)}>✎</button>
                    <button className="icon-btn" style={{width:32,height:32,fontSize:13,color:"var(--red)"}} title="Delete" disabled={isArchived} onClick={()=>setDeleteConfirm(hh.id)}>✕</button>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{borderTop:"1px solid var(--border)",background:"var(--bg-subtle)",padding:"12px 14px 16px 14px",borderRadius:"0 0 var(--radius-md) var(--radius-md)"}}>
                    <div style={{display:"flex",gap:24,flexWrap:"wrap",marginBottom:12}}>
                      {(hh.address1 || hh.city) && <div style={{fontSize:12,color:"var(--text-secondary)"}}><span style={{color:"var(--text-muted)",marginRight:4}}>📍</span>{formatAddress(migrateCityStateZip(hh))}</div>}
                      {hh.phone && <div style={{fontSize:12,color:"var(--text-secondary)"}}><span style={{color:"var(--text-muted)",marginRight:4}}>📞</span>{hh.phone}</div>}
                      {hh.email && <div style={{fontSize:12,color:"var(--text-secondary)"}}><span style={{color:"var(--text-muted)",marginRight:4}}>✉</span>{hh.email}</div>}
                    </div>
                    {(hh.attendingAdults != null || hh.attendingKids != null) && (
                      <div style={{display:"flex",alignItems:"center",gap:8,background:"var(--green-light)",border:"1px solid var(--green)",borderRadius:"var(--radius-sm)",padding:"6px 10px",marginBottom:10,fontSize:12,color:"var(--green)",fontWeight:600}}>
                        <span>✓</span>
                        <span>Attending override set:{hh.attendingAdults!=null&&` ${hh.attendingAdults} adult${hh.attendingAdults!==1?"s":""}`}{hh.attendingAdults!=null&&hh.attendingKids!=null&&","}{hh.attendingKids!=null&&` ${hh.attendingKids} kid${hh.attendingKids!==1?"s":""}`}</span>
                        <button style={{marginLeft:"auto",fontSize:11,background:"none",border:"none",color:"var(--green)",cursor:"pointer",fontWeight:700,padding:0}}
                          onClick={()=>clearAttendingOverride(hh.id)}>Clear override</button>
                      </div>
                    )}
                    {members.length>0 ? (
                      <div style={{overflowX:"auto"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead>
                            <tr style={{borderBottom:"1px solid var(--border)"}}>
                              {[{label:"Name",align:"left"},{label:"Title",align:"left"},{label:"Age",align:"left"},{label:"Sub-Events",align:"left"},{label:"Shirt",align:"left"},{label:"Pant",align:"left"},{label:"Meal",align:"left"},{label:"Kosher",align:"center"},{label:"Dietary",align:"left"}].map(col=>(
                                <th key={col.label} style={{padding:"5px 10px",textAlign:col.align,fontWeight:700,color:"var(--text-muted)",fontSize:11,textTransform:"uppercase",letterSpacing:"0.04em",whiteSpace:"nowrap"}}>{col.label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {members.map(p=>(
                              <tr key={p.id} style={{borderBottom:"1px solid var(--border)"}}>
                                <td style={{padding:"6px 10px",fontWeight:600,color:"var(--text-primary)"}}>{[p.firstName,p.lastName].filter(Boolean).join(" ")||p.name||"—"}</td>
                                <td style={{padding:"6px 10px",color:"var(--text-secondary)"}}>{p.title||"—"}</td>
                                <td style={{padding:"6px 10px",color:"var(--text-muted)"}}>{p.isChild?"Child":"Adult"}</td>
                                <td style={{padding:"6px 10px"}}>
                                  {(p.attendingSections||[]).length===0
                                    ? <span className="tag tag-muted">TBD</span>
                                    : (p.attendingSections).map(id=>{const s=sections.find(x=>x.id===id);return <span key={id} className="tag tag-green" style={{marginRight:2,fontSize:10}}>{s?s.label:id}</span>;})}
                                </td>
                                <td style={{padding:"6px 10px",color:"var(--text-muted)"}}>{p.shirtSize||"—"}</td>
                                <td style={{padding:"6px 10px",color:"var(--text-muted)"}}>{p.pantSize||"—"}</td>
                                <td style={{padding:"6px 10px",color:"var(--text-muted)"}}>{p.mealChoice||"—"}</td>
                                <td style={{padding:"6px 10px",textAlign:"center"}}>{p.kosher?"✓":""}</td>
                                <td style={{padding:"6px 10px",color:"var(--text-muted)",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.dietary||"—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{fontSize:12,color:"var(--text-muted)",fontStyle:"italic"}}>No members added. Edit this household to add individuals.</div>
                    )}
                    {hh.notes && <div style={{marginTop:10,fontSize:12,color:"var(--text-muted)",fontStyle:"italic"}}>Note: {hh.notes}</div>}
                    {(hh.contactLog||[]).length>0 && (() => {
                      const CONTACT_TYPE_COLORS = {"Call":{bg:"var(--blue-light)",color:"var(--blue)"},"Text":{bg:"var(--green-light)",color:"var(--green)"},"Email":{bg:"var(--green-light)",color:"var(--green)"},"In Person":{bg:"var(--accent-light)",color:"var(--accent-primary)"},"Other":{bg:"var(--bg-subtle)",color:"var(--text-muted)"}};
                      const sorted = [...(hh.contactLog||[])].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
                      const fmt = d => d ? new Date(d+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "";
                      return (
                        <div style={{marginTop:12,borderTop:"1px solid var(--border)",paddingTop:10}}>
                          <div style={{fontSize:11,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:8}}>Contact Log</div>
                          <div style={{display:"flex",flexDirection:"column"}}>
                            {sorted.map((c,i)=>{const tc=CONTACT_TYPE_COLORS[c.type]||CONTACT_TYPE_COLORS["Other"];return(<div key={c.id} style={{padding:"8px 0",borderBottom:i<sorted.length-1?"1px solid var(--border)":"none",fontSize:13}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:c.notes?5:0}}><span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:99,flexShrink:0,background:tc.bg,color:tc.color}}>{c.type}</span><span style={{fontSize:12,color:"var(--text-muted)",fontWeight:500}}>{fmt(c.date)}</span></div>{c.notes&&<div style={{fontSize:12,color:"var(--text-secondary)",lineHeight:1.6,paddingLeft:2}}>{c.notes}</div>}</div>);})}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {(showAdd||editingHH) && (
        <HouseholdModal
          household={editingHH||null}
          members={editingHH ? getPeopleForHousehold(people,editingHH.id) : []}
          adminConfig={adminConfig}
          onSave={saveHousehold}
          onClose={()=>{setShowAdd(false);setEditingHH(null);}}
          isArchived={isArchived}
        />
      )}
      {showImport && <ImportModal adminConfig={adminConfig} onImport={handleImport} onClose={()=>setShowImport(false)} />}
      {showGuestExport && (
        <GuestExportModal
          households={households} people={people} tables={tables} adminConfig={adminConfig}
          onPrint={(html)=>{setGuestPrintHTML(html);setShowGuestExport(false);}}
          onClose={()=>setShowGuestExport(false)}
        />
      )}
      {guestPrintHTML && (
        <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setGuestPrintHTML(null);}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"var(--bg-surface)",borderRadius:"var(--radius-lg)",width:"95%",maxWidth:960,height:"90vh",display:"flex",flexDirection:"column",boxShadow:"var(--shadow-lg)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 20px",borderBottom:"1px solid var(--border)",flexShrink:0}}>
              <div style={{fontFamily:"var(--font-display)",fontSize:17,fontWeight:700,color:"var(--text-primary)"}}>Print Preview — Guest List</div>
              <div style={{display:"flex",gap:8}}>
                <button className="btn btn-primary" style={{fontSize:12}} onClick={()=>{const f=document.getElementById("guest-print-frame");if(f?.contentWindow)f.contentWindow.print();}}>🖨 Print</button>
                <button className="icon-btn" onClick={()=>setGuestPrintHTML(null)}>✕</button>
              </div>
            </div>
            <iframe id="guest-print-frame" srcDoc={guestPrintHTML} style={{flex:1,border:"none",borderRadius:"0 0 var(--radius-lg) var(--radius-lg)"}} title="Guest List Print Preview" />
          </div>
        </div>
      )}
      {deleteConfirm && (
        <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setDeleteConfirm(null);}}>
          <div className="modal" style={{maxWidth:400}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><div className="modal-title">Delete Household</div><button className="icon-btn" onClick={()=>setDeleteConfirm(null)}>✕</button></div>
            <div className="modal-body">
              <p style={{fontSize:14,color:"var(--text-primary)",marginBottom:8}}>This will permanently delete this household and all its members.</p>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={()=>setDeleteConfirm(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={()=>deleteHousehold(deleteConfirm)}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── HouseholdModal, ImportModal, TimelineEntryModal ───────────────────────────
// These are props-only components — no state/updateData calls — copied verbatim from V2.

export function HouseholdModal({ household, members, adminConfig, onSave, onClose, isArchived }) {
  const groups      = adminConfig?.groups        || DEFAULT_GROUPS;
  const sections    = (adminConfig?.timeline || []).map(e => ({ id: e.id, label: (e.icon ? e.icon + " " : "") + e.title }));
  const mealChoices = adminConfig?.mealChoices   || DEFAULT_MEALS;
  const sizes       = ["", ...(adminConfig?.shirtSizes || SHIRT_SIZES.filter(s => s))];
  const isEdit      = !!household;

  const [step,            setStep]            = useState(1);
  const [activeTab,       setActiveTab]       = useState("details");
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [hh, setHH] = useState(household ? { ...household, group: household.group || groups[0] || "" } : {
    id: newHouseholdId(), formalName: "", name2: "",
    address1: "", address2: "", city: "", stateProvince: "", postalCode: "", country: "",
    phone: "", email: "", group: groups[0]||"", status: "Invited",
    saveTheDateSent: false, inviteSent: false, thankYouSent: false, accommodationNeeded: false,
    rsvpDate: "", invitedSections: [], attendingAdults: null, attendingKids: null,
    outOfTown: false, notes: "", contactLog: [],
  });
  const [ppl, setPpl] = useState(
    members && members.length > 0 ? members : [{
      id: newPersonId(), householdId: hh.id, firstName: "", lastName: "", title: "",
      isChild: false, isAttending: null, attendingSections: [], tableId: null,
      shirtSize: "", pantSize: "", mealChoice: "", kosher: false, dietary: "", notes: "",
    }]
  );
  const setHHF = (k,v) => setHH(h => ({...h,[k]:v}));

  useEffect(() => {
    if (household && household.cityStateZip && !household.city) {
      setHH(h => ({ ...h, city: household.cityStateZip, stateProvince: h.stateProvince||"", postalCode: h.postalCode||"" }));
    }
  }, []);

  const addHHContact = () => setHHF("contactLog", [{ id: newContactId(), date: new Date().toISOString().slice(0,10), type: "Call", notes: "" }, ...(hh.contactLog||[])]);
  const updateHHContact = (id,field,val) => setHHF("contactLog",(hh.contactLog||[]).map(c=>c.id===id?{...c,[field]:val}:c));
  const deleteHHContact = (id) => setHHF("contactLog",(hh.contactLog||[]).filter(c=>c.id!==id));

  const addPerson = () => setPpl(ps => [...ps, { id: newPersonId(), householdId: hh.id, firstName: "", lastName: "", title: "", isChild: false, isAttending: null, attendingSections: [], tableId: null, shirtSize: "", pantSize: "", mealChoice: "", kosher: false, dietary: "", notes: "" }]);
  const removePerson = id => setPpl(ps => ps.filter(p => p.id !== id));
  const setPF = (id,k,v) => setPpl(ps => ps.map(p => p.id===id ? {...p,[k]:v} : p));

  const handleSave = () => {
    if (!hh.formalName.trim()) return;
    const validSections = hh.invitedSections || [];
    const linked = ppl
      .filter(p => (p.firstName||p.lastName||p.name||"").trim())
      .map(p => ({
        ...p,
        householdId: hh.id,
        name: [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "",
        attendingSections: validSections.length > 0 ? (p.attendingSections||[]).filter(sid=>validSections.includes(sid)) : (p.attendingSections||[]),
      }));
    onSave({ household: { ...hh, formalName: hh.formalName.trim(), name2: (hh.name2||"").trim() }, people: linked });
  };

  const checkboxRow = [
    { key:"saveTheDateSent",    label:"Save the Date Sent"  },
    { key:"inviteSent",         label:"Invite Sent"         },
    { key:"thankYouSent",       label:"Thank You Sent"      },
    { key:"accommodationNeeded",label:"Accommodation Needed"},
    { key:"outOfTown",          label:"Out of Town"         },
  ];

  const personFields = (p, idx) => (
    <div key={p.id} style={{background:"var(--bg-subtle)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:14,marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:12,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.04em"}}>Person {idx+1}</div>
        {ppl.length>1 && (
          confirmRemoveId===p.id ? (
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:12,color:"var(--text-muted)"}}>Remove {p.firstName?p.firstName:"this person"}?</span>
              <button className="btn btn-danger btn-sm" onClick={()=>{removePerson(p.id);setConfirmRemoveId(null);}}>Yes, Remove</button>
              <button className="btn btn-secondary btn-sm" onClick={()=>setConfirmRemoveId(null)}>Cancel</button>
            </div>
          ) : <button className="btn btn-danger btn-sm" onClick={()=>setConfirmRemoveId(p.id)}>Remove</button>
        )}
      </div>
      <div className="form-grid-2">
        <div className="form-group" style={{marginBottom:10}}><label className="form-label">First Name *</label><input className="form-input" value={p.firstName||""} onChange={e=>setPF(p.id,"firstName",e.target.value)} placeholder="Homer" /></div>
        <div className="form-group" style={{marginBottom:10}}><label className="form-label">Last Name</label><input className="form-input" value={p.lastName||""} onChange={e=>setPF(p.id,"lastName",e.target.value)} placeholder="Simpson" /></div>
      </div>
      <div className="form-grid-2">
        <div className="form-group" style={{marginBottom:10}}>
          <label className="form-label">Title</label>
          <select className="form-select" value={p.title||""} onChange={e=>setPF(p.id,"title",e.target.value)}>{TITLES.map(t=><option key={t} value={t}>{t||"— No title —"}</option>)}</select>
        </div>
        <div className="form-group" style={{marginBottom:10}}>
          <label className="form-label">Age</label>
          <select className="form-select" value={p.isChild?"child":"adult"} onChange={e=>setPF(p.id,"isChild",e.target.value==="child")}><option value="adult">Adult</option><option value="child">Child</option></select>
        </div>
      </div>
      {sections.length>0 && (
        <div className="form-group" style={{marginBottom:10}}>
          <label className="form-label">Attending Sub-Events</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:2}}>
            {sections.map(s=>(
              <label key={s.id} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,cursor:"pointer",background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",padding:"3px 8px"}}>
                <input type="checkbox" checked={(p.attendingSections||[]).includes(s.id)}
                  onChange={e=>{const cur=p.attendingSections||[];setPF(p.id,"attendingSections",e.target.checked?[...cur,s.id]:cur.filter(x=>x!==s.id));}}
                  style={{width:13,height:13,accentColor:"var(--accent-primary)"}} />
                {s.label}
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="form-grid-2">
        <div className="form-group" style={{marginBottom:10}}>
          <label className="form-label">Shirt Size</label>
          <select className="form-select" value={p.shirtSize||""} onChange={e=>setPF(p.id,"shirtSize",e.target.value)}>{sizes.map(s=><option key={s} value={s}>{s||"— None —"}</option>)}</select>
        </div>
        <div className="form-group" style={{marginBottom:10}}>
          <label className="form-label">Pant Size</label>
          <select className="form-select" value={p.pantSize||""} onChange={e=>setPF(p.id,"pantSize",e.target.value)}>{sizes.map(s=><option key={s} value={s}>{s||"— None —"}</option>)}</select>
        </div>
      </div>
      <div className="form-grid-2">
        <div className="form-group" style={{marginBottom:10}}>
          <label className="form-label">Meal Choice</label>
          <select className="form-select" value={p.mealChoice||""} onChange={e=>setPF(p.id,"mealChoice",e.target.value)}><option value="">— Select —</option>{mealChoices.map(m=><option key={m} value={m}>{m}</option>)}</select>
        </div>
        <div className="form-group" style={{marginBottom:10}}>
          <label className="form-label">Kosher</label>
          <select className="form-select" value={p.kosher?"yes":"no"} onChange={e=>setPF(p.id,"kosher",e.target.value==="yes")}><option value="no">No</option><option value="yes">Yes</option></select>
        </div>
      </div>
      <div className="form-group" style={{marginBottom:6}}><label className="form-label">Dietary Notes</label><input className="form-input" value={p.dietary||""} onChange={e=>setPF(p.id,"dietary",e.target.value)} placeholder="Allergies, restrictions…" /></div>
    </div>
  );

  return (
    <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal modal-lg" style={{maxWidth:640}} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{isEdit?"Edit Household":"Add Household"}</div>
            {!isEdit && <div style={{fontSize:12,color:"var(--text-muted)",marginTop:2}}>Step {step} of 2 — {step===1?"Household Details":"Members"}</div>}
          </div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        {isEdit && (
          <div className="hh-modal-tabs">
            {[{id:"details",label:"Details"},{id:"address",label:"Address"},{id:"members",label:"Members"},{id:"flags",label:"Flags & Notes"},{id:"contacts",label:"Contact Log"}].map(t=>(
              <button key={t.id} className={`hh-modal-tab ${activeTab===t.id?"active":""}`} onClick={()=>setActiveTab(t.id)}>{t.label}</button>
            ))}
          </div>
        )}
        <div className="modal-body" style={{maxHeight:"calc(85vh - 120px)",overflowY:"auto"}}>

          {/* ADD step 1 or EDIT details tab */}
          {((!isEdit && step===1) || (isEdit && activeTab==="details")) && (<>
            <div className="form-group"><label className="form-label">Formal Invitation Name *</label><input className="form-input" value={hh.formalName} onChange={e=>setHHF("formalName",e.target.value)} placeholder="e.g., Mr. and Mrs. Homer Simpson" /><div className="form-hint">As it will appear on the invitation envelope</div></div>
            <div className="form-group"><label className="form-label">Name 2 (second line)</label><input className="form-input" value={hh.name2} onChange={e=>setHHF("name2",e.target.value)} placeholder="e.g., Miss Lisa Simpson and Mr. Bart Simpson" /></div>
            <div className="form-grid-2">
              <div className="form-group"><label className="form-label">Group</label><select className="form-select" value={hh.group} onChange={e=>setHHF("group",e.target.value)}>{groups.map(g=><option key={g} value={g}>{g}</option>)}</select></div>
              <div className="form-group"><label className="form-label">RSVP Status</label><select className="form-select" value={hh.status} onChange={e=>setHHF("status",e.target.value)}>{RSVP_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
            </div>
            <div className="form-group">
              <label className="form-label">RSVP Date</label>
              <input className="form-input" type="date" value={hh.rsvpDate} onChange={e=>setHHF("rsvpDate",e.target.value)} />
              {hh.rsvpDate && <div style={{fontSize:11,color:"var(--text-muted)",marginTop:3}}>{new Date(hh.rsvpDate+"T00:00:00").toLocaleDateString("en-US",{weekday:"short",year:"numeric",month:"short",day:"numeric"})}</div>}
            </div>
            {sections.length>0 && (
              <div className="form-group">
                <label className="form-label">Invited To Sub-Events</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:2}}>
                  {sections.map(s=>(
                    <label key={s.id} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,cursor:"pointer",background:"var(--bg-subtle)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",padding:"3px 8px"}}>
                      <input type="checkbox" checked={(hh.invitedSections||[]).includes(s.id)}
                        onChange={e=>{const cur=hh.invitedSections||[];setHHF("invitedSections",e.target.checked?[...cur,s.id]:cur.filter(x=>x!==s.id));}}
                        style={{width:13,height:13,accentColor:"var(--accent-primary)"}} />{s.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </>)}

          {/* Address tab (edit only) or in-line (add step 1) */}
          {((!isEdit && step===1) || (isEdit && activeTab==="address")) && (<>
            <div className="form-group"><label className="form-label">Address</label><input className="form-input" value={hh.address1} onChange={e=>setHHF("address1",e.target.value)} placeholder="Street address" /></div>
            <div className="form-group"><label className="form-label">Address Line 2</label><input className="form-input" value={hh.address2||""} onChange={e=>setHHF("address2",e.target.value)} placeholder="Apt, Suite, Unit (optional)" /></div>
            <div className="form-group"><label className="form-label">Country</label><select className="form-select" value={hh.country||""} onChange={e=>setHHF("country",e.target.value)}><option value="">— Select country —</option>{COUNTRIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            <div className="form-group"><label className="form-label">City</label><input className="form-input" value={hh.city||""} onChange={e=>setHHF("city",e.target.value)} placeholder="Springfield" /></div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">{getAddressFields(hh.country).stateLabel}</label>
                {getAddressFields(hh.country).stateOptions
                  ? <select className="form-select" value={hh.stateProvince||""} onChange={e=>setHHF("stateProvince",e.target.value)}><option value="">— Select —</option>{getAddressFields(hh.country).stateOptions.map(s=><option key={s} value={s}>{s}</option>)}</select>
                  : <input className="form-input" value={hh.stateProvince||""} onChange={e=>setHHF("stateProvince",e.target.value)} placeholder="Region" />}
              </div>
              <div className="form-group"><label className="form-label">{getAddressFields(hh.country).postalLabel}</label><input className="form-input" value={hh.postalCode||""} onChange={e=>setHHF("postalCode",e.target.value)} placeholder="Postal code" /></div>
            </div>
            <div className="form-grid-2">
              <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={hh.phone} onChange={e=>setHHF("phone",e.target.value)} onBlur={e=>setHHF("phone",formatPhone(e.target.value))} placeholder="(555) 555-1234" /></div>
              <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={hh.email} onChange={e=>setHHF("email",e.target.value)} onBlur={e=>setHHF("email",e.target.value.toLowerCase().trim())} placeholder="email@example.com" /></div>
            </div>
          </>)}

          {/* Flags & Notes */}
          {((!isEdit && step===1) || (isEdit && activeTab==="flags")) && (
            <>
              <div style={{display:"flex",gap:20,flexWrap:"wrap",marginBottom:14}}>
                {checkboxRow.map(({key,label})=>(
                  <label key={key} style={{display:"flex",alignItems:"center",gap:7,fontSize:13,cursor:"pointer"}}>
                    <input type="checkbox" checked={!!hh[key]} onChange={e=>setHHF(key,e.target.checked)} style={{width:15,height:15,accentColor:"var(--accent-primary)"}} />{label}
                  </label>
                ))}
              </div>
              <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" value={hh.notes} rows={2} onChange={e=>setHHF("notes",e.target.value)} placeholder="Any notes about this household..." /></div>
            </>
          )}

          {/* Members tab (edit) or step 2 (add) */}
          {((!isEdit && step===2) || (isEdit && activeTab==="members")) && (<>
            <div style={{marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:13,color:"var(--text-muted)"}}>Add each individual in this household.</div>
              <button className="btn btn-secondary btn-sm" onClick={addPerson}>+ Add Person</button>
            </div>
            {ppl.map((p, idx) => personFields(p, idx))}
          </>)}

          {/* Contact Log tab (edit only) */}
          {isEdit && activeTab==="contacts" && (<>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontSize:13,color:"var(--text-muted)"}}>Log calls, texts, and emails with this household.</div>
              <button className="btn btn-secondary btn-sm" onClick={addHHContact}>+ Log Contact</button>
            </div>
            {(hh.contactLog||[]).length===0 && <div style={{fontSize:13,color:"var(--text-muted)",fontStyle:"italic",padding:"16px 0"}}>No contacts logged yet.</div>}
            {[...(hh.contactLog||[])].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map(c=>(
              <div key={c.id} style={{background:"var(--bg-subtle)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",padding:"10px 12px",marginBottom:8}}>
                <div className="form-grid-2">
                  <div className="form-group" style={{marginBottom:8}}>
                    <label className="form-label">Type</label>
                    <select className="form-select" value={c.type||"Call"} onChange={e=>updateHHContact(c.id,"type",e.target.value)}>{["Call","Text","Email","In Person","Other"].map(t=><option key={t} value={t}>{t}</option>)}</select>
                  </div>
                  <div className="form-group" style={{marginBottom:8}}>
                    <label className="form-label">Date</label>
                    <input className="form-input" type="date" value={c.date||""} onChange={e=>updateHHContact(c.id,"date",e.target.value)} />
                  </div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                  <input className="form-input" style={{flex:1}} value={c.notes||""} onChange={e=>updateHHContact(c.id,"notes",e.target.value)} placeholder="Notes about this contact…" />
                  <button className="icon-btn" style={{color:"var(--red)",flexShrink:0,marginTop:2}} onClick={()=>deleteHHContact(c.id)}>✕</button>
                </div>
              </div>
            ))}
          </>)}

          <div className="modal-footer">
            {!isEdit && step===1 && <><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={()=>setStep(2)} disabled={!hh.formalName.trim()}>Next: Members →</button></>}
            {!isEdit && step===2 && <><button className="btn btn-secondary" onClick={()=>setStep(1)}>← Back</button><button className="btn btn-primary" onClick={handleSave} disabled={!hh.formalName.trim()}>Add Household</button></>}
            {isEdit && <><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={!hh.formalName.trim()||isArchived}>Save Changes</button></>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ImportModal({ adminConfig, onImport, onClose }) {
  const [stage,          setStage]          = useState("upload");
  const [rows,           setRows]           = useState([]);
  const [headers,        setHeaders]        = useState([]);
  const [mapping,        setMapping]        = useState({});
  const [confidence,     setConfidence]     = useState({});
  const [isPeopleCentric, setIsPeopleCentric] = useState(false);
  const [preview,        setPreview]        = useState(null);
  const [mergeMode,      setMergeMode]      = useState("append");
  const [error,          setError]          = useState("");

  const FIELD_LABELS = {
    FormalName:"Household / Formal Name ★",Name2:"Name 2 (additional members)",
    Address1:"Street Address",Address2:"Address Line 2",City:"City",
    StateProvince:"State / Province",PostalCode:"Postal / ZIP Code",Country:"Country",
    Phone:"Phone",Email:"Email",Group:"Group",Status:"RSVP Status",
    EventSection:"Event Section",SaveTheDateSent:"Save the Date Sent",InviteSent:"Invite Sent",
    AccommodationNeeded:"Accommodation Needed",HouseholdNotes:"Household Notes",
    PersonFirstName:"Person First Name",PersonLastName:"Person Last Name",
    Title:"Title (Mr./Ms./etc.)",IsChild:"Is Child",IsAttending:"Is Attending",
    ShirtSize:"Shirt Size",PantSize:"Pant Size",MealChoice:"Meal Choice",
    Kosher:"Kosher",Dietary:"Dietary Notes",PersonNotes:"Person Notes",
  };

  const handleFile = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = parseCSV(ev.target.result);
        if (parsed.length===0){setError("No data rows found.");return;}
        const hdrs = Object.keys(parsed[0]);
        const {mapping:autoMap,confidence:autoConf,allMapped,isPeopleCentric:peopleCentric} = detectColumnMapping(hdrs);
        setRows(parsed);setHeaders(hdrs);setMapping(autoMap);setConfidence(autoConf);setIsPeopleCentric(peopleCentric);setError("");
        if (allMapped) {
          const {households,people,errors} = importCSVToGuestData(parsed,autoMap,peopleCentric);
          if (households.length===0){setError("Could not parse any households.");return;}
          setPreview({households,people,errors,peopleCentric});setStage("preview");
        } else { setStage("mapping"); }
      } catch(err){setError("Could not parse CSV: "+err.message);}
    };
    reader.readAsText(file);
  };

  const handleApplyMapping = () => {
    if (!mapping["FormalName"]&&!isPeopleCentric){setError("Please map the Household / Formal Name column.");return;}
    const {households,people,errors} = importCSVToGuestData(rows,mapping,isPeopleCentric);
    if (households.length===0){setError("Could not parse any households with the current mapping.");return;}
    setPreview({households,people,errors,peopleCentric:isPeopleCentric});setError("");setStage("preview");
  };

  const handleDownloadTemplate = () => {
    const csv=generateCSVTemplate(adminConfig);
    const blob=new Blob([csv],{type:"text/csv"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="simchakit-guest-template.csv";a.click();URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal modal-lg" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><div className="modal-title">Import Guests</div><button className="icon-btn" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          {stage==="upload" && (<>
            <div className="alert alert-info" style={{marginBottom:16}}>Upload any CSV file — SimchaKit will detect your columns automatically.</div>
            {error && <div className="alert alert-error" style={{marginBottom:12}}>{error}</div>}
            <div style={{marginBottom:16}}><button className="btn btn-secondary" onClick={handleDownloadTemplate}>↓ Download CSV Template</button></div>
            <div className="divider" />
            <div className="form-group"><label className="form-label">Upload CSV File</label><input type="file" accept=".csv,.txt" onChange={handleFile} style={{fontSize:13,color:"var(--text-primary)"}} /></div>
            <div className="form-group">
              <label className="form-label">Import Mode</label>
              <select className="form-select" value={mergeMode} onChange={e=>setMergeMode(e.target.value)}>
                <option value="append">Append to existing list</option>
                <option value="replace">Replace existing list</option>
              </select>
              {mergeMode==="replace"&&<div className="form-hint" style={{color:"var(--red)"}}>Warning: this will delete all existing guest data.</div>}
            </div>
          </>)}
          {stage==="mapping" && (<>
            <div className="alert alert-info" style={{marginBottom:12}}>Review the column mapping below. <strong>Household / Formal Name</strong> is required.</div>
            {error&&<div className="alert alert-error" style={{marginBottom:12}}>{error}</div>}
            <div style={{maxHeight:360,overflowY:"auto",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",marginBottom:12}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead><tr style={{background:"var(--bg-subtle)",position:"sticky",top:0}}><th style={{padding:"8px 12px",textAlign:"left",fontWeight:700,color:"var(--text-muted)",borderBottom:"1px solid var(--border)",fontSize:11,textTransform:"uppercase"}}>Your Column</th><th style={{padding:"8px 12px",textAlign:"left",fontWeight:700,color:"var(--text-muted)",borderBottom:"1px solid var(--border)",fontSize:11,textTransform:"uppercase"}}>SimchaKit Field</th></tr></thead>
                <tbody>
                  {headers.map(h=>{
                    const mappedField=Object.entries(mapping).find(([,v])=>v===h)?.[0]||"";
                    return(<tr key={h} style={{borderBottom:"1px solid var(--border)"}}><td style={{padding:"8px 12px",fontWeight:500}}>{h}{mappedField&&confidence[mappedField]==="alias"&&<span style={{marginLeft:6,fontSize:10,color:"var(--gold)",fontWeight:700}}>auto-matched</span>}{mappedField&&confidence[mappedField]==="exact"&&<span style={{marginLeft:6,fontSize:10,color:"var(--green)",fontWeight:700}}>✓</span>}</td><td style={{padding:"6px 12px"}}><select className="form-select" style={{fontSize:12}} value={mappedField} onChange={e=>{const nf=e.target.value;const u={...mapping};Object.keys(u).forEach(k=>{if(u[k]===h)delete u[k];});if(nf){Object.keys(u).forEach(k=>{if(k===nf)delete u[k];});u[nf]=h;}setMapping(u);}}><option value="">— Skip this column —</option>{Object.entries(FIELD_LABELS).map(([field,label])=>(<option key={field} value={field}>{label}</option>))}</select></td></tr>);
                  })}
                </tbody>
              </table>
            </div>
          </>)}
          {stage==="preview" && preview && (<>
            {preview.peopleCentric&&<div className="alert alert-info" style={{marginBottom:12}}><strong>Person-by-person format detected.</strong> Households have been automatically grouped.</div>}
            {preview.errors&&preview.errors.length>0&&(<div className="alert alert-error" style={{marginBottom:12}}><div style={{fontWeight:700,marginBottom:6}}>⚠ {preview.errors.length} row{preview.errors.length!==1?"s":""} could not be imported</div><div style={{maxHeight:120,overflowY:"auto"}}>{preview.errors.map((err,i)=>(<div key={i} style={{fontSize:12,borderTop:i>0?"1px solid rgba(0,0,0,0.1)":"none",paddingTop:i>0?4:0,marginTop:i>0?4:0}}><strong>Row {err.rowIndex}:</strong> {err.message}</div>))}</div></div>)}
            <div className="alert alert-success" style={{marginBottom:12}}>Ready to import {preview.households.length} household{preview.households.length!==1?"s":""} and {preview.people.length} individual{preview.people.length!==1?"s":""}.</div>
            <div style={{maxHeight:280,overflowY:"auto",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr style={{background:"var(--bg-subtle)",position:"sticky",top:0}}>{["Household","Members","Group","Status"].map(h=>(<th key={h} style={{padding:"8px 12px",textAlign:"left",fontWeight:700,color:"var(--text-muted)",borderBottom:"1px solid var(--border)",fontSize:11,textTransform:"uppercase"}}>{h}</th>))}</tr></thead><tbody>{preview.households.map(hh=>{const members=preview.people.filter(p=>p.householdId===hh.id);return(<tr key={hh.id} style={{borderBottom:"1px solid var(--border)"}}><td style={{padding:"8px 12px",fontWeight:600}}>{hh.formalName}</td><td style={{padding:"8px 12px",color:"var(--text-secondary)"}}>{members.length>0?members.map(p=>[p.firstName,p.lastName].filter(Boolean).join(" ")||p.name||"?").join(", "):<span style={{color:"var(--text-muted)",fontStyle:"italic"}}>None</span>}</td><td style={{padding:"8px 12px",color:"var(--text-muted)"}}>{hh.group}</td><td style={{padding:"8px 12px",color:"var(--text-muted)"}}>{hh.status}</td></tr>);})}</tbody></table></div>
            <div style={{marginTop:10,fontSize:12,color:"var(--text-muted)"}}>Mode: <strong>{mergeMode==="append"?"Append to existing list":"Replace existing list"}</strong></div>
          </>)}
          {stage==="done"&&<div className="alert alert-success">Import complete. Your guest list has been updated.</div>}
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>{stage==="done"?"Close":"Cancel"}</button>
            {stage==="mapping"&&<><button className="btn btn-secondary" onClick={()=>{setStage("upload");setError("");}}>Back</button><button className="btn btn-primary" onClick={handleApplyMapping}>Preview Import</button></>}
            {stage==="preview"&&<><button className="btn btn-secondary" onClick={()=>setStage("upload")}>Back</button><button className="btn btn-primary" onClick={()=>{onImport(preview,mergeMode);setStage("done");}}>Confirm Import{preview?.errors?.length>0?` (${preview.households.length} rows)`:""}</button></>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TimelineEntryModal({ entry, onSave, onClose }) {
  const isEdit = !!entry;
  const initParts = (timeStr) => parseTimeParts(timeStr);
  const [form, setForm] = useState(entry || { id: newTimelineId(), icon: "", title: "", startDate: "", startTime: "", endDate: "", endTime: "", venue: "", notes: "", isMainEvent: false });
  const setF = (k,v) => setForm(f=>({...f,[k]:v}));
  const sp0 = initParts(form.startTime); const ep0 = initParts(form.endTime);
  const [sH,setSH]=useState(sp0.h);const [sM,setSM]=useState(sp0.m);const [sAP,setSAP]=useState(sp0.ap);
  const [eH,setEH]=useState(ep0.h);const [eM,setEM]=useState(ep0.m);const [eAP,setEAP]=useState(ep0.ap);
  const onStartPart=(h,m,ap)=>{const t=buildTime(h,m,ap);if(t)setF("startTime",t);};
  const onEndPart=(h,m,ap)=>{const t=buildTime(h,m,ap);if(t)setF("endTime",t);};
  const selStyle={flex:1,minWidth:0};
  return (
    <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal" style={{maxWidth:480}} onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><div className="modal-title">{isEdit?"Edit Timeline Event":"Add Timeline Event"}</div><button className="icon-btn" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div className="form-grid-2">
            <div className="form-group" style={{flex:"0 0 80px"}}><label className="form-label">Icon</label><input className="form-input" value={form.icon} onChange={e=>setF("icon",e.target.value)} placeholder="📅" style={{textAlign:"center",fontSize:20}} maxLength={4} /></div>
            <div className="form-group" style={{flex:1}}><label className="form-label">Title *</label><input className="form-input" autoFocus value={form.title} onChange={e=>setF("title",e.target.value)} placeholder="e.g., Ceremony" /></div>
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Start Date *</label><input className="form-input" type="date" value={form.startDate||""} onChange={e=>setF("startDate",e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Start Time</label><div style={{display:"flex",gap:4}}><select className="form-select" style={selStyle} value={sH} onChange={e=>{setSH(e.target.value);onStartPart(e.target.value,sM,sAP);}}><option value="">HH</option>{TL_HOURS.map(h=><option key={h} value={h}>{h}</option>)}</select><select className="form-select" style={selStyle} value={sM} onChange={e=>{setSM(e.target.value);onStartPart(sH,e.target.value,sAP);}}><option value="">MM</option>{TL_MINUTES.map(m=><option key={m} value={m}>{m}</option>)}</select><select className="form-select" style={selStyle} value={sAP} onChange={e=>{setSAP(e.target.value);onStartPart(sH,sM,e.target.value);}}><option value="">—</option><option value="AM">AM</option><option value="PM">PM</option></select></div></div>
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">End Date</label><input className="form-input" type="date" value={form.endDate||""} onChange={e=>setF("endDate",e.target.value)} /><div className="form-hint">Leave blank if same day</div></div>
            <div className="form-group"><label className="form-label">End Time</label><div style={{display:"flex",gap:4}}><select className="form-select" style={selStyle} value={eH} onChange={e=>{setEH(e.target.value);onEndPart(e.target.value,eM,eAP);}}><option value="">HH</option>{TL_HOURS.map(h=><option key={h} value={h}>{h}</option>)}</select><select className="form-select" style={selStyle} value={eM} onChange={e=>{setEM(e.target.value);onEndPart(eH,e.target.value,eAP);}}><option value="">MM</option>{TL_MINUTES.map(m=><option key={m} value={m}>{m}</option>)}</select><select className="form-select" style={selStyle} value={eAP} onChange={e=>{setEAP(e.target.value);onEndPart(eH,eM,e.target.value);}}><option value="">—</option><option value="AM">AM</option><option value="PM">PM</option></select></div></div>
          </div>
          <div className="form-group"><label className="form-label">Venue / Location</label><input className="form-input" value={form.venue||""} onChange={e=>setF("venue",e.target.value)} placeholder="e.g., Springfield Grand Ballroom" /></div>
          <div className="form-group"><label className="form-label">Notes</label><input className="form-input" value={form.notes||""} onChange={e=>setF("notes",e.target.value)} placeholder="Any additional details…" /></div>
          <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:"var(--text-primary)",marginBottom:16}}>
            <input type="checkbox" checked={!!form.isMainEvent} onChange={e=>setF("isMainEvent",e.target.checked)} style={{width:15,height:15,accentColor:"var(--accent-primary)"}} />
            Count down to this event
          </label>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={()=>{if(!form.title.trim()||!form.startDate)return;const endDate=(!form.endDate&&form.endTime)?form.startDate:form.endDate;onSave({...form,endDate,title:form.title.trim()});}} disabled={!form.title.trim()||!form.startDate}>{isEdit?"Save Changes":"Add Event"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GuestExportModal({ households, people, tables, adminConfig, onPrint, onClose }) {
  const [activeExport, setActiveExport] = useState(null);
  const [copied,       setCopied]       = useState(false);
  const csvContent = (() => {
    if (activeExport==="byHousehold") return exportGuestsByHousehold(households,people,adminConfig);
    if (activeExport==="byPerson")    return exportGuestsByPerson(households,people,adminConfig,tables);
    if (activeExport==="mailing")     return exportToInvitationCSV(households,people);
    return "";
  })();
  const handlePrint = () => {
    const mainEvt=(adminConfig?.timeline||[]).find(e=>e.isMainEvent);
    onPrint(generateGuestPrintHTML(households,people,adminConfig?.name||"",mainEvt?.startDate||"",adminConfig?.theme||{}));
  };
  const OPTION=(key)=>({flex:"1 1 180px",padding:"14px 16px",borderRadius:"var(--radius-md)",border:activeExport===key?"2px solid var(--accent-primary)":"2px solid var(--border)",background:activeExport===key?"var(--accent-light)":"var(--bg-surface)",cursor:"pointer",textAlign:"left",transition:"border-color 0.15s"});
  const PRINT_OPT=()=>({flex:"1 1 180px",padding:"14px 16px",borderRadius:"var(--radius-md)",border:"2px solid var(--border)",background:"var(--bg-surface)",cursor:"pointer",textAlign:"left"});
  const ALERT_TEXT={byHousehold:"One row per household, sorted by last name.",byPerson:"One row per person with meal, kosher, dietary, shirt size, and table.",mailing:"Address fields split into columns for mail-merge. Ready for any vendor."};
  return (
    <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal modal-lg" style={{maxWidth:640}} onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><div className="modal-title">Export Guest List</div><button className="icon-btn" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
            <button style={OPTION("byHousehold")} onClick={()=>{setActiveExport("byHousehold");setCopied(false);}}><div style={{fontSize:22,marginBottom:6}}>🏠</div><div style={{fontWeight:700,fontSize:13,marginBottom:4}}>By Household</div><div style={{fontSize:11,color:"var(--text-muted)",lineHeight:1.5}}>One row per household with RSVP, headcount, address.</div></button>
            <button style={OPTION("byPerson")} onClick={()=>{setActiveExport("byPerson");setCopied(false);}}><div style={{fontSize:22,marginBottom:6}}>👤</div><div style={{fontWeight:700,fontSize:13,marginBottom:4}}>By Person</div><div style={{fontSize:11,color:"var(--text-muted)",lineHeight:1.5}}>One row per individual — meal, kosher, dietary, shirt, table.</div></button>
            <button style={OPTION("mailing")} onClick={()=>{setActiveExport("mailing");setCopied(false);}}><div style={{fontSize:22,marginBottom:6}}>✉️</div><div style={{fontWeight:700,fontSize:13,marginBottom:4}}>Mailing / Invitations</div><div style={{fontSize:11,color:"var(--text-muted)",lineHeight:1.5}}>Formal names + split address columns for mail-merge.</div></button>
            <button style={PRINT_OPT()} onClick={handlePrint}><div style={{fontSize:22,marginBottom:6}}>🖨</div><div style={{fontWeight:700,fontSize:13,marginBottom:4}}>Printable View</div><div style={{fontSize:11,color:"var(--text-muted)",lineHeight:1.5}}>Grouped by family with RSVP, headcount, dietary flags.</div></button>
          </div>
          {activeExport && (<><div className="alert alert-info" style={{marginBottom:10}}>{ALERT_TEXT[activeExport]}</div><textarea readOnly value={csvContent} onClick={e=>e.target.select()} style={{width:"100%",minHeight:180,background:"var(--bg-subtle)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",padding:10,fontFamily:"var(--font-mono,monospace)",fontSize:11,resize:"vertical"}} /><div className="modal-footer" style={{marginTop:12}}><button className="btn btn-ghost" onClick={onClose}>Close</button><button className="btn btn-primary" onClick={()=>navigator.clipboard.writeText(csvContent).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);})}>{copied?"✓ Copied!":"Copy to Clipboard"}</button></div></>)}
          {!activeExport && <div className="modal-footer"><button className="btn btn-ghost" onClick={onClose}>Cancel</button></div>}
        </div>
      </div>
    </div>
  );
}

// ── GuestInsights (unchanged from V2) ─────────────────────────────────────────
function GuestInsights({ households, people, groups, statusStyle }) {
  const [open, setOpen] = useState(true);
  const hasData = households.length > 0;

  const rsvpData = useMemo(()=>{
    const counts={};households.forEach(h=>{const s=h.status||"Invited";counts[s]=(counts[s]||0)+1;});
    return ["RSVP Yes","Invited","Pending","Maybe","RSVP No"].filter(s=>counts[s]>0).map(s=>({name:s,value:counts[s]}));
  },[households]);

  const breakdownData = useMemo(()=>{
    const adults=people.filter(p=>!p.isChild).length;const kids=people.filter(p=>p.isChild).length;
    return [{name:"Adults",value:adults},{name:"Kids",value:kids}].filter(d=>d.value>0);
  },[people]);

  const groupData = useMemo(()=>{
    const counts={};households.forEach(h=>{const g=h.group||"Other";counts[g]=(counts[g]||0)+1;});
    return groups.filter(g=>counts[g]>0).map(g=>({name:g,value:counts[g]})).sort((a,b)=>b.value-a.value);
  },[households,groups]);

  if (!hasData) return null;

  const RSVP_COLORS={"RSVP Yes":"var(--green)","Invited":"var(--blue)","Pending":"var(--orange)","Maybe":"var(--gold)","RSVP No":"var(--red)"};
  const GROUP_COLORS=["var(--accent-primary)","var(--blue)","var(--green)","var(--gold)","var(--orange)","var(--red)"];
  const BREAKDOWN_COLORS=["var(--accent-primary)","var(--blue)"];

  const RsvpTT=({active,payload})=>{if(!active||!payload?.length)return null;const d=payload[0]?.payload;const pct=households.length>0?Math.round((d.value/households.length)*100):0;return<div className="budget-chart-tooltip"><div className="budget-chart-tooltip-title">{d.name}</div><div className="budget-chart-tooltip-row"><span className="budget-chart-tooltip-dot" style={{background:RSVP_COLORS[d.name]||"var(--accent-primary)"}} /><span>{d.value} household{d.value!==1?"s":""}</span><span style={{fontWeight:700}}>{pct}%</span></div></div>;};
  const BreakdownTT=({active,payload})=>{if(!active||!payload?.length)return null;const d=payload[0]?.payload;const pct=people.length>0?Math.round((d.value/people.length)*100):0;return<div className="budget-chart-tooltip"><div className="budget-chart-tooltip-title">{d.name}</div><div className="budget-chart-tooltip-row"><span className="budget-chart-tooltip-dot" style={{background:d.name==="Adults"?BREAKDOWN_COLORS[0]:BREAKDOWN_COLORS[1]}} /><span>{d.value} {d.name.toLowerCase()}</span><span style={{fontWeight:700}}>{pct}%</span></div></div>;};
  const GroupTT=({active,payload})=>{if(!active||!payload?.length)return null;const d=payload[0]?.payload;const pct=households.length>0?Math.round((d.value/households.length)*100):0;return<div className="budget-chart-tooltip"><div className="budget-chart-tooltip-title">{d.name}</div><div className="budget-chart-tooltip-row"><span>{d.value} household{d.value!==1?"s":""}</span><span style={{fontWeight:700}}>{pct}%</span></div></div>;};
  const renderPieLabel=({cx,cy,midAngle,innerRadius,outerRadius,value})=>{if(value===0)return null;const RADIAN=Math.PI/180;const radius=innerRadius+(outerRadius-innerRadius)*0.5;const x=cx+radius*Math.cos(-midAngle*RADIAN);const y=cy+radius*Math.sin(-midAngle*RADIAN);return<text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" style={{fontSize:12,fontWeight:700}}>{value}</text>;};
  const collapsedSummary=[`${households.length} household${households.length!==1?"s":""}`,`${people.length} guest${people.length!==1?"s":""}`,rsvpData.find(d=>d.name==="RSVP Yes")?`${rsvpData.find(d=>d.name==="RSVP Yes").value} confirmed`:null].filter(Boolean).join(" · ");

  return (
    <div className="card budget-insights" style={{marginBottom:20}}>
      <div className="budget-insights-header" onClick={()=>setOpen(o=>!o)}>
        <div>
          <div className="card-title" style={{marginBottom:0}}>👥 Guest Insights</div>
          {!open&&<div className="card-subtitle" style={{marginBottom:0,marginTop:4}}>{collapsedSummary} · click to expand</div>}
        </div>
        <button className="budget-insights-toggle">{open?"▴":"▾"}</button>
      </div>
      {open && (
        <div className="budget-insights-body">
          <div className="guest-insights-top-row">
            <div className="budget-chart-section guest-insights-rsvp">
              <div className="budget-chart-title">RSVP Breakdown</div>
              <div className="budget-chart-subtitle">Households by response status</div>
              <ResponsiveContainer width="100%" height={Math.max(120,rsvpData.length*36)}>
                <BarChart data={rsvpData} layout="vertical" margin={{top:4,right:48,left:0,bottom:4}} barSize={16}>
                  <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} tick={{fontSize:11,fill:"var(--text-muted)"}} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={80} tick={{fontSize:12,fill:"var(--text-primary)"}} axisLine={false} tickLine={false} />
                  <Tooltip content={<RsvpTT />} cursor={{fill:"var(--bg-subtle)"}} />
                  <Bar dataKey="value" radius={[0,4,4,0]}>{rsvpData.map(entry=><Cell key={entry.name} fill={RSVP_COLORS[entry.name]||"var(--accent-primary)"} fillOpacity={0.8} />)}<LabelList dataKey="value" position="right" style={{fontSize:12,fontWeight:700,fill:"var(--text-secondary)"}} /></Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {breakdownData.length>0 && (
              <div className="budget-chart-section guest-insights-breakdown">
                <div className="budget-chart-title">Guest Breakdown</div>
                <div className="budget-chart-subtitle">{people.length} individual{people.length!==1?"s":""} total</div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                  <PieChart width={180} height={180}><Pie data={breakdownData} cx={88} cy={88} innerRadius={48} outerRadius={80} paddingAngle={3} dataKey="value" labelLine={false} label={renderPieLabel}>{breakdownData.map((entry,i)=><Cell key={entry.name} fill={BREAKDOWN_COLORS[i%BREAKDOWN_COLORS.length]} fillOpacity={0.85} />)}</Pie><Tooltip content={<BreakdownTT />} /></PieChart>
                  <div style={{display:"flex",gap:14,justifyContent:"center",marginTop:4}}>
                    {breakdownData.map((entry,i)=>(<div key={entry.name} style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:10,height:10,borderRadius:"50%",flexShrink:0,display:"inline-block",background:BREAKDOWN_COLORS[i%BREAKDOWN_COLORS.length],opacity:0.85}} /><span style={{fontSize:12,color:"var(--text-secondary)"}}>{entry.name}</span></div>))}
                  </div>
                </div>
              </div>
            )}
          </div>
          {groupData.length>1 && (
            <div className="budget-chart-section">
              <div className="budget-chart-title">Households by Group</div>
              <div className="budget-chart-subtitle">How your guest list is divided</div>
              <ResponsiveContainer width="100%" height={Math.max(100,groupData.length*36)}>
                <BarChart data={groupData} layout="vertical" margin={{top:4,right:48,left:0,bottom:4}} barSize={16}>
                  <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} tick={{fontSize:11,fill:"var(--text-muted)"}} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={110} tick={{fontSize:12,fill:"var(--text-primary)"}} axisLine={false} tickLine={false} />
                  <Tooltip content={<GroupTT />} cursor={{fill:"var(--bg-subtle)"}} />
                  <Bar dataKey="value" radius={[0,4,4,0]}>{groupData.map((entry,i)=><Cell key={entry.name} fill={GROUP_COLORS[i%GROUP_COLORS.length]} fillOpacity={0.75} />)}<LabelList dataKey="value" position="right" style={{fontSize:12,fontWeight:700,fill:"var(--text-secondary)"}} /></Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const loadingStyle = { padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 };
