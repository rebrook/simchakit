// Moved verbatim from AdminPanel.jsx (V4.44.0 module split) — no behavior changes.
import { Icon }                          from "@/utils/iconMap.jsx";
import { PALETTES }            from "@/constants/theme.js";
import { deriveCustomPalette } from "@/utils/color.js";

// ── Theme ──
export function ThemeSection({ form, setForm, setThm, saved, error, onClose, saveConfig, saving }) {
  return (
      <>
        {saved && <div className="alert alert-success" style={{marginBottom:12}}><Icon name="check" context="badge" style={{ marginRight: 4 }} /> Configuration saved</div>}
        {error && <div className="alert alert-error"   style={{marginBottom:12}}><Icon name="alertTriangle" context="badge" style={{ marginRight: 3 }} /> {error}</div>}
        <div className="form-group">
          <label className="form-label">Theme Name</label>
          <input className="form-input" value={form.theme?.name||""} onChange={e => setThm("name",e.target.value)} placeholder="e.g., Sydney's Sweet Shop" />
          <div className="form-hint">Displayed in the app header below the event name</div>
        </div>
        <div className="form-group">
          <label className="form-label">Theme Icon</label>
          <input className="form-input" value={form.theme?.icon||""} onChange={e => setThm("icon",e.target.value)} placeholder="🍭" style={{maxWidth:120}} />
          <div className="form-hint">Single emoji shown next to the theme name</div>
        </div>
        <div className="form-group">
          <label className="form-label">Color Scheme</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:6}}>
            {Object.entries(PALETTES).map(([key,p]) => (
              <button key={key} onClick={() => setForm(f => ({...f,theme:{...f.theme,palette:key}}))} style={{
                display:"flex",alignItems:"center",gap:8,padding:"8px 12px",
                borderRadius:"var(--radius-md)",cursor:"pointer",
                border:(form.theme?.palette||"rose")===key?`2px solid ${p.accent}`:"2px solid var(--border)",
                background:(form.theme?.palette||"rose")===key?p["accent-light"]:"var(--bg-surface)",
                transition:"all 0.15s",
              }}>
                <div style={{width:20,height:20,borderRadius:4,background:p.accent,flexShrink:0}} />
                <span style={{fontSize:13,fontWeight:(form.theme?.palette||"rose")===key?700:400,color:"var(--text-primary)"}}>{p.name}</span>
              </button>
            ))}
            <button onClick={() => setForm(f => ({...f,theme:{...f.theme,palette:"custom",customColor:f.theme?.customColor||"#c4637a"}}))} style={{
              display:"flex",alignItems:"center",gap:8,padding:"8px 12px",
              borderRadius:"var(--radius-md)",cursor:"pointer",
              border:(form.theme?.palette||"rose")==="custom"?"2px solid var(--accent-primary)":"2px solid var(--border)",
              background:(form.theme?.palette||"rose")==="custom"?"var(--accent-light)":"var(--bg-surface)",
              transition:"all 0.15s",
            }}>
              <div style={{width:20,height:20,borderRadius:4,flexShrink:0,background:(form.theme?.palette||"rose")==="custom"&&form.theme?.customColor?form.theme.customColor:"conic-gradient(red,yellow,lime,cyan,blue,magenta,red)"}} />
              <span style={{fontSize:13,fontWeight:(form.theme?.palette||"rose")==="custom"?700:400,color:"var(--text-primary)"}}>Custom</span>
            </button>
          </div>
          {(form.theme?.palette||"rose")==="custom" && (() => {
            const hex = form.theme?.customColor||"#c4637a";
            const derived = deriveCustomPalette(hex);
            return (
              <div style={{marginTop:14,padding:"14px 16px",background:"var(--bg-subtle)",borderRadius:"var(--radius-md)",border:"1px solid var(--border)"}}>
                <div style={{fontSize:12,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:10}}>Custom Accent Color</div>
                <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                  <input type="color" value={hex} onChange={e => setThm("customColor",e.target.value)}
                    style={{width:44,height:36,border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",cursor:"pointer",padding:2,background:"none"}} />
                  <input className="form-input" value={hex} maxLength={7}
                    onChange={e => { const v=e.target.value; if(/^#[0-9a-fA-F]{0,6}$/.test(v)) setThm("customColor",v); }}
                    style={{width:110,fontFamily:"var(--font-mono,monospace)",fontSize:13}} placeholder="#c4637a" />
                  <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                    {[["Light",derived.light],["Dark",derived.dark]].map(([mode,d]) => (
                      <div key={mode} style={{display:"flex",flexDirection:"column",gap:3,alignItems:"center"}}>
                        <div style={{display:"flex",gap:3}}>
                          {[d.accent,d["accent-medium"],d["accent-light"]].map((c,i) => (
                            <div key={i} style={{width:22,height:22,borderRadius:4,background:c,border:"1px solid var(--border)"}} />
                          ))}
                          <div style={{width:22,height:22,borderRadius:4,background:d.accent,border:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                            <span style={{fontSize:11,color:d["accent-text"],fontWeight:700,lineHeight:1}}>A</span>
                          </div>
                        </div>
                        <div style={{fontSize:10,color:"var(--text-muted)"}}>{mode}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
        {/* Live preview */}
        {(() => {
          const pal = form.theme?.palette||"rose";
          const p = pal==="custom"
            ? (() => { const d=deriveCustomPalette(form.theme?.customColor||"#c4637a"); return {accent:d.light.accent,"accent-light":d.light["accent-light"],"accent-medium":d.light["accent-medium"],"accent-text":d.light["accent-text"],"header-bg":d.light.accent}; })()
            : (PALETTES[pal]||PALETTES.rose);
          return (
            <div style={{marginTop:20}}>
              <div style={{fontSize:12,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:10}}>Preview</div>
              <div style={{border:"1px solid var(--border)",borderRadius:"var(--radius-md)",overflow:"hidden",fontSize:13}}>
                <div style={{background:`linear-gradient(135deg,${p["header-bg"]},${p.accent})`,padding:"12px 16px",display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:18}}>{form.theme?.icon||(form.type?"✡":"✦")}</span>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,color:p["accent-text"],lineHeight:1.2}}>{form.name||"SimchaKit"}</div>
                    {form.theme?.name && <div style={{fontSize:11,color:p["accent-text"],opacity:0.8,marginTop:1}}>{form.theme.name}</div>}
                  </div>
                </div>
                <div style={{padding:"14px 16px",background:"#fff",display:"flex",flexDirection:"column",gap:12}}>
                  <button style={{background:p.accent,color:p["accent-text"],border:"none",borderRadius:"var(--radius-sm)",padding:"7px 16px",fontSize:13,fontWeight:600,cursor:"default",fontFamily:"var(--font-body)"}}>+ Add Household</button>
                  <div style={{background:p["accent-light"],border:`1px solid ${p["accent-medium"]}`,borderRadius:"var(--radius-sm)",padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em",color:"#888",marginBottom:2}}>Guests Invited</div>
                      <div style={{fontSize:22,fontWeight:800,color:p.accent,fontFamily:"var(--font-display,serif)"}}>168</div>
                    </div>
                    <div style={{fontSize:11,color:"#888"}}>households ›</div>
                  </div>
                  <div style={{fontSize:11,color:"var(--text-muted)",textAlign:"center"}}>Preview updates as you select a palette · Changes apply when you save</div>
                </div>
              </div>
            </div>
          );
        })()}
        <div className="modal-footer" style={{marginTop:20}}>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={saveConfig} disabled={saving}>{saving?"Saving…":"Save Configuration"}</button>
        </div>
      </>
  );
}
