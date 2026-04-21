// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — BudgetTab.jsx
// Ported from V2. Uses useEventData for Supabase persistence.
// Recharts used for Budget Insights charts (already installed as project dep).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
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

// ── BudgetInsights ───────────────────────────────────────────────────────────
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

// ── BudgetTab ─────────────────────────────────────────────────────────────────
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
  const [insightsOpen,     setInsightsOpen]     = useState(false);
  const [expandedNotes,    setExpandedNotes]    = useState({});
  const [pendingPaidId,    setPendingPaidId]    = useState(null);
  const [pendingPaidIdx,   setPendingPaidIdx]   = useState(null);
  const [pendingPaidDate,  setPendingPaidDate]  = useState("");
  const [sortBy,           setSortBy]           = useState("due");
  const [expandedVendors,  setExpandedVendors]  = useState({});
  const [expandedSections, setExpandedSections] = useState({});
  const [viewMode,         setViewMode]         = useState("list"); // list | vendor | section

  const toggleVendorGroup  = (key) => setExpandedVendors(v  => ({ ...v,  [key]: !v[key]  }));
  const toggleSectionGroup = (key) => setExpandedSections(s => ({ ...s, [key]: !s[key] }));

  const { items: vendorsForExpense } = useEventData(eventId, "vendors");
  useSearchHighlight(searchHighlight, clearSearchHighlight, "budget");

  // Timeline sections from adminConfig
  const timelineSections = (adminConfig?.timeline || []).filter(t => t.title);

  // ── Stats ────────────────────────────────────────────────────────────────
  const totalExpenses     = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalPaid         = expenses.filter(e => e.paid).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalUnpaid       = totalExpenses - totalPaid;
  const unpaidCount       = expenses.filter(e => !e.paid).length;
  const hasBudgeted       = expenses.some(e => e.budgeted && parseFloat(e.budgeted) > 0);
  const hasAnyBudgeted    = hasBudgeted;
  const totalBudgeted     = expenses.reduce((s, e) => s + (parseFloat(e.budgeted) || 0), 0);
  const estimatedItems    = expenses.filter(e => parseFloat(e.budgeted) > 0);
  const actualOfEstimated = estimatedItems.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalVariance     = hasBudgeted ? actualOfEstimated - totalBudgeted : 0;
  const variance          = totalBudgeted > 0 ? totalExpenses - totalBudgeted : null;
  const nextDue           = getNextDue(expenses);

  // ── Category breakdown for BudgetInsights ─────────────────────────────────
  const catTotals   = {};
  const catPaid     = {};
  const catBudgeted = {};
  expenses.forEach(e => {
    const cat = e.category || "Miscellaneous";
    catTotals[cat]   = (catTotals[cat]   || 0) + (parseFloat(e.amount)   || 0);
    if (e.paid) catPaid[cat] = (catPaid[cat] || 0) + (parseFloat(e.amount) || 0);
    if (parseFloat(e.budgeted) > 0) catBudgeted[cat] = (catBudgeted[cat] || 0) + (parseFloat(e.budgeted) || 0);
  });
  const catRows = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

  // ── Derived for filter bar and view modes ──────────────────────────────────
  const usedCats = [...new Set(expenses.map(e => e.category).filter(Boolean))].sort();
  const sectionList = [
    "All Events",
    ...((adminConfig?.timeline || [])
      .filter(e => e.title && e.startDate)
      .sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""))
      .map(e => e.title)
    ),
  ];
  const hasSections = sectionList.length > 1;

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
      switch (sortBy) {
        case "due": {
          const aDue = !a.paid && a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const bDue = !b.paid && b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          if (aDue !== bDue) return aDue - bDue;
          return (a.description || "").localeCompare(b.description || "");
        }
        case "amount-desc": return (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0);
        case "amount-asc":  return (parseFloat(a.amount) || 0) - (parseFloat(b.amount) || 0);
        case "description": return (a.description || "").localeCompare(b.description || "");
        case "category":    return (a.category || "").localeCompare(b.category || "") || (a.description || "").localeCompare(b.description || "");
        case "date-desc":   return (b.date || "").localeCompare(a.date || "");
        default: return 0;
      }
    });
  }, [expenses, filterPaid, filterCat, filterVendor, filterSection, search, sortBy]);

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

  // ── Vendor groups (By Vendor view) ──────────────────────────────────────────
  const vendorGroups = (() => {
    const groups = {};
    filtered.forEach(e => {
      const key   = e.vendorId || "__other__";
      const label = e.vendorId
        ? (vendors.find(v => v.id === e.vendorId)?.name || e.vendor || "Unknown Vendor")
        : (e.vendor || "Other / Unlinked");
      if (!groups[key]) groups[key] = { key, label, vendorId: e.vendorId || null, items: [], contracted: 0, paid: 0 };
      groups[key].items.push(e);
      groups[key].contracted += parseFloat(e.amount) || 0;
      if (e.paid) groups[key].paid += parseFloat(e.amount) || 0;
    });
    return Object.values(groups).sort((a, b) => {
      if (a.key === "__other__") return 1;
      if (b.key === "__other__") return -1;
      return b.contracted - a.contracted;
    });
  })();

  // ── Section groups (By Timeline view) ────────────────────────────────────────
  const sectionGroups = (() => {
    const groups = {};
    filtered.forEach(e => {
      const key   = e.eventSection || "";
      const label = key || "All Events";
      if (!groups[key]) groups[key] = { key, label, items: [], total: 0, paid: 0 };
      groups[key].items.push(e);
      groups[key].total += parseFloat(e.amount) || 0;
      if (e.paid) groups[key].paid += parseFloat(e.amount) || 0;
    });
    return Object.values(groups).sort((a, b) => {
      if (a.key === "") return 1;
      if (b.key === "") return -1;
      const ai = sectionList.indexOf(a.label);
      const bi = sectionList.indexOf(b.label);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  })();

  const fmt = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

  const togglePaid = async (expense) => {
    const updated = { ...expense, paid: !expense.paid };
    if (!expense.paid && !expense.datePaid) updated.datePaid = new Date().toISOString().slice(0, 10);
    await save(updated);
    showToast(updated.paid ? "Marked as paid ✓" : "Marked as unpaid");
  };

  const confirmPaid = async () => {
    if (!pendingPaidId) return;
    const exp = expenses.find(e => (e.id || e._rowId) === pendingPaidId);
    if (!exp) return;
    await save({ ...exp, paid: true, datePaid: pendingPaidDate || new Date().toISOString().slice(0, 10) });
    showToast("Marked paid");
    setPendingPaidId(null); setPendingPaidIdx(null); setPendingPaidDate("");
  };

  const cancelPaid = () => {
    setPendingPaidId(null); setPendingPaidIdx(null); setPendingPaidDate("");
  };

  const toggleNotes = (id) => setExpandedNotes(n => ({ ...n, [id]: !n[id] }));

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
        {hasAnyBudgeted && (
          <div className="stat-card">
            <div className="stat-label">Est. vs. Actual</div>
            <div className={`stat-value ${totalVariance > 0 ? "stat-red" : totalVariance < 0 ? "stat-green" : ""}`}>
              {totalVariance > 0 ? "▲ Over Budget" : totalVariance < 0 ? "▼ Under Budget" : "On Budget"}
            </div>
            <div className="stat-sub">
              {totalVariance !== 0
                ? `${Math.abs(totalVariance).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${totalVariance > 0 ? "over" : "under"} estimate`
                : "Exactly on estimate"}
              {" · "}{estimatedItems.length} estimated item{estimatedItems.length !== 1 ? "s" : ""}
            </div>
          </div>
        )}
        <div className="stat-card">
          <div className="stat-label">Next Payment Due</div>
          {nextDue ? (<>
            <div className="stat-value stat-gold" style={{ fontSize: 18, marginTop: 2 }}>
              {new Date(nextDue.dueDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
            <div className="stat-sub">{nextDue.description} · {fmt$(parseFloat(nextDue.amount || 0))}</div>
          </>) : (
            <div className="stat-value" style={{ fontSize: 16, marginTop: 4, color: "var(--text-muted)" }}>None</div>
          )}
        </div>
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

      {/* Budget Insights */}
      <BudgetInsights
        expenses={expenses}
        catRows={catRows}
        catPaid={catPaid}
        catBudgeted={catBudgeted}
        hasAnyBudgeted={hasAnyBudgeted}
      />

      {/* Filters + sort + view mode */}
      <div className="filter-bar">
        <input className="form-input" type="text" placeholder="Search expenses…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-select" value={filterPaid} onChange={e => setFilterPaid(e.target.value)}>
          <option value="All">All</option>
          <option value="paid">Paid only</option>
          <option value="unpaid">Unpaid only</option>
        </select>
        {usedCats.length > 1 && (
          <select className="form-select" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="All">All categories</option>
            {usedCats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {vendors.length > 0 && (
          <select className="form-select" value={filterVendor} onChange={e => setFilterVendor(e.target.value)}>
            <option value="All">All Vendors</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        )}
        {hasSections && (
          <select className="form-select" value={filterSection} onChange={e => setFilterSection(e.target.value)}>
            <option value="All">All sections</option>
            {sectionList.map(s => (
              <option key={s} value={s === "All Events" ? "All" : s}>{s}</option>
            ))}
          </select>
        )}
        <select className="form-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="due">Sort: Due date</option>
          <option value="amount-desc">Sort: Amount (high → low)</option>
          <option value="amount-asc">Sort: Amount (low → high)</option>
          <option value="description">Sort: Description A–Z</option>
          <option value="category">Sort: Category A–Z</option>
          <option value="date-desc">Sort: Date paid (newest)</option>
        </select>
        <div style={{ display:"flex", gap:2, background:"var(--bg-subtle)", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", padding:2, marginLeft:"auto", flexShrink:0 }}>
          {[
            { id:"list",    icon:"☰",  label:"List"        },
            { id:"vendor",  icon:"🏢", label:"By Vendor"   },
            ...(hasSections ? [{ id:"section", icon:"📅", label:"By Timeline" }] : []),
          ].map(v => (
            <button key={v.id} title={v.label} onClick={() => setViewMode(v.id)}
              style={{ padding:"4px 10px", border:"none", borderRadius:4, cursor:"pointer", fontSize:12, fontWeight:600,
                background: viewMode === v.id ? "var(--bg-surface)" : "transparent",
                color: viewMode === v.id ? "var(--accent-primary)" : "var(--text-muted)",
                boxShadow: viewMode === v.id ? "var(--shadow-sm)" : "none",
                transition:"all 0.15s ease" }}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Expense list */}
      <div className="card">
        {expenses.length === 0 && (
          <div style={{ textAlign:"center", padding:"48px 24px", color:"var(--text-muted)" }}>
            <div style={{ fontSize:36, marginBottom:12, opacity:0.4 }}>💰</div>
            <div style={{ fontFamily:"var(--font-display)", fontSize:18, marginBottom:6, color:"var(--text-primary)" }}>No expenses yet — add your first expense.</div>
            {!isArchived && <button className="btn btn-primary" style={{ marginTop:12 }} onClick={() => { setEditing(null); setShowAdd(true); }}>+ Add Expense</button>}
          </div>
        )}
        {expenses.length > 0 && filtered.length === 0 && (
          <div style={{ textAlign:"center", padding:"32px 16px", color:"var(--text-muted)", fontSize:13 }}>
            No expenses match your filters.
          </div>
        )}
        {/* Expense rows — list view */}
        {viewMode === "list" && filtered.length > 0 && (
          <div>
            {filtered.map((e, eIdx) => {
              const dueStatus  = getDueStatus(e);
              const hasNotes   = !!(e.notes && e.notes.trim());
              const notesOpen  = !!expandedNotes[e.id];
              const linkedVendor = e.vendorId ? vendors.find(v => v.id === e.vendorId) : null;
              const preMeta  = e.category ? [e.category] : [];
              const postMeta = (e.paid && e.date) ? [`Paid ${fmt(e.date)}`] : [];
              return (
                <div key={e.id} id={`row-${e.id}`} className="expense-row" style={{opacity: e.paid ? 0.7 : 1}}>
                  <div className="expense-row-check">
                    <div
                      className={`paid-check ${e.paid ? "checked" : ""}`}
                      onClick={() => togglePaid(e.id, eIdx)}
                      title={e.paid ? "Mark as unpaid" : "Mark as paid"}
                    >
                      {e.paid && (
                        <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                          <path d="M1 4.5L4 7.5L10 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </div>
                  <div className="expense-row-body">
                    <div className="expense-row-desc">{e.description}</div>
                    <div className="expense-row-meta">
                      {preMeta.join(" · ")}
                      {e.vendor && (
                        <>
                          {preMeta.length > 0 && " · "}
                          {linkedVendor ? (
                            <button className="vendor-name-link"
                              style={{fontSize:11,fontWeight:600,color:"var(--accent-primary)"}}
                              onClick={() => setVendorQuick(linkedVendor)}>
                              {e.vendor}
                            </button>
                          ) : (
                            <span>{e.vendor}</span>
                          )}
                        </>
                      )}
                      {postMeta.length > 0 && (
                        <span>{(preMeta.length > 0 || e.vendor) ? " · " : ""}{postMeta.join(" · ")}</span>
                      )}
                      {dueStatus && (
                        <span className={dueStatus.cls}> · {dueStatus.label}</span>
                      )}
                      {hasNotes && (
                        <button
                          style={{background:"none",border:"none",cursor:"pointer",
                            fontSize:11,color:"var(--text-muted)",padding:"0 0 0 4px"}}
                          onClick={() => toggleNotes(e.id)}>
                          {notesOpen ? "▴ hide" : "▾ notes"}
                        </button>
                      )}
                    </div>
                    {hasNotes && notesOpen && (
                      <div className="task-notes-text">{e.notes}</div>
                    )}
                  </div>
                  <div className="expense-row-amount">
                    ${(parseFloat(e.amount)||0).toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0})}
                    {hasAnyBudgeted && (() => {
                      const b = parseFloat(e.budgeted);
                      const a = parseFloat(e.amount) || 0;
                      if (!b) return <div style={{fontSize:10,color:"var(--text-muted)",marginTop:2}}>no estimate</div>;
                      const diff = a - b;
                      const color = diff > 0 ? "var(--red)" : "var(--green)";
                      return (
                        <div style={{fontSize:10,fontWeight:600,color,marginTop:2}}>
                          {diff > 0 ? "▲" : "▼"} ${Math.abs(diff).toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0})}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="expense-row-actions">
                    <button className="icon-btn" title="Edit"
                      style={{width:28,height:28,fontSize:13}}
                      disabled={isArchived} onClick={() => setEditing(e); setShowAdd(true)}>✎</button>
                    <button className="icon-btn" title="Delete"
                      style={{width:28,height:28,fontSize:13,color:"var(--red)"}}
                      disabled={isArchived} onClick={() => handleDelete(e)}>✕</button>
                  </div>
                  {pendingPaidId === e.id && pendingPaidIdx === eIdx && (
                    <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginTop:6,padding:"10px 12px",background:"var(--green-light)",border:"1px solid var(--green)",borderRadius:"var(--radius-sm)"}}>
                      <span style={{fontSize:12,fontWeight:600,color:"var(--green)",flexShrink:0}}>📅 Payment date:</span>
                      <input className="form-input" type="date" value={pendingPaidDate}
                        onChange={e2 => setPendingPaidDate(e2.target.value)}
                        style={{width:150,fontSize:12,padding:"4px 8px"}} />
                      <button className="btn btn-primary btn-sm" style={{fontSize:12}} onClick={confirmPaid}>Confirm paid</button>
                      <button className="btn btn-secondary btn-sm" style={{fontSize:12}} onClick={cancelPaid}>Cancel</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Expense rows — vendor view */}
        {viewMode === "vendor" && filtered.length > 0 && (
          <div>
            {vendorGroups.map(group => {
              const balance   = group.contracted - group.paid;
              const paidPct   = group.contracted > 0 ? (group.paid / group.contracted * 100) : 0;
              const isOpen    = expandedVendors[group.key] !== false; // default open
              const linkedV   = group.vendorId ? vendors.find(v => v.id === group.vendorId) : null;
              return (
                <div key={group.key} style={{borderBottom:"1px solid var(--border)"}}>
                  {/* Vendor group header */}
                  <div
                    onClick={() => toggleVendorGroup(group.key)}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer",background:"var(--bg-subtle)",userSelect:"none"}}
                  >
                    <span style={{fontSize:13,color:"var(--text-muted)",flexShrink:0}}>{isOpen ? "▾" : "▸"}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        {linkedV ? (
                          <button className="vendor-name-link"
                            style={{fontSize:14,fontWeight:700,color:"var(--accent-primary)",padding:0}}
                            onClick={e => { e.stopPropagation(); setVendorQuick(linkedV); }}>
                            {group.label}
                          </button>
                        ) : (
                          <span style={{fontSize:14,fontWeight:700,color:"var(--text-primary)"}}>{group.label}</span>
                        )}
                        <span style={{fontSize:11,color:"var(--text-muted)"}}>
                          {group.items.length} item{group.items.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {/* Mini progress bar */}
                      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:5}}>
                        <div style={{flex:1,height:4,background:"var(--border)",borderRadius:99,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${paidPct}%`,background:"var(--green)",borderRadius:99,transition:"width 0.3s ease"}} />
                        </div>
                        <span style={{fontSize:11,color:"var(--text-muted)",flexShrink:0,whiteSpace:"nowrap"}}>
                          ${group.paid.toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0})} of ${group.contracted.toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0})} paid
                        </span>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:20,flexShrink:0,textAlign:"right"}}>
                      <div>
                        <div style={{fontSize:10,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.04em"}}>Contracted</div>
                        <div style={{fontSize:15,fontWeight:700,color:"var(--text-primary)",fontFamily:"var(--font-mono,monospace)"}}>
                          ${group.contracted.toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0})}
                        </div>
                      </div>
                      <div>
                        <div style={{fontSize:10,fontWeight:700,color:"var(--green)",textTransform:"uppercase",letterSpacing:"0.04em"}}>Paid</div>
                        <div style={{fontSize:15,fontWeight:700,color:"var(--green)",fontFamily:"var(--font-mono,monospace)"}}>
                          ${group.paid.toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0})}
                        </div>
                      </div>
                      <div>
                        <div style={{fontSize:10,fontWeight:700,color:balance>0?"var(--red)":"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.04em"}}>Balance</div>
                        <div style={{fontSize:15,fontWeight:700,color:balance>0?"var(--red)":"var(--text-muted)",fontFamily:"var(--font-mono,monospace)"}}>
                          ${balance.toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0})}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Individual expenses within group */}
                  {isOpen && group.items.map((e, eIdx) => {
                    const dueStatus = getDueStatus(e);
                    const hasNotes  = !!(e.notes && e.notes.trim());
                    const notesOpen = !!expandedNotes[e.id];
                    const postMeta  = (e.paid && e.date) ? [`Paid ${fmt(e.date)}`] : [];
                    return (
                      <div key={e.id} className="expense-row" style={{opacity: e.paid ? 0.7 : 1, paddingLeft: 32}}>
                        <div className="expense-row-check">
                          <div
                            className={`paid-check ${e.paid ? "checked" : ""}`}
                            onClick={() => togglePaid(e.id, eIdx)}
                            title={e.paid ? "Mark as unpaid" : "Mark as paid"}
                          >
                            {e.paid && (
                              <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                                <path d="M1 4.5L4 7.5L10 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                        </div>
                        <div className="expense-row-body">
                          <div className="expense-row-desc">{e.description}</div>
                          <div className="expense-row-meta">
                            {e.category && <span>{e.category}</span>}
                            {postMeta.length > 0 && <span>{e.category ? " · " : ""}{postMeta.join(" · ")}</span>}
                            {dueStatus && <span className={dueStatus.cls}> · {dueStatus.label}</span>}
                            {hasNotes && (
                              <button
                                style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:"var(--text-muted)",padding:"0 0 0 4px"}}
                                onClick={() => toggleNotes(e.id)}>
                                {notesOpen ? "▴ hide" : "▾ notes"}
                              </button>
                            )}
                          </div>
                          {hasNotes && notesOpen && (
                            <div className="task-notes-text">{e.notes}</div>
                          )}
                        </div>
                        <div className="expense-row-amount">
                          ${(parseFloat(e.amount)||0).toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0})}
                        </div>
                        <div className="expense-row-actions">
                          <button className="icon-btn" title="Edit"
                            style={{width:28,height:28,fontSize:13}}
                            disabled={isArchived} onClick={() => setEditing(e); setShowAdd(true)}>✎</button>
                          <button className="icon-btn" title="Delete"
                            style={{width:28,height:28,fontSize:13,color:"var(--red)"}}
                            disabled={isArchived} onClick={() => handleDelete(e)}>✕</button>
                        </div>
                        {pendingPaidId === e.id && pendingPaidIdx === eIdx && (
                          <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginTop:6,padding:"10px 12px",background:"var(--green-light)",border:"1px solid var(--green)",borderRadius:"var(--radius-sm)"}}>
                            <span style={{fontSize:12,fontWeight:600,color:"var(--green)",flexShrink:0}}>📅 Payment date:</span>
                            <input className="form-input" type="date" value={pendingPaidDate}
                              onChange={e2 => setPendingPaidDate(e2.target.value)}
                              style={{width:150,fontSize:12,padding:"4px 8px"}} />
                            <button className="btn btn-primary btn-sm" style={{fontSize:12}} onClick={confirmPaid}>Confirm paid</button>
                            <button className="btn btn-secondary btn-sm" style={{fontSize:12}} onClick={cancelPaid}>Cancel</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* Section view */}
        {viewMode === "section" && filtered.length > 0 && (
          <div>
            {sectionGroups.map(group => {
              const outstanding = group.total - group.paid;
              const paidPct     = group.total > 0 ? (group.paid / group.total * 100) : 0;
              const isOpen      = expandedSections[group.key] !== false; // default open
              return (
                <div key={group.key} style={{borderBottom:"1px solid var(--border)"}}>
                  {/* Section group header */}
                  <div onClick={() => toggleSectionGroup(group.key)}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",
                      cursor:"pointer",background:"var(--bg-subtle)",userSelect:"none"}}>
                    <span style={{fontSize:13,color:"var(--text-muted)",flexShrink:0}}>
                      {isOpen ? "▾" : "▸"}
                    </span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        <span style={{fontSize:14,fontWeight:700,color:"var(--text-primary)"}}>
                          {group.key === "" ? "📋 All Events" : `📅 ${group.label}`}
                        </span>
                        <span style={{fontSize:11,color:"var(--text-muted)"}}>
                          {group.items.length} item{group.items.length!==1?"s":""}
                        </span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:5}}>
                        <div style={{flex:1,height:4,background:"var(--border)",borderRadius:99,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${paidPct}%`,background:"var(--green)",
                            borderRadius:99,transition:"width 0.3s ease"}} />
                        </div>
                        <span style={{fontSize:11,color:"var(--text-muted)",flexShrink:0,whiteSpace:"nowrap"}}>
                          ${group.paid.toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0})} of ${group.total.toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0})} paid
                        </span>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:20,flexShrink:0,textAlign:"right"}}>
                      <div>
                        <div style={{fontSize:10,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.04em"}}>Total</div>
                        <div style={{fontSize:15,fontWeight:700,color:"var(--text-primary)",fontFamily:"var(--font-mono,monospace)"}}>
                          ${group.total.toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0})}
                        </div>
                      </div>
                      <div>
                        <div style={{fontSize:10,fontWeight:700,color:"var(--green)",textTransform:"uppercase",letterSpacing:"0.04em"}}>Paid</div>
                        <div style={{fontSize:15,fontWeight:700,color:"var(--green)",fontFamily:"var(--font-mono,monospace)"}}>
                          ${group.paid.toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0})}
                        </div>
                      </div>
                      {outstanding > 0 && (
                        <div>
                          <div style={{fontSize:10,fontWeight:700,color:"var(--red)",textTransform:"uppercase",letterSpacing:"0.04em"}}>Owed</div>
                          <div style={{fontSize:15,fontWeight:700,color:"var(--red)",fontFamily:"var(--font-mono,monospace)"}}>
                            ${outstanding.toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0})}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Expense rows inside section */}
                  {isOpen && (
                    <div>
                      {group.items.map((e, eIdx) => {
                        const dueStatus = getDueStatus(e);
                        return (
                          <div key={e.id} id={`row-${e.id}`} className="expense-row"
                            style={{opacity: e.paid ? 0.7 : 1}}>
                            <div className="expense-row-check">
                              <div className={`paid-check ${e.paid ? "checked" : ""}`}
                                onClick={() => togglePaid(e.id, eIdx)}
                                title={e.paid ? "Mark as unpaid" : "Mark as paid"}>
                                {e.paid && (
                                  <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                                    <path d="M1 4.5L4 7.5L10 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </div>
                            </div>
                            <div className="expense-row-body">
                              <div className="expense-row-desc">{e.description}</div>
                              <div className="expense-row-meta">
                                {[e.category, e.vendor].filter(Boolean).join(" · ")}
                                {dueStatus && <span className={dueStatus.cls} style={{marginLeft:4}}>{dueStatus.label}</span>}
                              </div>
                            </div>
                            <div className="expense-row-amount">
                              ${(parseFloat(e.amount)||0).toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0})}
                            </div>
                            <div className="expense-row-actions">
                              <button className="icon-btn" title="Edit" disabled={isArchived}
                                onClick={() => setEditing(e); setShowAdd(true)}>✎</button>
                              <button className="icon-btn" title="Delete" disabled={isArchived}
                                onClick={() => handleDelete(e)}>✕</button>
                            </div>
                            {pendingPaidId === e.id && pendingPaidIdx === eIdx && (
                              <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginTop:6,padding:"10px 12px",background:"var(--green-light)",border:"1px solid var(--green)",borderRadius:"var(--radius-sm)"}}>
                                <span style={{fontSize:12,fontWeight:600,color:"var(--green)",flexShrink:0}}>📅 Payment date:</span>
                                <input className="form-input" type="date" value={pendingPaidDate}
                                  onChange={e2 => setPendingPaidDate(e2.target.value)}
                                  style={{width:150,fontSize:12,padding:"4px 8px"}} />
                                <button className="btn btn-primary btn-sm" style={{fontSize:12}} onClick={confirmPaid}>Confirm paid</button>
                                <button className="btn btn-secondary btn-sm" style={{fontSize:12}} onClick={cancelPaid}>Cancel</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

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
  const [open,      setOpen]      = useState(false);
  const [tipPct,    setTipPct]    = useState(20);
  const [custom,    setCustom]    = useState("");
  const [overrides, setOverrides] = useState({});

  const tippableVendors = vendors.filter(v => {
    const linked = expenses.filter(e => e.vendorId === v.id);
    const total  = linked.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    return linked.some(e => TIPPABLE_CATEGORIES.has(e.category)) && total > 0;
  });

  if (tippableVendors.length === 0) return null;

  const effectivePct = custom ? parseFloat(custom) : tipPct;

  const rows = tippableVendors.map(v => {
    const linked = expenses.filter(e => e.vendorId === v.id);
    const base   = overrides[v.id] !== undefined ? parseFloat(overrides[v.id]) || 0
                 : linked.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    return { vendor: v, base, tip: Math.round(base * (effectivePct / 100)) };
  });

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
        onClick={() => setOpen(o => !o)}>
        <div className="card-title" style={{ marginBottom: 0 }}>🧾 Gratuity Calculator</div>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{open ? "▲ collapse" : "▼ expand"}</span>
      </div>
      {open && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Tip rate:</span>
            {[15, 18, 20, 25].map(p => (
              <button key={p} className={`btn btn-sm ${tipPct === p && !custom ? "btn-primary" : "btn-secondary"}`}
                onClick={() => { setTipPct(p); setCustom(""); }}>
                {p}%
              </button>
            ))}
            <input className="form-input" type="number" min="0" max="100" value={custom}
              onChange={e => setCustom(e.target.value)} placeholder="Custom %" style={{ width: 90 }} />
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12 }}>
            <thead>
              <tr style={{ background: "var(--bg-subtle)" }}>
                <th style={th}>Vendor</th>
                <th style={th}>Type</th>
                <th style={th}>Base Amount</th>
                <th style={th}>Suggested Tip</th>
                <th style={{ ...th, width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ vendor, base, tip }) => (
                <tr key={vendor.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ ...td, fontWeight: 600 }}>{vendor.name}</td>
                  <td style={td}>{vendor.type}</td>
                  <td style={td}>
                    <input className="form-input" type="number" min="0" step="0.01"
                      value={overrides[vendor.id] !== undefined ? overrides[vendor.id] : base}
                      onChange={e => setOverrides(o => ({ ...o, [vendor.id]: e.target.value }))}
                      style={{ width: 100 }} />
                  </td>
                  <td style={{ ...td, fontWeight: 700, color: "var(--accent-primary)" }}>${tip.toLocaleString()}</td>
                  <td style={td}>
                    {!isArchived && (
                      <button className="btn btn-secondary btn-sm" onClick={() => {
                        onAddExpense({
                          id: newExpenseId(), description: `Gratuity — ${vendor.name}`, category: "Gratuities & Tips",
                          vendorId: vendor.id, amount: String(tip), paid: false, notes: `${effectivePct}% gratuity`,
                        });
                      }}>+ Add</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
            Tip amounts are suggestions. Edit the base amount to adjust.
          </div>
        </div>
      )}
    </div>
  );
}

const loadingStyle = { padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 };
const th = { padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" };
const td = { padding: "10px 12px", verticalAlign: "middle" };
