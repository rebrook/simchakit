// Moved verbatim from AdminPanel.jsx (V4.44.0 module split) — no behavior changes.
import { Icon }                          from "@/utils/iconMap.jsx";

const EVENT_TYPES = [
  { value:"bar-mitzvah",  label:"Bar Mitzvah"        },
  { value:"bat-mitzvah",  label:"Bat Mitzvah"        },
  { value:"bnei-mitzvah", label:"B'nei Mitzvah"      },
  { value:"anniversary",  label:"Anniversary"        },
  { value:"baby-naming",  label:"Baby Naming"        },
  { value:"birthday",     label:"Birthday"           },
  { value:"graduation",   label:"Graduation"         },
  { value:"wedding",      label:"Wedding"            },
  { value:"other",        label:"Other Celebration"  },
];

// ── Event Details ──
export function EventDetailsSection({ form, set, eventId, eventIdCopied, setEventIdCopied, saved, error, onClose, saveConfig, saving }) {
  return (
      <>
        {saved  && <div className="alert alert-success" style={{marginBottom:12}}><Icon name="check" context="badge" style={{ marginRight: 4 }} /> Event configuration saved</div>}
        {error  && <div className="alert alert-error"   style={{marginBottom:12}}><Icon name="alertTriangle" context="badge" style={{ marginRight: 3 }} /> {error}</div>}
        <div className="form-group">
          <label className="form-label">Event Name</label>
          <input className="form-input" value={form.name} onChange={e => set("name",e.target.value)} placeholder="e.g., Lisa Simpson's Bat Mitzvah" />
        </div>
        <div className="form-group">
          <label className="form-label">Event Type</label>
          <select className="form-select" value={form.type} onChange={e => set("type",e.target.value)}>
            {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Event ID</label>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <input className="form-input" readOnly value={eventId} onFocus={e => e.target.select()} style={{fontFamily:"monospace",fontSize:12}} />
            <button type="button" className="btn btn-secondary btn-sm" style={{flexShrink:0}}
              onClick={() => navigator.clipboard.writeText(eventId).then(() => { setEventIdCopied(true); setTimeout(() => setEventIdCopied(false), 2000); })}>
              <Icon name={eventIdCopied ? "check" : "copy"} context="button" style={{ marginRight: 4 }} />{eventIdCopied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="form-hint">Share this ID with support when you need help with this event</div>
        </div>
        <div className="form-group">
          <label className="form-label">RSVP Website URL</label>
          <input className="form-input" value={form.rsvpUrl} onChange={e => set("rsvpUrl",e.target.value)} placeholder="https://…" />
        </div>
        <div className="form-group">
          <label className="form-label">RSVP Deadline</label>
          <input className="form-input" type="date" value={form.rsvpDeadline||""} onChange={e => set("rsvpDeadline",e.target.value)} />
          <div className="form-hint">A banner will appear on the Guests tab counting down to this date</div>
        </div>
        <div className="form-group">
          <label className="form-label">Catering Style</label>
          <select className="form-select" value={form.cateringStyle||"plated"} onChange={e => set("cateringStyle",e.target.value)}>
            <option value="plated">Plated / Assigned Meals</option>
            <option value="buffet-exceptions">Buffet with dietary exceptions</option>
            <option value="buffet-headcount">Buffet (headcount only)</option>
          </select>
          <div className="form-hint">Controls what the Catering Summary shows in the Guests tab</div>
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={form.notes} onChange={e => set("notes",e.target.value)} placeholder="Any additional details about this event…" rows={3} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={saveConfig} disabled={saving}>{saving?"Saving…":"Save Configuration"}</button>
        </div>
      </>
  );
}
