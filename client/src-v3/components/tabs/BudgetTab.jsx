// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — BudgetTab.jsx
// Ported from V2. Uses useEventData for Supabase persistence.
// Recharts used for Budget Insights charts (already installed as project dep).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend, ResponsiveContainer,
} from "recharts";
import { useEventData }       from "@/hooks/useEventData.js";
import { useSearchHighlight } from "@/hooks/useSearchHighlight.js";
import { TIPPABLE_CATEGORIES, EXPENSE_CATEGORIES } from "@/constants/budget.js";
import { newExpenseId }       from "@/utils/ids.js";
import { getDueStatus, getNextDue } from "@/utils/vendors.js";
import { exportExpensesCSV }  from "@/utils/exports.js";
import { ArchivedNotice }     from "@/components/shared/ArchivedNotice.jsx";
import { VendorQuickView }    from "@/components/shared/VendorQuickView.jsx";
import { VendorModal }        from "@/components/shared/VendorModal.jsx";

// ── Chart colors ──────────────────────────────────────────────────────────────
const CHART_COLORS = [
  "var(--accent-primary)", "var(--gold)", "var(--green)", "var(--blue)",
  "var(--orange)", "var(--accent-medium)", "var(--gold-medium)", "#82bca0",
  "#a98fd4", "#70bcbc", "#e8a0b0", "#d4946a",
];

