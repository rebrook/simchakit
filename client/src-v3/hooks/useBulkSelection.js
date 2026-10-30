// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.13.0 — hooks/useBulkSelection.js (V5-O2)
// Row selection for list tabs. toggle(id, shiftKey): a plain click toggles one
// row; Shift-click selects the range from the last clicked row to this one, in
// the order the rows are shown (orderedIds). Esc clears the selection unless a
// dialog is open or focus is in a field.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback, useEffect } from "react";

export function useBulkSelection(orderedIds, enabled = true) {
  const [selected, setSelected] = useState(() => new Set());
  const anchor = useRef(null);
  const orderRef = useRef(orderedIds);
  orderRef.current = orderedIds;

  const toggle = useCallback((id, shiftKey = false) => {
    setSelected(prev => {
      const next = new Set(prev);
      const order = orderRef.current;
      const a = anchor.current;
      if (shiftKey && a != null && a !== id && order.includes(a) && order.includes(id)) {
        const [from, to] = [order.indexOf(a), order.indexOf(id)].sort((x, y) => x - y);
        order.slice(from, to + 1).forEach(i => next.add(i));
      } else {
        next.has(id) ? next.delete(id) : next.add(id);
      }
      return next;
    });
    anchor.current = id;
  }, []);

  const clear = useCallback(() => { setSelected(new Set()); anchor.current = null; }, []);
  const selectAll = useCallback((ids) => setSelected(new Set(ids)), []);

  // Drop ids that are no longer shown (filtered out, deleted by someone else).
  const orderKey = orderedIds.join("|");
  useEffect(() => {
    setSelected(prev => {
      const visible = new Set(orderRef.current);
      const next = new Set([...prev].filter(id => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [orderKey]);

  useEffect(() => {
    if (!enabled || selected.size === 0) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      const t = e.target;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      if (document.querySelector(".modal-backdrop, [role='dialog']")) return;
      clear();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled, selected.size, clear]);

  return { selected, count: selected.size, isSelected: (id) => selected.has(id), toggle, clear, selectAll };
}
