import { useState } from "react";
import { useSearchHighlight } from "@/hooks/useSearchHighlight.js";
import { formatAddress } from "@/utils/guests.js";
import { VENDOR_STATUSES, VENDOR_STATUS_STYLES } from "@/constants/vendor-constants.js";
import { FOLLOW_UP_STATUSES } from "@/constants/ui.js";
import { computeVendorFinancials, getLastContacted, fmt$ } from "@/utils/vendors.js";
import { ArchivedNotice } from "@/components/shared/ArchivedNotice.jsx";
import { VendorQuickView } from "@/components/shared/VendorQuickView.jsx";
import { VendorModal } from "@/components/shared/VendorModal.jsx";

export function VendorsTab({ state, updateData, appendAuditLog, isArchived, showToast, searchHighlight, clearSearchHighlight }) {
  const vendors  = state?.vendors  || [];
  const expenses = state?.expenses || [];

  useSearchHighlight(searchHighlight, clearSearchHighlight, "vendors");

  const [showModal,     setShowModal]     = useState(false);
  const [editVendor,    setEditVendor]    = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [filterType,    setFilterType]    = useState("all");
  const [filterStatus,  setFilterStatus]  = useState("all");
  const [filterFollowUp, setFilterFollowUp] = useState(false);
  const [search,        setSearch]        = useState("");
  const [expandedNotes, setExpandedNotes] = useState({});
  const [vendorQuickView, setVendorQuickView] = useState(null);

  const saveVendors = (next) => updateData("vendors", next);

  const handleAdd    = (v) => { if (isArchived) return; saveVendors([...vendors, v]); appendAuditLog("Added", `Added vendor — ${v.name || "Vendor"}`); showToast("Vendor added"); setShowModal(false); };
  const handleEdit   = (v) => { if (isArchived) return; saveVendors(vendors.map(x => x.id === v.id ? v : x)); showToast("Vendor updated"); setEditVendor(null); };
  const handleDelete = (id) => {
    if (isArchived) return;
    const v = vendors.find(x => x.id === id);
    // Also clear vendorId from any linked expenses
    const nextExpenses = expenses.map(e => e.vendorId === id ? {...e, vendorId: ""} : e);
    updateData("expenses", nextExpenses);
    saveVendors(vendors.filter(v => v.id !== id));
    if (v) appendAuditLog("Deleted", `Deleted vendor — ${v.name || "Vendor"}`);
    showToast("Vendor deleted");
    setDeleteConfirm(null);
  };

  const toggleNotes = (id) => setExpandedNotes(n => ({...n, [id]: !n[id]}));

  // ── Derived stats ──────────────────────────────────────────────────────────
  const booked       = vendors.filter(v => ["Booked","Deposit Paid","Paid in Full"].includes(v.status)).length;
  const totalContract = vendors.reduce((s,v) => s + (parseFloat(v.contractAmt)||0), 0);
  const totalPaid     = vendors.reduce((s,v) => {
    return s + computeVendorFinancials(v, expenses).totalPaid;
  }, 0);
  const needsFollowUp = vendors.filter(v => {
    if (!FOLLOW_UP_STATUSES.has(v.status)) return false;
    const { daysAgo } = getLastContacted(v);
    return daysAgo === null || daysAgo >= 60;
  }).length;

  // ── Filters ────────────────────────────────────────────────────────────────
  const usedTypes    = [...new Set(vendors.map(v => v.type).filter(Boolean))].sort();
  const usedStatuses = [...new Set(vendors.map(v => v.status).filter(Boolean))];

  const filtered = vendors.filter(v => {
    if (filterType   !== "all" && v.type   !== filterType)   return false;
    if (filterStatus !== "all" && v.status !== filterStatus) return false;
    if (filterFollowUp) {
      if (!FOLLOW_UP_STATUSES.has(v.status)) return false;
      const { daysAgo } = getLastContacted(v);
      if (!(daysAgo === null || daysAgo >= 60)) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!(v.name||"").toLowerCase().includes(q) &&
          !(v.contactName||"").toLowerCase().includes(q) &&
          !(v.type||"").toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a,b) => {
    // Sort by status lifecycle order, then name
    const sOrder = VENDOR_STATUSES.reduce((acc,s,i) => ({...acc,[s]:i}), {});
    const diff = (sOrder[a.status]??99) - (sOrder[b.status]??99);
    if (diff !== 0) return diff;
    return (a.name||"").localeCompare(b.name||"");
  });

  const fmt = (d) => d ? new Date(d+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "";

  return (
    <div>
      {isArchived && <ArchivedNotice />}
      {/* Section header */}
      <div className="section-header">
        <div>
          <div className="section-title">Vendors</div>
          <div className="section-subtitle">
            {vendors.length} vendor{vendors.length!==1?"s":""} tracked
            {booked > 0 && ` · ${booked} confirmed`}
          </div>
        </div>
        <button className="btn btn-primary btn-sm" disabled={isArchived} onClick={() => setShowModal(true)}>
          + Add Vendor
        </button>
      </div>

      {/* Stat cards */}
      <div className="budget-stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total Vendors</div>
          <div className="stat-value">{vendors.length}</div>
          <div className="stat-sub">{usedTypes.length} type{usedTypes.length!==1?"s":""}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Confirmed</div>
          <div className="stat-value stat-accent">{booked}</div>
          <div className="stat-sub">booked or paid</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Contracted</div>
          <div className="stat-value">{fmt$(totalContract)}</div>
          <div className="stat-sub">across all vendors</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Paid</div>
          <div className="stat-value stat-green">{fmt$(totalPaid)}</div>
          <div className="stat-sub">
            {fmt$(totalContract - totalPaid)} remaining
          </div>
        </div>
        <div className="stat-card" style={{ cursor: needsFollowUp > 0 ? "pointer" : "default" }}
          onClick={() => needsFollowUp > 0 && setFilterFollowUp(f => !f)}>
          <div className="stat-label">Need Follow-up</div>
          <div className={`stat-value ${needsFollowUp > 0 ? "stat-red" : "stat-green"}`}>
            {needsFollowUp}
          </div>
          <div className="stat-sub">
            {needsFollowUp > 0 ? "60+ days or no contact" : "all up to date"}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="filter-bar" style={{marginBottom:0}}>
        <input className="form-input" type="text" placeholder="Search vendors…"
          value={search} onChange={e => setSearch(e.target.value)} />
        {usedTypes.length > 1 && (
          <select className="form-select" value={filterType}
            onChange={e => setFilterType(e.target.value)}>
            <option value="all">All types</option>
            {usedTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {usedStatuses.length > 1 && (
          <select className="form-select" value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}>
            <option value="all">All statuses</option>
            {VENDOR_STATUSES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
        <button
          className={`btn ${filterFollowUp ? "btn-primary" : "btn-secondary"} btn-sm`}
          onClick={() => setFilterFollowUp(f => !f)}
          title="Show only confirmed vendors needing follow-up (60+ days or never contacted)">
          🔔 Needs Follow-up{filterFollowUp ? " ✕" : needsFollowUp > 0 ? ` (${needsFollowUp})` : ""}
        </button>
      </div>

      {/* Empty state */}
      {vendors.length === 0 && (
        <div style={{textAlign:"center",padding:"64px 24px",color:"var(--text-muted)"}}>
          <div style={{fontSize:40,marginBottom:12,opacity:0.4}}>🏪</div>
          <div style={{fontFamily:"var(--font-display)",fontSize:18,marginBottom:6,color:"var(--text-primary)"}}>No vendors yet</div>
          <div style={{fontSize:13,marginBottom:20}}>Add your first vendor to start tracking contracts and payments.</div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Vendor</button>
        </div>
      )}

      {/* No results */}
      {vendors.length > 0 && filtered.length === 0 && (
        <div style={{textAlign:"center",padding:"32px 16px",color:"var(--text-muted)",fontSize:13,marginTop:16}}>
          No vendors match your filters.
        </div>
      )}

      {/* Vendor cards */}
      {filtered.length > 0 && (
        <div className="vendor-grid">
          {filtered.map(v => {
            const fin = computeVendorFinancials(v, expenses);
            const sc  = VENDOR_STATUS_STYLES[v.status] || VENDOR_STATUS_STYLES["Researching"];
            const notesExpanded = expandedNotes[v.id];

            return (
              <div key={v.id} id={`row-${v.id}`} className="vendor-card">
                {/* Header */}
                <div className="vendor-card-header">
                  <div style={{minWidth:0}}>
                    <button className="vendor-name-link vendor-card-name"
                      onClick={() => setVendorQuickView(v)}>
                      {v.name}
                    </button>
                    <div className="vendor-card-type">{v.type}</div>
                  </div>
                  <span className="tag" style={{background:sc.bg, color:sc.color, flexShrink:0}}>
                    {v.status}
                  </span>
                </div>

                {/* Contacts */}
                {(v.contactName || v.phone || v.email || v.website) && (
                  <div className="vendor-card-contacts">
                    {v.contactName && (
                      <div className="vendor-contact-row">
                        <span style={{fontSize:12}}>👤</span>
                        <span>{v.contactName}</span>
                      </div>
                    )}
                    {v.phone && (
                      <div className="vendor-contact-row">
                        <span style={{fontSize:12}}>📞</span>
                        <a href={`tel:${v.phone}`}>{v.phone}</a>
                      </div>
                    )}
                    {v.email && (
                      <div className="vendor-contact-row">
                        <span style={{fontSize:12}}>✉</span>
                        <a href={`mailto:${v.email}`}>{v.email}</a>
                      </div>
                    )}
                    {v.website && (
                      <div className="vendor-contact-row">
                        <span style={{fontSize:12}}>🌐</span>
                        <a href={v.website} target="_blank" rel="noopener noreferrer">
                          {v.website.replace(/^https?:\/\/(www\.)?/,"")}
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Financials */}
                <div className="vendor-card-financials">
                  <div className="vendor-fin-row">
                    <span>Contract</span>
                    <span className="vendor-fin-val">
                      {fin.contractAmt > 0 ? fmt$(fin.contractAmt) : "—"}
                    </span>
                  </div>
                  <div className="vendor-fin-row">
                    <span>Paid</span>
                    <span className="vendor-fin-val green">{fmt$(fin.totalPaid)}</span>
                  </div>
                  <div className="vendor-fin-row">
                    <span>Scheduled</span>
                    <span className="vendor-fin-val gold">{fmt$(fin.totalScheduled)}</span>
                  </div>
                  {fin.contractAmt > 0 && fin.unscheduled > 0 && (
                    <div className="vendor-fin-row">
                      <span>Unscheduled</span>
                      <span className="vendor-fin-val red">{fmt$(fin.unscheduled)}</span>
                    </div>
                  )}
                  {fin.contractAmt > 0 && (
                    <>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:8, marginBottom:2 }}>
                        <span style={{ fontSize:11, color:"var(--text-muted)" }}>
                          {fmt$(fin.totalPaid)} of {fmt$(fin.contractAmt)} paid
                        </span>
                        <span style={{ fontSize:11, fontWeight:700, color: fin.paidPct >= 100 ? "var(--green)" : "var(--text-muted)" }}>
                          {Math.round(fin.paidPct)}%
                        </span>
                      </div>
                      <div className="vendor-progress-track">
                        <div className="vendor-progress-fill"
                          style={{width:`${fin.paidPct}%`}} />
                      </div>
                    </>
                  )}
                  {fin.linkedCount === 0 && (
                    <div style={{fontSize:11,color:"var(--text-muted)",marginTop:6,fontStyle:"italic"}}>
                      No expenses linked — add expenses in the Budget tab
                    </div>
                  )}
                </div>

                {/* Notes */}
                {v.notes && (
                  <div
                    className={`vendor-card-notes ${notesExpanded ? "expanded" : ""}`}
                    onClick={() => toggleNotes(v.id)}
                    style={{cursor:"pointer"}}
                    title={notesExpanded ? "Click to collapse" : "Click to expand"}
                  >
                    {v.notes}
                  </div>
                )}

                {/* Last contacted */}
                {FOLLOW_UP_STATUSES.has(v.status) && (() => {
                  const { date, daysAgo } = getLastContacted(v);
                  const isPaidStatus = v.status === "Deposit Paid" || v.status === "Paid in Full";
                  const stale = daysAgo === null ? !isPaidStatus : daysAgo >= 60; // Not stale if paid but no log
                  const warm  = daysAgo !== null && daysAgo < 30;
                  const noLog = daysAgo === null;
                  const color = noLog && isPaidStatus ? "var(--text-muted)" : warm ? "var(--green)" : stale ? "var(--red)" : "var(--gold)";
                  const label = date
                    ? `Last contact: ${fmt(date)} (${daysAgo}d ago)`
                    : isPaidStatus ? "No contact log" : "Never contacted";
                  const icon = noLog && isPaidStatus ? "📋" : stale ? "🔔" : warm ? "✓" : "⏱";
                  return (
                    <div style={{ fontSize:11, color, fontWeight:600, marginTop:6,
                      display:"flex", alignItems:"center", gap:5 }}>
                      <span>{icon}</span>
                      {label}
                    </div>
                  );
                })()}

                {/* Footer */}
                <div className="vendor-card-footer">
                  <div className="vendor-card-date">
                    {v.contractDate ? `Signed ${fmt(v.contractDate)}` : formatAddress(v) || ""}
                  </div>
                  <div style={{display:"flex",gap:4,alignItems:"center"}}>
                    {v.contractUrl && (
                      <a href={v.contractUrl} target="_blank" rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{fontSize:11,padding:"3px 10px",gap:4}}
                        title="Open contract in new tab">
                        📄 Contract
                      </a>
                    )}
                    <button className="icon-btn" title="Edit"
                      style={{width:28,height:28,fontSize:13}}
                      disabled={isArchived} onClick={() => setEditVendor(v)}>✎</button>
                    <button className="icon-btn" title="Delete"
                      style={{width:28,height:28,fontSize:13,color:"var(--red)"}}
                      disabled={isArchived} onClick={() => setDeleteConfirm(v.id)}>✕</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add modal */}
      {showModal && (
        <VendorModal onSave={handleAdd} onClose={() => setShowModal(false)} isArchived={isArchived} />
      )}

      {/* Edit modal */}
      {editVendor && (
        <VendorModal vendor={editVendor} onSave={handleEdit} onClose={() => setEditVendor(null)} isArchived={isArchived} />
      )}

      {/* Quick-view modal */}
      {vendorQuickView && (
        <VendorQuickView
          vendor={vendorQuickView}
          expenses={expenses}
          onEdit={(v) => { setEditVendor(v); }}
          onClose={() => setVendorQuickView(null)}
          isArchived={isArchived}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) { setDeleteConfirm(null); } }}>
          <div className="modal" style={{maxWidth:400}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Delete Vendor</div>
              <button className="icon-btn" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{fontSize:14,color:"var(--text-primary)",marginBottom:4,lineHeight:1.6}}>
                This will permanently remove this vendor. Any expenses linked to this vendor will be unlinked but not deleted.
              </p>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm)}>Delete Vendor</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
