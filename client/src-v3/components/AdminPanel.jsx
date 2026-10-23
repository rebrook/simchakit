// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.16.x — AdminPanel.jsx
// Ported from V2. All NAS REST endpoints replaced with direct Supabase calls.
// Access gated on owner role only (checked upstream in AppShell.openAdmin).
// Config stored in events.admin_config (jsonb column).
// Archive stored in events.archived (boolean column).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { supabase }          from "@/lib/supabase.js";
import { DEFAULT_GROUPS, DEFAULT_MEALS } from "@/constants/guest-constants.js";
import { SHIRT_SIZES }                   from "@/constants/theme.js";
import { sortTimeline }                  from "@/utils/dates.js";
import { Icon }                          from "@/utils/iconMap.jsx";
import { TimelineEntryModal }            from "@/components/tabs/GuestsTab.jsx";
import { Modal }                         from "@/components/shared/Modal.jsx";
import { ConfirmDialog }                 from "@/components/shared/ConfirmDialog.jsx";
import { EventDetailsSection }           from "@/components/admin/EventDetailsSection.jsx";
import { TimelineSection }               from "@/components/admin/TimelineSection.jsx";
import { ClergySection }                 from "@/components/admin/ClergySection.jsx";
import { GuestsSection }                 from "@/components/admin/GuestsSection.jsx";
import { AccommodationsSection }         from "@/components/admin/AccommodationsSection.jsx";
import { ThemeSection }                  from "@/components/admin/ThemeSection.jsx";
import { TabsSection }                   from "@/components/admin/TabsSection.jsx";
import { CollaboratorsSection }          from "@/components/admin/CollaboratorsSection.jsx";
import { CalendarSection }               from "@/components/admin/CalendarSection.jsx";
import { SecuritySection }               from "@/components/admin/SecuritySection.jsx";
import { DataSection }                   from "@/components/admin/DataSection.jsx";
import { BackupModal, UnarchiveModal, ResetModal } from "@/components/admin/DataModals.jsx";

