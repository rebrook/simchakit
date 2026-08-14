import { RSVP_STATUSES } from "@/constants/guest-constants.js";

// value/onSelect are generic so this pill can drive any RSVP-status-shaped field —
// the household's main rsvpStatus, or a per-sub-event status. Call sites pass
// value={hh.rsvpStatus} to preserve the original behavior exactly.
export function RsvpPill({ value, open, onOpen, onSelect, statusStyle, disabled }) {
  const sc = statusStyle[value] || statusStyle["Invited"];
  const dotColors = {
    "Invited":  "var(--blue)",
    "RSVP Yes": "var(--green)",
    "RSVP No":  "var(--red)",
    "Pending":  "var(--orange)",
    "Maybe":    "var(--gold)",
  };

  if (disabled) {
    return (
      <span className="rsvp-pill" style={{background:sc.bg, color:sc.color, cursor:"default"}}>
        {value}
      </span>
    );
  }

  return (
    <div style={{position:"relative",display:"inline-block"}}>
      <button className="rsvp-pill"
        style={{background:sc.bg, color:sc.color}}
        onClick={onOpen}
        title="Click to change RSVP status">
        {value}
        <span className="rsvp-pill-caret">▾</span>
      </button>
      {open && (
        <div className="rsvp-dropdown" onClick={e=>e.stopPropagation()}>
          {RSVP_STATUSES.map(s => (
            <button key={s} className={`rsvp-dropdown-item ${value===s?"active":""}`}
              onClick={()=>onSelect(s)}>
              <div className="rsvp-dot" style={{background: dotColors[s]||"var(--text-muted)"}} />
              {s}
              {value===s && <span style={{marginLeft:"auto",fontSize:12}}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
