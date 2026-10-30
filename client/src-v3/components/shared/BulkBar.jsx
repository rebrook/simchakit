// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.13.0 — components/shared/BulkBar.jsx (V5-O2)
// The bar that appears over a list when rows are selected. The count is a polite
// live region, so screen readers hear "3 tasks selected" as the selection changes.
// ─────────────────────────────────────────────────────────────────────────────

export function BulkBar({ count, noun, onClear, children }) {
  if (count === 0) return null;
  return (
    <div className="bulk-bar" role="region" aria-label={`Actions for selected ${noun}s`}>
      <span className="bulk-bar-count" role="status" aria-live="polite">
        {count} {noun}{count !== 1 ? "s" : ""} selected
      </span>
      {children}
      <button type="button" className="btn btn-ghost btn-sm bulk-bar-btn" onClick={onClear}>Clear (Esc)</button>
    </div>
  );
}

// A row's selection checkbox. Shift-click selects the range back to the last click.
export function BulkCheck({ checked, label, onToggle }) {
  return (
    <label className="bulk-check" onClick={e => e.stopPropagation()}>
      <input type="checkbox" checked={checked} aria-label={label}
        onChange={() => {}}
        onClick={e => onToggle(e.shiftKey)} />
    </label>
  );
}
