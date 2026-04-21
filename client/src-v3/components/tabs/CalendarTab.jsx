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
  const [isMobile,      setIsMobile]      = useState(() => window.innerWidth < 640);
  const [calMonth,      setCalMonth]      = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 640;
      setIsMobile(mobile);
      if (mobile) setView("list");
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [popoverPos,    setPopoverPos]    = useState({ top: 0, left: 0 });

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") setSelectedEvent(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const openPopover = (e, evt) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const pw = 280;
    const ph = 200;
    let left = rect.left;
    let top  = rect.bottom + 6;
    if (left + pw > winW - 12) left = winW - pw - 12;
    if (left < 12) left = 12;
    if (top + ph > winH - 12) top = rect.top - ph - 6;
    setPopoverPos({ top, left });
    setSelectedEvent(evt);
  };

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

  const chipCls = {
    timeline:  "cal-grid-chip-timeline",
    task:      "cal-grid-chip-task",
    payment:   "cal-grid-chip-payment",
    milestone: "cal-grid-chip-milestone",
    prep:      "cal-grid-chip-prep",
  };

  const todayStr      = new Date().toISOString().slice(0, 10);
  const thisWeekCount = allEvents.filter(e => !e.done && e.diff >= 0 && e.diff <= 7).length;
  const upcomingCount = allEvents.filter(e => !e.done && e.diff > 7).length;
  const overdueCount  = allEvents.filter(e => !e.done && e.diff < 0).length;

  return (
    <div className="tab-content">
      {isArchived && <ArchivedNotice />}

      <div className="section-header">
        <div>
          <div className="section-title">Planning Calendar</div>
          <div className="section-subtitle">
            {allEvents.length > 0
              ? `${allEvents.length} event${allEvents.length !== 1 ? "s" : ""} across all sources`
              : "All planning dates in one place"}
            {overdueCount  > 0 && <span style={{ color: "var(--red)",  fontWeight: 600, marginLeft: 8 }}>· ⚠ {overdueCount} overdue</span>}
            {upcomingCount > 0 && <span style={{ color: "var(--gold)", fontWeight: 600, marginLeft: 8 }}>· {upcomingCount} due soon</span>}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      {allEvents.length > 0 && (
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Total Events</div>
            <div className="stat-value stat-accent">{allEvents.length}</div>
            <div className="stat-sub">across all sources</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Overdue</div>
            <div className="stat-value" style={{ color: overdueCount > 0 ? "var(--red)" : "var(--green)" }}>{overdueCount}</div>
            <div className="stat-sub">need attention</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">This Week</div>
            <div className="stat-value stat-gold">{thisWeekCount}</div>
            <div className="stat-sub">next 7 days</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Upcoming</div>
            <div className="stat-value">{upcomingCount}</div>
            <div className="stat-sub">beyond this week</div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="cal-filter-legend">
        {CAL_SOURCES.map(s => (
          <div key={s.key} className="cal-legend-item">
            <div className={`cal-dot ${s.dotCls}`} />
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-bar" style={{ marginBottom: 20 }}>
        <input className="form-input" style={{ flex: 1, minWidth: 160 }} placeholder="Search events…" value={search} onChange={e=>setSearch(e.target.value)} />
        <select className="form-select" value={sourceFilter} onChange={e=>setSourceFilter(e.target.value)}>
          <option value="all">All sources</option>
          {CAL_SOURCES.map(s => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", color: "var(--text-secondary)" }}>
          <input type="checkbox" checked={showCompleted} onChange={e=>setShowCompleted(e.target.checked)}
            style={{ width: 14, height: 14, accentColor: "var(--accent-primary)" }} />
          Show completed
        </label>
        {!isMobile && (
          <div style={{ display: "flex", gap: 2, marginLeft: "auto", background: "var(--bg-subtle)", borderRadius: "var(--radius-sm)", padding: 2, border: "1px solid var(--border)" }}>
            <button className={`btn btn-sm ${view==="list" ? "btn-primary" : "btn-ghost"}`} style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setView("list")}>☰ List</button>
            <button className={`btn btn-sm ${view==="month" ? "btn-primary" : "btn-ghost"}`} style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setView("month")}>📅 Month</button>
          </div>
        )}
      </div>

      {/* Empty state */}
      {allEvents.length === 0 && (
        <div className="cal-empty">
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📅</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, marginBottom: 6, color: "var(--text-primary)" }}>
            No planning events yet
          </div>
          <div style={{ fontSize: 13, marginBottom: 20, maxWidth: 380, margin: "0 auto 20px" }}>
            Add dates to your timeline, tasks, vendor payments, contract milestones,
            and prep items to see them here.
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab && setActiveTab("tasks")}>→ Tasks</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab && setActiveTab("vendors")}>→ Vendors</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab && setActiveTab("prep")}>→ Prep</button>
          </div>
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
                <div key={monthKey} className="cal-list-month">
                  <div className="cal-month-heading">
                    <span>📅</span>
                    <span>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted)", marginLeft: 4 }}>
                      — {events.length} item{events.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {events.map(e => {
                      const src = CAL_SOURCES.find(s => s.key === e.source);
                      return (
                        <div key={e.id} className="cal-event-row"
                          style={{ opacity: e.done ? 0.6 : 1, cursor: "pointer" }}
                          onClick={(ev) => openPopover(ev, e)}>
                          <div className={`cal-dot ${src?.dotCls || ""}`} style={{ marginTop: 4 }} />
                          <div className="cal-event-body">
                            <div className="cal-event-title" style={{ textDecoration: e.done ? "line-through" : "none" }}>
                              {e.isMain && <span className="cal-badge cal-badge-main" style={{ marginRight: 6, fontSize: 9 }}>MAIN EVENT</span>}
                              {e.title}
                            </div>
                            {e.meta && <div className="cal-event-meta">{e.meta}</div>}
                          </div>
                          <span className={`cal-source-tag ${src?.tagCls || ""}`}>{src?.label || e.source}</span>
                          {e.badge && !e.done && (
                            <span className={`cal-badge ${e.badge.cls}`}>{e.badge.label}</span>
                          )}
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                            <div className="cal-event-date">
                              {e.date === todayStr ? "Today" :
                               e.date === new Date(Date.now() + 86400000).toISOString().slice(0, 10) ? "Tomorrow" :
                               new Date(e.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                            </div>
                            <button className="btn btn-ghost" style={{ padding: "2px 8px", fontSize: 11, whiteSpace: "nowrap" }}
                              onClick={(ev) => { ev.stopPropagation(); setActiveTab && setActiveTab(e.tab); }}>
                              → {e.tab ? e.tab.charAt(0).toUpperCase() + e.tab.slice(1) : ""}
                            </button>
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
          <div className="cal-grid-header">
            <div className="cal-grid-nav">
              <button className="btn btn-secondary btn-sm" onClick={prevMonth}>‹</button>
              <div className="cal-grid-month-label">{monthName(calMonth.year, calMonth.month)}</div>
              <button className="btn btn-secondary btn-sm" onClick={nextMonth}>›</button>
            </div>
            <button className="btn btn-ghost btn-sm"
              onClick={() => { const now = new Date(); setCalMonth({ year: now.getFullYear(), month: now.getMonth() }); }}>
              Today
            </button>
          </div>
          <div className="cal-grid-weekdays">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
              <div key={d} className="cal-grid-weekday">{d}</div>
            ))}
          </div>
          <div className="cal-grid-days">
            {(() => {
              const year     = calMonth.year;
              const month    = calMonth.month;
              const days     = daysInMonth(year, month);
              const firstDay = firstDayOfMonth(year, month);
              const daysInPrev = new Date(year, month, 0).getDate();
              const cells = [];
              // Leading days from prev month
              for (let i = firstDay - 1; i >= 0; i--) {
                cells.push({ date: new Date(year, month - 1, daysInPrev - i), thisMonth: false });
              }
              // Days in current month
              for (let d = 1; d <= days; d++) {
                cells.push({ date: new Date(year, month, d), thisMonth: true });
              }
              // Trailing days to fill 42 cells
              let trailing = 1;
              while (cells.length < 42) {
                cells.push({ date: new Date(year, month + 1, trailing++), thisMonth: false });
              }
              return cells.map((cell, idx) => {
                const key      = `${cell.date.getFullYear()}-${String(cell.date.getMonth()+1).padStart(2,"0")}-${String(cell.date.getDate()).padStart(2,"0")}`;
                const isToday  = key === todayStr;
                const dayEvts  = calEvents[key] || [];
                const visible  = dayEvts.slice(0, 3);
                const overflow = dayEvts.length - visible.length;
                return (
                  <div key={idx} className={["cal-grid-cell", !cell.thisMonth ? "other-month" : "", isToday ? "today" : ""].filter(Boolean).join(" ")}>
                    <div className="cal-grid-day-num">{cell.date.getDate()}</div>
                    {visible.map(e => (
                      <span key={e.id}
                        className={`cal-grid-chip ${chipCls[e.source] || ""}`}
                        title={`${e.title}${e.meta ? " · " + e.meta : ""}`}
                        onClick={(ev) => openPopover(ev, e)}
                        style={{ cursor: "pointer" }}>
                        {e.title}
                      </span>
                    ))}
                    {overflow > 0 && (
                      <div className="cal-grid-overflow"
                        onClick={(ev) => { ev.stopPropagation(); setView("list"); }}>
                        +{overflow} more
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}
      {/* Event detail popover */}
      {selectedEvent && (() => {
        const src      = CAL_SOURCES.find(s => s.key === selectedEvent.source);
        const canNav   = selectedEvent.itemId !== null;
        const tabLabel = selectedEvent.tab
          ? selectedEvent.tab.charAt(0).toUpperCase() + selectedEvent.tab.slice(1)
          : "";
        const dateStr = selectedEvent.date
          ? new Date(selectedEvent.date + "T00:00:00").toLocaleDateString("en-US",
              { weekday: "long", month: "long", day: "numeric", year: "numeric" })
          : "";
        return (
          <>
            <div className="cal-popover-backdrop" onClick={() => setSelectedEvent(null)} />
            <div className="cal-popover" style={{ top: popoverPos.top, left: popoverPos.left }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span className={`cal-source-tag ${src?.tagCls || ""}`}>{src?.label || selectedEvent.source}</span>
                <button className="icon-btn" style={{ fontSize: 12, padding: 2 }} title="Close"
                  onClick={() => setSelectedEvent(null)}>✕</button>
              </div>
              <div className="cal-popover-title">
                {selectedEvent.isMain && (
                  <span className="cal-badge cal-badge-main" style={{ marginRight: 6, fontSize: 9 }}>MAIN EVENT</span>
                )}
                {selectedEvent.title}
              </div>
              <div className="cal-popover-meta">
                {dateStr && <div>{dateStr}</div>}
                {selectedEvent.meta && <div style={{ marginTop: 2 }}>{selectedEvent.meta}</div>}
              </div>
              {selectedEvent.badge && !selectedEvent.done && (
                <span className={`cal-badge ${selectedEvent.badge.cls}`} style={{ marginBottom: 8, display: "inline-block" }}>
                  {selectedEvent.badge.label}
                </span>
              )}
              <div className="cal-popover-footer">
                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedEvent(null)}>Close</button>
                {canNav ? (
                  <button className="btn btn-primary btn-sm"
                    onClick={() => {
                      setSelectedEvent(null);
                      onNavigateToSource(selectedEvent.tab, selectedEvent.itemId, selectedEvent.source);
                    }}>
                    → {tabLabel}
                  </button>
                ) : tabLabel ? (
                  <button className="btn btn-secondary btn-sm"
                    onClick={() => { setSelectedEvent(null); setActiveTab && setActiveTab(selectedEvent.tab); }}>
                    → {tabLabel}
                  </button>
                ) : null}
              </div>
            </div>
          </>
        );
      })()}

    </div>
  );
}
