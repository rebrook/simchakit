import { useState } from "react";
import { VENDOR_TYPES, VENDOR_STATUSES } from "@/constants/vendor-constants.js";
import { newVendorId, newMilestoneId, newContactId } from "@/utils/ids.js";
import { formatPhone, getAddressFields, formatAddress, COUNTRIES } from "@/utils/guests.js";

export function VendorModal({ vendor, onSave, onClose, isArchived }) {
  const isEdit = !!vendor;
  const [form, setForm] = useState(vendor || {
    id: newVendorId(),
    name: "", type: VENDOR_TYPES[0], contactName: "",
    phone: "", email: "", website: "",
    address1: "", address2: "", city: "", stateProvince: "", postalCode: "", country: "United States",
    contractAmt: "", status: "Researching",
    contractDate: "", contractUrl: "", notes: "",
    milestones: [],
    contactLog: [],
  });
  const setF = (k,v) => setForm(f => ({...f,[k]:v}));

  const addMilestone = () =>
    setF("milestones", [...(form.milestones||[]), { id: newMilestoneId(), title: "", date: "", notes: "" }]);

  const updateMilestone = (id, field, val) =>
    setF("milestones", (form.milestones||[]).map(m => m.id === id ? {...m, [field]: val} : m));

  const deleteMilestone = (id) =>
    setF("milestones", (form.milestones||[]).filter(m => m.id !== id));

  const addContact = () =>
    setF("contactLog", [
      { id: newContactId(), date: new Date().toISOString().slice(0,10), type: "Call", notes: "" },
      ...(form.contactLog||[]),
    ]);

  const updateContact = (id, field, val) =>
    setF("contactLog", (form.contactLog||[]).map(c => c.id === id ? {...c, [field]: val} : c));

  const deleteContact = (id) =>
    setF("contactLog", (form.contactLog||[]).filter(c => c.id !== id));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? "Edit Vendor" : "Add Vendor"}</div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Vendor Name *</label>
            <input className="form-input" value={form.name}
              onChange={e => setF("name", e.target.value)}
              placeholder="e.g., Springfield Grand Photography" autoFocus />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={form.type}
                onChange={e => setF("type", e.target.value)}>
                {VENDOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status}
                onChange={e => setF("status", e.target.value)}>
                {VENDOR_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Contact Name</label>
            <input className="form-input" value={form.contactName}
              onChange={e => setF("contactName", e.target.value)}
              placeholder="Primary contact at this vendor" />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" value={form.phone}
                onChange={e => setF("phone", e.target.value)}
                onBlur={e => setF("phone", formatPhone(e.target.value))}
                placeholder="555-555-1234" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email}
                onChange={e => setF("email", e.target.value)}
                onBlur={e => setF("email", e.target.value.toLowerCase().trim())}
                placeholder="contact@vendor.com" />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Website</label>
              <input className="form-input" value={form.website}
                onChange={e => setF("website", e.target.value)}
                onBlur={e => {
                  const v = e.target.value.trim();
                  if (v && !/^https?:\/\//i.test(v)) setF("website", "https://" + v);
                  else setF("website", v);
                }}
                placeholder="https://vendor.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Contract Date</label>
              <input className="form-input" type="date" value={form.contractDate}
                onChange={e => setF("contractDate", e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Contract Amount ($)</label>
            <input className="form-input" type="number" min="0" step="0.01"
              value={form.contractAmt}
              onChange={e => setF("contractAmt", e.target.value)}
              placeholder="0.00" />
            <div className="form-hint">Total agreed contract value</div>
          </div>

          <div className="form-group">
            <label className="form-label">Address</label>
            <input className="form-input" value={form.address1||""} onChange={e => setF("address1", e.target.value)} placeholder="Street address" />
          </div>
          <div className="form-group">
            <label className="form-label">Address Line 2</label>
            <input className="form-input" value={form.address2||""} onChange={e => setF("address2", e.target.value)} placeholder="Apt, Suite, Unit (optional)" />
          </div>
          <div className="form-group">
            <label className="form-label">Country</label>
            <select className="form-select" value={form.country||""} onChange={e => setF("country", e.target.value)}>
              <option value="">— Select country —</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">City</label>
            <input className="form-input" value={form.city||""} onChange={e => setF("city", e.target.value)} placeholder="City" />
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">{getAddressFields(form.country).stateLabel}</label>
              {getAddressFields(form.country).stateOptions
                ? <select className="form-select" value={form.stateProvince||""} onChange={e => setF("stateProvince", e.target.value)}>
                    <option value="">— Select —</option>
                    {getAddressFields(form.country).stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                : <input className="form-input" value={form.stateProvince||""} onChange={e => setF("stateProvince", e.target.value)} placeholder="Region" />
              }
            </div>
            <div className="form-group">
              <label className="form-label">{getAddressFields(form.country).postalLabel}</label>
              <input className="form-input" value={form.postalCode||""} onChange={e => setF("postalCode", e.target.value)} placeholder={form.country==="United States"?"62701":form.country==="Canada"?"A1A 1A1":form.country==="United Kingdom"?"EC1A 1BB":"Postal code"} />
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

          <div className="form-group">
            <label className="form-label">Contract Link</label>
            <input className="form-input" value={form.contractUrl||""}
              onChange={e => setF("contractUrl", e.target.value)}
              onBlur={e => {
                const v = e.target.value.trim();
                if (v && !/^https?:\/\//i.test(v)) setF("contractUrl", "https://" + v);
                else setF("contractUrl", v);
              }}
              placeholder="Dropbox, Google Drive, or any shared link" />
            <div className="form-hint">Paste a shared link to view the contract from the vendor card</div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" rows={3} value={form.notes}
              onChange={e => setF("notes", e.target.value)}
              placeholder="Contract details, payment schedule, special requirements..." />
          </div>

          {/* Contract Milestones */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
              <label className="form-label" style={{ marginBottom:0 }}>Contract Milestones</label>
              <button type="button" className="btn btn-secondary btn-sm"
                disabled={isArchived} onClick={addMilestone}>
                + Add Milestone
              </button>
            </div>
            {(form.milestones||[]).length === 0 ? (
              <div style={{ fontSize:12, color:"var(--text-muted)", fontStyle:"italic",
                padding:"10px 12px", background:"var(--bg-subtle)",
                borderRadius:"var(--radius-sm)", border:"1px solid var(--border)" }}>
                No milestones yet — add key contract dates like headcount due, delivery windows, or asset deadlines.
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {(form.milestones||[]).map(m => (
                  <div key={m.id} style={{ display:"flex", gap:8, alignItems:"flex-start",
                    padding:"10px 12px", background:"var(--bg-subtle)",
                    borderRadius:"var(--radius-sm)", border:"1px solid var(--border)" }}>
                    <div style={{ flex:1, display:"flex", flexDirection:"column", gap:6 }}>
                      <input className="form-input" value={m.title}
                        onChange={e => updateMilestone(m.id, "title", e.target.value)}
                        placeholder="e.g., Final headcount due, Montage assets due"
                        style={{ fontSize:13 }} />
                      <div style={{ display:"flex", gap:6 }}>
                        <input className="form-input" type="date" value={m.date||""}
                          onChange={e => updateMilestone(m.id, "date", e.target.value)}
                          style={{ fontSize:13, flex:"0 0 160px" }} />
                        <input className="form-input" value={m.notes||""}
                          onChange={e => updateMilestone(m.id, "notes", e.target.value)}
                          placeholder="Optional note"
                          style={{ fontSize:13, flex:1 }} />
                      </div>
                    </div>
                    <button type="button" className="icon-btn"
                      style={{ color:"var(--red)", flexShrink:0, marginTop:2 }}
                      disabled={isArchived}
                      onClick={() => deleteMilestone(m.id)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contact Log */}
          <div className="form-group" style={{ marginBottom:0 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
              <label className="form-label" style={{ marginBottom:0 }}>Contact Log</label>
              <button type="button" className="btn btn-secondary btn-sm"
                disabled={isArchived} onClick={addContact}>
                + Log Contact
              </button>
            </div>
            {(form.contactLog||[]).length === 0 ? (
              <div style={{ fontSize:12, color:"var(--text-muted)", fontStyle:"italic",
                padding:"10px 12px", background:"var(--bg-subtle)",
                borderRadius:"var(--radius-sm)", border:"1px solid var(--border)" }}>
                No contacts logged yet — record calls, emails, meetings, and contract signings.
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {(form.contactLog||[]).map(c => (
                  <div key={c.id} style={{ display:"flex", gap:8, alignItems:"flex-start",
                    padding:"10px 12px", background:"var(--bg-subtle)",
                    borderRadius:"var(--radius-sm)", border:"1px solid var(--border)" }}>
                    <div style={{ flex:1, display:"flex", flexDirection:"column", gap:6 }}>
                      <div style={{ display:"flex", gap:6 }}>
                        <input className="form-input" type="date" value={c.date||""}
                          onChange={e => updateContact(c.id, "date", e.target.value)}
                          style={{ fontSize:13, flex:"0 0 150px" }} />
                        <select className="form-select" value={c.type||"Call"}
                          onChange={e => updateContact(c.id, "type", e.target.value)}
                          style={{ fontSize:13, flex:"0 0 130px" }}>
                          {["Call","Email","Meeting","In Person","Contract","Other"].map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <input className="form-input" value={c.notes||""}
                        onChange={e => updateContact(c.id, "notes", e.target.value)}
                        placeholder="What was discussed or decided?"
                        style={{ fontSize:13 }} />
                    </div>
                    <button type="button" className="icon-btn"
                      style={{ color:"var(--red)", flexShrink:0, marginTop:2 }}
                      disabled={isArchived}
                      onClick={() => deleteContact(c.id)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary"
              onClick={() => { if (form.name.trim()) onSave({...form}); }}
              disabled={!form.name.trim() || isArchived}>
              {isEdit ? "Save Changes" : "Add Vendor"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
