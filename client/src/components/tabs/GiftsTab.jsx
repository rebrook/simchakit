import { useState, useEffect } from "react";
import { useSearchHighlight } from "@/hooks/useSearchHighlight.js";
import { GIFT_TYPES } from "@/constants/gifts.js";
import { newGiftId } from "@/utils/ids.js";
import { exportGiftsCSV, generateGiftPrintHTML } from "@/utils/exports.js";
import { getAddressFields, formatAddress, migrateCityStateZip, COUNTRIES } from "@/utils/guests.js";
import { ArchivedNotice } from "@/components/shared/ArchivedNotice.jsx";

export function GiftsTab({ state, updateData, appendAuditLog, isArchived, showToast, searchHighlight, clearSearchHighlight }) {
  const gifts      = state?.gifts      || [];
  const households = state?.households || [];

  useSearchHighlight(searchHighlight, clearSearchHighlight, "gifts");

  const [showModal,     setShowModal]     = useState(false);
  const [editGift,      setEditGift]      = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [search,        setSearch]        = useState("");
  const [filterType,    setFilterType]    = useState("all");
  const [filterTY,      setFilterTY]      = useState("all");
  const [showExport,    setShowExport]    = useState(false);
  const [printHTML,     setPrintHTML]     = useState(null);

  // Mobile card layout
  const [isMobile,      setIsMobile]      = useState(() => window.innerWidth < 640);
  const [expandedCards, setExpandedCards] = useState(new Set());

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const toggleExpand = (id) => setExpandedCards(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const saveGifts = (next) => updateData("gifts", next);

  const handleAdd    = (g) => { if (isArchived) return; saveGifts([...gifts, g]); appendAuditLog("Added", `Added gift — ${g.type || "Gift"}${g.amount ? " ($" + parseFloat(g.amount).toLocaleString() + ")" : ""}${g.from ? " from " + g.from : ""}`); showToast("Gift added"); setShowModal(false); };
  const handleEdit   = (g) => { if (isArchived) return; saveGifts(gifts.map(x => x.id===g.id ? g : x));       showToast("Gift updated"); setEditGift(null);   };
  const handleDelete = (id) => { if (isArchived) return; saveGifts(gifts.filter(g => g.id!==id));              showToast("Gift deleted"); setDeleteConfirm(null); };

  const toggleWritten = (id) => { if (isArchived) return; saveGifts(gifts.map(g => g.id===id ? {...g, thankYouWritten:!g.thankYouWritten} : g)); showToast("Thank-you note updated"); };
  const toggleMailed  = (id) => { if (isArchived) return; saveGifts(gifts.map(g => g.id===id ? {...g, thankYouMailed:!g.thankYouMailed}  : g)); showToast("Thank-you mailed updated"); };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalMonetary  = gifts.reduce((s,g) => s+(parseFloat(g.amount)||0), 0);
  const cashTotal      = gifts.filter(g=>g.giftType==="Cash / Check").reduce((s,g)=>s+(parseFloat(g.amount)||0),0);
  const tyPending      = gifts.filter(g=>!g.thankYouWritten).length;
  const tyComplete     = gifts.filter(g=>g.thankYouWritten && g.thankYouMailed).length;

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const getLastName = (name) => (name||"").trim().split(" ").pop();

  const filtered = gifts.filter(g => {
    if (filterType !== "all" && g.giftType !== filterType) return false;
    if (filterTY === "needs-written"  && g.thankYouWritten) return false;
    if (filterTY === "needs-mailed"   && (!g.thankYouWritten || g.thankYouMailed)) return false;
    if (filterTY === "complete"       && !(g.thankYouWritten && g.thankYouMailed)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(g.fromName||"").toLowerCase().includes(q) &&
          !(g.description||"").toLowerCase().includes(q) &&
          !(g.giftType||"").toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a,b) => {
    // Primary: date received descending
    if (a.dateReceived && b.dateReceived) {
      const diff = new Date(b.dateReceived) - new Date(a.dateReceived);
      if (diff !== 0) return diff;
    }
    if (a.dateReceived && !b.dateReceived) return -1;
    if (!a.dateReceived && b.dateReceived) return 1;
    // Secondary: last name ascending
    return getLastName(a.fromName).localeCompare(getLastName(b.fromName));
  });

  const usedTypes = [...new Set(gifts.map(g=>g.giftType).filter(Boolean))].sort();

  // Gift type badge colors
  const TYPE_COLORS = {
    "Cash / Check":              { bg:"var(--green-light)",  color:"var(--green)"  },
    "Gift Card":                 { bg:"var(--blue-light)",   color:"var(--blue)"   },
    "Charitable Fund / Donation":{ bg:"var(--gold-light)",   color:"var(--gold)"   },
    "Israel Bond":               { bg:"var(--gold-light)",   color:"var(--gold)"   },
    "Physical Gift":             { bg:"var(--accent-light)", color:"var(--accent-primary)" },
    "Combination":               { bg:"var(--bg-muted)",     color:"var(--text-secondary)" },
    "Religious Item":            { bg:"var(--accent-light)", color:"var(--accent-primary)" },
    "Ceremonial / Tribute":      { bg:"var(--accent-light)", color:"var(--accent-primary)" },
    "Experience / Activity":     { bg:"var(--blue-light)",   color:"var(--blue)"   },
    "Home / Judaica":            { bg:"var(--accent-light)", color:"var(--accent-primary)" },
    "Books / Media":             { bg:"var(--bg-muted)",     color:"var(--text-secondary)" },
    "Clothing / Accessories":    { bg:"var(--bg-muted)",     color:"var(--text-secondary)" },
    "Online / Digital":          { bg:"var(--blue-light)",   color:"var(--blue)"   },
    "Other":                     { bg:"var(--bg-muted)",     color:"var(--text-muted)" },
  };

  return (
    <div className="tab-content">
      {isArchived && <ArchivedNotice />}
      {/* ── Header ── */}
      <div className="section-header">
        <div>
          <div className="section-title">Gift Tracker</div>
          <div className="section-sub">Log gifts as they arrive and track thank-you letters.</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {gifts.length > 0 && (
            <button className="btn btn-secondary" onClick={() => setShowExport(true)}>↓ Export</button>
          )}
          <button className="btn btn-primary" disabled={isArchived} onClick={() => setShowModal(true)}>+ Add Gift</button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="stat-grid" style={{ marginBottom:20 }}>
        <div className="stat-card">
          <div className="stat-label">Total Gifts</div>
          <div className="stat-value">{gifts.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Monetary Value</div>
          <div className="stat-value" style={{ color:"var(--green)" }}>
            ${totalMonetary.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
          </div>
          <div className="stat-sub">all gifts with amounts</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cash / Check Total</div>
          <div className="stat-value" style={{ color:"var(--green)" }}>
            ${cashTotal.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Thank Yous Pending</div>
          <div className="stat-value" style={{ color: tyPending > 0 ? "var(--red)" : "var(--green)" }}>
            {tyPending}
          </div>
          <div className="stat-sub">not yet written</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Thank Yous Complete</div>
          <div className="stat-value" style={{ color:"var(--green)" }}>{tyComplete}</div>
          <div className="stat-sub">written and mailed</div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="filter-bar">
        <input className="form-input"
          placeholder="Search by name or gift…"
          value={search} onChange={e=>setSearch(e.target.value)} />
        <select className="form-select"
          value={filterType} onChange={e=>setFilterType(e.target.value)}>
          <option value="all">All Types</option>
          {usedTypes.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        <select className="form-select" style={{ minWidth:190 }}
          value={filterTY} onChange={e=>setFilterTY(e.target.value)}>
          <option value="all">All Thank-You Status</option>
          <option value="needs-written">Needs Written</option>
          <option value="needs-mailed">Written, Needs Mailed</option>
          <option value="complete">Complete</option>
        </select>
      </div>

      {/* ── Empty state ── */}
      {gifts.length === 0 && (
        <div style={{ textAlign:"center", padding:"60px 24px", color:"var(--text-muted)", background:"var(--bg-surface)", borderRadius:"var(--radius-md)", border:"1px solid var(--border)" }}>
          <div style={{ fontSize:36, marginBottom:12 }}>🎁</div>
          <div style={{ fontFamily:"var(--font-display)", fontSize:20, color:"var(--text-primary)", marginBottom:8 }}>No gifts recorded yet</div>
          <div style={{ fontSize:14, marginBottom:24 }}>Add gifts as they arrive to track thank-you letters and totals.</div>
          <button className="btn btn-primary" onClick={()=>setShowModal(true)}>+ Add First Gift</button>
        </div>
      )}

      {/* ── Table (desktop) ── */}
      {gifts.length > 0 && !isMobile && (
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:"1px solid var(--border)" }}>
                <th style={{ padding:"6px 10px", textAlign:"left",   fontWeight:700, color:"var(--text-muted)", fontSize:11, textTransform:"uppercase", letterSpacing:"0.04em", whiteSpace:"nowrap" }}>From</th>
                <th style={{ padding:"6px 10px", textAlign:"left",   fontWeight:700, color:"var(--text-muted)", fontSize:11, textTransform:"uppercase", letterSpacing:"0.04em", whiteSpace:"nowrap" }}>Type</th>
                <th style={{ padding:"6px 10px", textAlign:"left",   fontWeight:700, color:"var(--text-muted)", fontSize:11, textTransform:"uppercase", letterSpacing:"0.04em", whiteSpace:"nowrap" }}>Description</th>
                <th style={{ padding:"6px 10px", textAlign:"right",  fontWeight:700, color:"var(--text-muted)", fontSize:11, textTransform:"uppercase", letterSpacing:"0.04em", whiteSpace:"nowrap" }}>Amount</th>
                <th style={{ padding:"6px 10px", textAlign:"left",   fontWeight:700, color:"var(--text-muted)", fontSize:11, textTransform:"uppercase", letterSpacing:"0.04em", whiteSpace:"nowrap" }}>Received</th>
                <th style={{ padding:"6px 10px", textAlign:"center", fontWeight:700, color:"var(--text-muted)", fontSize:11, textTransform:"uppercase", letterSpacing:"0.04em", whiteSpace:"nowrap" }}>Attended</th>
                <th style={{ padding:"6px 10px", textAlign:"center", fontWeight:700, color:"var(--text-muted)", fontSize:11, textTransform:"uppercase", letterSpacing:"0.04em", whiteSpace:"nowrap" }}>Written</th>
                <th style={{ padding:"6px 10px", textAlign:"center", fontWeight:700, color:"var(--text-muted)", fontSize:11, textTransform:"uppercase", letterSpacing:"0.04em", whiteSpace:"nowrap" }}>Mailed</th>
                <th style={{ padding:"6px 10px", textAlign:"center", fontWeight:700, color:"var(--text-muted)", fontSize:11, textTransform:"uppercase", letterSpacing:"0.04em", whiteSpace:"nowrap", width:64 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign:"center", padding:30, color:"var(--text-muted)" }}>No matching gifts.</td></tr>
              ) : (
                filtered.map(g => {
                  const tc = TYPE_COLORS[g.giftType] || TYPE_COLORS["Other"];
                  return (
                    <tr key={g.id} id={`row-${g.id}`}>
                      <td style={{ padding:"6px 10px" }}>
                        <div style={{ fontWeight:600, color:"var(--text-primary)", fontSize:13 }}>{g.fromName || "—"}</div>
                        {g.householdId && (
                          <div style={{ fontSize:11, color:"var(--accent-medium)" }}>● Guest list</div>
                        )}
                      </td>
                      <td style={{ padding:"6px 10px" }}>
                        <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:99, background:tc.bg, color:tc.color, whiteSpace:"nowrap" }}>
                          {g.giftType}
                        </span>
                      </td>
                      <td style={{ padding:"6px 10px", fontSize:13, color:"var(--text-secondary)", maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}
                        title={g.description||undefined}>
                        {g.description || "—"}
                      </td>
                      <td style={{ padding:"6px 10px", textAlign:"right", fontWeight:700, color:"var(--green)", fontFamily:"var(--font-mono)", fontSize:13 }}>
                        {g.amount != null ? `$${parseFloat(g.amount).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}` : "—"}
                      </td>
                      <td style={{ padding:"6px 10px", fontSize:12, color:"var(--text-muted)", whiteSpace:"nowrap" }}>
                        {g.dateReceived ? new Date(g.dateReceived+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "—"}
                      </td>
                      <td style={{ padding:"6px 10px", fontSize:12, textAlign:"center" }}>
                        <div style={{ width:22, height:22, borderRadius:6, border:`2px solid ${g.attended===true?"var(--green)":g.attended===false?"var(--red)":"var(--border)"}`, background:g.attended===true?"var(--green)":g.attended===false?"var(--red)":"transparent", display:"inline-flex", alignItems:"center", justifyContent:"center", opacity: g.attended==null ? 0.4 : 1 }}
                          title={g.attended===true?"Attended":g.attended===false?"Did not attend":"Unknown"}>
                          {g.attended===true && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          {g.attended===false && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 1L7 7M7 1L1 7" stroke="white" strokeWidth="1.6" strokeLinecap="round"/></svg>}
                        </div>
                      </td>
                      <td style={{ padding:"6px 10px", textAlign:"center" }}>
                        <div
                          onClick={() => toggleWritten(g.id)}
                          style={{ width:22, height:22, borderRadius:6, border:`2px solid ${g.thankYouWritten?"var(--green)":"var(--border)"}`, background:g.thankYouWritten?"var(--green)":"transparent", display:"inline-flex", alignItems:"center", justifyContent:"center", cursor:"pointer", transition:"all 0.15s" }}
                        >
                          {g.thankYouWritten && <span style={{ color:"white", fontSize:13, fontWeight:700 }}>✓</span>}
                        </div>
                      </td>
                      <td style={{ padding:"6px 10px", textAlign:"center" }}>
                        <div
                          onClick={() => toggleMailed(g.id)}
                          style={{ width:22, height:22, borderRadius:6, border:`2px solid ${g.thankYouMailed?"var(--blue)":"var(--border)"}`, background:g.thankYouMailed?"var(--blue)":"transparent", display:"inline-flex", alignItems:"center", justifyContent:"center", cursor:"pointer", transition:"all 0.15s" }}
                        >
                          {g.thankYouMailed && <span style={{ color:"white", fontSize:13, fontWeight:700 }}>✓</span>}
                        </div>
                      </td>
                      <td style={{ padding:"6px 10px", textAlign:"center" }}>
                        <div style={{ display:"flex", gap:4, justifyContent:"center" }}>
                          <button className="icon-btn" title="Edit" disabled={isArchived} onClick={()=>setEditGift(g)}>✎</button>
                          <button className="icon-btn icon-btn-danger" title="Delete" disabled={isArchived} onClick={()=>setDeleteConfirm(g)}>✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Cards (mobile) ── */}
      {gifts.length > 0 && isMobile && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign:"center", padding:30, color:"var(--text-muted)", fontSize:13 }}>No matching gifts.</div>
          ) : (
            filtered.map(g => {
              const tc       = TYPE_COLORS[g.giftType] || TYPE_COLORS["Other"];
              const isExpanded = expandedCards.has(g.id);
              return (
                <div key={g.id} id={`row-${g.id}`} style={{ background:"var(--bg-surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-md)", overflow:"hidden" }}>

                  {/* Primary row */}
                  <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px" }}>

                    {/* Name + type */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:14, color:"var(--text-primary)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                        {g.fromName || "—"}
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:3, flexWrap:"wrap" }}>
                        <span style={{ fontSize:11, fontWeight:700, padding:"2px 7px", borderRadius:99, background:tc.bg, color:tc.color, whiteSpace:"nowrap" }}>
                          {g.giftType}
                        </span>
                        {g.householdId && (
                          <span style={{ fontSize:11, color:"var(--accent-medium)" }}>● Guest list</span>
                        )}
                      </div>
                    </div>

                    {/* Amount */}
                    {g.amount != null && (
                      <div style={{ fontWeight:700, color:"var(--green)", fontFamily:"var(--font-mono)", fontSize:15, flexShrink:0 }}>
                        ${parseFloat(g.amount).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
                      </div>
                    )}

                    {/* Thank-you checkboxes */}
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, flexShrink:0 }}>
                      <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                        <span style={{ fontSize:10, color:"var(--text-muted)", fontWeight:600 }}>W</span>
                        <div onClick={() => toggleWritten(g.id)} style={{ width:24, height:24, borderRadius:6, border:`2px solid ${g.thankYouWritten?"var(--green)":"var(--border)"}`, background:g.thankYouWritten?"var(--green)":"transparent", display:"inline-flex", alignItems:"center", justifyContent:"center", cursor:"pointer", transition:"all 0.15s" }}>
                          {g.thankYouWritten && <span style={{ color:"white", fontSize:13, fontWeight:700 }}>✓</span>}
                        </div>
                        <span style={{ fontSize:10, color:"var(--text-muted)", fontWeight:600 }}>M</span>
                        <div onClick={() => toggleMailed(g.id)} style={{ width:24, height:24, borderRadius:6, border:`2px solid ${g.thankYouMailed?"var(--blue)":"var(--border)"}`, background:g.thankYouMailed?"var(--blue)":"transparent", display:"inline-flex", alignItems:"center", justifyContent:"center", cursor:"pointer", transition:"all 0.15s" }}>
                          {g.thankYouMailed && <span style={{ color:"white", fontSize:13, fontWeight:700 }}>✓</span>}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display:"flex", flexDirection:"column", gap:4, flexShrink:0 }}>
                      <button className="icon-btn" title="Edit" disabled={isArchived} onClick={()=>setEditGift(g)}>✎</button>
                      <button className="icon-btn icon-btn-danger" title="Delete" disabled={isArchived} onClick={()=>setDeleteConfirm(g)}>✕</button>
                    </div>

                    {/* Expand chevron */}
                    <div onClick={() => toggleExpand(g.id)} style={{ cursor:"pointer", color:"var(--text-muted)", fontSize:16, flexShrink:0, padding:"0 2px", transform: isExpanded ? "rotate(90deg)" : "none", transition:"transform 0.2s ease" }}>›</div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div style={{ padding:"10px 14px 14px", borderTop:"1px solid var(--border)", background:"var(--bg-subtle)", display:"flex", flexDirection:"column", gap:6 }}>
                      {g.description && (
                        <div style={{ fontSize:13, color:"var(--text-secondary)" }}>
                          <span style={{ fontWeight:600, color:"var(--text-muted)", fontSize:11, textTransform:"uppercase", letterSpacing:"0.04em" }}>Description </span>
                          {g.description}
                        </div>
                      )}
                      <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
                        <div style={{ fontSize:12, color:"var(--text-muted)" }}>
                          <span style={{ fontWeight:600, textTransform:"uppercase", letterSpacing:"0.04em", fontSize:11 }}>Received </span>
                          {g.dateReceived ? new Date(g.dateReceived+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "—"}
                        </div>
                        <div style={{ fontSize:12, color:"var(--text-muted)" }}>
                          <span style={{ fontWeight:600, textTransform:"uppercase", letterSpacing:"0.04em", fontSize:11 }}>Attended </span>
                          {g.attended===true ? "Yes" : g.attended===false ? "No" : "—"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Add modal ── */}
      {showModal && (
        <GiftModal households={households} onSave={handleAdd} onClose={()=>setShowModal(false)} isArchived={isArchived} />
      )}

      {/* ── Edit modal ── */}
      {editGift && (
        <GiftModal gift={editGift} households={households} onSave={handleEdit} onClose={()=>setEditGift(null)} isArchived={isArchived} />
      )}

      {/* ── Delete confirm ── */}
      {deleteConfirm && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) { setDeleteConfirm(null); } }}>
          <div className="modal" style={{ maxWidth:400 }} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Delete Gift</div>
              <button className="icon-btn" title="Close" onClick={()=>setDeleteConfirm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize:14, color:"var(--text-primary)", lineHeight:1.6 }}>
                Permanently remove the gift from <strong>{deleteConfirm.fromName || "this donor"}</strong>? This cannot be undone.
              </p>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={()=>setDeleteConfirm(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={()=>handleDelete(deleteConfirm.id)}>Delete Gift</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Export modal ── */}
      {showExport && (
        <GiftExportModal
          gifts={gifts}
          households={households}
          adminConfig={state?.adminConfig || {}}
          onPrint={(html) => { setPrintHTML(html); setShowExport(false); }}
          onClose={() => setShowExport(false)}
        />
      )}

      {/* ── Print preview ── */}
      {printHTML && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) { setPrintHTML(null); } }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"var(--bg-surface)", borderRadius:"var(--radius-lg)", width:"95%", maxWidth:960, height:"90vh", display:"flex", flexDirection:"column", boxShadow:"var(--shadow-lg)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 20px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
              <div style={{ fontFamily:"var(--font-display)", fontSize:17, fontWeight:700, color:"var(--text-primary)" }}>Print Preview — Gift List</div>
              <div style={{ display:"flex", gap:8 }}>
                <button className="btn btn-primary" style={{ fontSize:12 }}
                  onClick={()=>{ const f=document.getElementById("gift-print-frame"); if(f?.contentWindow) f.contentWindow.print(); }}>
                  🖨 Print
                </button>
                <button className="icon-btn" title="Close" onClick={()=>setPrintHTML(null)}>✕</button>
              </div>
            </div>
            <iframe id="gift-print-frame" srcDoc={printHTML}
              style={{ flex:1, border:"none", borderRadius:"0 0 var(--radius-lg) var(--radius-lg)" }}
              title="Gift List Print Preview" />
          </div>
        </div>
      )}
    </div>
  );
}

export function GiftModal({ gift, households, onSave, onClose, isArchived }) {
  const isEdit = !!gift;
  const [form, setForm] = useState(gift || {
    id:              newGiftId(),
    householdId:     null,
    fromName:        "",
    address1:        "",
    address2:        "",
    city:            "",
    stateProvince:   "",
    postalCode:      "",
    country:         "",
    giftType:        "Cash / Check",
    description:     "",
    amount:          "",
    dateReceived:    "",
    attended:        null,
    thankYouWritten: false,
    thankYouMailed:  false,
    notes:           "",
  });

  const setF = (k,v) => setForm(f=>({...f,[k]:v}));

  // Build household lookup for autocomplete and address resolution
  const hhMap      = Object.fromEntries(households.map(h=>[h.id,h]));
  const hhNames    = households.map(h=>({ id:h.id, name:h.formalName||"" })).filter(h=>h.name).sort((a,b)=>a.name.localeCompare(b.name));

  // When fromName changes, check if it matches a household formalName
  const handleFromChange = (val) => {
    const match = hhNames.find(h => h.name.toLowerCase() === val.toLowerCase());
    if (match) {
      setForm(f => ({ ...f, fromName: match.name, householdId: match.id, address1: "", address2: "", city: "", stateProvince: "", postalCode: "", country: "" }));
    } else {
      setForm(f => ({ ...f, fromName: val, householdId: null }));
    }
  };

  // Resolved address for display
  const linkedHH = form.householdId ? hhMap[form.householdId] : null;
  const resolvedAddress = linkedHH
    ? formatAddress(migrateCityStateZip(linkedHH))
    : null;

  const handleSave = () => {
    if (!form.fromName.trim()) return;
    onSave({
      ...form,
      fromName: form.fromName.trim(),
      amount: form.amount !== "" ? parseFloat(form.amount) : null,
    });
  };

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg" style={{ maxWidth:520 }} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? "Edit Gift" : "Add Gift"}</div>
          <button className="icon-btn" title="Close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">

          {/* From */}
          <div className="form-row">
            <label className="form-label">From *</label>
            <input
              className="form-input" autoFocus
              list="gift-from-list"
              value={form.fromName}
              onChange={e=>handleFromChange(e.target.value)}
              placeholder="Name or select from guest list…"
            />
            <datalist id="gift-from-list">
              {hhNames.map(h=><option key={h.id} value={h.name} />)}
            </datalist>
            {linkedHH && (
              <div style={{ fontSize:11, color:"var(--accent-medium)", marginTop:4 }}>
                ● Linked to guest list · {resolvedAddress || "No address on file"}
              </div>
            )}
          </div>

          {/* Address — only shown for non-linked donors */}
          {!linkedHH && (<>
            <div className="form-group">
              <label className="form-label">Address</label>
              <input className="form-input" value={form.address1||""} onChange={e=>setF("address1",e.target.value)} placeholder="Street address" />
            </div>
            <div className="form-group">
              <label className="form-label">Address Line 2</label>
              <input className="form-input" value={form.address2||""} onChange={e=>setF("address2",e.target.value)} placeholder="Apt, Suite, Unit (optional)" />
            </div>
            <div className="form-group">
              <label className="form-label">Country</label>
              <select className="form-select" value={form.country||""} onChange={e=>setF("country",e.target.value)}>
                <option value="">— Select country —</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">City</label>
              <input className="form-input" value={form.city||""} onChange={e=>setF("city",e.target.value)} placeholder="City" />
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">{getAddressFields(form.country).stateLabel}</label>
                {getAddressFields(form.country).stateOptions
                  ? <select className="form-select" value={form.stateProvince||""} onChange={e=>setF("stateProvince",e.target.value)}>
                      <option value="">— Select —</option>
                      {getAddressFields(form.country).stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  : <input className="form-input" value={form.stateProvince||""} onChange={e=>setF("stateProvince",e.target.value)} placeholder="Region" />
                }
              </div>
              <div className="form-group">
                <label className="form-label">{getAddressFields(form.country).postalLabel}</label>
                <input className="form-input" value={form.postalCode||""} onChange={e=>setF("postalCode",e.target.value)} placeholder={form.country==="United States"?"62701":form.country==="Canada"?"A1A 1A1":form.country==="United Kingdom"?"EC1A 1BB":"Postal code"} />
                {form.postalCode && (() => {
                  const v = form.postalCode.trim();
                  let invalid = false;
                  if (form.country==="United States")       invalid = !/^\d{5}(-\d{4})?$/.test(v);
                  else if (form.country==="Canada")         invalid = !/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(v);
                  else if (form.country==="United Kingdom") invalid = !/^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/.test(v);
                  else if (form.country==="Australia")      invalid = !/^\d{4}$/.test(v);
                  return invalid ? <div style={{fontSize:11,color:"var(--gold,#b45309)",marginTop:3}}>⚠ Format looks off for {form.country}</div> : null;
                })()}
              </div>
            </div>
          </>)}

          {/* Gift Type + Amount */}
          <div className="form-row two-col">
            <div>
              <label className="form-label">Gift Type</label>
              <select className="form-input" value={form.giftType} onChange={e=>setF("giftType",e.target.value)}>
                {GIFT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Amount ($)</label>
              <input className="form-input" type="number" min="0" step="0.01"
                value={form.amount} onChange={e=>setF("amount",e.target.value)}
                placeholder="0.00" />
            </div>
          </div>

          {/* Description */}
          <div className="form-row">
            <label className="form-label">Description</label>
            <input className="form-input" value={form.description||""}
              onChange={e=>setF("description",e.target.value)}
              placeholder="e.g., Schneider Fund, Amazon gift card $50, Tallit" />
          </div>

          {/* Date Received + Attended */}
          <div className="form-row two-col">
            <div>
              <label className="form-label">Date Received</label>
              <input className="form-input" type="date" value={form.dateReceived||""}
                onChange={e=>setF("dateReceived",e.target.value)} />
            </div>
            <div>
              <label className="form-label">Attended</label>
              <select className="form-input"
                value={form.attended===true?"yes":form.attended===false?"no":""}
                onChange={e=>setF("attended", e.target.value==="yes" ? true : e.target.value==="no" ? false : null)}>
                <option value="">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>

          {/* Thank You checkboxes */}
          <div className="form-row">
            <label className="form-label">Thank You</label>
            <div style={{ display:"flex", gap:20, marginTop:4 }}>
              <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:13 }}>
                <input type="checkbox" checked={!!form.thankYouWritten}
                  onChange={e=>setF("thankYouWritten",e.target.checked)} />
                Written
              </label>
              <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:13 }}>
                <input type="checkbox" checked={!!form.thankYouMailed}
                  onChange={e=>setF("thankYouMailed",e.target.checked)} />
                Mailed
              </label>
            </div>
          </div>

          {/* Notes */}
          <div className="form-row">
            <label className="form-label">Notes</label>
            <textarea className="form-input notes-area" rows={2}
              value={form.notes||""} onChange={e=>setF("notes",e.target.value)}
              placeholder="Any additional notes…" />
          </div>

          <div className="modal-footer">
            <span style={{fontSize:11,color:"var(--text-muted)",marginRight:"auto"}}>* required</span>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={!form.fromName.trim() || isArchived}>
              {isEdit ? "Save Changes" : "Add Gift"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GiftExportModal({ gifts, households, adminConfig, onPrint, onClose }) {
  const [showCSV, setShowCSV] = useState(false);
  const [copied,  setCopied]  = useState(false);

  const csvContent = showCSV ? exportGiftsCSV(gifts, households) : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(csvContent).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2000); }).catch(()=>{});
  };

  const handlePrint = () => {
    const mainEvt = (adminConfig?.timeline||[]).find(e => e.isMainEvent);
    onPrint(generateGiftPrintHTML(gifts, households, adminConfig.name||"", mainEvt?.startDate||"", adminConfig.theme||{}));
  };

  const OPTION_STYLES = (active) => ({
    flex:1, padding:"14px 16px",
    borderRadius:"var(--radius-md)",
    border: active ? "2px solid var(--accent-primary)" : "2px solid var(--border)",
    background: active ? "var(--accent-light)" : "var(--bg-surface)",
    cursor:"pointer", textAlign:"left",
    transition:"border-color 0.15s, background 0.15s",
  });

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg" style={{ maxWidth:520 }} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Export Gift List</div>
          <button className="icon-btn" title="Close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">

          <div style={{ display:"flex", gap:10, marginBottom:20 }}>
            <button style={OPTION_STYLES(showCSV)} onClick={()=>{ setShowCSV(true); setCopied(false); }}>
              <div style={{ fontSize:20, marginBottom:6 }}>📋</div>
              <div style={{ fontWeight:700, fontSize:13, color:"var(--text-primary)", marginBottom:4 }}>CSV Export</div>
              <div style={{ fontSize:11, color:"var(--text-muted)", lineHeight:1.5 }}>
                One row per gift, sorted by last name. Includes address, amounts, and thank-you status.
              </div>
            </button>
            <button style={OPTION_STYLES(false)} onClick={handlePrint}>
              <div style={{ fontSize:20, marginBottom:6 }}>🖨</div>
              <div style={{ fontWeight:700, fontSize:13, color:"var(--text-primary)", marginBottom:4 }}>Printable View</div>
              <div style={{ fontSize:11, color:"var(--text-muted)", lineHeight:1.5 }}>
                Grouped by donor with address, gift details, and thank-you status. Works as a mailing checklist.
              </div>
            </button>
          </div>

          {showCSV && (
            <>
              <div className="alert alert-info" style={{ marginBottom:10 }}>
                Copy the CSV below and paste into Excel.
              </div>
              <textarea readOnly value={csvContent} onClick={e=>e.target.select()}
                style={{ width:"100%", minHeight:180, background:"var(--bg-subtle)", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", padding:10, fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-primary)", resize:"vertical" }} />
              <div className="modal-footer" style={{ marginTop:12 }}>
                <button className="btn btn-ghost" onClick={onClose}>Close</button>
                <button className="btn btn-primary" onClick={handleCopy}>
                  {copied ? "✓ Copied!" : "Copy to Clipboard"}
                </button>
              </div>
            </>
          )}

          {!showCSV && (
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
