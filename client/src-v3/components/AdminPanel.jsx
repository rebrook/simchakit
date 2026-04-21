// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — AdminPanel.jsx
// Ported from V2. All NAS REST endpoints replaced with direct Supabase calls.
// Password stored in events.admin_password (text column).
// Config stored in events.admin_config (jsonb column).
// Archive stored in events.archived (boolean column).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { supabase }          from "@/lib/supabase.js";
import { DEFAULT_GROUPS, DEFAULT_MEALS } from "@/constants/guest-constants.js";
import { PALETTES, SHIRT_SIZES }         from "@/constants/theme.js";
import { formatEntryMeta, sortTimeline } from "@/utils/dates.js";
import { deriveCustomPalette }           from "@/utils/color.js";
import { formatPhone }                   from "@/utils/guests.js";
import { TimelineEntryModal }            from "@/components/tabs/GuestsTab.jsx";

// ── AdminLogin ────────────────────────────────────────────────────────────────
export function AdminLogin({ eventId, onSuccess, onClose }) {
  const [password,      setPassword]      = useState("");
  const [error,         setError]         = useState("");
  const [loading,       setLoading]       = useState(false);
  const [showForgot,    setShowForgot]    = useState(false);
  const [resetPhrase,   setResetPhrase]   = useState("");
  const [resetMsg,      setResetMsg]      = useState("");
  const [resetLoading,  setResetLoading]  = useState(false);
  const [resetDone,     setResetDone]     = useState(false);

  const submit = async () => {
    if (!password.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { data, error: err } = await supabase
        .from("events")
        .select("admin_password")
        .eq("id", eventId)
        .single();
      if (err || !data) { setError("Could not verify password. Check your connection."); setLoading(false); return; }
      const stored = data.admin_password || "admin";
      if (password === stored) {
        onSuccess(password);
      } else {
        setError("Incorrect password. Try 'admin' if this is a new event.");
      }
    } catch { setError("Could not reach server. Check your connection."); }
    setLoading(false);
  };

  const submitReset = async () => {
    if (resetPhrase.trim() !== "RESET PASSWORD") { setResetMsg("Confirmation phrase doesn't match."); return; }
    setResetLoading(true); setResetMsg("");
    try {
      const { error: err } = await supabase
        .from("events")
        .update({ admin_password: "admin", updated_at: new Date().toISOString() })
        .eq("id", eventId);
      if (err) { setResetMsg("Reset failed: " + err.message); }
      else { setResetDone(true); setResetMsg("Password has been reset to 'admin'. You can now log in."); }
    } catch { setResetMsg("Could not reach server."); }
    setResetLoading(false);
  };

  if (showForgot) {
    return (
      <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">Reset Admin Password</div>
            <button className="icon-btn" title="Close" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body">
            {resetDone ? (
              <>
                <div className="alert alert-success" style={{ marginBottom:16 }}>✓ {resetMsg}</div>
                <p style={{ fontSize:13, color:"var(--text-secondary)", lineHeight:1.6, marginBottom:16 }}>
                  The admin password has been reset to <strong>'admin'</strong>. Log in now and go to Admin Mode → Security to set a new password.
                </p>
                <div className="modal-footer">
                  <button className="btn btn-primary" onClick={() => { setShowForgot(false); setResetDone(false); setResetPhrase(""); setResetMsg(""); }}>
                    Back to Login
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize:13, color:"var(--text-secondary)", lineHeight:1.6, marginBottom:12 }}>
                  This will reset the admin password back to <strong>'admin'</strong>.
                </p>
                <p style={{ fontSize:13, color:"var(--text-secondary)", lineHeight:1.6, marginBottom:16 }}>
                  To confirm, type exactly: <strong>RESET PASSWORD</strong>
                </p>
                {resetMsg && <div className="alert alert-error" style={{ marginBottom:12 }}>⚠ {resetMsg}</div>}
                <div className="form-group">
                  <label className="form-label">Confirmation Phrase</label>
                  <input className="form-input" value={resetPhrase} onChange={e => setResetPhrase(e.target.value)} placeholder="Type: RESET PASSWORD" autoFocus />
                </div>
                <div className="modal-footer">
                  <button className="btn btn-ghost" onClick={() => { setShowForgot(false); setResetMsg(""); setResetPhrase(""); }}>Back to Login</button>
                  <button className="btn btn-danger" disabled={resetLoading || resetPhrase.trim() !== "RESET PASSWORD"} onClick={submitReset}>
                    {resetLoading ? "Resetting…" : "Reset Password"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">⚙ Admin Mode</div>
          <button className="icon-btn" title="Close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize:13, color:"var(--text-muted)", marginBottom:16, lineHeight:1.6 }}>
            Enter the admin password to configure this event.
          </p>
          {error && <div className="alert alert-error" style={{ marginBottom:12 }}>⚠ {error}</div>}
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" value={password} placeholder="Enter password"
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()} autoFocus />
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" style={{ marginRight:"auto" }}
              onClick={() => { setShowForgot(true); setResetMsg(""); setResetPhrase(""); }}>
              Forgot password?
            </button>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={submit} disabled={loading || !password.trim()}>
              {loading ? "Verifying…" : "Enter Admin Mode"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AdminPanel ────────────────────────────────────────────────────────────────
export function AdminPanel({ eventId, password, config, onClose, onConfigSaved, initialSection }) {
  const [form, setForm] = useState(() => ({
    name: "", type: "bat-mitzvah", rsvpUrl: "", rsvpDeadline: "", cateringStyle: "plated", notes: "",
    rabbi:  { name: "", phone: "", email: "", notes: "" },
    cantor: { name: "", phone: "", email: "", notes: "" },
    tutor:  { name: "", phone: "", email: "", notes: "" },
    ...(config || {}),
    timeline:    config?.timeline    || [],
    theme:       { name: "", icon: "", palette: "rose", ...(config?.theme || {}) },
    groups:      config?.groups      || DEFAULT_GROUPS,
    mealChoices: config?.mealChoices || DEFAULT_MEALS,
    shirtSizes:  config?.shirtSizes  || SHIRT_SIZES.filter(s => s),
    hotelBlocks: config?.hotelBlocks
      ? config.hotelBlocks
      : (config?.accomHotelName
          ? [{ id: "hb_migrated", name: config.accomHotelName, groupCode: config.accomGroupCode || "", cutoffDate: config.accomCutoffDate || "", phone: config.accomPhone || "", website: config.accomWebsite || "" }]
          : []),
  }));

  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState("");
  const [section, setSection] = useState(initialSection || "event");

  // Password change
  const [newPass,     setNewPass]     = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [passMsg,     setPassMsg]     = useState("");

  // Access passcode
  const [newPasscode,     setNewPasscode]     = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  const [passcodeMsg,     setPasscodeMsg]     = useState("");

  // Archive/unarchive
  const [archiveUnlockCode,    setArchiveUnlockCode]    = useState("");
  const [archiveUnlockConfirm, setArchiveUnlockConfirm] = useState("");
  const [archiveMsg,           setArchiveMsg]           = useState("");
  const [archiving,            setArchiving]            = useState(false);
  const [showUnarchive,        setShowUnarchive]        = useState(false);
  const [unarchivePass,        setUnarchivePass]        = useState("");
  const [unarchiveCode,        setUnarchiveCode]        = useState("");
  const [unarchiveMsg,         setUnarchiveMsg]         = useState("");
  const [unarchiving,          setUnarchiving]          = useState(false);

  // Reset data
  const [showReset,    setShowReset]    = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetMsg,     setResetMsg]     = useState("");
  const [resetting,    setResetting]    = useState(false);

  // Backup/restore
  const [backupModal,   setBackupModal]   = useState(false);
  const [backupCopied,  setBackupCopied]  = useState(false);
  const [backupData,    setBackupData]    = useState(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreFile,    setRestoreFile]    = useState(null);
  const [restoreConfirm, setRestoreConfirm] = useState("");
  const [restoreMsg,     setRestoreMsg]     = useState("");
  const [restoring,      setRestoring]      = useState(false);
  const [restoreDone,    setRestoreDone]    = useState(false);

  // Timeline modals
  const [tlModal,  setTlModal]  = useState(null);
  const [tlDelete, setTlDelete] = useState(null);

  const set    = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setThm = (k, v) => setForm(f => ({ ...f, theme: { ...f.theme, [k]: v } }));
  const setCon = (who, k, v) => setForm(f => ({ ...f, [who]: { ...(f[who]||{}), [k]: v } }));

  const MITZVAH_TYPES = new Set(["bat-mitzvah","bar-mitzvah","bnei-mitzvah"]);
  const isMitzvah     = MITZVAH_TYPES.has(form.type);
  const sortedTimeline = sortTimeline(form.timeline || []);
  const hasMainEvent   = (form.timeline || []).some(e => e.isMainEvent);
  const isArchived     = config?._archived || false;
  const eventName      = config?.name || "";

  const EVENT_TYPES = [
    { value:"bat-mitzvah",  label:"Bat Mitzvah"        },
    { value:"bar-mitzvah",  label:"Bar Mitzvah"        },
    { value:"bnei-mitzvah", label:"B'nei Mitzvah"      },
    { value:"wedding",      label:"Wedding"            },
    { value:"baby-naming",  label:"Baby Naming"        },
    { value:"graduation",   label:"Graduation"         },
    { value:"anniversary",  label:"Anniversary"        },
    { value:"birthday",     label:"Birthday"           },
    { value:"other",        label:"Other Celebration"  },
  ];

  const sections = [
    { id:"event",          label:"Event Details"  },
    { id:"timeline",       label:"Timeline"       },
    { id:"clergy",         label:"Clergy & Tutor" },
    { id:"guests",         label:"Guests"         },
    { id:"accommodations", label:"Accommodations" },
    { id:"theme",          label:"Theme"          },
    { id:"tabs",           label:"Tabs"           },
    { id:"security",       label:"Security"       },
    { id:"data",           label:"Data"           },
  ];

  // ── Save config to Supabase ───────────────────────────────────────────────
  const saveConfig = async () => {
    setSaving(true); setError("");
    try {
      const { error: err } = await supabase
        .from("events")
        .update({
          name:         form.name || "",
          type:         form.type || "other",
          admin_config: form,
          updated_at:   new Date().toISOString(),
        })
        .eq("id", eventId);
      if (err) { setError(err.message); }
      else {
        setSaved(true);
        onConfigSaved(form);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch (e) { setError("Could not save. Check your connection."); }
    setSaving(false);
  };

  // ── Change password ───────────────────────────────────────────────────────
  const changePassword = async () => {
    if (newPass !== confirmPass) { setPassMsg("Passwords do not match"); return; }
    if (newPass.length < 8)      { setPassMsg("Password must be at least 8 characters"); return; }
    setPassMsg("");
    try {
      const { error: err } = await supabase
        .from("events")
        .update({ admin_password: newPass, updated_at: new Date().toISOString() })
        .eq("id", eventId);
      if (err) { setPassMsg(err.message); }
      else { setPassMsg("✓ Password changed"); setNewPass(""); setConfirmPass(""); }
    } catch { setPassMsg("Could not reach server"); }
  };

  // ── Access passcode ───────────────────────────────────────────────────────
  const savePasscode = async () => {
    if (!newPasscode)                     { setPasscodeMsg("Passcode cannot be empty"); return; }
    if (newPasscode.length < 4)           { setPasscodeMsg("Passcode must be at least 4 characters"); return; }
    if (newPasscode !== confirmPasscode)  { setPasscodeMsg("Passcodes do not match"); return; }
    setPasscodeMsg("");
    const updatedConfig = { ...form, accessPasscode: newPasscode };
    try {
      const { error: err } = await supabase
        .from("events")
        .update({ admin_config: updatedConfig, updated_at: new Date().toISOString() })
        .eq("id", eventId);
      if (err) { setPasscodeMsg(err.message); }
      else { setPasscodeMsg("✓ Passcode set"); setNewPasscode(""); setConfirmPasscode(""); onConfigSaved(updatedConfig); }
    } catch { setPasscodeMsg("Could not reach server"); }
  };

  const removePasscode = async () => {
    setPasscodeMsg("");
    const updatedConfig = { ...form };
    delete updatedConfig.accessPasscode;
    try {
      const { error: err } = await supabase
        .from("events")
        .update({ admin_config: updatedConfig, updated_at: new Date().toISOString() })
        .eq("id", eventId);
      if (err) { setPasscodeMsg(err.message); }
      else { setPasscodeMsg("✓ Passcode removed"); onConfigSaved(updatedConfig); }
    } catch { setPasscodeMsg("Could not reach server"); }
  };

  // ── Archive ───────────────────────────────────────────────────────────────
  const handleArchive = async () => {
    if (!archiveUnlockCode || archiveUnlockCode.trim().length < 4) { setArchiveMsg("Unlock code must be at least 4 characters."); return; }
    if (archiveUnlockCode.trim() !== archiveUnlockConfirm.trim()) { setArchiveMsg("Unlock codes do not match."); return; }
    setArchiving(true); setArchiveMsg("");
    try {
      const updatedConfig = { ...form, archiveUnlockCode: archiveUnlockCode.trim() };
      const { error: err } = await supabase
        .from("events")
        .update({ archived: true, admin_config: updatedConfig, updated_at: new Date().toISOString() })
        .eq("id", eventId);
      if (err) { setArchiveMsg(err.message); }
      else { onConfigSaved({ ...updatedConfig, _archived: true }); onClose(); }
    } catch { setArchiveMsg("Could not reach server."); }
    setArchiving(false);
  };

  // ── Unarchive ─────────────────────────────────────────────────────────────
  const handleUnarchive = async () => {
    setUnarchiving(true); setUnarchiveMsg("");
    try {
      // Verify password
      const { data: evtData } = await supabase.from("events").select("admin_password, admin_config").eq("id", eventId).single();
      if (!evtData) { setUnarchiveMsg("Could not verify credentials."); setUnarchiving(false); return; }
      if (unarchivePass !== evtData.admin_password) { setUnarchiveMsg("Incorrect admin password."); setUnarchiving(false); return; }
      if (unarchiveCode.trim() !== (evtData.admin_config?.archiveUnlockCode || "")) { setUnarchiveMsg("Incorrect unlock code."); setUnarchiving(false); return; }
      const updatedConfig = { ...(evtData.admin_config || {}), archiveUnlockCode: undefined };
      delete updatedConfig.archiveUnlockCode;
      const { error: err } = await supabase
        .from("events")
        .update({ archived: false, admin_config: updatedConfig, updated_at: new Date().toISOString() })
        .eq("id", eventId);
      if (err) { setUnarchiveMsg(err.message); }
      else { setShowUnarchive(false); setUnarchivePass(""); setUnarchiveCode(""); onConfigSaved(updatedConfig); }
    } catch { setUnarchiveMsg("Could not reach server."); }
    setUnarchiving(false);
  };

  // ── Generate backup (fetch from Supabase) ─────────────────────────────────
  const [backupCounts, setBackupCounts] = useState(null);

  const generateBackup = async () => {
    setBackupLoading(true);
    const COLLECTIONS = ["households","people","expenses","vendors","tasks","prep","tables","gifts","favors","ceremony_roles","seating","audit_log"];
    const result = { exportedAt: new Date().toISOString(), eventId, adminConfig: form };
    const counts = {};
    await Promise.all(COLLECTIONS.map(async (col) => {
      const { data } = await supabase.from(col).select("id, data, created_at, updated_at").eq("event_id", eventId);
      result[col] = (data || []).map(r => ({ ...(r.data || {}), _rowId: r.id }));
      counts[col] = result[col].length;
    }));
    setBackupCounts(counts);
    setBackupData(JSON.stringify(result, null, 2));
    setBackupLoading(false);
    setBackupModal(true);
  };

  // ── Restore from backup ───────────────────────────────────────────────────
  const handleRestore = async () => {
    if (!restoreFile || restoreConfirm.trim() !== "RESTORE BACKUP") return;
    setRestoring(true); setRestoreMsg("");
    try {
      const text = await restoreFile.text();
      let backup;
      try { backup = JSON.parse(text); }
      catch { setRestoreMsg("Could not parse file — make sure it is a valid SimchaKit backup (.json)."); setRestoring(false); return; }
      const COLLECTIONS = ["households","people","expenses","vendors","tasks","prep","tables","gifts","favors","ceremony_roles","seating"];
      for (const col of COLLECTIONS) {
        if (!backup[col]) continue;
        // Delete existing rows
        await supabase.from(col).delete().eq("event_id", eventId);
        // Re-insert
        const rows = backup[col].map(item => {
          const { _rowId, _createdAt, _updatedAt, ...data } = item;
          return { event_id: eventId, data };
        });
        if (rows.length > 0) await supabase.from(col).insert(rows);
      }
      if (backup.adminConfig) {
        await supabase.from("events").update({ admin_config: backup.adminConfig, updated_at: new Date().toISOString() }).eq("id", eventId);
        onConfigSaved(backup.adminConfig);
      }
      setRestoreDone(true); setRestoreFile(null); setRestoreConfirm("");
    } catch (e) { setRestoreMsg("Restore failed: " + e.message); }
    setRestoring(false);
  };

  // ── Reset all event data ──────────────────────────────────────────────────
  const handleResetData = async () => {
    if (resetConfirm !== eventName || !eventName) return;
    setResetting(true); setResetMsg("");
    try {
      const COLLECTIONS = ["households","people","expenses","vendors","tasks","prep","tables","gifts","favors","ceremony_roles","seating","audit_log"];
      for (const col of COLLECTIONS) {
        await supabase.from(col).delete().eq("event_id", eventId);
      }
      await supabase.from("events").update({ quick_notes: "", updated_at: new Date().toISOString() }).eq("id", eventId);
      setShowReset(false); setResetConfirm("");
      onClose();
    } catch (e) { setResetMsg("Reset failed: " + e.message); }
    setResetting(false);
  };

  // ── Timeline handlers ─────────────────────────────────────────────────────
  const handleTlSave = (entry) => {
    const entries = form.timeline || [];
    let updated = entry.isMainEvent ? entries.map(e => ({ ...e, isMainEvent: false })) : [...entries];
    const idx = updated.findIndex(e => e.id === entry.id);
    if (idx >= 0) updated[idx] = entry; else updated = [...updated, entry];
    set("timeline", updated);
    setTlModal(null);
  };
  const handleTlDelete = (id) => {
    set("timeline", (form.timeline || []).filter(e => e.id !== id));
    setTlDelete(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">⚙ Admin Mode</div>
          <button className="icon-btn" title="Close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">

          {/* Section nav */}
          <div className="admin-section-nav">
            {sections.map(s => (
              <button key={s.id} onClick={() => setSection(s.id)} style={{
                padding:"8px 14px", border:"none", background:"none", cursor:"pointer",
                fontSize:13, fontWeight:600, fontFamily:"var(--font-body)",
                color: section===s.id ? "var(--accent-primary)" : "var(--text-muted)",
                borderBottom: `2px solid ${section===s.id ? "var(--accent-primary)" : "transparent"}`,
                marginBottom:-1, transition:"all 0.15s ease",
              }}>{s.label}</button>
            ))}
          </div>

          {/* ── Event Details ── */}
          {section === "event" && (
            <>
              {saved  && <div className="alert alert-success" style={{marginBottom:12}}>✓ Event configuration saved</div>}
              {error  && <div className="alert alert-error"   style={{marginBottom:12}}>⚠ {error}</div>}
              <div className="form-group">
                <label className="form-label">Event Name</label>
                <input className="form-input" value={form.name} onChange={e => set("name",e.target.value)} placeholder="e.g., Lisa Simpson's Bat Mitzvah" />
              </div>
              <div className="form-group">
                <label className="form-label">Event Type</label>
                <select className="form-select" value={form.type} onChange={e => set("type",e.target.value)}>
                  {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">RSVP Website URL</label>
                <input className="form-input" value={form.rsvpUrl} onChange={e => set("rsvpUrl",e.target.value)} placeholder="https://…" />
              </div>
              <div className="form-group">
                <label className="form-label">RSVP Deadline</label>
                <input className="form-input" type="date" value={form.rsvpDeadline||""} onChange={e => set("rsvpDeadline",e.target.value)} />
                <div className="form-hint">A banner will appear on the Guests tab counting down to this date</div>
              </div>
              <div className="form-group">
                <label className="form-label">Catering Style</label>
                <select className="form-select" value={form.cateringStyle||"plated"} onChange={e => set("cateringStyle",e.target.value)}>
                  <option value="plated">Plated / Assigned Meals</option>
                  <option value="buffet-exceptions">Buffet with dietary exceptions</option>
                  <option value="buffet-headcount">Buffet (headcount only)</option>
                </select>
                <div className="form-hint">Controls what the Catering Summary shows in the Guests tab</div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" value={form.notes} onChange={e => set("notes",e.target.value)} placeholder="Any additional details about this event…" rows={3} />
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={onClose}>Close</button>
                <button className="btn btn-primary" onClick={saveConfig} disabled={saving}>{saving?"Saving…":"Save Configuration"}</button>
              </div>
            </>
          )}

          {/* ── Timeline ── */}
          {section === "timeline" && (
            <>
              {saved && <div className="alert alert-success" style={{marginBottom:12}}>✓ Configuration saved</div>}
              {error && <div className="alert alert-error"   style={{marginBottom:12}}>⚠ {error}</div>}
              {!hasMainEvent && (form.timeline||[]).length > 0 && (
                <div className="alert alert-warning" style={{marginBottom:14}}>
                  ⚠ No main event set — the countdown won't display until you mark one entry as the main event.
                </div>
              )}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{fontSize:13,color:"var(--text-muted)"}}>{sortedTimeline.length} event{sortedTimeline.length!==1?"s":""} · sorted by date and time</div>
                <button className="btn btn-primary" onClick={() => setTlModal("add")}>+ Add Event</button>
              </div>
              {sortedTimeline.length === 0 ? (
                <div style={{textAlign:"center",padding:"32px 16px",color:"var(--text-muted)",background:"var(--bg-subtle)",borderRadius:"var(--radius-md)",border:"1px solid var(--border)"}}>
                  <div style={{fontSize:28,marginBottom:8}}>📅</div>
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
                          {entry.isMainEvent && <span className="tag tag-accent" style={{fontSize:11}}>⭐ Main Event</span>}
                        </div>
                        <div style={{fontSize:12,color:"var(--text-muted)",marginTop:2}}>{formatEntryMeta(entry)}</div>
                      </div>
                      <div style={{display:"flex",gap:4,flexShrink:0}}>
                        <button className="icon-btn" title="Edit" onClick={() => setTlModal(entry)}>✎</button>
                        <button className="icon-btn" title="Delete" onClick={() => setTlDelete(entry)}>✕</button>
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
          )}

          {/* ── Clergy & Tutor ── */}
          {section === "clergy" && (
            <>
              {saved && <div className="alert alert-success" style={{marginBottom:12}}>✓ Clergy & Tutor saved</div>}
              {error && <div className="alert alert-error"   style={{marginBottom:12}}>⚠ {error}</div>}
              <ContactBlock label="Rabbi"  icon="✡"  value={form.rabbi ||{}} onChange={(k,v)=>setCon("rabbi",k,v)}  alwaysShow={true} />
              <ContactBlock label="Cantor" icon="🎼" value={form.cantor||{}} onChange={(k,v)=>setCon("cantor",k,v)} alwaysShow={false} show={isMitzvah} />
              <ContactBlock label="Tutor / Madrikh·a" icon="📖" value={form.tutor||{}} onChange={(k,v)=>setCon("tutor",k,v)} alwaysShow={false} show={isMitzvah} />
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={onClose}>Close</button>
                <button className="btn btn-primary" onClick={saveConfig} disabled={saving}>{saving?"Saving…":"Save Configuration"}</button>
              </div>
            </>
          )}

          {/* ── Guests ── */}
          {section === "guests" && (
            <>
              {saved && <div className="alert alert-success" style={{marginBottom:12}}>✓ Configuration saved</div>}
              {error && <div className="alert alert-error"   style={{marginBottom:12}}>⚠ {error}</div>}

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
                        onClick={() => set("groups",(form.groups||[]).filter((_,j)=>j!==i))}>✕</button>
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
                        onClick={() => set("mealChoices",(form.mealChoices||[]).filter((_,j)=>j!==i))}>✕</button>
                      <button className="btn btn-ghost btn-sm" style={{padding:"4px 8px"}} disabled={i===0}
                        onClick={() => { const u=[...(form.mealChoices||[])]; [u[i-1],u[i]]=[u[i],u[i-1]]; set("mealChoices",u); }}>↑</button>
                      <button className="btn btn-ghost btn-sm" style={{padding:"4px 8px"}} disabled={i===(form.mealChoices||[]).length-1}
                        onClick={() => { const u=[...(form.mealChoices||[])]; [u[i],u[i+1]]=[u[i+1],u[i]]; set("mealChoices",u); }}>↓</button>
                    </div>
                  ))}
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => set("mealChoices",[...(form.mealChoices||[]),""])}>+ Add Meal Choice</button>
                <button className="btn btn-ghost btn-sm" style={{marginLeft:8,color:"var(--text-muted)",opacity:0.7}} onClick={() => set("mealChoices",DEFAULT_MEALS)}>Reset to defaults</button>
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
                        onClick={() => set("shirtSizes",(form.shirtSizes||[]).filter((_,j)=>j!==i))}>✕</button>
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
          )}

          {/* ── Accommodations ── */}
          {section === "accommodations" && (
            <>
              {saved && <div className="alert alert-success" style={{marginBottom:12}}>✓ Configuration saved</div>}
              {error && <div className="alert alert-error"   style={{marginBottom:12}}>⚠ {error}</div>}
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
                      {key:"groupCode",   label:"Room Block / Group Code",  placeholder:"e.g., Brook Family Room Block", hint:"Guests reference this code when booking"},
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
                    <div className="form-group" style={{marginBottom:0}}>
                      <label className="form-label">Room Block Cut-off Date</label>
                      <input className="form-input" type="date" value={block.cutoffDate||""}
                        onChange={e => set("hotelBlocks", form.hotelBlocks.map((b,i) => i===idx ? {...b,cutoffDate:e.target.value} : b))} />
                      <div className="form-hint">A warning will appear when this date is within 60 days</div>
                    </div>
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
          )}

          {/* ── Theme ── */}
          {section === "theme" && (
            <>
              {saved && <div className="alert alert-success" style={{marginBottom:12}}>✓ Configuration saved</div>}
              {error && <div className="alert alert-error"   style={{marginBottom:12}}>⚠ {error}</div>}
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
          )}

          {/* ── Tabs ── */}
          {section === "tabs" && (
            <>
              {saved && <div className="alert alert-success" style={{marginBottom:12}}>✓ Tab visibility saved</div>}
              <div className="admin-section">
                <div className="admin-section-title">Visible Tabs</div>
                <p style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.6,marginBottom:16}}>
                  Choose which tabs appear in the navigation. Hidden tabs are not deleted — you can restore them at any time. Overview is always visible.
                </p>
                {[
                  {id:"guests",         icon:"👥",label:"Guests"},
                  {id:"accommodations", icon:"🧳",label:"Stay & Travel"},
                  {id:"budget",         icon:"💰",label:"Budget"},
                  {id:"vendors",        icon:"🏪",label:"Vendors"},
                  {id:"tasks",          icon:"✅",label:"Tasks"},
                  {id:"prep",           icon:"📖",label:"Prep"},
                  {id:"ceremony",       icon:"📜",label:"Ceremony"},
                  {id:"seating",        icon:"🪑",label:"Seating"},
                  {id:"gifts",          icon:"🎁",label:"Gifts"},
                  {id:"favors",         icon:"⭐",label:"Favors"},
                  {id:"calendar",       icon:"📅",label:"Calendar"},
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
                        <span>{tab.icon}</span><span>{tab.label}</span>
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
          )}

          {/* ── Security ── */}
          {section === "security" && (
            <>
              <div className="admin-section">
                <div className="admin-section-title">Change Password</div>
                {passMsg && <div className={`alert ${passMsg.startsWith("✓")?"alert-success":"alert-error"}`} style={{marginBottom:12}}>{passMsg}</div>}
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input className="form-input" type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Min 8 characters" />
                  {newPass.length>0 && (() => {
                    const len=newPass.length;const hasUpper=/[A-Z]/.test(newPass);const hasLower=/[a-z]/.test(newPass);const hasNumber=/[0-9]/.test(newPass);const hasSymbol=/[^A-Za-z0-9]/.test(newPass);
                    const variety=[hasUpper,hasLower,hasNumber,hasSymbol].filter(Boolean).length;
                    const strong=len>=12&&variety>=3;const fair=len>=8&&variety>=2;
                    const color=strong?"var(--green)":fair?"var(--gold)":"var(--red)";
                    const label=strong?"Strong":fair?"Fair":"Weak";const pct=strong?100:fair?60:30;
                    return (<div style={{marginTop:6}}><div style={{height:4,borderRadius:99,background:"var(--border)",overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:99,transition:"width 0.3s ease"}} /></div><div style={{fontSize:11,color,fontWeight:600,marginTop:3}}>{label}</div></div>);
                  })()}
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <input className="form-input" type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} placeholder="Repeat new password" />
                </div>
                <button className="btn btn-primary btn-sm" onClick={changePassword}>Change Password</button>
              </div>

              <div className="admin-section">
                <div className="admin-section-title">Access Passcode</div>
                <div className="admin-section-desc">
                  Require a passcode before the event dashboard loads. Anyone with the direct event URL must enter this passcode to view the dashboard. Separate from your Admin Mode password.
                </div>
                {config?.accessPasscode && <div className="alert alert-success" style={{marginBottom:12}}>🔒 An access passcode is currently set.</div>}
                {passcodeMsg && <div className={`alert ${passcodeMsg.startsWith("✓")?"alert-success":"alert-error"}`} style={{marginBottom:12}}>{passcodeMsg}</div>}
                <div className="form-group">
                  <label className="form-label">{config?.accessPasscode?"New Passcode":"Set Passcode"}</label>
                  <input className="form-input" type="password" value={newPasscode} onChange={e => setNewPasscode(e.target.value)} placeholder="Min 4 characters" />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm Passcode</label>
                  <input className="form-input" type="password" value={confirmPasscode} onChange={e => setConfirmPasscode(e.target.value)} placeholder="Repeat passcode" />
                </div>
                <div style={{fontSize:12,color:"var(--text-muted)",marginBottom:12,lineHeight:1.5}}>⚠ If you forget this passcode, it can only be removed by an admin with the Admin Mode password.</div>
                <div style={{display:"flex",gap:8}}>
                  <button className="btn btn-primary btn-sm" onClick={savePasscode}>{config?.accessPasscode?"Update Passcode":"Set Passcode"}</button>
                  {config?.accessPasscode && <button className="btn btn-danger btn-sm" onClick={removePasscode}>Remove Passcode</button>}
                </div>
              </div>
            </>
          )}

          {/* ── Data ── */}
          {section === "data" && (
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
                    ✓ Backup restored successfully.
                    <button className="btn btn-ghost btn-sm" style={{marginLeft:12}} onClick={() => setRestoreDone(false)}>Restore another</button>
                  </div>
                ) : (
                  <>
                    <p style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.6,marginBottom:12}}>
                      Upload a previously exported SimchaKit backup file (.json) to replace all current event data.
                    </p>
                    <div style={{background:"var(--bg-subtle)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:"12px 14px",marginBottom:14,fontSize:13,lineHeight:1.7}}>
                      <strong>What this restores:</strong> guests, people, budget, vendors, tasks, prep, seating, gifts, favors, ceremony roles, and notes.<br/>
                      <strong>What is preserved:</strong> your admin password, event configuration (name, theme, timeline), and archived status.<br/>
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
                  <div className="admin-section-title" style={{marginBottom:0}}>{isArchived?"🔒 Event is Archived":"Archive Event"}</div>
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
                    <div className="alert alert-warning" style={{marginBottom:16}}>⚠ Save this code somewhere safe — it cannot be recovered if lost.</div>
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
                  <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,background:"var(--red-light)",color:"var(--red)",whiteSpace:"nowrap"}}>⚠ Permanent</span>
                </div>
                <p style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.6,marginBottom:12}}>
                  Permanently deletes all planning data: guests, people, expenses, vendors, tasks, prep, seating, gifts, favors, and notes.
                </p>
                <p style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.6,marginBottom:16}}>
                  <strong>What is preserved:</strong> your event configuration (name, type, timeline, theme) and your admin password.
                </p>
                <p style={{fontSize:13,color:"var(--red)",fontWeight:600,lineHeight:1.6,marginBottom:16}}>⚠ This action cannot be undone.</p>
                <button className="btn btn-danger" disabled={isArchived} onClick={() => { setShowReset(true); setResetConfirm(""); setResetMsg(""); }}>
                  Reset Event Data…
                </button>
                {isArchived && <div className="form-hint" style={{marginTop:8}}>Unarchive the event before resetting data.</div>}
              </div>
            </>
          )}

        </div>
      </div>

      {/* ── Timeline modals ── */}
      {tlModal && <TimelineEntryModal entry={tlModal==="add"?null:tlModal} onSave={handleTlSave} onClose={()=>setTlModal(null)} />}

      {tlDelete && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target===e.currentTarget) setTlDelete(null); }}>
          <div className="modal" style={{maxWidth:380}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><div className="modal-title">Delete Timeline Entry</div><button className="icon-btn" title="Close" onClick={()=>setTlDelete(null)}>✕</button></div>
            <div className="modal-body">
              <p style={{fontSize:14,color:"var(--text-primary)",lineHeight:1.6}}>Delete <strong>{tlDelete.title}</strong>? This cannot be undone.</p>
              <div className="modal-footer"><button className="btn btn-ghost" onClick={()=>setTlDelete(null)}>Cancel</button><button className="btn btn-danger" onClick={()=>handleTlDelete(tlDelete.id)}>Delete</button></div>
            </div>
          </div>
        </div>
      )}

      {/* ── Backup modal ── */}
      {backupModal && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target===e.currentTarget){setBackupModal(false);setBackupCopied(false);} }}>
          <div className="modal modal-lg" style={{maxWidth:600}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><div className="modal-title">↓ Export Full Backup</div><button className="icon-btn" title="Close" onClick={()=>{setBackupModal(false);setBackupCopied(false);}}>✕</button></div>
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
                  ⬇ Download File
                </button>
                <button className="btn btn-primary" onClick={()=>navigator.clipboard.writeText(backupData||"").then(()=>{setBackupCopied(true);setTimeout(()=>setBackupCopied(false),2500);})}>
                  {backupCopied?"✓ Copied!":"Copy to Clipboard"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Unarchive modal ── */}
      {showUnarchive && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target===e.currentTarget) setShowUnarchive(false); }}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><div className="modal-title">Unarchive Event</div><button className="icon-btn" onClick={()=>setShowUnarchive(false)}>✕</button></div>
            <div className="modal-body">
              <p style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.6,marginBottom:16}}>
                Unarchiving restores the event to fully editable. You will need two things:
                your <strong>admin password</strong> and the <strong>unlock code</strong> you set
                when the event was archived.
              </p>
              {unarchiveMsg && <div className="alert alert-error" style={{marginBottom:12}}>{unarchiveMsg}</div>}
              <div className="form-group"><label className="form-label">Admin Password</label><input className="form-input" type="password" value={unarchivePass} onChange={e=>setUnarchivePass(e.target.value)} placeholder="Your admin password" /></div>
              <div className="form-group">
                <label className="form-label">Archive Unlock Code</label>
                <input className="form-input" type="password" value={unarchiveCode} onChange={e=>setUnarchiveCode(e.target.value)} placeholder="The code you set when archiving" />
                <div className="form-hint">This is the separate unlock code set at archive time, not your admin password.</div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={()=>setShowUnarchive(false)}>Cancel</button>
                <button className="btn btn-primary" disabled={unarchiving||!unarchivePass||!unarchiveCode} onClick={handleUnarchive}>{unarchiving?"Unarchiving…":"Unarchive Event"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset data modal ── */}
      {showReset && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target===e.currentTarget) setShowReset(false); }}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><div className="modal-title">Reset Event Data</div><button className="icon-btn" onClick={()=>setShowReset(false)}>✕</button></div>
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
                <strong>Your event configuration will be kept</strong> — the event name, type, timeline,
                theme, accommodations settings, and admin password are not affected.
              </p>
              <p style={{fontSize:13,color:"var(--red)",fontWeight:600,lineHeight:1.6,marginBottom:16}}>⚠ This cannot be undone. Export a backup first if you need this data.</p>
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
          </div>
        </div>
      )}

    </div>
  );
}

