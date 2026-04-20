// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit Admin — PurchasesPage.jsx
// Full transaction log. Manual grant + refund flag buttons.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { adminQuery }          from "@/hooks/useAdminQuery.js";
import { PageHeader, PageLoading, PageError, card, tableStyle, th, td } from "./DashboardPage.jsx";
import { StatusBadge, fmtDate } from "./UsersPage.jsx";

export function PurchasesPage({ token }) {
  const [purchases, setPurchases] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [search,    setSearch]    = useState("");
  const [filter,    setFilter]    = useState("all");
  const [showGrant, setShowGrant] = useState(false);
  const [grantEmail, setGrantEmail] = useState("");
  const [grantNotes, setGrantNotes] = useState("");
  const [granting,  setGranting]  = useState(false);
  const [grantError, setGrantError] = useState("");
  const [users,     setUsers]     = useState([]); // for email→id lookup

  useEffect(() => {
    Promise.all([
      adminQuery(token, "purchases"),
      adminQuery(token, "users"),
    ]).then(([p, u]) => {
      setPurchases(p);
      setUsers(u);
      setLoading(false);
    }).catch(e => { setError(e.message); setLoading(false); });
  }, [token]);

  async function handleRefund(purchaseId) {
    if (!confirm("Mark this purchase as refunded? This only updates your records — process the refund in Stripe separately.")) return;
    try {
      await adminQuery(token, "refund_purchase", { purchaseId });
      setPurchases(prev => prev.map(p => p.id === purchaseId ? { ...p, status: "refunded" } : p));
    } catch (e) {
      alert("Error: " + e.message);
    }
  }

  async function handleGrant() {
    const user = users.find(u => u.email.toLowerCase() === grantEmail.trim().toLowerCase());
    if (!user) { setGrantError("No user found with that email."); return; }
    setGranting(true);
    setGrantError("");
    try {
      const newPurchase = await adminQuery(token, "grant_purchase", {
        userId: user.id,
        notes:  grantNotes.trim() || "MANUAL_GRANT",
      });
      setPurchases(prev => [{ ...newPurchase, ownerEmail: user.email }, ...prev]);
      setShowGrant(false);
      setGrantEmail("");
      setGrantNotes("");
    } catch (e) {
      setGrantError(e.message);
    }
    setGranting(false);
  }

  const filtered = purchases.filter(p => {
    if (filter !== "all" && p.status !== filter) return false;
    if (search && !p.ownerEmail?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalRevenue = purchases
    .filter(p => p.status === "completed")
    .reduce((s, p) => s + (p.amount_cents || 0), 0);

  if (loading) return <PageLoading />;
  if (error)   return <PageError msg={error} />;

  return (
    <div>
      <PageHeader
        title="Purchases"
        sub={`${purchases.filter(p => p.status === "completed").length} completed · $${(totalRevenue / 100).toFixed(2)} total revenue`}
      />

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button style={actionBtn} onClick={() => setShowGrant(true)}>
          + Manual Grant
        </button>
      </div>

      {/* Manual grant form */}
      {showGrant && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
            Grant Free Event
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              style={{ ...inputStyle, flex: 2, minWidth: 200 }}
              type="email"
              placeholder="User email"
              value={grantEmail}
              onChange={e => setGrantEmail(e.target.value)}
            />
            <input
              style={{ ...inputStyle, flex: 2, minWidth: 200 }}
              type="text"
              placeholder="Notes (e.g. BETA2026, Support case)"
              value={grantNotes}
              onChange={e => setGrantNotes(e.target.value)}
            />
            <button
              style={{ ...actionBtn, opacity: granting || !grantEmail.trim() ? 0.5 : 1 }}
              onClick={handleGrant}
              disabled={granting || !grantEmail.trim()}
            >
              {granting ? "Granting…" : "Grant"}
            </button>
            <button style={{ ...actionBtn, background: "#f5f5f5", color: "#666" }}
              onClick={() => { setShowGrant(false); setGrantError(""); }}>
              Cancel
            </button>
          </div>
          {grantError && <div style={{ fontSize: 12, color: "#c00", marginTop: 8 }}>{grantError}</div>}
        </div>
      )}

      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #eee", display: "flex", gap: 10 }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            type="text"
            placeholder="Search by email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select style={selectStyle} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>

        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Owner</th>
              <th style={th}>Amount</th>
              <th style={th}>Status</th>
              <th style={th}>Coupon</th>
              <th style={th}>Stripe Session</th>
              <th style={th}>Date</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "#aaa" }}>No purchases found.</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id}>
                <td style={{ ...td, fontWeight: 600 }}>{p.ownerEmail}</td>
                <td style={td}>${(p.amount_cents / 100).toFixed(2)}</td>
                <td style={td}><StatusBadge status={p.status} /></td>
                <td style={td}>{p.coupon_code || "—"}</td>
                <td style={td}>
                  {p.stripe_session_id ? (
                    <a
                      href={`https://dashboard.stripe.com/test/payments/${p.stripe_payment_intent}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, color: "#666", fontFamily: "monospace" }}
                    >
                      {p.stripe_session_id.slice(0, 20)}…
                    </a>
                  ) : "—"}
                </td>
                <td style={td}>{fmtDate(p.created_at)}</td>
                <td style={td}>
                  {p.status === "completed" && (
                    <button style={smallBtn} onClick={() => handleRefund(p.id)}>
                      Refund
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const actionBtn = {
  padding: "8px 16px", background: "#111", color: "white",
  border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
  cursor: "pointer",
};

const smallBtn = {
  padding: "3px 10px", background: "#fff3e0", color: "#e65100",
  border: "1px solid #ffe0b2", borderRadius: 6, fontSize: 11,
  fontWeight: 600, cursor: "pointer",
};

const inputStyle = {
  padding: "8px 12px", border: "1px solid #ddd",
  borderRadius: 8, fontSize: 13, outline: "none",
};

const selectStyle = {
  padding: "8px 12px", border: "1px solid #ddd",
  borderRadius: 8, fontSize: 13, outline: "none", background: "white",
};
