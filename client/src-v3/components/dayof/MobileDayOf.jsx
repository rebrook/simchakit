// Moved verbatim from DayOfOverlay.jsx (V4.46.0 module split) — no behavior changes.
import { useState, useEffect, useRef, useMemo } from "react";
import { formatTimeRange } from "@/utils/dates.js";
import { Icon } from "@/utils/iconMap.jsx";
import { InfoPopover } from "@/components/shared/InfoPopover.jsx";
import { METRIC_HELP } from "@/constants/metrics.js";
import { formatClock, entryTimestamps, groupTimelineByDate } from "@/utils/dayofTime.js";

// ── Mobile Day-of View ────────────────────────────────────────────────────────
export function MobileDayOf({ timeline, adminConfig, confirmedVendors, ceremonyRoles, confirmedPeople, dietaryPeople, kosherCount, totalConfirmed, totalInvited, eventName, eventDate, coPlanners, onClose }) {
  // True once a sub-event is flagged Meal served; picks the popover wording.
  const mealPrecise = (adminConfig?.timeline || timeline || []).some(e => e.servesMeal);
  const [clock, setClock] = useState(formatClock);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const nowRef = useRef(null);
  const bodyRef = useRef(null);

  // Main event date as fallback for entries without their own startDate
  const mainEventDate = useMemo(() => {
    const main = timeline.find(e => e.isMainEvent);
    return main?.startDate || timeline[0]?.startDate || null;
  }, [timeline]);

  // Clock + now-detection interval (every 30s)
  useEffect(() => {
    const tick = () => {
      setClock(formatClock());
      setNowMs(Date.now());
    };
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  // Scroll to "now" entry after timeline renders
  useEffect(() => {
    if (!nowRef.current || !bodyRef.current) return;
    requestAnimationFrame(() => {
      if (nowRef.current && bodyRef.current) {
        bodyRef.current.scrollTop = nowRef.current.offsetTop - 80;
      }
    });
  }, [timeline]);

  // Determine now/next from timeline (date-aware, device-local TZ)
  const { nowEntry, nextEntry, progress, allPast } = useMemo(() => {
    let now = null, next = null, prog = 0;
    let hasFuture = false;

    for (const entry of timeline) {
      const { startMs, endMs } = entryTimestamps(entry, mainEventDate);
      if (startMs === null || endMs === null) continue;

      if (nowMs >= startMs && nowMs < endMs) {
        now = entry;
        const raw = ((nowMs - startMs) / (endMs - startMs)) * 100;
        prog = Math.round(Math.max(0, Math.min(100, raw)));
      }
      if (startMs > nowMs) hasFuture = true;
    }

    // nextEntry = entry with minimum startMs where startMs > nowMs
    if (!now || hasFuture) {
      let minStart = Infinity;
      for (const entry of timeline) {
        const { startMs } = entryTimestamps(entry, mainEventDate);
        if (startMs !== null && startMs > nowMs && startMs < minStart) {
          minStart = startMs;
          next = entry;
        }
      }
    }

    const allPast = !now && !next;
    return { nowEntry: now, nextEntry: next, progress: prog, allPast };
  }, [timeline, nowMs, mainEventDate]);

  // Clergy from adminConfig
  const clergyContacts = useMemo(() => {
    const cfg = adminConfig || {};
    const contacts = [];
    if (cfg.clergyName)     contacts.push({ name: cfg.clergyName,     role: cfg.clergyTitle || "Clergy",     phone: cfg.clergyPhone,     email: cfg.clergyEmail });
    if (cfg.clergy2Name)    contacts.push({ name: cfg.clergy2Name,    role: cfg.clergy2Title || "Clergy",    phone: cfg.clergy2Phone,    email: cfg.clergy2Email });
    if (cfg.tutorName)      contacts.push({ name: cfg.tutorName,      role: cfg.tutorTitle || "Tutor",       phone: cfg.tutorPhone,      email: cfg.tutorEmail });
    if (cfg.coordinatorName) contacts.push({ name: cfg.coordinatorName, role: "Day-of coordinator", phone: cfg.coordinatorPhone, email: cfg.coordinatorEmail });
    return contacts;
  }, [adminConfig]);

  // Notify CTA: mailto to co-planners (excluding current user, but we don't have userId here so include all)
  const notifyHref = useMemo(() => {
    const emails = (coPlanners || []).filter(c => c.email && c.role !== "owner").map(c => c.email);
    // Also include the owner for notification
    const ownerEmail = (coPlanners || []).find(c => c.role === "owner")?.email;
    const allEmails = ownerEmail ? [ownerEmail, ...emails] : emails;
    if (allEmails.length === 0) return null;

    const name = eventName || "the event";
    const subject = encodeURIComponent(`Running late - ${name}`);
    const body = encodeURIComponent(`Hi team,\n\nI'm running a few minutes late to ${name}. Will update when I'm close.\n\nSent from SimchaKit`);
    return `mailto:${allEmails.join(",")}?subject=${subject}&body=${body}`;
  }, [coPlanners, eventName]);

  // Ceremony roles: show section matching current "now" entry, or all sections if no match
  const ceremonyDisplay = useMemo(() => {
    if (!ceremonyRoles || ceremonyRoles.length === 0) return null;
    const sorted = [...ceremonyRoles].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const allSections = [...new Set(sorted.map(r => r.section).filter(Boolean))];

    // Try to match now entry title to a ceremony section
    if (nowEntry) {
      const nowTitle = nowEntry.title?.toLowerCase() || "";
      const matchedSection = allSections.find(s => nowTitle.includes(s.toLowerCase()) || s.toLowerCase().includes(nowTitle));
      if (matchedSection) {
        return { sections: [matchedSection], roles: sorted };
      }
    }

    // No match: show all sections
    return { sections: allSections, roles: sorted };
  }, [ceremonyRoles, nowEntry]);

  const nextTimeStr = nextEntry ? formatTimeRange(nextEntry.startTime, nextEntry.endTime)?.split("–")[0]?.trim() || "" : "";

  return (
    <div className="dayof-m-root">
      {/* ── Sticky header ── */}
      <div className="dayof-m-header">
        <div className="dayof-m-header-row">
          <div className="dayof-m-mode">
            <Icon name="clipboardList" context="badge" style={{ marginRight: 4 }} />
            Day-of mode
          </div>
          <button className="dayof-m-exit" onClick={onClose}>Exit</button>
        </div>
        <div className="dayof-m-header-row" style={{ marginTop: 6 }}>
          <div className="dayof-m-event-name">{eventName}</div>
          <div className="dayof-m-clock">{clock}</div>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="dayof-m-body" ref={bodyRef}>

        {/* ── Now card ── */}
        {nowEntry ? (
          <div className="dayof-m-now">
            <div className="dayof-m-now-tag">
              <Icon name="clock" context="badge" style={{ marginRight: 4 }} />
              Happening now
            </div>
            <div className="dayof-m-now-title">{nowEntry.title}</div>
            <div className="dayof-m-now-meta">
              <Icon name="mapPin" context="badge" style={{ marginRight: 4 }} />
              {[nowEntry.venue, formatTimeRange(nowEntry.startTime, nowEntry.endTime)].filter(Boolean).join(" · ")}
            </div>
            <div className="dayof-m-progress">
              <div className="dayof-m-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            {nextEntry && (
              <div className="dayof-m-now-next">
                Next: {nextEntry.title}{nextTimeStr ? ` at ${nextTimeStr}` : ""}
              </div>
            )}
          </div>
        ) : nextEntry ? (
          <div className="dayof-m-now" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <div className="dayof-m-now-tag" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
              <Icon name="clock" context="badge" style={{ marginRight: 4 }} />
              Coming up next
            </div>
            <div className="dayof-m-now-title" style={{ color: "var(--text-primary)" }}>{nextEntry.title}</div>
            <div className="dayof-m-now-meta" style={{ color: "var(--text-secondary)" }}>
              <Icon name="mapPin" context="badge" style={{ marginRight: 4 }} />
              {[nextEntry.venue, formatTimeRange(nextEntry.startTime, nextEntry.endTime)].filter(Boolean).join(" · ")}
            </div>
          </div>
        ) : allPast && timeline.length > 0 ? (
          <div className="dayof-m-now" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <div className="dayof-m-now-tag" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
              <Icon name="check" context="badge" style={{ marginRight: 4 }} />
              Complete
            </div>
            <div className="dayof-m-now-title" style={{ color: "var(--text-primary)" }}>Mazal tov!</div>
            <div className="dayof-m-now-meta" style={{ color: "var(--text-secondary)" }}>
              All events have wrapped up.
            </div>
          </div>
        ) : null}

        {/* ── Run of show ── */}
        <div className="dayof-m-card">
          <div className="dayof-m-card-label">
            <Icon name="calendar" context="badge" style={{ marginRight: 5 }} />
            Run of show
          </div>
          {timeline.length === 0 ? (
            <div className="dayof-m-empty">No timeline entries configured.</div>
          ) : (() => {
            const dayGroups = groupTimelineByDate(timeline, mainEventDate, nowMs);
            if (!dayGroups) {
              // Single-day: flat render (unchanged)
              return timeline.map((entry, i) => {
                const { startMs, endMs } = entryTimestamps(entry, mainEventDate);
                const isNow  = startMs !== null && endMs !== null && nowMs >= startMs && nowMs < endMs;
                const isPast = endMs !== null && nowMs >= endMs;
                const timeStr = entry.startTime ? entry.startTime.replace(/^0/, "") : "";
                return (
                  <div
                    key={entry.id || i}
                    ref={isNow ? nowRef : null}
                    className={`dayof-m-run-row ${isNow ? "now" : ""} ${isPast ? "past" : ""}`}
                  >
                    <div className="dayof-m-run-time" style={isNow ? { color: "var(--accent-primary)", fontWeight: 700 } : undefined}>
                      {timeStr}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className={`dayof-m-run-title ${isNow ? "now" : ""}`}>{entry.title}</div>
                      {entry.venue && (
                        <div className="dayof-m-run-venue">{entry.venue}</div>
                      )}
                    </div>
                  </div>
                );
              });
            }
            // Multi-day: grouped with date headers
            return dayGroups.map(group => (
              <div key={group.dateStr} style={group.isDayPast ? { opacity: 0.4 } : undefined}>
                <div
                  className="dayof-day-header"
                  style={group.isToday ? { color: "var(--accent-primary)" } : undefined}
                >
                  {group.label}
                </div>
                {group.entries.map((entry, i) => {
                  const { startMs, endMs } = entryTimestamps(entry, mainEventDate);
                  const isNow  = !group.isDayPast && startMs !== null && endMs !== null && nowMs >= startMs && nowMs < endMs;
                  const isPast = !group.isDayPast && endMs !== null && nowMs >= endMs;
                  const timeStr = entry.startTime ? entry.startTime.replace(/^0/, "") : "";
                  return (
                    <div
                      key={entry.id || i}
                      ref={isNow ? nowRef : null}
                      className={`dayof-m-run-row ${isNow ? "now" : ""} ${isPast ? "past" : ""}`}
                    >
                      <div className="dayof-m-run-time" style={isNow ? { color: "var(--accent-primary)", fontWeight: 700 } : undefined}>
                        {timeStr}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className={`dayof-m-run-title ${isNow ? "now" : ""}`}>{entry.title}</div>
                        {entry.venue && (
                          <div className="dayof-m-run-venue">{entry.venue}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ));
          })()}
        </div>

        {/* ── Key contacts ── */}
        {(confirmedVendors.length > 0 || clergyContacts.length > 0) && (
          <div className="dayof-m-card">
            <div className="dayof-m-card-label">
              <Icon name="bellRing" context="badge" style={{ marginRight: 5 }} />
              Key contacts
            </div>
            {clergyContacts.map((c, i) => (
              <div key={`clergy-${i}`} className="dayof-m-contact">
                <div className="dayof-m-contact-icon">
                  <Icon name="sparkles" context="button" />
                </div>
                <div className="dayof-m-contact-info">
                  <div className="dayof-m-contact-name">{c.name}</div>
                  <div className="dayof-m-contact-role">{c.role}</div>
                </div>
                <div className="dayof-m-contact-actions">
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="dayof-m-action-btn call" aria-label={`Call ${c.name}`}>
                      <Icon name="phone" context="badge" />
                    </a>
                  )}
                  {c.phone && (
                    <a href={`sms:${c.phone}`} className="dayof-m-action-btn text" aria-label={`Text ${c.name}`}>
                      <Icon name="messageSquare" context="badge" />
                    </a>
                  )}
                  {!c.phone && c.email && (
                    <a href={`mailto:${c.email}`} className="dayof-m-action-btn text" aria-label={`Email ${c.name}`}>
                      <Icon name="mail" context="badge" />
                    </a>
                  )}
                </div>
              </div>
            ))}
            {confirmedVendors.map(v => (
              <div key={v.id} className="dayof-m-contact">
                <div className="dayof-m-contact-icon">
                  <Icon name="vendors" context="button" />
                </div>
                <div className="dayof-m-contact-info">
                  <div className="dayof-m-contact-name">{v.name}</div>
                  <div className="dayof-m-contact-role">{v.type || "Vendor"}{v.contactName ? ` · ${v.contactName}` : ""}</div>
                </div>
                <div className="dayof-m-contact-actions">
                  {v.phone && (
                    <a href={`tel:${v.phone}`} className="dayof-m-action-btn call" aria-label={`Call ${v.name}`}>
                      <Icon name="phone" context="badge" />
                    </a>
                  )}
                  {v.phone && (
                    <a href={`sms:${v.phone}`} className="dayof-m-action-btn text" aria-label={`Text ${v.name}`}>
                      <Icon name="messageSquare" context="badge" />
                    </a>
                  )}
                  {!v.phone && v.email && (
                    <a href={`mailto:${v.email}`} className="dayof-m-action-btn text" aria-label={`Email ${v.name}`}>
                      <Icon name="mail" context="badge" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Ceremony roles ── */}
        {ceremonyDisplay && ceremonyDisplay.sections.length > 0 && (
          <div className="dayof-m-card">
            <div className="dayof-m-card-label">
              ✡ Ceremony roles
            </div>
            {ceremonyDisplay.sections.map(sec => {
              const sectionRoles = ceremonyDisplay.roles.filter(r => r.section === sec);
              return (
                <div key={sec}>
                  <div className="dayof-m-section-label">{sec}</div>
                  {sectionRoles.map(role => (
                    <div key={role.id} className="dayof-m-role-row">
                      <div className="dayof-m-role-name">
                        {role.role}
                        {role.hebrewName && <span className="dayof-m-role-hebrew">{role.hebrewName}</span>}
                      </div>
                      <div className={`dayof-m-role-assignee ${role.assignee?.trim() ? "" : "empty"}`}>
                        {role.assignee?.trim() || "Unassigned"}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Quick numbers ── */}
        <div className="dayof-m-card">
          <div className="dayof-m-card-label">
            <Icon name="guests" context="badge" style={{ marginRight: 5 }} />
            Guest snapshot
          </div>
          <div className="dayof-m-stats-grid">
            {[
              { label: "Confirmed", value: totalConfirmed,        info: METRIC_HELP.confirmed({ precise: mealPrecise }) },
              { label: "Expected",  value: totalInvited,          info: METRIC_HELP.expected({ precise: mealPrecise }) },
              { label: "Kosher",    value: kosherCount,           info: METRIC_HELP.kosherDayOf() },
              { label: "Dietary",   value: dietaryPeople.length,  info: METRIC_HELP.dietary() },
            ].map(st => (
              <div className="dayof-m-stat" key={st.label} style={{ position: "relative" }}>
                <div className="dayof-m-stat-value">{st.value}</div>
                <div className="dayof-m-stat-label">{st.label}</div>
                <InfoPopover text={st.info} style={{ position: "absolute", top: 6, right: 6 }} />
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Sticky bottom CTA ── */}
      {notifyHref && (
        <a href={notifyHref} className="dayof-m-notify">
          <Icon name="bellRing" context="button" style={{ marginRight: 8 }} />
          Running late? Notify the team
        </a>
      )}
    </div>
  );
}
