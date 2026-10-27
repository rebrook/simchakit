// Moved verbatim from AdminPanel.jsx (V4.44.0 module split) — no behavior changes.
import { DEFAULT_GROUPS, DEFAULT_MEALS } from "@/constants/guest-constants.js";
import { SHIRT_SIZES }                   from "@/constants/theme.js";
import { Icon }                          from "@/utils/iconMap.jsx";
import { useState, useEffect }           from "react";
import { supabase }                      from "@/lib/supabase.js";

// ── RSVP page settings (V5-R4) ──
// events.rsvp_settings, saved on its own (it is a separate column from the rest of the event
// configuration, so it has its own Save). The reply deadline is the existing Event Details date.
// Auto-accept is shown but not available: replies always wait for the host's review.
const RSVP_DEFAULTS = { allowPlusOnes: false, maxNewGuests: 2, allowEditUntilDeadline: true };

function RsvpSettingsBlock({ eventId, deadline, goToSection }) {
  const [vals, setVals]       = useState(RSVP_DEFAULTS);
  const [existing, setExisting] = useState({});
  const [loaded, setLoaded]   = useState(false);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState({ tone: "", text: "" });

  useEffect(() => {
    let cancelled = false;
    supabase.from("events").select("rsvp_settings").eq("id", eventId).maybeSingle().then(({ data, error }) => {
      if (cancelled) return;
      const s = (!error && data?.rsvp_settings && typeof data.rsvp_settings === "object") ? data.rsvp_settings : {};
      setExisting(s);
      setVals({
        allowPlusOnes: s.allowPlusOnes === true,
        maxNewGuests: Number.isInteger(s.maxNewGuests) ? Math.min(Math.max(s.maxNewGuests, 0), 6) : RSVP_DEFAULTS.maxNewGuests,
        allowEditUntilDeadline: s.allowEditUntilDeadline !== false,
      });
      if (error) setMsg({ tone: "error", text: "RSVP settings could not be loaded. If this is a new setup, the V5.1-R1 database update may not have been applied yet." });
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [eventId]);

  const save = async () => {
    setSaving(true); setMsg({ tone: "", text: "" });
    const next = { ...existing, allowPlusOnes: vals.allowPlusOnes, maxNewGuests: vals.maxNewGuests, allowEditUntilDeadline: vals.allowEditUntilDeadline };
    const { error } = await supabase.from("events").update({ rsvp_settings: next }).eq("id", eventId);
    setSaving(false);
    if (error) { setMsg({ tone: "error", text: "Could not save. Only the event owner and editors can change these settings." }); return; }
    setExisting(next);
    setMsg({ tone: "ok", text: "RSVP settings saved." });
  };

  const row = { display: "flex", alignItems: "flex-start", gap: 10, minHeight: 44, fontSize: 14, cursor: "pointer" };
  const help = { fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0 28px", lineHeight: 1.5 };
  const deadlineText = deadline
    ? new Date(`${deadline}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : "not set";

  return (
    <div className="admin-section">
      <div className="admin-section-title">Guest RSVP page</div>
      <p style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.6,marginBottom:12}}>
        Guests reply from a private link, with no account. These settings control what they can do on that page.
        Replies never change your guest list until you accept them in the Guests tab.
      </p>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        <label style={row}>
          <input type="checkbox" checked={vals.allowPlusOnes} disabled={!loaded} style={{marginTop:3}} onChange={e => setVals(v => ({ ...v, allowPlusOnes: e.target.checked }))} />
          <span>Let guests add someone to their reply</span>
        </label>
        <p style={help}>A household can list extra guests who are not on your list yet. These replies are marked Needs a look so you review each one before anyone is added.</p>
        <div className="form-group" style={{margin:"0 0 0 28px",maxWidth:260}}>
          <label className="form-label" htmlFor="rsvp-max-new">How many extra guests</label>
          <select id="rsvp-max-new" className="form-select" value={vals.maxNewGuests} disabled={!loaded || !vals.allowPlusOnes}
            onChange={e => setVals(v => ({ ...v, maxNewGuests: Number(e.target.value) }))}>
            {[0,1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <label style={row}>
          <input type="checkbox" checked={vals.allowEditUntilDeadline} disabled={!loaded} style={{marginTop:3}} onChange={e => setVals(v => ({ ...v, allowEditUntilDeadline: e.target.checked }))} />
          <span>Let guests change their reply until the deadline</span>
        </label>
        <p style={help}>Turn this off to let each household reply only once. They can still ask you to change it.</p>
        <div style={{margin:"4px 0 0 28px",fontSize:14}}>
          <div><strong>Reply deadline:</strong> {deadlineText}</div>
          <p style={{...help, margin:"2px 0 6px"}}>After this date the page closes. It is the same date as in Event Details.</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => goToSection && goToSection("event")}>Change it in Event Details</button>
        </div>
        <div style={{margin:"8px 0 0 28px",padding:"10px 12px",background:"var(--bg-subtle)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",fontSize:13,color:"var(--text-muted)"}}>
          <span aria-hidden="true">○ </span>Accept replies automatically: <strong>not available yet</strong>. Every reply waits for your review.
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",marginTop:12}}>
        <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving || !loaded}>{saving ? "Saving…" : "Save RSVP settings"}</button>
        {msg.text && <span role={msg.tone === "error" ? "alert" : "status"} style={{fontSize:13,color: msg.tone === "error" ? "var(--red)" : "var(--green)"}}>{msg.tone === "error" ? "▲ " : "✓ "}{msg.text}</span>}
      </div>
    </div>
  );
}

// ── Guests ──
export function GuestsSection({ form, set, saved, error, onClose, saveConfig, saving, eventId, goToSection }) {
  return (
      <>
        {saved && <div className="alert alert-success" style={{marginBottom:12}}><Icon name="check" context="badge" style={{ marginRight: 4 }} /> Configuration saved</div>}
        {error && <div className="alert alert-error"   style={{marginBottom:12}}><Icon name="alertTriangle" context="badge" style={{ marginRight: 3 }} /> {error}</div>}

        {/* Guest RSVP page (V5-R4) */}
        {eventId && <RsvpSettingsBlock eventId={eventId} deadline={form.rsvpDeadline} goToSection={goToSection} />}

        <div className="divider" />

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
