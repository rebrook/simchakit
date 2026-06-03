// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit Admin — CouponsPage.jsx
// Create and manage coupon codes. View usage stats.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { adminQuery }          from "@/hooks/useAdminQuery.js";
import { PageHeader, PageLoading, PageError, card, cardTitle, tableStyle, th, td } from "./DashboardPage.jsx";
import { fmtDate } from "./UsersPage.jsx";

const DISCOUNT_TYPES = [
  { value: "free",    label: "Free (100% off)" },
  { value: "percent", label: "Percent off" },
  { value: "fixed",   label: "Fixed $ off" },
];

export function CouponsPage({ token }) {
  const [coupons,   setCoupons]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState("");

  // Edit coupon state
  const [editingId,     setEditingId]     = useState(null);
  const [editDiscount,  setEditDiscount]  = useState("free");
  const [editValue,     setEditValue]     = useState("");
  const [editMaxUses,   setEditMaxUses]   = useState("");
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [editNotes,     setEditNotes]     = useState("");
  const [editSaving,    setEditSaving]    = useState(false);
  const [editError,     setEditError]     = useState("");

  // New coupon form state
  const [code,      setCode]      = useState("");
  const [discount,  setDiscount]  = useState("free");
  const [value,     setValue]     = useState("");
  const [maxUses,   setMaxUses]   = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes,     setNotes]     = useState("");

  useEffect(() => {
    adminQuery(token, "coupons")
      .then(data => { setCoupons(data); setLoading(false); })
      .catch(e  => { setError(e.message); setLoading(false); });
  }, [token]);

  async function handleCreate() {
    if (!code.trim()) { setSaveError("Code is required."); return; }
    if (discount !== "free" && !value) { setSaveError("Value is required for percent/fixed discounts."); return; }
    setSaving(true);
    setSaveError("");
    try {
      const newCoupon = await adminQuery(token, "create_coupon", {
        code:      code.trim().toUpperCase(),
        discount,
        value:     discount === "free" ? 0 : discount === "percent" ? parseInt(value) : Math.round(parseFloat(value) * 100),
        maxUses:   maxUses ? parseInt(maxUses) : null,
        expiresAt: expiresAt || null,
        createdBy: notes.trim() || null,
      });
      setCoupons(prev => [newCoupon, ...prev]);
      setShowForm(false);
      resetForm();
    } catch (e) {
      setSaveError(e.message);
    }
    setSaving(false);
  }

  async function handleToggle(coupon) {
    const newActive = !coupon.active;
    try {
      await adminQuery(token, "toggle_coupon", { couponId: coupon.id, active: newActive });
      setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, active: newActive } : c));
    } catch (e) {
      alert("Error: " + e.message);
    }
  }

  function handleEdit(coupon) {
    setEditingId(coupon.id);
    setEditDiscount(coupon.discount);
    setEditValue(
      coupon.discount === "free" ? "" :
      coupon.discount === "percent" ? String(coupon.value) :
      String((coupon.value / 100).toFixed(2))
    );
    setEditMaxUses(coupon.max_uses != null ? String(coupon.max_uses) : "");
    setEditExpiresAt(coupon.expires_at ? coupon.expires_at.slice(0, 10) : "");
    setEditNotes(coupon.created_by || "");
    setEditError("");
  }

  async function handleEditSave(coupon) {
    if (editDiscount !== "free" && !editValue) { setEditError("Value is required."); return; }
    setEditSaving(true);
    setEditError("");
    try {
      const updated = await adminQuery(token, "update_coupon", {
        couponId:  coupon.id,
        discount:  editDiscount,
        value:     editDiscount === "free" ? 0 : editDiscount === "percent" ? parseInt(editValue) : Math.round(parseFloat(editValue) * 100),
        maxUses:   editMaxUses ? parseInt(editMaxUses) : null,
        expiresAt: editExpiresAt || null,
        notes:     editNotes.trim() || null,
      });
      setCoupons(prev => prev.map(c => c.id === coupon.id ? updated : c));
      setEditingId(null);
    } catch (e) {
      setEditError(e.message);
    }
    setEditSaving(false);
  }

  function handleEditCancel() {
    setEditingId(null);
    setEditError("");
  }

  function resetForm() {
    setCode(""); setDiscount("free"); setValue("");
    setMaxUses(""); setExpiresAt(""); setNotes("");
    setSaveError("");
  }

  function formatDiscount(coupon) {
    if (coupon.discount === "free")    return "Free";
    if (coupon.discount === "percent") return `${coupon.value}% off`;
    if (coupon.discount === "fixed")   return `$${(coupon.value / 100).toFixed(2)} off`;
    return "—";
  }

  if (loading) return <PageLoading />;
  if (error)   return <PageError msg={error} />;

  return (
    <div>
      <PageHeader title="Coupons" sub={`${coupons.filter(c => c.active).length} active code${coupons.filter(c => c.active).length !== 1 ? "s" : ""}`} />

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button style={actionBtn} onClick={() => { setShowForm(true); setSaveError(""); }}>
          + New Coupon
        </button>
      </div>

      {/* Create coupon form */}
      {showForm && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ ...cardTitle, marginBottom: 16 }}>New Coupon Code</div>

          <div style={formGrid}>
            <div style={fieldWrap}>
              <label style={label}>Code *</label>
              <input style={input} type="text" placeholder="e.g. BETA2026"
                value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                autoComplete="off" spellCheck={false} />
            </div>
            <div style={fieldWrap}>
              <label style={label}>Discount Type *</label>
              <select style={input} value={discount} onChange={e => setDiscount(e.target.value)}>
                {DISCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {discount !== "free" && (
              <div style={fieldWrap}>
                <label style={label}>{discount === "percent" ? "Percent Off *" : "Amount Off ($) *"}</label>
                <input style={input} type="number" min="0"
                  placeholder={discount === "percent" ? "e.g. 50" : "e.g. 10.00"}
                  value={value} onChange={e => setValue(e.target.value)} />
              </div>
            )}
            <div style={fieldWrap}>
              <label style={label}>Max Uses</label>
              <input style={input} type="number" min="1" placeholder="Unlimited"
                value={maxUses} onChange={e => setMaxUses(e.target.value)} />
            </div>
            <div style={fieldWrap}>
              <label style={label}>Expires</label>
              <input style={input} type="date" value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)} />
            </div>
            <div style={{ ...fieldWrap, gridColumn: "1 / -1" }}>
              <label style={label}>Notes (internal only)</label>
              <input style={input} type="text" placeholder="e.g. For beta testers, synagogue partnership"
                value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>

          {saveError && <div style={{ fontSize: 12, color: "#c00", marginBottom: 10 }}>{saveError}</div>}

          <div style={{ display: "flex", gap: 10 }}>
            <button style={{ ...actionBtn, opacity: saving ? 0.5 : 1 }}
              onClick={handleCreate} disabled={saving}>
              {saving ? "Creating…" : "Create Coupon"}
            </button>
            <button style={{ ...actionBtn, background: "#f5f5f5", color: "#666" }}
              onClick={() => { setShowForm(false); resetForm(); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Coupons table */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Code</th>
              <th style={th}>Discount</th>
              <th style={th}>Uses</th>
              <th style={th}>Max Uses</th>
              <th style={th}>Expires</th>
              <th style={th}>Notes</th>
              <th style={th}>Status</th>
              <th style={th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {coupons.length === 0 ? (
              <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: "#aaa" }}>No coupons yet.</td></tr>
            ) : coupons.map(c => {
              const isEditing = c.id === editingId;
              if (isEditing) {
                return (
                  <tr key={c.id} style={{ background: "#fffde7" }}>
                    <td style={{ ...td, fontWeight: 700, fontFamily: "monospace", color: "#aaa" }}>{c.code}</td>
                    <td style={td}>
                      <select style={{ ...input, padding: "4px 8px", fontSize: 12 }}
                        value={editDiscount} onChange={e => setEditDiscount(e.target.value)}>
                        {DISCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </td>
                    <td style={td}>
                      {editDiscount !== "free" && (
                        <input style={{ ...input, padding: "4px 8px", fontSize: 12, width: 70 }}
                          type="number" min="0"
                          placeholder={editDiscount === "percent" ? "%" : "$"}
                          value={editValue} onChange={e => setEditValue(e.target.value)} />
                      )}
                    </td>
                    <td style={td}>
                      <input style={{ ...input, padding: "4px 8px", fontSize: 12, width: 70 }}
                        type="number" min="1" placeholder="∞"
                        value={editMaxUses} onChange={e => setEditMaxUses(e.target.value)} />
                    </td>
                    <td style={td}>
                      <input style={{ ...input, padding: "4px 8px", fontSize: 12 }}
                        type="date" value={editExpiresAt}
                        onChange={e => setEditExpiresAt(e.target.value)} />
                    </td>
                    <td style={{ ...td }} colSpan={2}>
                      <input style={{ ...input, padding: "4px 8px", fontSize: 12, width: "100%" }}
                        type="text" placeholder="Notes"
                        value={editNotes} onChange={e => setEditNotes(e.target.value)} />
                      {editError && <div style={{ fontSize: 11, color: "#c00", marginTop: 2 }}>{editError}</div>}
                    </td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button style={{ ...smallBtn, background: "#e8f5e9", color: "#2e7d32", border: "1px solid #c8e6c9", opacity: editSaving ? 0.5 : 1 }}
                          onClick={() => handleEditSave(c)} disabled={editSaving}>
                          {editSaving ? "Saving…" : "Save"}
                        </button>
                        <button style={{ ...smallBtn, background: "#f5f5f5", color: "#666", border: "1px solid #ddd" }}
                          onClick={handleEditCancel}>
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }
              return (
              <tr key={c.id} style={{ opacity: c.active ? 1 : 0.5 }}>
                <td style={{ ...td, fontWeight: 700, fontFamily: "monospace" }}>{c.code}</td>
                <td style={td}>{formatDiscount(c)}</td>
                <td style={td}>{c.uses}</td>
                <td style={td}>{c.max_uses ?? "∞"}</td>
                <td style={td}>{c.expires_at ? fmtDate(c.expires_at) : "Never"}</td>
                <td style={{ ...td, fontSize: 12, color: "#888" }}>{c.created_by || "—"}</td>
                <td style={td}>
                  <span style={{
                    padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: c.active ? "#e8f5e9" : "#f5f5f5",
                    color:      c.active ? "#2e7d32" : "#888",
                  }}>
                    {c.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td style={td}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button style={{ ...smallBtn, background: "#e3f2fd", color: "#1565c0", border: "1px solid #bbdefb" }}
                      onClick={() => handleEdit(c)}>
                      Edit
                    </button>
                    <button style={{
                      ...smallBtn,
                      background: c.active ? "#fce4ec" : "#e8f5e9",
                      color:      c.active ? "#c62828" : "#2e7d32",
                      border:     `1px solid ${c.active ? "#ffcdd2" : "#c8e6c9"}`,
                    }} onClick={() => handleToggle(c)}>
                      {c.active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const actionBtn = {
  padding: "8px 16px", background: "#111", color: "white",
  border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
};

const smallBtn = {
  padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
};

const formGrid = {
  display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
  gap: 14, marginBottom: 16,
};

const fieldWrap = { display: "flex", flexDirection: "column", gap: 4 };

const label = {
  fontSize: 11, fontWeight: 600, textTransform: "uppercase",
  letterSpacing: "0.05em", color: "#888",
};

const input = {
  padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8,
  fontSize: 13, outline: "none", background: "white",
};
