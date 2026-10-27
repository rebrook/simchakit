// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.9.0 — components/overview/ScheduleCard.jsx
// The celebration schedule: the main weekend from the timeline entries, grouped by day, each row
// with the start time, name, building and room, the confirmed count (adults and kids) and a link
// to the entry's details in Calendar. Earlier dates sit behind one disclosure. "Copy schedule"
// puts plain text on the clipboard, checking the result before saying it worked. Hidden after the
// event (the caller does not render it).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect } from "react";
import { Icon } from "@/utils/iconMap.jsx";
import { scheduleText } from "@/utils/overview.js";

function Row({ r, stage, noGuests, canEditTimeline, onOpenEntry, onAddTime }) {
  const where = [r.building, r.room].filter(Boolean).join(", ");
  const dayOf = stage === "today";
  const addTime = !r.time;
  const body = (
    <>
      <span className={`tm${addTime ? " add" : ""}`}>{addTime ? "Add time" : r.time}</span>
      <span className="nm">
        <b>{r.title}</b>
        {dayOf && r.state === "done" && <span className="st">{"✓"} Done</span>}
        {dayOf && r.state === "next" && <span className="st next">Up next</span>}
        {where && <span className="ov-sm" style={{ display: "block" }}>{where}</span>}
        {r.arriveBy && <span className="ov-sm" style={{ display: "block" }}>Arrive by {r.arriveBy}</span>}
        {r.havdalah && <span className="hv">Havdalah {r.havdalah}</span>}
      </span>
      <span className="ct">
        {r.family ? <span className="ov-fam">Family only</span>
          : noGuests ? <span className="ov-sm">Add guests to see counts</span>
          : r.invited > 0 && r.confirmed ? (
            <>
              <b>{r.confirmed.total} confirmed</b>
              <span className="ov-sm">{r.daysAway > 1 && r.date !== undefined && r.isEarlier ? `in ${r.daysAway} days` : `${r.confirmed.adults} adults, ${r.confirmed.kids} kids`}</span>
            </>
          ) : null}
      </span>
      <span className="ar" aria-hidden="true">{"›"}</span>
    </>
  );
  // A row with no time on day zero sends the host to the timeline to set it; others open the entry in Calendar.
  if (addTime && canEditTimeline) {
    return <button type="button" className="ov-sr" data-state={dayOf ? r.state : undefined} onClick={onAddTime} aria-label={`${r.title}: add a time`}>{body}</button>;
  }
  return <button type="button" className="ov-sr" data-state={dayOf ? r.state : undefined} onClick={() => onOpenEntry(r.id)} aria-label={`${r.title}: open details in Calendar`}>{body}</button>;
}

function Days({ days, earlier, ...rest }) {
  return days.map(d => (
    <div key={d.date}>
      <div className="ov-dg">{d.label}</div>
      {d.rows.map(r => <Row key={r.id} r={earlier ? { ...r, isEarlier: true } : r} {...rest} />)}
    </div>
  ));
}

export function ScheduleCard({ stage, schedule, eventName, noGuests, canEditTimeline, onOpenEntry, onAddTime, mainDate }) {
  const [open, setOpen] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");     // text on the button
  const [live, setLive] = useState("");           // announced through the live region
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const hasEarlier = schedule.earlier.length > 0 && stage !== "today";
  const earlierCount = schedule.earlier.reduce((n, d) => n + d.rows.length, 0);

  async function copy() {
    let ok = false;
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error("no clipboard");
      await navigator.clipboard.writeText(scheduleText({ eventName, days: schedule.days }));
      ok = true;
    } catch { ok = false; }
    setCopyMsg(ok ? "Copied" : "Could not copy");
    setLive(ok ? "Schedule copied" : "Could not copy the schedule");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setCopyMsg(""); setLive(""); }, 2200);
  }

  const dayCount = schedule.dayCount;
  const sub = stage === "new"
    ? `${schedule.count} event${schedule.count !== 1 ? "s" : ""}${dayCount === 1 && mainDate ? ` on ${schedule.days[0]?.label || ""}` : ""}`
    : `${schedule.count} event${schedule.count !== 1 ? "s" : ""} over ${dayCount} day${dayCount !== 1 ? "s" : ""}`;

  return (
    <section className="ov-card ov-a-s ov-sc" data-open={open ? "true" : "false"} aria-labelledby="ov-sched-title">
      <div className="ov-nh">
        <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap" }}>
          <h2 id="ov-sched-title">Celebration schedule</h2>
          <span className="sub">{sub}</span>
          <span className="ov-vh" role="status" aria-live="polite">{live}</span>
        </div>
        {stage === "new"
          ? (canEditTimeline && <button type="button" className="btn" onClick={onAddTime}>Add an event</button>)
          : <button type="button" className="btn" onClick={copy}><Icon name="copy" context="badge" /> {copyMsg || "Copy schedule"}</button>}
      </div>

      {schedule.count === 0 && (
        <div className="ov-clear"><span className="ov-ic" aria-hidden="true"><Icon name="calendar" context="button" /></span>
          <div><b className="h">No events scheduled yet</b>{canEditTimeline && <button type="button" className="ov-link" style={{ padding: 0 }} onClick={onAddTime}>Add the first one</button>}</div></div>
      )}

      <Days days={schedule.days} stage={stage} noGuests={noGuests} canEditTimeline={canEditTimeline} onOpenEntry={onOpenEntry} onAddTime={onAddTime} />

      {hasEarlier && open && (
        <div>
          <Days days={schedule.earlier} earlier stage={stage} noGuests={noGuests} canEditTimeline={canEditTimeline} onOpenEntry={onOpenEntry} onAddTime={onAddTime} />
        </div>
      )}
      {hasEarlier && (
        <button type="button" className="ov-earlier-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          <b>{open ? "Hide earlier dates" : "Earlier dates"}</b>
          <span>{earlierCount} date{earlierCount !== 1 ? "s" : ""}</span>
        </button>
      )}
    </section>
  );
}
