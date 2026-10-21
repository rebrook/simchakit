// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.33.3 — GiftsTab.jsx
// Uses useEventData for Supabase persistence.
// A gift can now be given by more than one household (gift.givers array) —
// see utils/gifts.js for the data model and legacy-shape migration. Shared
// gift-level fields (dateReceived, attended, notes) still live at the top
// level; only the "from" and thank-you status are per-giver.
//
// V4.42.0: a record can hold more than one gift (gift.items), for a giver who
// sends, say, a check and a book set. Each item has its own type, description,
// and amount; the record keeps one set of givers, one thank-you per giver, and
// one date received. giftType, description, and amount at the top level are now
// derived summary fields written by withItems(); everything on this tab reads
// the items.
//
// V4.33.1: GiftModal's handleSave() carries the edited gift's _rowId through
// in its payload. V4.33.0 rebuilt the form state field by field instead of
// spreading the whole gift, which dropped _rowId and made every edit
// save() as a new row instead of updating the existing one.
//
// V4.33.2: V4.33.1 was incomplete. handleSave() also needs _createdAt and
// _updatedAt carried through, not just _rowId. useEventData's save_row RPC
// is an optimistic-concurrency update keyed on _updatedAt, so omitting it
// made every edit report a false conflict and silently revert to the
// server's pre-edit copy instead of saving. handleAdd/handleEdit also
// check save()'s return value instead of always reporting success.
//
// V4.33.3: handleDelete/toggleGiverWritten/toggleGiverMailed now check
// save()/remove()'s return value too, for the same reason as V4.33.2's
// handleAdd/handleEdit fix — these were the three remaining spots in this
// file that always reported success regardless of what actually happened.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { useEventData }        from "@/hooks/useEventData.js";
import { useSearchHighlight }  from "@/hooks/useSearchHighlight.js";
import { GIFT_TYPES }          from "@/constants/gifts.js";
import { newGiftId }           from "@/utils/ids.js";
import {
  getGiftGivers, withGivers, newGiverId, formatGiverNames,
  anyGiverNeedsWritten, anyGiverNeedsMailed, allGiversComplete, lastNameOf,
  countThankYousOutstanding,
  getGiftItems, getGiftTotal, itemAmount, withItems, newItemId,
}                               from "@/utils/gifts.js";
import { exportGiftsCSV, generateGiftPrintHTML } from "@/utils/exports.js";
import { getAddressFields, formatAddress, migrateCityStateZip, COUNTRIES } from "@/utils/guests.js";
import { ArchivedNotice }      from "@/components/shared/ArchivedNotice.jsx";
import { ConfirmDialog }       from "@/components/shared/ConfirmDialog.jsx";
import { Icon }                from "@/utils/iconMap.jsx";

