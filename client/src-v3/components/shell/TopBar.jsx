// Moved verbatim from AppShell.jsx (V4.47.0 module split) — no behavior changes.
import { Icon } from "@/utils/iconMap.jsx";
import { TAB_LABELS } from "@/components/shell/shellConfig.js";

export function TopBar({ activeTab, setShowNotifPanel, setShowSearch, syncDisplay, topbarSubtitle, unreadCount }) {
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

          {/* Print Brief — Overview tab only */}
          {activeTab === "overview" && (
            <button
              className="topbar-print-btn"
              onClick={() => window.dispatchEvent(new CustomEvent("simchakit:print-brief"))}
            >
              <Icon name="printer" context="inline" /> Print Brief
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
