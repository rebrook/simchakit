// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.14.0 — rsvp/EventInfo.jsx   (V5-G1)
// The guest "Event details" page: schedule, directions and lodging for the sub-events THIS household
// is invited to, shown as a tab beside "Your reply" on the confirmation screen and the closed view.
// Read-only and presentational: everything arrives in the same GET /api/rsvp response (view.info), so
// it is as fresh as the page load and costs no extra request. Nothing here is color-only: tabs are
// words plus a heavier underline, and every link or button is at least 44px tall (see rsvp.css).
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState } from "react";
import { formatDate, formatTimeRange, formatShortDate, infoCalendarFile, downloadIcs, safeFilename } from "@/rsvp/rsvpModel.js";

const whenLine = (s) => [formatDate(s.startDate, { weekday: "long", month: "long", day: "numeric" }), formatTimeRange(s.startTime, s.endTime)].filter(Boolean).join(", ");
const phoneHref = (p) => `tel:${String(p).replace(/[^0-9+]/g, "")}`;

function ScheduleCard({ view, item }) {
  const hasPlace = item.venue || item.addressLine;
  return (
    <section className="rs-card" aria-label={item.title}>
      <h3 className="rs-card-title">{item.icon ? `${item.icon} ` : ""}{item.title}</h3>
      {whenLine(item) && <p className="rs-sub rs-strongish">{whenLine(item)}</p>}
      {hasPlace && (
        <p className="rs-sub rs-info-line">
          <span className="rs-info-key">Where</span>
          <span>{[item.venue, item.addressLine].filter(Boolean).map((t, i) => <span key={i} className="rs-block">{t}</span>)}</span>
        </p>
      )}
      {item.dressCode && <p className="rs-sub rs-info-line"><span className="rs-info-key">Dress code</span><span>{item.dressCode}</span></p>}
      {item.parkingNote && <p className="rs-sub rs-info-line"><span className="rs-info-key">Parking</span><span>{item.parkingNote}</span></p>}
      <div className="rs-cal">
        {item.mapUrl && (
          <a className="rs-btn secondary" href={item.mapUrl} target="_blank" rel="noopener noreferrer">
            Get directions<span className="rs-vh"> to {item.title} (opens in a new tab)</span>
          </a>
        )}
        {item.startDate && (
          <button type="button" className="rs-btn secondary"
            onClick={() => downloadIcs(`${safeFilename(item.title)}.ics`, infoCalendarFile(view, [item]))}>
            Add to calendar<span className="rs-vh">: {item.title}</span>
          </button>
        )}
      </div>
    </section>
  );
}

function LodgingCard({ block }) {
  return (
    <section className="rs-card" aria-label={block.name}>
      <h3 className="rs-card-title">{block.name}</h3>
      {block.groupCode && <p className="rs-sub rs-info-line"><span className="rs-info-key">Group code</span><span className="rs-code">{block.groupCode}</span></p>}
      {block.cutoffDate && <p className="rs-sub rs-info-line"><span className="rs-info-key">Book by</span><span>{formatShortDate(block.cutoffDate)}</span></p>}
      {(block.phone || block.website) && (
        <div className="rs-cal">
          {block.phone && <a className="rs-btn secondary" href={phoneHref(block.phone)}>Call {block.phone}</a>}
          {block.website && (
            <a className="rs-btn secondary" href={block.website} target="_blank" rel="noopener noreferrer">
              Hotel website<span className="rs-vh"> for {block.name} (opens in a new tab)</span>
            </a>
          )}
        </div>
      )}
    </section>
  );
}

export function EventInfo({ view }) {
  const { info } = view;
  const schedule = info.schedule || [];
  const lodging = info.lodging || [];
  return (
    <div className="rs-summary">
      {info.welcome && <section className="rs-card rs-welcome" aria-label="A note from your hosts"><p className="rs-lede rs-pre">{info.welcome}</p></section>}

      {schedule.length > 0 && (
        <>
          <h2 className="rs-h3">Schedule</h2>
          {schedule.map(item => <ScheduleCard key={item.id} view={view} item={item} />)}
          {schedule.filter(s => s.startDate).length > 1 && (
            <button type="button" className="rs-btn secondary"
              onClick={() => downloadIcs(`${safeFilename(view.event.name)}.ics`, infoCalendarFile(view, schedule))}>
              Add all to calendar
            </button>
          )}
        </>
      )}

      {lodging.length > 0 && (
        <>
          <h2 className="rs-h3">Where to stay</h2>
          {lodging.map(b => <LodgingCard key={b.id || b.name} block={b} />)}
        </>
      )}
    </div>
  );
}

// "Your reply" | "Event details". With nothing shared (view.info is null) the reply shows alone, as
// before. Arrow keys, Home and End move between the two tabs.
export function GuestTabs({ view, children }) {
  const [tab, setTab] = useState("reply");
  const refs = { reply: useRef(null), info: useRef(null) };
  if (!view.info) return children;
  const order = ["reply", "info"];
  const onKey = (e) => {
    const i = order.indexOf(tab);
    const next = e.key === "ArrowRight" ? order[(i + 1) % 2] : e.key === "ArrowLeft" ? order[(i + 1) % 2] : e.key === "Home" ? "reply" : e.key === "End" ? "info" : null;
    if (!next) return;
    e.preventDefault(); setTab(next); refs[next].current?.focus();
  };
  return (
    <>
      <div className="rs-tabs" role="tablist" aria-label="Your invitation" onKeyDown={onKey}>
        {[["reply", "Your reply"], ["info", "Event details"]].map(([key, label]) => (
          <button key={key} ref={refs[key]} type="button" role="tab" id={`rs-tab-${key}`} className="rs-tab"
            aria-selected={tab === key} aria-controls={`rs-panel-${key}`} tabIndex={tab === key ? 0 : -1} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`rs-panel-${tab}`} aria-labelledby={`rs-tab-${tab}`} className="rs-screen rs-panel">
        {tab === "reply" ? children : <EventInfo view={view} />}
      </div>
    </>
  );
}
