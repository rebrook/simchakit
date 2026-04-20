// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit Admin — UsersPage.jsx
// Searchable user list. Click a row to see events and purchases for that user.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { adminQuery }          from "@/hooks/useAdminQuery.js";
import { PageHeader, PageLoading, PageError, card, cardTitle, tableStyle, th, td, empty } from "./DashboardPage.jsx";

export function UsersPage({ token }) {
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState(null); // { user, events, purchases }
  const [detail,   setDetail]   = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    adminQuery(token, "users")
      .then(data => { setUsers(data); setLoading(false); })
      .catch(e  => { setError(e.message); setLoading(false); });
  }, [token]);

  async function handleDeleteUser(user) {
    const confirmed = window.prompt(
      `This will permanently delete ${user.email} and ALL their events and data.\n\nType DELETE to confirm.`
    );
    if (confirmed !== "DELETE") return;
    try {
      await adminQuery(token, "delete_user", { userId: user.id });
      setUsers(prev => prev.filter(u => u.id !== user.id));
      setSelected(null);
      setDetail(null);
    } catch (e) {
      alert("Error: " + e.message);
    }
  }

  async function handleSelectUser(user) {
    setSelected(user);
    setDetailLoading(true);
    try {
      const d = await adminQuery(token, "user_detail", { userId: user.id });
      setDetail(d);
    } catch (e) {
      setDetail({ events: [], purchases: [], error: e.message });
    }
    setDetailLoading(false);
  }

  const filtered = users.filter(u =>
    !search || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <PageLoading />;
  if (error)   return <PageError msg={error} />;

  return (
    <div>
      <PageHeader title="Users" sub={`${users.length} registered account${users.length !== 1 ? "s" : ""}`} />

      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #eee" }}>
          <input
            style={searchInput}
            type="text"
            placeholder="Search by email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Email</th>
              <th style={th}>Display Name</th>
              <th style={th}>Events</th>
              <th style={th}>Joined</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={4} style={{ ...td, textAlign: "center", color: "#aaa" }}>No users found.</td></tr>
            ) : filtered.map(u => (
              <tr key={u.id} style={{ cursor: "pointer" }}
                onClick={() => handleSelectUser(u)}>
                <td style={{ ...td, fontWeight: 600 }}>{u.email}</td>
                <td style={td}>{u.display_name || "—"}</td>
                <td style={td}>{u.event_count}</td>
                <td style={td}>{fmtDate(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── User detail drawer ── */}
      {selected && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={cardTitle}>{selected.email}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={deleteBtn} onClick={() => handleDeleteUser(selected)}>
                Delete User
              </button>
              <button style={closeBtn} onClick={() => { setSelected(null); setDetail(null); }}>✕</button>
            </div>
          </div>

          {detailLoading ? <div style={{ color: "#aaa", fontSize: 13 }}>Loading…</div> : detail && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#333", marginBottom: 8 }}>
                Events ({detail.events.length})
              </div>
              {detail.events.length === 0 ? (
                <div style={{ ...empty, textAlign: "left" }}>No events.</div>
              ) : (
                <table style={{ ...tableStyle, marginBottom: 20 }}>
                  <thead><tr>
                    <th style={th}>Name</th><th style={th}>Type</th>
                    <th style={th}>Archived</th><th style={th}>Created</th>
                  </tr></thead>
                  <tbody>{detail.events.map(e => (
                    <tr key={e.id}>
                      <td style={{ ...td, fontWeight: 600 }}>{e.name || "Unnamed"}</td>
                      <td style={td}>{e.type}</td>
                      <td style={td}>{e.archived ? "Yes" : "No"}</td>
                      <td style={td}>{fmtDate(e.created_at)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}

              <div style={{ fontSize: 13, fontWeight: 600, color: "#333", marginBottom: 8 }}>
                Purchases ({detail.purchases.length})
              </div>
              {detail.purchases.length === 0 ? (
                <div style={{ ...empty, textAlign: "left" }}>No purchases.</div>
              ) : (
                <table style={tableStyle}>
                  <thead><tr>
                    <th style={th}>Amount</th><th style={th}>Status</th>
                    <th style={th}>Coupon</th><th style={th}>Date</th>
                  </tr></thead>
                  <tbody>{detail.purchases.map(p => (
                    <tr key={p.id}>
                      <td style={{ ...td, fontWeight: 600 }}>${(p.amount_cents / 100).toFixed(2)}</td>
                      <td style={td}><StatusBadge status={p.status} /></td>
                      <td style={td}>{p.coupon_code || "—"}</td>
                      <td style={td}>{fmtDate(p.created_at)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function StatusBadge({ status }) {
  const colors = {
    completed: { bg: "#e8f5e9", color: "#2e7d32" },
    pending:   { bg: "#fff3e0", color: "#e65100" },
    refunded:  { bg: "#fce4ec", color: "#c62828" },
  };
  const c = colors[status] || { bg: "#f5f5f5", color: "#666" };
  return (
    <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11,
      fontWeight: 700, background: c.bg, color: c.color }}>
      {status}
    </span>
  );
}

export function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const searchInput = {
  width: "100%", padding: "8px 12px", border: "1px solid #ddd",
  borderRadius: 8, fontSize: 13, outline: "none",
};

const deleteBtn = {
  padding: "4px 12px", background: "#fce4ec", color: "#c62828",
  border: "1px solid #ffcdd2", borderRadius: 6, fontSize: 12,
  fontWeight: 600, cursor: "pointer",
};

const closeBtn = {
  background: "none", border: "none", cursor: "pointer",
  fontSize: 16, color: "#aaa", padding: 4,
};
