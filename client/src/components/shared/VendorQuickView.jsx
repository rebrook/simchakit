import { VENDOR_STATUS_STYLES } from "@/constants/vendor-constants.js";
import { computeVendorFinancials, fmt$ } from "@/utils/vendors.js";

export function VendorQuickView({ vendor, expenses, onEdit, onClose, isArchived }) {
  const fin = computeVendorFinancials(vendor, expenses);
  const sc  = VENDOR_STATUS_STYLES[vendor.status] || VENDOR_STATUS_STYLES["Researching"];
  const fmt = (d) => d ? new Date(d+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "";

  const hasContact = vendor.contactName || vendor.phone || vendor.email ||
                     vendor.website     || vendor.address;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" style={{maxWidth:520,padding:0,overflow:"hidden"}}
        onClick={e => e.stopPropagation()}>

        {/* Colored header */}
        <div className="vqv-header">
          <button className="vqv-close" onClick={onClose}>✕</button>
          <div className="vqv-header-name">{vendor.name}</div>
          <div className="vqv-header-badges">
            <span className="vqv-header-badge">{vendor.type}</span>
            <span className="vqv-header-badge" style={{
              background: vendor.status==="Paid in Full" ? "rgba(74,222,128,0.3)" :
                          vendor.status==="Cancelled"    ? "rgba(248,113,113,0.3)" :
                          "rgba(255,255,255,0.2)"
            }}>{vendor.status}</span>
            {vendor.contractDate && (
              <span className="vqv-header-badge">Signed {fmt(vendor.contractDate)}</span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="vqv-body" style={{maxHeight:"60vh",overflowY:"auto"}}>

          {/* Contact info */}
          {hasContact && (
            <div className="vqv-section">
              <div className="vqv-section-title">Contact</div>
              {vendor.contactName && (
                <div className="vqv-contact-row">
                  <span style={{fontSize:13}}>👤</span>
                  <span>{vendor.contactName}</span>
                </div>
              )}
              {vendor.phone && (
                <div className="vqv-contact-row">
                  <span style={{fontSize:13}}>📞</span>
                  <a href={`tel:${vendor.phone}`}>{vendor.phone}</a>
                </div>
              )}
              {vendor.email && (
                <div className="vqv-contact-row">
                  <span style={{fontSize:13}}>✉</span>
                  <a href={`mailto:${vendor.email}`}>{vendor.email}</a>
                </div>
              )}
              {vendor.website && (
                <div className="vqv-contact-row">
                  <span style={{fontSize:13}}>🌐</span>
                  <a href={vendor.website} target="_blank" rel="noopener noreferrer">
                    {vendor.website.replace(/^https?:\/\/(www\.)?/,"")}
                  </a>
                </div>
              )}
              {vendor.address && (
                <div className="vqv-contact-row">
                  <span style={{fontSize:13}}>📍</span>
                  <span>{vendor.address}</span>
                </div>
              )}
            </div>
          )}

          {/* Financials */}
          <div className="vqv-section">
            <div className="vqv-section-title">Financials</div>
            <div className="vqv-fin-row">
              <span className="vqv-fin-label">Contract</span>
              <span className="vqv-fin-val">{fin.contractAmt > 0 ? fmt$(fin.contractAmt) : "—"}</span>
            </div>
            <div className="vqv-fin-row">
              <span className="vqv-fin-label">Paid</span>
              <span className="vqv-fin-val green">{fmt$(fin.totalPaid)}</span>
            </div>
            <div className="vqv-fin-row">
              <span className="vqv-fin-label">Scheduled</span>
              <span className="vqv-fin-val gold">{fmt$(fin.totalScheduled)}</span>
            </div>
            {fin.contractAmt > 0 && fin.unscheduled > 0 && (
              <div className="vqv-fin-row">
                <span className="vqv-fin-label">Unscheduled</span>
                <span className="vqv-fin-val red">{fmt$(fin.unscheduled)}</span>
              </div>
            )}
            {fin.contractAmt > 0 && (
              <div className="vendor-progress-track" style={{marginTop:8}}>
                <div className="vendor-progress-fill" style={{width:`${fin.paidPct}%`}} />
              </div>
            )}
            {fin.linkedCount === 0 && (
              <div style={{fontSize:12,color:"var(--text-muted)",marginTop:6,fontStyle:"italic"}}>
                No expenses linked — add expenses in the Budget tab
              </div>
            )}
          </div>

          {/* Contract link */}
          {vendor.contractUrl && (
            <div className="vqv-section">
              <div className="vqv-section-title">Contract</div>
              <a href={vendor.contractUrl} target="_blank" rel="noopener noreferrer"
                className="btn btn-secondary btn-sm" style={{gap:6}}>
                📄 View Contract
              </a>
            </div>
          )}

          {/* Notes */}
          {vendor.notes && (
            <div className="vqv-section">
              <div className="vqv-section-title">Notes</div>
              <div style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.6,whiteSpace:"pre-wrap"}}>
                {vendor.notes}
              </div>
            </div>
          )}

          {/* Milestones */}
          {(vendor.milestones||[]).length > 0 && (
            <div className="vqv-section">
              <div className="vqv-section-title">Contract Milestones</div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {[...(vendor.milestones||[])].sort((a,b) => (a.date||"").localeCompare(b.date||"")).map(m => {
                  const today = new Date(); today.setHours(0,0,0,0);
                  const due   = m.date ? new Date(m.date + "T00:00:00") : null;
                  const diff  = due ? Math.ceil((due - today) / (1000*60*60*24)) : null;
                  const badge = diff === null ? null
                    : diff < 0  ? { label: `Overdue ${Math.abs(diff)}d`, bg:"var(--red-light)",   color:"var(--red)"   }
                    : diff <= 30 ? { label: `${diff}d`,                   bg:"var(--gold-light)",  color:"var(--gold)"  }
                    :              { label: `${diff}d`,                   bg:"var(--green-light)", color:"var(--green)" };
                  return (
                    <div key={m.id} style={{ display:"flex", alignItems:"center", gap:8,
                      padding:"7px 0", borderBottom:"1px solid var(--border)", fontSize:13 }}>
                      <span style={{ fontSize:14, flexShrink:0 }}>📌</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:600, color:"var(--text-primary)" }}>{m.title}</div>
                        {m.date && (
                          <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>
                            {new Date(m.date+"T00:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"})}
                            {m.notes && ` · ${m.notes}`}
                          </div>
                        )}
                      </div>
                      {badge && (
                        <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px",
                          borderRadius:99, flexShrink:0,
                          background:badge.bg, color:badge.color }}>
                          {badge.label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        {/* Contact Log */}
        {(vendor.contactLog||[]).length > 0 && (() => {
          const CONTACT_TYPE_COLORS = {
            "Call":       { bg:"var(--blue-light)",   color:"var(--blue)"           },
            "Email":      { bg:"var(--green-light)",  color:"var(--green)"          },
            "Meeting":    { bg:"var(--accent-light)", color:"var(--accent-primary)" },
            "In Person":  { bg:"var(--accent-light)", color:"var(--accent-primary)" },
            "Contract":   { bg:"var(--gold-light)",   color:"var(--gold)"           },
            "Other":      { bg:"var(--bg-subtle)",    color:"var(--text-muted)"     },
          };
          const sorted = [...(vendor.contactLog||[])].sort((a,b) => (b.date||"").localeCompare(a.date||""));
          const fmt = (d) => d ? new Date(d+"T00:00:00").toLocaleDateString("en-US",
            { month:"short", day:"numeric", year:"numeric" }) : "";
          return (
            <div className="vqv-section">
              <div className="vqv-section-title">Contact Log</div>
              <div style={{ display:"flex", flexDirection:"column" }}>
                {sorted.map((c, i) => {
                  const tc = CONTACT_TYPE_COLORS[c.type] || CONTACT_TYPE_COLORS["Other"];
                  return (
                    <div key={c.id} style={{
                      padding:"8px 0",
                      borderBottom: i < sorted.length - 1 ? "1px solid var(--border)" : "none",
                      fontSize:13,
                    }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom: c.notes ? 5 : 0 }}>
                        <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px",
                          borderRadius:99, flexShrink:0,
                          background:tc.bg, color:tc.color }}>
                          {c.type}
                        </span>
                        <span style={{ fontSize:12, color:"var(--text-muted)", fontWeight:500 }}>
                          {fmt(c.date)}
                        </span>
                      </div>
                      {c.notes && (
                        <div style={{ fontSize:12, color:"var(--text-secondary)",
                          lineHeight:1.6, paddingLeft:2 }}>
                          {c.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
        </div>

        {/* Footer */}
        <div className="vqv-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          {!isArchived && (
            <button className="btn btn-primary" onClick={() => { onClose(); onEdit(vendor); }}>
              ✎ Edit Vendor
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