export function GiftsTab({ eventId, event, adminConfig, showToast, isArchived, isViewer, searchHighlight, clearSearchHighlight, setTopbarSubtitle }) {
  const { items: gifts,      loading: gLoading, save, remove } = useEventData(eventId, "gifts");
  const { items: households, loading: hLoading }                = useEventData(eventId, "households");

  useSearchHighlight(searchHighlight, clearSearchHighlight, "gifts");

  const [showModal,     setShowModal]     = useState(false);
  const [editGift,      setEditGift]      = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [search,        setSearch]        = useState("");
  const [filterType,    setFilterType]    = useState("all");
  const [filterTY,      setFilterTY]      = useState("all");
  const [showExport,    setShowExport]    = useState(false);
  const [printHTML,     setPrintHTML]     = useState(null);

  // Mobile card layout (760px matches the app-wide table-to-card breakpoint)
  const [isMobile,      setIsMobile]      = useState(() => window.innerWidth < 760);
  const [expandedCards, setExpandedCards] = useState(new Set());

  // Column sorting (Amount / Received). null sortBy keeps the original default:
  // date received descending, then last name.
  const [sortBy,  setSortBy]  = useState(null); // null | "amount" | "received"
  const [sortDir, setSortDir] = useState("desc"); // "asc" | "desc"

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  };

  // Per-row "more" menu (desktop Delete-only menu, mobile Edit+Delete menu)
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRefs = useRef({});
  const setMenuRef = (id) => (node) => { menuRefs.current[id] = node; };

  useEffect(() => {
    if (openMenuId == null) return;
    const handleClick = (e) => {
      const node = menuRefs.current[openMenuId];
      if (node && !node.contains(e.target)) setOpenMenuId(null);
    };
    const handleKey = (e) => { if (e.key === "Escape") setOpenMenuId(null); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [openMenuId]);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 760);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const toggleExpand = (id) => setExpandedCards(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleAdd = async (g) => {
    if (isArchived || isViewer) return;
    const result = await save(g);
    if (result?.error) { showToast("Couldn't add the gift. Try again."); return; }
    showToast("Gift added");
    setShowModal(false);
  };

  const handleEdit = async (g) => {
    if (isArchived || isViewer) return;
    const result = await save(g);
    if (result?.error) { showToast("Couldn't save the gift. Try again."); return; }
    // A conflict means someone else saved this gift first; save() has already
    // replaced the local copy with the server's current version and the hook
    // fires its own "simchakit:save-conflict" event for AppShell to toast.
    // Keep the modal open here rather than discarding what was just typed.
    if (result?.conflict) return;
    showToast("Gift updated");
    setEditGift(null);
  };

  const handleDelete = async (id) => {
    if (isArchived || isViewer) return;
    const g = gifts.find(x => x.id === id);
    if (!g) { setDeleteConfirm(null); return; }
    const result = await remove(g._rowId);
    setDeleteConfirm(null);
    if (result?.error) { showToast("Couldn't delete the gift. Try again."); return; }
    showToast("Gift deleted");
  };

  const toggleGiverWritten = async (giftId, giverId) => {
    if (isArchived || isViewer) return;
    const g = gifts.find(x => x.id === giftId);
    if (!g) return;
    const givers = getGiftGivers(g).map(gv => gv.id === giverId ? { ...gv, thankYouWritten: !gv.thankYouWritten } : gv);
    const result = await save(withGivers(g, givers));
    if (result?.error) { showToast("Couldn't update thank-you status. Try again."); return; }
    if (result?.conflict) return; // AppShell already surfaces a conflict toast
    showToast("Thank-you note updated");
  };

  const toggleGiverMailed = async (giftId, giverId) => {
    if (isArchived || isViewer) return;
    const g = gifts.find(x => x.id === giftId);
    if (!g) return;
    const givers = getGiftGivers(g).map(gv => gv.id === giverId ? { ...gv, thankYouMailed: !gv.thankYouMailed } : gv);
    const result = await save(withGivers(g, givers));
    if (result?.error) { showToast("Couldn't update thank-you status. Try again."); return; }
    if (result?.conflict) return; // AppShell already surfaces a conflict toast
    showToast("Thank-you mailed updated");
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const allGivers     = gifts.flatMap(g => getGiftGivers(g));
  // Counted per item, so a check plus a book from one family reads as two gifts
  // and only the check counts toward the Cash / Check total.
  const allItems      = gifts.flatMap(g => getGiftItems(g));
  const totalMonetary = allItems.reduce((s, it) => s + (itemAmount(it) || 0), 0);
  const cashTotal     = allItems.filter(it => it.giftType === "Cash / Check").reduce((s, it) => s + (itemAmount(it) || 0), 0);
  // Outstanding = not yet both written and mailed, from the shared helper so
  // this card, the Gifts nav badge, and the Overview focus item always agree.
  const { total: tyOutstanding, toWrite: tyToWrite, toMail: tyToMail } = countThankYousOutstanding(gifts);
  const tyComplete    = allGivers.filter(gv => gv.thankYouWritten && gv.thankYouMailed).length;

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const filtered = gifts.filter(g => {
    const givers = getGiftGivers(g);
    const items  = getGiftItems(g);
    if (filterType !== "all" && !items.some(it => it.giftType === filterType)) return false;
    if (filterTY === "needs-written" && !anyGiverNeedsWritten(givers)) return false;
    if (filterTY === "needs-mailed"  && !anyGiverNeedsMailed(givers))  return false;
    if (filterTY === "complete"      && !allGiversComplete(givers))    return false;
    if (search) {
      const q = search.toLowerCase();
      const nameMatch = givers.some(gv => (gv.name || "").toLowerCase().includes(q));
      const itemMatch = items.some(it =>
        (it.description || "").toLowerCase().includes(q) ||
        (it.giftType    || "").toLowerCase().includes(q));
      if (!nameMatch && !itemMatch) return false;
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === "amount") {
      const av = getGiftTotal(a) || 0, bv = getGiftTotal(b) || 0;
      const diff = sortDir === "asc" ? av - bv : bv - av;
      if (diff !== 0) return diff;
    } else if (sortBy === "received") {
      if (a.dateReceived && b.dateReceived) {
        const diff = sortDir === "asc"
          ? new Date(a.dateReceived) - new Date(b.dateReceived)
          : new Date(b.dateReceived) - new Date(a.dateReceived);
        if (diff !== 0) return diff;
      } else if (a.dateReceived && !b.dateReceived) return -1;
      else if (!a.dateReceived && b.dateReceived) return 1;
    } else {
      // Default: date received descending
      if (a.dateReceived && b.dateReceived) {
        const diff = new Date(b.dateReceived) - new Date(a.dateReceived);
        if (diff !== 0) return diff;
      }
      if (a.dateReceived && !b.dateReceived) return -1;
      if (!a.dateReceived && b.dateReceived) return 1;
    }
    // Tiebreaker (and default secondary sort): last name
    const aName = getGiftGivers(a)[0]?.name || "";
    const bName = getGiftGivers(b)[0]?.name || "";
    return lastNameOf(aName).localeCompare(lastNameOf(bName));
  });

  const usedTypes = [...new Set(allItems.map(it => it.giftType).filter(Boolean))].sort();

  const TYPE_COLORS = {
    "Cash / Check":               { bg: "var(--green-light)",  color: "var(--green)"          },
    "Gift Card":                  { bg: "var(--blue-light)",   color: "var(--blue)"            },
    "Charitable Fund / Donation": { bg: "var(--gold-light)",   color: "var(--gold)"            },
    "Israel Bond":                { bg: "var(--gold-light)",   color: "var(--gold)"            },
    "Physical Gift":              { bg: "var(--accent-light)", color: "var(--accent-primary)"  },
    "Combination":                { bg: "var(--bg-muted)",     color: "var(--text-secondary)"  },
    "Religious Item":             { bg: "var(--accent-light)", color: "var(--accent-primary)"  },
    "Ceremonial / Tribute":       { bg: "var(--accent-light)", color: "var(--accent-primary)"  },
    "Experience / Activity":      { bg: "var(--blue-light)",   color: "var(--blue)"            },
    "Home / Judaica":             { bg: "var(--accent-light)", color: "var(--accent-primary)"  },
    "Books / Media":              { bg: "var(--bg-muted)",     color: "var(--text-secondary)"  },
    "Clothing / Accessories":     { bg: "var(--bg-muted)",     color: "var(--text-secondary)"  },
    "Online / Digital":           { bg: "var(--blue-light)",   color: "var(--blue)"            },
    "Other":                      { bg: "var(--bg-muted)",     color: "var(--text-muted)"      },
  };

  // ── Topbar subtitle (must be before loading guard — hooks can't follow conditional returns) ──
  const subtitle = gifts.length > 0 ? `${allItems.length} gift${allItems.length!==1?"s":""} · $${totalMonetary.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} monetary value` : null;
  useEffect(() => {
    setTopbarSubtitle(subtitle);
    return () => setTopbarSubtitle(null);
  }, [subtitle, setTopbarSubtitle]);

  if (gLoading || hLoading) return <div style={loadingStyle}>Loading gifts…</div>;

  return (
    <div className="tab-content">
      {isArchived && <ArchivedNotice />}

      {/* Mobile subtitle (≤900px only, where topbar is hidden) */}
      {subtitle && <div className="mobile-tab-subtitle">{subtitle}</div>}

      {/* Action row */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
        {gifts.length > 0 && (
          <button className="btn btn-secondary" onClick={() => setShowExport(true)}>↓ Export</button>
        )}
        {!isViewer && <button className="btn btn-primary" disabled={isArchived} onClick={() => setShowModal(true)}>+ Add Gift</button>}
      </div>

      {/* Stat cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Total Gifts</div>
          <div className="stat-value">{allItems.length}</div>
          {allItems.length !== gifts.length && (
            <div className="stat-sub">{`across ${gifts.length} ${gifts.length === 1 ? "entry" : "entries"}`}</div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Monetary Value</div>
          <div className="stat-value" style={{ color: "var(--green)" }}>
            ${totalMonetary.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="stat-sub">all gifts with amounts</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cash / Check Total</div>
          <div className="stat-value" style={{ color: "var(--green)" }}>
            ${cashTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Thank Yous Outstanding</div>
          <div className="stat-value" style={{ color: tyOutstanding > 0 ? "var(--red)" : "var(--green)" }}>
            {tyOutstanding}
          </div>
          <div className="stat-sub">{tyOutstanding > 0 ? `${tyToWrite} to write, ${tyToMail} to mail` : "all written and mailed"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Thank Yous Complete</div>
          <div className="stat-value" style={{ color: "var(--green)" }}>{tyComplete}</div>
          <div className="stat-sub">written and mailed, per giver</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input className="form-input"
          placeholder="Search by name or gift…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-select"
          value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="all">All Types</option>
          {usedTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="form-select" style={{ minWidth: 190 }}
          value={filterTY} onChange={e => setFilterTY(e.target.value)}>
          <option value="all">All Thank-You Status</option>
          <option value="needs-written">Needs Written</option>
          <option value="needs-mailed">Written, Needs Mailed</option>
          <option value="complete">Complete</option>
        </select>
      </div>

      {/* Empty state */}
      {gifts.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--text-muted)", background: "var(--bg-surface)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}><Icon name="gifts" context="empty" /></div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text-primary)", marginBottom: 8 }}>No gifts recorded yet</div>
          <div style={{ fontSize: 14, marginBottom: 24 }}>Add gifts as they arrive to track thank-you letters and totals.</div>
          {!isViewer && <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add First Gift</button>}
        </div>
      )}

      {/* Table (desktop) */}
      {gifts.length > 0 && !isMobile && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr className="gift-table-head-row">
                <th style={TH}>From</th>
                <th style={TH}>Gift</th>
                <th style={{ ...TH, textAlign: "right" }} aria-sort={sortBy === "amount" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button type="button" className="gift-sort-th" style={{ justifyContent: "flex-end", width: "100%" }} onClick={() => toggleSort("amount")}>
                    Amount {sortBy === "amount" && <span aria-hidden="true">{sortDir === "asc" ? "↑" : "↓"}</span>}
                  </button>
                </th>
                <th style={TH} aria-sort={sortBy === "received" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button type="button" className="gift-sort-th" onClick={() => toggleSort("received")}>
                    Received {(sortBy === "received" || sortBy == null) && <span aria-hidden="true">{sortBy === "received" ? (sortDir === "asc" ? "↑" : "↓") : "↓"}</span>}
                  </button>
                </th>
                <th style={TH}>Thank-you note</th>
                <th style={TH}>Attended</th>
                <th style={{ ...TH, textAlign: "right", width: 80 }}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>No matching gifts.</td></tr>
              ) : (
                filtered.map(g => {
                  const givers = getGiftGivers(g);
                  const items  = getGiftItems(g);
                  const total  = getGiftTotal(g);
                  return (
                    <tr key={g.id || g._rowId} id={`row-${g.id}`} className="gift-row">
                      <td style={TD}>
                        {givers.map((gv, i) => (
                          <div key={gv.id || i} className="gift-giver-line">
                            <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 13 }}>{gv.name || "—"}</span>
                            {gv.householdId && (
                              <span style={{ fontSize: 11, color: "var(--accent-medium)" }} title="Linked to guest list">● guest</span>
                            )}
                          </div>
                        ))}
                      </td>
                      <td style={TD}>
                        {items.map((it, ii) => {
                          const itc = TYPE_COLORS[it.giftType] || TYPE_COLORS["Other"];
                          return (
                            <div key={it.id || ii} className={ii > 0 ? "gift-item-block gift-item-block-next" : "gift-item-block"}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: itc.bg, color: itc.color, whiteSpace: "nowrap" }}>
                                {it.giftType}
                              </span>
                              {itemAmount(it) !== null && items.length > 1 && (
                                <span className="gift-item-amount">
                                  ${itemAmount(it).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              )}
                              {it.description && (
                                <div style={{ marginTop: 4, color: "var(--text-secondary)", fontSize: 13, overflowWrap: "anywhere" }}>
                                  {it.description}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </td>
                      <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: total != null ? "var(--green)" : "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
                        {total != null ? `$${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                      </td>
                      <td style={{ ...TD, fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {g.dateReceived ? new Date(g.dateReceived + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                      </td>
                      <td style={TD}>
                        {givers.map((gv, i) => (
                          <div key={gv.id || i} className="gift-giver-line" style={{ gap: 6 }}>
                            <button type="button"
                              className={`gift-ty-chip written${gv.thankYouWritten ? " on" : ""}`}
                              aria-pressed={!!gv.thankYouWritten}
                              aria-label={`${gv.thankYouWritten ? "Mark not written" : "Mark written"} for ${gv.name || "this giver"}`}
                              disabled={isViewer}
                              onClick={() => toggleGiverWritten(g.id, gv.id)}>
                              <span className="gift-ty-dot" aria-hidden="true" />Written
                            </button>
                            <button type="button"
                              className={`gift-ty-chip mailed${gv.thankYouMailed ? " on" : ""}`}
                              aria-pressed={!!gv.thankYouMailed}
                              aria-label={`${gv.thankYouMailed ? "Mark not mailed" : "Mark mailed"} for ${gv.name || "this giver"}`}
                              disabled={isViewer}
                              onClick={() => toggleGiverMailed(g.id, gv.id)}>
                              <span className="gift-ty-dot" aria-hidden="true" />Mailed
                            </button>
                          </div>
                        ))}
                      </td>
                      <td style={TD}>
                        {g.attended === true  && <span style={{ fontSize: 12, fontWeight: 600, color: "var(--green)" }}>Attended</span>}
                        {g.attended === false && <span style={{ fontSize: 12, fontWeight: 600, color: "var(--red)" }}>Did not attend</span>}
                        {g.attended == null   && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Unknown</span>}
                      </td>
                      <td style={{ ...TD, textAlign: "right" }}>
                        <div className="gift-actions">
                          <button className="icon-btn" title="Edit" aria-label="Edit" disabled={isArchived || isViewer} onClick={() => setEditGift(g)}><Icon name="pencil" context="badge" /></button>
                          <div className="header-overflow-wrap" ref={setMenuRef(g.id)}>
                            <button type="button" className="icon-btn" title="More" aria-label="More" aria-haspopup="true" aria-expanded={openMenuId === g.id}
                              disabled={isArchived || isViewer}
                              onClick={() => setOpenMenuId(openMenuId === g.id ? null : g.id)}>
                              <Icon name="moreHorizontal" context="badge" />
                            </button>
                            {openMenuId === g.id && (
                              <div className="header-overflow-menu" role="menu">
                                <button type="button" className="header-overflow-item" role="menuitem"
                                  onClick={() => { setOpenMenuId(null); setDeleteConfirm(g); }}>
                                  <Icon name="x" context="menu" /> Delete
                                </button>
                              </div>
                            )}
                          </div>
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

      {/* Cards (mobile) */}
      {gifts.length > 0 && isMobile && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 30, color: "var(--text-muted)", fontSize: 13 }}>No matching gifts.</div>
          ) : (
            filtered.map(g => {
              const givers     = getGiftGivers(g);
              const items      = getGiftItems(g);
              const total      = getGiftTotal(g);
              const itemTypes  = [...new Set(items.map(it => it.giftType).filter(Boolean))];
              const isExpanded = expandedCards.has(g.id);
              return (
                <div key={g.id || g._rowId} id={`row-${g.id}`} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                  {/* Primary row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
                    {/* Name(s) + type */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", overflowWrap: "anywhere" }}>
                        {formatGiverNames(givers) || "—"}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                        {itemTypes.map(t => {
                          const tc = TYPE_COLORS[t] || TYPE_COLORS["Other"];
                          return (
                            <span key={t} style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: tc.bg, color: tc.color, whiteSpace: "nowrap" }}>
                              {t}
                            </span>
                          );
                        })}
                        {items.length > 1 && (
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{items.length} gifts</span>
                        )}
                      </div>
                    </div>
                    {/* Amount */}
                    {total != null && (
                      <div style={{ fontWeight: 700, color: "var(--green)", fontFamily: "var(--font-mono)", fontSize: 15, flexShrink: 0 }}>
                        ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    )}
                    {/* Actions: Edit + Delete collapsed into one 44px menu button */}
                    <div className="header-overflow-wrap" style={{ flexShrink: 0 }} ref={setMenuRef(g.id)}>
                      <button type="button" className="icon-btn" title="More actions" aria-label="More actions" aria-haspopup="true" aria-expanded={openMenuId === g.id}
                        disabled={isArchived || isViewer}
                        onClick={() => setOpenMenuId(openMenuId === g.id ? null : g.id)}
                        style={{ width: 44, height: 44 }}>
                        <Icon name="moreHorizontal" context="badge" />
                      </button>
                      {openMenuId === g.id && (
                        <div className="header-overflow-menu" role="menu">
                          <button type="button" className="header-overflow-item" role="menuitem"
                            onClick={() => { setOpenMenuId(null); setEditGift(g); }}>
                            <Icon name="pencil" context="menu" /> Edit
                          </button>
                          <button type="button" className="header-overflow-item" role="menuitem"
                            onClick={() => { setOpenMenuId(null); setDeleteConfirm(g); }}>
                            <Icon name="x" context="menu" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                    {/* Expand chevron: a real button so it is keyboard reachable, labeled, and a 44px tap target */}
                    <button
                      type="button"
                      onClick={() => toggleExpand(g.id)}
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? "Hide gift details" : "Show gift details"}
                      style={{ width: 44, height: 44, flexShrink: 0, padding: 0, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 16, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <span aria-hidden="true" style={{ display: "inline-block", transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.2s ease" }}>›</span>
                    </button>
                  </div>

                  {/* Per-giver thank-you status — always visible, not gated behind expand */}
                  <div style={{ padding: "0 14px 12px", display: "flex", flexDirection: "column" }}>
                    {givers.length === 1 ? (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)" }}>Thank-you</span>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                          <button type="button"
                            className={`gift-ty-chip written${givers[0].thankYouWritten ? " on" : ""}`}
                            aria-pressed={!!givers[0].thankYouWritten}
                            aria-label={`${givers[0].thankYouWritten ? "Mark not written" : "Mark written"} for ${givers[0].name || "this giver"}`}
                            disabled={isViewer} onClick={() => toggleGiverWritten(g.id, givers[0].id)}>
                            <span className="gift-ty-dot" aria-hidden="true" />Written
                          </button>
                          <button type="button"
                            className={`gift-ty-chip mailed${givers[0].thankYouMailed ? " on" : ""}`}
                            aria-pressed={!!givers[0].thankYouMailed}
                            aria-label={`${givers[0].thankYouMailed ? "Mark not mailed" : "Mark mailed"} for ${givers[0].name || "this giver"}`}
                            disabled={isViewer} onClick={() => toggleGiverMailed(g.id, givers[0].id)}>
                            <span className="gift-ty-dot" aria-hidden="true" />Mailed
                          </button>
                        </div>
                      </div>
                    ) : (
                      givers.map((gv, i) => (
                        <div key={gv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, paddingTop: i > 0 ? 10 : 0, marginTop: i > 0 ? 10 : 0, borderTop: i > 0 ? "1px dashed var(--border)" : "none" }}>
                          <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: "var(--text-secondary)", overflowWrap: "anywhere" }}>
                            {gv.name || "—"}{gv.householdId && <span style={{ color: "var(--accent-medium)" }}> ● guest</span>}
                          </div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                            <button type="button"
                              className={`gift-ty-chip written${gv.thankYouWritten ? " on" : ""}`}
                              aria-pressed={!!gv.thankYouWritten}
                              aria-label={`${gv.thankYouWritten ? "Mark not written" : "Mark written"} for ${gv.name || "this giver"}`}
                              disabled={isViewer} onClick={() => toggleGiverWritten(g.id, gv.id)}>
                              <span className="gift-ty-dot" aria-hidden="true" />Written
                            </button>
                            <button type="button"
                              className={`gift-ty-chip mailed${gv.thankYouMailed ? " on" : ""}`}
                              aria-pressed={!!gv.thankYouMailed}
                              aria-label={`${gv.thankYouMailed ? "Mark not mailed" : "Mark mailed"} for ${gv.name || "this giver"}`}
                              disabled={isViewer} onClick={() => toggleGiverMailed(g.id, gv.id)}>
                              <span className="gift-ty-dot" aria-hidden="true" />Mailed
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div style={{ padding: "10px 14px 14px", borderTop: "1px solid var(--border)", background: "var(--bg-subtle)", display: "flex", flexDirection: "column", gap: 6 }}>
                      {items.length > 1 ? (
                        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                          <div style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Gifts</div>
                          {items.map((it, ii) => (
                            <div key={it.id || ii} className="gift-item-line">
                              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{it.giftType || "Gift"}</span>
                              {it.description && <span>{it.description}</span>}
                              {itemAmount(it) !== null && (
                                <span className="gift-item-amount">
                                  ${itemAmount(it).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : items[0]?.description && (
                        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                          <span style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>Description </span>
                          {items[0].description}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          <span style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 11 }}>Received </span>
                          {g.dateReceived ? new Date(g.dateReceived + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          <span style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 11 }}>Attended </span>
                          {g.attended === true ? "Yes" : g.attended === false ? "No" : "—"}
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

      {/* Add modal */}
      {showModal && (
        <GiftModal households={households} onSave={handleAdd} onClose={() => setShowModal(false)} isArchived={isArchived} />
      )}

      {/* Edit modal */}
      {editGift && (
        <GiftModal gift={editGift} households={households} onSave={handleEdit} onClose={() => setEditGift(null)} isArchived={isArchived} />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <ConfirmDialog
          title="Delete Gift"
          message={<>Permanently remove the gift from <strong>{formatGiverNames(getGiftGivers(deleteConfirm)) || "this donor"}</strong>? This cannot be undone.</>}
          confirmLabel="Delete Gift"
          onConfirm={() => handleDelete(deleteConfirm.id)}
          onClose={() => setDeleteConfirm(null)}
        />
      )}

      {/* Export modal */}
      {showExport && (
        <GiftExportModal
          gifts={gifts}
          households={households}
          adminConfig={adminConfig || {}}
          onPrint={(html) => { setPrintHTML(html); setShowExport(false); }}
          onClose={() => setShowExport(false)}
        />
      )}

      {/* Print preview */}
      {printHTML && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) { setPrintHTML(null); } }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", width: "95%", maxWidth: 960, height: "90vh", display: "flex", flexDirection: "column", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>Print Preview — Gift List</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary" style={{ fontSize: 12 }}
                  onClick={() => { const f = document.getElementById("gift-print-frame"); if (f?.contentWindow) f.contentWindow.print(); }}>
                  <Icon name="printer" context="inline" style={{ marginRight: 4 }} /> Print
                </button>
                <button className="icon-btn" title="Close" aria-label="Close" onClick={() => setPrintHTML(null)}><Icon name="x" context="button" /></button>
              </div>
            </div>
            <iframe id="gift-print-frame" srcDoc={printHTML}
              sandbox="allow-same-origin allow-modals"
              style={{ flex: 1, border: "none", borderRadius: "0 0 var(--radius-lg) var(--radius-lg)" }}
              title="Gift List Print Preview" />
          </div>
        </div>
      )}
    </div>
  );
}

// ── GiftModal ─────────────────────────────────────────────────────────────────
export function GiftModal({ gift, households, onSave, onClose, isArchived }) {
  const isEdit = !!gift;

  const [givers, setGivers] = useState(() => {
    if (gift) return getGiftGivers(gift).map(gv => ({ ...gv }));
    return [{
      id: newGiverId(), name: "", householdId: null,
      address1: "", address2: "", city: "", stateProvince: "", postalCode: "", country: "",
      thankYouWritten: false, thankYouMailed: false,
    }];
  });

  // One or more gifts from this giver (V4.42.0). Amounts are held as strings
  // while editing, like the single Amount field was.
  const [items, setItems] = useState(() => {
    if (gift) return getGiftItems(gift).map(it => ({ ...it, amount: itemAmount(it) !== null ? String(it.amount) : "" }));
    return [{ id: newItemId(), giftType: "Cash / Check", description: "", amount: "" }];
  });

  const [form, setForm] = useState(() => ({
    id:           gift?.id || newGiftId(),
    dateReceived: gift?.dateReceived || "",
    attended:     gift?.attended ?? null,
    notes:        gift?.notes || "",
  }));

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const hhMap   = Object.fromEntries(households.map(h => [h.id, h]));
  const hhNames = households.map(h => ({ id: h.id, name: h.formalName || "" })).filter(h => h.name).sort((a, b) => a.name.localeCompare(b.name));

  // Focus management for add/remove — see utils/gifts.js header note.
  const nameInputRefs      = useRef({});
  const addButtonRef       = useRef(null);
  const itemTypeRefs       = useRef({});
  const addItemButtonRef   = useRef(null);
  const [liveMessage, setLiveMessage] = useState("");

  const updateGiver = (id, patch) => setGivers(gs => gs.map(gv => gv.id === id ? { ...gv, ...patch } : gv));

  const handleGiverNameChange = (id, val) => {
    const match = hhNames.find(h => h.name.toLowerCase() === val.toLowerCase());
    if (match) {
      updateGiver(id, { name: match.name, householdId: match.id, address1: "", address2: "", city: "", stateProvince: "", postalCode: "", country: "" });
    } else {
      updateGiver(id, { name: val, householdId: null });
    }
  };

  const addGiver = () => {
    const id = newGiverId();
    setGivers(gs => [...gs, { id, name: "", householdId: null, address1: "", address2: "", city: "", stateProvince: "", postalCode: "", country: "", thankYouWritten: false, thankYouMailed: false }]);
    setLiveMessage("Giver added");
    requestAnimationFrame(() => { nameInputRefs.current[id]?.focus(); });
  };

  const removeGiver = (id) => {
    const idx = givers.findIndex(gv => gv.id === id);
    const remaining = givers.filter(gv => gv.id !== id);
    setGivers(remaining);
    setLiveMessage("Giver removed");
    requestAnimationFrame(() => {
      const target = remaining[idx] || remaining[idx - 1];
      if (target) nameInputRefs.current[target.id]?.focus();
      else addButtonRef.current?.focus();
    });
  };

  const updateItem = (id, patch) => setItems(its => its.map(it => it.id === id ? { ...it, ...patch } : it));

  const addItem = () => {
    const id = newItemId();
    setItems(its => [...its, { id, giftType: "Cash / Check", description: "", amount: "" }]);
    setLiveMessage("Gift added");
    requestAnimationFrame(() => { itemTypeRefs.current[id]?.focus(); });
  };

  const removeItem = (id) => {
    const idx = items.findIndex(it => it.id === id);
    const remaining = items.filter(it => it.id !== id);
    setItems(remaining);
    setLiveMessage("Gift removed");
    requestAnimationFrame(() => {
      const target = remaining[idx] || remaining[idx - 1];
      if (target) itemTypeRefs.current[target.id]?.focus();
      else addItemButtonRef.current?.focus();
    });
  };

  const linkedAddress = (gv) => {
    const hh = gv.householdId ? hhMap[gv.householdId] : null;
    return hh ? formatAddress(migrateCityStateZip(hh)) : null;
  };

  const handleSave = () => {
    const cleanGivers = givers
      .map(gv => ({ ...gv, name: (gv.name || "").trim() }))
      .filter(gv => gv.name);
    if (cleanGivers.length === 0) return;
    // A gift row needs a description or an amount to count; rows left blank
    // (an extra "Add another gift" row nobody filled in) are dropped. If every
    // row is blank, the first is kept, as a record with only a type always was.
    const mappedItems = items.map(it => ({
      id:          it.id,
      giftType:    it.giftType,
      description: (it.description || "").trim(),
      amount:      it.amount !== "" && Number.isFinite(parseFloat(it.amount)) ? parseFloat(it.amount) : null,
    }));
    let cleanItems = mappedItems.filter(it => it.description || it.amount !== null);
    if (cleanItems.length === 0) cleanItems = [mappedItems[0]];
    // withItems() also writes the derived giftType, description, and amount
    // summary fields that the export, print list, search, and audit log read.
    const payload = withItems({ ...form, givers: cleanGivers }, cleanItems);
    // Carry the existing row's internal tracking fields through on edit.
    // _rowId tells save() which row to update instead of inserting a new
    // one. _updatedAt is just as essential: save_row() is an optimistic-
    // concurrency RPC that only applies the write when _updatedAt still
    // matches the server's copy. _createdAt is carried along too for
    // consistency, though it isn't used by the concurrency check itself.
    if (gift) {
      payload._rowId     = gift._rowId;
      payload._createdAt = gift._createdAt;
      payload._updatedAt = gift._updatedAt;
    }
    onSave(payload);
  };

  const canSave = givers.some(gv => (gv.name || "").trim()) && !isArchived;

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? "Edit Gift" : "Add Gift"}</div>
          <button className="icon-btn" title="Close" aria-label="Close" onClick={onClose}><Icon name="x" context="button" /></button>
        </div>
        <div className="modal-body">

          {/* Givers */}
          {givers.map((gv, idx) => {
            const multi    = givers.length > 1;
            const linkedHH = gv.householdId ? hhMap[gv.householdId] : null;
            const wrapperStyle = multi
              ? { border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "12px 14px", marginBottom: 10, position: "relative" }
              : { marginBottom: 0 };
            return (
              <div key={gv.id} style={wrapperStyle}>
                {multi && (
                  <button type="button" className="icon-btn" aria-label={`Remove ${gv.name.trim() || `giver ${idx + 1}`}`}
                    onClick={() => removeGiver(gv.id)}
                    style={{ position: "absolute", top: 8, right: 8 }}>
                    <Icon name="x" context="badge" />
                  </button>
                )}
                {multi && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                    Giver {idx + 1}
                  </div>
                )}

                <div className="form-row">
                  <label className="form-label">{multi ? "Name *" : "From *"}</label>
                  <input
                    ref={el => { nameInputRefs.current[gv.id] = el; }}
                    className="form-input" autoFocus={idx === 0}
                    list="gift-from-list"
                    value={gv.name}
                    onChange={e => handleGiverNameChange(gv.id, e.target.value)}
                    placeholder="Name or select from guest list…"
                  />
                  {linkedHH && (
                    <div style={{ fontSize: 11, color: "var(--accent-medium)", marginTop: 4 }}>
                      ● Linked to guest list · {linkedAddress(gv) || "No address on file"}
                    </div>
                  )}
                </div>

                {/* Address — only shown for non-linked givers */}
                {!linkedHH && (<>
                  <div className="form-group">
                    <label className="form-label">Address</label>
                    <input className="form-input" value={gv.address1 || ""} onChange={e => updateGiver(gv.id, { address1: e.target.value })} placeholder="Street address" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Address Line 2</label>
                    <input className="form-input" value={gv.address2 || ""} onChange={e => updateGiver(gv.id, { address2: e.target.value })} placeholder="Apt, Suite, Unit (optional)" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Country</label>
                    <select className="form-select" value={gv.country || ""} onChange={e => updateGiver(gv.id, { country: e.target.value })}>
                      <option value="">— Select country —</option>
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">City</label>
                    <input className="form-input" value={gv.city || ""} onChange={e => updateGiver(gv.id, { city: e.target.value })} placeholder="City" />
                  </div>
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label">{getAddressFields(gv.country).stateLabel}</label>
                      {getAddressFields(gv.country).stateOptions
                        ? <select className="form-select" value={gv.stateProvince || ""} onChange={e => updateGiver(gv.id, { stateProvince: e.target.value })}>
                            <option value="">— Select —</option>
                            {getAddressFields(gv.country).stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        : <input className="form-input" value={gv.stateProvince || ""} onChange={e => updateGiver(gv.id, { stateProvince: e.target.value })} placeholder="Region" />
                      }
                    </div>
                    <div className="form-group">
                      <label className="form-label">{getAddressFields(gv.country).postalLabel}</label>
                      <input className="form-input" value={gv.postalCode || ""} onChange={e => updateGiver(gv.id, { postalCode: e.target.value })}
                        placeholder={gv.country === "United States" ? "62701" : gv.country === "Canada" ? "A1A 1A1" : gv.country === "United Kingdom" ? "EC1A 1BB" : "Postal code"} />
                      {gv.postalCode && (() => {
                        const v = gv.postalCode.trim();
                        let invalid = false;
                        if (gv.country === "United States")       invalid = !/^\d{5}(-\d{4})?$/.test(v);
                        else if (gv.country === "Canada")         invalid = !/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(v);
                        else if (gv.country === "United Kingdom") invalid = !/^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/.test(v);
                        else if (gv.country === "Australia")      invalid = !/^\d{4}$/.test(v);
                        return invalid ? <div style={{ fontSize: 11, color: "var(--gold,#b45309)", marginTop: 3 }}><Icon name="alertTriangle" context="badge" style={{ marginRight: 3 }} /> Format looks off for {gv.country}</div> : null;
                      })()}
                    </div>
                  </div>
                </>)}

                {/* Thank You — per giver */}
                <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                    <input type="checkbox" checked={!!gv.thankYouWritten}
                      onChange={e => updateGiver(gv.id, { thankYouWritten: e.target.checked })} />
                    Written
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                    <input type="checkbox" checked={!!gv.thankYouMailed}
                      onChange={e => updateGiver(gv.id, { thankYouMailed: e.target.checked })} />
                    Mailed
                  </label>
                </div>
              </div>
            );
          })}

          <datalist id="gift-from-list">
            {hhNames.map(h => <option key={h.id} value={h.name} />)}
          </datalist>

          <button type="button" ref={addButtonRef} className="btn btn-ghost"
            onClick={addGiver} style={{ marginTop: givers.length > 1 ? 0 : 12, marginBottom: 16 }}>
            + Add another giver
          </button>

          {/* Visually hidden live region — announces giver add/remove to screen readers */}
          <div role="status" aria-live="polite" style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}>
            {liveMessage}
          </div>

          {/* Gifts: one or more items from this giver */}
          {items.map((it, idx) => {
            const multi = items.length > 1;
            const wrapperStyle = multi
              ? { border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "12px 14px", marginBottom: 10, position: "relative" }
              : { marginBottom: 0 };
            return (
              <div key={it.id} style={wrapperStyle}>
                {multi && (
                  <button type="button" className="icon-btn" aria-label={`Remove gift ${idx + 1}`}
                    onClick={() => removeItem(it.id)}
                    style={{ position: "absolute", top: 8, right: 8 }}>
                    <Icon name="x" context="badge" />
                  </button>
                )}
                {multi && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                    Gift {idx + 1}
                  </div>
                )}
                <div className="form-row two-col">
                  <div>
                    <label className="form-label">Gift Type</label>
                    <select className="form-input" ref={el => { itemTypeRefs.current[it.id] = el; }}
                      aria-label={multi ? `Gift ${idx + 1} type` : undefined}
                      value={it.giftType} onChange={e => updateItem(it.id, { giftType: e.target.value })}>
                      {GIFT_TYPES.filter(t => t !== "Combination" || it.giftType === "Combination").map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Amount ($)</label>
                    <input className="form-input" type="number" min="0" step="0.01"
                      aria-label={multi ? `Gift ${idx + 1} amount` : undefined}
                      value={it.amount} onChange={e => updateItem(it.id, { amount: e.target.value })}
                      placeholder="0.00" />
                  </div>
                </div>
                <div className="form-row">
                  <label className="form-label">Description</label>
                  <input className="form-input"
                    aria-label={multi ? `Gift ${idx + 1} description` : undefined}
                    value={it.description || ""}
                    onChange={e => updateItem(it.id, { description: e.target.value })}
                    placeholder="e.g., Schneider Fund, Amazon gift card $50, Tallit" />
                </div>
              </div>
            );
          })}

          <button type="button" ref={addItemButtonRef} className="btn btn-ghost"
            onClick={addItem} style={{ marginTop: items.length > 1 ? 0 : 4, marginBottom: 16 }}>
            + Add another gift
          </button>

          {/* Date Received + Attended */}
          <div className="form-row two-col">
            <div>
              <label className="form-label">Date Received</label>
              <input className="form-input" type="date" value={form.dateReceived || ""}
                onChange={e => setF("dateReceived", e.target.value)} />
            </div>
            <div>
              <label className="form-label">Attended</label>
              <select className="form-input"
                value={form.attended === true ? "yes" : form.attended === false ? "no" : ""}
                onChange={e => setF("attended", e.target.value === "yes" ? true : e.target.value === "no" ? false : null)}>
                <option value="">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div className="form-row">
            <label className="form-label">Notes</label>
            <textarea className="form-input notes-area" rows={2}
              value={form.notes || ""} onChange={e => setF("notes", e.target.value)}
              placeholder="Any additional notes…" />
          </div>

          <div className="modal-footer">
            <span style={{ fontSize: 11, color: "var(--text-muted)", marginRight: "auto" }}>* required</span>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={!canSave}>
              {isEdit ? "Save Changes" : "Add Gift"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── GiftExportModal ───────────────────────────────────────────────────────────
export function GiftExportModal({ gifts, households, adminConfig, onPrint, onClose }) {
  const [showCSV, setShowCSV] = useState(false);
  const [copied,  setCopied]  = useState(false);

  const csvContent = showCSV ? exportGiftsCSV(gifts, households) : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(csvContent).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  };

  const handlePrint = () => {
    const mainEvt = (adminConfig?.timeline || []).find(e => e.isMainEvent);
    onPrint(generateGiftPrintHTML(gifts, households, adminConfig.name || "", mainEvt?.startDate || "", adminConfig.theme || {}));
  };

  const OPTION_STYLES = (active) => ({
    flex: 1, padding: "14px 16px",
    borderRadius: "var(--radius-md)",
    border: active ? "2px solid var(--accent-primary)" : "2px solid var(--border)",
    background: active ? "var(--accent-light)" : "var(--bg-surface)",
    cursor: "pointer", textAlign: "left",
    transition: "border-color 0.15s, background 0.15s",
  });

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Export Gift List</div>
          <button className="icon-btn" title="Close" aria-label="Close" onClick={onClose}><Icon name="x" context="button" /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <button style={OPTION_STYLES(showCSV)} onClick={() => { setShowCSV(true); setCopied(false); }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}><Icon name="clipboardList" context="button" /></div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)", marginBottom: 4 }}>CSV Export</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
                One row per giver, sorted by last name. Includes address, amounts, and thank-you status.
              </div>
            </button>
            <button style={OPTION_STYLES(false)} onClick={handlePrint}>
              <div style={{ fontSize: 20, marginBottom: 6 }}><Icon name="printer" context="button" /></div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)", marginBottom: 4 }}>Printable View</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
                Grouped by donor with address, gift details, and thank-you status. Works as a mailing checklist.
              </div>
            </button>
          </div>
          {showCSV && (
            <>
              <div className="alert alert-info" style={{ marginBottom: 10 }}>
                Copy the CSV below and paste into Excel.
              </div>
              <textarea readOnly value={csvContent} onClick={e => e.target.select()}
                style={{ width: "100%", minHeight: 180, background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 10, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-primary)", resize: "vertical" }} />
              <div className="modal-footer" style={{ marginTop: 12 }}>
                <button className="btn btn-ghost" onClick={onClose}>Close</button>
                <button className="btn btn-primary" onClick={handleCopy}>
                  {copied ? <><Icon name="check" context="badge" /> Copied!</> : "Copy to Clipboard"}
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

const loadingStyle = { padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 };
const TH = { padding: "6px 10px", textAlign: "left", fontWeight: 700, color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" };
const TD = { padding: "6px 10px" };
