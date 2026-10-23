// Moved verbatim from AppShell.jsx (V4.47.0 module split) — no behavior changes.
import { supabase } from "@/lib/supabase.js";
import { Icon } from "@/utils/iconMap.jsx";

export function MoreDrawer({ activeTab, collaboratorRole, darkMode, isCoordinator, moreDrawerTabs, navigateTo, onBack, openAdmin, setDarkMode, setShowActivityLog, setShowDayOf, setShowGuide, setShowInviteModal, setShowMoreDrawer, setShowWhatsNew, showMoreDrawer }) {
  return (
    <>
      {/* ── More drawer backdrop ── */}
      {showMoreDrawer && (
        <div className="more-drawer-backdrop" onClick={() => setShowMoreDrawer(false)} />
      )}

      {/* ── More drawer ── */}
      <div className={`more-drawer ${showMoreDrawer ? "open" : ""}`}>
        <div className="more-drawer-header">
          <span className="more-drawer-title">More</span>
          <button className="more-drawer-close" onClick={() => setShowMoreDrawer(false)}><Icon name="x" context="button" /></button>
        </div>
        <div className="more-drawer-body">
        {moreDrawerTabs.map(tab => (
          <button key={tab.id}
            className={`more-drawer-item ${activeTab === tab.id ? "active" : ""}`}
            aria-current={activeTab === tab.id ? "page" : undefined}
            onClick={() => navigateTo(tab.id)}
          >
            <span className="more-drawer-item-icon"><Icon name={tab.icon} context="menu" /></span>
            <span className="more-drawer-item-label">{tab.label}</span>
            {tab.badge != null && tab.badge > 0 && (
              <>
                <span className="more-drawer-item-badge" aria-hidden="true" title={tab.badgeLabel}>{tab.badge}</span>
                <span className="sr-only">{tab.badgeLabel}</span>
              </>
            )}
            <span className="more-drawer-item-chevron"><Icon name="chevronRight" context="inline" /></span>
          </button>
        ))}

        {/* Day-of Mode in More drawer for mobile */}
        {!isCoordinator && (
          <button
            className="more-drawer-item"
            onClick={() => { setShowMoreDrawer(false); setShowDayOf(true); }}
          >
            <span className="more-drawer-item-icon"><Icon name="clipboardList" context="menu" /></span>
            <span className="more-drawer-item-label">Day-of Mode</span>
            <span className="more-drawer-item-chevron"><Icon name="chevronRight" context="inline" /></span>
          </button>
        )}

        {/* Theme switcher in More drawer for mobile */}
        <div style={{ padding: "10px 18px 4px", display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid var(--border)" }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)" }}>Theme</span>
          <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
            {[
              { mode: "light",  icon: "sun",     title: "Light"  },
              { mode: "dark",   icon: "moon",    title: "Dark"   },
              { mode: "system", icon: "monitor", title: "System" },
            ].map(({ mode, icon, title }) => (
              <button key={mode} title={title} aria-label={title}
                onClick={() => setDarkMode(mode)}
                style={{
                  width: 30, height: 30, border: "none", borderRadius: 4,
                  cursor: "pointer", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s ease",
                  background: darkMode === mode ? "var(--accent-light)" : "var(--bg-subtle)",
                  color:      darkMode === mode ? "var(--accent-primary)" : "var(--text-muted)",
                }}
              ><Icon name={icon} context="inline" /></button>
            ))}
          </div>
        </div>

        {/* Mobile utility links */}
        <button className="more-drawer-item"
          onClick={() => { setShowMoreDrawer(false); setShowGuide(true); }}>
          <span className="more-drawer-item-icon"><Icon name="bookOpen" context="menu" /></span>
          <span className="more-drawer-item-label">Guide</span>
          <span className="more-drawer-item-chevron"><Icon name="chevronRight" context="inline" /></span>
        </button>
        <button className="more-drawer-item"
          onClick={() => { setShowMoreDrawer(false); setShowWhatsNew(true); }}>
          <span className="more-drawer-item-icon"><Icon name="sparkles" context="menu" /></span>
          <span className="more-drawer-item-label">What's New</span>
          <span className="more-drawer-item-chevron"><Icon name="chevronRight" context="inline" /></span>
        </button>
        {!isCoordinator && (
          <button className="more-drawer-item"
            onClick={() => { setShowMoreDrawer(false); setShowActivityLog(true); }}>
            <span className="more-drawer-item-icon"><Icon name="barChart3" context="menu" /></span>
            <span className="more-drawer-item-label">Activity Log</span>
            <span className="more-drawer-item-chevron"><Icon name="chevronRight" context="inline" /></span>
          </button>
        )}
        {/* Invite a co-planner (mobile, owners and editors) */}
        {(collaboratorRole === "owner" || collaboratorRole === "editor") && (
          <button className="more-drawer-item"
            onClick={() => { setShowMoreDrawer(false); setShowInviteModal(true); }}>
            <span className="more-drawer-item-icon"><Icon name="userPlus" context="menu" /></span>
            <span className="more-drawer-item-label">Invite a co-planner</span>
            <span className="more-drawer-item-chevron"><Icon name="chevronRight" context="inline" /></span>
          </button>
        )}
        <button className="more-drawer-item"
          onClick={() => { setShowMoreDrawer(false); openAdmin("event"); }}>
          <span className="more-drawer-item-icon"><Icon name="settings" context="menu" /></span>
          <span className="more-drawer-item-label">Admin Mode</span>
          <span className="more-drawer-item-chevron"><Icon name="chevronRight" context="inline" /></span>
        </button>
        <button className="more-drawer-item"
          onClick={() => { setShowMoreDrawer(false); onBack(); }}>
          <span className="more-drawer-item-icon"><Icon name="arrowLeft" context="menu" /></span>
          <span className="more-drawer-item-label">Back to Events</span>
          <span className="more-drawer-item-chevron"><Icon name="chevronRight" context="inline" /></span>
        </button>
        <button className="more-drawer-item"
          onClick={() => { setShowMoreDrawer(false); supabase.auth.signOut(); }}>
          <span className="more-drawer-item-icon"><Icon name="logOut" context="menu" /></span>
          <span className="more-drawer-item-label">Sign out</span>
          <span className="more-drawer-item-chevron"><Icon name="chevronRight" context="inline" /></span>
        </button>
        </div>
      </div>
    </>
  );
}
