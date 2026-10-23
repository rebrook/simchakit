// Moved verbatim from AdminPanel.jsx (V4.44.0 module split) — no behavior changes.
import { DEFAULT_GROUPS, DEFAULT_MEALS } from "@/constants/guest-constants.js";
import { SHIRT_SIZES }                   from "@/constants/theme.js";
import { Icon }                          from "@/utils/iconMap.jsx";

// ── Guests ──
export function GuestsSection({ form, set, saved, error, onClose, saveConfig, saving }) {
  return (
      <>
        {saved && <div className="alert alert-success" style={{marginBottom:12}}><Icon name="check" context="badge" style={{ marginRight: 4 }} /> Configuration saved</div>}
        {error && <div className="alert alert-error"   style={{marginBottom:12}}><Icon name="alertTriangle" context="badge" style={{ marginRight: 3 }} /> {error}</div>}

        {/* Guest Groups */}
        <div className="admin-section">
          <div className="admin-section-title">Guest Groups</div>
          <p style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.6,marginBottom:12}}>
            Groups appear as filter options in the Guests tab and as dropdown choices when adding or editing households.
            Drag to reorder — order here matches the order in the Guests tab filter.
          </p>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
            {(form.groups||[]).map((g,i) => (
              <div key={i} style={{display:"flex",gap:8,alignItems:"center"}}>
                <input className="form-input" style={{flex:1}} value={g}
                  onChange={e => { const u=[...(form.groups||[])]; u[i]=e.target.value; set("groups",u); }}
                  placeholder="Group name" />
                <button className="btn btn-ghost btn-sm" style={{padding:"4px 8px"}} disabled={(form.groups||[]).length<=1}
                  onClick={() => set("groups",(form.groups||[]).filter((_,j)=>j!==i))}><Icon name="trash2" context="button" /></button>
                <button className="btn btn-ghost btn-sm" style={{padding:"4px 8px"}} disabled={i===0}
                  onClick={() => { const u=[...(form.groups||[])]; [u[i-1],u[i]]=[u[i],u[i-1]]; set("groups",u); }}>↑</button>
                <button className="btn btn-ghost btn-sm" style={{padding:"4px 8px"}} disabled={i===(form.groups||[]).length-1}
                  onClick={() => { const u=[...(form.groups||[])]; [u[i],u[i+1]]=[u[i+1],u[i]]; set("groups",u); }}>↓</button>
              </div>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => set("groups",[...(form.groups||[]),""])}>+ Add Group</button>
          <button className="btn btn-ghost btn-sm" style={{marginLeft:8,color:"var(--text-muted)",opacity:0.7}} onClick={() => set("groups",DEFAULT_GROUPS)}>Reset to defaults</button>
        </div>

        <div className="divider" />

        {/* Meal Choices */}
        <div className="admin-section">
          <div className="admin-section-title">Meal Choices</div>
          <p style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.6,marginBottom:12}}>
            Meal choices appear in the household meal selection dropdown and in the Catering Summary.
            Set these before entering guest data so selections are consistent.
          </p>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
            {(form.mealChoices||[]).map((m,i) => (
              <div key={i} style={{display:"flex",gap:8,alignItems:"center"}}>
                <input className="form-input" style={{flex:1}} value={m}
                  onChange={e => { const u=[...(form.mealChoices||[])]; u[i]=e.target.value; set("mealChoices",u); }}
                  placeholder="Meal option" />
                <button className="btn btn-ghost btn-sm" style={{padding:"4px 8px"}} disabled={(form.mealChoices||[]).length<=1}
                  onClick={() => set("mealChoices",(form.mealChoices||[]).filter((_,j)=>j!==i))}><Icon name="trash2" context="button" /></button>
                <button className="btn btn-ghost btn-sm" style={{padding:"4px 8px"}} disabled={i===0}
                  onClick={() => { const u=[...(form.mealChoices||[])]; [u[i-1],u[i]]=[u[i],u[i-1]]; set("mealChoices",u); }}>↑</button>
                <button className="btn btn-ghost btn-sm" style={{padding:"4px 8px"}} disabled={i===(form.mealChoices||[]).length-1}
                  onClick={() => { const u=[...(form.mealChoices||[])]; [u[i],u[i+1]]=[u[i+1],u[i]]; set("mealChoices",u); }}>↓</button>
              </div>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => set("mealChoices",[...(form.mealChoices||[]),""])}>+ Add Meal Choice</button>
          <button className="btn btn-ghost btn-sm" style={{marginLeft:8,color:"var(--text-muted)",opacity:0.7}} onClick={() => set("mealChoices",DEFAULT_MEALS)}>Reset to defaults</button>
          <div className="form-group" style={{marginTop:14}}>
            <label className="form-label">Kosher Meal Label</label>
            <input className="form-input" value={form.kosherMealLabel||""} onChange={e => set("kosherMealLabel",e.target.value)} placeholder="Kosher" />
            <div className="form-hint">Must exactly match one of the Meal Choice entries above. Selecting that option in a guest's Meal Choice will automatically check Kosher meal required, and vice versa. Leave blank to match any meal choice containing the word "kosher".</div>
          </div>
        </div>

        <div className="divider" />

        {/* Shirt Sizes */}
        <div className="admin-section">
          <div className="admin-section-title">Sizes (shirt &amp; pant)</div>
          <p style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.6,marginBottom:4}}>
            Drives the shirt/pant size dropdowns and the Favors tab. Format: <code style={{fontSize:12,background:"var(--bg-subtle)",padding:"1px 5px",borderRadius:3}}>CODE | Label</code> (e.g. <code style={{fontSize:12,background:"var(--bg-subtle)",padding:"1px 5px",borderRadius:3}}>AS | Adult Small</code>).
          </p>
          <div className="form-hint" style={{marginBottom:12}}>The code (before |) appears in the Favors size summary.</div>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
            {(form.shirtSizes||[]).map((s,i) => (
              <div key={i} style={{display:"flex",gap:8,alignItems:"center"}}>
                <input className="form-input" style={{flex:1}} value={s}
                  onChange={e => { const u=[...(form.shirtSizes||[])]; u[i]=e.target.value; set("shirtSizes",u); }}
                  placeholder="e.g. AM | Adult Medium" />
                <button className="btn btn-ghost btn-sm" style={{padding:"4px 8px"}} disabled={(form.shirtSizes||[]).length<=1}
                  onClick={() => set("shirtSizes",(form.shirtSizes||[]).filter((_,j)=>j!==i))}><Icon name="trash2" context="button" /></button>
                <button className="btn btn-ghost btn-sm" style={{padding:"4px 8px"}} disabled={i===0}
                  onClick={() => { const u=[...(form.shirtSizes||[])]; [u[i-1],u[i]]=[u[i],u[i-1]]; set("shirtSizes",u); }}>↑</button>
                <button className="btn btn-ghost btn-sm" style={{padding:"4px 8px"}} disabled={i===(form.shirtSizes||[]).length-1}
                  onClick={() => { const u=[...(form.shirtSizes||[])]; [u[i],u[i+1]]=[u[i+1],u[i]]; set("shirtSizes",u); }}>↓</button>
              </div>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => set("shirtSizes",[...(form.shirtSizes||[]),""])}>+ Add Size</button>
          <button className="btn btn-ghost btn-sm" style={{marginLeft:8,color:"var(--text-muted)",opacity:0.7}} onClick={() => set("shirtSizes",SHIRT_SIZES.filter(s=>s))}>Reset to defaults</button>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={saveConfig} disabled={saving}>{saving?"Saving…":"Save Configuration"}</button>
        </div>
      </>
  );
}
