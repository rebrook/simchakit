// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.40.0: components/shell/EventSwitcher.jsx
// Desktop sidebar event switcher. Replaces the old button that always sent the
// user back to the Event Picker.
//
// Two modes:
//   - Dropdown (onSelectEvent provided): the trigger opens a popover listing
//     the user's owned and shared events. Picking one calls onSelectEvent;
//     "All events" calls onBack (the old behavior).
//   - Static (no onSelectEvent, i.e. demo mode): renders the original button,
//     which calls onBack. No fetch, no popover.
//
// The trigger's inner markup (type chip, event name, meta line) is passed in as
// children by AppShell so it stays exactly as it was.
//
// Popover pattern: disclosure (button with aria-expanded, plain list). Closes
// on outside mousedown/touchstart, on Escape (focus returns to the trigger),
// and when keyboard focus moves outside the switcher. Rows are real links, so
// Cmd/Ctrl-click and "open in new tab" still work.
//
// Event list: cached per session (module level, keyed by user id), shown
// immediately on open and refetched every time it opens. The current event's
// row always reads the live adminConfig, never the cached copy.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useId } from "react";
import { Icon } from "@/utils/iconMap.jsx";
import { EVENT_TYPE_ICON_KEYS } from "@/constants/events.js";
import { buildEventPath } from "@/utils/router.js";
import {
  fetchSwitcherEvents,
  formatEventDate,
  getMainEventStartDate,
  setPaletteHint,
} from "@/utils/userEvents.js";

// { userId, owned, shared } | null. Module level so it survives the shell
// remounting on every switch. Keyed by user id so one account never sees
// another's list.
let sessionCache = null;

function cachedFor(userId) {
  return sessionCache && sessionCache.userId === userId ? sessionCache : null;
}

