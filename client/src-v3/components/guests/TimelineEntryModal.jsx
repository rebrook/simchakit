// Moved verbatim from GuestsTab.jsx (V4.45.0 module split) — no behavior changes.
import { useState } from "react";
import { TL_HOURS, TL_MINUTES } from "@/constants/ui.js";
import { parseTimeParts, buildTime } from "@/utils/dates.js";
import { newTimelineId } from "@/utils/ids.js";
import { Modal } from "@/components/shared/Modal.jsx";
import { Icon } from "@/utils/iconMap.jsx";

export function TimelineEntryModal({ entry, onSave, onClose }) {
  const isEdit = !!entry;
  const initParts = (timeStr) => parseTimeParts(timeStr);
  const [form, setForm] = useState(entry
    ? { ...entry, inviteAllByDefault: entry.inviteAllByDefault !== false }
    : { id: newTimelineId(), icon: "", title: "", startDate: "", startTime: "", endDate: "", endTime: "", venue: "", notes: "", isMainEvent: false, servesMeal: false, inviteAllByDefault: true });
  const setF = (k,v) => setForm(f=>({...f,[k]:v}));
  const sp0 = initParts(form.startTime); const ep0 = initParts(form.endTime);
  const [sH,setSH]=useState(sp0.h);const [sM,setSM]=useState(sp0.m);const [sAP,setSAP]=useState(sp0.ap);
  const [eH,setEH]=useState(ep0.h);const [eM,setEM]=useState(ep0.m);const [eAP,setEAP]=useState(ep0.ap);
  const onStartPart=(h,m,ap)=>{const t=buildTime(h,m,ap);if(t)setF("startTime",t);};
  const onEndPart=(h,m,ap)=>{const t=buildTime(h,m,ap);if(t)setF("endTime",t);};
  const selStyle={flex:1,minWidth:0};
  return (
    <Modal onClose={onClose} title={isEdit ? "Edit Timeline Event" : "Add Timeline Event"} maxWidth={480}>
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
            <div className="form-group"><label className="form-label">End Date</label><input className="form-input" type="date" value={form.endDate||""} onChange={e=>setF("endDate",e.target.value)} /><div className="form-hint">Leave blank if same day as start</div></div>
            <div className="form-group"><label className="form-label">End Time</label><div style={{display:"flex",gap:4}}><select className="form-select" style={selStyle} value={eH} onChange={e=>{setEH(e.target.value);onEndPart(e.target.value,eM,eAP);}}><option value="">HH</option>{TL_HOURS.map(h=><option key={h} value={h}>{h}</option>)}</select><select className="form-select" style={selStyle} value={eM} onChange={e=>{setEM(e.target.value);onEndPart(eH,e.target.value,eAP);}}><option value="">MM</option>{TL_MINUTES.map(m=><option key={m} value={m}>{m}</option>)}</select><select className="form-select" style={selStyle} value={eAP} onChange={e=>{setEAP(e.target.value);onEndPart(eH,eM,e.target.value);}}><option value="">—</option><option value="AM">AM</option><option value="PM">PM</option></select></div></div>
          </div>
          <div className="form-group"><label className="form-label">Venue / Location</label><input className="form-input" value={form.venue||""} onChange={e=>setF("venue",e.target.value)} placeholder="e.g., Springfield Grand Ballroom" /></div>
          <div className="form-group"><label className="form-label">Notes</label><input className="form-input" value={form.notes||""} onChange={e=>setF("notes",e.target.value)} placeholder="Any additional details…" /></div>
          <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:"var(--text-primary)",marginBottom:10}}>
            <input type="checkbox" checked={!!form.isMainEvent} onChange={e=>setF("isMainEvent",e.target.checked)} style={{width:15,height:15,accentColor:"var(--accent-primary)"}} />
            Count down to this event (sets date and venue for the countdown clock)
          </label>
          <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:"var(--text-primary)",marginBottom:10}}>
            <input type="checkbox" checked={!!form.servesMeal} onChange={e=>setF("servesMeal",e.target.checked)} style={{width:15,height:15,accentColor:"var(--accent-primary)"}} />
            Meal served at this sub-event
          </label>
          <div className="form-hint" style={{marginBottom:10}}>
            Flag every sub-event where a meal is served (e.g. Friday night dinner, Sunday brunch, the reception). The Catering Summary on the Guests tab builds a separate confirmed/kosher/meal-choice breakout for each one flagged here.
          </div>
          <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:"var(--text-primary)",marginBottom:4}}>
            <input type="checkbox" checked={form.inviteAllByDefault !== false} onChange={e=>setF("inviteAllByDefault",e.target.checked)} style={{width:15,height:15,accentColor:"var(--accent-primary)"}} />
            Invite all households by default
          </label>
          <div className="form-hint" style={{marginBottom:16}}>
            {form.inviteAllByDefault !== false
              ? "Every household is invited to this sub-event automatically. Uncheck this for a sub-event only a handful of households attend (e.g. a small rehearsal), so you only need to check the ones who are invited, not uncheck everyone else."
              : "Households must be explicitly invited to this sub-event, one at a time, on their guest record."}
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={()=>{if(!form.title.trim()||!form.startDate)return;const endDate=(!form.endDate&&form.endTime)?form.startDate:form.endDate;onSave({...form,endDate,title:form.title.trim()});}} disabled={!form.title.trim()||!form.startDate}>{isEdit?"Save Changes":"Add Event"}</button>
          </div>
        </div>
    </Modal>
  );
}
