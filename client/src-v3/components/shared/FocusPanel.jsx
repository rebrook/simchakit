// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.9.0 — components/shared/FocusPanel.jsx
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
// V5.9.0 (V5-O3): presented as the Overview's "Needs you now" card (h2, grid area n). The first
// item is the featured row, red only when it is overdue; the rest are plain rows. Viewers get
// links, not filled buttons; the card itself is the same list computeFocusItems() returns.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { Icon } from "@/utils/iconMap.jsx";

const VISIBLE_CAP = 4;

const BADGE_ICON = { New: "mailCheck" };   // anything starting "Overdue" gets the warning triangle (a shape, never color alone)

function fmtDate(d) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
const fmtMoney = n => `$${(Number(n) || 0).toLocaleString()}`;

function Badge({ text }) {
  const icon = text.startsWith("Overdue") ? "alertTriangle" : BADGE_ICON[text];
  return (
    <span className="ov-badge">
      {icon ? <Icon name={icon} context="badge" /> : <span aria-hidden="true">{"\u25cb"}</span>}
      {text}
    </span>
  );
}

// An invoice's detail: vendor, amount and due date, with Mark paid. The row stays after it is
// paid, reading "Marked paid", until the Undo expires.
function InvoiceDetail({ item, row, paid, busy, onMarkPaid, onClose }) {
  return (
    <section className="ov-detail" aria-label={`${row.title}: invoice detail`}>
      <div className="ov-detail-head">
        <b>{row.title}</b>
        <button type="button" className="ov-link" onClick={onClose}>Close</button>
      </div>
      <div className="ov-detail-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 2, fontSize: 13, color: "var(--text-secondary)" }}>
          {row.vendor && <span>Vendor: {row.vendor}</span>}
          <span>Amount: <b style={{ color: "var(--text-primary)" }}>{fmtMoney(row.amount)}</b></span>
          <span>
            <Icon name={row.overdue ? "alertTriangle" : "clock"} context="badge" />
            Due {fmtDate(row.dueDate)}{row.overdue ? ", overdue" : ""}
          </span>
        </div>
        {paid ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600 }}><Icon name="check" context="badge" /> Marked paid</span>
        ) : (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => onMarkPaid(item, row)}>
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
 * @param {Object}   props.nextUp      { text, tab } from computeNextUp(), for the caught-up row
 * @param {boolean}  props.readOnly    viewers and archived events: links, not filled buttons
 * @param {boolean}  props.holdResolved   true while an Undo is showing: finished rows stay in place
 * @param {Function} props.onNavigate  (tabName, item) => void   (rows that leave Overview)
 * @param {Function} props.onResolve   async (item, row) => boolean  completes a row in place; true when saved
 */
export function FocusPanel({ items, loading, nextUp, readOnly, holdResolved, onNavigate, onResolve }) {
  const [expanded, setExpanded] = useState(false);   // show more than VISIBLE_CAP items
  const [openId,   setOpenId]   = useState(null);    // invoice whose detail is open
  const [ghosts,   setGhosts]   = useState({});      // id -> { item, index, text } rows finished this session
  const [busyKey,  setBusyKey]  = useState(null);

  // Finished rows are only held while their Undo is showing.
  useEffect(() => { if (!holdResolved) setGhosts({}); }, [holdResolved]);

  const shell = (children, extra = {}) => (
    <section className="ov-card ov-a-n" aria-labelledby="ov-needs-title" data-role-readonly={readOnly ? "true" : undefined} {...extra}>
      {children}
    </section>
  );

  // ── Loading: three skeleton rows with reserved height ─────────────────────
  if (loading) {
    return shell(<>
      <div className="ov-nh"><h2 id="ov-needs-title">Needs you now</h2></div>
      {[0, 1, 2].map(i => <div className="ov-skel" key={i} aria-hidden="true"><i /><i /><i /></div>)}
    </>, { "aria-busy": "true" });
  }

  // Live rows, with finished ones put back where they were while their Undo shows.
  const liveIds = new Set(items.map(i => i.id));
  const list = [...items];
  Object.entries(ghosts)
    .filter(([id]) => !liveIds.has(id))
    .sort((a, b) => a[1].index - b[1].index)
    .forEach(([id, g]) => list.splice(Math.min(g.index, list.length), 0, { ...g.item, ghost: g.text }));

  // ── Caught up: a calm row with the next date ──────────────────────────────
  if (list.length === 0) {
    return shell(<>
      <div className="ov-nh"><h2 id="ov-needs-title">Needs you now</h2><span>Nothing right now</span></div>
      <div className="ov-clear">
        <span className="ov-ic" aria-hidden="true"><Icon name="check" context="button" /></span>
        <div>
          <b className="h">You're all caught up</b>
          {nextUp
            ? <button type="button" className="ov-link" style={{ padding: 0, textAlign: "left" }} onClick={() => onNavigate && onNavigate(nextUp.tab, null)}>Next: {nextUp.text} <span aria-hidden="true">{"\u2192"}</span></button>
            : <div className="ov-sm">Nothing is coming up on your calendar.</div>}
        </div>
      </div>
    </>);
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

  const action = (item, i) => item.ghost ? (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600, fontSize: 13 }}><Icon name="check" context="badge" /> {item.ghost}</span>
  ) : (
    <button
      type="button"
      className={`btn ov-act${i === 0 && !readOnly ? (item.tone === "red" ? " ov-btn-red" : " ov-btn-fill") : ""}`}
      disabled={busyKey === item.payload?.rows?.[0]?.key}
      onClick={() => primary(item, i)}
      aria-expanded={item.type === "invoices" ? openId === item.id : undefined}
      aria-label={`${item.actionLabel}: ${item.title}. ${item.detail}`}
    >
      {item.actionLabel}
    </button>
  );

  return shell(<>
    <div className="ov-nh"><h2 id="ov-needs-title">Needs you now</h2><span>{live} item{live !== 1 ? "s" : ""}</span></div>
    {visible.map((item, i) => {
      const overdue = item.tone === "red";
      const body = (
        <div>
          <b className="h">{item.title}</b>
          <span className="ov-sm">
            {item.detail}
            {item.badge && !item.ghost && <> {"\u00b7"} <Badge text={item.badge} /></>}
          </span>
        </div>
      );
      return i === 0 ? (
        <div key={item.id} className={`ov-feat${overdue ? " overdue" : ""}`}>{body}{action(item, i)}</div>
      ) : (
        <div key={item.id} className="ov-it">
          <span className="ov-ic" aria-hidden="true"><Icon name={item.icon} context="button" /></span>
          {body}
          {action(item, i)}
        </div>
      );
    })}

    {openItem && (
      <InvoiceDetail
        item={openItem} row={openItem.payload.rows[0]}
        paid={!!openItem.ghost} busy={busyKey === openItem.payload.rows[0].key}
        onMarkPaid={(it, row) => resolve(it, row, openIndex, "Marked paid")}
        onClose={() => setOpenId(null)}
      />
    )}

    {overflowCount > 0 && (
      <button type="button" className="ov-earlier-toggle" onClick={() => setExpanded(e => !e)} aria-expanded={expanded}>
        {expanded ? "Show less" : `${overflowCount} more item${overflowCount !== 1 ? "s" : ""} need${overflowCount === 1 ? "s" : ""} attention`}
      </button>
    )}
  </>);
}
