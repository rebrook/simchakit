// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.8.0 — components/shared/FocusPanel.jsx
// "Needs you now": what needs the host, leading the Overview. Derived client-side
// by utils/focus.js. Each item has one primary action:
//   replies / unreplied  open the Guests reply queue / the composer (a modal there)
//   invoices / tasks / thankyous   expand in place and complete each row here
//   nav                  open the tab it points at
// Status is a labeled badge plus a shape, never color alone.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { Icon } from "@/utils/iconMap.jsx";

const VISIBLE_CAP = 4;
const ROW_CAP     = 5;   // rows listed when an item expands; the rest are one click away in the tab

const BADGE_ICON = { red: "alertTriangle", gold: "clock", accent: "sparkles" };

function fmtDate(d) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
const fmtMoney = n => `$${(Number(n) || 0).toLocaleString()}`;

function DueText({ row }) {
  return (
    <span className={`focus-due${row.overdue ? " overdue" : ""}`}>
      <Icon name={row.overdue ? "alertTriangle" : "clock"} context="badge" />
      {row.overdue ? "Overdue" : "Due"} {fmtDate(row.dueDate || row.due)}
    </span>
  );
}

// The expanded list for an item. busyKey disables the row while its write is saving.
function ItemRows({ item, onResolve, busyKey, onOpenTab }) {
  const rows = item.payload?.rows || [];
  const shown = rows.slice(0, ROW_CAP);
  const more = rows.length - shown.length;
  return (
    <div className="focus-rows">
      {shown.map(row => (
        <div className="focus-subrow" key={row.key}>
          <div className="focus-subtext">
            <b>{row.title}</b>
            {item.type === "tasks"     && <DueText row={row} />}
            {item.type === "invoices"  && <span className="focus-sub-meta">{fmtMoney(row.amount)}{row.label ? ` · ${row.label}` : ""} · <DueText row={row} /></span>}
            {item.type === "thankyous" && <span className="focus-sub-meta">{row.gift ? `${row.gift} · ` : ""}{row.stage === "write" ? "Note not written" : "Written, not mailed"}</span>}
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm focus-sub-btn"
            disabled={busyKey === row.key}
            onClick={() => onResolve(item, row)}
          >
            <Icon name="check" context="badge" />
            {item.type === "tasks" ? "Done" : item.type === "invoices" ? "Mark paid" : row.stage === "write" ? "Mark written" : "Mark mailed"}
          </button>
        </div>
      ))}
      {more > 0 && (
        <button type="button" className="focus-more-link" onClick={() => onOpenTab(item.tab || (item.type === "thankyous" ? "gifts" : item.type === "tasks" ? "tasks" : "budget"))}>
          {more} more in {item.type === "tasks" ? "Tasks" : item.type === "invoices" ? "Budget" : "Gifts"}
        </button>
      )}
    </div>
  );
}

/**
 * @param {Object}   props
 * @param {Array}    props.items       FocusItem[] from computeFocusItems()
 * @param {boolean}  props.loading     true while any collection is still loading
 * @param {Function} props.onNavigate  (tabName, item) => void   (replies, reminder composer, nav items)
 * @param {Function} props.onResolve   async (item, row) => void  completes one row in place
 */
export function FocusPanel({ items, loading, onNavigate, onResolve }) {
  const [expanded, setExpanded] = useState(false);   // show more than VISIBLE_CAP items
  const [openId,   setOpenId]   = useState(null);    // item expanded in place
  const [busyKey,  setBusyKey]  = useState(null);

  // Guard: don't render anything while data is loading (no flash)
  if (loading) return null;

  // ── Empty state ──────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="focus-panel focus-panel-empty">
        <div className="focus-empty-icon">
          <Icon name="check" context="empty" />
        </div>
        <div className="focus-empty-title">You're all caught up</div>
        <div className="focus-empty-detail">Nothing needs you right now. Enjoy the quiet.</div>
      </div>
    );
  }

  const visible = expanded ? items : items.slice(0, VISIBLE_CAP);
  const overflowCount = items.length - VISIBLE_CAP;
  const inPlace = it => it.type === "invoices" || it.type === "tasks" || it.type === "thankyous";

  async function resolve(item, row) {
    setBusyKey(row.key);
    try { await onResolve(item, row); } finally { setBusyKey(null); }
  }

  function primary(item) {
    if (inPlace(item)) setOpenId(openId === item.id ? null : item.id);
    else onNavigate && onNavigate(item.tab, item);
  }

  return (
    <div className="focus-panel focus-panel-lead">
      <div className="focus-panel-header">
        <span className="focus-panel-title">Needs you now</span>
        <span className="focus-panel-count">{items.length} item{items.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="focus-panel-list">
        {visible.map((item, i) => {
          const open = openId === item.id && inPlace(item);
          return (
            <div key={item.id} className={`focus-item focus-item-${item.tone}`}>
              <div className="focus-row">
                <span className={`focus-chip focus-chip-${item.tone}`} aria-hidden="true">
                  <Icon name={item.icon} context="badge" />
                </span>
                <span className="focus-content">
                  <span className="focus-title">{item.title}</span>
                  <span className="focus-detail">{item.detail}</span>
                  <span className={`focus-badge focus-badge-${item.tone}`}>
                    <Icon name={BADGE_ICON[item.tone] || "sparkles"} context="badge" />{item.badge}
                  </span>
                </span>
                <button
                  type="button"
                  className={`btn btn-sm focus-primary${i === 0 ? " btn-primary" : " btn-secondary"}`}
                  onClick={() => primary(item)}
                  aria-expanded={inPlace(item) ? open : undefined}
                  aria-label={`${item.actionLabel}: ${item.title}. ${item.detail}`}
                >
                  {open ? "Close" : item.actionLabel}
                </button>
              </div>
              {open && <ItemRows item={item} onResolve={resolve} busyKey={busyKey} onOpenTab={t => onNavigate && onNavigate(t, item)} />}
            </div>
          );
        })}
      </div>

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
