// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.20.0 — PrepTab.jsx
// Ported from V2. Uses useEventData for Supabase persistence.
// Clergy/tutor contacts editable by owners and coordinators (V3.20.0).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { supabase }           from "@/lib/supabase.js";
import { useEventData }       from "@/hooks/useEventData.js";
import { useSearchHighlight } from "@/hooks/useSearchHighlight.js";
import { MITZVAH_TYPES }      from "@/constants/events.js";
import { PREP_CATEGORIES, PREP_STATUSES, PREP_STATUS_STYLES } from "@/constants/prep.js";
import { newPrepId }          from "@/utils/ids.js";
import { ArchivedNotice }     from "@/components/shared/ArchivedNotice.jsx";
import { TorahPortionCard }   from "@/components/shared/TorahPortionCard.jsx";

// ── Status is the single source of truth; the progress bar is derived from it ──
function statusToPercent(status) {
  switch (status) {
    case "Complete":    return 100;
    case "Nearly Done": return 66;
    case "In Progress": return 33;
    default:            return 0;
  }
}

// ── Prep starter template (mitzvah event types only) ──────────────────────────
function buildMitzvahPrepTemplate() {
  return [
    { title: "Torah Portion Study",         category: "Religious Study",            status: "Not Started", notes: "Work with your tutor on the assigned parsha." },
    { title: "Haftarah Portion Study",      category: "Religious Study",            status: "Not Started", notes: "Learn the trope and chant the Haftarah." },
    { title: "D'var Torah Writing",         category: "Speeches & Toasts",          status: "Not Started", notes: "Draft, review with clergy, then practice aloud." },
    { title: "Service Prayers and Blessings", category: "Religious Study",          status: "Not Started", notes: "Learn the prayers and blessings for the service." },
    { title: "Mitzvah Project",             category: "Community / Service Project", status: "Not Started", notes: "Choose a project and track sessions or milestones." },
  ].map((p, i) => ({
    ...p,
    id:            newPrepId(),
    progress:      0,
    targetDate:    "",
    completedDate: "",
    order:         i,
  }));
}

const PREP_TEMPLATES = {
  "bat-mitzvah":  buildMitzvahPrepTemplate,
  "bar-mitzvah":  buildMitzvahPrepTemplate,
  "bnei-mitzvah": buildMitzvahPrepTemplate,
};

