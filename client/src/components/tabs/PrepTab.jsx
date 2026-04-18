import { useState } from "react";
import { useSearchHighlight } from "@/hooks/useSearchHighlight.js";
import { MITZVAH_TYPES } from "@/constants/events.js";
import { PREP_CATEGORIES, PREP_STATUSES, PREP_STATUS_STYLES } from "@/constants/prep.js";
import { newPrepId } from "@/utils/ids.js";
import { ArchivedNotice } from "@/components/shared/ArchivedNotice.jsx";
import { TorahPortionCard } from "@/components/shared/TorahPortionCard.jsx";

export function PrepTab({ state, updateData, isArchived, showToast, searchHighlight, clearSearchHighlight }) {
  const prep = state?.prep || [];

  useSearchHighlight(searchHighlight, clearSearchHighlight, "prep");

  const [showModal,     setShowModal]     = useState(false);
  const [editItem,      setEditItem]      = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [expandedNotes, setExpandedNotes] = useState({});

  const savePrep = (next) => updateData("prep", next);

  const handleAdd    = (item) => { if (isArchived) return; savePrep([...prep, item]);                              showToast("Prep item added");   setShowModal(false); };
  const handleEdit   = (item) => { if (isArchived) return; savePrep(prep.map(x => x.id === item.id ? item : x)); showToast("Prep item updated"); setEditItem(null);   };
  const handleDelete = (id)   => { if (isArchived) return; savePrep(prep.filter(x => x.id !== id));               showToast("Prep item deleted"); setDeleteConfirm(null); };
  const toggleNotes  = (id)   => setExpandedNotes(n => ({ ...n, [id]: !n[id] }));

  // Inline progress slider — auto-derive status from new progress value
  const handleProgressChange = (id, val) => {
    if (isArchived) return;
    const pct = parseInt(val, 10);
    let status = "Not Started";
    if (pct === 100)      status = "Complete";
    else if (pct >= 50)   status = "Nearly Done";
    else if (pct >= 1)    status = "In Progress";
    savePrep(prep.map(x => x.id === id ? { ...x, progress: pct, status } : x));
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const total      = prep.length;
  const complete   = prep.filter(x => x.status === "Complete").length;
  const inProgress = prep.filter(x => x.status === "In Progress" || x.status === "Nearly Done").length;
  const notStarted = prep.filter(x => x.status === "Not Started").length;
  const overallPct = total === 0 ? 0 : Math.round(prep.reduce((s, x) => s + (x.progress || 0), 0) / total);

  // ── Group by category ──────────────────────────────────────────────────────
  const grouped = {};
  PREP_CATEGORIES.forEach(cat => { grouped[cat] = []; });
  prep.forEach(item => {
    const cat = item.category || "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });
  // Sort items within each category by order field, then by title
  Object.keys(grouped).forEach(cat => {
    grouped[cat].sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || (a.title || "").localeCompare(b.title || ""));
  });
  const activeCategories = PREP_CATEGORIES.filter(cat => grouped[cat].length > 0);

  const today = new Date(); today.setHours(0, 0, 0, 0);

  return (
    <div className="tab-content">
      {isArchived && <ArchivedNotice />}
      {/* ── Header ── */}
      <div className="section-header">
        <div>
          <div className="section-title">Preparation Tracker</div>
          <div className="section-sub">Track milestones, study progress, and key preparation items.</div>
        </div>
        <button className="btn btn-primary" disabled={isArchived} onClick={() => setShowModal(true)}>
          + Add Item
        </button>
      </div>

      {/* ── Stat cards ── */}
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

      {/* ── Overall progress bar ── */}
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

      {/* ── Torah Portion Card (mitzvah events only) ── */}
      {MITZVAH_TYPES.has(state?.adminConfig?.type) && (
        <TorahPortionCard adminConfig={state.adminConfig} />
      )}

      {/* ── Clergy & Tutor contacts ── */}
      {(() => {
        const cfg         = state?.adminConfig || {};
        const isMitzvah   = MITZVAH_TYPES.has(cfg.type);
        const rabbi       = cfg.rabbi  || {};
        const cantor      = cfg.cantor || {};
        const tutor       = cfg.tutor  || {};
        const hasRabbi    = !!(rabbi.name  || rabbi.phone  || rabbi.email);
        const hasCantor   = !!(cantor.name || cantor.phone || cantor.email);
        const hasTutor    = !!(tutor.name  || tutor.phone  || tutor.email);
        if (!hasRabbi && !hasCantor && !hasTutor) return null;
        return (
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "16px 20px", marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>Clergy & Tutor</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
              {hasRabbi  && <PrepContactCard label="Rabbi"              icon="✡"  contact={rabbi}  />}
              {hasCantor && isMitzvah && <PrepContactCard label="Cantor" icon="🎼" contact={cantor} />}
              {hasTutor  && isMitzvah && <PrepContactCard label="Tutor / Madrikh·a" icon="📖" contact={tutor} />}
            </div>
          </div>
        );
      })()}

      {/* ── Empty state ── */}
      {total === 0 && (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📖</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text-primary)", marginBottom: 8 }}>
            No preparation items yet
          </div>
          <div style={{ fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
            Add milestones to start tracking progress — Torah study, rehearsals, speeches, attire, and more.
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add First Item</button>
        </div>
      )}

      {/* ── Grouped item cards ── */}
      {activeCategories.map(cat => (
        <div key={cat} style={{ marginBottom: 28 }}>
          {/* Category header */}
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

          {/* Item cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {grouped[cat].map(item => {
              const ss  = PREP_STATUS_STYLES[item.status] || PREP_STATUS_STYLES["Not Started"];
              const pct = item.progress || 0;
              const hasNotes = !!(item.notes && item.notes.trim());

              // Target date coloring
              let dateCls = "var(--text-muted)";
              if (item.targetDate && item.status !== "Complete") {
                const due  = new Date(item.targetDate + "T00:00:00");
                const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
                if (diff < 0)      dateCls = "var(--red)";
                else if (diff <= 14) dateCls = "var(--gold)";
                else                 dateCls = "var(--green)";
              }

              return (
                <div key={item.id} id={`row-${item.id}`} style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "14px 16px",
                }}>
                  {/* Row 1: title + status badge + actions */}
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
                      <button className="icon-btn" title="Edit" disabled={isArchived} onClick={() => setEditItem(item)}>✎</button>
                      <button className="icon-btn icon-btn-danger" title="Delete" disabled={isArchived} onClick={() => setDeleteConfirm(item.id)}>✕</button>
                    </div>
                  </div>

                  {/* Row 2: progress bar + percentage */}
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

                  {/* Row 3: inline progress slider */}
                  <div style={{ marginBottom: 8 }}>
                    <input
                      type="range" min="0" max="100" value={pct}
                      onChange={e => handleProgressChange(item.id, e.target.value)}
                      style={{
                        width: "100%", height: 4, cursor: "pointer",
                        accentColor: "var(--accent-primary)",
                      }}
                    />
                  </div>

                  {/* Row 4: meta — target date + completed date + notes toggle */}
                  <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                    {item.targetDate && (
                      <span style={{ fontSize: 12, color: dateCls }}>
                        🎯 Target: {new Date(item.targetDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
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
                  {/* Row 5: expanded notes */}
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

      {/* ── Add modal ── */}
      {showModal && (
        <PrepModal onSave={handleAdd} onClose={() => setShowModal(false)} isArchived={isArchived} />
      )}

      {/* ── Edit modal ── */}
      {editItem && (
        <PrepModal item={editItem} onSave={handleEdit} onClose={() => setEditItem(null)} isArchived={isArchived} />
      )}

      {/* ── Delete confirm ── */}
      {deleteConfirm && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) { setDeleteConfirm(null); } }}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Delete Item</div>
              <button className="icon-btn" onClick={() => setDeleteConfirm(null)}>✕</button>
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
    </div>
  );
}

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

  // When progress changes in the modal, auto-derive status
  const handleProgressInput = (val) => {
    const pct = Math.min(100, Math.max(0, parseInt(val, 10) || 0));
    let status = "Not Started";
    if (pct === 100)    status = "Complete";
    else if (pct >= 50) status = "Nearly Done";
    else if (pct >= 1)  status = "In Progress";
    setForm(f => ({ ...f, progress: pct, status }));
  };

  const handleSave = () => {
    if (!form.title.trim()) return;
    onSave({ ...form, title: form.title.trim() });
  };

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? "Edit Preparation Item" : "Add Preparation Item"}</div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">

          {/* Title */}
          <div className="form-row">
            <label className="form-label">Title *</label>
            <input
              className="form-input" autoFocus
              value={form.title}
              onChange={e => setF("title", e.target.value)}
              placeholder="e.g., Torah Portion, First Dance Choreography, Ceremony Rehearsal"
            />
          </div>

          {/* Category + Status */}
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

          {/* Progress */}
          <div className="form-row">
            <label className="form-label">Progress — {form.progress}%</label>
            <input
              type="range" min="0" max="100" value={form.progress}
              onChange={e => handleProgressInput(e.target.value)}
              style={{ width: "100%", accentColor: "var(--accent-primary)", cursor: "pointer" }}
            />
            <div style={{ height: 6, background: "var(--bg-muted)", borderRadius: 99, overflow: "hidden", marginTop: 6 }}>
              <div style={{
                height: "100%", borderRadius: 99,
                width: form.progress + "%",
                background: form.progress === 100
                  ? "var(--green)"
                  : "linear-gradient(90deg, var(--accent-primary), var(--accent-medium))",
                transition: "width 0.2s ease",
              }} />
            </div>
          </div>

          {/* Target Date + Completed Date */}
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

          {/* Notes */}
          <div className="form-row">
            <label className="form-label">Notes</label>
            <textarea className="form-input notes-area" rows={3}
              value={form.notes || ""}
              onChange={e => setF("notes", e.target.value)}
              placeholder="Tutor feedback, session notes, reminders…"
            />
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

// ── PrepContactCard — read-only contact display on Prep tab ──────────────
function PrepContactCard({ label, icon, contact }) {
  return (
    <div style={{ flex: "1 1 200px", minWidth: 180 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
        {icon} {label}
      </div>
      {contact.name  && <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>{contact.name}</div>}
      {contact.phone && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 2 }}>📞 {contact.phone}</div>}
      {contact.email && (
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 2 }}>
          ✉ <a href={`mailto:${contact.email}`} style={{ color: "var(--accent-primary)", textDecoration: "none" }}>{contact.email}</a>
        </div>
      )}
      {contact.notes && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, fontStyle: "italic", lineHeight: 1.5 }}>{contact.notes}</div>}
    </div>
  );
}
