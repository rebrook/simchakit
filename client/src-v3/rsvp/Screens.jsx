// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.4.0 — rsvp/Screens.jsx
// The guest RSVP screens: Landing, WhoComing, Details, Confirmation, plus the
// read-only closed view. All state lives in RsvpApp; these are presentational.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { AnswerGroup, EventMark, Notice, ScreenHeading, answerLabel } from "@/rsvp/rsvpUi.jsx";
import {
  formatDate, formatShortDate, formatTimeRange, mealPeople, summarize, calendarFile, downloadIcs, safeFilename,
  setAll, copyAnswers, unanswered,
} from "@/rsvp/rsvpModel.js";

const sectionWhen = (s) => [formatDate(s.startDate, { weekday: "short", month: "short", day: "numeric" }), formatTimeRange(s.startTime, s.endTime)].filter(Boolean).join(", ");

// ── 1. Landing ────────────────────────────────────────────────────────────────
export function Landing({ view, onReply }) {
  const { event, household, people } = view;
  return (
    <div className="rs-screen rs-center">
      <EventMark event={event} />
      <p className="rs-eyebrow">You're invited to</p>
      <ScreenHeading className="rs-title">{event.name}</ScreenHeading>
      {event.date && <p className="rs-lede">{formatDate(event.date)}</p>}
      {event.venue && <p className="rs-sub">{event.venue}</p>}

      <div className="rs-card rs-replying">
        <div className="rs-eyebrow">Replying for</div>
        <div className="rs-strong">{household.formalName}</div>
        {people.length > 0 && <div className="rs-sub">{people.map(p => p.firstName).join(", ")}</div>}
      </div>

      <div className="rs-actions">
        <button type="button" className="rs-btn primary" onClick={onReply}>Reply</button>
        {event.deadline && <p className="rs-hint">Please reply by {formatShortDate(event.deadline)}</p>}
      </div>
    </div>
  );
}

// ── 2. Who's coming ───────────────────────────────────────────────────────────
// Few questions: everyone on one screen. Many: one screen per person, with shortcuts.
export function WhoComing({ view, draft, setDraft, perPerson, personIndex, setPersonIndex, onBack, onContinue }) {
  const [error, setError] = useState("");
  const people = perPerson ? [view.people[personIndex]] : view.people;
  const isLastPerson = !perPerson || personIndex === view.people.length - 1;

  const setAnswer = (personId, sectionId, value) => {
    setError("");
    setDraft(d => ({ ...d, answers: { ...d.answers, [personId]: { ...d.answers[personId], [sectionId]: value } } }));
  };

  const missing = unanswered({ ...view, people }, draft);
  const next = () => {
    if (missing.length) {
      const first = missing[0];
      setError(`Please answer for ${first.person.firstName}: ${first.section.title}${missing.length > 1 ? ` (and ${missing.length - 1} more)` : ""}.`);
      document.querySelector(`[data-answer-group="a-${first.person.id}-${first.section.id}"] input`)?.focus();
      return;
    }
    if (perPerson && !isLastPerson) { setPersonIndex(personIndex + 1); window.scrollTo(0, 0); return; }
    onContinue();
  };
  const back = () => {
    setError("");
    if (perPerson && personIndex > 0) { setPersonIndex(personIndex - 1); window.scrollTo(0, 0); return; }
    onBack();
  };

  return (
    <div className="rs-screen">
      <ScreenHeading className="rs-h2">{perPerson ? `Is ${people[0].firstName} coming?` : "Who's coming?"}</ScreenHeading>
      {perPerson && <p className="rs-sub">{`Person ${personIndex + 1} of ${view.people.length}`}</p>}

      {perPerson && personIndex === 0 && (
        <button type="button" className="rs-btn secondary rs-shortcut" onClick={() => { setDraft(d => setAll(view, d, "yes")); onContinue(); }}>
          Everyone is coming to everything
        </button>
      )}
      {perPerson && personIndex > 0 && (
        <button type="button" className="rs-btn secondary rs-shortcut" onClick={() => setDraft(d => copyAnswers(d, view.people[0].id, people[0].id))}>
          Same answers as {view.people[0].firstName}
        </button>
      )}

      {people.map(person => (
        <section key={person.id} className="rs-card" aria-label={person.firstName}>
          <h2 className="rs-card-title">
            {person.firstName}{person.isChild && <span className="rs-tag">child</span>}
          </h2>
          {view.sections.map(section => {
            const value = draft.answers[person.id]?.[section.id] || null;
            return (
              <div key={section.id} className="rs-q">
                <div className="rs-q-label">
                  <span className="rs-q-title">{section.icon ? `${section.icon} ` : ""}{section.title}</span>
                  <span className="rs-q-when">{sectionWhen(section)}</span>
                </div>
                <AnswerGroup name={`a-${person.id}-${section.id}`} legend={`${person.firstName}, ${section.title}`}
                  value={value} invalid={!!error && !value} onChange={v => setAnswer(person.id, section.id, v)} />
              </div>
            );
          })}
        </section>
      ))}

      {error && <Notice tone="error">{error}</Notice>}
      <div className="rs-nav">
        <button type="button" className="rs-btn ghost" onClick={back}>Back</button>
        <button type="button" className="rs-btn primary" onClick={next}>{perPerson && !isLastPerson ? "Next person" : "Continue"}</button>
      </div>
    </div>
  );
}

