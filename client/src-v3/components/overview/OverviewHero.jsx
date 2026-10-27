// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.9.0 — components/overview/OverviewHero.jsx
// The Overview hero, one component with a `stage` prop: "new" (day zero), "pre" (planning),
// "soon" (final two weeks), "today" (the day), "post" (after the event). Solid palette-derived
// background (styles/palette-tokens.css), a faded motif on the right half only, a monogram ring
// (a host logo replaces it), no eyebrow label and no schedule chips. A photo layer is in place
// but empty (the host-photo hero is a follow-up).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { formatDate } from "@/utils/dates.js";
import { shortMonthDay } from "@/utils/overview.js";

const motifSvg = (d) => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72' viewBox='0 0 72 72' fill='none' stroke='%23fff' stroke-opacity='.11' stroke-width='1.3'%3E%3Cpath d='${d}'/%3E%3C/svg%3E")`;
const MOTIFS = {
  star:    motifSvg("M36 16 55 49H17zM36 56 17 23h38z"),
  lattice: motifSvg("M36 6 66 36 36 66 6 36z"),
  none:    "none",
};

// A number that counts down from itself plus ten, once (see useOverviewAnimation).
function CountNumber({ value, animate }) {
  const [shown, setShown] = useState(animate ? value + 10 : value);
  useEffect(() => {
    if (!animate) { setShown(value); return undefined; }
    const from = value + 10, t0 = performance.now();
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / 900), e = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from - (from - value) * e));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, animate]);
  return <><span aria-hidden="true">{shown}</span><span className="ov-vh">{value}</span></>;
}

function Runway({ runway, go, stage }) {
  if (!runway) return null;
  const fill = go ? `${runway.todayPos}%` : "0%";
  // Markers alternate above and below the line; "Today" is always above.
  const marks = [
    ...runway.items.map(m => ({ key: m.key, pos: m.pos, state: m.state, b: shortMonthDay(m.date), t: m.label })),
    { key: "today", pos: runway.todayPos, state: "now", b: "Today", t: shortMonthDay(runway.todayIso), up: true },
    { key: "day", pos: 100, state: "end", b: shortMonthDay(runway.mainDate), t: "The day" },
  ].sort((a, b) => a.pos - b.pos);
  let flip = false;
  marks.forEach(m => { if (m.key === "today") { m.side = "up"; flip = true; } else { m.side = flip ? "up" : "dn"; flip = !flip; } });
  return (
    <div className="ov-runway">
      <div className="ov-rt" aria-hidden="true" />
      <div className="ov-rf" aria-hidden="true" style={{ "--w": fill }} />
      <ol aria-label="Dates leading up to the event">
        {marks.map((m, i) => (
          <li key={m.key} className={`ov-mi ${m.state === "now" ? "now" : m.state === "done" ? "done" : ""}${m.pos >= 100 ? " end" : ""}${m.pos <= 0 ? " start" : ""}`} style={{ left: `${m.pos}%` }}>
            <span className="d" aria-hidden="true" />
            <span className={`l ${m.side}`}><b>{m.b}</b>{m.t}</span>
          </li>
        ))}
      </ol>
      {runway.more > 0 && <span className="ov-runway-note" style={{ top: 0, textAlign: "right" }}>+{runway.more} more</span>}
      {stage === "new" && runway.empty && <div className="ov-runway-note">Your reply deadline, invitations and other dates appear here as you add them.</div>}
    </div>
  );
}

export function OverviewHero({
  stage, name, logoUrl, motif, mainDate, venue, hebrew, days, runway, nextLine,
  dayRows = [], preferredName, thankyou, canAct, onOpenDayOf, onThankYous, anim,
}) {
  const monogram = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const ring = (
    <div className="ov-ring" aria-hidden="true">
      {logoUrl ? <img src={logoUrl} alt="" /> : monogram}
    </div>
  );
  const meta = mainDate ? `${formatDate(mainDate)}${venue ? `, at ${venue}` : ""}` : (venue || "");
  const heb = hebrew && (
    <div className="ov-heb">
      <span lang="he" dir="rtl">{hebrew.hebrew}</span>
      <span>{hebrew.english}</span>
    </div>
  );

  return (
    <section className="ov-hero" aria-label="Event" style={{ "--ov-motif": MOTIFS[motif] || MOTIFS.none }}>
      <div className="ov-hero-photo" aria-hidden="true" />

      {(stage === "new" || stage === "pre" || stage === "soon") && (
        <>
          <div className="ov-hero-top">
            {ring}
            <div>
              <h2 className="ov-name">{name}</h2>
              {meta && <div className="ov-meta">{meta}</div>}
              {heb}
            </div>
            {days !== null && (
              <div className="ov-cnt">
                <div className="ov-cnt-n"><CountNumber value={days} animate={anim.play} /></div>
                <div className="ov-cnt-u">{days === 1 ? "day to go" : "days to go"}</div>
              </div>
            )}
          </div>
          <Runway runway={runway} go={anim.go} stage={stage} />
          {nextLine && <div className="ov-nextline"><b>Next:</b> {nextLine}</div>}
        </>
      )}

      {stage === "today" && (
        <div style={{ position: "relative" }}>
          <div className="ov-hero-top" style={{ gridTemplateColumns: "minmax(0, 1fr) auto" }}>
            <div>
              <div className="ov-say">Today is the day</div>
              <h2 className="ov-name" style={{ fontSize: "clamp(40px, 8cqw, 84px)" }}>{preferredName ? `Mazel tov, ${preferredName}` : "Mazel tov!"}</h2>
              <div className="ov-meta">{meta}</div>
              {heb}
            </div>
            {ring}
          </div>
          <div className="ov-sched">
            {dayRows.slice(0, 3).map((r, i) => (
              <div key={r.id}>
                <div className="k">{i === 0 ? "Up next" : i === 1 ? "Then" : "Tonight"}</div>
                <div className="tm">{r.time || "Time to be set"}</div>
                <div className="w2">{r.title}</div>
                {r.havdalah && <div className="w2" style={{ marginTop: 2 }}>Shabbat ends {r.havdalah}</div>}
              </div>
            ))}
            {dayRows.length === 0 && <div><div className="k">Today</div><div className="w2">Everything on the schedule is done.</div></div>}
            <div className="go">
              <button type="button" className="btn ov-btn-hero" onClick={onOpenDayOf}>Open Day-of Mode</button>
            </div>
          </div>
        </div>
      )}

      {stage === "post" && (
        <div className="ov-post">
          <div className="l">
            {ring}
            <div>
              <h2 className="ov-name" style={{ fontSize: "clamp(44px, 8cqw, 84px)", fontStyle: "italic" }}>What a day.</h2>
              <div className="ov-meta">{name}, {meta}</div>
              {hebrew ? heb : <div className="ov-heb"><span lang="he" dir="rtl">מזל טוב</span></div>}
            </div>
          </div>
          <div className="r">
            {thankyou > 0 ? (
              <>
                <div className="big">{thankyou}</div>
                <div className="k">thank-you note{thankyou !== 1 ? "s" : ""} to write</div>
                <div className="w2">One for every gift. Mark each as written and mailed.</div>
                {canAct && <div><button type="button" className="btn ov-btn-hero" onClick={onThankYous}>Start thank-you notes</button></div>}
              </>
            ) : (
              <>
                <div className="k">Every thank-you note is written.</div>
                <div className="w2">Nothing left to do for this celebration.</div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
