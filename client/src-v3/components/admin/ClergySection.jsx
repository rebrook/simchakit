// Moved verbatim from AdminPanel.jsx (V4.44.0 module split) — no behavior changes.
import { useState } from "react";
import { formatPhone } from "@/utils/guests.js";
import { Icon }                          from "@/utils/iconMap.jsx";

// ── Clergy & Tutor ──
export function ClergySection({ form, setCon, isMitzvah, saved, error, onClose, saveConfig, saving }) {
  return (
      <>
        {saved && <div className="alert alert-success" style={{marginBottom:12}}><Icon name="check" context="badge" style={{ marginRight: 4 }} /> Clergy and Tutor saved</div>}
        {error && <div className="alert alert-error"   style={{marginBottom:12}}><Icon name="alertTriangle" context="badge" style={{ marginRight: 3 }} /> {error}</div>}
        <ContactBlock label="Rabbi"  icon="✡"  value={form.rabbi ||{}} onChange={(k,v)=>setCon("rabbi",k,v)}  alwaysShow={true} />
        <ContactBlock label="Cantor" icon="🎼" value={form.cantor||{}} onChange={(k,v)=>setCon("cantor",k,v)} alwaysShow={false} show={isMitzvah} />
        <ContactBlock label="Tutor / Madrikh·a" icon="📖" value={form.tutor||{}} onChange={(k,v)=>setCon("tutor",k,v)} alwaysShow={false} show={isMitzvah} />
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={saveConfig} disabled={saving}>{saving?"Saving…":"Save Configuration"}</button>
        </div>
      </>
  );
}

// ── ContactBlock ──────────────────────────────────────────────────────────────
function ContactBlock({ label, icon, value, onChange, alwaysShow, show }) {
  const [forceShow, setForceShow] = useState(!!(value.name||value.phone||value.email||value.notes));
  const visible = alwaysShow || show || forceShow;
  if (!visible) {
    return (
      <div style={{marginBottom:20,padding:"12px 16px",background:"var(--bg-subtle)",borderRadius:"var(--radius-md)",border:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:13,color:"var(--text-muted)"}}>{icon} {label} — not applicable for this event type</span>
        <button className="btn btn-ghost btn-sm" onClick={()=>setForceShow(true)} style={{fontSize:12}}>+ Add anyway</button>
      </div>
    );
  }
  return (
    <div style={{marginBottom:24,background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:"16px"}}>
      <div style={{fontSize:13,fontWeight:700,color:"var(--text-primary)",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
        <span>{icon}</span> {label}
        {!alwaysShow&&forceShow && (
          <button className="btn btn-ghost btn-sm" style={{fontSize:11,marginLeft:"auto"}}
            onClick={()=>{setForceShow(false);onChange("name","");onChange("phone","");onChange("email","");onChange("notes","");}}>
            Remove
          </button>
        )}
      </div>
      <div className="form-grid-2">
        <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={value.name||""} onChange={e=>onChange("name",e.target.value)} placeholder={`${label} name`} /></div>
        <div className="form-group"><label className="form-label">Phone</label><input className="form-input" type="tel" value={value.phone||""} onChange={e=>onChange("phone",e.target.value)} onBlur={e=>onChange("phone",formatPhone(e.target.value))} placeholder="(000) 000-0000" /></div>
      </div>
      <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={value.email||""} onChange={e=>onChange("email",e.target.value)} placeholder="email@example.com" /></div>
      <div className="form-group" style={{marginBottom:0}}><label className="form-label">Notes</label><textarea className="form-textarea" rows={2} value={value.notes||""} onChange={e=>onChange("notes",e.target.value)} placeholder="Availability, meeting schedule, special notes…" /></div>
    </div>
  );
}
