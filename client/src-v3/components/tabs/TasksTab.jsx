// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — TasksTab.jsx
// Ported from V2. Uses useEventData for Supabase persistence.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from "react";
import { useEventData }       from "@/hooks/useEventData.js";
import { useSearchHighlight } from "@/hooks/useSearchHighlight.js";
import { TASK_CATEGORIES, TASK_PRIORITIES, TASK_PRIORITY_STYLES } from "@/constants/task-constants.js";
import { newTaskId }          from "@/utils/ids.js";
import { getTaskDueStatus, computeSuggestions } from "@/utils/tasks.js";
import { ArchivedNotice }     from "@/components/shared/ArchivedNotice.jsx";
import { SuggestionsPanel }   from "@/components/shared/SuggestionsPanel.jsx";

export function TasksTab({ eventId, event, adminConfig, showToast, isArchived, searchHighlight, clearSearchHighlight, setActiveTab, setSearchHighlight }) {
  const { items: tasks, loading, save, remove } = useEventData(eventId, "tasks");

  const [filterCat,  setFilterCat]  = useState("All");
  const [filterDone, setFilterDone] = useState("todo");
  const [filterPri,  setFilterPri]  = useState("All");
  const [search,     setSearch]     = useState("");
  const [showAdd,    setShowAdd]    = useState(false);
  const [editing,    setEditing]    = useState(null);

  useSearchHighlight(searchHighlight, clearSearchHighlight, "tasks");

  // ── Suggestions ───────────────────────────────────────────────────────────
  const stateForSuggestions = useMemo(() => ({
    tasks, adminConfig, expenses: [], vendors: [], prep: [], households: [],
  }), [tasks, adminConfig]);

  const allSuggestions = useMemo(() => computeSuggestions(stateForSuggestions), [stateForSuggestions]);
  const dismissedIds   = useMemo(() => new Set(tasks.filter(t => t.dismissed).map(t => t.id)), [tasks]);
  const suggestions    = allSuggestions.filter(s => !dismissedIds.has(s.id));
  const dismissedCount = allSuggestions.filter(s => dismissedIds.has(s.id)).length;

  const handleAddSuggestion = async (s) => {
    const task = { id: newTaskId(), task: s.text, due: s.due || "", category: s.category || "Planning", priority: "Medium", done: false, notes: "" };
    await save(task);
    showToast("Task added");
  };

  const handleDismissSuggestion = async (s) => {
    const existing = tasks.find(t => t.id === s.id);
    if (existing) await save({ ...existing, dismissed: true });
    else await save({ id: s.id, dismissed: true });
  };

  const handleRestoreSuggestions = async () => {
    const dismissed = tasks.filter(t => t.dismissed);
    for (const t of dismissed) await save({ ...t, dismissed: false });
  };

  // ── Filtered + sorted tasks ───────────────────────────────────────────────
  const activeTasks = tasks.filter(t => !t.dismissed);

  const filtered = useMemo(() => {
    return activeTasks.filter(t => {
      if (filterDone === "todo" && t.done)  return false;
      if (filterDone === "done" && !t.done) return false;
      if (filterCat !== "All" && t.category !== filterCat) return false;
      if (filterPri !== "All" && t.priority !== filterPri) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!t.task?.toLowerCase().includes(q) && !(t.notes||"").toLowerCase().includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const dA = a.due || "9999", dB = b.due || "9999";
      if (dA !== dB) return dA.localeCompare(dB);
      const pOrder = { High: 0, Medium: 1, Low: 2 };
      return (pOrder[a.priority] ?? 1) - (pOrder[b.priority] ?? 1);
    });
  }, [activeTasks, filterDone, filterCat, filterPri, search]);

  const overdue = activeTasks.filter(t => !t.done && t.due && new Date(t.due + "T00:00:00") < new Date()).length;

  const toggleDone = async (task) => {
    await save({ ...task, done: !task.done });
    if (!task.done) showToast("Task completed ✓");
  };

  const handleSave = async (taskData) => {
    await save(taskData);
    setShowAdd(false);
    setEditing(null);
    showToast(editing ? "Task updated" : "Task added");
  };

  const handleDelete = async (task) => {
    await remove(task._rowId);
    showToast("Task deleted");
  };

  if (loading) return <div style={loadingStyle}>Loading tasks…</div>;

  return (
    <div>
      {isArchived && <ArchivedNotice />}

      <div className="section-header">
        <div>
          <div className="section-title">Tasks</div>
          <div className="section-subtitle">
            {activeTasks.filter(t => t.done).length} of {activeTasks.length} complete
            {overdue > 0 && <span style={{ color: "var(--red)", marginLeft: 8 }}>· {overdue} overdue</span>}
          </div>
        </div>
        {!isArchived && (
          <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setShowAdd(true); }}>
            + Add Task
          </button>
        )}
      </div>

      <SuggestionsPanel
        suggestions={suggestions}
        dismissedCount={dismissedCount}
        onAdd={handleAddSuggestion}
        onDismiss={handleDismissSuggestion}
        onRestore={handleRestoreSuggestions}
        onNavigate={setActiveTab ? (tab, id, col) => {
          setActiveTab(tab);
          if (setSearchHighlight) setSearchHighlight({ tab, itemId: id, collection: col, householdId: null });
        } : null}
      />

      {/* Filters */}
      <div className="filter-bar">
        <input className="form-input" type="text" placeholder="Search tasks…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-select" value={filterDone} onChange={e => setFilterDone(e.target.value)}>
          <option value="all">All Tasks</option>
          <option value="todo">To Do</option>
          <option value="done">Completed</option>
        </select>
        <select className="form-select" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="All">All Categories</option>
          {TASK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="form-select" value={filterPri} onChange={e => setFilterPri(e.target.value)}>
          <option value="All">All Priorities</option>
          {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Task list */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
            {activeTasks.length === 0 ? "No tasks yet — add your first task." : "No tasks match your filters."}
          </div>
        ) : (
          filtered.map(t => {
            const due      = getTaskDueStatus(t);
            const priStyle = TASK_PRIORITY_STYLES[t.priority] || TASK_PRIORITY_STYLES["Medium"];
            return (
              <div key={t.id || t._rowId} id={`row-${t.id}`}
                className={`task-row ${t.done ? "done" : ""}`}>
                <div className={`task-check ${t.done ? "checked" : ""}`}
                  onClick={() => !isArchived && toggleDone(t)}>
                  {t.done && <svg width="10" height="8" viewBox="0 0 10 8"><polyline points="1,4 4,7 9,1" stroke="white" strokeWidth="1.5" fill="none"/></svg>}
                </div>
                <div className="task-body">
                  <div className={`task-name ${t.done ? "done" : ""}`}>{t.task}</div>
                  <div className="task-meta">
                    {t.category && <span className="tag tag-muted" style={{ fontSize: 10 }}>{t.category}</span>}
                    {t.priority && t.priority !== "Medium" && (
                      <span className="tag" style={{ fontSize: 10, background: priStyle.bg, color: priStyle.color }}>{t.priority}</span>
                    )}
                    {t.due && (
                      <span className={`task-due ${due?.cls || "future"}`}>
                        {due?.label || new Date(t.due + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    )}
                  </div>
                  {t.notes && <div className="task-notes-text">{t.notes}</div>}
                </div>
                {!isArchived && (
                  <div className="task-actions">
                    <button className="icon-btn" title="Edit" onClick={() => { setEditing(t); setShowAdd(true); }}>✎</button>
                    <button className="icon-btn" title="Delete" onClick={() => handleDelete(t)}>✕</button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {showAdd && (
        <TaskModal
          task={editing}
          onSave={handleSave}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          isArchived={isArchived}
        />
      )}
    </div>
  );
}

// ── TaskModal ─────────────────────────────────────────────────────────────────
export function TaskModal({ task, prefilled, onSave, onClose, isArchived }) {
  const blank = { id: newTaskId(), task: "", due: "", category: "Planning", priority: "Medium", done: false, notes: "" };
  const [form, setForm] = useState(task || (prefilled ? { ...blank, ...prefilled } : blank));
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{task ? "Edit Task" : "Add Task"}</div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Task *</label>
            <input className="form-input" value={form.task} onChange={e => set("task", e.target.value)}
              placeholder="What needs to be done?" autoFocus />
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={form.category} onChange={e => set("category", e.target.value)}>
                {TASK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select className="form-select" value={form.priority || "Medium"} onChange={e => set("priority", e.target.value)}>
                {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input className="form-input" type="date" value={form.due || ""} onChange={e => set("due", e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.notes || ""} onChange={e => set("notes", e.target.value)}
              placeholder="Optional notes…" />
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!form.task?.trim() || isArchived}
              onClick={() => onSave({ ...form })}>
              {task ? "Save Changes" : "Add Task"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const loadingStyle = { padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 };
