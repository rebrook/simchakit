// Moved verbatim from AdminPanel.jsx (V4.44.0 module split) — no behavior changes.
import { Icon }                          from "@/utils/iconMap.jsx";

// ── Data ──
export function DataSection({ isArchived, backupCounts, backupLoading, generateBackup, restoreDone, setRestoreDone, setRestoreFile, setRestoreMsg, restoreConfirm, setRestoreConfirm, restoreMsg, restoreFile, restoring, handleRestore, setShowUnarchive, setUnarchiveMsg, archiveMsg, archiveUnlockCode, setArchiveUnlockCode, archiveUnlockConfirm, setArchiveUnlockConfirm, archiving, handleArchive, setShowReset, setResetConfirm, setResetMsg }) {
  return (
      <>
        {/* Export backup */}
        <div className="admin-section">
          <div className="admin-section-title">Export Full Backup</div>
          <p style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.6,marginBottom:16}}>
            Creates a complete JSON snapshot of all event data. Save it somewhere safe before making large changes or archiving.
          </p>
          <div style={{background:"var(--bg-subtle)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:"14px 16px",marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,fontSize:12,color:"var(--text-muted)"}}>
              {[
                ["Households", "households"],
                ["People",     "people"],
                ["Expenses",   "expenses"],
                ["Vendors",    "vendors"],
                ["Tasks",      "tasks"],
                ["Gifts",      "gifts"],
                ["Favors",     "favors"],
                ["Tables",     "tables"],
              ].map(([label, key]) => (
                <div key={label} style={{textAlign:"center",minWidth:64}}>
                  <div style={{fontSize:20,fontWeight:800,color:"var(--text-primary)",fontFamily:"var(--font-display)"}}>
                    {backupCounts ? (backupCounts[key] ?? 0) : "—"}
                  </div>
                  <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:"0.04em"}}>{label}</div>
                </div>
              ))}
            </div>
            {!backupCounts && <div style={{fontSize:11,color:"var(--text-muted)",marginTop:8,textAlign:"center"}}>Counts loaded when backup is generated</div>}
          </div>
          <button className="btn btn-primary" onClick={generateBackup} disabled={backupLoading}>
            {backupLoading ? "Building backup…" : "↓ Export Backup"}
          </button>
        </div>

        <div className="divider" />

        {/* Restore */}
        <div className="admin-section">
          <div className="admin-section-title">Restore from Backup</div>
          {isArchived ? (
            <div className="alert alert-warning" style={{marginBottom:12}}>This event is archived and cannot be restored to. Unarchive the event first.</div>
          ) : restoreDone ? (
            <div className="alert alert-success" style={{marginBottom:12}}>
              <Icon name="check" context="badge" style={{ marginRight: 4 }} /> Backup restored successfully.
              <button className="btn btn-ghost btn-sm" style={{marginLeft:12}} onClick={() => setRestoreDone(false)}>Restore another</button>
            </div>
          ) : (
            <>
              <p style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.6,marginBottom:12}}>
                Upload a previously exported SimchaKit backup file (.json) to replace all current event data.
              </p>
              <div style={{background:"var(--bg-subtle)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:"12px 14px",marginBottom:14,fontSize:13,lineHeight:1.7}}>
                <strong>What this restores:</strong> guests, people, budget, vendors, tasks, prep, seating, gifts, favors, ceremony roles, and notes.<br/>
                <strong>What is preserved:</strong> event configuration (name, theme, timeline), and archived status.<br/>
                <strong style={{color:"var(--red)"}}>This cannot be undone.</strong> Export a fresh backup first if you want to save your current data.
              </div>
              <div style={{fontSize:12,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:6}}>Step 1 — Select your backup file</div>
              <input type="file" accept=".json" style={{fontSize:13,marginBottom:14,display:"block"}}
                onChange={e => { setRestoreFile(e.target.files[0]||null); setRestoreMsg(""); setRestoreDone(false); }} />
              <div style={{fontSize:12,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:6}}>Step 2 — Type <strong style={{fontFamily:"var(--font-mono)",color:"var(--text-primary)"}}>RESTORE BACKUP</strong> to confirm</div>
              <input className="form-input" style={{marginBottom:14,fontFamily:"var(--font-mono)"}} placeholder="RESTORE BACKUP" value={restoreConfirm} onChange={e => setRestoreConfirm(e.target.value)} />
              {restoreMsg && <div className="alert alert-error" style={{marginBottom:12}}>{restoreMsg}</div>}
              <button className="btn btn-danger" disabled={!restoreFile||restoreConfirm.trim()!=="RESTORE BACKUP"||restoring} onClick={handleRestore}>
                {restoring?"Restoring…":"↑ Restore from Backup"}
              </button>
            </>
          )}
        </div>

        <div className="divider" />

        {/* Archive */}
        <div className="admin-section">
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <div className="admin-section-title" style={{marginBottom:0}}>{isArchived?<><Icon name="lock" context="badge" style={{ marginRight: 4 }} /> Event is Archived</>:"Archive Event"}</div>
            {!isArchived && <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,background:"var(--gold-light)",color:"var(--gold)",whiteSpace:"nowrap"}}>↩ Reversible</span>}
          </div>
          {isArchived ? (
            <>
              <p style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.6,marginBottom:16}}>This event is currently archived and read-only. All data is preserved exactly as it was.</p>
              <button className="btn btn-secondary" onClick={() => { setShowUnarchive(true); setUnarchiveMsg(""); }}>Unarchive Event</button>
            </>
          ) : (
            <>
              <p style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.6,marginBottom:12}}>Archiving makes the event permanently read-only. All data is preserved and remains viewable.</p>
              <p style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.6,marginBottom:16}}>You will set an <strong>unlock code</strong> now — needed to unarchive later. Store it somewhere safe.</p>
              {archiveMsg && <div className="alert alert-error" style={{marginBottom:12}}>{archiveMsg}</div>}
              <div className="form-group">
                <label className="form-label">Archive Unlock Code (min 4 characters)</label>
                <input className="form-input" type="password" value={archiveUnlockCode} onChange={e => setArchiveUnlockCode(e.target.value)} placeholder="Set a code you will remember" />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Unlock Code</label>
                <input className="form-input" type="password" value={archiveUnlockConfirm} onChange={e => setArchiveUnlockConfirm(e.target.value)} placeholder="Repeat the code above" />
                {archiveUnlockCode.length>=4&&archiveUnlockConfirm.length>0&&archiveUnlockCode.trim()!==archiveUnlockConfirm.trim() && <div className="form-hint" style={{color:"var(--red)"}}>Codes do not match.</div>}
              </div>
              <div className="alert alert-warning" style={{marginBottom:16}}><Icon name="alertTriangle" context="badge" style={{ marginRight: 3 }} /> Save this code somewhere safe — it cannot be recovered if lost.</div>
              <button className="btn btn-warning" disabled={archiving||archiveUnlockCode.trim().length<4||archiveUnlockCode.trim()!==archiveUnlockConfirm.trim()} onClick={handleArchive}>
                {archiving?"Archiving…":"Archive This Event"}
              </button>
            </>
          )}
        </div>

        <div className="divider" />

        {/* Reset data */}
        <div className="admin-section">
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <div className="admin-section-title" style={{marginBottom:0}}>Reset Event Data</div>
            <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,background:"var(--red-light)",color:"var(--red)",whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:3}}><Icon name="alertTriangle" context="badge" /> Permanent</span>
          </div>
          <p style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.6,marginBottom:12}}>
            Permanently deletes all planning data: guests, people, expenses, vendors, tasks, prep, seating, gifts, favors, and notes.
          </p>
          <p style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.6,marginBottom:16}}>
            <strong>What is preserved:</strong> your event configuration (name, type, timeline, theme).
          </p>
          <p style={{fontSize:13,color:"var(--red)",fontWeight:600,lineHeight:1.6,marginBottom:16}}><Icon name="alertTriangle" context="badge" style={{ marginRight: 3 }} /> This action cannot be undone.</p>
          <button className="btn btn-danger" disabled={isArchived} onClick={() => { setShowReset(true); setResetConfirm(""); setResetMsg(""); }}>
            Reset Event Data…
          </button>
          {isArchived && <div className="form-hint" style={{marginTop:8}}>Unarchive the event before resetting data.</div>}
        </div>
      </>
  );
}
