// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.11.0 — NotificationPanel.jsx
// Popover panel anchored to the notification bell. Shows recent audit_log
// entries with unread styling, actor attribution, tab deep-links, and
// "Mark all read" / "See all activity" actions.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";
import { Icon }              from "@/utils/iconMap.jsx";
import { ACTION_COLORS }     from "@/constants/ui.js";
import { avatarColor, avatarInitials } from "@/utils/avatar.js";

// ── Relative time formatter ──────────────────────────────────────────────────
function relativeTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Component ────────────────────────────────────────────────────────────────
export function NotificationPanel({
  entries,
  loading,
  unreadCount,
  onMarkAllRead,
  onSeeAllActivity,
  onNavigateToTab,
  onClose,
}) {
  const panelRef = useRef(null);

  // Close on outside click (document-level, excludes panel and bell button)
  useEffect(() => {
    const handler = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        !e.target.closest(".notif-bell-btn")
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      {/* Visual-only scrim (mobile gets tinted backdrop, desktop transparent) */}
      <div className="notif-backdrop" />
      <div className="notif-panel" ref={panelRef}>
      {/* Header */}
      <div className="notif-panel-header">
        <span className="notif-panel-title">Notifications</span>
        {unreadCount > 0 && (
          <button className="notif-mark-read-btn" onClick={onMarkAllRead}>
            <Icon name="check" context="inline" /> Mark all read
          </button>
        )}
      </div>

      {/* Body */}
      <div className="notif-panel-body">
        {loading ? (
          <div className="notif-empty">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="notif-empty">
            <div style={{ marginBottom: 4 }}><Icon name="bellRing" context="button" /></div>
            No activity yet
          </div>
        ) : (
          entries.map(entry => {
            const ac = ACTION_COLORS[entry.action] || ACTION_COLORS["Updated"];
            const actorDisplay = entry.actorName || "Someone";
            const canNavigate = !!entry.tab;
            return (
              <button
                key={entry.id}
                className={`notif-entry${entry.isUnread ? " unread" : ""}${canNavigate ? " navigable" : ""}`}
                onClick={() => {
                  if (canNavigate) onNavigateToTab(entry.tab);
                }}
                disabled={!canNavigate}
                title={canNavigate ? `Go to ${entry.tab.charAt(0).toUpperCase() + entry.tab.slice(1)}` : undefined}
              >
                {/* Actor avatar */}
                <div
                  className="notif-avatar"
                  style={{ background: avatarColor(actorDisplay) }}
                  aria-hidden="true"
                >
                  {avatarInitials(actorDisplay)}
                </div>

                {/* Content */}
                <div className="notif-content">
                  <div className="notif-detail">
                    <span className="notif-actor">{actorDisplay}</span>
                    {" "}
                    <span className="notif-action-badge" style={{ background: ac.bg, color: ac.color }}>
                      {entry.action}
                    </span>
                  </div>
                  <div className="notif-text">{entry.detail}</div>
                  <div className="notif-time">{relativeTime(entry.createdAt)}</div>
                </div>

                {/* Unread dot */}
                {entry.isUnread && <span className="notif-unread-dot" />}
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="notif-panel-footer">
        <button className="notif-see-all" onClick={onSeeAllActivity}>
          <Icon name="clipboardList" context="inline" /> See all activity
        </button>
      </div>
      </div>
    </>
  );
}
