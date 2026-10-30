// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.1.0 — components/guests/MessageComposer.jsx
// Guest messaging composer (V5-M2). One modal, two paths:
//   Email path:  1 Message  ->  2 Recipients  ->  3 Preview  ->  4 Send
//   Mark path:   1 Details  ->  2 Recipients  ->  3 Confirm
// "Send by email" goes through /api/guest?action=send (dry_run for the preview,
// action=test for "Send test to me"). "I sent these another way" records the
// mailing in the message log without sending anything (paper, Evite, a printer...).
// The log is the only record: neither path writes the pre-V5 sent flags.
// Opened by owners and editors only; never on archived events.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useEffect, useRef } from "react";
import { Modal } from "@/components/shared/Modal.jsx";
import { RSVP_STATUSES } from "@/constants/guest-constants.js";
import { isInvited } from "@/utils/sections.js";
import { supabase } from "@/lib/supabase.js";
import {
  MESSAGE_KINDS, MANUAL_CHANNELS, MERGE_FIELDS, DEFAULT_TEMPLATES, kindLabel, channelLabel,
} from "@/utils/messageTemplates.js";
import { householdKey, isSent, statusText } from "@/utils/messageStatus.js";
import { callGuestApi, describeApiError, markSent } from "@/utils/messageApi.js";
import { remindedRecently, REMINDER_COOLDOWN_DAYS } from "@/utils/rsvpReminders.js";
import { shortDate } from "@/utils/messageStatus.js";

const MAX_RECIPIENTS = 500;   // api/guest send limit per call

const SKIP_REASONS = {
  no_email:      "no email address",
  invalid_email: "email address looks invalid",
  opted_out:     "unsubscribed",
  not_found:     "not found",
};

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const emailOf = (hh) => String(hh.email || "").trim();

