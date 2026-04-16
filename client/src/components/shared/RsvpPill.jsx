import { RSVP_STATUSES } from "@/constants/guest-constants.js";

export function RsvpPill({ hh, open, onOpen, onSelect, statusStyle }) {
  const sc = statusStyle[hh.status] || statusStyle["Invited"];
  const dotColors = {
    "Invited":  "var(--blue)",
    "RSVP Yes": "var(--green)",
    "RSVP No":  "var(--red)",
    "Pending":  "var(--orange)",
    "Maybe":    "var(--gold)",
  };
  return (
    <div style={{position:"relative",display:"inline-block"}}>
      <button className="rsvp-pill"
        style={{background:sc.bg, color:sc.color}}
        onClick={onOpen}
        title="Click to change RSVP status">
        {hh.status}
        <span className="rsvp-pill-caret">▾</span>
      </button>
      {open && (
        <div className="rsvp-dropdown" onClick={e=>e.stopPropagation()}>
          {RSVP_STATUSES.map(s => (
            <button key={s} className={`rsvp-dropdown-item ${hh.status===s?"active":""}`}
              onClick={()=>onSelect(s)}>
              <div className="rsvp-dot" style={{background: dotColors[s]||"var(--text-muted)"}} />
              {s}
              {hh.status===s && <span style={{marginLeft:"auto",fontSize:12}}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
