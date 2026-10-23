// Moved verbatim from AdminPanel.jsx (V4.44.0 module split) — no behavior changes.
import { Icon }  from "@/utils/iconMap.jsx";
import { Modal } from "@/components/shared/Modal.jsx";

// ── BackupModal ──
export function BackupModal({ backupData, backupCopied, setBackupModal, setBackupCopied, eventId }) {
  return (
    <Modal
      onClose={() => { setBackupModal(false); setBackupCopied(false); }}
      ariaLabel="Export Full Backup"
      className="modal-lg"
      maxWidth={600}
    >
      <div className="modal-header"><div className="modal-title"><Icon name="download" context="inline" style={{ marginRight: 4 }} /> Export Full Backup</div><button className="icon-btn" title="Close" aria-label="Close" onClick={()=>{setBackupModal(false);setBackupCopied(false);}}><Icon name="x" context="button" /></button></div>
      <div className="modal-body">
        <p style={{fontSize:13,color:"var(--text-secondary)",marginBottom:12,lineHeight:1.6}}>Copy the JSON below and save it to a file as a complete snapshot of your event data.</p>
        <textarea readOnly value={backupData||""} onClick={e=>e.target.select()} style={{width:"100%",minHeight:220,fontFamily:"var(--font-mono,monospace)",fontSize:11,background:"var(--bg-subtle)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",padding:"10px 12px",color:"var(--text-secondary)",resize:"vertical",outline:"none"}} />
        <div className="modal-footer" style={{marginTop:12}}>
          <button className="btn btn-ghost" onClick={()=>{setBackupModal(false);setBackupCopied(false);}}>Close</button>
          <button className="btn btn-secondary" onClick={() => {
            const blob = new Blob([backupData||""], { type: "application/json" });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement("a");
            a.href     = url;
            a.download = `simchakit-backup-${eventId}-${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}>
            <Icon name="download" context="inline" style={{ marginRight: 4 }} /> Download File
          </button>
          <button className="btn btn-primary" onClick={()=>navigator.clipboard.writeText(backupData||"").then(()=>{setBackupCopied(true);setTimeout(()=>setBackupCopied(false),2500);})}>
            {backupCopied?<><Icon name="check" context="badge" /> Copied!</>:"Copy to Clipboard"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── UnarchiveModal ──
export function UnarchiveModal({ setShowUnarchive, unarchiveMsg, unarchiveCode, setUnarchiveCode, unarchiving, handleUnarchive }) {
  return (
    <Modal onClose={() => setShowUnarchive(false)} ariaLabel="Unarchive Event">
      <div className="modal-header"><div className="modal-title">Unarchive Event</div><button className="icon-btn" onClick={()=>setShowUnarchive(false)}><Icon name="x" context="button" /></button></div>
      <div className="modal-body">
        <p style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.6,marginBottom:16}}>
          Unarchiving restores the event to fully editable. You will need the <strong>unlock code</strong> you set
          when the event was archived.
        </p>
        {unarchiveMsg && <div className="alert alert-error" style={{marginBottom:12}}>{unarchiveMsg}</div>}
        <div className="form-group">
          <label className="form-label">Archive Unlock Code</label>
          <input className="form-input" type="password" value={unarchiveCode} onChange={e=>setUnarchiveCode(e.target.value)} placeholder="The code you set when archiving" />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={()=>setShowUnarchive(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={unarchiving||!unarchiveCode} onClick={handleUnarchive}>{unarchiving?"Unarchiving…":"Unarchive Event"}</button>
        </div>
      </div>
    </Modal>
  );
}

// ── ResetModal ──
export function ResetModal({ setShowReset, resetMsg, resetConfirm, setResetConfirm, resetting, eventName, handleResetData }) {
  return (
    <Modal onClose={() => setShowReset(false)} ariaLabel="Reset Event Data">
      <div className="modal-header"><div className="modal-title">Reset Event Data</div><button className="icon-btn" onClick={()=>setShowReset(false)}><Icon name="x" context="button" /></button></div>
      <div className="modal-body">
        <p style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.6,marginBottom:12}}>
          This will permanently delete all planning data for this event:
        </p>
        <ul style={{fontSize:13,color:"var(--text-secondary)",lineHeight:2,marginBottom:12,paddingLeft:20}}>
          <li>All guests and household records</li>
          <li>All expenses and budget entries</li>
          <li>All vendors</li>
          <li>All tasks</li>
          <li>All prep items</li>
          <li>All seating tables and assignments</li>
          <li>All gifts and favors</li>
          <li>Quick notes</li>
        </ul>
        <p style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.6,marginBottom:16}}>
          <strong>Your event configuration will be kept:</strong> the event name, type, timeline,
          theme, and accommodations settings are not affected.
        </p>
        <p style={{fontSize:13,color:"var(--red)",fontWeight:600,lineHeight:1.6,marginBottom:16}}><Icon name="alertTriangle" context="badge" style={{ marginRight: 3 }} /> This cannot be undone. Export a backup first if you need this data.</p>
        {resetMsg && <div className="alert alert-error" style={{marginBottom:12}}>{resetMsg}</div>}
        <div className="form-group">
          <label className="form-label">Type the event name to confirm: <strong>{eventName||"(no event name set)"}</strong></label>
          <input className="form-input" value={resetConfirm} onChange={e=>setResetConfirm(e.target.value)} placeholder={eventName||"Type the event name exactly"} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={()=>setShowReset(false)}>Cancel</button>
          <button className="btn btn-danger" disabled={resetting||resetConfirm!==eventName||!eventName} onClick={handleResetData}>{resetting?"Resetting…":"Reset All Event Data"}</button>
        </div>
      </div>
    </Modal>
  );
}
