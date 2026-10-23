// Moved verbatim from AppShell.jsx (V4.47.0 module split) — no behavior changes.
import { Icon } from "@/utils/iconMap.jsx";

export function BottomNav({ activeTab, bottomBarTabs, moreDrawerTabs, moreIsActive, navigateTo, setShowMoreDrawer, showMoreDrawer }) {
  return (
    <div className="bottom-nav">
      {bottomBarTabs.map(tab => (
        <button key={tab.id}
          className={`bottom-nav-tab ${activeTab === tab.id ? "active" : ""}`}
          aria-current={activeTab === tab.id ? "page" : undefined}
          onClick={() => navigateTo(tab.id)}
        >
          <span className="bottom-nav-icon"><Icon name={tab.icon} context="navMobile" /></span>
          <span className="bottom-nav-label">{tab.label}</span>
          {tab.badge != null && tab.badge > 0 && (
            <>
              <span className="bottom-nav-badge" aria-hidden="true" title={tab.badgeLabel}>{tab.badge}</span>
              <span className="sr-only">{tab.badgeLabel}</span>
            </>
          )}
        </button>
      ))}
      <button
        className={`bottom-nav-tab ${moreIsActive || showMoreDrawer ? "active" : ""}`}
        onClick={() => setShowMoreDrawer(s => !s)}
      >
        <span className="bottom-nav-icon"><Icon name="moreHorizontal" context="navMobile" /></span>
        <span className="bottom-nav-label">More</span>
        {moreDrawerTabs.some(t => t.badge) && (
          <>
            <span className="bottom-nav-more-dot" aria-hidden="true" />
            <span className="sr-only">Something in More needs attention</span>
          </>
        )}
      </button>
    </div>
  );
}
