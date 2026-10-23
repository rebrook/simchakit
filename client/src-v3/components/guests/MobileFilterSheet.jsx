// Moved verbatim from GuestsTab.jsx (V4.45.1 module split) — no behavior changes.
import { RSVP_STATUSES } from "@/constants/guest-constants.js";
import { Modal } from "@/components/shared/Modal.jsx";
import { Icon } from "@/utils/iconMap.jsx";

export function MobileFilterSheet({ sections, subEventFilter, setSubEventFilter, subEventStatusFilter, setSubEventStatusFilter, setMobileMoreFiltersOpen }) {
  return (
    <Modal onClose={()=>setMobileMoreFiltersOpen(false)} ariaLabel="Sub-Event Filters" unstyled
      style={{position:"fixed",left:0,right:0,bottom:0,background:"var(--bg-surface)",borderRadius:"var(--radius-lg) var(--radius-lg) 0 0",width:"100%",maxHeight:"75vh",overflowY:"auto",padding:"16px 18px 20px",boxShadow:"var(--shadow-lg)",animation:"slide-up 0.2s ease"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontSize:16,fontWeight:700,color:"var(--text-primary)"}}>Sub-Event Filters</div>
        <button className="icon-btn" title="Close" aria-label="Close" onClick={()=>setMobileMoreFiltersOpen(false)}><Icon name="x" context="button" /></button>
      </div>
      <div style={{fontSize:11,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:6}}>Sub-Events</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
        {sections.map(s=>(
          <button key={s.id} className={`guest-chip ${subEventFilter.includes(s.id)?"guest-chip-active":""}`}
            onClick={()=>setSubEventFilter(f=>f.includes(s.id)?f.filter(x=>x!==s.id):[...f,s.id])}>
            {s.label}
          </button>
        ))}
      </div>
      <div style={{fontSize:11,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:6}}>Status</div>
      <select className="form-select" style={{width:"100%",padding:"10px 12px",fontSize:15,marginBottom:16}}
        value={subEventStatusFilter} onChange={e=>setSubEventStatusFilter(e.target.value)}
        disabled={subEventFilter.length===0}>
        <option value="All">Any status</option>
        {RSVP_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
      </select>
      <div style={{display:"flex",gap:8}}>
        <button className="btn btn-secondary" style={{flex:1}} onClick={()=>{setSubEventFilter([]);setSubEventStatusFilter("All");}}>Clear</button>
        <button className="btn btn-primary" style={{flex:1}} onClick={()=>setMobileMoreFiltersOpen(false)}>Apply</button>
      </div>
    </Modal>
  );
}