function fmt$(n) { return "$" + (parseFloat(n)||0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }

// ── BudgetTab ─────────────────────────────────────────────────────────────────

function BudgetInsights({ expenses, catRows, catPaid, catBudgeted, hasAnyBudgeted }) {
  const [open, setOpen] = useState(true);

  // ── Chart 1: Spend by Category ─────────────────────────────────────────
  const categoryData = useMemo(() => catRows.map(([cat, total]) => ({
    name: cat.length > 18 ? cat.slice(0, 16) + "…" : cat,
    fullName: cat,
    paid:        catPaid[cat]     || 0,
    outstanding: total - (catPaid[cat] || 0),
    budgeted:    catBudgeted[cat] || 0,
    total,
  })), [catRows, catPaid, catBudgeted]);

  // ── Chart 2: Payment Timeline ──────────────────────────────────────────
  // Unpaid expenses with a dueDate, grouped by month (YYYY-MM)
  const timelineData = useMemo(() => {
    const byMonth = {};
    expenses
      .filter(e => !e.paid && e.dueDate)
      .forEach(e => {
        const d = new Date(e.dueDate + "T00:00:00");
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
        if (!byMonth[key]) byMonth[key] = { key, label, amount: 0, count: 0 };
        byMonth[key].amount += parseFloat(e.amount) || 0;
        byMonth[key].count  += 1;
      });
    return Object.values(byMonth).sort((a, b) => a.key.localeCompare(b.key));
  }, [expenses]);

  // ── Chart 3: Est. vs. Actual ───────────────────────────────────────────
  const varianceData = useMemo(() => {
    if (!hasAnyBudgeted) return [];
    return catRows
      .filter(([cat]) => (catBudgeted[cat] || 0) > 0)
      .map(([cat, actual]) => ({
        name:     cat.length > 18 ? cat.slice(0, 16) + "…" : cat,
        fullName: cat,
        actual,
        budgeted: catBudgeted[cat] || 0,
      }))
      .sort((a, b) => b.budgeted - a.budgeted);
  }, [catRows, catBudgeted, hasAnyBudgeted]);

  const hasTimeline = timelineData.length > 0;
  const hasVariance = varianceData.length > 0;

  if (categoryData.length === 0) return null;

  // ── Shared tooltip formatter ───────────────────────────────────────────
  const fmtUSD = (v) => `$${(v||0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const CategoryTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div className="budget-chart-tooltip">
        <div className="budget-chart-tooltip-title">{d?.fullName || label}</div>
        <div className="budget-chart-tooltip-row">
          <span className="budget-chart-tooltip-dot" style={{ background: "var(--accent-primary)" }} />
          <span>Paid</span><span>{fmtUSD(d?.paid)}</span>
        </div>
        <div className="budget-chart-tooltip-row">
          <span className="budget-chart-tooltip-dot" style={{ background: "var(--accent-medium)", opacity: 0.6 }} />
          <span>Outstanding</span><span>{fmtUSD(d?.outstanding)}</span>
        </div>
        <div className="budget-chart-tooltip-row" style={{ borderTop: "1px solid var(--border)", paddingTop: 4, marginTop: 4 }}>
          <span className="budget-chart-tooltip-dot" style={{ background: "transparent", border: "1px solid var(--text-muted)" }} />
          <span>Total</span><span style={{ fontWeight: 700 }}>{fmtUSD(d?.total)}</span>
        </div>
        {d?.budgeted > 0 && (
          <div className="budget-chart-tooltip-row" style={{ color: "var(--text-muted)" }}>
            <span className="budget-chart-tooltip-dot" style={{ background: "var(--gold)" }} />
            <span>Budgeted</span><span>{fmtUSD(d?.budgeted)}</span>
          </div>
        )}
      </div>
    );
  };

  const TimelineTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div className="budget-chart-tooltip">
        <div className="budget-chart-tooltip-title">{d?.label || label}</div>
        <div className="budget-chart-tooltip-row">
          <span className="budget-chart-tooltip-dot" style={{ background: "var(--red)" }} />
          <span>Due</span><span style={{ fontWeight: 700 }}>{fmtUSD(d?.amount)}</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
          {d?.count} payment{d?.count !== 1 ? "s" : ""}
        </div>
      </div>
    );
  };

  const VarianceTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    const diff = (d?.actual || 0) - (d?.budgeted || 0);
    return (
      <div className="budget-chart-tooltip">
        <div className="budget-chart-tooltip-title">{d?.fullName || label}</div>
        <div className="budget-chart-tooltip-row">
          <span className="budget-chart-tooltip-dot" style={{ background: "var(--accent-primary)" }} />
          <span>Actual</span><span style={{ fontWeight: 700 }}>{fmtUSD(d?.actual)}</span>
        </div>
        <div className="budget-chart-tooltip-row">
          <span className="budget-chart-tooltip-dot" style={{ background: "var(--gold)" }} />
          <span>Budgeted</span><span>{fmtUSD(d?.budgeted)}</span>
        </div>
        {diff !== 0 && (
          <div className="budget-chart-tooltip-row" style={{
            borderTop: "1px solid var(--border)", paddingTop: 4, marginTop: 4,
            color: diff > 0 ? "var(--red)" : "var(--green)", fontWeight: 600,
          }}>
            <span>{diff > 0 ? "▲ Over" : "▼ Under"}</span>
            <span>{fmtUSD(Math.abs(diff))}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="card budget-insights" style={{ marginBottom: 20 }}>
      {/* Header */}
      <div className="budget-insights-header" onClick={() => setOpen(o => !o)}>
        <div>
          <div className="card-title" style={{ marginBottom: 0 }}>📊 Budget Insights</div>
          {!open && (
            <div className="card-subtitle" style={{ marginBottom: 0, marginTop: 4 }}>
              {categoryData.length} categor{categoryData.length !== 1 ? "ies" : "y"}
              {hasTimeline && ` · ${timelineData.length} payment month${timelineData.length !== 1 ? "s" : ""} ahead`}
              {hasVariance && ` · ${varianceData.length} estimated`}
              {" · click to expand"}
            </div>
          )}
        </div>
        <button className="budget-insights-toggle" aria-label={open ? "Collapse" : "Expand"}>
          {open ? "▴" : "▾"}
        </button>
      </div>

      {open && (
        <div className="budget-insights-body">

          {/* ── Chart 1: Spend by Category ─────────────────────────── */}
          <div className="budget-chart-section">
            <div className="budget-chart-title">Spend by Category</div>
            <div className="budget-chart-legend">
              <span className="budget-chart-legend-item">
                <span className="budget-chart-legend-swatch" style={{ background: "var(--accent-primary)" }} />
                Paid
              </span>
              <span className="budget-chart-legend-item">
                <span className="budget-chart-legend-swatch" style={{ background: "var(--accent-medium)", opacity: 0.5 }} />
                Outstanding
              </span>
            </div>
            <ResponsiveContainer width="100%" height={Math.max(160, categoryData.length * 36)}>
              <BarChart
                data={categoryData}
                layout="vertical"
                margin={{ top: 4, right: 60, left: 0, bottom: 4 }}
                barSize={14}
              >
                <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(0)+"k" : v}`}
                  tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: "var(--font-body)" }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  type="category" dataKey="name" width={110}
                  tick={{ fontSize: 12, fill: "var(--text-primary)", fontFamily: "var(--font-body)" }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip content={<CategoryTooltip />} cursor={{ fill: "var(--bg-subtle)" }} />
                <Bar dataKey="paid" stackId="a" fill="var(--accent-primary)" radius={[0,0,0,0]} />
                <Bar dataKey="outstanding" stackId="a" fill="var(--accent-medium)" fillOpacity={0.45}
                  radius={[0, 3, 3, 0]}>
                  <LabelList
                    dataKey="total"
                    position="right"
                    formatter={v => `$${v >= 1000 ? (v/1000).toFixed(0)+"k" : v}`}
                    style={{ fontSize: 11, fill: "var(--text-secondary)", fontFamily: "var(--font-body)" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Chart 2: Payment Timeline ──────────────────────────── */}
          {hasTimeline && (
            <div className="budget-chart-section">
              <div className="budget-chart-title">Upcoming Payments</div>
              <div className="budget-chart-subtitle">
                Unpaid expenses with a due date, grouped by month
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={timelineData}
                  margin={{ top: 4, right: 20, left: 0, bottom: 4 }}
                  barSize={32}
                >
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: "var(--font-body)" }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(0)+"k" : v}`}
                    tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: "var(--font-body)" }}
                    axisLine={false} tickLine={false} width={44}
                  />
                  <Tooltip content={<TimelineTooltip />} cursor={{ fill: "var(--bg-subtle)" }} />
                  <Bar dataKey="amount" radius={[3, 3, 0, 0]}>
                    {timelineData.map((entry, i) => (
                      <Cell
                        key={entry.key}
                        fill={i === 0 ? "var(--red)" : "var(--accent-primary)"}
                        fillOpacity={i === 0 ? 0.85 : 0.7}
                      />
                    ))}
                    <LabelList
                      dataKey="amount"
                      position="top"
                      formatter={v => `$${v >= 1000 ? (v/1000).toFixed(0)+"k" : v}`}
                      style={{ fontSize: 11, fill: "var(--text-secondary)", fontFamily: "var(--font-body)" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Chart 3: Est. vs. Actual ───────────────────────────── */}
          {hasVariance && (
            <div className="budget-chart-section">
              <div className="budget-chart-title">Est. vs. Actual</div>
              <div className="budget-chart-subtitle">
                Only categories with a budget estimate set
              </div>
              <div className="budget-chart-legend">
                <span className="budget-chart-legend-item">
                  <span className="budget-chart-legend-swatch" style={{ background: "var(--accent-primary)" }} />
                  Actual
                </span>
                <span className="budget-chart-legend-item">
                  <span className="budget-chart-legend-swatch" style={{ background: "var(--gold)" }} />
                  Budgeted
                </span>
              </div>
              <ResponsiveContainer width="100%" height={Math.max(160, varianceData.length * 48)}>
                <BarChart
                  data={varianceData}
                  layout="vertical"
                  margin={{ top: 4, right: 60, left: 0, bottom: 4 }}
                  barSize={12}
                  barGap={3}
                >
                  <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(0)+"k" : v}`}
                    tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: "var(--font-body)" }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    type="category" dataKey="name" width={110}
                    tick={{ fontSize: 12, fill: "var(--text-primary)", fontFamily: "var(--font-body)" }}
                    axisLine={false} tickLine={false}
                  />
                  <Tooltip content={<VarianceTooltip />} cursor={{ fill: "var(--bg-subtle)" }} />
                  <Bar dataKey="actual" radius={[0, 3, 3, 0]}>
                    {varianceData.map((entry) => (
                      <Cell
                        key={entry.fullName}
                        fill={entry.actual > entry.budgeted ? "var(--red)" : "var(--accent-primary)"}
                        fillOpacity={0.85}
                      />
                    ))}
                    <LabelList
                      dataKey="actual"
                      position="right"
                      formatter={v => `$${v >= 1000 ? (v/1000).toFixed(0)+"k" : v}`}
                      style={{ fontSize: 11, fill: "var(--text-secondary)", fontFamily: "var(--font-body)" }}
                    />
                  </Bar>
                  <Bar dataKey="budgeted" fill="var(--gold)" fillOpacity={0.5} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

        </div>
      )}
    </div>
  );
}


