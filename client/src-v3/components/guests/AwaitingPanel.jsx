// Moved verbatim from GuestsTab.jsx (V4.45.1 module split) — no behavior changes.
import { statusStyle } from "@/components/guests/statusStyle.js";

export function AwaitingPanel({ awaitingRows, awaitingSplit, clearAwaiting, jumpToHousehold }) {
  return (
    <div className="awaiting-panel">
      <div className="awaiting-panel-head">
        <div>
          <div className="awaiting-panel-title">
            {awaitingRows.length === 0
              ? "No one is awaiting an answer"
              : `Still waiting on ${awaitingRows.length} guest${awaitingRows.length!==1?"s":""}`}
          </div>
          {awaitingRows.length > 0 && (
            <div className="awaiting-panel-sub">
              {awaitingSplit.adults} adult{awaitingSplit.adults!==1?"s":""}, {awaitingSplit.kids} kid{awaitingSplit.kids!==1?"s":""}. Tap a name to open the household.
            </div>
          )}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={clearAwaiting}>Clear filter</button>
      </div>
      {awaitingRows.length > 0 && (
        <ul className="awaiting-panel-list">
          {awaitingRows.map(r => (
            <li key={r.person.id}>
              <button type="button" className="awaiting-panel-row" onClick={() => jumpToHousehold(r.hh?.id)}>
                <span className="awaiting-panel-name">{r.name}</span>
                <span className={`tag ${r.person.isChild ? "tag-blue" : "tag-muted"}`}>{r.person.isChild ? "Child" : "Adult"}</span>
                <span className="awaiting-panel-hh">{r.hh?.formalName || ""}</span>
                {r.hh && (
                  <span className="awaiting-panel-status" style={{ background: statusStyle[r.hh.rsvpStatus]?.bg, color: statusStyle[r.hh.rsvpStatus]?.color }}>
                    {r.hh.rsvpStatus || "Invited"}
                  </span>
                )}
                <span className="awaiting-panel-secs">{r.titles.join(", ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
