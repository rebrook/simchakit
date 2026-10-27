// Moved verbatim from AppShell.jsx (V4.47.0 module split) — no behavior changes.
import { supabase } from "@/lib/supabase.js";
import { EventLogoControl } from "@/components/shared/EventLogoControl.jsx";
import { Icon } from "@/utils/iconMap.jsx";
import { EventSwitcher } from "@/components/shell/EventSwitcher.jsx";
import { avatarColor, avatarInitials } from "@/utils/avatar.js";

export function Sidebar({ activeTab, adminConfig, coPlanners, collaboratorRole, darkMode, event, eventId, eventTypeIconKey, isCoordinator, isDemoMode, navigateTo, onBack, onLogoSaved, onSelectEvent, onlineUserIds, openAdmin, session, setDarkMode, setShowAccountMenu, setShowActivityLog, setShowDayOf, setShowGuide, setShowInviteModal, setShowWhatsNew, whatsNewCount = 0, showAccountMenu, sidebarGroups, switcherDate, userBg, userInit, userName }) {
  return (
    <aside className="app-sidebar">

      {/* Brand */}
      <div className="sidebar-brand">
        <img src="/apple-touch-icon.png" alt="SimchaKit" style={{ width: 34, height: 34, borderRadius: 9 }} />
        <span className="sidebar-wordmark">SimchaKit</span>
      </div>

      {/* Event logo (optional) -- renders nothing if absent and viewer can't edit */}
      <EventLogoControl
        eventId={eventId}
        adminConfig={adminConfig}
        collaboratorRole={collaboratorRole}
        isArchived={!!(event?.archived)}
        onLogoSaved={onLogoSaved}
      />

      {/* Event switcher (desktop sidebar). Demo mode passes no onSelectEvent,
          so the switcher stays a plain back-to-events button there. */}
      <EventSwitcher
        eventId={eventId}
        userId={session?.user?.id ?? null}
        adminConfig={adminConfig}
        onSelectEvent={isDemoMode ? null : onSelectEvent}
        onBack={onBack}
      >
        <span className="sidebar-switcher-emoji"><Icon name={eventTypeIconKey} context="chip" /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="sidebar-switcher-name">{adminConfig?.name || "Untitled Event"}</div>
          <div className="sidebar-switcher-meta">
            {adminConfig?.theme?.name && (
              <>{adminConfig.theme.icon ? `${adminConfig.theme.icon} ${adminConfig.theme.name}` : adminConfig.theme.name}</>
            )}
            {adminConfig?.theme?.name && switcherDate && " · "}
            {switcherDate}
          </div>
        </div>
      </EventSwitcher>

      {/* Nav items */}
      <nav className="sidebar-nav">
        {sidebarGroups.map(group => (
          <div key={group.label}>
            <div className="sidebar-group-label">{group.label}</div>
            {group.tabs.map(tab => (
              <button
                key={tab.id}
                className={`sidebar-item${activeTab === tab.id ? " active" : ""}`}
                aria-current={activeTab === tab.id ? "page" : undefined}
                onClick={() => navigateTo(tab.id)}
              >
                <Icon name={tab.icon} context="nav" />
                <span className="sidebar-item-label">{tab.label}</span>
                {tab.badge != null && tab.badge > 0 && (
                  <>
                    <span className="sidebar-item-badge" aria-hidden="true" title={tab.badgeLabel}>{tab.badge}</span>
                    <span className="sr-only">{tab.badgeLabel}</span>
                  </>
                )}
              </button>
            ))}
          </div>
        ))}

        {/* Day-of Mode — standalone emphasized entry */}
        {!isCoordinator && (
          <button className="sidebar-dayof" onClick={() => setShowDayOf(true)}>
            <Icon name="clipboardList" context="nav" />
            <span className="sidebar-item-label">Day-of Mode</span>
            <span className="sidebar-dayof-tag">Event day</span>
          </button>
        )}
      </nav>

      {/* Footer (pushed to bottom) */}
      <div className="sidebar-footer">

        {/* Co-planner row: avatars + gear */}
        {coPlanners !== null && (() => {
          // Filter self out of the display list
          const others = coPlanners.filter(c => c.user_id !== session?.user?.id);
          return (
            <div className="sidebar-team">
              {others.length > 0 ? (
                <button type="button" className="sidebar-avatars" onClick={() => openAdmin("collaborators")} aria-label={`View ${others.length} co-planner${others.length !== 1 ? "s" : ""}`}>
                  {others.slice(0, 3).map((c, i) => (
                    <div
                      key={c.user_id || c.id || i}
                      className="sidebar-avatar"
                      style={{ background: avatarColor(c.display_name || c.email || ""), zIndex: 3 - i }}
                      aria-hidden="true"
                    >
                      {avatarInitials(c.display_name, c.email)}
                      {onlineUserIds.has(c.user_id) && (
                        <span className="sidebar-avatar-online" aria-label="Online" />
                      )}
                    </div>
                  ))}
                  {others.length > 3 && (
                    <div className="sidebar-avatar sidebar-avatar-more" aria-hidden="true">+{others.length - 3}</div>
                  )}
                </button>
              ) : null}
              {collaboratorRole === "owner" && (
                <button
                  className="sidebar-gear"
                  onClick={() => openAdmin("event")}
                  title="Event settings"
                  aria-label="Event settings"
                >
                  <Icon name="settings" context="inline" />
                </button>
              )}
            </div>
          );
        })()}

        {/* Solo-event prompt OR standard invite button (never both) */}
        {(() => {
          const isInviter = collaboratorRole === "owner" || collaboratorRole === "editor";
          if (!isInviter) return null;
          const isSoloOwner = collaboratorRole === "owner"
            && coPlanners !== null
            && coPlanners.filter(c => c.user_id !== session?.user?.id).length === 0;
          if (isSoloOwner) {
            return (
              <button className="sidebar-solo-invite" onClick={() => setShowInviteModal(true)}>
                <Icon name="userPlus" context="inline" />
                <span>Planning with someone? Invite a co-planner.</span>
              </button>
            );
          }
          return (
            <button className="sidebar-invite" onClick={() => setShowInviteModal(true)}>
              <Icon name="userPlus" context="inline" /> Invite a co-planner
            </button>
          );
        })()}

        {/* Collaborator role badge (editors, viewers, coordinators) */}
        {collaboratorRole && collaboratorRole !== "owner" && (
          <div className="sidebar-role-badge">
            {collaboratorRole === "editor"      ? <><Icon name="pencil" context="badge" /> Editor</>
             : collaboratorRole === "coordinator" ? <><Icon name="ceremony" context="badge" /> Coordinator</>
             : <><Icon name="eye" context="badge" /> Viewer</>}
          </div>
        )}

        {/* Account row */}
        <button type="button" className="sidebar-account" onClick={() => setShowAccountMenu(s => !s)} aria-label="Account menu">
          <div className="sidebar-account-avatar" style={{ background: userBg }} aria-hidden="true">{userInit}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="sidebar-account-name">{userName}</div>
            <div className="sidebar-account-hint">Account, theme, sign out</div>
          </div>
          <span className="sidebar-account-chevron">
            <Icon name={showAccountMenu ? "chevronDown" : "chevronRight"} context="inline" />
          </span>
        </button>

        {/* Account menu popover */}
        {showAccountMenu && (
          <div className="sidebar-account-menu">
            {/* Theme switcher */}
            <div className="sidebar-account-theme">
              <span className="sidebar-account-theme-label">Theme</span>
              <div className="sidebar-account-theme-btns">
                {[
                  { mode: "light",  icon: "sun",     title: "Light"  },
                  { mode: "dark",   icon: "moon",    title: "Dark"   },
                  { mode: "system", icon: "monitor", title: "System" },
                ].map(({ mode, icon, title }) => (
                  <button key={mode} title={title} aria-label={title}
                    onClick={() => setDarkMode(mode)}
                    className={`sidebar-account-theme-btn${darkMode === mode ? " active" : ""}`}
                  >
                    <Icon name={icon} context="inline" />
                  </button>
                ))}
              </div>
            </div>

            <button className="sidebar-account-item"
              onClick={() => { setShowAccountMenu(false); setShowGuide(true); }}>
              <Icon name="bookOpen" context="menu" /> Guide
            </button>

            <button className="sidebar-account-item"
              aria-label={whatsNewCount > 0 ? `What's New, ${whatsNewCount} new` : undefined}
              onClick={() => { setShowAccountMenu(false); setShowWhatsNew(true); }}>
              <Icon name="sparkles" context="menu" /> What's New
              {whatsNewCount > 0 && <span className="wn-count">{whatsNewCount} new</span>}
            </button>

            {!isCoordinator && (
              <button className="sidebar-account-item"
                onClick={() => { setShowAccountMenu(false); setShowActivityLog(true); }}>
                <Icon name="barChart3" context="menu" /> Activity Log
              </button>
            )}

            <button className="sidebar-account-item"
              onClick={() => { setShowAccountMenu(false); onBack(); }}>
              <Icon name="arrowLeft" context="menu" /> Back to Events
            </button>

            <button className="sidebar-account-item"
              onClick={() => { setShowAccountMenu(false); supabase.auth.signOut(); }}>
              <Icon name="logOut" context="menu" /> Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
