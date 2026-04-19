// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — PrepTab.jsx
// Ported from V2. Uses useEventData for Supabase persistence.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useEventData }       from "@/hooks/useEventData.js";
import { useSearchHighlight } from "@/hooks/useSearchHighlight.js";
import { MITZVAH_TYPES }      from "@/constants/events.js";
import { PREP_CATEGORIES, PREP_STATUSES, PREP_STATUS_STYLES } from "@/constants/prep.js";
import { newPrepId }          from "@/utils/ids.js";
import { ArchivedNotice }     from "@/components/shared/ArchivedNotice.jsx";
import { TorahPortionCard }   from "@/components/shared/TorahPortionCard.jsx";

export function PrepTab({ eventId, event, adminConfig, showToast, isArchived, searchHighlight, clearSearchHighlight }) {
  const { items: prep, loading, save, remove } = useEventData(eventId, "prep");

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterCat, setFilterCat] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [search, setSearch] = useState("");

  useSearchHighlight(searchHighlight, clearSearchHighlight, "prep");

  const isMitzvah = MITZVAH_TYPES.has(adminConfig?.type);

  const filtered = prep.filter(p => {
    if (filterCat !== "All" && p.category !== filterCat) return false;
    if (filterStatus !== "All" && p.status !== filterStatus) return false;
    if (search && !p.item?.toLowerCase().includes(search.toLowerCase()) && !(p.notes||"").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleSave = async (data) => {
    await save(data);
    setShowAdd(false);
    setEditing(null);
    showToast(editing ? "Item updated" : "Item added");
  };

  const handleDelete = async (p) => {
    await remove(p._rowId);
    showToast("Item deleted");
  };

  const handleProgressUpdate = async (p, field, value) => {
    await save({ ...p, [field]: value });
  };

  if (loading) return <div style={loadingStyle}>Loading preparation items…</div>;

  return (
    <div>
      {isArchived && <ArchivedNotice />}

      {isMitzvah && <TorahPortionCard adminConfig={adminConfig} />}

      <div className="section-header">
        <div>
          <div className="section-title">Preparation</div>
          <div className="section-subtitle">
            {prep.filter(p => p.status === "Complete").length} of {prep.length} complete
          </div>
        </div>
        {!isArchived && (
          <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setShowAdd(true); }}>
            + Add Item
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input className="form-input" type="text" placeholder="Search prep items…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-select" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="All">All Categories</option>
          {PREP_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="All">All Statuses</option>
          {PREP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Prep items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)", fontSize: 14 }}>
            {prep.length === 0 ? "No preparation items yet — add your first item." : "No items match your filters."}
          </div>
        ) : (
          filtered.map(p => {
            const ss = PREP_STATUS_STYLES[p.status] || PREP_STATUS_STYLES["Not Started"];
            const progress = Math.min(100, Math.max(0, parseInt(p.progress) || 0));
            return (
              <div key={p.id || p._rowId} id={`row-${p.id}`} className="card" style={{ padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)", marginBottom: 3 }}>{p.item}</div>
                    {p.category && <span className="tag tag-muted" style={{ fontSize: 10 }}>{p.category}</span>}
                    {p.targetDate && (
                      <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>
                        Target: {new Date(p.targetDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <select
                      value={p.status || "Not Started"}
                      onChange={e => !isArchived && handleProgressUpdate(p, "status", e.target.value)}
                      disabled={isArchived}
                      style={{ padding: "3px 8px", borderRadius: 20, border: "none", fontSize: 11, fontWeight: 700, cursor: isArchived ? "default" : "pointer", outline: "none", background: ss.bg, color: ss.color }}
                    >
                      {PREP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {!isArchived && (<>
                      <button className="icon-btn" style={{ width: 26, height: 26 }} title="Edit" onClick={() => { setEditing(p); setShowAdd(true); }}>✎</button>
                      <button className="icon-btn" style={{ width: 26, height: 26 }} title="Delete" onClick={() => handleDelete(p)}>✕</button>
                    </>)}
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: p.notes ? 8 : 0 }}>
                  <div style={{ flex: 1, height: 8, background: "var(--bg-muted)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, var(--accent-medium), var(--accent-primary))", borderRadius: 4, transition: "width 0.3s ease" }} />
                  </div>
                  <input
                    type="number" min="0" max="100" value={progress}
                    onChange={e => !isArchived && handleProgressUpdate(p, "progress", Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                    disabled={isArchived}
                    style={{ width: 48, padding: "2px 6px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 12, textAlign: "center", background: "var(--bg-subtle)", color: "var(--text-primary)" }}
                  />
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>%</span>
                </div>

                {p.notes && <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 4 }}>{p.notes}</div>}
              </div>
            );
          })
        )}
      </div>

      {showAdd && (
        <PrepModal
          item={editing}
          onSave={handleSave}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          isArchived={isArchived}
        />
      )}
    </div>
  );
}

// ── PrepModal ─────────────────────────────────────────────────────────────────
export function PrepModal({ item, onSave, onClose, isArchived }) {
  const blank = { id: newPrepId(), item: "", category: "Religious Study", status: "Not Started", progress: 0, targetDate: "", notes: "" };
  const [form, setForm] = useState(item || blank);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{item ? "Edit Item" : "Add Prep Item"}</div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Item *</label>
            <input className="form-input" value={form.item} onChange={e => set("item", e.target.value)} placeholder="e.g. Torah portion study" autoFocus />
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={form.category} onChange={e => set("category", e.target.value)}>
                {PREP_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e => set("status", e.target.value)}>
                {PREP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Progress (%)</label>
              <input className="form-input" type="number" min="0" max="100" value={form.progress || 0} onChange={e => set("progress", Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))} />
            </div>
            <div className="form-group">
              <label className="form-label">Target Date</label>
              <input className="form-input" type="date" value={form.targetDate || ""} onChange={e => set("targetDate", e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.notes || ""} onChange={e => set("notes", e.target.value)} placeholder="Tutor feedback, session notes…" />
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!form.item?.trim() || isArchived}
              onClick={() => onSave({ ...form })}>
              {item ? "Save Changes" : "Add Item"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const loadingStyle = { padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 };
