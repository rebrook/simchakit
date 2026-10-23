// Moved verbatim from GuestsTab.jsx (V4.45.1 module split) — no behavior changes.
import { RSVP_STATUSES } from "@/constants/guest-constants.js";
import { Icon } from "@/utils/iconMap.jsx";

export function GuestFilters({ chipCounts, filtered, groupFilter, groups, isArchived, isMobile, isViewer, missingAddressFilter, mobileChip, outOfTownFilter, search, sections, selectedHHIds, setGroupFilter, setMissingAddressFilter, setMobileChip, setMobileMoreFiltersOpen, setOutOfTownFilter, setSearch, setSelectedHHIds, setShowAdd, setShowMoreFilters, setStatusFilter, setSubEventFilter, setSubEventStatusFilter, showMoreFilters, statusFilter, subEventFilter, subEventStatusFilter }) {
  return (
    isMobile ? (
      <div className="guest-mobile-filters">
        <div className="guest-mobile-filters-top">
          <input className="form-input" style={{flex:1,padding:"10px 12px",fontSize:15}} type="text"
            placeholder="Search by name..." value={search} onChange={e=>setSearch(e.target.value)} />
          {!isViewer && (
            <button className="btn btn-primary guest-mobile-add-btn" disabled={isArchived} onClick={()=>setShowAdd(true)}>
              <Icon name="plus" context="inline" />
            </button>
          )}
        </div>
        <div className="guest-mobile-chips">
          {["All","Confirmed","Pending","Declined"].map(chip => {
            const count = chipCounts[chip];
            const isActive = mobileChip === chip;
            const toneClass = chip === "Confirmed" ? "chip-confirmed" : chip === "Pending" ? "chip-pending" : chip === "Declined" ? "chip-declined" : "";
            return (
              <button key={chip}
                className={`guest-chip ${isActive ? `guest-chip-active ${toneClass}` : ""}`}
                onClick={() => setMobileChip(chip)}>
                {chip} {count}
              </button>
            );
          })}
          {sections.length > 1 && (
            <button className={`guest-chip ${subEventFilter.length>0?"guest-chip-active":""}`}
              onClick={()=>setMobileMoreFiltersOpen(true)}>
              Sub-Events{subEventFilter.length>0?` (${subEventFilter.length})`:""}
            </button>
          )}
        </div>
        <select className="form-select" style={{padding:"10px 12px",fontSize:14}} value={groupFilter} onChange={e=>setGroupFilter(e.target.value)}>
          <option value="All">All Groups</option>
          {groups.map(g=><option key={g} value={g}>{g}</option>)}
        </select>
      </div>
    ) : (
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {!isArchived && !isViewer && filtered.length > 0 && (
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
          <button className={`btn btn-sm ${outOfTownFilter?"btn-primary":"btn-secondary"}`} title="Show out-of-town households only" onClick={()=>setOutOfTownFilter(f=>!f)}><Icon name="accommodations" context="badge" style={{ marginRight: 4 }} /> Out of Town{outOfTownFilter?<> <Icon name="check" context="badge" /></>:""}</button>
          <button className={`btn btn-sm ${missingAddressFilter?"btn-primary":"btn-secondary"}`} title="Show households missing a mailing address" onClick={()=>setMissingAddressFilter(f=>!f)}><Icon name="mailX" context="badge" style={{ marginRight: 4 }} /> No Address{missingAddressFilter?<> <Icon name="check" context="badge" /></>:""}</button>
          {sections.length > 1 && (
            <button className={`btn btn-sm ${subEventFilter.length>0?"btn-primary":"btn-secondary"}`}
              onClick={()=>setShowMoreFilters(v=>!v)} aria-expanded={showMoreFilters}>
              More Filters{subEventFilter.length>0?` (${subEventFilter.length})`:""} {showMoreFilters ? <Icon name="chevronUp" context="inline" /> : <Icon name="chevronDown" context="inline" />}
            </button>
          )}
        </div>
        {showMoreFilters && sections.length > 1 && (
          <div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center",padding:"10px 12px",background:"var(--bg-subtle)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)"}}>
            <span style={{fontSize:11,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.04em",marginRight:2}}>Sub-Events</span>
            {sections.map(s=>(
              <button key={s.id}
                className={`guest-chip ${subEventFilter.includes(s.id)?"guest-chip-active":""}`}
                onClick={()=>setSubEventFilter(f=>f.includes(s.id)?f.filter(x=>x!==s.id):[...f,s.id])}>
                {s.label}
              </button>
            ))}
            <select className="form-select" style={{width:"auto",padding:"6px 10px",fontSize:12}}
              value={subEventStatusFilter} onChange={e=>setSubEventStatusFilter(e.target.value)}
              disabled={subEventFilter.length===0}
              title={subEventFilter.length===0 ? "Select a sub-event first" : "Filter by RSVP status within selected sub-events"}>
              <option value="All">Any status</option>
              {RSVP_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            {(subEventFilter.length>0 || subEventStatusFilter!=="All") && (
              <button className="btn btn-ghost btn-sm" onClick={()=>{setSubEventFilter([]);setSubEventStatusFilter("All");}}>Clear</button>
            )}
          </div>
        )}
      </div>
    )
  );
}
