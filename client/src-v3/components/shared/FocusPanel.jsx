// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3 — components/shared/FocusPanel.jsx
// "What Needs You Next" — surfaces the top 3 time-sensitive or blocking
// items on Overview, derived client-side from existing data.
//
// Placement: hero row beside the countdown card.
// Each row is a full-width button that deep-links to the relevant tab.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { Icon }     from "@/utils/iconMap.jsx";

const VISIBLE_CAP = 3;

/**
 * @param {Object} props
 * @param {Array}  props.items       — FocusItem[] from computeFocusItems()
 * @param {boolean} props.loading    — true while any collection is still loading
 * @param {Function} props.onNavigate — (tabName) => void
 */
export function FocusPanel({ items, loading, onNavigate }) {
  const [expanded, setExpanded] = useState(false);

  // Guard: don't render anything while data is loading (no flash)
  if (loading) return null;

  const visible = expanded ? items : items.slice(0, VISIBLE_CAP);
  const overflowCount = items.length - VISIBLE_CAP;

  // ── Empty state ──────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="focus-panel focus-panel-empty">
        <div className="focus-empty-icon">
          <Icon name="check" context="empty" />
        </div>
        <div className="focus-empty-title">You're all caught up</div>
        <div className="focus-empty-detail">Nice work. Nothing needs your attention right now.</div>
      </div>
    );
  }

  // ── Populated state ────────────────────────────────────────────────────
  return (
    <div className="focus-panel">
      <div className="focus-panel-header">
        <Icon name="tips" context="inline" />
        <span>What needs you next</span>
      </div>

      <div className="focus-panel-list">
        {visible.map(item => (
          <button
            key={item.id}
            className="focus-row"
            onClick={() => onNavigate && onNavigate(item.tab)}
            aria-label={`${item.title}. ${item.detail}. Go to ${item.tab}.`}
          >
            <span className={`focus-chip focus-chip-${item.tone}`}>
              <Icon name={item.icon} context="badge" />
            </span>
            <span className="focus-content">
              <span className="focus-title">{item.title}</span>
              <span className="focus-detail">{item.detail}</span>
            </span>
            <span className="focus-arrow" aria-hidden="true">
              <Icon name="arrowRight" context="inline" />
            </span>
          </button>
        ))}
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
