// Moved verbatim from AdminPanel.jsx (V4.44.0 module split) — no behavior changes.
import { Icon }                          from "@/utils/iconMap.jsx";

// ── Security ──
export function SecuritySection({ config, newPasscode, setNewPasscode, confirmPasscode, setConfirmPasscode, passcodeMsg, savePasscode, removePasscode }) {
  return (
      <>
        <div className="admin-section">
          <div className="admin-section-title">Access Passcode</div>
          <div className="admin-section-desc">
            Require a passcode before the event dashboard loads. Anyone with the direct event URL must enter this passcode to view the dashboard.
          </div>
          {config?.accessPasscode && <div className="alert alert-success" style={{marginBottom:12}}><Icon name="lock" context="badge" style={{ marginRight: 4 }} /> An access passcode is currently set.</div>}
          {passcodeMsg && <div className={`alert ${!passcodeMsg.toLowerCase().includes("error") && !passcodeMsg.toLowerCase().includes("match") && !passcodeMsg.toLowerCase().includes("least")?"alert-success":"alert-error"}`} style={{marginBottom:12}}>{passcodeMsg}</div>}
          <div className="form-group">
            <label className="form-label">{config?.accessPasscode?"New Passcode":"Set Passcode"}</label>
            <input className="form-input" type="password" value={newPasscode} onChange={e => setNewPasscode(e.target.value)} placeholder="Min 4 characters" />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm Passcode</label>
            <input className="form-input" type="password" value={confirmPasscode} onChange={e => setConfirmPasscode(e.target.value)} placeholder="Repeat passcode" />
          </div>
          <div style={{fontSize:12,color:"var(--text-muted)",marginBottom:12,lineHeight:1.5}}><Icon name="alertTriangle" context="badge" style={{ marginRight: 3 }} /> If you forget this passcode, the event owner can remove it from Admin Mode → Security.</div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-primary btn-sm" onClick={savePasscode}>{config?.accessPasscode?"Update Passcode":"Set Passcode"}</button>
            {config?.accessPasscode && <button className="btn btn-danger btn-sm" onClick={removePasscode}>Remove Passcode</button>}
          </div>
        </div>
      </>
  );
}