export function PrepTab({ eventId, event, adminConfig, showToast, isArchived, isViewer, collaboratorRole, onClergyUpdated, searchHighlight, clearSearchHighlight }) {
  const { items: prep, loading, save, remove } = useEventData(eventId, "prep");

  const [showModal,     setShowModal]     = useState(false);
  const [editItem,      setEditItem]      = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [expandedNotes, setExpandedNotes] = useState({});
  const [editingClergy, setEditingClergy] = useState(null); // "rabbi" | "cantor" | "tutor" | null
  const [clergySaving,  setClergySaving]  = useState(false);

  useSearchHighlight(searchHighlight, clearSearchHighlight, "prep");

  // Owners (collaboratorRole is null/undefined) and coordinators can edit clergy.
  // Editors and viewers cannot.
  const canEditClergy = !isArchived && (collaboratorRole == null || collaboratorRole === "coordinator");

  const saveItem   = async (item) => { await save(item); };
  const handleAdd  = async (item) => { if (isArchived || isViewer) return; await saveItem(item); showToast("Prep item added");   setShowModal(false); };
  const handleEdit = async (item) => { if (isArchived || isViewer) return; await saveItem(item); showToast("Prep item updated"); setEditItem(null);   };
  const handleDelete = async (id) => {
    if (isArchived || isViewer) return;
    const p = prep.find(x => x.id === id);
    if (p) await remove(p._rowId);
    showToast("Prep item deleted");
    setDeleteConfirm(null);
  };

  const toggleNotes = (id) => setExpandedNotes(n => ({ ...n, [id]: !n[id] }));

  const handleStatusChange = async (id, status) => {
    if (isArchived || isViewer) return;
    const p = prep.find(x => x.id === id);
    if (p) await save({ ...p, status, progress: statusToPercent(status) });
  };

  const eventType   = adminConfig?.type;
  const hasTemplate = !!PREP_TEMPLATES[eventType];
  const loadTemplate = async () => {
    if (isArchived || isViewer) return;
    const builder = PREP_TEMPLATES[eventType];
    if (!builder) return;
    const items = builder();
    for (const it of items) await save(it);
    showToast("Template loaded");
  };

  // ── Clergy edit handler (via Supabase RPC, no serverless function) ─────────
  const handleClergySave = async (contactKey, updatedContact) => {
    setClergySaving(true);
    try {
      const rabbi  = contactKey === "rabbi"  ? updatedContact : (adminConfig?.rabbi  || {});
      const cantor = contactKey === "cantor" ? updatedContact : (adminConfig?.cantor || {});
      const tutor  = contactKey === "tutor"  ? updatedContact : (adminConfig?.tutor  || {});

      const { error } = await supabase.rpc("update_clergy", {
        p_event_id: eventId,
        p_rabbi:    rabbi,
        p_cantor:   cantor,
        p_tutor:    tutor,
      });

      if (error) {
        console.error("[SimchaKit] Clergy update error:", error.message);
        showToast(error.message === "Not authorized" ? "Not authorized to update clergy info" : "Could not update clergy info");
        return;
      }

      if (onClergyUpdated) onClergyUpdated({ rabbi, cantor, tutor });
      showToast("Clergy info updated");
      setEditingClergy(null);
    } catch (err) {
      console.error("[SimchaKit] Clergy update error:", err);
      showToast("Could not update clergy info");
    } finally {
      setClergySaving(false);
    }
  };

  // ── Stats ────────────────────────────────────────────────────────────────────
  const total      = prep.length;
  const complete   = prep.filter(x => x.status === "Complete").length;
  const inProgress = prep.filter(x => x.status === "In Progress" || x.status === "Nearly Done").length;
  const notStarted = prep.filter(x => x.status === "Not Started").length;
  const overallPct = total === 0 ? 0 : Math.round(prep.reduce((s, x) => s + statusToPercent(x.status), 0) / total);

  // ── Group by category ────────────────────────────────────────────────────────
  const grouped = {};
  PREP_CATEGORIES.forEach(cat => { grouped[cat] = []; });
  prep.forEach(item => {
    const cat = item.category || "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });
  Object.keys(grouped).forEach(cat => {
    grouped[cat].sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || (a.title || "").localeCompare(b.title || ""));
  });
  const activeCategories = PREP_CATEGORIES.filter(cat => grouped[cat].length > 0);

  const today = new Date(); today.setHours(0, 0, 0, 0);

  if (loading) return <div style={loadingStyle}>Loading preparation items…</div>;

  // ── Clergy data ──────────────────────────────────────────────────────────────
  const cfg       = adminConfig || {};
  const isMitzvah = MITZVAH_TYPES.has(cfg.type);
  const rabbi     = cfg.rabbi  || {};
  const cantor    = cfg.cantor || {};
  const tutor     = cfg.tutor  || {};
  const hasRabbi  = !!(rabbi.name  || rabbi.phone  || rabbi.email);
  const hasCantor = !!(cantor.name || cantor.phone || cantor.email);
  const hasTutor  = !!(tutor.name  || tutor.phone  || tutor.email);
  const hasAnyClergy = hasRabbi || hasCantor || hasTutor;

  return (
    <div className="tab-content">
      {isArchived && <ArchivedNotice />}

      {/* Section header */}
      <div className="section-header">
        <div>
          <div className="section-title">Preparation Tracker</div>
          <div className="section-sub">Track milestones, study progress, and key preparation items.</div>
        </div>
        <button className="btn btn-primary" disabled={isArchived || isViewer} onClick={() => setShowModal(true)}>
          + Add Item
        </button>
      </div>

      {/* Stat cards */}
      {total > 0 && (
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Total Items</div>
          <div className="stat-value">{total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Complete</div>
          <div className="stat-value" style={{ color: "var(--green)" }}>{complete}</div>
          <div className="stat-sub">{total > 0 ? Math.round((complete/total)*100) : 0}% done</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">In Progress</div>
          <div className="stat-value" style={{ color: "var(--blue)" }}>{inProgress}</div>
          <div className="stat-sub">including Nearly Done</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Not Started</div>
          <div className="stat-value" style={{ color: "var(--text-muted)" }}>{notStarted}</div>
        </div>
      </div>
      )}

      {/* Overall progress bar */}
      {total > 0 && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "14px 18px", marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Overall Progress</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-primary)", fontFamily: "var(--font-mono)" }}>{overallPct}%</span>
          </div>
          <div style={{ height: 8, background: "var(--bg-muted)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 99,
              background: overallPct === 100
                ? "var(--green)"
                : "linear-gradient(90deg, var(--accent-primary), var(--accent-medium))",
              width: overallPct + "%",
              transition: "width 0.4s ease",
            }} />
          </div>
        </div>
      )}

      {/* Torah Portion Card (mitzvah events only) */}
      {MITZVAH_TYPES.has(adminConfig?.type) && (
        <TorahPortionCard adminConfig={adminConfig} />
      )}

      {/* Clergy & Tutor contacts (editable for owners and coordinators) */}
      {(hasAnyClergy || canEditClergy) && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "16px 20px", marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>Clergy & Tutor</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {/* Rabbi (always shown if has data or can edit) */}
            {(hasRabbi || canEditClergy) && (
              <PrepContactCard label="Rabbi" icon="✡" contact={rabbi}
                onEdit={canEditClergy ? () => setEditingClergy("rabbi") : null} />
            )}
            {/* Cantor (mitzvah events) */}
            {isMitzvah && (hasCantor || canEditClergy) && (
              <PrepContactCard label="Cantor" icon="🎼" contact={cantor}
                onEdit={canEditClergy ? () => setEditingClergy("cantor") : null} />
            )}
            {/* Tutor (mitzvah events) */}
            {isMitzvah && (hasTutor || canEditClergy) && (
              <PrepContactCard label="Tutor / Madrikh·a" icon="📖" contact={tutor}
                onEdit={canEditClergy ? () => setEditingClergy("tutor") : null} />
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {total === 0 && (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📖</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text-primary)", marginBottom: 8 }}>
            No preparation items yet
          </div>
          <div style={{ fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
            {hasTemplate
              ? "Load the starter checklist for your event type, or add items manually. Track Torah study, rehearsals, speeches, and more."
              : "Add milestones to start tracking progress: rehearsals, speeches, attire, and more."}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            {!isViewer && hasTemplate && (
              <button className="btn btn-secondary" disabled={isArchived || isViewer} onClick={loadTemplate}>✦ Load Template</button>
            )}
            {!isViewer && <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add First Item</button>}
          </div>
        </div>
      )}

      {/* Grouped item cards */}
      {activeCategories.map(cat => (
        <div key={cat} style={{ marginBottom: 28 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            marginBottom: 12, paddingBottom: 8,
            borderBottom: "2px solid var(--border)",
          }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>
              {cat}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
              background: "var(--bg-muted)", borderRadius: 99,
              padding: "2px 8px",
            }}>
              {grouped[cat].length}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {grouped[cat].map(item => {
              const ss  = PREP_STATUS_STYLES[item.status] || PREP_STATUS_STYLES["Not Started"];
              const pct = statusToPercent(item.status);
              const hasNotes = !!(item.notes && item.notes.trim());

              let dateCls = "var(--text-muted)";
              let dueLabel = "";
              if (item.targetDate && item.status !== "Complete") {
                const due  = new Date(item.targetDate + "T00:00:00");
                const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
                if (diff < 0)        { dateCls = "var(--gold)"; dueLabel = "Behind"; }
                else if (diff <= 14) { dateCls = "var(--gold)"; dueLabel = "Due soon"; }
                else                 { dateCls = "var(--green)"; }
              }

              return (
                <div key={item.id || item._rowId} id={`row-${item.id}`} style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "14px 16px",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <span style={{
                        fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600,
                        color: "var(--text-primary)", lineHeight: 1.3,
                      }}>
                        {item.title || "Untitled"}
                      </span>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "3px 10px",
                      borderRadius: 99, whiteSpace: "nowrap", flexShrink: 0,
                      background: ss.bg, color: ss.color,
                    }}>
                      {item.status}
                    </span>
                    <div className="row-actions" style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button className="icon-btn" title="Edit" disabled={isArchived || isViewer} onClick={() => setEditItem(item)}>✎</button>
                      <button className="icon-btn icon-btn-danger" title="Delete" disabled={isArchived || isViewer} onClick={() => setDeleteConfirm(item.id)}>✕</button>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ flex: 1, height: 6, background: "var(--bg-muted)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 99, width: pct + "%",
                        background: pct === 100
                          ? "var(--green)"
                          : "linear-gradient(90deg, var(--accent-primary), var(--accent-medium))",
                        transition: "width 0.3s ease",
                      }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", fontFamily: "var(--font-mono)", minWidth: 32, textAlign: "right" }}>
                      {pct}%
                    </span>
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <select
                      className="form-input"
                      value={item.status}
                      disabled={isArchived || isViewer}
                      onChange={e => handleStatusChange(item.id, e.target.value)}
                      style={{ fontSize: 12, padding: "4px 8px", maxWidth: 200 }}
                    >
                      {PREP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                    {item.targetDate && (
                      <span style={{ fontSize: 12, color: dateCls }}>
                        🎯 Target: {new Date(item.targetDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {dueLabel && (
                          <span style={{ fontWeight: 700, marginLeft: 6 }}>· {dueLabel}</span>
                        )}
                      </span>
                    )}
                    {item.completedDate && item.status === "Complete" && (
                      <span style={{ fontSize: 12, color: "var(--green)" }}>
                        ✓ Completed: {new Date(item.completedDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    )}
                    {hasNotes && (
                      <button
                        className="btn-link"
                        style={{ fontSize: 12, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                        onClick={() => toggleNotes(item.id)}
                      >
                        {expandedNotes[item.id] ? "▴ hide notes" : "▾ notes"}
                      </button>
                    )}
                  </div>

                  {hasNotes && expandedNotes[item.id] && (
                    <div className="task-notes-text" style={{ marginTop: 8 }}>
                      {item.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Add modal */}
      {showModal && (
        <PrepModal onSave={handleAdd} onClose={() => setShowModal(false)} isArchived={isArchived} />
      )}

      {/* Edit modal */}
      {editItem && (
        <PrepModal item={editItem} onSave={handleEdit} onClose={() => setEditItem(null)} isArchived={isArchived} />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) { setDeleteConfirm(null); } }}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Delete Item</div>
              <button className="icon-btn" title="Close" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, color: "var(--text-primary)", marginBottom: 4, lineHeight: 1.6 }}>
                This will permanently remove this preparation item. This cannot be undone.
              </p>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm)}>Delete Item</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clergy edit modal */}
      {editingClergy && (
        <ClergyEditModal
          contactKey={editingClergy}
          label={editingClergy === "rabbi" ? "Rabbi" : editingClergy === "cantor" ? "Cantor" : "Tutor / Madrikh·a"}
          icon={editingClergy === "rabbi" ? "✡" : editingClergy === "cantor" ? "🎼" : "📖"}
          contact={cfg[editingClergy] || {}}
          saving={clergySaving}
          onSave={(updated) => handleClergySave(editingClergy, updated)}
          onClose={() => setEditingClergy(null)}
        />
      )}
    </div>
  );
}

// ── PrepModal ────────────────────────────────────────────────────────────────
export function PrepModal({ item, onSave, onClose, isArchived }) {
  const isEdit = !!item;
  const [form, setForm] = useState(() => item ? { ...item } : {
    id:            newPrepId(),
    title:         "",
    category:      PREP_CATEGORIES[0],
    status:        "Not Started",
    progress:      0,
    targetDate:    "",
    completedDate: "",
    notes:         "",
    order:         0,
  });

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.title.trim()) return;
    onSave({ ...form, title: form.title.trim(), progress: statusToPercent(form.status) });
  };

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? "Edit Preparation Item" : "Add Preparation Item"}</div>
          <button className="icon-btn" title="Close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <label className="form-label">Title *</label>
            <input className="form-input" autoFocus value={form.title}
              onChange={e => setF("title", e.target.value)}
              placeholder="e.g., Torah Portion, First Dance Choreography, Ceremony Rehearsal" />
          </div>
          <div className="form-row two-col">
            <div>
              <label className="form-label">Category</label>
              <select className="form-input" value={form.category} onChange={e => setF("category", e.target.value)}>
                {PREP_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="form-input" value={form.status} onChange={e => setF("status", e.target.value)}>
                {PREP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <label className="form-label">Progress: {statusToPercent(form.status)}%</label>
            <div style={{ height: 6, background: "var(--bg-muted)", borderRadius: 99, overflow: "hidden", marginTop: 6 }}>
              <div style={{
                height: "100%", borderRadius: 99,
                width: statusToPercent(form.status) + "%",
                background: statusToPercent(form.status) === 100
                  ? "var(--green)"
                  : "linear-gradient(90deg, var(--accent-primary), var(--accent-medium))",
                transition: "width 0.2s ease",
              }} />
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
              Progress is set by the status above.
            </div>
          </div>
          <div className="form-row two-col">
            <div>
              <label className="form-label">Target Date</label>
              <input className="form-input" type="date" value={form.targetDate || ""}
                onChange={e => setF("targetDate", e.target.value)} />
            </div>
            <div>
              <label className="form-label">Completed Date</label>
              <input className="form-input" type="date" value={form.completedDate || ""}
                onChange={e => setF("completedDate", e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <label className="form-label">Notes</label>
            <textarea className="form-input notes-area" rows={3}
              value={form.notes || ""}
              onChange={e => setF("notes", e.target.value)}
              placeholder="Tutor feedback, session notes, reminders…" />
          </div>
          <div className="modal-footer">
            <span style={{fontSize:11,color:"var(--text-muted)",marginRight:"auto"}}>* required</span>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={!form.title.trim() || isArchived}>
              {isEdit ? "Save Changes" : "Add Item"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PrepContactCard — contact display with optional edit button ──────────────
function PrepContactCard({ label, icon, contact, onEdit }) {
  const hasData = !!(contact.name || contact.phone || contact.email);

  return (
    <div style={{ flex: "1 1 200px", minWidth: 180 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", flex: 1 }}>
          {icon} {label}
        </div>
        {onEdit && (
          <button className="icon-btn" style={{ fontSize: 12 }} onClick={onEdit} title={`Edit ${label}`}>✎</button>
        )}
      </div>
      {hasData ? (
        <>
          {contact.name  && <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>{contact.name}</div>}
          {contact.phone && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 2 }}>📞 {contact.phone}</div>}
          {contact.email && (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 2 }}>
              ✉ <a href={`mailto:${contact.email}`} style={{ color: "var(--accent-primary)", textDecoration: "none" }}>{contact.email}</a>
            </div>
          )}
          {contact.notes && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, fontStyle: "italic", lineHeight: 1.5 }}>{contact.notes}</div>}
        </>
      ) : onEdit ? (
        <button
          style={{ fontSize: 12, color: "var(--accent-primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          onClick={onEdit}
        >
          + Add {label}
        </button>
      ) : null}
    </div>
  );
}

// ── ClergyEditModal ──────────────────────────────────────────────────────────
function ClergyEditModal({ contactKey, label, icon, contact, saving, onSave, onClose }) {
  const [form, setForm] = useState({
    name:  contact?.name  || "",
    phone: contact?.phone || "",
    email: contact?.email || "",
    notes: contact?.notes || "",
  });
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{icon} Edit {label}</div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" value={form.name} onChange={e => setF("name", e.target.value)} placeholder={`${label} name`} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-input" value={form.phone} onChange={e => setF("phone", e.target.value)} placeholder="Phone number" />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.email} onChange={e => setF("email", e.target.value)} placeholder="Email address" />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <input className="form-input" value={form.notes} onChange={e => setF("notes", e.target.value)} placeholder="Additional notes" />
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={saving} onClick={() => onSave(form)}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const loadingStyle = { padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 };
