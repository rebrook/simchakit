// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — GiftsTab.jsx
// Ported from V2. Uses useEventData for Supabase persistence.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useEventData }       from "@/hooks/useEventData.js";
import { useSearchHighlight } from "@/hooks/useSearchHighlight.js";
import { GIFT_TYPES }         from "@/constants/gifts.js";
import { newGiftId }          from "@/utils/ids.js";
import { exportGiftsCSV }     from "@/utils/exports.js";
import { ArchivedNotice }     from "@/components/shared/ArchivedNotice.jsx";

export function GiftsTab({ eventId, event, adminConfig, showToast, isArchived, searchHighlight, clearSearchHighlight }) {
  const { items: gifts,      loading: gLoading, save, remove } = useEventData(eventId, "gifts");
  const { items: households, loading: hLoading }                = useEventData(eventId, "households");

  const [showAdd,      setShowAdd]      = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [filterTY,     setFilterTY]     = useState("All");
  const [filterType,   setFilterType]   = useState("All");
  const [search,       setSearch]       = useState("");

  useSearchHighlight(searchHighlight, clearSearchHighlight, "gifts");

  const filtered = gifts.filter(g => {
    if (filterTY === "pending" && g.thankYouSent) return false;
    if (filterTY === "sent"    && !g.thankYouSent) return false;
    if (filterType !== "All" && g.type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!g.from?.toLowerCase().includes(q) && !(g.description||"").toLowerCase().includes(q) && !(g.notes||"").toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a, b) => {
    if (a.thankYouSent !== b.thankYouSent) return a.thankYouSent ? 1 : -1;
    return (b.dateReceived || "").localeCompare(a.dateReceived || "");
  });

  // Stats
  const totalCash    = gifts.filter(g => g.type === "Cash / Check" || g.type === "Cash/Check").reduce((s, g) => s + (parseFloat(g.amount) || 0), 0);
  const tyPending    = gifts.filter(g => !g.thankYouSent).length;
  const tySent       = gifts.filter(g => g.thankYouSent).length;

  const toggleTY = async (gift) => {
    await save({ ...gift, thankYouSent: !gift.thankYouSent });
    showToast(gift.thankYouSent ? "Marked as pending" : "Thank you sent ✓");
  };

  const handleSave = async (data) => {
    await save(data);
    setShowAdd(false);
    setEditing(null);
    showToast(editing ? "Gift updated" : "Gift recorded");
  };

  const handleDelete = async (g) => {
    await remove(g._rowId);
    showToast("Gift deleted");
  };

  const handleExport = () => {
    const csv = exportGiftsCSV(gifts, households);
    navigator.clipboard.writeText(csv).then(() => showToast("CSV copied to clipboard"));
  };

  if (gLoading || hLoading) return <div style={loadingStyle}>Loading gifts…</div>;

  // Guest name suggestions from households
  const guestNames = households.map(h => h.displayName || h.name || "").filter(Boolean).sort();

  return (
    <div>
      {isArchived && <ArchivedNotice />}

      <div className="section-header">
        <div>
          <div className="section-title">Gifts</div>
          <div className="section-subtitle">
            {gifts.length} recorded · ${totalCash.toLocaleString()} cash/checks · {tyPending} thank-you{tyPending !== 1 ? "s" : ""} pending
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {gifts.length > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={handleExport}>↓ Export CSV</button>
          )}
          {!isArchived && (
            <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setShowAdd(true); }}>
              + Add Gift
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total Gifts</div>
          <div className="stat-value">{gifts.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cash / Checks</div>
          <div className="stat-value stat-green">${totalCash.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Thank Yous Pending</div>
          <div className="stat-value" style={{ color: tyPending > 0 ? "var(--gold)" : "var(--text-primary)" }}>{tyPending}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Thank Yous Sent</div>
          <div className="stat-value stat-green">{tySent}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input className="form-input" type="text" placeholder="Search gifts…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-select" value={filterTY} onChange={e => setFilterTY(e.target.value)}>
          <option value="All">All Gifts</option>
          <option value="pending">Needs Thank You</option>
          <option value="sent">Thank You Sent</option>
        </select>
        <select className="form-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="All">All Types</option>
          {GIFT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Gift list */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
            {gifts.length === 0 ? "No gifts recorded yet." : "No gifts match your filters."}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)" }}>
                <th style={th}>✓ TY</th>
                <th style={th}>From</th>
                <th style={th}>Type</th>
                <th style={th}>Amount</th>
                <th style={th}>Date</th>
                <th style={th}>Notes</th>
                {!isArchived && <th style={{ ...th, width: 60 }}></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(g => (
                <tr key={g.id || g._rowId} id={`row-${g.id}`}
                  style={{ borderBottom: "1px solid var(--border)", background: g.thankYouSent ? "var(--green-light)" : "var(--bg-surface)", opacity: g.thankYouSent ? 0.75 : 1 }}>
                  <td style={{ ...td, textAlign: "center" }}>
                    <div className={`paid-check ${g.thankYouSent ? "checked" : ""}`}
                      onClick={() => !isArchived && toggleTY(g)}>
                      {g.thankYouSent && <svg width="10" height="8" viewBox="0 0 10 8"><polyline points="1,4 4,7 9,1" stroke="white" strokeWidth="1.5" fill="none"/></svg>}
                    </div>
                  </td>
                  <td style={{ ...td, fontWeight: 600 }}>{g.from}</td>
                  <td style={td}>{g.type}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{g.amount ? `$${parseFloat(g.amount).toLocaleString()}` : ""}</td>
                  <td style={td}>{g.dateReceived ? new Date(g.dateReceived + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</td>
                  <td style={{ ...td, color: "var(--text-muted)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.notes || g.description || ""}</td>
                  {!isArchived && (
                    <td style={td}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="icon-btn" style={{ width: 26, height: 26 }} title="Edit" onClick={() => { setEditing(g); setShowAdd(true); }}>✎</button>
                        <button className="icon-btn" style={{ width: 26, height: 26 }} title="Delete" onClick={() => handleDelete(g)}>✕</button>
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
        <GiftModal
          gift={editing}
          guestNames={guestNames}
          onSave={handleSave}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          isArchived={isArchived}
        />
      )}
    </div>
  );
}

// ── GiftModal ─────────────────────────────────────────────────────────────────
function GiftModal({ gift, guestNames, onSave, onClose, isArchived }) {
  const blank = { id: newGiftId(), from: "", type: "Cash / Check", description: "", amount: "", dateReceived: "", thankYouSent: false, notes: "" };
  const [form, setForm] = useState(gift || blank);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{gift ? "Edit Gift" : "Add Gift"}</div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">From *</label>
            <input className="form-input" list="gift-names" value={form.from} onChange={e => set("from", e.target.value)} placeholder="Who is the gift from?" autoFocus />
            <datalist id="gift-names">{guestNames.map(n => <option key={n} value={n} />)}</datalist>
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Gift Type</label>
              <select className="form-select" value={form.type} onChange={e => set("type", e.target.value)}>
                {GIFT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Amount ($)</label>
              <input className="form-input" type="number" min="0" step="0.01" value={form.amount || ""} onChange={e => set("amount", e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-input" value={form.description || ""} onChange={e => set("description", e.target.value)} placeholder="e.g. Amazon gift card, Israel bond" />
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Date Received</label>
              <input className="form-input" type="date" value={form.dateReceived || ""} onChange={e => set("dateReceived", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Thank You Sent?</label>
              <select className="form-select" value={form.thankYouSent ? "yes" : "no"} onChange={e => set("thankYouSent", e.target.value === "yes")}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.notes || ""} onChange={e => set("notes", e.target.value)} placeholder="Card message, etc." />
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!form.from?.trim() || isArchived}
              onClick={() => onSave({ ...form })}>
              {gift ? "Save Changes" : "Add Gift"}
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
