// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.8.1 — components/shared/FocusPanel.jsx
// "Needs you now": what needs the host, leading the Overview. Derived client-side
// by utils/focus.js, already in urgency order; only the first item gets the filled
// button. Each item has one primary action:
//   verb ("Mark paid", "Mark done", "Mark written")   opens the item's detail below the
//       list, where each row has the same verb button. Opening an item never moves
//       another row's button: the detail sits under the whole list, and a row you
//       finish stays in place as "Done" (the list item also stays until you close it).
//   verb + arrow ("Review replies →", "Send reminder →", "Open seating →")   leaves Overview.
// Status is a neutral badge with a border, a shape and a label, never color alone.
// While data loads, three skeleton rows hold the space so nothing below jumps.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { Icon } from "@/utils/iconMap.jsx";

const VISIBLE_CAP = 4;

// One shape per status word, so urgency reads without color.
const BADGE_ICON = { Overdue: "alertTriangle", "Due soon": "clock", "This week": "clock", New: "mailCheck", Owed: "gifts", "To do": "target" };

function fmtDate(d) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
const fmtMoney = n => `$${(Number(n) || 0).toLocaleString()}`;
const inPlace = it => it.type === "invoices" || it.type === "tasks" || it.type === "thankyous";

function rowVerb(item, row) {
  if (item.type === "tasks")    return "Mark done";
  if (item.type === "invoices") return "Mark paid";
  return row.stage === "write" ? "Mark written" : "Mark mailed";
}
function doneText(item, row) {
  if (item.type === "tasks")    return "Marked done";
  if (item.type === "invoices") return "Marked paid";
  return row.stage === "write" ? "Marked written" : "Marked mailed";
}

function Badge({ text }) {
  const icon = BADGE_ICON[text];
  return (
    <span className="focus-badge">
      {icon ? <Icon name={icon} context="badge" /> : <span className="focus-badge-dot" aria-hidden="true" />}
      {text}
    </span>
  );
}

