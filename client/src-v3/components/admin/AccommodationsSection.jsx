// Moved verbatim from AdminPanel.jsx (V4.44.0 module split) — no behavior changes.
import { Icon }                          from "@/utils/iconMap.jsx";

// ── Accommodations ──
export function AccommodationsSection({ form, set, saved, error, onClose, saveConfig, saving }) {
  return (
      <>
        {saved && <div className="alert alert-success" style={{marginBottom:12}}><Icon name="check" context="badge" style={{ marginRight: 4 }} /> Configuration saved</div>}
        {error && <div className="alert alert-error"   style={{marginBottom:12}}><Icon name="alertTriangle" context="badge" style={{ marginRight: 3 }} /> {error}</div>}
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {(form.hotelBlocks||[]).map((block,idx) => (
            <div key={block.id} style={{border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:"16px 20px",background:"var(--bg-subtle)"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                <div style={{fontSize:13,fontWeight:700,color:"var(--text-primary)"}}>Hotel Block {idx+1}</div>
                {form.hotelBlocks.length>1 && (
                  <button className="btn btn-ghost btn-sm" style={{fontSize:12,color:"var(--red)"}}
                    onClick={() => set("hotelBlocks",form.hotelBlocks.filter((_,i)=>i!==idx))}>Remove</button>
                )}
              </div>
              {[
                {key:"name",        label:"Hotel Name",               placeholder:"e.g., Marriott Owings Mills Metro Centre"},
                {key:"groupCode",   label:"Room Block / Group Code",  placeholder:"e.g., Smith Family Room Block", hint:"Guests reference this code when booking"},
                {key:"phone",       label:"Hotel Phone",              placeholder:"e.g., (410) 555-1234"},
                {key:"website",     label:"Hotel Website",            placeholder:"https://…"},
              ].map(f => (
                <div key={f.key} className="form-group">
                  <label className="form-label">{f.label}</label>
                  <input className="form-input" value={block[f.key]||""} placeholder={f.placeholder}
                    onChange={e => set("hotelBlocks", form.hotelBlocks.map((b,i) => i===idx ? {...b,[f.key]:e.target.value} : b))} />
                  {f.hint && <div className="form-hint">{f.hint}</div>}
                </div>
              ))}
              <div className="form-group">
                <label className="form-label">Room Block Cut-off Date</label>
                <input className="form-input" type="date" value={block.cutoffDate||""}
                  onChange={e => set("hotelBlocks", form.hotelBlocks.map((b,i) => i===idx ? {...b,cutoffDate:e.target.value} : b))} />
                <div className="form-hint">A warning will appear when this date is within 60 days</div>
              </div>
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:"var(--text-primary)",marginTop:4}}>
                <input type="checkbox" checked={block.shareWithGuests===true} style={{width:15,height:15,accentColor:"var(--accent-primary)"}}
                  onChange={e => set("hotelBlocks", form.hotelBlocks.map((b,i) => i===idx ? {...b,shareWithGuests:e.target.checked} : b))} />
                Share with guests
              </label>
              <div className="form-hint">Shows this hotel's name, group code, phone, website and cut-off date in Where to stay on your guests' Event details page. Off by default.</div>
            </div>
          ))}
        </div>
        <button className="btn btn-secondary btn-sm" style={{marginTop:12}}
          onClick={() => set("hotelBlocks",[...(form.hotelBlocks||[]),{id:"hb_"+Date.now(),name:"",groupCode:"",cutoffDate:"",phone:"",website:""}])}>
          + Add Hotel Block
        </button>
        <div className="modal-footer" style={{marginTop:20}}>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={saveConfig} disabled={saving}>{saving?"Saving…":"Save Configuration"}</button>
        </div>
      </>
  );
}
