// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.8.2 — components/shared/FocusPanel.jsx
// "Needs you now": what needs the host, leading the Overview. Derived client-side by
// utils/focus.js in urgency order, one row per thing, each row naming it. Only the first
// row has the filled button. Only an overdue row is tinted, and it also says "Overdue N
// days" in a bordered badge with a shape; a badge appears only where it adds information
// (Overdue, New). Each row has one primary action:
//   "Mark done"            completes a task here, with an 8-second Undo
//   "Open invoice"         opens that invoice's detail under the list, where Mark paid lives
//   a verb and an arrow    ("Review replies →", "Write thank-yous →") leaves Overview
// A row you finish stays in place as "Marked done" until its Undo expires, so nothing slides
// under your finger. While data loads, three skeleton rows hold the list's space.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { Icon } from "@/utils/iconMap.jsx";

const VISIBLE_CAP = 4;

const BADGE_ICON = { New: "mailCheck" };   // anything starting "Overdue" gets the warning triangle

function fmtDate(d) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
const fmtMoney = n => `$${(Number(n) || 0).toLocaleString()}`;

function Badge({ text }) {
  const icon = text.startsWith("Overdue") ? "alertTriangle" : BADGE_ICON[text];
  return (
    <span className="focus-badge">
      {icon ? <Icon name={icon} context="badge" /> : <span className="focus-badge-dot" aria-hidden="true" />}
      {text}
    </span>
  );
}

// An invoice's detail: vendor, amount and due date, with Mark paid. The row stays after it is
// paid, reading "Marked paid", until the Undo expires.
function InvoiceDetail({ item, row, paid, busy, onMarkPaid, onClose }) {
  return (
    <section className="focus-detail-pane" aria-label={`${row.title}: invoice detail`}>
      <div className="focus-detail-head">
        <b>{row.title}</b>
        <button type="button" className="focus-detail-close" onClick={onClose}>Close</button>
      </div>
      <div className="focus-subrow">
        <div className="focus-subtext">
          {row.vendor && <span className="focus-sub-meta">Vendor: {row.vendor}</span>}
          <span className="focus-sub-meta">Amount: <b>{fmtMoney(row.amount)}</b></span>
          <span className="focus-due">
            <Icon name={row.overdue ? "alertTriangle" : "clock"} context="badge" />
            Due {fmtDate(row.dueDate)}{row.overdue ? ", overdue" : ""}
          </span>
        </div>
        {paid ? (
          <span className="focus-done"><Icon name="check" context="badge" /> Marked paid</span>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm focus-sub-btn" disabled={busy} onClick={() => onMarkPaid(item, row)}>
            Mark paid
          </button>
        )}
      </div>
    </section>
  );
}

/**
 * @param {Object}   props
 * @param {Array}    props.items       FocusItem[] from computeFocusItems()
 * @param {boolean}  props.loading     true while any collection is still loading
 * @param {Object}   props.nextUp      { text, tab } from computeNextUp(), for the empty state
 * @param {boolean}  props.hideWhenEmpty  true while the Getting ready card stands in for the empty state
 * @param {boolean}  props.holdResolved   true while an Undo is showing: finished rows stay in place
 * @param {Function} props.onNavigate  (tabName, item) => void   (rows that leave Overview)
 * @param {Function} props.onResolve   async (item, row) => boolean  completes a row in place; true when saved
 */
export function FocusPanel({ items, loading, nextUp, hideWhenEmpty, holdResolved, onNavigate, onResolve }) {
  const [expanded, setExpanded] = useState(false);   // show more than VISIBLE_CAP items
  const [openId,   setOpenId]   = useState(null);    // invoice whose detail is open
  const [ghosts,   setGhosts]   = useState({});      // id -> { item, index, text } rows finished this session
  const [busyKey,  setBusyKey]  = useState(null);

  // Finished rows are only held while their Undo is showing.
  useEffect(() => { if (!holdResolved) setGhosts({}); }, [holdResolved]);

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

  // Live rows, with finished ones put back where they were while their Undo shows.
  const liveIds = new Set(items.map(i => i.id));
  const list = [...items];
  Object.entries(ghosts)
    .filter(([id]) => !liveIds.has(id))
    .sort((a, b) => a[1].index - b[1].index)
    .forEach(([id, g]) => list.splice(Math.min(g.index, list.length), 0, { ...g.item, ghost: g.text }));

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
  const live = items.length;

  async function resolve(item, row, index, text) {
    setBusyKey(row.key);
    try {
      const ok = await onResolve(item, row);
      if (ok) setGhosts(g => ({ ...g, [item.id]: { item, index, text } }));
    } finally { setBusyKey(null); }
  }

  function primary(item, index) {
    if (item.type === "tasks") resolve(item, item.payload.rows[0], index, "Marked done");
    else if (item.type === "invoices") setOpenId(openId === item.id ? null : item.id);
    else { setOpenId(null); onNavigate && onNavigate(item.tab, item); }
  }

  const openItem = list.find(i => i.id === openId && i.type === "invoices");
  const openIndex = openItem ? list.indexOf(openItem) : -1;

  return (
    <div className="focus-panel focus-panel-lead">
      <div className="focus-panel-header">
        <span className="focus-panel-title">Needs you now</span>
        <span className="focus-panel-count">{live} item{live !== 1 ? "s" : ""}</span>
      </div>

      <div className="focus-panel-list">
        {visible.map((item, i) => {
          const overdue = item.tone === "red";
          const isOpen = openId === item.id;
          return (
            <div key={item.id} className={`focus-item${overdue ? " is-overdue" : ""}${isOpen ? " is-open" : ""}`}>
              <div className="focus-row">
                <span className="focus-chip" aria-hidden="true">
                  <Icon name={item.icon} context="badge" />
                </span>
                <span className="focus-content">
                  <span className="focus-title">{item.title}</span>
                  <span className="focus-detail">
                    {item.detail}
                    {item.badge && !item.ghost && <> {"·"} <Badge text={item.badge} /></>}
                  </span>
                </span>
                {item.ghost ? (
                  <span className="focus-done"><Icon name="check" context="badge" /> {item.ghost}</span>
                ) : (
                  <button
                    type="button"
                    className={`btn btn-sm focus-primary${i === 0 ? " btn-primary" : " btn-secondary"}`}
                    disabled={busyKey === item.payload?.rows?.[0]?.key}
                    onClick={() => primary(item, i)}
                    aria-expanded={item.type === "invoices" ? isOpen : undefined}
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

      {openItem && (
        <InvoiceDetail
          item={openItem} row={openItem.payload.rows[0]}
          paid={!!openItem.ghost} busy={busyKey === openItem.payload.rows[0].key}
          onMarkPaid={(it, row) => resolve(it, row, openIndex, "Marked paid")}
          onClose={() => setOpenId(null)}
        />
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