export function BudgetTab({ eventId, event, adminConfig, showToast, isArchived, searchHighlight, clearSearchHighlight }) {
  const { items: expenses, loading: eLoading, save, remove } = useEventData(eventId, "expenses");
  const { items: vendors,  loading: vLoading }                = useEventData(eventId, "vendors");

  const [showAdd,        setShowAdd]        = useState(false);
  const [editing,        setEditing]        = useState(null);
  const [vendorQuick,    setVendorQuick]    = useState(null);
  const [showVendorAdd,  setShowVendorAdd]  = useState(false);
  const [editingVendor,  setEditingVendor]  = useState(null);
  const [filterCat,      setFilterCat]      = useState("All");
  const [filterPaid,     setFilterPaid]     = useState("All");
  const [filterVendor,   setFilterVendor]   = useState("All");
  const [filterSection,  setFilterSection]  = useState("All");
  const [search,         setSearch]         = useState("");
  const [insightsOpen,   setInsightsOpen]   = useState(false);
  const [viewMode,       setViewMode]       = useState("list"); // list | timeline

  const { items: vendorsForExpense } = useEventData(eventId, "vendors");
  useSearchHighlight(searchHighlight, clearSearchHighlight, "budget");

  // Timeline sections from adminConfig
  const timelineSections = (adminConfig?.timeline || []).filter(t => t.title);

  // ── Stats ────────────────────────────────────────────────────────────────
  const totalExpenses = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalPaid     = expenses.filter(e => e.paid).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalUnpaid   = totalExpenses - totalPaid;
  const hasBudgeted   = expenses.some(e => e.budgeted && parseFloat(e.budgeted) > 0);
  const totalBudgeted = expenses.reduce((s, e) => s + (parseFloat(e.budgeted) || 0), 0);
  const variance      = totalBudgeted > 0 ? totalExpenses - totalBudgeted : null;
  const nextDue       = getNextDue(expenses);

  // ── Filtered expenses ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return expenses.filter(e => {
      if (filterPaid === "paid"   && !e.paid)  return false;
      if (filterPaid === "unpaid" && e.paid)   return false;
      if (filterCat !== "All"    && e.category !== filterCat)  return false;
      if (filterVendor !== "All" && e.vendorId !== filterVendor) return false;
      if (filterSection !== "All" && e.eventSection !== filterSection) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!e.description?.toLowerCase().includes(q) && !(e.notes||"").toLowerCase().includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      if (a.paid !== b.paid) return a.paid ? 1 : -1;
      const dA = a.dueDate || "9999", dB = b.dueDate || "9999";
      return dA.localeCompare(dB);
    });
  }, [expenses, filterPaid, filterCat, filterVendor, filterSection, search]);

  // ── Category breakdown ───────────────────────────────────────────────────
  const catBreakdown = useMemo(() => {
    const map = {};
    expenses.forEach(e => {
      const cat = e.category || "Uncategorized";
      if (!map[cat]) map[cat] = { total: 0, paid: 0 };
      map[cat].total += parseFloat(e.amount) || 0;
      if (e.paid) map[cat].paid += parseFloat(e.amount) || 0;
    });
    return Object.entries(map).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total);
  }, [expenses]);

  const togglePaid = async (expense) => {
    const updated = { ...expense, paid: !expense.paid };
    if (!expense.paid && !expense.datePaid) updated.datePaid = new Date().toISOString().slice(0, 10);
    await save(updated);
    showToast(updated.paid ? "Marked as paid ✓" : "Marked as unpaid");
  };

  const handleSave = async (data) => {
    await save(data);
    setShowAdd(false);
    setEditing(null);
    showToast(editing ? "Expense updated" : "Expense added");
  };

  const handleDelete = async (e) => {
    await remove(e._rowId);
    showToast("Expense deleted");
  };

  const handleExport = () => {
    const csv = exportExpensesCSV(expenses);
    navigator.clipboard.writeText(csv).then(() => showToast("CSV copied to clipboard"));
  };

  if (eLoading || vLoading) return <div style={loadingStyle}>Loading budget…</div>;

  const vendorMap = Object.fromEntries(vendors.map(v => [v.id, v]));

  return (
    <div>
      {isArchived && <ArchivedNotice />}

      <div className="section-header">
        <div>
          <div className="section-title">Budget</div>
          <div className="section-subtitle">{expenses.length} expenses · {fmt$(totalPaid)} paid of {fmt$(totalExpenses)}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {expenses.length > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={handleExport}>↓ Export CSV</button>
          )}
          {!isArchived && (
            <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setShowAdd(true); }}>
              + Add Expense
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="budget-stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total Expenses</div>
          <div className="stat-value">{fmt$(totalExpenses)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Paid</div>
          <div className="stat-value stat-green">{fmt$(totalPaid)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Outstanding</div>
          <div className="stat-value" style={{ color: totalUnpaid > 0 ? "var(--red)" : "var(--text-primary)" }}>{fmt$(totalUnpaid)}</div>
        </div>
        {hasBudgeted && (
          <div className="stat-card">
            <div className="stat-label">Est. vs. Actual</div>
            <div className="stat-value" style={{ color: variance >= 0 ? "var(--red)" : "var(--green)" }}>
              {variance >= 0 ? "+" : ""}{fmt$(variance)}
            </div>
            <div className="stat-sub">{fmt$(totalBudgeted)} budgeted</div>
          </div>
        )}
        {nextDue && (
          <div className="stat-card">
            <div className="stat-label">Next Payment Due</div>
            <div className="stat-value stat-gold">{fmt$(nextDue.amount)}</div>
            <div className="stat-sub">{new Date(nextDue.dueDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
          </div>
        )}
      </div>

      {/* Category breakdown bar */}
      {catBreakdown.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          {catBreakdown.slice(0, 6).map((c, i) => {
            const paidPct   = c.total > 0 ? (c.paid / c.total) * 100 : 0;
            const unpaidPct = 100 - paidPct;
            return (
              <div key={c.name} className="budget-bar-row">
                <div className="budget-bar-meta">
                  <span className="budget-bar-label">{c.name}</span>
                  <span className="budget-bar-amount">{fmt$(c.total)}<span className="budget-bar-pct">({Math.round((c.total/totalExpenses)*100)}%)</span></span>
                </div>
                <div className="budget-bar-track">
                  <div className="budget-bar-fill" style={{ width: "100%" }}>
                    <div className="budget-bar-paid"   style={{ width: `${paidPct}%` }} />
                    <div className="budget-bar-unpaid" style={{ left: `${paidPct}%`, width: `${unpaidPct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Budget Insights (collapsible) */}
      {expenses.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="budget-insights-header" onClick={() => setInsightsOpen(o => !o)}>
            <div className="card-title" style={{ marginBottom: 0 }}>📊 Budget Insights</div>
            <button className="budget-insights-toggle">{insightsOpen ? "▲" : "▼"}</button>
          </div>
          {insightsOpen && (
            <div className="budget-insights-body">
              {/* Spend by Category pie */}
              {catBreakdown.length > 0 && (
                <div className="budget-chart-section">
                  <div className="budget-chart-title">Spend by Category</div>
                  <div className="budget-chart-subtitle">Total expenses by category</div>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={catBreakdown} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({name, percent}) => `${name} ${Math.round(percent*100)}%`} labelLine={false}>
                        {catBreakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={v => fmt$(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Paid vs Outstanding bar */}
              <div className="budget-chart-section">
                <div className="budget-chart-title">Paid vs. Outstanding by Category</div>
                <ResponsiveContainer width="100%" height={Math.max(200, catBreakdown.length * 36)}>
                  <BarChart data={catBreakdown} layout="vertical" margin={{ left: 10, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={v => "$" + (v/1000).toFixed(0) + "k"} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={v => fmt$(v)} />
                    <Bar dataKey="paid"  name="Paid"        stackId="a" fill="var(--green)" />
                    <Bar dataKey="total" name="Outstanding" stackId="a" fill="var(--accent-medium)" opacity={0.5}
                      label={false}
                    />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar">
        <input className="form-input" type="text" placeholder="Search expenses…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-select" value={filterPaid} onChange={e => setFilterPaid(e.target.value)}>
          <option value="All">All</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
        </select>
        <select className="form-select" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="All">All Categories</option>
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {vendors.length > 0 && (
          <select className="form-select" value={filterVendor} onChange={e => setFilterVendor(e.target.value)}>
            <option value="All">All Vendors</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        )}
        {timelineSections.length > 0 && (
          <select className="form-select" value={filterSection} onChange={e => setFilterSection(e.target.value)}>
            <option value="All">All Sections</option>
            {timelineSections.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        )}
      </div>

      {/* Expense list */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
            {expenses.length === 0 ? "No expenses yet — add your first expense." : "No expenses match your filters."}
          </div>
        ) : (
          filtered.map(e => {
            const due = getDueStatus(e);
            const vendor = e.vendorId ? vendorMap[e.vendorId] : null;
            return (
              <div key={e.id || e._rowId} id={`row-${e.id}`} className="expense-row">
                <div className="expense-row-check">
                  <div className={`paid-check ${e.paid ? "checked" : ""}`} onClick={() => !isArchived && togglePaid(e)}>
                    {e.paid && <svg width="10" height="8" viewBox="0 0 10 8"><polyline points="1,4 4,7 9,1" stroke="white" strokeWidth="1.5" fill="none"/></svg>}
                  </div>
                </div>
                <div className="expense-row-body">
                  <div className="expense-row-desc">{e.description}</div>
                  <div className="expense-row-meta">
                    {e.category && <span style={{ marginRight: 6 }}>{e.category}</span>}
                    {vendor && (
                      <button className="vendor-name-link" style={{ fontSize: 11, marginRight: 6 }}
                        onClick={() => setVendorQuick(vendor)}>
                        {vendor.name}
                      </button>
                    )}
                    {e.dueDate && !e.paid && due && (
                      <span className={`expense-row-meta ${due.cls}`}>{due.label}</span>
                    )}
                    {e.paid && e.datePaid && (
                      <span style={{ color: "var(--green)", fontSize: 11 }}>
                        Paid {new Date(e.datePaid + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="expense-row-amount">{fmt$(e.amount)}</div>
                <div className="expense-row-actions">
                  {!isArchived && (<>
                    <button className="icon-btn" style={{ width: 26, height: 26 }} title="Edit" onClick={() => { setEditing(e); setShowAdd(true); }}>✎</button>
                    <button className="icon-btn" style={{ width: 26, height: 26 }} title="Delete" onClick={() => handleDelete(e)}>✕</button>
                  </>)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Gratuity calculator */}
      {expenses.length > 0 && !isArchived && (
        <GratuityCalculator
          expenses={expenses}
          vendors={vendors}
          onAddExpense={async (exp) => { await save(exp); showToast("Gratuity added to budget"); }}
          isArchived={isArchived}
        />
      )}

      {vendorQuick && (
        <VendorQuickView
          vendor={vendorQuick}
          expenses={expenses}
          onEdit={(v) => { setVendorQuick(null); setEditingVendor(v); setShowVendorAdd(true); }}
          onClose={() => setVendorQuick(null)}
          isArchived={isArchived}
        />
      )}

      {showVendorAdd && (
        <VendorModal
          vendor={editingVendor}
          onSave={async (v) => {
            const { items: vItems, save: vSave } = { items: vendors, save: async (d) => d }; // vendors saved via separate hook
            setShowVendorAdd(false);
            setEditingVendor(null);
          }}
          onClose={() => { setShowVendorAdd(false); setEditingVendor(null); }}
          isArchived={isArchived}
        />
      )}

      {showAdd && (
        <ExpenseModal
          expense={editing}
          vendors={vendors}
          adminConfig={adminConfig}
          onSave={handleSave}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          isArchived={isArchived}
        />
      )}
    </div>
  );
}

// ── ExpenseModal ──────────────────────────────────────────────────────────────
export function ExpenseModal({ expense, vendors, adminConfig, onSave, onClose, isArchived }) {
  const blank = { id: newExpenseId(), description: "", category: "", vendorId: "", amount: "", budgeted: "", dueDate: "", datePaid: "", eventSection: "", paid: false, notes: "" };
  const [form, setForm] = useState(expense || blank);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const timeline = (adminConfig?.timeline || []).filter(t => t.title);

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div className="modal-title">{expense ? "Edit Expense" : "Add Expense"}</div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Description *</label>
            <input className="form-input" value={form.description} onChange={e => set("description", e.target.value)} placeholder="What is this expense?" autoFocus />
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={form.category} onChange={e => set("category", e.target.value)}>
                <option value="">Select category…</option>
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Vendor</label>
              <select className="form-select" value={form.vendorId || ""} onChange={e => set("vendorId", e.target.value)}>
                <option value="">No vendor</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Amount ($) *</label>
              <input className="form-input" type="number" min="0" step="0.01" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Budgeted ($)</label>
              <input className="form-input" type="number" min="0" step="0.01" value={form.budgeted || ""} onChange={e => set("budgeted", e.target.value)} placeholder="Estimate" />
              <div className="form-hint">Used in budget vs. actual charts.</div>
            </div>
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Due Date</label>
              <input className="form-input" type="date" value={form.dueDate || ""} onChange={e => set("dueDate", e.target.value)} />
            </div>
            {timeline.length > 0 && (
              <div className="form-group">
                <label className="form-label">Event Section</label>
                <select className="form-select" value={form.eventSection || ""} onChange={e => set("eventSection", e.target.value)}>
                  <option value="">No section</option>
                  {timeline.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className={`paid-check ${form.paid ? "checked" : ""}`} onClick={() => set("paid", !form.paid)}>
              {form.paid && <svg width="10" height="8" viewBox="0 0 10 8"><polyline points="1,4 4,7 9,1" stroke="white" strokeWidth="1.5" fill="none"/></svg>}
            </div>
            <label className="form-label" style={{ margin: 0, textTransform: "none", fontSize: 14, fontWeight: 500 }}>Paid</label>
            {form.paid && (
              <input className="form-input" type="date" value={form.datePaid || ""} onChange={e => set("datePaid", e.target.value)}
                style={{ flex: 1, maxWidth: 180 }} placeholder="Date paid" />
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.notes || ""} onChange={e => set("notes", e.target.value)} placeholder="Payment terms, deposit details…" />
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!form.description?.trim() || !form.amount || isArchived}
              onClick={() => onSave({ ...form })}>
              {expense ? "Save Changes" : "Add Expense"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── GratuityCalculator ────────────────────────────────────────────────────────

export function GratuityCalculator({ expenses, vendors, onAddExpense, isArchived }) {
  const [open,        setOpen]        = useState(true);
  const [selected,    setSelected]    = useState({});   // vendorKey → true/false
  const [customBase,  setCustomBase]  = useState({});   // vendorKey → string override
  const [tipPct,      setTipPct]      = useState(20);   // active preset %
  const [customPct,   setCustomPct]   = useState("");   // custom % input
  const [useCustom,   setUseCustom]   = useState(false);
  const [added,       setAdded]       = useState({});   // vendorKey → true (flash)

  // Build tippable vendor groups from expenses
  const groups = (() => {
    const map = {};
    expenses.forEach(e => {
      if (!TIPPABLE_CATEGORIES.has(e.category)) return;
      if (e.category === "Gratuities & Tips") return;
      const key   = e.vendorId || e.vendor || e.description;
      const label = e.vendorId
        ? (vendors.find(v => v.id === e.vendorId)?.name || e.vendor || e.description)
        : (e.vendor || e.description);
      if (!map[key]) map[key] = { key, label, category: e.category, vendorId: e.vendorId || "", vendorName: label, total: 0 };
      map[key].total += parseFloat(e.amount) || 0;
    });
    return Object.values(map).sort((a, b) => a.label.localeCompare(b.label));
  })();

  // Tip % in use
  const effectivePct = useCustom
    ? (parseFloat(customPct) || 0)
    : tipPct;

  // Tip amount for a group
  const tipAmount = (g) => {
    const base = parseFloat(customBase[g.key]) || g.total;
    return Math.round(base * (effectivePct / 100) * 100) / 100;
  };

  // Total selected tips
  const totalTip = groups
    .filter(g => selected[g.key])
    .reduce((s, g) => s + tipAmount(g), 0);

  // Auto-open when tippable vendors exist and user hasn't explicitly closed
  const hasGroups = groups.length > 0;

  const handleToggle = (key) => {
    setSelected(s => ({ ...s, [key]: !s[key] }));
  };

  const handleAddOne = (g) => {
    if (isArchived) return;
    const amt = tipAmount(g);
    if (amt <= 0) return;
    onAddExpense({
      id:          newExpenseId(),
      description: `Gratuity — ${g.label}`,
      category:    "Gratuities & Tips",
      vendor:      g.vendorName,
      vendorId:    g.vendorId,
      amount:      amt.toFixed(2),
      date:        "",
      dueDate:     "",
      paid:        false,
      notes:       `${effectivePct}% gratuity on $${(parseFloat(customBase[g.key]) || g.total).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    });
    setAdded(a => ({ ...a, [g.key]: true }));
    setTimeout(() => setAdded(a => ({ ...a, [g.key]: false })), 2500);
    
  };

  const handleAddAll = () => {
    if (isArchived) return;
    groups.filter(g => selected[g.key]).forEach(g => handleAddOne(g));
  };

  if (!hasGroups) return null;

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      {/* Header row — always visible */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
        onClick={() => setOpen(o => !o)}>
        <div>
          <div className="card-title" style={{ marginBottom: 0 }}>💵 Gratuity Calculator</div>
          {!open && (
            <div className="card-subtitle" style={{ marginBottom: 0, marginTop: 4 }}>
              {groups.length} tippable vendor{groups.length !== 1 ? "s" : ""} · click to expand
            </div>
          )}
        </div>
        <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18,
          color: "var(--text-muted)", padding: "0 4px", lineHeight: 1 }}>
          {open ? "▴" : "▾"}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 16 }}>
          <div className="card-subtitle" style={{ marginBottom: 16 }}>
            Select vendors to tip, adjust the base amount if needed, then add each tip as a budget line item.
          </div>

          {/* Tip rate selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Tip rate:
            </span>
            {[15, 20, 25].map(pct => (
              <button key={pct}
                onClick={() => { setTipPct(pct); setUseCustom(false); }}
                className={(!useCustom && tipPct === pct) ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}>
                {pct}%
              </button>
            ))}
            <button
              onClick={() => setUseCustom(u => !u)}
              className={useCustom ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}>
              Custom
            </button>
            {useCustom && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="number" min="0" max="100" step="0.5"
                  value={customPct}
                  onChange={e => setCustomPct(e.target.value < 0 ? "0" : e.target.value)}
                  placeholder="e.g. 18"
                  style={{ width: 70, padding: "4px 8px", border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)", fontSize: 13,
                    fontFamily: "var(--font-body)", color: "var(--text-primary)",
                    background: "var(--bg-surface)" }}
                />
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>%</span>
              </div>
            )}
          </div>

          {/* Vendor rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {groups.map(g => {
              const base    = parseFloat(customBase[g.key]) || g.total;
              const tip     = tipAmount(g);
              const isAdded = !!added[g.key];
              // Check if a gratuity line item already exists for this vendor
              const alreadyLogged = expenses.some(e =>
                e.category === "Gratuities & Tips" &&
                (e.vendorId === g.vendorId && g.vendorId ? true : e.vendor === g.vendorName)
              );

              return (
                <div key={g.key} style={{
                  display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                  padding: "12px 14px",
                  background: selected[g.key] ? "var(--accent-light)" : "var(--bg-subtle)",
                  border: `1px solid ${selected[g.key] ? "var(--accent-medium)" : "var(--border)"}`,
                  borderRadius: "var(--radius-md)", transition: "all 0.15s ease",
                }}>
                  {/* Checkbox */}
                  <input type="checkbox"
                    checked={!!selected[g.key]}
                    onChange={() => handleToggle(g.key)}
                    style={{ width: 16, height: 16, accentColor: "var(--accent-primary)", flexShrink: 0, cursor: "pointer" }}
                  />

                  {/* Name + category */}
                  <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {g.label}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {g.category}
                      {alreadyLogged && (
                        <span style={{ marginLeft: 8, color: "var(--green)", fontWeight: 600 }}>
                          ✓ tip already logged
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Base amount override */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Base:</span>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                        fontSize: 13, color: "var(--text-muted)", pointerEvents: "none" }}>$</span>
                      <input
                        type="number" min="0" step="0.01"
                        value={customBase[g.key] !== undefined ? customBase[g.key] : g.total.toFixed(2)}
                        onChange={e => setCustomBase(b => ({ ...b, [g.key]: e.target.value < 0 ? "0" : e.target.value }))}
                        style={{ width: 100, paddingLeft: 20, paddingRight: 6, paddingTop: 4, paddingBottom: 4,
                          border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                          fontSize: 13, fontFamily: "var(--font-body)", color: "var(--text-primary)",
                          background: "var(--bg-surface)" }}
                      />
                    </div>
                  </div>

                  {/* Tip amount */}
                  <div style={{ minWidth: 80, textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "var(--accent-primary)" }}>
                      ${tip.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {effectivePct > 0 ? `@ ${effectivePct}%` : "—"}
                    </div>
                  </div>

                  {/* Add button */}
                  <button
                    className={isAdded ? "btn btn-secondary btn-sm" : "btn btn-primary btn-sm"}
                    disabled={isArchived || tip <= 0 || isAdded}
                    onClick={() => handleAddOne(g)}
                    style={{ flexShrink: 0, minWidth: 90 }}>
                    {isAdded ? "✓ Added" : "+ Add to Budget"}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footer — total + add all selected */}
          {Object.values(selected).some(Boolean) && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              paddingTop: 14, borderTop: "1px solid var(--border)", flexWrap: "wrap", gap: 10 }}>
              <div>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  Selected tip total:{" "}
                </span>
                <span style={{ fontWeight: 700, fontSize: 16, color: "var(--accent-primary)" }}>
                  ${totalTip.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 6 }}>
                  ({groups.filter(g => selected[g.key]).length} vendor{groups.filter(g => selected[g.key]).length !== 1 ? "s" : ""})
                </span>
              </div>
              <button
                className="btn btn-primary btn-sm"
                disabled={isArchived}
                onClick={handleAddAll}>
                + Add All Selected to Budget
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
const loadingStyle = { padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 };
const th = { padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" };
const td = { padding: "10px 12px", verticalAlign: "middle" };