// The detail for one open item. Rows come from the snapshot taken when it opened, so a row
// stays put after it is finished; it reads as done once it is no longer in the live data.
function Detail({ item, rows, liveKeys, busyKey, onResolve, onClose }) {
  return (
    <section className="focus-detail-pane" aria-label={`${item.title}: details`}>
      <div className="focus-detail-head">
        <b>{item.title}</b>
        <button type="button" className="focus-detail-close" onClick={onClose}>Close</button>
      </div>
      {rows.map(row => {
        const done = !liveKeys.has(row.key);
        return (
          <div className="focus-subrow" key={row.key}>
            <div className="focus-subtext">
              <b>{row.title}</b>
              {item.type === "invoices" && (
                <span className="focus-sub-meta">
                  {row.vendor ? `${row.vendor} · ` : ""}{fmtMoney(row.amount)}{row.label ? ` · ${row.label}` : ""}
                </span>
              )}
              {item.type === "thankyous" && (
                <span className="focus-sub-meta">{row.gift ? `${row.gift} · ` : ""}{row.stage === "write" ? "Note not written" : "Written, not mailed"}</span>
              )}
              {(item.type === "invoices" || item.type === "tasks") && (
                <span className="focus-due">
                  <Icon name={row.overdue ? "alertTriangle" : "clock"} context="badge" />
                  {row.overdue ? "Overdue, due" : "Due"} {fmtDate(row.dueDate || row.due)}
                </span>
              )}
            </div>
            {done ? (
              <span className="focus-done"><Icon name="check" context="badge" /> {doneText(item, row)}</span>
            ) : (
              <button type="button" className="btn btn-secondary btn-sm focus-sub-btn"
                disabled={busyKey === row.key} onClick={() => onResolve(item, row)}>
                {rowVerb(item, row)}
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}

/**
 * @param {Object}   props
 * @param {Array}    props.items       FocusItem[] from computeFocusItems()
 * @param {boolean}  props.loading     true while any collection is still loading
 * @param {Object}   props.nextUp      { text, tab } from computeNextUp(), for the empty state
 * @param {boolean}  props.hideWhenEmpty  true while the Getting ready card stands in for the empty state
 * @param {Function} props.onNavigate  (tabName, item) => void   (replies, reminder composer, nav items)
 * @param {Function} props.onResolve   async (item, row) => void  completes one row in place
 */
export function FocusPanel({ items, loading, nextUp, hideWhenEmpty, onNavigate, onResolve }) {
  const [expanded, setExpanded] = useState(false);   // show more than VISIBLE_CAP items
  const [open,     setOpen]     = useState(null);    // { item, index, rows } snapshot of the open item
  const [busyKey,  setBusyKey]  = useState(null);

  // ── Loading: three skeleton rows with reserved height ─────────────────────
  if (loading) {
    return (
      <div className="focus-panel focus-panel-lead" aria-busy="true" aria-label="Loading what needs you">
        <div className="focus-panel-header"><span className="focus-panel-title">Needs you now</span></div>
        <div className="focus-panel-list">
          {[0, 1, 2].map(i => (
            <div className="focus-item focus-skeleton" key={i} aria-hidden="true">
              <div className="focus-row"><span className="focus-skel-chip" /><span className="focus-skel-lines"><i /><i /></span><span className="focus-skel-btn" /></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // The open item stays in the list while its detail is open, even after its last row is finished.
  const live = items.find(i => i.id === open?.item.id);
  let list = items;
  if (open && !live) {
    list = [...items];
    list.splice(Math.min(open.index, list.length), 0, { ...open.item, resolved: true });
  }

  // ── Empty state: one line, plus a link to the next dated thing ────────────
  if (list.length === 0) {
    if (hideWhenEmpty) return null;
    return (
      <div className="focus-panel focus-panel-empty">
        <Icon name="check" context="inline" />
        <span className="focus-empty-title">Nothing needs you right now.</span>
        {nextUp && (
          <button type="button" className="focus-empty-link" onClick={() => onNavigate && onNavigate(nextUp.tab, null)}>
            Next up: {nextUp.text} <span aria-hidden="true">{"→"}</span>
          </button>
        )}
      </div>
    );
  }

  const visible = expanded ? list : list.slice(0, VISIBLE_CAP);
  const overflowCount = list.length - VISIBLE_CAP;
  const liveKeys = new Set((live?.payload?.rows || []).map(r => r.key));

  async function resolve(item, row) {
    setBusyKey(row.key);
    try { await onResolve(item, row); } finally { setBusyKey(null); }
  }

  function primary(item, index) {
    if (inPlace(item)) setOpen(open?.item.id === item.id ? null : { item, index, rows: item.payload?.rows || [] });
    else { setOpen(null); onNavigate && onNavigate(item.tab, item); }
  }

  return (
    <div className="focus-panel focus-panel-lead">
      <div className="focus-panel-header">
        <span className="focus-panel-title">Needs you now</span>
        <span className="focus-panel-count">{items.length} item{items.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="focus-panel-list">
        {visible.map((item, i) => {
          const isOpen = open?.item.id === item.id;
          return (
            <div key={item.id} className={`focus-item focus-item-${item.tone}${isOpen ? " is-open" : ""}`}>
              <div className="focus-row">
                <span className="focus-chip" aria-hidden="true">
                  <Icon name={item.icon} context="badge" />
                </span>
                <span className="focus-content">
                  <span className="focus-title">{item.resolved ? "All done" : item.title}</span>
                  <span className="focus-detail">{item.resolved ? "Nothing left here. Undo is in the message above." : item.detail}</span>
                  {!item.resolved && <Badge text={item.badge} />}
                </span>
                {item.resolved ? (
                  <span className="focus-done"><Icon name="check" context="badge" /> Done</span>
                ) : (
                  <button
                    type="button"
                    className={`btn btn-sm focus-primary${i === 0 ? " btn-primary" : " btn-secondary"}`}
                    onClick={() => primary(item, i)}
                    aria-expanded={inPlace(item) ? isOpen : undefined}
                    aria-label={`${item.actionLabel}: ${item.title}. ${item.detail}`}
                  >
                    {item.actionLabel}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {open && (
        <Detail item={live || open.item} rows={open.rows} liveKeys={liveKeys}
          busyKey={busyKey} onResolve={resolve} onClose={() => setOpen(null)} />
      )}

      {overflowCount > 0 && (
        <button
          className="focus-expand"
          onClick={() => setExpanded(e => !e)}
          aria-expanded={expanded}
        >
          {expanded
            ? "Show less"
            : `${overflowCount} more item${overflowCount !== 1 ? "s" : ""} need${overflowCount === 1 ? "s" : ""} attention`}
        </button>
      )}
    </div>
  );
}
