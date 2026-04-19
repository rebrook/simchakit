// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — CalendarTab.jsx
// Ported from V2. Loads all collections via useEventData and assembles
// a unified calendar state object for buildCalendarEvents.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from "react";
import { useEventData }       from "@/hooks/useEventData.js";
import { useSearchHighlight } from "@/hooks/useSearchHighlight.js";
import { CAL_SOURCES }        from "@/constants/ui.js";
import { buildCalendarEvents } from "@/utils/calendar.js";
import { ArchivedNotice }     from "@/components/shared/ArchivedNotice.jsx";

export function CalendarTab({ eventId, event, adminConfig, showToast, isArchived, setActiveTab, searchHighlight, clearSearchHighlight, onNavigateToSource }) {
  const { items: tasks    } = useEventData(eventId, "tasks");
  const { items: expenses } = useEventData(eventId, "expenses");
  const { items: vendors  } = useEventData(eventId, "vendors");
  const { items: prep     } = useEventData(eventId, "prep");

  const [view,          setView]          = useState("list");
  const [showCompleted, setShowCompleted] = useState(false);
  const [sourceFilter,  setSourceFilter]  = useState("all");
  const [search,        setSearch]        = useState("");
  const [calMonth,      setCalMonth]      = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  useSearchHighlight(searchHighlight, clearSearchHighlight, "calendar");

  // Assemble a V2-compatible state object for buildCalendarEvents
  const state = useMemo(() => ({
    tasks,
    expenses,
    vendors,
    prep,
  }), [tasks, expenses, vendors, prep]);

  const allEvents = useMemo(
    () => buildCalendarEvents(state, adminConfig, showCompleted),
    [state, adminConfig, showCompleted]
  );

  const filtered = useMemo(() => allEvents.filter(e => {
    if (sourceFilter !== "all" && e.source !== sourceFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(e.title||"").toLowerCase().includes(q) && !(e.meta||"").toLowerCase().includes(q)) return false;
    }
    return true;
  }), [allEvents, sourceFilter, search]);

  // Group list view by month
  const groupedByMonth = useMemo(() => {
    const groups = {};
    filtered.forEach(e => {
      if (!e.date) return;
      const key = e.date.slice(0, 7); // "YYYY-MM"
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    return Object.entries(groups).sort(([a],[b]) => a.localeCompare(b));
  }, [filtered]);

  // Calendar month view helpers
  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const calEvents = useMemo(() => {
    const map = {};
    allEvents.forEach(e => {
      if (!e.date) return;
      const key = e.date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [allEvents]);

  const monthName = (year, month) =>
    new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const prevMonth = () => setCalMonth(c => {
    if (c.month === 0) return { year: c.year - 1, month: 11 };
    return { ...c, month: c.month - 1 };
  });
  const nextMonth = () => setCalMonth(c => {
    if (c.month === 11) return { year: c.year + 1, month: 0 };
    return { ...c, month: c.month + 1 };
  });

  const SOURCE_LABELS = {
    timeline:  "Timeline",
    task:      "Tasks",
    payment:   "Payments",
    milestone: "Vendor Milestones",
    prep:      "Prep",
  };

  const SOURCE_ICONS = {
    timeline:  "📅",
    task:      "✓",
    payment:   "💰",
    milestone: "📌",
    prep:      "📖",
  };

  const BADGE_STYLES = {
    "cal-badge-overdue": { background: "var(--red-light)",  color: "var(--red)",  border: "1px solid var(--red)"  },
    "cal-badge-soon":    { background: "var(--gold-light)", color: "var(--gold)", border: "1px solid var(--gold)" },
    "cal-badge-future":  { background: "var(--bg-subtle)",  color: "var(--text-muted)", border: "1px solid var(--border)" },
  };

  const handleNavigate = (e) => {
    if (setActiveTab && e.tab) setActiveTab(e.tab);
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  const upcomingCount = allEvents.filter(e => !e.done && e.diff >= 0 && e.diff <= 14).length;
  const overdueCount  = allEvents.filter(e => !e.done && e.diff < 0).length;

  return (
    <div>
      {isArchived && <ArchivedNotice />}

      <div className="section-header">
        <div>
          <div className="section-title">Planning Calendar</div>
          <div className="section-subtitle">
            {allEvents.length} event{allEvents.length !== 1 ? "s" : ""} across all categories
            {overdueCount  > 0 && <span style={{ color: "var(--red)",  fontWeight: 600, marginLeft: 8 }}>· ⚠ {overdueCount} overdue</span>}
            {upcomingCount > 0 && <span style={{ color: "var(--gold)", fontWeight: 600, marginLeft: 8 }}>· {upcomingCount} due soon</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className={`btn btn-sm ${view==="list"?"btn-primary":"btn-secondary"}`} onClick={()=>setView("list")}>☰ List</button>
          <button className={`btn btn-sm ${view==="month"?"btn-primary":"btn-secondary"}`} onClick={()=>setView("month")}>📅 Month</button>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <input className="form-input" style={{ flex: 1, minWidth: 160 }} placeholder="Search events…" value={search} onChange={e=>setSearch(e.target.value)} />
        <select className="form-select" value={sourceFilter} onChange={e=>setSourceFilter(e.target.value)}>
          <option value="all">All Sources</option>
          {Object.entries(SOURCE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{SOURCE_ICONS[key]} {label}</option>
          ))}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", color: "var(--text-secondary)" }}>
          <input type="checkbox" checked={showCompleted} onChange={e=>setShowCompleted(e.target.checked)}
            style={{ width: 14, height: 14, accentColor: "var(--accent-primary)" }} />
          Show completed
        </label>
      </div>

      {/* Empty state */}
      {allEvents.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "60px 24px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>No calendar events yet</div>
          <div style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 360, margin: "0 auto 20px" }}>
            Add tasks with due dates, expenses with payment dates, or configure your event timeline to populate the planning calendar.
          </div>
          {setActiveTab && <button className="btn btn-secondary" onClick={()=>setActiveTab("tasks")}>✓ Go to Tasks</button>}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {view === "list" && allEvents.length > 0 && (
        <div>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 24px", color: "var(--text-muted)", fontSize: 13 }}>
              No events match your filters.
            </div>
          ) : (
            groupedByMonth.map(([monthKey, events]) => {
              const [year, month] = monthKey.split("-").map(Number);
              const label = new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
              return (
                <div key={monthKey} style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>
                    {label}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {events.map(e => {
                      const isToday = e.date === todayStr;
                      const badgeStyle = e.badge ? BADGE_STYLES[e.badge.cls] : null;
                      return (
                        <div key={e.id} onClick={()=>handleNavigate(e)} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", background: e.done ? "var(--bg-subtle)" : isToday ? "var(--accent-light)" : "var(--bg-surface)", border: isToday ? "1px solid var(--accent-medium)" : "1px solid var(--border)", borderRadius: "var(--radius-md)", cursor: e.tab ? "pointer" : "default", opacity: e.done ? 0.65 : 1, transition: "background 0.1s" }}>
                          <div style={{ fontSize: 18, flexShrink: 0, marginTop: 1, filter: e.done ? "grayscale(1)" : "none" }}>{e.icon}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: e.done ? "var(--text-muted)" : "var(--text-primary)", textDecoration: e.done ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title}</div>
                            {e.meta && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.meta}</div>}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                            <div style={{ fontSize: 11, color: isToday ? "var(--accent-primary)" : "var(--text-muted)", fontWeight: isToday ? 700 : 500 }}>
                              {isToday ? "Today" : new Date(e.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </div>
                            {badgeStyle && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, ...badgeStyle }}>{e.badge.label}</span>
                            )}
                            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 99, background: "var(--bg-muted)", color: "var(--text-muted)", fontWeight: 600 }}>
                              {SOURCE_ICONS[e.source]} {SOURCE_LABELS[e.source]}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── MONTH VIEW ── */}
      {view === "month" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <button className="btn btn-ghost btn-sm" onClick={prevMonth}>← Prev</button>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{monthName(calMonth.year, calMonth.month)}</div>
            <button className="btn btn-ghost btn-sm" onClick={nextMonth}>Next →</button>
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
            {/* Day headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)" }}>
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
                <div key={d} style={{ padding: "8px 4px", textAlign: "center", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.04em" }}>{d}</div>
              ))}
            </div>
            {/* Calendar grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
              {(() => {
                const days = daysInMonth(calMonth.year, calMonth.month);
                const firstDay = firstDayOfMonth(calMonth.year, calMonth.month);
                const cells = [];
                // Leading empty cells
                for (let i = 0; i < firstDay; i++) cells.push(<div key={`e-${i}`} style={{ minHeight: 80, borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)", background: "var(--bg-subtle)" }} />);
                // Day cells
                for (let d = 1; d <= days; d++) {
                  const dateStr = `${calMonth.year}-${String(calMonth.month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
                  const dayEvents = calEvents[dateStr] || [];
                  const isToday = dateStr === todayStr;
                  cells.push(
                    <div key={d} style={{ minHeight: 80, borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "4px 6px", background: isToday ? "var(--accent-light)" : "var(--bg-surface)" }}>
                      <div style={{ fontSize: 12, fontWeight: isToday ? 800 : 500, color: isToday ? "var(--accent-primary)" : "var(--text-muted)", marginBottom: 3 }}>{d}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {dayEvents.slice(0, 3).map(e => (
                          <div key={e.id} onClick={()=>handleNavigate(e)} style={{ fontSize: 10, padding: "1px 5px", borderRadius: 4, background: e.isMain ? "var(--accent-primary)" : e.source==="task" ? "var(--blue-light)" : e.source==="payment" ? "var(--green-light)" : e.source==="milestone" ? "var(--gold-light)" : "var(--bg-muted)", color: e.isMain ? "white" : "var(--text-secondary)", cursor: e.tab ? "pointer" : "default", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }} title={e.title}>
                            {e.icon} {e.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && <div style={{ fontSize: 10, color: "var(--text-muted)", paddingLeft: 2 }}>+{dayEvents.length - 3} more</div>}
                      </div>
                    </div>
                  );
                }
                return cells;
              })()}
            </div>
          </div>
          {/* Legend */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12, fontSize: 11, color: "var(--text-muted)" }}>
            {[
              { bg: "var(--accent-primary)", color: "white",             label: "Timeline" },
              { bg: "var(--blue-light)",     color: "var(--text-secondary)", label: "Tasks" },
              { bg: "var(--green-light)",    color: "var(--text-secondary)", label: "Payments" },
              { bg: "var(--gold-light)",     color: "var(--text-secondary)", label: "Milestones" },
            ].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: l.bg, flexShrink: 0 }} />
                {l.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