// ── AdminPanel ────────────────────────────────────────────────────────────────
export function AdminPanel({ eventId, userId, calendarToken: initialCalendarToken, config, onClose, onConfigSaved, initialSection }) {
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
    kosherMealLabel: config?.kosherMealLabel || "",
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
  const [eventIdCopied, setEventIdCopied] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [calendarToken,    setCalendarToken]    = useState(initialCalendarToken || null);
  const [calTokenCopied,   setCalTokenCopied]   = useState(false);
  const [calTokenRegen,    setCalTokenRegen]    = useState(false);   // confirm state
  const [calTokenLoading,  setCalTokenLoading]  = useState(false);
  const [calTokenError,    setCalTokenError]    = useState("");

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


  const groups = [
    {
      label: "Event Setup",
      items: [
        { id:"event",          label:"Event Details"  },
        { id:"timeline",       label:"Timeline"       },
        { id:"clergy",         label:"Clergy & Tutor" },
      ],
    },
    {
      label: "People & Logistics",
      items: [
        { id:"guests",         label:"Guests"         },
        { id:"accommodations", label:"Accommodations" },
        { id:"collaborators",  label:"Collaborators"  },
      ],
    },
    {
      label: "App Config",
      items: [
        { id:"theme",          label:"Theme"          },
        { id:"tabs",           label:"Tabs"           },
        { id:"calendar",       label:"Calendar"       },
        { id:"security",       label:"Security"       },
        { id:"data",           label:"Data"           },
      ],
    },
  ];
  const sections = groups.flatMap(g => g.items);

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
      else { setPasscodeMsg("Passcode set"); setNewPasscode(""); setConfirmPasscode(""); onConfigSaved(updatedConfig); }
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
      else { setPasscodeMsg("Passcode removed"); onConfigSaved(updatedConfig); }
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
      // Verify unlock code
      const { data: evtData } = await supabase.from("events").select("admin_config").eq("id", eventId).single();
      if (!evtData) { setUnarchiveMsg("Could not verify credentials."); setUnarchiving(false); return; }
      if (unarchiveCode.trim() !== (evtData.admin_config?.archiveUnlockCode || "")) { setUnarchiveMsg("Incorrect unlock code."); setUnarchiving(false); return; }
      const updatedConfig = { ...(evtData.admin_config || {}), archiveUnlockCode: undefined };
      delete updatedConfig.archiveUnlockCode;
      const { error: err } = await supabase
        .from("events")
        .update({ archived: false, admin_config: updatedConfig, updated_at: new Date().toISOString() })
        .eq("id", eventId);
      if (err) { setUnarchiveMsg(err.message); }
      else { setShowUnarchive(false); setUnarchiveCode(""); onConfigSaved(updatedConfig); }
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

      // ── Normalize V2 backup format into V3 format ─────────────────────────
      // V2 uses camelCase keys and different shapes for some collections.
      // Map V2 key names → V3 table names
      const V2_KEY_MAP = {
        households:    "households",
        people:        "people",
        expenses:      "expenses",
        vendors:       "vendors",
        tasks:         "tasks",
        prep:          "prep",
        tables:        "tables",
        gifts:         "gifts",
        favors:        "favors",
        seating:       "seating",
        ceremonyRoles: "ceremony_roles",
      };

      // Normalize each collection to a plain array of data objects
      const normalized = {};

      for (const [v2Key, v3Table] of Object.entries(V2_KEY_MAP)) {
        const raw = backup[v2Key] || backup[v3Table];
        if (!raw) continue;

        if (v2Key === "favors") {
          // V2: { config, items: [...] } — extract items array
          const items = Array.isArray(raw) ? raw : (raw.items || []);
          normalized[v3Table] = items;
        } else if (v2Key === "seating") {
          // V2: { config } object with no rows — skip, nothing to restore
          if (Array.isArray(raw)) normalized[v3Table] = raw;
          // else skip
        } else if (v2Key === "ceremonyRoles") {
          // V2: flat array of role objects — wrap into single V3 document
          if (Array.isArray(raw) && raw.length > 0) {
            normalized[v3Table] = [{ roles: raw }];
          } else if (Array.isArray(raw) && raw.length === 0) {
            normalized[v3Table] = [];
          } else {
            normalized[v3Table] = raw; // already V3 format
          }
        } else {
          // Standard collections — must be an array
          normalized[v3Table] = Array.isArray(raw) ? raw : [];
        }
      }

      // ── Write to Supabase ─────────────────────────────────────────────────
      const COLLECTIONS = ["households","people","expenses","vendors","tasks","prep","tables","gifts","favors","ceremony_roles","seating"];
      for (const col of COLLECTIONS) {
        if (!normalized[col] || normalized[col].length === 0) continue;
        // Delete existing rows
        await supabase.from(col).delete().eq("event_id", eventId);
        // Re-insert — strip V3 tracking fields if present
        const rows = normalized[col].map(item => {
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
    <>
      <Modal onClose={onClose} ariaLabel="Admin Mode" className="modal-lg">
        <div className="modal-header">
          <div className="modal-title"><Icon name="settings" context="menu" style={{ marginRight: 6 }} /> Admin Mode</div>
          <button className="icon-btn" title="Close" aria-label="Close" onClick={onClose}><Icon name="x" context="button" /></button>
        </div>
        <div className="modal-body admin-modal-body">
          {/* Desktop sidebar */}
          <div className="admin-sidebar">
            {groups.map((group, gi) => (
              <div key={group.label}>
                {gi > 0 && <div className="admin-sidebar-divider" />}
                <div className="admin-sidebar-group-label">{group.label}</div>
                {group.items.map(s => (
                  <button
                    key={s.id}
                    className={"admin-sidebar-btn" + (section===s.id ? " active" : "")}
                    onClick={() => setSection(s.id)}
                  >{s.label}</button>
                ))}
              </div>
            ))}
          </div>
          {/* Mobile nav */}
          <div className="admin-mobile-nav">
            <button
              className={"admin-mobile-nav-btn" + (mobileNavOpen ? " open" : "")}
              onClick={() => setMobileNavOpen(o => !o)}
            >
              <span>{sections.find(s => s.id === section)?.label || "Select section"}</span>
              <span className="chevron">▼</span>
            </button>
            <div className={"admin-mobile-nav-list" + (mobileNavOpen ? " open" : "")}>
              {sections.map(s => (
                <button
                  key={s.id}
                  className={"admin-mobile-nav-item" + (section===s.id ? " active" : "")}
                  onClick={() => { setSection(s.id); setMobileNavOpen(false); }}
                >{s.label}</button>
              ))}
            </div>
          </div>
          {/* Section content */}
          <div className="admin-content">

          {/* ── event ── */}
          {section === "event" && (
            <EventDetailsSection form={form} set={set} eventId={eventId} eventIdCopied={eventIdCopied} setEventIdCopied={setEventIdCopied} saved={saved} error={error} onClose={onClose} saveConfig={saveConfig} saving={saving} />
          )}

          {/* ── timeline ── */}
          {section === "timeline" && (
            <TimelineSection form={form} sortedTimeline={sortedTimeline} hasMainEvent={hasMainEvent} setTlModal={setTlModal} setTlDelete={setTlDelete} saved={saved} error={error} onClose={onClose} saveConfig={saveConfig} saving={saving} />
          )}

          {/* ── clergy ── */}
          {section === "clergy" && (
            <ClergySection form={form} setCon={setCon} isMitzvah={isMitzvah} saved={saved} error={error} onClose={onClose} saveConfig={saveConfig} saving={saving} />
          )}

          {/* ── guests ── */}
          {section === "guests" && (
            <GuestsSection form={form} set={set} saved={saved} error={error} onClose={onClose} saveConfig={saveConfig} saving={saving} />
          )}

          {/* ── accommodations ── */}
          {section === "accommodations" && (
            <AccommodationsSection form={form} set={set} saved={saved} error={error} onClose={onClose} saveConfig={saveConfig} saving={saving} />
          )}

          {/* ── theme ── */}
          {section === "theme" && (
            <ThemeSection form={form} setForm={setForm} setThm={setThm} saved={saved} error={error} onClose={onClose} saveConfig={saveConfig} saving={saving} />
          )}

          {/* ── tabs ── */}
          {section === "tabs" && (
            <TabsSection form={form} set={set} saved={saved} onClose={onClose} saveConfig={saveConfig} saving={saving} />
          )}

          {/* ── Collaborators ── */}
          {section === "collaborators" && (
            <CollaboratorsSection eventId={eventId} userId={userId} eventName={config?.name || ""} />
          )}

          {/* ── calendar ── */}
          {section === "calendar" && (
            <CalendarSection calendarToken={calendarToken} setCalendarToken={setCalendarToken} calTokenCopied={calTokenCopied} setCalTokenCopied={setCalTokenCopied} calTokenRegen={calTokenRegen} setCalTokenRegen={setCalTokenRegen} calTokenLoading={calTokenLoading} setCalTokenLoading={setCalTokenLoading} calTokenError={calTokenError} setCalTokenError={setCalTokenError} eventId={eventId} userId={userId} onClose={onClose} />
          )}

          {/* ── security ── */}
          {section === "security" && (
            <SecuritySection config={config} newPasscode={newPasscode} setNewPasscode={setNewPasscode} confirmPasscode={confirmPasscode} setConfirmPasscode={setConfirmPasscode} passcodeMsg={passcodeMsg} savePasscode={savePasscode} removePasscode={removePasscode} />
          )}

          {/* ── data ── */}
          {section === "data" && (
            <DataSection isArchived={isArchived} backupCounts={backupCounts} backupLoading={backupLoading} generateBackup={generateBackup} restoreDone={restoreDone} setRestoreDone={setRestoreDone} setRestoreFile={setRestoreFile} setRestoreMsg={setRestoreMsg} restoreConfirm={restoreConfirm} setRestoreConfirm={setRestoreConfirm} restoreMsg={restoreMsg} restoreFile={restoreFile} restoring={restoring} handleRestore={handleRestore} setShowUnarchive={setShowUnarchive} setUnarchiveMsg={setUnarchiveMsg} archiveMsg={archiveMsg} archiveUnlockCode={archiveUnlockCode} setArchiveUnlockCode={setArchiveUnlockCode} archiveUnlockConfirm={archiveUnlockConfirm} setArchiveUnlockConfirm={setArchiveUnlockConfirm} archiving={archiving} handleArchive={handleArchive} setShowReset={setShowReset} setResetConfirm={setResetConfirm} setResetMsg={setResetMsg} />
          )}

          </div>{/* end admin-content */}
        </div>{/* end admin-modal-body */}
      </Modal>

      {/* ── Timeline modals ── */}
      {tlModal && <TimelineEntryModal entry={tlModal==="add"?null:tlModal} onSave={handleTlSave} onClose={()=>setTlModal(null)} />}

      {tlDelete && (
        <ConfirmDialog
          title="Delete Timeline Entry"
          message={<>Delete <strong>{tlDelete.title}</strong>? This cannot be undone.</>}
          confirmLabel="Delete"
          onConfirm={() => handleTlDelete(tlDelete.id)}
          onClose={() => setTlDelete(null)}
        />
      )}

      {/* ── Backup modal ── */}
      {backupModal && <BackupModal backupData={backupData} backupCopied={backupCopied} setBackupModal={setBackupModal} setBackupCopied={setBackupCopied} eventId={eventId} />}

      {/* ── Unarchive modal ── */}
      {showUnarchive && <UnarchiveModal setShowUnarchive={setShowUnarchive} unarchiveMsg={unarchiveMsg} unarchiveCode={unarchiveCode} setUnarchiveCode={setUnarchiveCode} unarchiving={unarchiving} handleUnarchive={handleUnarchive} />}

      {/* ── Reset data modal ── */}
      {showReset && <ResetModal setShowReset={setShowReset} resetMsg={resetMsg} resetConfirm={resetConfirm} setResetConfirm={setResetConfirm} resetting={resetting} eventName={eventName} handleResetData={handleResetData} />}

    </>
  );
}
