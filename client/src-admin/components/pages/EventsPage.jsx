// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit Admin — EventsPage.jsx
// All events across all users with owner email and status.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { adminQuery }          from "@/hooks/useAdminQuery.js";
import { PageHeader, PageLoading, PageError, card, tableStyle, th, td } from "./DashboardPage.jsx";
import { fmtDate } from "./UsersPage.jsx";

const EVENT_TYPE_LABELS = {
  "bat-mitzvah":  "Bat Mitzvah",
  "bar-mitzvah":  "Bar Mitzvah",
  "bnei-mitzvah": "B'nei Mitzvah",
  "wedding":      "Wedding",
  "baby-naming":  "Baby Naming",
  "graduation":   "Graduation",
  "anniversary":  "Anniversary",
  "birthday":     "Birthday",
  "other":        "Celebration",
};

export function EventsPage({ token }) {
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [search,  setSearch]  = useState("");
  const [filter,  setFilter]  = useState("all"); // all | active | archived

  useEffect(() => {
    adminQuery(token, "events")
      .then(data => { setEvents(data); setLoading(false); })
      .catch(e  => { setError(e.message); setLoading(false); });
  }, [token]);

  const filtered = events.filter(e => {
    if (filter === "active"   && e.archived)  return false;
    if (filter === "archived" && !e.archived) return false;
    if (search && !e.name?.toLowerCase().includes(search.toLowerCase()) &&
        !e.ownerEmail?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return <PageLoading />;
  if (error)   return <PageError msg={error} />;

  return (
    <div>
      <PageHeader title="Events" sub={`${events.length} total event${events.length !== 1 ? "s" : ""}`} />

      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #eee", display: "flex", gap: 10 }}>
          <input
            style={{ ...searchInput, flex: 1 }}
            type="text"
            placeholder="Search by name or owner email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select style={selectInput} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Event Name</th>
              <th style={th}>Type</th>
              <th style={th}>Owner</th>
              <th style={th}>Status</th>
              <th style={th}>Created</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "#aaa" }}>No events found.</td></tr>
            ) : filtered.map(e => (
              <tr key={e.id}>
                <td style={{ ...td, fontWeight: 600 }}>{e.name || "Unnamed"}</td>
                <td style={td}>{EVENT_TYPE_LABELS[e.type] || e.type}</td>
                <td style={{ ...td, color: "#666" }}>{e.ownerEmail}</td>
                <td style={td}>
                  <span style={{
                    padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: e.archived ? "#f5f5f5" : "#e8f5e9",
                    color:      e.archived ? "#888"    : "#2e7d32",
                  }}>
                    {e.archived ? "Archived" : "Active"}
                  </span>
                </td>
                <td style={td}>{fmtDate(e.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const searchInput = {
  padding: "8px 12px", border: "1px solid #ddd",
  borderRadius: 8, fontSize: 13, outline: "none",
};

const selectInput = {
  padding: "8px 12px", border: "1px solid #ddd",
  borderRadius: 8, fontSize: 13, outline: "none", background: "white",
};
