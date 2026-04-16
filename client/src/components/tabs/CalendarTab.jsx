import { useState, useEffect } from "react";
import { useSearchHighlight } from "@/hooks/useSearchHighlight.js";
import { CAL_SOURCES } from "@/constants/ui.js";
import { buildCalendarEvents } from "@/utils/calendar.js";
import { ArchivedNotice } from "@/components/shared/ArchivedNotice.jsx";

export function CalendarTab({ state, adminConfig, setActiveTab, isArchived, searchHighlight, clearSearchHighlight, onNavigateToSource }) {
  const [sourceFilter,   setSourceFilter]   = useState("all");
  const [showCompleted,  setShowCompleted]  = useState(false);
  const [viewMode,       setViewMode]       = useState("list");
  const [currentMonth,   setCurrentMonth]   = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d;
  });
  const [isMobile,       setIsMobile]       = useState(() => window.innerWidth < 640);
  const [selectedEvent,  setSelectedEvent]  = useState(null);
  const [popoverPos,     setPopoverPos]     = useState({ top:0, left:0 });

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 640;
      setIsMobile(mobile);
      if (mobile) setViewMode("list");
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close popover on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") setSelectedEvent(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const openPopover = (e, evt) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const winW  = window.innerWidth;
    const winH  = window.innerHeight;
    const pw    = 280; // popover width
    const ph    = 200; // approximate popover height
    let left = rect.left;
    let top  = rect.bottom + 6;
    // Keep within viewport horizontally
    if (left + pw > winW - 12) left = winW - pw - 12;
    if (left < 12) left = 12;
    // Flip above if too close to bottom
    if (top + ph > winH - 12) top = rect.top - ph - 6;
    setPopoverPos({ top, left });
    setSelectedEvent(evt);
  };

  useSearchHighlight(searchHighlight, clearSearchHighlight, "calendar");

  const allEvents = buildCalendarEvents(state, adminConfig, showCompleted);

  const filtered = sourceFilter === "all"
    ? allEvents
    : allEvents.filter(e => e.source === sourceFilter);

  // Group by month label
  const grouped = {};
  filtered.forEach(e => {
    if (!e.date) return;
    const d = new Date(e.date + "T00:00:00");
    const key = d.toLocaleDateString("en-US", { month:"long", year:"numeric" });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  });
  const months = Object.keys(grouped);

  const today = new Date(); today.setHours(0,0,0,0);

  const fmtDate = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    const isToday    = d.getTime() === today.getTime();
    const isTomorrow = d.getTime() === today.getTime() + 86400000;
    if (isToday)    return "Today";
    if (isTomorrow) return "Tomorrow";
    return d.toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" });
  };

  const handleGoTo = (e) => {
    setActiveTab(e.tab);
  };

  const totalCount     = allEvents.length;
  const overdueCount   = allEvents.filter(e => !e.done && e.diff < 0).length;
  const thisWeekCount  = allEvents.filter(e => !e.done && e.diff >= 0 && e.diff <= 7).length;
  const upcomingCount  = allEvents.filter(e => !e.done && e.diff > 7).length;

  // ── Month grid helpers ─────────────────────────────────────────────────────
  const prevMonth = () => setCurrentMonth(m => {
    const d = new Date(m); d.setMonth(d.getMonth() - 1); return d;
  });
  const nextMonth = () => setCurrentMonth(m => {
    const d = new Date(m); d.setMonth(d.getMonth() + 1); return d;
  });

  // Build a 6-row × 7-col grid for currentMonth
  const buildMonthGrid = () => {
    const year  = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev  = new Date(year, month, 0).getDate();
    const cells = [];
    // Leading days from prev month
    for (let i = startOffset - 1; i >= 0; i--) {
      cells.push({ date: new Date(year, month - 1, daysInPrev - i), thisMonth: false });
    }
    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(year, month, d), thisMonth: true });
    }
    // Trailing days to fill 6 rows (42 cells)
    let trailing = 1;
    while (cells.length < 42) {
      cells.push({ date: new Date(year, month + 1, trailing++), thisMonth: false });
    }
    return cells;
  };

  const toDateKey = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

  // Index filtered events by date key for O(1) lookup
  const eventsByDate = {};
  filtered.forEach(e => {
    if (!e.date) return;
    if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
    eventsByDate[e.date].push(e);
  });

  const chipCls = {
    timeline:  "cal-grid-chip-timeline",
    task:      "cal-grid-chip-task",
    payment:   "cal-grid-chip-payment",
    milestone: "cal-grid-chip-milestone",
    prep:      "cal-grid-chip-prep",
  };
  const CHIPS_VISIBLE = 3;

  return (
    <div className="tab-content">
      {isArchived && <ArchivedNotice />}

      {/* Section header */}
      <div className="section-header">
        <div>
          <div className="section-title">Planning Calendar</div>
          <div className="section-subtitle">
            {totalCount > 0
              ? `${totalCount} event${totalCount!==1?"s":""} across all sources`
              : "All planning dates in one place"}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      {totalCount > 0 && (
        <div className="stat-grid" style={{ marginBottom:20 }}>
          <div className="stat-card">
            <div className="stat-label">Total Events</div>
            <div className="stat-value stat-accent">{totalCount}</div>
            <div className="stat-sub">across all sources</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Overdue</div>
            <div className="stat-value" style={{ color: overdueCount > 0 ? "var(--red)" : "var(--green)" }}>
              {overdueCount}
            </div>
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

      {/* Filter bar */}
      <div className="filter-bar" style={{ marginBottom:20 }}>
        <select className="form-select" value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value)}>
          <option value="all">All sources</option>
          {CAL_SOURCES.map(s => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <button
          className={`btn btn-sm ${showCompleted ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setShowCompleted(c => !c)}>
          {showCompleted ? "✓ Showing completed" : "Show completed"}
        </button>
        {/* View toggle — hidden on mobile (auto-switches to list) */}
        {!isMobile && (
          <div style={{ display:"flex", gap:2, marginLeft:"auto",
            background:"var(--bg-subtle)", borderRadius:"var(--radius-sm)",
            padding:2, border:"1px solid var(--border)" }}>
            <button
              className={`btn btn-sm ${viewMode==="list" ? "btn-primary" : "btn-ghost"}`}
              style={{ padding:"4px 10px", fontSize:12 }}
              onClick={() => setViewMode("list")}>
              ☰ List
            </button>
            <button
              className={`btn btn-sm ${viewMode==="month" ? "btn-primary" : "btn-ghost"}`}
              style={{ padding:"4px 10px", fontSize:12 }}
              onClick={() => setViewMode("month")}>
              📅 Month
            </button>
          </div>
        )}
      </div>

      {/* Empty state */}
      {totalCount === 0 && (
        <div className="cal-empty">
          <div style={{ fontSize:40, marginBottom:12, opacity:0.4 }}>📅</div>
          <div style={{ fontFamily:"var(--font-display)", fontSize:18, marginBottom:6,
            color:"var(--text-primary)" }}>
            No planning events yet
          </div>
          <div style={{ fontSize:13, marginBottom:20, maxWidth:380, margin:"0 auto 20px" }}>
            Add dates to your timeline, tasks, vendor payments, contract milestones,
            and prep items to see them here.
          </div>
          <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab("tasks")}>
              → Tasks
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab("vendors")}>
              → Vendors
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab("prep")}>
              → Prep
            </button>
          </div>
        </div>
      )}

      {/* List view — grouped by month */}
      {viewMode === "list" && months.map(monthLabel => (
        <div key={monthLabel} className="cal-list-month">
          <div className="cal-month-heading">
            <span>📅</span>
            <span>{monthLabel}</span>
            <span style={{ fontSize:12, fontWeight:400, color:"var(--text-muted)",
              marginLeft:4 }}>
              — {grouped[monthLabel].length} item{grouped[monthLabel].length!==1?"s":""}
            </span>
          </div>

          {grouped[monthLabel].map(e => {
            const src = CAL_SOURCES.find(s => s.key === e.source);
            return (
              <div key={e.id} className="cal-event-row"
                style={{ opacity: e.done ? 0.6 : 1, cursor:"pointer" }}
                onClick={(ev) => openPopover(ev, e)}>

                {/* Color dot */}
                <div className={`cal-dot ${src?.dotCls || ""}`}
                  style={{ marginTop:4 }} />

                {/* Body */}
                <div className="cal-event-body">
                  <div className="cal-event-title"
                    style={{ textDecoration: e.done ? "line-through" : "none" }}>
                    {e.isMain && (
                      <span className="cal-badge cal-badge-main"
                        style={{ marginRight:6, fontSize:9 }}>MAIN EVENT</span>
                    )}
                    {e.title}
                  </div>
                  {e.meta && (
                    <div className="cal-event-meta">{e.meta}</div>
                  )}
                </div>

                {/* Source tag */}
                <span className={`cal-source-tag ${src?.tagCls || ""}`}>
                  {src?.label || e.source}
                </span>

                {/* Proximity badge */}
                {e.badge && !e.done && (
                  <span className={`cal-badge ${e.badge.cls}`}>
                    {e.badge.label}
                  </span>
                )}

                {/* Date + go-to */}
                <div style={{ display:"flex", flexDirection:"column",
                  alignItems:"flex-end", gap:4, flexShrink:0 }}>
                  <div className="cal-event-date">{fmtDate(e.date)}</div>
                  <button className="btn btn-ghost"
                    style={{ padding:"2px 8px", fontSize:11, whiteSpace:"nowrap" }}
                    onClick={() => handleGoTo(e)}>
                    → {e.tab.charAt(0).toUpperCase()+e.tab.slice(1)}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* Month grid view */}
      {viewMode === "month" && (
        <div>
          {/* Month navigation */}
          <div className="cal-grid-header">
            <div className="cal-grid-nav">
              <button className="btn btn-secondary btn-sm" onClick={prevMonth}>‹</button>
              <div className="cal-grid-month-label">
                {currentMonth.toLocaleDateString("en-US", { month:"long", year:"numeric" })}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={nextMonth}>›</button>
            </div>
            <button className="btn btn-ghost btn-sm"
              onClick={() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); setCurrentMonth(d); }}>
              Today
            </button>
          </div>

          {/* Weekday headers */}
          <div className="cal-grid-weekdays">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
              <div key={d} className="cal-grid-weekday">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="cal-grid-days">
            {buildMonthGrid().map((cell, idx) => {
              const key    = toDateKey(cell.date);
              const isToday = cell.date.getTime() === today.getTime();
              const dayEvts = eventsByDate[key] || [];
              const visible = dayEvts.slice(0, CHIPS_VISIBLE);
              const overflow = dayEvts.length - visible.length;

              return (
                <div key={idx}
                  className={[
                    "cal-grid-cell",
                    !cell.thisMonth ? "other-month" : "",
                    isToday         ? "today"        : "",
                  ].filter(Boolean).join(" ")}>

                  <div className="cal-grid-day-num">{cell.date.getDate()}</div>

                  {visible.map(e => (
                    <span key={e.id}
                      className={`cal-grid-chip ${chipCls[e.source] || ""}`}
                      title={`${e.title}${e.meta ? " · "+e.meta : ""}`}
                      onClick={(ev) => openPopover(ev, e)}
                      style={{ cursor:"pointer" }}>
                      {e.title}
                    </span>
                  ))}

                  {overflow > 0 && (
                    <div className="cal-grid-overflow"
                      onClick={(ev) => { ev.stopPropagation(); setViewMode("list"); }}>
                      +{overflow} more
                    </div>
                  )}
                </div>
              );
            })}
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
          ? new Date(selectedEvent.date+"T00:00:00").toLocaleDateString("en-US",
              { weekday:"long", month:"long", day:"numeric", year:"numeric" })
          : "";
        return (
          <>
            <div className="cal-popover-backdrop" onClick={() => setSelectedEvent(null)} />
            <div className="cal-popover" style={{ top:popoverPos.top, left:popoverPos.left }}>

              {/* Source tag + close */}
              <div style={{ display:"flex", alignItems:"center",
                justifyContent:"space-between", marginBottom:8 }}>
                <span className={`cal-source-tag ${src?.tagCls || ""}`}>
                  {src?.label || selectedEvent.source}
                </span>
                <button className="icon-btn" style={{ fontSize:12, padding:2 }} title="Close"
                  onClick={() => setSelectedEvent(null)}>✕</button>
              </div>

              {/* Title */}
              <div className="cal-popover-title">
                {selectedEvent.isMain && (
                  <span className="cal-badge cal-badge-main"
                    style={{ marginRight:6, fontSize:9 }}>MAIN EVENT</span>
                )}
                {selectedEvent.title}
              </div>

              {/* Date + meta */}
              <div className="cal-popover-meta">
                {dateStr && <div>{dateStr}</div>}
                {selectedEvent.meta && (
                  <div style={{ marginTop:2 }}>{selectedEvent.meta}</div>
                )}
              </div>

              {/* Proximity badge */}
              {selectedEvent.badge && !selectedEvent.done && (
                <span className={`cal-badge ${selectedEvent.badge.cls}`}
                  style={{ marginBottom:8, display:"inline-block" }}>
                  {selectedEvent.badge.label}
                </span>
              )}

              {/* Footer */}
              <div className="cal-popover-footer">
                <button className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedEvent(null)}>
                  Close
                </button>
                {canNav ? (
                  <button className="btn btn-primary btn-sm"
                    onClick={() => {
                      setSelectedEvent(null);
                      onNavigateToSource(
                        selectedEvent.tab,
                        selectedEvent.itemId,
                        selectedEvent.source
                      );
                    }}>
                    → {tabLabel}
                  </button>
                ) : tabLabel ? (
                  <button className="btn btn-secondary btn-sm"
                    onClick={() => { setSelectedEvent(null); setActiveTab(selectedEvent.tab); }}>
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