export function EventSwitcher({
  eventId,
  userId,
  adminConfig,
  onSelectEvent,
  onBack,
  children,
}) {
  const [open,   setOpen]   = useState(false);
  const [lists,  setLists]  = useState(() => {
    const c = cachedFor(userId);
    return c ? { owned: c.owned, shared: c.shared } : null;
  });
  const [status, setStatus] = useState(() => (cachedFor(userId) ? "ready" : "idle"));

  const wrapRef    = useRef(null);
  const triggerRef = useRef(null);
  const popRef     = useRef(null);
  const popId      = useId();

  const isDropdown = typeof onSelectEvent === "function" && !!userId;

  // ── Fetch on open (cached rows show first, then refresh) ──────────────────
  useEffect(() => {
    if (!open || !isDropdown) return;
    let cancelled = false;

    const cached = cachedFor(userId);
    if (cached) {
      setLists({ owned: cached.owned, shared: cached.shared });
      setStatus("ready");
    } else {
      setStatus("loading");
    }

    fetchSwitcherEvents(userId)
      .then(res => {
        if (res.error) {
          if (!cancelled && !cachedFor(userId)) setStatus("error");
          return;
        }
        sessionCache = { userId, owned: res.owned, shared: res.shared };
        if (!cancelled) {
          setLists({ owned: res.owned, shared: res.shared });
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled && !cachedFor(userId)) setStatus("error");
      });

    return () => { cancelled = true; };
  }, [open, isDropdown, userId]);

  // ── Close on outside click, Escape, and focus leaving the switcher ────────
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onFocusIn = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };

    document.addEventListener("mousedown",  onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown",    onKeyDown);
    document.addEventListener("focusin",    onFocusIn);
    return () => {
      document.removeEventListener("mousedown",  onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown",    onKeyDown);
      document.removeEventListener("focusin",    onFocusIn);
    };
  }, [open]);

  // ── Static mode (demo): the original button ───────────────────────────────
  if (!isDropdown) {
    return (
      <div className="sidebar-switcher-wrap">
        <button
          type="button"
          className="sidebar-switcher"
          onClick={onBack}
          title="Back to Events"
        >
          {children}
          <span className="sidebar-switcher-chevron">
            <Icon name="chevronRight" context="inline" />
          </span>
        </button>
      </div>
    );
  }

  // ── Rows: swap in live data for the current event ─────────────────────────
  const live = (ev) => {
    if (ev.id !== eventId || !adminConfig) return ev;
    return {
      ...ev,
      name:         adminConfig.name || ev.name,
      type:         adminConfig.type || ev.type,
      admin_config: adminConfig,
    };
  };

  let ownedRows  = (lists?.owned  || []).map(live);
  const sharedRows = (lists?.shared || []).map(live);

  // Current event not in either list yet (still loading, or a failed fetch):
  // show it on its own so the popover is never missing the active event.
  const foundCurrent = ownedRows.some(e => e.id === eventId) || sharedRows.some(e => e.id === eventId);
  if (!foundCurrent && adminConfig) {
    ownedRows = [
      {
        id: eventId,
        name: adminConfig.name || "Untitled Event",
        type: adminConfig.type || "other",
        archived: false,
        admin_config: adminConfig,
      },
      ...ownedRows,
    ];
  }

  const showGroupLabels = sharedRows.length > 0;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleRowClick = (e, ev) => {
    // Let the browser handle modified and non-primary clicks (new tab, etc.)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    setOpen(false);
    if (ev.id === eventId) return;
    setPaletteHint(ev.id, ev.admin_config);
    onSelectEvent(ev.id);
  };

  const handleAll = () => {
    setOpen(false);
    onBack();
  };

  const focusables = () =>
    popRef.current
      ? Array.from(popRef.current.querySelectorAll("a.sidebar-switcher-item, button.sidebar-switcher-all"))
      : [];

  const handleTriggerKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
      } else {
        focusables()[0]?.focus();
      }
    }
  };

  const handlePopKeyDown = (e) => {
    const items = focusables();
    if (!items.length) return;
    const idx = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(idx + 1) % items.length].focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length].focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0].focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1].focus();
    }
  };

  const renderRow = (ev) => {
    const isCurrent = ev.id === eventId;
    const iconKey   = EVENT_TYPE_ICON_KEYS[ev.type] || "sparkles";
    const dateStr   = formatEventDate(getMainEventStartDate(ev.admin_config));
    const name      = ev.name || "Untitled Event";
    return (
      <li key={ev.id}>
        <a
          className={`sidebar-switcher-item${isCurrent ? " current" : ""}`}
          href={buildEventPath(ev.id)}
          aria-current={isCurrent ? "true" : undefined}
          onClick={(e) => handleRowClick(e, ev)}
        >
          <span className="sidebar-switcher-item-icon" aria-hidden="true">
            <Icon name={iconKey} context="inline" />
          </span>
          <span className="sidebar-switcher-item-text">
            <span className="sidebar-switcher-item-name" title={name}>{name}</span>
            {(dateStr || ev.archived) && (
              <span className="sidebar-switcher-item-meta">
                {dateStr}
                {ev.archived && <span className="sidebar-switcher-item-tag">Archived</span>}
              </span>
            )}
          </span>
          {isCurrent && (
            <span className="sidebar-switcher-item-check" aria-hidden="true">
              <Icon name="check" context="inline" />
            </span>
          )}
        </a>
      </li>
    );
  };

  return (
    <div className="sidebar-switcher-wrap" ref={wrapRef}>
      <button
        type="button"
        ref={triggerRef}
        className={`sidebar-switcher${open ? " open" : ""}`}
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        onClick={() => setOpen(o => !o)}
        onKeyDown={handleTriggerKeyDown}
        title="Switch event"
      >
        {children}
        <span className="sidebar-switcher-chevron">
          <Icon name="chevronDown" context="inline" />
        </span>
      </button>

      {open && (
        <div className="sidebar-switcher-pop" id={popId} ref={popRef} onKeyDown={handlePopKeyDown}>
          <div className="sidebar-switcher-scroll">
            {status === "loading" && ownedRows.length === 0 && (
              <div className="sidebar-switcher-note">Loading events...</div>
            )}
            {status === "error" && (
              <div className="sidebar-switcher-note">Could not refresh your events.</div>
            )}

            {ownedRows.length > 0 && (
              <>
                {showGroupLabels && <div className="sidebar-switcher-group">My Events</div>}
                <ul className="sidebar-switcher-list">{ownedRows.map(renderRow)}</ul>
              </>
            )}

            {sharedRows.length > 0 && (
              <>
                <div className="sidebar-switcher-group">Shared With Me</div>
                <ul className="sidebar-switcher-list">{sharedRows.map(renderRow)}</ul>
              </>
            )}
          </div>

          <button type="button" className="sidebar-switcher-all" onClick={handleAll}>
            <span>All events</span>
            <Icon name="chevronRight" context="inline" />
          </button>
        </div>
      )}
    </div>
  );
}
