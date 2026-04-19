// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — SearchOverlay.jsx
// Loads all collections via useEventData, assembles a state object,
// then delegates to searchCollection (same logic as V2).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useMemo } from "react";
import { useEventData }       from "@/hooks/useEventData.js";
import { SEARCH_GROUPS, SEARCH_PER_GROUP } from "@/constants/ui.js";
import { searchCollection }   from "@/utils/search.js";

export function SearchOverlay({ eventId, adminConfig, onNavigate, onClose }) {
  const { items: households } = useEventData(eventId, "households");
  const { items: people }     = useEventData(eventId, "people");
  const { items: vendors }    = useEventData(eventId, "vendors");
  const { items: expenses }   = useEventData(eventId, "expenses");
  const { items: tasks }      = useEventData(eventId, "tasks");
  const { items: prep }       = useEventData(eventId, "prep");
  const { items: gifts }      = useEventData(eventId, "gifts");
  const { items: favors }     = useEventData(eventId, "favors");

  // Assemble V2-compatible state object for searchCollection
  const state = useMemo(() => ({
    households, people, vendors, expenses, tasks, prep, gifts, favors,
    adminConfig,
  }), [households, people, vendors, expenses, tasks, prep, gifts, favors, adminConfig]);

  const [query,    setQuery]    = useState("");
  const [expanded, setExpanded] = useState({});
  const [results,  setResults]  = useState({});
  const inputRef    = useRef(null);
  const debounceRef = useRef(null);

  // Autofocus on mount
  useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);

  // Escape to close
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleInput = (val) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setResults(searchCollection(state, val));
      setExpanded({});
    }, 200);
  };

  const handleSelect = (result) => {
    onNavigate(result.tab, result.id, result.collection, result.householdId || null);
    onClose();
  };

  const totalResults = Object.values(results).reduce((s, arr) => s + arr.length, 0);
  const hasQuery     = query.trim().length > 0;

  return (
    <div className="search-overlay-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="search-overlay-panel" onClick={e => e.stopPropagation()}>

        {/* Input row */}
        <div className="search-overlay-input-row">
          <span style={{ fontSize: 18, color: "var(--text-muted)", flexShrink: 0 }}>🔍</span>
          <input
            ref={inputRef}
            className="search-overlay-input"
            type="text"
            placeholder="Search guests, vendors, tasks, expenses…"
            value={query}
            onChange={e => handleInput(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <button className="icon-btn" onClick={onClose} title="Close search" style={{ flexShrink: 0 }}>✕</button>
        </div>

        {/* Results */}
        <div className="search-overlay-results">
          {!hasQuery && (
            <div className="search-overlay-hint">
              Start typing to search across guests, vendors, expenses, tasks, and more.
            </div>
          )}

          {hasQuery && totalResults === 0 && (
            <div className="search-overlay-empty">
              <div style={{ fontSize: 28, marginBottom: 10 }}>🔍</div>
              No results for <strong>"{query}"</strong>
            </div>
          )}

          {hasQuery && totalResults > 0 && SEARCH_GROUPS.map(group => {
            const items = results[group.key];
            if (!items || items.length === 0) return null;
            const isExpanded   = !!expanded[group.key];
            const visibleItems = isExpanded ? items : items.slice(0, SEARCH_PER_GROUP);
            const hiddenCount  = items.length - SEARCH_PER_GROUP;

            return (
              <div key={group.key}>
                <div className="search-group-header">
                  {group.icon} {group.label} — {items.length} result{items.length !== 1 ? "s" : ""}
                </div>
                {visibleItems.map(result => (
                  <div key={result.id} className="search-result-row" onClick={() => handleSelect(result)}>
                    <span className="search-result-icon">{group.icon}</span>
                    <div className="search-result-body">
                      <div className="search-result-primary">{result.primary}</div>
                      {result.secondary && (
                        <div className="search-result-secondary">{result.secondary}</div>
                      )}
                    </div>
                    <span className="search-result-tab">{group.label}</span>
                  </div>
                ))}
                {!isExpanded && hiddenCount > 0 && (
                  <button className="search-show-all"
                    onClick={() => setExpanded(ex => ({ ...ex, [group.key]: true }))}>
                    Show all {items.length} results in {group.label} →
                  </button>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