// ── 3. A few details ──────────────────────────────────────────────────────────
export function Details({ view, draft, setDraft, onBack, onSubmit, submitting, submitError, maxNewGuests }) {
  const eaters = mealPeople(view, draft);
  const setDetail = (id, patch) => setDraft(d => ({ ...d, details: { ...d.details, [id]: { ...d.details[id], ...patch } } }));
  const setAddress = (k, v) => setDraft(d => ({ ...d, address: { ...d.address, [k]: v } }));
  const addr = draft.address;
  const addressLine = [addr.address1, addr.address2, [addr.city, addr.stateProvince].filter(Boolean).join(", "), addr.postalCode].filter(Boolean).join(", ");
  const guests = draft.newGuests || [];
  const setGuest = (i, patch) => setDraft(d => ({ ...d, newGuests: d.newGuests.map((g, j) => (j === i ? { ...g, ...patch } : g)) }));

  return (
    <div className="rs-screen">
      <ScreenHeading className="rs-h2">A few details</ScreenHeading>

      {eaters.map(person => (
        <section key={person.id} className="rs-card" aria-label={`${person.firstName}'s meal`}>
          <h2 className="rs-card-title">{person.firstName} · meal</h2>
          <label className="rs-label" htmlFor={`meal-${person.id}`}>Meal choice</label>
          <select id={`meal-${person.id}`} className="rs-input" value={draft.details[person.id]?.mealChoice || ""}
            onChange={e => setDetail(person.id, { mealChoice: e.target.value })}>
            <option value="">Choose a meal</option>
            {view.mealOptions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <label className="rs-label" htmlFor={`diet-${person.id}`}>Dietary needs (optional)</label>
          <input id={`diet-${person.id}`} className="rs-input" type="text" maxLength={300} value={draft.details[person.id]?.dietary || ""}
            onChange={e => setDetail(person.id, { dietary: e.target.value })} />
          <label className="rs-check">
            <input type="checkbox" checked={!!draft.details[person.id]?.kosher} onChange={e => setDetail(person.id, { kosher: e.target.checked })} />
            <span>Kosher meal</span>
          </label>
        </section>
      ))}

      <section className="rs-card" aria-label="Mailing address">
        <h2 className="rs-card-title">Mailing address</h2>
        {addressLine ? <p className="rs-sub">{addressLine}</p> : <p className="rs-sub">We don't have an address for you yet.</p>}
        <div className="rs-seg" role="radiogroup" aria-label="Is this address correct?">
          {addressLine && (
            <label className={`rs-seg-opt yes${draft.addressMode === "correct" ? " on" : ""}`}>
              <input type="radio" name="address-mode" checked={draft.addressMode === "correct"} onChange={() => setDraft(d => ({ ...d, addressMode: "correct" }))} />
              <span className="rs-seg-shape" aria-hidden="true">{draft.addressMode === "correct" ? "✓" : "○"}</span><span>Correct</span>
            </label>
          )}
          <label className={`rs-seg-opt unsure${draft.addressMode === "update" ? " on" : ""}`}>
            <input type="radio" name="address-mode" checked={draft.addressMode === "update"} onChange={() => setDraft(d => ({ ...d, addressMode: "update" }))} />
            <span className="rs-seg-shape" aria-hidden="true">{draft.addressMode === "update" ? "✎" : "○"}</span><span>{addressLine ? "Update" : "Add address"}</span>
          </label>
        </div>
        {draft.addressMode === "update" && (
          <div className="rs-address">
            {[["address1", "Street address", "address-line1"], ["address2", "Apartment, suite (optional)", "address-line2"], ["city", "City", "address-level2"],
              ["stateProvince", "State or province", "address-level1"], ["postalCode", "Postal code", "postal-code"], ["country", "Country", "country-name"]].map(([k, label, ac]) => (
              <div key={k}>
                <label className="rs-label" htmlFor={`addr-${k}`}>{label}</label>
                <input id={`addr-${k}`} className="rs-input" type="text" maxLength={120} autoComplete={ac} value={addr[k] || ""} onChange={e => setAddress(k, e.target.value)} />
              </div>
            ))}
          </div>
        )}
      </section>

      {maxNewGuests > 0 && (
        <section className="rs-card" aria-label="Additional guests">
          <h2 className="rs-card-title">Bringing someone else?</h2>
          <p className="rs-sub">You can add up to {maxNewGuests} guest{maxNewGuests !== 1 ? "s" : ""}. Your host will confirm.</p>
          {guests.map((g, i) => (
            <div key={i} className="rs-guest">
              <label className="rs-label" htmlFor={`g-first-${i}`}>First name</label>
              <input id={`g-first-${i}`} className="rs-input" type="text" maxLength={60} value={g.firstName} onChange={e => setGuest(i, { firstName: e.target.value })} />
              <label className="rs-label" htmlFor={`g-last-${i}`}>Last name (optional)</label>
              <input id={`g-last-${i}`} className="rs-input" type="text" maxLength={60} value={g.lastName} onChange={e => setGuest(i, { lastName: e.target.value })} />
              <label className="rs-check"><input type="checkbox" checked={g.isChild} onChange={e => setGuest(i, { isChild: e.target.checked })} /><span>This guest is a child</span></label>
              <button type="button" className="rs-btn ghost" onClick={() => setDraft(d => ({ ...d, newGuests: d.newGuests.filter((_, j) => j !== i) }))}>Remove this guest</button>
            </div>
          ))}
          {guests.length < maxNewGuests && (
            <button type="button" className="rs-btn secondary" onClick={() => setDraft(d => ({ ...d, newGuests: [...d.newGuests, { firstName: "", lastName: "", isChild: false }] }))}>
              Add a guest
            </button>
          )}
        </section>
      )}

      <section className="rs-card" aria-label="Note to the hosts">
        <h2 className="rs-card-title">Note to the hosts</h2>
        <label className="rs-label" htmlFor="rs-note">Anything you'd like us to know? (optional)</label>
        <textarea id="rs-note" className="rs-input rs-textarea" maxLength={1000} value={draft.note} onChange={e => setDraft(d => ({ ...d, note: e.target.value }))} />
      </section>

      {submitError && <Notice tone="error">{submitError}</Notice>}
      <div className="rs-nav">
        <button type="button" className="rs-btn ghost" onClick={onBack} disabled={submitting}>Back</button>
        <button type="button" className="rs-btn primary" onClick={onSubmit} disabled={submitting}>
          {submitting ? "Sending…" : submitError ? "Try again" : "Send reply"}
        </button>
      </div>
    </div>
  );
}

// ── The "who is coming to what" list, shared by Confirmation and the closed view ──
function Summary({ view, draft }) {
  return (
    <div className="rs-summary">
      {summarize(view, draft).map(({ section, yes, no, unsure, none }) => (
        <section key={section.id} className="rs-card" aria-label={section.title}>
          <h2 className="rs-card-title">{section.icon ? `${section.icon} ` : ""}{section.title}</h2>
          <p className="rs-sub">{sectionWhen(section)}{section.venue ? ` · ${section.venue}` : ""}</p>
          <ul className="rs-chips">
            {yes.length > 0 && <li><span className="rs-chip yes"><span aria-hidden="true">✓</span> Coming: {yes.join(", ")}</span></li>}
            {unsure.length > 0 && <li><span className="rs-chip unsure"><span aria-hidden="true">?</span> Not sure: {unsure.join(", ")}</span></li>}
            {no.length > 0 && <li><span className="rs-chip no"><span aria-hidden="true">✕</span> Not coming: {no.join(", ")}</span></li>}
            {none.length > 0 && <li><span className="rs-chip"><span aria-hidden="true">○</span> {answerLabel(null)}: {none.join(", ")}</span></li>}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ── 4. Confirmation (and the "already replied" screen) ───────────────────────
export function Confirmation({ view, draft, justSent, onChange }) {
  const attending = summarize(view, draft).filter(g => g.yes.length > 0).map(g => g.section);
  return (
    <div className="rs-screen">
      <ScreenHeading className="rs-title">{justSent ? "Thank you!" : "Your reply"}</ScreenHeading>
      <p className="rs-lede">
        {justSent ? "We've sent your reply to the hosts." : `We have your reply for ${view.household.formalName}.`}
      </p>
      <Summary view={view} draft={draft} />

      {attending.length > 0 && (
        <section className="rs-card" aria-label="Add to calendar">
          <h2 className="rs-card-title">Add to your calendar</h2>
          <div className="rs-cal">
            {attending.map(s => (
              <button key={s.id} type="button" className="rs-btn secondary"
                onClick={() => downloadIcs(`${safeFilename(s.title)}.ics`, calendarFile(view, [s]))}>
                {s.title}
              </button>
            ))}
            {attending.length > 1 && (
              <button type="button" className="rs-btn secondary" onClick={() => downloadIcs(`${safeFilename(view.event.name)}.ics`, calendarFile(view, attending))}>
                Add all
              </button>
            )}
          </div>
        </section>
      )}

      <div className="rs-actions">
        <button type="button" className="rs-btn primary" onClick={onChange}>Change your reply</button>
        {view.event.deadline && <p className="rs-hint">You can change your reply until {formatShortDate(view.event.deadline)}, using this same link.</p>}
      </div>
    </div>
  );
}

// ── Replies closed ────────────────────────────────────────────────────────────
// The message and event basics always; the household's last answers read-only when the
// server sent them (closed by deadline or already replied, never an archived event).
export function Closed({ view, draft }) {
  return (
    <div className="rs-screen rs-center">
      <EventMark event={view.event} />
      <ScreenHeading className="rs-title">{view.event.name}</ScreenHeading>
      {view.event.date && <p className="rs-lede">{formatDate(view.event.date)}</p>}
      <Notice tone="info">{view.message}</Notice>
      {draft && view.sections?.length > 0 && (
        <>
          <p className="rs-sub rs-left">Your last reply, for {view.household.formalName}:</p>
          <div className="rs-left"><Summary view={view} draft={draft} /></div>
        </>
      )}
    </div>
  );
}

export function Message({ title, children }) {
  return (
    <div className="rs-screen rs-center">
      <ScreenHeading className="rs-title">{title}</ScreenHeading>
      <div className="rs-lede">{children}</div>
    </div>
  );
}
