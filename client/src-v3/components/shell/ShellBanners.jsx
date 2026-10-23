// Moved verbatim from AppShell.jsx (V4.47.0 module split) — no behavior changes.
import { Icon } from "@/utils/iconMap.jsx";

export function ShellBanners({ isDemoMode, event }) {
  return (
    <>
    {/* ── Demo banner (spans full width above the grid) ── */}
    {isDemoMode && (
      <div className="archived-banner shell-banner" style={{
        background: "var(--accent-primary)",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        flexWrap: "wrap",
      }}>
        <span><Icon name="clipboardList" context="inline" style={{ marginRight: 6 }} />You are viewing the SimchaKit demo. Data resets nightly.</span>
        <a href="https://app.simcha-kit.com" style={{
          color: "white",
          fontWeight: 700,
          textDecoration: "underline",
          whiteSpace: "nowrap",
        }}>Create your account</a>
      </div>
    )}

    {/* ── Archived banner ── */}
    {event?.archived && (
      <div className="archived-banner shell-banner">
        <Icon name="lock" context="inline" style={{ marginRight: 6 }} /> This event is archived and read-only.
      </div>
    )}
    </>
  );
}

export function DayOfReminderBanner({ showDayOfBanner, setShowDayOf, daysToEvent, dismissDayOfBanner }) {
  return (
    <>
    {/* ── Day-of reminder banner (mobile only, <=900px, within 7 days) ── */}
    {showDayOfBanner && (
      <div className="dayof-reminder-banner">
        <button className="dayof-reminder-tap" onClick={() => setShowDayOf(true)}>
          <Icon name="clipboardList" context="inline" />
          <span>
            {daysToEvent === 0
              ? "It's today. Open Day-of Mode"
              : "The big day is close. Open Day-of Mode"}
          </span>
        </button>
        {daysToEvent > 0 && (
          <button className="icon-btn dayof-reminder-dismiss" title="Dismiss" aria-label="Dismiss Day-of Mode reminder" onClick={dismissDayOfBanner}>
            <Icon name="x" context="button" />
          </button>
        )}
      </div>
    )}
    </>
  );
}