export function MessageComposer({
  eventId, households, sections, groups, adminConfig, sentLookup,
  initialIds, initialKind, initialMethod, unrepliedIds,
  onSaveEmail, onClose, onSent, onMarked, showToast,
  // Gift thank-you mode (V5-M3): the Thank-you kind and the chosen households are fixed.
  // recipientNotes: { [household key]: text } shown beside each recipient;
  // renderResultExtra(result): extra content under the "Sent to" summary.
  locked, recipientNotes, renderResultExtra,
}) {
  const [method,  setMethod]  = useState(initialMethod || null);   // "email" | "mark"
  const [kind,    setKind]    = useState(initialKind || "save_the_date");
  const [subject, setSubject] = useState(DEFAULT_TEMPLATES[initialKind || "save_the_date"].subject);
  const [body,    setBody]    = useState(DEFAULT_TEMPLATES[initialKind || "save_the_date"].body);
  const [channel, setChannel] = useState("paper");
  const [date,    setDate]    = useState(todayISO());
  const [step,    setStep]    = useState(1);

  const [restrictIds, setRestrictIds] = useState(initialIds && initialIds.length ? new Set(initialIds) : null);
  const [filters,  setFilters]  = useState({ group: "All", status: "All", section: "All", outOfTown: false,
    // An RSVP reminder repeats by design, so it never hides households that were reminded before;
    // it starts from the households that have not replied (unless the caller chose the households).
    notSent: !initialIds && initialKind !== "rsvp_reminder",
    unreplied: !initialIds && initialKind === "rsvp_reminder" });
  const [excluded, setExcluded] = useState(new Set());

  const [preview,    setPreview]    = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [error,      setError]      = useState("");
  const [testState,  setTestState]  = useState("");
  const [previewWidth, setPreviewWidth] = useState("desktop");   // "desktop" | "phone" (360px)
  const [working,    setWorking]    = useState(false);
  const [result,     setResult]     = useState(null);
  const [emailDrafts, setEmailDrafts] = useState({});

  const bodyRef = useRef(null);
  const isEmail = method === "email";
  const steps = isEmail ? ["Message", "Recipients", "Preview", "Send"] : ["Details", "Recipients", "Confirm"];
  const lastStep = steps.length;

  // ── Recipients ───────────────────────────────────────────────────────────
  const candidates = useMemo(() => households.filter(hh => {
    const key = householdKey(hh);
    if (restrictIds && !restrictIds.has(key)) return false;
    if (filters.group  !== "All" && hh.group !== filters.group) return false;
    if (filters.status !== "All" && hh.rsvpStatus !== filters.status) return false;
    if (filters.outOfTown && !hh.outOfTown) return false;
    if (filters.section !== "All") {
      const sec = sections.find(s => s.id === filters.section);
      if (!sec || !isInvited(hh, sec)) return false;
    }
    if (filters.notSent && isSent(sentLookup(hh, kind))) return false;
    if (filters.unreplied && unrepliedIds && !unrepliedIds.has(key)) return false;
    return true;
  }), [households, restrictIds, filters, sections, sentLookup, kind]);

  const recipients = useMemo(() => candidates.filter(hh => !excluded.has(householdKey(hh))), [candidates, excluded]);
  const missingEmail = isEmail ? recipients.filter(hh => !emailOf(hh)) : [];
  // Repeating kinds (reminders) are not "already sent": they warn only when reminded very recently.
  const alreadySent  = kind === "rsvp_reminder" ? [] : recipients.filter(hh => isSent(sentLookup(hh, kind)));
  const recentlyReminded = kind === "rsvp_reminder" ? recipients.filter(hh => remindedRecently(sentLookup(hh, kind))) : [];
  const needsAnyway = alreadySent.length > 0 || recentlyReminded.length > 0;
  // Invitations and reminders are meant to carry each household's reply link.
  const missingLink = isEmail && (kind === "invitation" || kind === "rsvp_reminder") && !/\{\{\s*rsvp_link\s*\}\}/i.test(body);
  const overLimit    = isEmail && recipients.length > MAX_RECIPIENTS;
  const sendable     = isEmail ? recipients.filter(hh => emailOf(hh)) : recipients;

  const toggleOne = (hh) => setExcluded(prev => {
    const next = new Set(prev);
    const key = householdKey(hh);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  // ── Step 1 helpers ───────────────────────────────────────────────────────
  const chooseKind = (k) => {
    setKind(k);
    setSubject(DEFAULT_TEMPLATES[k].subject);
    setBody(DEFAULT_TEMPLATES[k].body);
    setPreview(null);
    if (!restrictIds) {
      setFilters(f => ({ ...f, notSent: k !== "rsvp_reminder", unreplied: k === "rsvp_reminder" }));
      setExcluded(new Set());
    }
  };

  const insertField = (key) => {
    const el = bodyRef.current;
    const raw = `{{${key}}}`;
    const start = el ? (el.selectionStart ?? body.length) : body.length;
    const end   = el ? (el.selectionEnd   ?? body.length) : body.length;
    // Keep fields from running into the words around them: add a space before the
    // field when the character just before the cursor is not already whitespace.
    const prev  = body.slice(0, start).slice(-1);
    const token = prev && !/\s/.test(prev) ? ` ${raw}` : raw;
    setBody(body.slice(0, start) + token + body.slice(end));
    setPreview(null);
    if (el) requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + token.length, start + token.length); });
  };

  // ── Preview (dry_run) ────────────────────────────────────────────────────
  const idsForApi = () => sendable.map(householdKey);

  const loadPreview = async () => {
    setPreviewing(true); setError(""); setPreview(null); setTestState("");
    const res = await callGuestApi("send", {
      eventId, kind, subject, bodyTemplate: body, householdIds: idsForApi(), dry_run: true,
    });
    setPreviewing(false);
    if (!res.ok) { setError(describeApiError(res)); return; }
    setPreview(res.data);
  };

  const next = async () => {
    setError("");
    if (step === 1) {
      if (!method) { setError("Choose how these are going out."); return; }
      if (isEmail && (!subject.trim() || !body.trim())) { setError("Add a subject and a message."); return; }
      if (!isEmail && !date) { setError("Choose the date they went out."); return; }
    }
    if (step === 2) {
      if (recipients.length === 0) { setError("Choose at least one household."); return; }
      if (overLimit) { setError(`Send to ${MAX_RECIPIENTS} households or fewer at a time.`); return; }
      if (isEmail && sendable.length === 0) { setError("None of the chosen households has an email address yet. Add one below or skip them."); return; }
    }
    const to = step + 1;
    setStep(to);
    if (isEmail && to === 3) loadPreview();
  };

  const back = () => { setError(""); setStep(s => Math.max(1, s - 1)); };

  // ── Test send ────────────────────────────────────────────────────────────
  const sendTest = async () => {
    setTestState("sending"); setError("");
    const first = preview?.previews?.[0]?.householdId;
    if (!first) { setTestState(""); setError("There is no recipient to base a sample on."); return; }
    const res = await callGuestApi("test", {
      eventId, kind, subject, bodyTemplate: body, householdIds: [first],
    });
    if (!res.ok) { setTestState(""); setError(describeApiError(res)); return; }
    setTestState(`Test sent to ${res.data.sentTo}`);
  };

  // ── Send / mark ──────────────────────────────────────────────────────────
  const send = async () => {
    setWorking(true); setError("");
    const res = await callGuestApi("send", {
      eventId, kind, subject, bodyTemplate: body, householdIds: idsForApi(),
    });
    setWorking(false);
    if (!res.ok) { setError(describeApiError(res)); return; }
    setResult(res.data);
    onSent?.(res.data);
  };

  const mark = async () => {
    setWorking(true); setError("");
    try {
      const { messageId } = await markSent({ eventId, kind, channel, date, householdIds: recipients.map(householdKey) });
      setWorking(false);
      onMarked?.({ messageId, count: recipients.length, kind, channel });
      onClose();
    } catch (err) {
      setWorking(false);
      setError(navigator.onLine === false
        ? "You appear to be offline. Check your connection and try again."
        : "Could not record this. Only the event owner and editors can do that, and archived events are read-only.");
    }
  };

  // ── Render helpers ───────────────────────────────────────────────────────
  const setFilter = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setExcluded(new Set()); };

  const stepper = (
    <div className="msg-steps" aria-label="Progress">
      {steps.map((label, i) => (
        <span key={label} className={`msg-step${i + 1 === step ? " active" : i + 1 < step ? " done" : ""}`}
          aria-current={i + 1 === step ? "step" : undefined}>
          {i + 1}. {label}
        </span>
      ))}
    </div>
  );

  const step1 = (
    <>
      {locked && (
        <div className="msg-notice">
          <span>Each giver's household gets its own email, with the household name and the gift filled in. Edit the wording below if you like.</span>
        </div>
      )}
      {!locked && <div className="form-label" style={{ marginBottom: 6 }}>What are you sending?</div>}
      {!locked && <div className="msg-cards" role="group" aria-label="Message type">
        {MESSAGE_KINDS.filter(k => method !== "mark" || k.manual).map(k => (
          <button key={k.key} type="button" className={`msg-card${kind === k.key ? " selected" : ""}`}
            aria-pressed={kind === k.key} onClick={() => chooseKind(k.key)}>
            {k.label}
          </button>
        ))}
      </div>}

      {!locked && <div className="form-label" style={{ marginBottom: 6 }}>How is it going out?</div>}
      {!locked && <div className="msg-radio-row" role="radiogroup" aria-label="How it is going out">
        <label className={`msg-radio${method === "email" ? " selected" : ""}`}>
          <input type="radio" name="msg-method" checked={method === "email"} onChange={() => setMethod("email")} />
          <span><span className="msg-radio-title">Send by email</span><br />
            <span className="msg-radio-sub">SimchaKit emails each household and records it here.</span></span>
        </label>
        <label className={`msg-radio${method === "mark" ? " selected" : ""}`}>
          <input type="radio" name="msg-method" checked={method === "mark"}
            disabled={!MESSAGE_KINDS.find(k => k.key === kind)?.manual}
            onChange={() => setMethod("mark")} />
          <span><span className="msg-radio-title">I sent these another way</span><br />
            <span className="msg-radio-sub">Paper invitations, Evite, Paperless Post, a printer or a calligrapher. Nothing is emailed; this just keeps your record.</span></span>
        </label>
      </div>}

      {method === "email" && (
        <>
          <div className="form-group">
            <label className="form-label" htmlFor="msg-subject">Subject</label>
            <input id="msg-subject" className="form-input" value={subject} maxLength={200}
              onChange={e => { setSubject(e.target.value); setPreview(null); }} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="msg-body">Message</label>
            <textarea id="msg-body" ref={bodyRef} className="form-input msg-body-input" value={body}
              onChange={e => { setBody(e.target.value); setPreview(null); }} />
            {missingLink && (
              <div className="msg-notice" role="status">
                This message doesn't include <strong>{"{{rsvp_link}}"}</strong>, so guests won't get a link to reply. Use "+ RSVP link" to add it.
              </div>
            )}
            <div className="msg-field-chips" aria-label="Insert a name or detail">
              {MERGE_FIELDS.map(f => (
                <button key={f.key} type="button" className="btn btn-secondary btn-sm" onClick={() => insertField(f.key)}>
                  + {f.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {method === "mark" && (
        <div className="msg-filters">
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="msg-channel">Sent by</label>
            <select id="msg-channel" className="form-select" value={channel} onChange={e => setChannel(e.target.value)}>
              {MANUAL_CHANNELS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="msg-date">Date sent</label>
            <input id="msg-date" className="form-input" type="date" value={date} max={todayISO()} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
      )}
    </>
  );

  const step2 = (
    <>
      {restrictIds && !locked && (
        <div className="msg-notice">
          <span>Starting from the {restrictIds.size} household{restrictIds.size !== 1 ? "s" : ""} you selected.</span>
          <button type="button" className="msg-link-btn" style={{ alignSelf: "flex-start" }}
            onClick={() => { setRestrictIds(null); setExcluded(new Set()); }}>Choose from all guests instead</button>
        </div>
      )}
      {!locked && <div className="msg-filters">
        <select className="form-select" style={{ width: "auto" }} aria-label="Group" value={filters.group} onChange={e => setFilter("group", e.target.value)}>
          <option value="All">All groups</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className="form-select" style={{ width: "auto" }} aria-label="RSVP status" value={filters.status} onChange={e => setFilter("status", e.target.value)}>
          <option value="All">Any RSVP status</option>
          {RSVP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {sections.length > 1 && (
          <select className="form-select" style={{ width: "auto" }} aria-label="Invited to" value={filters.section} onChange={e => setFilter("section", e.target.value)}>
            <option value="All">Invited to any</option>
            {sections.map(s => <option key={s.id} value={s.id}>Invited to {s.label}</option>)}
          </select>
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, minHeight: 44 }}>
          <input type="checkbox" checked={filters.outOfTown} onChange={e => setFilter("outOfTown", e.target.checked)} /> Out of town
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, minHeight: 44 }}>
          <input type="checkbox" checked={filters.notSent} onChange={e => setFilter("notSent", e.target.checked)} />
          Not yet sent: {kindLabel(kind)}
        </label>
        {unrepliedIds && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, minHeight: 44 }}>
            <input type="checkbox" checked={filters.unreplied} onChange={e => setFilter("unreplied", e.target.checked)} />
            Haven't replied yet
          </label>
        )}
      </div>}

      <div className="msg-count" aria-live="polite">
        {recipients.length} household{recipients.length !== 1 ? "s" : ""} chosen
        {isEmail && missingEmail.length > 0 && ` · ${missingEmail.length} without an email`}
      </div>

      {overLimit && (
        <div className="msg-notice error" role="alert">
          That is more than {MAX_RECIPIENTS} households. Narrow the list (for example by group) and send in more than one batch.
        </div>
      )}

      {isEmail && households.every(hh => !emailOf(hh)) && (
        <div className="msg-notice">
          None of your households has an email address yet. Add them in the guest list or below, or choose "I sent these another way".
        </div>
      )}

      {missingEmail.length > 0 && (
        <div className="msg-notice">
          <strong>Missing an email address</strong>
          <span>Add one here, or skip these households (they will not get this message).</span>
          {missingEmail.map(hh => {
            const key = householdKey(hh);
            const draft = emailDrafts[key] || "";
            return (
              <div key={key} className="msg-missing-row">
                <span style={{ fontWeight: 600, minWidth: 120 }}>{hh.formalName || "Household"}</span>
                <input className="form-input" type="email" aria-label={`Email for ${hh.formalName || "household"}`} placeholder="email@example.com"
                  value={draft} onChange={e => setEmailDrafts(d => ({ ...d, [key]: e.target.value }))} />
                <button type="button" className="btn btn-primary btn-sm" disabled={!draft.trim()}
                  onClick={async () => { await onSaveEmail(hh, draft); setEmailDrafts(d => { const n = { ...d }; delete n[key]; return n; }); }}>Save</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => toggleOne(hh)}>Skip</button>
              </div>
            );
          })}
        </div>
      )}

      {candidates.length === 0 ? (
        <div className="msg-notice">No households match these filters.</div>
      ) : (
        <div className="msg-list" role="group" aria-label="Households">
          {candidates.map(hh => {
            const key = householdKey(hh);
            const st = sentLookup(hh, kind);
            return (
              <label key={key} className="msg-list-row">
                <input type="checkbox" checked={!excluded.has(key)} onChange={() => toggleOne(hh)} />
                <span style={{ flex: 1 }}>{hh.formalName || "Household"}{recipientNotes?.[key] && <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)" }}>{recipientNotes[key]}</span>}</span>
                {isEmail && !emailOf(hh) && <span className="tag tag-gold" style={{ fontSize: 10 }}>No email</span>}
                {isSent(st) && <span className="tag tag-muted" style={{ fontSize: 10 }}>{kind === "rsvp_reminder" ? `Last reminded ${shortDate(st.date)}` : statusText(st)}</span>}
              </label>
            );
          })}
        </div>
      )}
    </>
  );

  const skippedByReason = (preview?.skipped || []).reduce((acc, s) => { (acc[s.reason] = acc[s.reason] || []).push(s); return acc; }, {});

  const step3Email = (
    <>
      {previewing && <div className="msg-notice" role="status">Preparing your preview…</div>}
      {preview && (
        <>
          <div className="msg-count" aria-live="polite">
            {preview.recipientCount} household{preview.recipientCount !== 1 ? "s" : ""} will receive this
            {(preview.skipped || []).length > 0 && ` · ${preview.skipped.length} skipped`}
          </div>
          {Object.keys(skippedByReason).length > 0 && (
            <div className="msg-notice">
              <strong>Skipped</strong>
              {Object.entries(skippedByReason).map(([reason, list]) => (
                <span key={reason}>{list.length} with {SKIP_REASONS[reason] || reason}: {list.map(s => s.name || "Household").slice(0, 5).join(", ")}{list.length > 5 ? ", …" : ""}</span>
              ))}
            </div>
          )}
          {preview.previews?.[0] ? (
            <>
              <div className="msg-preview-meta">
                Sample for {preview.previews[0].name || "the first household"} ({preview.previews[0].email}). From: {preview.sender?.name}
                {preview.sender?.replyTo ? ` · replies go to ${preview.sender.replyTo}` : ""}
              </div>
              <div className="msg-preview-meta"><strong>Subject:</strong> {preview.previews[0].subject}</div>
              <div className="msg-preview-toggle" role="group" aria-label="Preview width">
                <button type="button" className={`btn btn-sm ${previewWidth === "desktop" ? "btn-primary" : "btn-secondary"}`} aria-pressed={previewWidth === "desktop"} onClick={() => setPreviewWidth("desktop")}>Desktop</button>
                <button type="button" className={`btn btn-sm ${previewWidth === "phone" ? "btn-primary" : "btn-secondary"}`} aria-pressed={previewWidth === "phone"} onClick={() => setPreviewWidth("phone")}>Phone (360px)</button>
              </div>
              <div className={`msg-preview-wrap ${previewWidth}`}>
                <iframe className="msg-preview-frame" title="Message preview" sandbox="" srcDoc={preview.previews[0].html} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, margin: "10px 0 14px" }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={sendTest} disabled={testState === "sending"}>
                  {testState === "sending" ? "Sending test…" : "Send test to me"}
                </button>
                {testState && testState !== "sending" && <span role="status" style={{ fontSize: 13, color: "var(--green)" }}>✓ {testState}</span>}
              </div>
            </>
          ) : (
            <div className="msg-notice">No one can receive this message yet. Go back to add email addresses.</div>
          )}
          <SenderDetails eventId={eventId} defaults={{ senderName: adminConfig?.name || "", replyTo: preview.sender?.replyTo || "" }} showToast={showToast} onSaved={loadPreview} />
        </>
      )}
    </>
  );

  const confirmSummary = (
    <>
      <div className="msg-count">
        {isEmail ? `Send "${kindLabel(kind)}" by email to ${preview?.recipientCount ?? sendable.length} household${(preview?.recipientCount ?? sendable.length) !== 1 ? "s" : ""}`
                  : `Record "${kindLabel(kind)}" as sent by ${channelLabel(channel).toLowerCase()} on ${date} for ${recipients.length} household${recipients.length !== 1 ? "s" : ""}`}
      </div>
      {isEmail && (
        <div className="msg-preview-meta">Subject: {subject}</div>
      )}
      {alreadySent.length > 0 && (
        <div className="msg-notice" role="alert">
          <strong>{alreadySent.length} household{alreadySent.length !== 1 ? "s are" : " is"} already marked sent for {kindLabel(kind)}</strong>
          <span>{alreadySent.slice(0, 5).map(hh => hh.formalName || "Household").join(", ")}{alreadySent.length > 5 ? ", …" : ""}</span>
          <button type="button" className="msg-link-btn" style={{ alignSelf: "flex-start" }}
            onClick={() => { setExcluded(prev => { const n = new Set(prev); alreadySent.forEach(hh => n.add(householdKey(hh))); return n; }); setPreview(null); setStep(2); }}>
            Remove them and go back
          </button>
        </div>
      )}
      {recentlyReminded.length > 0 && (
        <div className="msg-notice" role="alert">
          <strong>{recentlyReminded.length} household{recentlyReminded.length !== 1 ? "s were" : " was"} reminded in the last {REMINDER_COOLDOWN_DAYS} days</strong>
          <span>{recentlyReminded.slice(0, 5).map(hh => `${hh.formalName || "Household"} (${shortDate(sentLookup(hh, kind).date)})`).join(", ")}{recentlyReminded.length > 5 ? ", …" : ""}</span>
          <button type="button" className="msg-link-btn" style={{ alignSelf: "flex-start" }}
            onClick={() => { setExcluded(prev => { const n = new Set(prev); recentlyReminded.forEach(hh => n.add(householdKey(hh))); return n; }); setPreview(null); setStep(2); }}>
            Remove them and go back
          </button>
        </div>
      )}
      {!isEmail && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Nothing is emailed. You can undo this for a few seconds afterwards.</p>}
    </>
  );

  const resultView = result && (
    <div>
      <div className="msg-count" role="status">
        Sent to {result.sent} household{result.sent !== 1 ? "s" : ""}
        {result.failed > 0 && ` · ${result.failed} failed`}
        {(result.skipped || []).length > 0 && ` · ${result.skipped.length} skipped`}
      </div>
      {result.failed > 0 && (
        <div className="msg-notice">Some emails did not go through. Open Messages to see which and use Retry failed.</div>
      )}
      {renderResultExtra?.(result)}
    </div>
  );

  const body4 = result ? resultView : confirmSummary;
  const onConfirmStep = isEmail ? step === 4 : step === 3;

  let content;
  if (step === 1) content = step1;
  else if (step === 2) content = step2;
  else if (isEmail && step === 3) content = step3Email;
  else content = body4;

  const primaryDisabled = working || previewing
    || (isEmail && step === 3 && (!preview || !preview.previews?.length));

  return (
    <Modal onClose={onClose} title={locked ? "Thank-you messages" : "Message guests"} maxWidth={680}>
      <div className="modal-body">
        {!result && stepper}
        {error && <div className="msg-notice error" role="alert">{error}</div>}
        {content}
      </div>
      <div className="modal-footer">
        {result ? (
          <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
        ) : (
          <>
            <button type="button" className="btn btn-secondary" onClick={step === 1 ? onClose : back} disabled={working}>
              {step === 1 ? "Cancel" : "Back"}
            </button>
            {onConfirmStep ? (
              <button type="button" className="btn btn-primary" disabled={primaryDisabled || sendable.length === 0} onClick={isEmail ? send : mark}>
                {working ? "Working…" : isEmail ? (needsAnyway ? "Send anyway" : `Send to ${preview?.recipientCount ?? sendable.length}`) : (needsAnyway ? "Mark as sent anyway" : "Mark as sent")}
              </button>
            ) : (
              <button type="button" className="btn btn-primary" disabled={primaryDisabled} onClick={next}>Next</button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

// ── Sender details (events.message_settings) ─────────────────────────────────
// Owner and editor only (the composer is only opened by them; the database rule
// on events decides whether the save is allowed). Blank fields fall back to the
// defaults shown: the event name, the owner's email, and no footer.
function SenderDetails({ eventId, defaults, showToast, onSaved }) {
  const [open,   setOpen]   = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [vals,   setVals]   = useState({ senderName: "", replyTo: "", footerText: "", postalAddress: "" });
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState("");

  useEffect(() => {
    if (!open || loaded) return;
    supabase.from("events").select("message_settings").eq("id", eventId).maybeSingle().then(({ data }) => {
      const s = data?.message_settings || {};
      setVals({ senderName: s.senderName || "", replyTo: s.replyTo || "", footerText: s.footerText || "", postalAddress: s.postalAddress || "" });
      setLoaded(true);
    });
  }, [open, loaded, eventId]);

  const save = async () => {
    setSaving(true); setMsg("");
    const settings = {};
    if (vals.senderName.trim()) settings.senderName = vals.senderName.trim();
    if (vals.replyTo.trim())    settings.replyTo    = vals.replyTo.trim();
    if (vals.footerText.trim()) settings.footerText = vals.footerText.trim();
    if (vals.postalAddress.trim()) settings.postalAddress = vals.postalAddress.trim();
    const { error } = await supabase.from("events").update({ message_settings: settings }).eq("id", eventId);
    setSaving(false);
    if (error) { setMsg("Could not save. Only the event owner and editors can change sender details."); return; }
    showToast?.("Sender details saved");
    setMsg("Saved.");
    onSaved?.();
  };

  return (
    <div className="msg-mail-panel">
      <button type="button" className="msg-link-btn" style={{ alignSelf: "flex-start" }} aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {open ? "Hide sender details" : "Sender details"}
      </button>
      {open && (
        <>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="sd-name">Sender name</label>
            <input id="sd-name" className="form-input" value={vals.senderName} maxLength={100}
              placeholder={defaults.senderName || "Event name"} onChange={e => setVals(v => ({ ...v, senderName: e.target.value }))} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="sd-reply">Reply-to address</label>
            <input id="sd-reply" className="form-input" type="email" value={vals.replyTo}
              placeholder={defaults.replyTo || "Your account email"} onChange={e => setVals(v => ({ ...v, replyTo: e.target.value }))} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="sd-footer">Footer text</label>
            <textarea id="sd-footer" className="form-input" rows={2} value={vals.footerText} maxLength={1000}
              placeholder="None" onChange={e => setVals(v => ({ ...v, footerText: e.target.value }))} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="sd-address">Postal address (optional)</label>
            <textarea id="sd-address" className="form-input" rows={2} value={vals.postalAddress} maxLength={300}
              placeholder="Shown at the bottom of each email when set" onChange={e => setVals(v => ({ ...v, postalAddress: e.target.value }))} />
          </div>
          <div className="msg-mail-row">
            <button type="button" className="btn btn-secondary btn-sm" onClick={save} disabled={saving || !loaded}>{saving ? "Saving…" : "Save sender details"}</button>
            {msg && <span role="status" style={{ fontSize: 12, color: "var(--text-muted)" }}>{msg}</span>}
          </div>
        </>
      )}
    </div>
  );
}
