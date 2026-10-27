// Moved verbatim from AppShell.jsx (V4.47.0 module split) — no behavior changes.
import { Icon } from "@/utils/iconMap.jsx";

export function MobileHeader({ onHelp = null, adminConfig, eventTypeIconKey, onBack, onlineUsers, setShowNotifPanel, setShowSearch, unreadCount }) {
  return (
    <header className="mobile-header">
      <div className="mobile-header-inner">
        {/* Row 1: back · spacer · presence · bell + search */}
        <div className="mobile-header-row1">
          <button className="mobile-header-back" onClick={onBack}>
            <Icon name="arrowLeft" context="inline" style={{ marginRight: 2 }} /> Events
          </button>
          <div style={{ flex: 1 }} />
          {onlineUsers.length > 0 && (
            <div className="mobile-presence-badge">
              <span className="mobile-presence-dot" />
              {onlineUsers.length}
            </div>
          )}
          <div className="mobile-header-actions">
            {onHelp && (
              <button className="icon-btn gd-help" data-wn-focus="guide-help" title="Help for this tab" aria-label="Help for this tab" onClick={onHelp}>
                <Icon name="helpCircle" context="button" />
              </button>
            )}
            <button className="icon-btn notif-bell-btn" title="Notifications" aria-label="Notifications" onClick={() => setShowNotifPanel(s => !s)}>
              <Icon name="bell" context="button" />
              {unreadCount > 0 && (
                <span className="notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
              )}
            </button>
            <button className="icon-btn" title="Search" aria-label="Search" onClick={() => setShowSearch(true)}>
              <Icon name="search" context="button" />
            </button>
          </div>
        </div>
        {/* Row 2: event-type chip + event name + theme line */}
        <div className="mobile-header-row2">
          <span className="mobile-identity-chip"><Icon name={eventTypeIconKey} context="chip" /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="mobile-identity-name" title={adminConfig?.name || ""}>{adminConfig?.name || "Untitled Event"}</div>
            {adminConfig?.theme?.name && (
              <div className="mobile-identity-theme">
                {adminConfig.theme.icon ? `${adminConfig.theme.icon} ${adminConfig.theme.name}` : adminConfig.theme.name}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
