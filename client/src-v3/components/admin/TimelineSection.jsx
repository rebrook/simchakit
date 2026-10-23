// Moved verbatim from AdminPanel.jsx (V4.44.0 module split) — no behavior changes.
import { formatEntryMeta } from "@/utils/dates.js";
import { Icon }                          from "@/utils/iconMap.jsx";

// ── Timeline ──
export function TimelineSection({ form, sortedTimeline, hasMainEvent, setTlModal, setTlDelete, saved, error, onClose, saveConfig, saving }) {
  return (
      <>
        {saved && <div className="alert alert-success" style={{marginBottom:12}}><Icon name="check" context="badge" style={{ marginRight: 4 }} /> Configuration saved</div>}
        {error && <div className="alert alert-error"   style={{marginBottom:12}}><Icon name="alertTriangle" context="badge" style={{ marginRight: 3 }} /> {error}</div>}
        {!hasMainEvent && (form.timeline||[]).length > 0 && (
          <div className="alert alert-warning" style={{marginBottom:14}}>
            <Icon name="alertTriangle" context="badge" style={{ marginRight: 3 }} /> No main event set — the countdown won't display until you mark one entry as the main event.
          </div>
        )}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:13,color:"var(--text-muted)"}}>{sortedTimeline.length} event{sortedTimeline.length!==1?"s":""} · sorted by date and time</div>
          <button className="btn btn-primary" onClick={() => setTlModal("add")}>+ Add Event</button>
        </div>
        {sortedTimeline.length === 0 ? (
          <div style={{textAlign:"center",padding:"32px 16px",color:"var(--text-muted)",background:"var(--bg-subtle)",borderRadius:"var(--radius-md)",border:"1px solid var(--border)"}}>
            <div style={{fontSize:28,marginBottom:8}}><Icon name="calendar" context="empty" /></div>
            <div style={{fontSize:14,marginBottom:4}}>No timeline entries yet.</div>
            <div style={{fontSize:13}}>Add your event schedule to display it on the Overview.</div>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {sortedTimeline.map(entry => (
              <div key={entry.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",borderLeft:entry.isMainEvent?"4px solid var(--accent-primary)":"4px solid var(--border)"}}>
                <div style={{fontSize:20,flexShrink:0}}>{entry.icon||"📅"}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <span style={{fontWeight:600,fontSize:14,color:"var(--text-primary)"}}>{entry.title}</span>
                    {entry.isMainEvent && <span className="tag tag-accent" style={{fontSize:11}}><Icon name="star" context="badge" style={{ marginRight: 3 }} /> Main Event</span>}
                    {entry.inviteAllByDefault === false && <span className="tag tag-muted" style={{fontSize:11}}>Opt-in only</span>}
                    {entry.startDate && !entry.startTime && <span className="tag tag-gold" style={{fontSize:11}}><Icon name="alertTriangle" context="badge" style={{ marginRight: 3 }} /> No time set</span>}
                    {entry.startDate && entry.startTime && !entry.endTime && <span className="tag tag-gold" style={{fontSize:11}}><Icon name="alertTriangle" context="badge" style={{ marginRight: 3 }} /> No end time (defaults to 1 hr)</span>}
                  </div>
                  <div style={{fontSize:12,color:"var(--text-muted)",marginTop:2}}>{formatEntryMeta(entry)}</div>
                </div>
                <div style={{display:"flex",gap:4,flexShrink:0}}>
                  <button className="icon-btn" title="Edit" aria-label="Edit" onClick={() => setTlModal(entry)}><Icon name="pencil" context="badge" /></button>
                  <button className="icon-btn" title="Delete" aria-label="Delete" onClick={() => setTlDelete(entry)}><Icon name="trash2" context="button" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="modal-footer" style={{marginTop:20}}>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={saveConfig} disabled={saving}>{saving?"Saving…":"Save Configuration"}</button>
        </div>
      </>
  );
}
