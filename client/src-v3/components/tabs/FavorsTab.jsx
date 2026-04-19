// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — FavorsTab.jsx
// Ported from V2. Uses useEventData for Supabase persistence.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from "react";
import { useEventData }       from "@/hooks/useEventData.js";
import { useSearchHighlight } from "@/hooks/useSearchHighlight.js";
import { SHIRT_SIZES }        from "@/constants/theme.js";
import { newFavorId }         from "@/utils/ids.js";
import { exportFavorsCSV }    from "@/utils/exports.js";
import { ArchivedNotice }     from "@/components/shared/ArchivedNotice.jsx";

export function FavorsTab({ eventId, event, adminConfig, showToast, isArchived, searchHighlight, clearSearchHighlight, setActiveTab }) {
  const { items: favors,     loading: fLoading, save, remove } = useEventData(eventId, "favors");
  const { items: people,     loading: pLoading }                = useEventData(eventId, "people");
  const { items: households, loading: hLoading }                = useEventData(eventId, "households");

  const [showAdd,    setShowAdd]    = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [filterSize, setFilterSize] = useState("All");
  const [filterCat,  setFilterCat]  = useState("All");
  const [search,     setSearch]     = useState("");

  useSearchHighlight(searchHighlight, clearSearchHighlight, "favors");

  // Favor config from adminConfig
  const favorConfig = adminConfig?.favorConfig || {};
  const sizes = (adminConfig?.sizes || []).filter(Boolean).length > 0
    ? adminConfig.sizes
    : SHIRT_SIZES.filter(Boolean);

  // Categories from favors
  const categories = [...new Set(favors.map(f => f.category).filter(Boolean))].sort();

  const filtered = favors.filter(f => {
    if (filterSize !== "All" && f.size !== filterSize) return false;
    if (filterCat  !== "All" && f.category !== filterCat) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!f.personName?.toLowerCase().includes(q) && !(f.nameOnFavor||"").toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a, b) => (a.personName||"").localeCompare(b.personName||""));

  // Size totals
  const sizeCounts = useMemo(() => {
    const counts = {};
    for (const f of favors) {
      if (f.size) counts[f.size] = (counts[f.size] || 0) + 1;
    }
    return counts;
  }, [favors]);

  const handleSave = async (data) => {
    await save(data);
    setShowAdd(false);
    setEditing(null);
    showToast(editing ? "Favor updated" : "Favor added");
  };

  const handleDelete = async (f) => {
    await remove(f._rowId);
    showToast("Favor deleted");
  };

  const handleExport = () => {
    const csv = exportFavorsCSV(favors, favorConfig);
    navigator.clipboard.writeText(csv).then(() => showToast("CSV copied to clipboard"));
  };

  // People list for autocomplete
  const peopleNames = useMemo(() => {
    return people.map(p => [p.firstName, p.lastName].filter(Boolean).join(" ")).filter(Boolean).sort();
  }, [people]);

  if (fLoading || pLoading || hLoading) return <div style={loadingStyle}>Loading favors…</div>;

  return (
    <div>
      {isArchived && <ArchivedNotice />}

      <div className="section-header">
        <div>
          <div className="section-title">Favors</div>
          <div className="section-subtitle">{favors.length} total</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {favors.length > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={handleExport}>↓ Export CSV</button>
          )}
          {!isArchived && (
            <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setShowAdd(true); }}>
              + Add Favor
            </button>
          )}
        </div>
      </div>

      {/* Size totals */}
      {Object.keys(sizeCounts).length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: "var(--text-primary)" }}>Size Totals</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {sizes.map(s => (
              <div key={s} style={{
                padding: "6px 12px", borderRadius: "var(--radius-sm)",
                background: sizeCounts[s] ? "var(--accent-light)" : "var(--bg-subtle)",
                border: `1px solid ${sizeCounts[s] ? "var(--accent-medium)" : "var(--border)"}`,
                textAlign: "center", minWidth: 70,
              }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: sizeCounts[s] ? "var(--accent-primary)" : "var(--text-muted)", fontFamily: "var(--font-display)" }}>
                  {sizeCounts[s] || 0}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>
                  {s.split(" | ")[0]}
                </div>
              </div>
            ))}
            <div style={{ padding: "6px 12px", borderRadius: "var(--radius-sm)", background: "var(--green-light)", border: "1px solid var(--green)", textAlign: "center", minWidth: 70 }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: "var(--green)", fontFamily: "var(--font-display)" }}>{favors.length}</div>
              <div style={{ fontSize: 10, color: "var(--green)", fontWeight: 600 }}>TOTAL</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar">
        <input className="form-input" type="text" placeholder="Search by name…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-select" value={filterSize} onChange={e => setFilterSize(e.target.value)}>
          <option value="All">All Sizes</option>
          {sizes.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {categories.length > 0 && (
          <select className="form-select" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="All">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {/* Favor table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
            {favors.length === 0 ? "No favors tracked yet." : "No favors match your filters."}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)" }}>
                <th style={th}>Name</th>
                <th style={th}>Size</th>
                <th style={th}>Name on Favor</th>
                <th style={th}>Pre-Printed?</th>
                <th style={th}>Attending?</th>
                {!isArchived && <th style={{ ...th, width: 60 }}></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => (
                <tr key={f.id || f._rowId} id={`row-${f.id}`} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ ...td, fontWeight: 600 }}>{f.personName}</td>
                  <td style={td}>
                    <span className="tag" style={{ background: "var(--accent-light)", color: "var(--accent-primary)", fontSize: 11 }}>
                      {f.size ? f.size.split(" | ")[0] : "TBD"}
                    </span>
                  </td>
                  <td style={td}>{f.nameOnFavor || ""}</td>
                  <td style={{ ...td, color: f.prePrinted === true ? "var(--green)" : f.prePrinted === false ? "var(--red)" : "var(--text-muted)", fontWeight: 600 }}>
                    {f.prePrinted === true ? "Yes" : f.prePrinted === false ? "No" : "TBD"}
                  </td>
                  <td style={{ ...td, color: f.attending === true ? "var(--green)" : f.attending === false ? "var(--red)" : "var(--text-muted)", fontWeight: 600 }}>
                    {f.attending === true ? "Yes" : f.attending === false ? "No" : "TBD"}
                  </td>
                  {!isArchived && (
                    <td style={td}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="icon-btn" style={{ width: 26, height: 26 }} title="Edit" onClick={() => { setEditing(f); setShowAdd(true); }}>✎</button>
                        <button className="icon-btn" style={{ width: 26, height: 26 }} title="Delete" onClick={() => handleDelete(f)}>✕</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <FavorModal
          favor={editing}
          peopleNames={peopleNames}
          sizes={sizes}
          onSave={handleSave}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          isArchived={isArchived}
        />
      )}
    </div>
  );
}

// ── FavorModal ────────────────────────────────────────────────────────────────
function FavorModal({ favor, peopleNames, sizes, onSave, onClose, isArchived }) {
  const blank = { id: newFavorId(), personName: "", size: "", nameOnFavor: "", category: "", prePrinted: null, attending: null };
  const [form, setForm] = useState(favor || blank);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const triState = (val) => val === true ? "yes" : val === false ? "no" : "tbd";
  const fromTri  = (str) => str === "yes" ? true : str === "no" ? false : null;

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{favor ? "Edit Favor" : "Add Favor"}</div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Person Name *</label>
            <input className="form-input" list="favor-people" value={form.personName} onChange={e => set("personName", e.target.value)} placeholder="Recipient name" autoFocus />
            <datalist id="favor-people">{peopleNames.map(n => <option key={n} value={n} />)}</datalist>
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Size</label>
              <select className="form-select" value={form.size || ""} onChange={e => set("size", e.target.value)}>
                <option value="">TBD</option>
                {sizes.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Name on Favor</label>
              <input className="form-input" value={form.nameOnFavor || ""} onChange={e => set("nameOnFavor", e.target.value)} placeholder="e.g. Dad, Aunt Ains" />
            </div>
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Pre-Printed?</label>
              <select className="form-select" value={triState(form.prePrinted)} onChange={e => set("prePrinted", fromTri(e.target.value))}>
                <option value="tbd">TBD</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Attending?</label>
              <select className="form-select" value={triState(form.attending)} onChange={e => set("attending", fromTri(e.target.value))}>
                <option value="tbd">TBD</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!form.personName?.trim() || isArchived}
              onClick={() => onSave({ ...form })}>
              {favor ? "Save Changes" : "Add Favor"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const loadingStyle = { padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 };
const th = { padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" };
const td = { padding: "10px 12px", verticalAlign: "middle" };
