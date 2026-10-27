import { useState, useEffect } from "react";
import { Icon } from "@/utils/iconMap.jsx";
import { TAB_LABELS, TAB_PRIMARY_ACTIONS } from "@/components/shell/shellConfig.js";
import { PRIMARY_ACTION_STATE_EVENT } from "@/hooks/usePrimaryAction.js";

export function TopBar({ onHelp = null, activeTab, isArchived, isViewer, setShowNotifPanel, setShowSearch, syncDisplay, topbarSubtitle, unreadCount }) {
  const primaryAction = TAB_PRIMARY_ACTIONS[activeTab];
  // The active tab can report its action is unavailable (e.g. Seating not enabled yet)
  const [tabBlocked, setTabBlocked] = useState(false);
  useEffect(() => {
    const handler = (e) => setTabBlocked(!!e.detail?.blocked);
    window.addEventListener(PRIMARY_ACTION_STATE_EVENT, handler);
    return () => window.removeEventListener(PRIMARY_ACTION_STATE_EVENT, handler);
  }, []);
  const primaryDisabled = !!primaryAction && primaryAction.requiresEdit && (isArchived || isViewer || tabBlocked);
  return (
    <div className="app-topbar">
      <div className="topbar-inner">
        <div>
          <h1 className="topbar-title">{TAB_LABELS[activeTab] || "SimchaKit"}</h1>
          {topbarSubtitle && (
            <div className="topbar-sub">{topbarSubtitle}</div>
          )}
        </div>
        <div className="topbar-spacer" />
        <div className="topbar-actions">
          {/* Sync indicator */}
          <span className={`topbar-sync${syncDisplay.topbarClass ? " " + syncDisplay.topbarClass : ""}`}>
            <span className={`sync-dot ${syncDisplay.dotClass}`} />
            {syncDisplay.label}
          </span>

          {/* Search */}
          <button className="icon-btn" title="Search (⌘K)" aria-label="Search (⌘K)" onClick={() => setShowSearch(true)}>
            <Icon name="search" context="button" />
          </button>

          {/* Help for this tab (opens the Guide at this tab's section) */}
          {onHelp && (
            <button className="icon-btn gd-help" title="Help for this tab" aria-label="Help for this tab" onClick={onHelp}>
              <Icon name="helpCircle" context="button" />
            </button>
          )}

          {/* Notification bell */}
          <button
            className="icon-btn notif-bell-btn"
            title="Notifications" aria-label="Notifications"
            onClick={() => setShowNotifPanel(s => !s)}
          >
            <Icon name="bell" context="button" />
            {unreadCount > 0 && (
              <span className="notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
            )}
          </button>

          {/* Per-tab primary action (Overview: Print Brief) */}
          {primaryAction && (
            <button
              className="topbar-print-btn"
              disabled={primaryDisabled}
              onClick={() => window.dispatchEvent(new CustomEvent(primaryAction.event))}
            >
              <Icon name={primaryAction.icon} context="inline" /> {primaryAction.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
