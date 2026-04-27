// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — TasksTab.jsx
// Ported from V2. Uses useEventData for Supabase persistence.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from "recharts";
import { useEventData }       from "@/hooks/useEventData.js";
import { useSearchHighlight } from "@/hooks/useSearchHighlight.js";
import { TASK_CATEGORIES, TASK_PRIORITIES, TASK_PRIORITY_STYLES } from "@/constants/task-constants.js";
import { newTaskId }          from "@/utils/ids.js";
import { getTaskDueStatus, computeSuggestions, getSmartTaskTemplates } from "@/utils/tasks.js";
import { ArchivedNotice }     from "@/components/shared/ArchivedNotice.jsx";
import { SuggestionsPanel }   from "@/components/shared/SuggestionsPanel.jsx";

export function TaskModal({ task, prefilled, onSave, onClose, isArchived }) {
  const isEdit = !!task && !prefilled;
  const [form, setForm] = useState(task || {
    id: newTaskId(), task: "", category: TASK_CATEGORIES[0],
    due: "", priority: "Medium", notes: "", done: false,
  });
  const setF = (k,v) => setForm(f => ({...f,[k]:v}));

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? "Edit Task" : prefilled ? "Add Suggested Task" : "Add Task"}</div>
          <button className="icon-btn" title="Close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Task *</label>
            <input className="form-input" value={form.task}
              onChange={e => setF("task", e.target.value)}
              placeholder="What needs to be done?" autoFocus />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={form.category}
                onChange={e => setF("category", e.target.value)}>
                {TASK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select className="form-select" value={form.priority}
                onChange={e => setF("priority", e.target.value)}>
                {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input className="form-input" type="date" value={form.due}
              onChange={e => setF("due", e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" rows={3} value={form.notes}
              onChange={e => setF("notes", e.target.value)}
              placeholder="Additional details, reminders, links..." />
          </div>

          {isEdit && (
            <div className="form-group">
              <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer"}}>
                <input type="checkbox" checked={!!form.done}
                  onChange={e => setF("done", e.target.checked)}
                  style={{width:15,height:15,accentColor:"var(--accent-primary)"}} />
                Mark as complete
              </label>
            </div>
          )}

          <div className="modal-footer">
            <span style={{fontSize:11,color:"var(--text-muted)",marginRight:"auto"}}>* required</span>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary"
              onClick={() => { if (form.task.trim()) onSave({...form}); }}
              disabled={!form.task.trim() || isArchived}>
              {isEdit ? "Save Changes" : "Add Task"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Task Insights ──────────────────────────────────────────────────────────
function TaskInsights({ realTasks }) {
  const [open, setOpen] = useState(false);

  const total    = realTasks.length;
  const done     = realTasks.filter(t => t.done).length;
  const today    = new Date(); today.setHours(0,0,0,0);
  const overdue  = realTasks.filter(t => !t.done && t.due && new Date(t.due+"T00:00:00") < today).length;
  const remaining = total - done - overdue;

  const completionData = useMemo(() => [{
    name: "Progress",
    done,
    remaining: Math.max(0, remaining),
    overdue,
  }], [done, remaining, overdue]);

  const categoryData = useMemo(() => {
    const counts = {};
    realTasks.filter(t => !t.done).forEach(t => {
      const cat = t.category || "Uncategorized";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [realTasks]);

  const priorityData = useMemo(() => {
    const counts = { High: 0, Medium: 0, Low: 0 };
    realTasks.filter(t => !t.done && t.priority).forEach(t => {
      if (counts[t.priority] !== undefined) counts[t.priority]++;
    });
    return ["High", "Medium", "Low"]
      .filter(p => counts[p] > 0)
      .map(p => ({ name: p, value: counts[p] }));
  }, [realTasks]);

  const PRIORITY_COLORS = { High: "var(--red)", Medium: "var(--gold)", Low: "var(--green)" };
  const CATEGORY_COLORS = [
    "var(--accent-primary)", "var(--blue)", "var(--green)",
    "var(--gold)", "var(--orange)", "var(--red)",
  ];

  const hasCats     = categoryData.length > 1;
  const hasPriority = priorityData.length > 0;

  if (total === 0) return null;

  const pctDone = total > 0 ? Math.round((done / total) * 100) : 0;

  const CompletionTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div className="budget-chart-tooltip">
        <div className="budget-chart-tooltip-title">Progress</div>
        <div className="budget-chart-tooltip-row">
          <span className="budget-chart-tooltip-dot" style={{ background: "var(--green)" }} />
          <span>Done</span><span style={{ fontWeight: 700 }}>{d.done}</span>
        </div>
        {d.remaining > 0 && (
          <div className="budget-chart-tooltip-row">
            <span className="budget-chart-tooltip-dot" style={{ background: "var(--accent-primary)", opacity: 0.5 }} />
            <span>Remaining</span><span>{d.remaining}</span>
          </div>
        )}
        {d.overdue > 0 && (
          <div className="budget-chart-tooltip-row">
            <span className="budget-chart-tooltip-dot" style={{ background: "var(--red)" }} />
            <span>Overdue</span><span style={{ color: "var(--red)", fontWeight: 700 }}>{d.overdue}</span>
          </div>
        )}
      </div>
    );
  };

  const CategoryTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    const incompleteCt = realTasks.filter(t => !t.done).length;
    const pct = incompleteCt > 0 ? Math.round((d.value / incompleteCt) * 100) : 0;
    return (
      <div className="budget-chart-tooltip">
        <div className="budget-chart-tooltip-title">{d.name}</div>
        <div className="budget-chart-tooltip-row">
          <span>{d.value} incomplete task{d.value !== 1 ? "s" : ""}</span>
          <span style={{ fontWeight: 700 }}>{pct}%</span>
        </div>
      </div>
    );
  };

  const PriorityTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    const incompleteCt = realTasks.filter(t => !t.done).length;
    const pct = incompleteCt > 0 ? Math.round((d.value / incompleteCt) * 100) : 0;
    return (
      <div className="budget-chart-tooltip">
        <div className="budget-chart-tooltip-title">{d.name} Priority</div>
        <div className="budget-chart-tooltip-row">
          <span className="budget-chart-tooltip-dot"
            style={{ background: PRIORITY_COLORS[d.name] || "var(--accent-primary)" }} />
          <span>{d.value} task{d.value !== 1 ? "s" : ""}</span>
          <span style={{ fontWeight: 700 }}>{pct}%</span>
        </div>
      </div>
    );
  };

  const collapsedSummary = `${pctDone}% complete · ${total - done} remaining${overdue > 0 ? ` · ${overdue} overdue` : ""}`;

  return (
    <div className="card budget-insights" style={{ marginBottom: 20 }}>
      <div className="budget-insights-header" onClick={() => setOpen(o => !o)}>
        <div>
          <div className="card-title" style={{ marginBottom: 0 }}>📊 Task Insights</div>
          <div className="card-subtitle" style={{ marginBottom: 0, marginTop: 4 }}>
            {collapsedSummary}{!open && " · click to expand"}
          </div>
        </div>
        <button className="budget-insights-toggle" aria-label={open ? "Collapse" : "Expand"}>
          {open ? "▴" : "▾"}
        </button>
      </div>

      {open && (
        <div className="budget-insights-body">

          <div className="budget-chart-section">
            <div className="budget-chart-title">Completion Progress</div>
            <div className="budget-chart-legend">
              <span className="budget-chart-legend-item">
                <span className="budget-chart-legend-swatch" style={{ background: "var(--green)" }} />
                Done ({done})
              </span>
              {remaining > 0 && (
                <span className="budget-chart-legend-item">
                  <span className="budget-chart-legend-swatch" style={{ background: "var(--accent-primary)", opacity: 0.5 }} />
                  Remaining ({remaining})
                </span>
              )}
              {overdue > 0 && (
                <span className="budget-chart-legend-item">
                  <span className="budget-chart-legend-swatch" style={{ background: "var(--red)" }} />
                  Overdue ({overdue})
                </span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={52}>
              <BarChart data={completionData} layout="vertical"
                margin={{ top: 4, right: 48, left: 0, bottom: 4 }} barSize={22}>
                <XAxis type="number" hide domain={[0, total]} />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip content={<CompletionTooltip />} cursor={{ fill: "var(--bg-subtle)" }} />
                <Bar dataKey="done"      stackId="a" fill="var(--green)"          fillOpacity={0.85} radius={[0,0,0,0]} />
                <Bar dataKey="remaining" stackId="a" fill="var(--accent-primary)" fillOpacity={0.35} radius={[0,0,0,0]} />
                <Bar dataKey="overdue"   stackId="a" fill="var(--red)"            fillOpacity={0.75} radius={[0,4,4,0]}>
                  <LabelList dataKey="done" position="right"
                    content={({ viewBox }) => {
                      const { x, y, width, height } = viewBox || {};
                      return (
                        <text x={(x||0)+(width||0)+6} y={(y||0)+(height||0)/2}
                          fill="var(--text-secondary)" dominantBaseline="middle"
                          style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-body)" }}>
                          {pctDone}%
                        </text>
                      );
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {(hasCats || hasPriority) && (
            <div className="guest-insights-top-row">
              {hasCats && (
                <div className="budget-chart-section">
                  <div className="budget-chart-title">Incomplete Tasks by Category</div>
                  <div className="budget-chart-subtitle">Excluding completed tasks</div>
                  <ResponsiveContainer width="100%" height={Math.max(120, categoryData.length * 44)}>
                    <BarChart data={categoryData} layout="vertical"
                      margin={{ top: 4, right: 40, left: 0, bottom: 4 }} barSize={14}>
                      <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false}
                        tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: "var(--font-body)" }}
                        axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name"
                        width={Math.min(160, Math.max(90, Math.max(...categoryData.map(d => d.name.length)) * 7))}
                        tick={{ fontSize: 11, fill: "var(--text-primary)", fontFamily: "var(--font-body)" }}
                        axisLine={false} tickLine={false} />
                      <Tooltip content={<CategoryTooltip />} cursor={{ fill: "var(--bg-subtle)" }} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {categoryData.map((entry, i) => (
                          <Cell key={entry.name} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} fillOpacity={0.75} />
                        ))}
                        <LabelList dataKey="value" position="right"
                          style={{ fontSize: 11, fontWeight: 700, fill: "var(--text-secondary)", fontFamily: "var(--font-body)" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {hasPriority && (
                <div className="budget-chart-section">
                  <div className="budget-chart-title">Incomplete Tasks by Priority</div>
                  <div className="budget-chart-subtitle">Excluding completed tasks</div>
                  <ResponsiveContainer width="100%" height={Math.max(100, priorityData.length * 34)}>
                    <BarChart data={priorityData} layout="vertical"
                      margin={{ top: 4, right: 40, left: 0, bottom: 4 }} barSize={14}>
                      <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false}
                        tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: "var(--font-body)" }}
                        axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={60}
                        tick={{ fontSize: 11, fill: "var(--text-primary)", fontFamily: "var(--font-body)" }}
                        axisLine={false} tickLine={false} />
                      <Tooltip content={<PriorityTooltip />} cursor={{ fill: "var(--bg-subtle)" }} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {priorityData.map((entry) => (
                          <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name] || "var(--accent-primary)"} fillOpacity={0.8} />
                        ))}
                        <LabelList dataKey="value" position="right"
                          style={{ fontSize: 11, fontWeight: 700, fill: "var(--text-secondary)", fontFamily: "var(--font-body)" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}

export function TasksTab({ eventId, event, adminConfig, showToast, isArchived, searchHighlight, clearSearchHighlight, setActiveTab, setSearchHighlight }) {
  const { items: tasks,     loading,       save,        remove       } = useEventData(eventId, "tasks");
  const { items: expenses,  save: saveExpense                        } = useEventData(eventId, "expenses");
  const { items: prep,      save: savePrep                           } = useEventData(eventId, "prep");
  const { items: vendors                                             } = useEventData(eventId, "vendors");
  const { items: households                                          } = useEventData(eventId, "households");

  useSearchHighlight(searchHighlight, clearSearchHighlight, "tasks");

  const [showModal,     setShowModal]     = useState(false);
  const [editTask,      setEditTask]      = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [search,        setSearch]        = useState("");
  const [filterStatus,  setFilterStatus]  = useState("todo");
  const [filterCat,     setFilterCat]     = useState("all");
  const [filterPri,     setFilterPri]     = useState("all");
  const [sortBy,        setSortBy]        = useState("due");
  const [expandedNotes, setExpandedNotes] = useState({});
  const [prefilledTask, setPrefilledTask] = useState(null);
  const [linkConfirm,   setLinkConfirm]   = useState(null);
  const [showSmartTasks, setShowSmartTasks] = useState(false);

  const handleAdd = async (t) => {
    if (isArchived) return;
    await save(t);
    showToast("Task added");
    setShowModal(false);
    setPrefilledTask(null);
  };

  const handleEdit = async (t) => {
    if (isArchived) return;
    await save(t);
    showToast("Task updated");
    setEditTask(null);
  };

  const handleDelete = async (id) => {
    if (isArchived) return;
    const t = tasks.find(x => x.id === id);
    if (t) await remove(t._rowId);
    showToast("Task deleted");
    setDeleteConfirm(null);
  };

  const completeTask = async (t) => {
    await save({ ...t, done: !t.done });
    showToast(t.done ? "Task reopened" : "Task completed");
  };

  const toggleDone = (id) => {
    if (isArchived) return;
    const t = tasks.find(x => x.id === id);
    if (!t) return;

    if (!t.done && t.sourceId && t.sourceCollection) {
      if (t.sourceCollection === "expenses") {
        const exp = expenses.find(e => e.id === t.sourceId);
        if (exp && !exp.paid) {
          setLinkConfirm({ task: t, action: "markPaid", label: exp.description });
          return;
        }
      }
      if (t.sourceCollection === "prep") {
        const item = prep.find(p => p.id === t.sourceId);
        if (item && item.status !== "Complete") {
          setLinkConfirm({ task: t, action: "markPrepComplete", label: item.title });
          return;
        }
      }
    }

    completeTask(t);
  };

  const handleLinkConfirm = async (withWriteBack) => {
    if (!linkConfirm) return;
    const { task, action } = linkConfirm;
    if (withWriteBack) {
      if (action === "markPaid") {
        const exp = expenses.find(e => e.id === task.sourceId);
        if (exp) await saveExpense({ ...exp, paid: true });
        showToast("Expense marked paid");
      }
      if (action === "markPrepComplete") {
        const item = prep.find(p => p.id === task.sourceId);
        if (item) await savePrep({ ...item, status: "Complete", progress: 100 });
        showToast("Prep item marked complete");
      }
    }
    completeTask(task);
    setLinkConfirm(null);
  };

  const toggleNotes = (id) => setExpandedNotes(n => ({...n,[id]:!n[id]}));

  const handleAddSuggestion = (s) => {
    if (isArchived) return;
    setPrefilledTask({
      id: newTaskId(), task: s.text, category: s.category,
      priority: s.priority, due: s.due || "", notes: "", done: false,
      sourceId:         s.sourceId         || null,
      sourceCollection: s.sourceCollection || null,
    });
    setShowModal(true);
  };

  const handleDismissSuggestion = async (s) => {
    if (isArchived) return;
    const existing = tasks.find(t => t.id === s.id);
    if (existing) await save({ ...existing, dismissed: true });
    else await save({ id: s.id, dismissed: true });
    showToast(`Suggestion dismissed — use "Restore" to undo`);
  };

  const handleRestoreSuggestions = async () => {
    if (isArchived) return;
    const dismissed = tasks.filter(t => t.dismissed);
    for (const t of dismissed) await save({ ...t, dismissed: false });
  };

  const stateForSuggestions = useMemo(() => ({
    tasks, adminConfig, expenses, vendors, prep, households,
  }), [tasks, adminConfig, expenses, vendors, prep, households]);

  const dismissedIds   = useMemo(() => new Set(tasks.filter(t => t.dismissed).map(t => t.id)), [tasks]);
  const allSuggestions = useMemo(() => computeSuggestions(stateForSuggestions), [stateForSuggestions]);
  const suggestions    = allSuggestions.filter(s => !dismissedIds.has(s.id));
  const dismissedCount = allSuggestions.filter(s => dismissedIds.has(s.id)).length;

  // ── Stats ──────────────────────────────────────────────────────────────────
  const realTasks = tasks.filter(t => !t.dismissed);
  const total    = realTasks.length;
  const done     = realTasks.filter(t => t.done).length;
  const today    = new Date(); today.setHours(0,0,0,0);
  const overdue  = realTasks.filter(t => !t.done && t.due && new Date(t.due+"T00:00:00") < today).length;
  const thisWeek = realTasks.filter(t => {
    if (t.done || !t.due) return false;
    const diff = Math.ceil((new Date(t.due+"T00:00:00") - today) / (1000*60*60*24));
    return diff >= 0 && diff <= 7;
  }).length;

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const usedCats = [...new Set(realTasks.map(t => t.category).filter(Boolean))].sort();

  const filtered = realTasks.filter(t => {
    if (filterStatus === "todo" && t.done)  return false;
    if (filterStatus === "done" && !t.done) return false;
    if (filterCat !== "all" && t.category !== filterCat) return false;
    if (filterPri !== "all" && t.priority !== filterPri) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(t.task||"").toLowerCase().includes(q) &&
          !(t.notes||"").toLowerCase().includes(q) &&
          !(t.category||"").toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a,b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    switch(sortBy) {
      case "due": {
        const aD = a.due ? new Date(a.due).getTime() : Infinity;
        const bD = b.due ? new Date(b.due).getTime() : Infinity;
        return aD !== bD ? aD - bD : (a.task||"").localeCompare(b.task||"");
      }
      case "priority": {
        const pO = {High:0,Medium:1,Low:2};
        const diff = (pO[a.priority]??1) - (pO[b.priority]??1);
        return diff !== 0 ? diff : (a.task||"").localeCompare(b.task||"");
      }
      case "category":
        return (a.category||"").localeCompare(b.category||"") ||
               (a.task||"").localeCompare(b.task||"");
      case "az":
        return (a.task||"").localeCompare(b.task||"");
      default:
        return 0;
    }
  });

  const shouldGroup = !search && filterCat==="all" && filterPri==="all" &&
                      filterStatus !== "done" && (sortBy==="due"||sortBy==="category");

  const grouped = shouldGroup ? (() => {
    const groups = {};
    filtered.forEach(t => {
      const cat = t.category || "Other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    });
    return Object.entries(groups).sort((a,b) => a[0].localeCompare(b[0]));
  })() : null;

  const renderTask = (t) => {
    const ds  = getTaskDueStatus(t);
    const psc = TASK_PRIORITY_STYLES[t.priority] || TASK_PRIORITY_STYLES["Medium"];
    const hasNotes = t.notes && t.notes.trim();
    const notesOpen = expandedNotes[t.id];
    return (
      <div key={t.id} id={`row-${t.id}`} className={`task-row ${t.done?"done":""}`}>
        <div className={`task-check ${t.done?"checked":""}`}
          onClick={() => toggleDone(t.id)}
          title={t.done ? "Mark as to do" : "Mark as done"}>
          {t.done && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.6"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
        <div className="task-body">
          <div className={`task-name ${t.done?"done":""}`}>{t.task}</div>
          <div className="task-meta">
            {!shouldGroup && t.category && (
              <span className="tag tag-muted" style={{fontSize:10}}>{t.category}</span>
            )}
            {t.priority && t.priority !== "Medium" && (
              <span className="tag" style={{background:psc.bg,color:psc.color,fontSize:10}}>
                {t.priority}
              </span>
            )}
            {ds && (
              <span className={`task-due ${ds.cls}`}
                title={t.due ? new Date(t.due+"T00:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"}) : undefined}>
                {ds.cls==="overdue" ? "⚠ " : ""}{ds.label}
              </span>
            )}
            {hasNotes && (
              <button style={{background:"none",border:"none",cursor:"pointer",
                fontSize:11,color:"var(--text-muted)",padding:0}}
                onClick={() => toggleNotes(t.id)}>
                {notesOpen ? "▴ hide notes" : "▾ notes"}
              </button>
            )}
          </div>
          {hasNotes && notesOpen && (
            <div className="task-notes-text">{t.notes}</div>
          )}
        </div>
        <div className="task-actions">
          <button className="icon-btn" title="Edit"
            style={{width:26,height:26,fontSize:12}}
            disabled={isArchived} onClick={() => setEditTask(t)}>✎</button>
          <button className="icon-btn" title="Delete"
            style={{width:26,height:26,fontSize:12,color:"var(--red)"}}
            disabled={isArchived} onClick={() => setDeleteConfirm(t.id)}>✕</button>
        </div>
      </div>
    );
  };

  if (loading) return <div style={loadingStyle}>Loading tasks…</div>;

  return (
    <div>
      {isArchived && <ArchivedNotice />}

      <div className="section-header">
        <div>
          <div className="section-title">Tasks</div>
          <div className="section-subtitle">
            {total} task{total!==1?"s":""} · {done} complete
            {overdue > 0 && ` · ${overdue} overdue`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(() => {
            const mainEvt = (adminConfig?.timeline || []).find(e => e.isMainEvent);
            return mainEvt?.startDate && !isArchived ? (
              <button className="btn btn-secondary btn-sm" onClick={() => setShowSmartTasks(true)}>
                ✨ Smart Tasks
              </button>
            ) : null;
          })()}
          <button className="btn btn-primary btn-sm" disabled={isArchived} onClick={() => setShowModal(true)}>
            + Add Task
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="budget-stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total Tasks</div>
          <div className="stat-value">{total}</div>
          <div className="stat-sub">{total - done} remaining</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Completed</div>
          <div className="stat-value stat-green">{done}</div>
          <div className="stat-sub">{total > 0 ? Math.round((done/total)*100) : 0}% done</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Overdue</div>
          <div className="stat-value" style={{color: overdue>0?"var(--red)":"var(--text-primary)"}}>
            {overdue}
          </div>
          <div className="stat-sub">past due date</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Due This Week</div>
          <div className="stat-value" style={{color: thisWeek>0?"var(--gold)":"var(--text-primary)"}}>
            {thisWeek}
          </div>
          <div className="stat-sub">next 7 days</div>
        </div>
      </div>

      {/* Task Insights */}
      <TaskInsights realTasks={realTasks} />

      {/* Suggestions panel */}
      <SuggestionsPanel
        suggestions={suggestions}
        onAdd={handleAddSuggestion}
        onDismiss={handleDismissSuggestion}
        dismissedCount={dismissedCount}
        onRestore={handleRestoreSuggestions}
        onNavigate={(tab, itemId, collection) => {
          setActiveTab(tab);
          if (itemId && collection) setSearchHighlight({ tab, itemId, collection, householdId: null });
        }}
      />

      {/* Filter bar */}
      <div className="filter-bar">
        <input className="form-input" type="text" placeholder="Search tasks…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-select" value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All tasks</option>
          <option value="todo">To do</option>
          <option value="done">Completed</option>
        </select>
        {usedCats.length > 1 && (
          <select className="form-select" value={filterCat}
            onChange={e => setFilterCat(e.target.value)}>
            <option value="all">All categories</option>
            {usedCats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <select className="form-select" value={filterPri}
          onChange={e => setFilterPri(e.target.value)}>
          <option value="all">All priorities</option>
          {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="form-select" value={sortBy}
          onChange={e => setSortBy(e.target.value)}>
          <option value="due">Sort: Due date</option>
          <option value="priority">Sort: Priority</option>
          <option value="category">Sort: Category</option>
          <option value="az">Sort: A–Z</option>
        </select>
      </div>

      {/* Empty state */}
      {tasks.length === 0 && (
        <div style={{textAlign:"center",padding:"64px 24px",color:"var(--text-muted)"}}>
          <div style={{fontSize:40,marginBottom:12,opacity:0.4}}>✅</div>
          <div style={{fontFamily:"var(--font-display)",fontSize:18,marginBottom:6,color:"var(--text-primary)"}}>
            No tasks yet
          </div>
          <div style={{fontSize:13,marginBottom:20}}>
            Add your first task to start tracking what needs to get done.
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Task</button>
        </div>
      )}

      {/* No results */}
      {tasks.length > 0 && filtered.length === 0 && (
        <div style={{textAlign:"center",padding:"32px 16px",color:"var(--text-muted)",fontSize:13}}>
          No tasks match your filters.
        </div>
      )}

      {/* Task list */}
      {filtered.length > 0 && (
        <div className="card" style={{padding:0,overflow:"hidden"}}>
          {shouldGroup && grouped ? (
            grouped.map(([cat, catTasks]) => (
              <div key={cat}>
                <div className="task-group-header">{cat} ({catTasks.length})</div>
                {catTasks.map(renderTask)}
              </div>
            ))
          ) : (
            filtered.map(renderTask)
          )}
        </div>
      )}

      {/* Add modal */}
      {showModal && (
        <TaskModal
          task={prefilledTask}
          prefilled={!!prefilledTask}
          onSave={handleAdd}
          isArchived={isArchived}
          onClose={() => { setShowModal(false); setPrefilledTask(null); }} />
      )}

      {/* Edit modal */}
      {editTask && (
        <TaskModal task={editTask} onSave={handleEdit} onClose={() => setEditTask(null)} isArchived={isArchived} />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) { setDeleteConfirm(null); } }}>
          <div className="modal" style={{maxWidth:380}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Delete Task</div>
              <button className="icon-btn" title="Close" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{fontSize:14,color:"var(--text-primary)",marginBottom:4,lineHeight:1.6}}>
                This will permanently remove this task.
              </p>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm)}>Delete Task</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Link confirm */}
      {linkConfirm && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) { setLinkConfirm(null); } }}>
          <div className="modal" style={{maxWidth:420}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                {linkConfirm.action === "markPaid" ? "💳 Mark Payment Paid?" : "📖 Update Prep Item?"}
              </div>
              <button className="icon-btn" title="Close" onClick={() => setLinkConfirm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{fontSize:14,color:"var(--text-primary)",marginBottom:12,lineHeight:1.6}}>
                {linkConfirm.action === "markPaid"
                  ? <>Completing this task will also mark <strong>"{linkConfirm.label}"</strong> as paid in your budget. Do you want to update it now?</>
                  : <>Completing this task will also mark <strong>"{linkConfirm.label}"</strong> as Complete in Prep. Do you want to update it now?</>
                }
              </p>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setLinkConfirm(null)}>Cancel</button>
                <button className="btn btn-secondary" onClick={() => handleLinkConfirm(false)}>Complete Task Only</button>
                <button className="btn btn-primary" onClick={() => handleLinkConfirm(true)}>
                  {linkConfirm.action === "markPaid" ? "Mark as Paid" : "Mark as Complete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Smart Tasks modal */}
      {showSmartTasks && (
        <SmartTasksModal
          adminConfig={adminConfig}
          tasks={tasks}
          onAdd={handleAdd}
          onClose={() => setShowSmartTasks(false)}
          newTaskId={newTaskId}
        />
      )}
    </div>
  );
}

// ── SmartTasksModal ────────────────────────────────────────────────────────────
export function SmartTasksModal({ adminConfig, tasks, onAdd, onClose, newTaskId: mkId }) {
  const mainEvt   = (adminConfig?.timeline || []).find(e => e.isMainEvent);
  const eventDate = mainEvt?.startDate || "";
  const eventType = adminConfig?.type   || "";
  const eventName = adminConfig?.name   || "your event";

  const templates = getSmartTaskTemplates(eventDate, eventType, tasks);

  const bucket = (offset) => {
    if (offset <= -365) return "12+ months before";
    if (offset <= -180) return "6–12 months before";
    if (offset <= -90)  return "3–6 months before";
    if (offset <= -14)  return "Final 3 months";
    return "Final 2 weeks";
  };
  const BUCKET_ORDER = ["12+ months before","6–12 months before","3–6 months before","Final 3 months","Final 2 weeks"];

  const [checked, setChecked] = useState(() => {
    const init = {};
    templates.forEach(t => { init[t.id] = t.preChecked; });
    return init;
  });

  const toggle = (id) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));

  const toggleGroup = (bkt) => {
    const groupIds = templates.filter(t => bucket(t.daysOffset) === bkt && !t.alreadyCovered).map(t => t.id);
    const allOn = groupIds.every(id => checked[id]);
    setChecked(prev => { const n = { ...prev }; groupIds.forEach(id => { n[id] = !allOn; }); return n; });
  };

  const handleAdd = () => {
    templates.filter(t => checked[t.id] && !t.alreadyCovered).forEach(t => {
      onAdd({
        id:       mkId(),
        task:     t.text,
        category: t.category,
        priority: t.priority,
        due:      t.due,
        done:     false,
        notes:    "",
      });
    });
    onClose();
  };

  const grouped = BUCKET_ORDER.map(bkt => ({
    label:     bkt,
    templates: templates.filter(t => bucket(t.daysOffset) === bkt),
  })).filter(g => g.templates.length > 0);

  const selectedCount = templates.filter(t => checked[t.id] && !t.alreadyCovered).length;
  const fmt = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:"var(--bg-surface)", borderRadius:"var(--radius-lg)",
        width:"90%", maxWidth:640, maxHeight:"90vh",
        display:"flex", flexDirection:"column", boxShadow:"var(--shadow-lg)",
      }}>
        {/* Header */}
        <div style={{ padding:"20px 24px 16px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
          <div style={{ fontFamily:"var(--font-display)", fontSize:18, fontWeight:700, color:"var(--text-primary)", marginBottom:4 }}>
            ✨ Smart Tasks
          </div>
          <div style={{ fontSize:13, color:"var(--text-secondary)" }}>
            Suggested planning milestones for <strong>{eventName}</strong> on <strong>{fmt(eventDate)}</strong>. Select the tasks you'd like to add.
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY:"auto", flex:1, padding:"16px 24px" }}>
          {grouped.map(g => {
            const available = g.templates.filter(t => !t.alreadyCovered);
            const allOn     = available.length > 0 && available.every(t => checked[t.id]);
            return (
              <div key={g.label} style={{ marginBottom:20 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.05em" }}>
                    {g.label}
                  </div>
                  {available.length > 0 && (
                    <button style={{ background:"none", border:"none", cursor:"pointer", fontSize:11, color:"var(--accent-primary)", padding:0 }}
                      onClick={() => toggleGroup(g.label)}>
                      {allOn ? "Deselect all" : "Select all"}
                    </button>
                  )}
                </div>
                {g.templates.map(t => (
                  <div key={t.id} style={{
                    display:"flex", alignItems:"flex-start", gap:10,
                    padding:"8px 10px", marginBottom:4,
                    borderRadius:"var(--radius-sm)",
                    background: t.alreadyCovered ? "var(--bg-subtle)" : "var(--bg-surface)",
                    border:"1px solid var(--border)",
                    opacity: t.alreadyCovered ? 0.6 : 1,
                  }}>
                    {t.alreadyCovered ? (
                      <span style={{ fontSize:12, color:"var(--green)", fontWeight:600, marginTop:2, flexShrink:0 }}>✓</span>
                    ) : (
                      <input type="checkbox" checked={!!checked[t.id]} onChange={() => toggle(t.id)}
                        style={{ marginTop:3, cursor:"pointer", accentColor:"var(--accent-primary)", flexShrink:0 }} />
                    )}
                    <span style={{ fontSize:13, marginTop:1, flexShrink:0 }}>{t.icon}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, color: t.alreadyCovered ? "var(--text-muted)" : "var(--text-primary)", fontWeight:500 }}>
                        {t.text}
                        {t.tier === 3 && !t.alreadyCovered && (
                          <span style={{ marginLeft:6, fontSize:10, color:"var(--text-muted)", fontWeight:400 }}>optional</span>
                        )}
                      </div>
                      <div style={{ fontSize:11, color: t.isPast ? "var(--text-muted)" : "var(--text-secondary)", marginTop:2 }}>
                        {t.alreadyCovered ? "Already have a task for this"
                          : t.isPast ? `${fmt(t.due)} — past`
                          : fmt(t.due)}
                        {" · "}{t.category}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding:"14px 24px", borderTop:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0, gap:12 }}>
          <div style={{ fontSize:13, color:"var(--text-muted)" }}>
            {selectedCount > 0 ? `${selectedCount} task${selectedCount !== 1 ? "s" : ""} selected` : "No tasks selected"}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={selectedCount === 0} onClick={handleAdd}>
              Add {selectedCount > 0 ? `${selectedCount} ` : ""}Task{selectedCount !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const loadingStyle = { padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 };
