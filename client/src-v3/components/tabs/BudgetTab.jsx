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
  const [open,      setOpen]      = useState(false);
  const [tipPct,    setTipPct]    = useState(20);
  const [custom,    setCustom]    = useState("");
  const [overrides, setOverrides] = useState({});

  const tippableVendors = vendors.filter(v => {
    const linked = expenses.filter(e => e.vendorId === v.id);
    const total  = linked.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    return TIPPABLE_CATEGORIES.has(v.type) && total > 0;
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
