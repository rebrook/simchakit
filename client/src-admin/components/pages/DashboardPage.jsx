// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit Admin — DashboardPage.jsx
// Revenue summary, key stats, monthly revenue chart.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { adminQuery } from "@/hooks/useAdminQuery.js";

export function DashboardPage({ token }) {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    adminQuery(token, "stats")
      .then(data => { setStats(data); setLoading(false); })
      .catch(e  => { setError(e.message); setLoading(false); });
  }, [token]);

  if (loading) return <PageLoading />;
  if (error)   return <PageError msg={error} />;

  const revenue    = (stats.totalRevenueCents / 100).toFixed(2);
  const chartData  = Object.entries(stats.monthlyRevenue || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, cents]) => ({ month, revenue: cents / 100 }));

  return (
    <div>
      <PageHeader title="Dashboard" sub="Brook Creative LLC — SimchaKit Platform" />

      <div style={grid4}>
        <StatCard label="Total Users"     value={stats.userCount}     />
        <StatCard label="Total Events"    value={stats.eventCount}    />
        <StatCard label="Purchases"       value={stats.purchaseCount} />
        <StatCard label="Total Revenue"   value={`$${revenue}`} accent />
      </div>

      <div style={card}>
        <div style={cardTitle}>Monthly Revenue (last 6 months)</div>
        {chartData.length === 0 ? (
          <div style={empty}>No revenue data yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${v}`} />
              <Tooltip formatter={v => [`$${v.toFixed(2)}`, "Revenue"]} />
              <Bar dataKey="revenue" fill="#111" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div style={{ ...card, textAlign: "center" }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase",
        letterSpacing: "0.06em", color: "#888", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700,
        color: accent ? "#111" : "#333" }}>{value}</div>
    </div>
  );
}

// ── Shared layout helpers ─────────────────────────────────────────────────────
export function PageHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#111" }}>{title}</div>
      {sub && <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function PageLoading() {
  return <div style={{ color: "#888", fontSize: 14, padding: "48px 0", textAlign: "center" }}>Loading…</div>;
}

export function PageError({ msg }) {
  return <div style={{ color: "#c00", fontSize: 13, padding: "24px 0" }}>Error: {msg}</div>;
}

export const card = {
  background: "white", borderRadius: 10, padding: "20px 24px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #eee",
  marginBottom: 20,
};

export const cardTitle = {
  fontSize: 14, fontWeight: 600, color: "#333", marginBottom: 16,
};

export const grid4 = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 16, marginBottom: 20,
};

export const empty = {
  fontSize: 13, color: "#aaa", textAlign: "center", padding: "24px 0",
};

export const tableStyle = {
  width: "100%", borderCollapse: "collapse", fontSize: 13,
};

export const th = {
  textAlign: "left", padding: "8px 12px", fontSize: 11, fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.05em", color: "#888",
  borderBottom: "2px solid #eee", background: "#fafafa",
};

export const td = {
  padding: "10px 12px", borderBottom: "1px solid #f5f5f5", color: "#333",
  verticalAlign: "middle",
};
