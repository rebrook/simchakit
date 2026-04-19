// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — VendorsTab.jsx
// Ported from V2. Uses useEventData for Supabase persistence.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useEventData }       from "@/hooks/useEventData.js";
import { useSearchHighlight } from "@/hooks/useSearchHighlight.js";
import { VENDOR_STATUSES, VENDOR_STATUS_STYLES } from "@/constants/vendor-constants.js";
import { FOLLOW_UP_STATUSES } from "@/constants/ui.js";
import { computeVendorFinancials, getLastContacted, fmt$ } from "@/utils/vendors.js";
import { ArchivedNotice }    from "@/components/shared/ArchivedNotice.jsx";
import { VendorQuickView }   from "@/components/shared/VendorQuickView.jsx";
import { VendorModal }       from "@/components/shared/VendorModal.jsx";

export function VendorsTab({ eventId, event, adminConfig, showToast, isArchived, searchHighlight, clearSearchHighlight }) {
  const { items: vendors, loading, save, remove } = useEventData(eventId, "vendors");
  const { items: expenses }                        = useEventData(eventId, "expenses");

  const [showAdd,    setShowAdd]    = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [quickView,  setQuickView]  = useState(null);
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterType,   setFilterType]   = useState("All");
  const [search,       setSearch]       = useState("");

  useSearchHighlight(searchHighlight, clearSearchHighlight, "vendors");

  const vendorTypes = [...new Set(vendors.map(v => v.type).filter(Boolean))].sort();

  const filtered = vendors.filter(v => {
    if (filterStatus !== "All" && v.status !== filterStatus) return false;
    if (filterType   !== "All" && v.type   !== filterType)   return false;
    if (search) {
      const q = search.toLowerCase();
      if (!v.name?.toLowerCase().includes(q) && !(v.contactName||"").toLowerCase().includes(q) && !(v.notes||"").toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a, b) => (a.name||"").localeCompare(b.name||""));

  const handleSave = async (data) => {
    await save(data);
    setShowAdd(false);
    setEditing(null);
    showToast(editing ? "Vendor updated" : "Vendor added");
  };

  const handleDelete = async (v) => {
    await remove(v._rowId);
    showToast("Vendor removed");
  };

  // Stats
  const booked     = vendors.filter(v => ["Booked","Deposit Paid","Paid in Full"].includes(v.status)).length;
  const totalValue = vendors.reduce((s, v) => s + (parseFloat(v.contractAmt) || 0), 0);
  const totalPaid  = vendors.reduce((s, v) => {
    const fin = computeVendorFinancials(v, expenses);
    return s + fin.totalPaid;
  }, 0);

  if (loading) return <div style={loadingStyle}>Loading vendors…</div>;

  return (
    <div>
      {isArchived && <ArchivedNotice />}

      <div className="section-header">
        <div>
          <div className="section-title">Vendors</div>
          <div className="section-subtitle">{booked} booked · {vendors.length} total · {fmt$(totalPaid)} of {fmt$(totalValue)} paid</div>
        </div>
        {!isArchived && (
          <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setShowAdd(true); }}>
            + Add Vendor
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input className="form-input" type="text" placeholder="Search vendors…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="All">All Statuses</option>
          {VENDOR_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {vendorTypes.length > 0 && (
          <select className="form-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="All">All Types</option>
            {vendorTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      {/* Vendor grid */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)", fontSize: 14 }}>
          {vendors.length === 0 ? "No vendors yet — add your first vendor." : "No vendors match your filters."}
        </div>
      ) : (
        <div className="vendor-grid">
          {filtered.map(v => {
            const fin = computeVendorFinancials(v, expenses);
            const ss  = VENDOR_STATUS_STYLES[v.status] || VENDOR_STATUS_STYLES["Researching"];
            const lc  = getLastContacted(v);
            const needsFollowUp = FOLLOW_UP_STATUSES.has(v.status) && lc.daysAgo !== null && lc.daysAgo > 30;
            return (
              <div key={v.id || v._rowId} id={`row-${v.id}`} className="vendor-card">
                <div className="vendor-card-header">
                  <div>
                    <button className="vendor-name-link" onClick={() => setQuickView(v)}>
                      <div className="vendor-card-name">{v.name}</div>
                    </button>
                    <div className="vendor-card-type">{v.type}</div>
                  </div>
                  <span className="tag" style={{ background: ss.bg, color: ss.color, fontSize: 11 }}>{v.status}</span>
                </div>

                <div className="vendor-card-contacts">
                  {v.contactName && <div className="vendor-contact-row"><span>👤</span>{v.contactName}</div>}
                  {v.phone  && <div className="vendor-contact-row"><span>📞</span><a href={`tel:${v.phone}`}>{v.phone}</a></div>}
                  {v.email  && <div className="vendor-contact-row"><span>✉</span><a href={`mailto:${v.email}`}>{v.email}</a></div>}
                </div>

                {(fin.contractAmt > 0 || fin.totalPaid > 0) && (
                  <div className="vendor-card-financials">
                    <div className="vendor-fin-row">
                      <span>Contract</span>
                      <span className="vendor-fin-val">{fin.contractAmt > 0 ? fmt$(fin.contractAmt) : "—"}</span>
                    </div>
                    <div className="vendor-fin-row">
                      <span>Paid</span>
                      <span className="vendor-fin-val green">{fmt$(fin.totalPaid)}</span>
                    </div>
                    {fin.totalScheduled > 0 && (
                      <div className="vendor-fin-row">
                        <span>Scheduled</span>
                        <span className="vendor-fin-val gold">{fmt$(fin.totalScheduled)}</span>
                      </div>
                    )}
                    {fin.contractAmt > 0 && (
                      <div className="vendor-progress-track">
                        <div className="vendor-progress-fill" style={{ width: `${fin.paidPct}%` }} />
                      </div>
                    )}
                  </div>
                )}

                {v.notes && (
                  <div className="vendor-card-notes">{v.notes}</div>
                )}

                <div className="vendor-card-footer">
                  <div className="vendor-card-date">
                    {lc.daysAgo !== null
                      ? <span style={{ color: needsFollowUp ? "var(--gold)" : "var(--text-muted)" }}>
                          {needsFollowUp ? "⚠ " : ""}Last contact: {lc.daysAgo}d ago
                        </span>
                      : <span style={{ color: "var(--text-muted)" }}>No contact logged</span>
                    }
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setQuickView(v)}>View</button>
                    {!isArchived && (
                      <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(v); setShowAdd(true); }}>✎</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {quickView && (
        <VendorQuickView
          vendor={quickView}
          expenses={expenses}
          onEdit={(v) => { setQuickView(null); setEditing(v); setShowAdd(true); }}
          onClose={() => setQuickView(null)}
          isArchived={isArchived}
        />
      )}

      {showAdd && (
        <VendorModal
          vendor={editing}
          onSave={handleSave}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          isArchived={isArchived}
        />
      )}
    </div>
  );
}

const loadingStyle = { padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 };