// ── ContactBlock ──────────────────────────────────────────────────────────────
function ContactBlock({ label, icon, value, onChange, alwaysShow, show }) {
  const [forceShow, setForceShow] = useState(!!(value.name||value.phone||value.email||value.notes));
  const visible = alwaysShow || show || forceShow;
  if (!visible) {
    return (
      <div style={{marginBottom:20,padding:"12px 16px",background:"var(--bg-subtle)",borderRadius:"var(--radius-md)",border:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:13,color:"var(--text-muted)"}}>{icon} {label} — not applicable for this event type</span>
        <button className="btn btn-ghost btn-sm" onClick={()=>setForceShow(true)} style={{fontSize:12}}>+ Add anyway</button>
      </div>
    );
  }
  return (
    <div style={{marginBottom:24,background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:"16px"}}>
      <div style={{fontSize:13,fontWeight:700,color:"var(--text-primary)",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
        <span>{icon}</span> {label}
        {!alwaysShow&&forceShow && (
          <button className="btn btn-ghost btn-sm" style={{fontSize:11,marginLeft:"auto"}}
            onClick={()=>{setForceShow(false);onChange("name","");onChange("phone","");onChange("email","");onChange("notes","");}}>
            Remove
          </button>
        )}
      </div>
      <div className="form-grid-2">
        <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={value.name||""} onChange={e=>onChange("name",e.target.value)} placeholder={`${label} name`} /></div>
        <div className="form-group"><label className="form-label">Phone</label><input className="form-input" type="tel" value={value.phone||""} onChange={e=>onChange("phone",e.target.value)} onBlur={e=>onChange("phone",formatPhone(e.target.value))} placeholder="(000) 000-0000" /></div>
      </div>
      <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={value.email||""} onChange={e=>onChange("email",e.target.value)} placeholder="email@example.com" /></div>
      <div className="form-group" style={{marginBottom:0}}><label className="form-label">Notes</label><textarea className="form-textarea" rows={2} value={value.notes||""} onChange={e=>onChange("notes",e.target.value)} placeholder="Availability, meeting schedule, special notes…" /></div>
    </div>
  );
}
