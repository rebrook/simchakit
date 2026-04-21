// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — AccommodationsTab.jsx
// Ported from V2. Reads out-of-town households from Supabase.
// Updates accommodation fields by saving the whole household record.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useEventData }       from "@/hooks/useEventData.js";
import { useSearchHighlight } from "@/hooks/useSearchHighlight.js";
import { formatAddress, migrateCityStateZip, formatPhone } from "@/utils/guests.js";
import { ArchivedNotice }     from "@/components/shared/ArchivedNotice.jsx";

export function AccommodationsTab({ eventId, event, adminConfig, showToast, isArchived, setActiveTab, searchHighlight, clearSearchHighlight }) {
  const { items: households, loading: hLoading, save: saveHousehold } = useEventData(eventId, "households");
  const { items: people,     loading: pLoading }                       = useEventData(eventId, "people");

  const [search,         setSearch]         = useState("");
  const [notifiedFilter, setNotifiedFilter] = useState("All");
  const [bookedFilter,   setBookedFilter]   = useState("All");
  const [editingHH,      setEditingHH]      = useState(null);

  useSearchHighlight(searchHighlight, clearSearchHighlight, "accommodations");

  const config = adminConfig || {};

  // Only out-of-town households
  const outOfTown = households.filter(h => h.outOfTown);

  const filtered = outOfTown.filter(h => {
    if (notifiedFilter === "Yes" && !h.accomNotified) return false;
    if (notifiedFilter === "No"  &&  h.accomNotified) return false;
    if (bookedFilter   === "Yes" && !h.accomBooked)   return false;
    if (bookedFilter   === "No"  &&  h.accomBooked)   return false;
    if (search) {
      const s = search.toLowerCase();
      const memberMatch = people.filter(p => p.householdId === h.id).some(p => {
        const name = [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "";
        return name.toLowerCase().includes(s);
      });
      if (!(h.formalName||"").toLowerCase().includes(s) && !memberMatch) return false;
    }
    return true;
  }).sort((a, b) => {
    const la = (a.formalName||"").trim().split(" ").filter(Boolean).pop()?.toLowerCase() || "";
    const lb = (b.formalName||"").trim().split(" ").filter(Boolean).pop()?.toLowerCase() || "";
    return la.localeCompare(lb);
  });

  const totalOOT        = outOfTown.length;
  const totalNotified   = outOfTown.filter(h => h.accomNotified).length;
  const totalBooked     = outOfTown.filter(h => h.accomBooked).length;
  const totalUnnotified = totalOOT - totalNotified;

  // Hotel blocks
  const hotelBlocks = config.hotelBlocks
    ? config.hotelBlocks.filter(b => b.name)
    : (config.accomHotelName
        ? [{ id: "hb_legacy", name: config.accomHotelName, groupCode: config.accomGroupCode || "", cutoffDate: config.accomCutoffDate || "", phone: config.accomPhone || "", website: config.accomWebsite || "" }]
        : []);

  const getCutoffBanner = (cutoffDate) => {
    if (!cutoffDate) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    const due   = new Date(cutoffDate + "T00:00:00");
    const diff  = Math.ceil((due - today) / (1000*60*60*24));
    if (diff < 0)   return { cls: "urgent", icon: "⚠", text: `Cut-off passed ${Math.abs(diff)} day${Math.abs(diff)!==1?"s":""} ago` };
    if (diff === 0) return { cls: "urgent", icon: "⚠", text: "Cut-off is today" };
    if (diff <= 14) return { cls: "urgent", icon: "⚠", text: `Cut-off in ${diff} day${diff!==1?"s":""}` };
    if (diff <= 60) return { cls: "warn",   icon: "📅", text: `Cut-off in ${diff} days` };
    return { cls: "info", icon: "📅", text: `Cut-off in ${diff} days` };
  };

  const bannerStyles = {
    info:   { background: "var(--blue-light)",  color: "var(--blue)",  border: "1px solid var(--blue)"  },
    warn:   { background: "var(--gold-light)",  color: "var(--gold)",  border: "1px solid var(--gold)"  },
    urgent: { background: "var(--red-light)",   color: "var(--red)",   border: "1px solid var(--red)"   },
    done:   { background: "var(--green-light)", color: "var(--green)", border: "1px solid var(--green)" },
  };

  const toggleNotified = async (hh) => {
    if (isArchived) return;
    await saveHousehold({ ...hh, accomNotified: !hh.accomNotified });
    showToast(hh.accomNotified ? "Marked not notified" : "Marked notified ✓");
  };

  const toggleBooked = async (hh) => {
    if (isArchived) return;
    await saveHousehold({ ...hh, accomBooked: !hh.accomBooked });
    showToast(hh.accomBooked ? "Marked not booked" : "Marked booked ✓");
  };

  const saveAccomDetails = async (hhId, fields) => {
    const hh = households.find(h => h.id === hhId);
    if (!hh) return;
    await saveHousehold({ ...hh, ...fields });
    showToast("Accommodation details saved");
    setEditingHH(null);
  };

  if (hLoading || pLoading) return <div style={loadingStyle}>Loading accommodations…</div>;

  return (
    <div>
      {isArchived && <ArchivedNotice />}

      <div className="section-header">
        <div>
          <div className="section-title">Stay &amp; Travel</div>
          <div className="section-subtitle">
            {totalOOT} out-of-town household{totalOOT !== 1 ? "s" : ""}
            {totalBooked > 0 ? ` · ${totalBooked} booked` : ""}
          </div>
        </div>
      </div>

      {/* Hotel block info */}
      {hotelBlocks.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          {hotelBlocks.map(block => {
            const banner = getCutoffBanner(block.cutoffDate);
            return (
              <div key={block.id} className="card">
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
                      🏨 {block.name}
                    </div>
                    {block.groupCode && <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 3 }}><strong>Group Code:</strong> {block.groupCode}</div>}
                    {block.phone    && <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 3 }}><strong>Phone:</strong> <a href={`tel:${block.phone}`}>{formatPhone(block.phone)}</a></div>}
                    {block.website  && <div style={{ fontSize: 13, marginBottom: 3 }}><a href={block.website} target="_blank" rel="noopener noreferrer">🔗 Hotel Website →</a></div>}
                  </div>
                  {banner && (
                    <div style={{ ...bannerStyles[banner.cls], borderRadius: "var(--radius-md)", padding: "10px 16px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      {banner.icon} {banner.text}
                      {block.cutoffDate && (
                        <span style={{ fontWeight: 400, opacity: 0.8 }}>
                          ({new Date(block.cutoffDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stat cards */}
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", marginBottom: 20 }}>
        <div className="stat-card"><div className="stat-label">Out of Town</div><div className="stat-value stat-accent">{totalOOT}</div><div className="stat-sub">households</div></div>
        <div className="stat-card"><div className="stat-label">Notified</div><div className="stat-value stat-green">{totalNotified}</div><div className="stat-sub">of {totalOOT}</div></div>
        <div className="stat-card"><div className="stat-label">Booked</div><div className="stat-value stat-gold">{totalBooked}</div><div className="stat-sub">confirmed rooms</div></div>
        <div className="stat-card">
          <div className="stat-label">Not Yet Notified</div>
          <div className="stat-value" style={{ color: totalUnnotified > 0 ? "var(--red)" : "var(--green)" }}>{totalUnnotified}</div>
          <div className="stat-sub">need outreach</div>
        </div>
      </div>

      {totalOOT === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "60px 24px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🧳</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>No out-of-town guests yet</div>
          <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20, maxWidth: 360, margin: "0 auto 20px" }}>
            Mark households as out-of-town in the Guests tab and they'll appear here automatically.
          </div>
          {setActiveTab && <button className="btn btn-secondary" onClick={() => setActiveTab("guests")}>👥 Go to Guests</button>}
        </div>
      ) : (
        <>
          <div className="filter-bar">
            <input className="form-input" placeholder="Search households…" value={search} onChange={e => setSearch(e.target.value)} />
            <select className="form-select" value={notifiedFilter} onChange={e => setNotifiedFilter(e.target.value)}>
              <option value="All">All — Notified</option>
              <option value="Yes">Notified ✓</option>
              <option value="No">Not Notified</option>
            </select>
            <select className="form-select" value={bookedFilter} onChange={e => setBookedFilter(e.target.value)}>
              <option value="All">All — Booked</option>
              <option value="Yes">Booked ✓</option>
              <option value="No">Not Booked</option>
            </select>
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--bg-subtle)", borderBottom: "2px solid var(--border)" }}>
                    {["Household","Location","Notified","Booked","Check-in","Check-out","Notes",""].map((h, i) => (
                      <th key={i} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted)", fontStyle: "italic" }}>No households match the current filters.</td></tr>
                  ) : filtered.map(hh => {
                    const location = formatAddress(migrateCityStateZip(hh));
                    const checkIn  = hh.accomCheckIn  ? new Date(hh.accomCheckIn  + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
                    const checkOut = hh.accomCheckOut ? new Date(hh.accomCheckOut + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
                    return (
                      <tr key={hh.id || hh._rowId} id={`row-${hh.id}`} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "10px 16px", fontWeight: 600, color: "var(--text-primary)" }}>
                          {hh.formalName}
                          {hh.accomBooked && <span style={{ marginLeft: 6, fontSize: 11, background: "var(--green-light)", color: "var(--green)", padding: "1px 7px", borderRadius: 20, fontWeight: 700 }}>✓ Booked</span>}
                        </td>
                        <td style={{ padding: "10px 12px", color: "var(--text-muted)", fontSize: 12 }}>{location || <span style={{ fontStyle: "italic" }}>No address</span>}</td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          <button onClick={() => toggleNotified(hh)} style={{ width: 26, height: 26, borderRadius: 6, border: hh.accomNotified ? "none" : "1.5px solid var(--border-strong)", background: hh.accomNotified ? "var(--green)" : "var(--bg-surface)", color: "white", cursor: "pointer", fontSize: 13, display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "all var(--transition)" }}>
                            {hh.accomNotified ? "✓" : ""}
                          </button>
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          <button onClick={() => toggleBooked(hh)} style={{ width: 26, height: 26, borderRadius: 6, border: hh.accomBooked ? "none" : "1.5px solid var(--border-strong)", background: hh.accomBooked ? "var(--green)" : "var(--bg-surface)", color: "white", cursor: "pointer", fontSize: 13, display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "all var(--transition)" }}>
                            {hh.accomBooked ? "✓" : ""}
                          </button>
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 12, color: checkIn ? "var(--text-primary)" : "var(--text-muted)" }}>{checkIn || <span style={{ fontStyle: "italic" }}>—</span>}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12, color: checkOut ? "var(--text-primary)" : "var(--text-muted)" }}>{checkOut || <span style={{ fontStyle: "italic" }}>—</span>}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hh.accomNotes || ""}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right" }}>
                          <button className="icon-btn" style={{ width: 28, height: 28 }} title="Edit accommodation details" onClick={() => setEditingHH(hh)}>✎</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {editingHH && (
        <AccomEditModal
          household={editingHH}
          onSave={saveAccomDetails}
          onClose={() => setEditingHH(null)}
          isArchived={isArchived}
        />
      )}
    </div>
  );
}

// ── AccomEditModal ────────────────────────────────────────────────────────────
export function AccomEditModal({ household, onSave, onClose, isArchived }) {
  const [form, setForm] = useState({
    accomNotified: household.accomNotified || false,
    accomBooked:   household.accomBooked   || false,
    accomCheckIn:  household.accomCheckIn  || "",
    accomCheckOut: household.accomCheckOut || "",
    accomNotes:    household.accomNotes    || "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">🧳 {household.formalName}</div>
          <button className="icon-btn" title="Close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
              <input type="checkbox" checked={form.accomNotified} onChange={e => set("accomNotified", e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--accent-primary)" }} />
              Notified about room block
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
              <input type="checkbox" checked={form.accomBooked} onChange={e => set("accomBooked", e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--accent-primary)" }} />
              Room booked
            </label>
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Check-in Date</label>
              <input className="form-input" type="date" value={form.accomCheckIn} onChange={e => set("accomCheckIn", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Check-out Date</label>
              <input className="form-input" type="date" value={form.accomCheckOut} onChange={e => set("accomCheckOut", e.target.value)} min={form.accomCheckIn || undefined} />
            </div>
          </div>
          {form.accomCheckIn && form.accomCheckOut && form.accomCheckOut < form.accomCheckIn && (
            <div style={{ fontSize: 12, color: "var(--red)", marginTop: 4, marginBottom: 8 }}>⚠ Check-out date is before check-in date</div>
          )}
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" rows={3} value={form.accomNotes} onChange={e => set("accomNotes", e.target.value)} placeholder="Room type, special requests, confirmation number…" />
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={isArchived} onClick={() => onSave(household.id, form)}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const loadingStyle = { padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 };
