// Moved verbatim from AdminPanel.jsx (V4.44.0 module split) — no behavior changes.
import { Icon }                          from "@/utils/iconMap.jsx";

// ── Tabs ──
export function TabsSection({ form, set, saved, onClose, saveConfig, saving }) {
  return (
      <>
        {saved && <div className="alert alert-success" style={{marginBottom:12}}><Icon name="check" context="badge" style={{ marginRight: 4 }} /> Tab visibility saved</div>}
        <div className="admin-section">
          <div className="admin-section-title">Visible Tabs</div>
          <p style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.6,marginBottom:16}}>
            Choose which tabs appear in the navigation. Hidden tabs are not deleted — you can restore them at any time. Overview is always visible.
          </p>
          {[
            {id:"guests",         icon:"guests",label:"Guests"},
            {id:"accommodations", icon:"accommodations",label:"Stay & Travel"},
            {id:"budget",         icon:"budget",label:"Budget"},
            {id:"vendors",        icon:"vendors",label:"Vendors"},
            {id:"tasks",          icon:"tasks",label:"Tasks"},
            {id:"prep",           icon:"prep",label:"Prep"},
            {id:"ceremony",       icon:"ceremony",label:"Ceremony"},
            {id:"seating",        icon:"seating",label:"Seating"},
            {id:"gifts",          icon:"gifts",label:"Gifts"},
            {id:"favors",         icon:"favors",label:"Favors"},
            {id:"calendar",       icon:"calendar",label:"Calendar"},
          ].map(tab => {
            const visibleTabs = form.visibleTabs||[];
            const isVisible   = visibleTabs.length===0 || visibleTabs.includes(tab.id);
            return (
              <div key={tab.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
                <input type="checkbox" id={`tab-vis-${tab.id}`} checked={isVisible}
                  onChange={e => {
                    const current = form.visibleTabs&&form.visibleTabs.length>0 ? [...form.visibleTabs] : ["guests","accommodations","budget","vendors","tasks","prep","ceremony","seating","gifts","favors","calendar"];
                    set("visibleTabs", e.target.checked ? [...current,tab.id] : current.filter(id=>id!==tab.id));
                  }}
                  style={{width:16,height:16,cursor:"pointer",accentColor:"var(--accent-primary)"}} />
                <label htmlFor={`tab-vis-${tab.id}`} style={{fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",gap:6,flex:1}}>
                  <span><Icon name={tab.icon} context="inline" /></span><span>{tab.label}</span>
                </label>
              </div>
            );
          })}
          <button className="btn btn-ghost btn-sm" style={{marginTop:14,color:"var(--text-muted)"}}
            onClick={() => set("visibleTabs",[])}>Show all tabs</button>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={saveConfig} disabled={saving}>{saving?"Saving…":"Save Configuration"}</button>
        </div>
      </>
  );
}
