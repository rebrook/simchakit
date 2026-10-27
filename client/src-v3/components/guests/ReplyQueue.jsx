// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.5.0 — components/guests/ReplyQueue.jsx
// The host's review queue for RSVP replies. A reply is a PROPOSAL: it never touches the
// guest list until the host accepts it, and every accept or reject can be undone for 8
// seconds. Each reply is shown as a diff against the current guest data, so nothing
// changes unseen. Replies that add someone who is not on the list are "Needs a look"
// and are left out of Accept all.
//
// Only owners and editors can act (viewers read; archived events are read-only). The
// rules for what an accept writes live in utils/rsvpApply.js. Accepting claims the reply
// first (only if it is still pending, so two editors cannot apply it twice), then saves
// people and the household, and rolls everything back if a save fails.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase.js";
import { writeAuditLog } from "@/utils/auditLog.js";
import { buildReplyDiff, planApply, planRestore, summaryChip, STATUS_LABEL } from "@/utils/rsvpApply.js";
import { shortDate } from "@/utils/messageStatus.js";

const GLYPH = { yes: "✓", no: "✕", unsure: "?" };
const answerText = (v) => (v ? `${GLYPH[v]} ${STATUS_LABEL[v]}` : "○ No answer");

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function ReplyQueue({
  eventId, households, people, timeline, replies, canAct, savePerson, saveHousehold, removePerson,
  onUndoable, showToast,
}) {
  const [openId, setOpenId]       = useState(null);
  const [rejecting, setRejecting] = useState(null);   // reply id with the reject form open
  const [reason, setReason]       = useState("");
  const [busy, setBusy]           = useState(false);
  const [notice, setNotice]       = useState("");

  // Saves update these items in the parent; actions read the latest through refs.
  const latest = useRef({ households, people });
  latest.current = { households, people };

  const sections = useMemo(() => (timeline || []).map(t => ({ id: t.id, title: t.title || "Sub-event" })), [timeline]);
  const hhByRow = useMemo(() => new Map(households.map(h => [h._rowId, h])), [households]);

  const entries = useMemo(() => replies.pending.map(reply => {
    const household = hhByRow.get(reply.household_id);
    if (!household) return { reply, household: null, diff: null };
    const diff = buildReplyDiff(reply, { household, people, sections });
    const previous = replies.acceptedByHousehold.get(reply.household_id);
    return { reply, household, diff, previous };
  }), [replies.pending, replies.acceptedByHousehold, hhByRow, people, sections]);

  const acceptable = entries.filter(e => e.household && !e.diff.needsLook);

  // ── Writes ──────────────────────────────────────────────────────────────────
  const userId = async () => (await supabase.auth.getUser()).data?.user?.id || null;
  const setReplyState = (id, patch, onlyIf) => {
    let q = supabase.from("rsvp_replies").update(patch).eq("id", id);
    if (onlyIf) q = q.eq("status", onlyIf);
    return q.select("id");
  };
  const failed = (res) => !res || res.error || res.conflict;

  // Puts the touched fields back exactly as they were, removes people the accept created,
  // and returns the reply to pending. Used by Undo and by the rollback of a failed accept.
  // `fresh` holds the newest copy of rows this same accept just saved (the parent's state may not
  // have re-rendered yet), so a rollback never saves against a stale version.
  const restore = async (reply, snapshot, fresh = new Map()) => {
    const { households: curHouseholds, people: curPeople } = latest.current;
    const people = curPeople.map(p => fresh.get(p._rowId) || p);
    const household = fresh.get(reply.household_id) || curHouseholds.find(h => h._rowId === reply.household_id);
    const plan = planRestore(snapshot, { household, people });
    for (const p of plan.peopleToSave) await savePerson(p);
    if (plan.householdToSave) await saveHousehold(plan.householdToSave);
    for (const rowId of plan.peopleToRemove) await removePerson(rowId);
    await setReplyState(reply.id, { status: "pending", applied_snapshot: null, reviewed_by: null, reviewed_at: null, reject_reason: null });
  };

  const accept = async (entry) => {
    const { reply, household } = entry;
    const ctx = { household, people: latest.current.people, sections };
    const plan = planApply(reply, ctx);
    const snapshot = plan.snapshot;
    const me = await userId();

    // 1. Claim: only a reply that is still pending can be accepted (guards a second editor).
    const claim = await setReplyState(reply.id, {
      status: "accepted", applied_snapshot: snapshot, reviewed_by: me, reviewed_at: new Date().toISOString(),
    }, "pending");
    if (claim.error || !claim.data?.length) return { ok: false, reason: "changed" };

    const fresh = new Map();   // rowId -> newest saved item
    const keep = (res) => { if (res?.item) fresh.set(res.item._rowId, res.item); return res; };
    try {
      // 2. New people first, so their ids are known for Undo.
      for (const np of plan.newPeople) {
        const res = keep(await savePerson(np));
        if (failed(res)) throw new Error("create person");
        snapshot.created.push(res.item._rowId);
      }
      // 3. People the reply touched (skip any that did not actually change).
      for (const { rowId, item } of plan.peopleAfter) {
        const before = latest.current.people.find(p => p._rowId === rowId);
        if (before && same(before, item)) continue;
        if (failed(keep(await savePerson(item)))) throw new Error("save person");
      }
      // 4. The household.
      if (plan.householdAfter && failed(keep(await saveHousehold(plan.householdAfter)))) throw new Error("save household");
      if (snapshot.created.length) await setReplyState(reply.id, { applied_snapshot: snapshot });
    } catch {
      await restore(reply, snapshot, fresh);
      return { ok: false, reason: "failed" };
    }
    writeAuditLog(eventId, "households", "Updated", `Accepted RSVP reply — ${household.formalName || "Household"}`);
    return { ok: true, undo: () => restore(reply, snapshot) };
  };

  const explain = (r) => (r.reason === "changed"
    ? "Someone else has already handled one of these replies. The list has been refreshed."
    : "Something went wrong while saving, so nothing was changed. Please try again.");

  const doAccept = async (list) => {
    if (!canAct || busy || list.length === 0) return;
    setBusy(true); setNotice("");
    const undos = [];
    let problem = null;
    for (const entry of list) {
      const res = await accept(entry);
      if (res.ok) undos.push(res.undo); else { problem = res; break; }
    }
    await replies.reload();
    setBusy(false);
    if (problem) setNotice(explain(problem));
    if (undos.length) {
      const n = undos.length;
      onUndoable({
        message: n === 1 ? `Accepted ${list[0].household.formalName || "reply"}` : `Accepted ${n} replies`,
        onUndo: async () => { for (const u of [...undos].reverse()) await u(); await replies.reload(); },
      });
    }
    const next = entries.find(e => !list.includes(e) && e.household);
    setOpenId(next ? next.reply.id : null);
  };

  const doReject = async (entry) => {
    if (!canAct || busy) return;
    setBusy(true); setNotice("");
    const me = await userId();
    const res = await setReplyState(entry.reply.id, {
      status: "rejected", reject_reason: reason.trim() || null, reviewed_by: me, reviewed_at: new Date().toISOString(),
    }, "pending");
    await replies.reload();
    setBusy(false); setRejecting(null); setReason("");
    if (res.error || !res.data?.length) { setNotice(explain({ reason: "changed" })); return; }
    writeAuditLog(eventId, "households", "Updated", `Rejected RSVP reply — ${entry.household?.formalName || "Household"}`);
    onUndoable({
      message: `Rejected ${entry.household?.formalName || "reply"}`,
      onUndo: async () => { await setReplyState(entry.reply.id, { status: "pending", reject_reason: null, reviewed_by: null, reviewed_at: null }); await replies.reload(); },
    });
  };

  // ── Rendering ───────────────────────────────────────────────────────────────
  if (replies.loading) return <div className="rq-empty">Loading replies…</div>;
  if (replies.error) {
    return <div className="msg-notice error" role="alert">Replies could not be loaded. If this is a new setup, the V5.1-R1 and V5.1-R3 database updates may not have been applied yet.</div>;
  }
  if (entries.length === 0) {
    return (
      <div className="rq-empty">
        <div className="rq-empty-title">No new replies</div>
        <div>When a guest replies from their private link, it will appear here for you to review.</div>
      </div>
    );
  }

  return (
    <div className="rq">
      <div className="rq-head">
        <h2 className="rq-count">{entries.length} new repl{entries.length === 1 ? "y" : "ies"}</h2>
        {canAct ? (
          <div className="rq-head-actions">
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setOpenId(entries.find(e => e.household)?.reply.id || null)}>Review each</button>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy || acceptable.length === 0} onClick={() => doAccept(acceptable)}>
              {busy ? "Working…" : `Accept all ${acceptable.length}`}
            </button>
          </div>
        ) : <span className="rq-readonly">Only the event owner and editors can review replies.</span>}
      </div>
      {canAct && entries.some(e => e.diff?.needsLook) && (
        <p className="rq-hint">Replies that add someone not on your list are marked Needs a look and are not included in Accept all.</p>
      )}
      {notice && <div className="msg-notice error" role="alert">{notice}</div>}

      <div className="rq-list">
        {entries.map(({ reply, household, diff, previous }) => {
          if (!household) {
            return (
              <div key={reply.id} className="rq-row">
                <div className="rq-name">A household that was removed</div>
                <div className="rq-summary">This reply is for a household that is no longer on your list.</div>
                {canAct && <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setRejecting(reply.id); setOpenId(reply.id); }}>Reject</button>}
              </div>
            );
          }
          const chip = summaryChip(diff);
          const isOpen = openId === reply.id;
          return (
            <div key={reply.id} className="rq-item">
              <div className="rq-row">
                <div className="rq-name">
                  {household.formalName || "Household"}
                  <span className="rq-when">{shortDate(reply.submitted_at)}</span>
                </div>
                <div className="rq-chips">
                  <span className={`rq-chip ${chip.tone}`}><span aria-hidden="true">{chip.shape}</span> {chip.label}</span>
                  {previous && <span className="rq-chip update"><span aria-hidden="true">↻</span> Updated reply</span>}
                </div>
                <div className="rq-summary">{rowSummary(diff)}</div>
                <div className="rq-actions">
                  {canAct && !diff.needsLook && !isOpen && (
                    <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => doAccept([{ reply, household, diff }])}>Accept</button>
                  )}
                  <button type="button" className={`btn btn-sm ${diff.needsLook ? "btn-primary" : "btn-ghost"}`} aria-expanded={isOpen}
                    onClick={() => setOpenId(isOpen ? null : reply.id)}>{isOpen ? "Hide" : "Review"}</button>
                </div>
              </div>

              {isOpen && (
                <div className="rq-detail">
                  <DiffView diff={diff} previous={previous} />
                  {canAct && rejecting !== reply.id && (
                    <div className="rq-detail-actions">
                      <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => doAccept([{ reply, household, diff }])}>
                        {diff.needsLook ? "Accept and add the new guest" : "Accept"}
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => { setRejecting(reply.id); setReason(""); }}>Reject</button>
                    </div>
                  )}
                  {canAct && rejecting === reply.id && (
                    <div className="rq-reject">
                      <label className="form-label" htmlFor={`rq-reason-${reply.id}`}>Reason (optional, only you see this)</label>
                      <input id={`rq-reason-${reply.id}`} className="form-input" type="text" maxLength={300} value={reason} onChange={e => setReason(e.target.value)} />
                      <div className="rq-detail-actions">
                        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => doReject({ reply, household })}>Reject this reply</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRejecting(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function rowSummary(diff) {
  if (diff.declined && diff.note) return `“${diff.note}”`;
  if (diff.needsLook) return `Adds ${diff.newGuests.length === 1 ? "a guest" : `${diff.newGuests.length} guests`} not on the list`;
  const parts = [];
  if (diff.answers.length) parts.push(`${diff.answers.length} answer${diff.answers.length !== 1 ? "s" : ""} changed`);
  const meals = diff.details.filter(d => d.field === "Meal").length;
  if (meals) parts.push(`${meals} meal choice${meals !== 1 ? "s" : ""}`);
  if (diff.address.state === "changed") parts.push("Address updated"); else parts.push("Address confirmed");
  if (diff.note) parts.push("Has a note");
  return parts.join(" · ");
}

// The full diff for one reply: every change in words, with the old and new value.
function DiffView({ diff, previous }) {
  return (
    <div className="rq-diff">
      {previous && <p className="rq-hint">This household replied before (accepted {shortDate(previous.reviewed_at || previous.submitted_at)}). Below is how this new reply differs from what is on your list now.</p>}
      {diff.statusChange && <DiffLine label="RSVP status" from={diff.statusChange.from || "none"} to={diff.statusChange.to} />}
      {diff.answers.length > 0 && (
        <section>
          <h3 className="rq-diff-title">Answers</h3>
          {diff.answers.map(a => <DiffLine key={`${a.personId}-${a.sectionId}`} label={`${a.name} · ${a.section}`} from={answerText(a.from)} to={answerText(a.to)} />)}
          {diff.unchangedAnswers > 0 && <p className="rq-muted">{diff.unchangedAnswers} other answer{diff.unchangedAnswers !== 1 ? "s" : ""} unchanged.</p>}
        </section>
      )}
      {diff.answers.length === 0 && <p className="rq-muted">Their answers match what is on your list.</p>}
      {diff.details.length > 0 && (
        <section>
          <h3 className="rq-diff-title">Meals and details</h3>
          {diff.details.map((d, i) => <DiffLine key={i} label={`${d.name} · ${d.field}`} from={d.from || "none"} to={d.to || "none"} />)}
        </section>
      )}
      <section>
        <h3 className="rq-diff-title">Address</h3>
        {diff.address.state === "changed"
          ? diff.address.changes.map(c => <DiffLine key={c.field} label={c.field} from={c.from || "blank"} to={c.to || "blank"} />)
          : <p className="rq-muted">✓ Confirmed as correct.</p>}
      </section>
      {diff.note && <section><h3 className="rq-diff-title">Note to you</h3><p className="rq-note">“{diff.note}”</p><p className="rq-muted">Accepting saves this note in the household's contact log.</p></section>}
      {diff.newGuests.length > 0 && (
        <section>
          <h3 className="rq-diff-title">New guests to add</h3>
          <ul className="rq-newguests">{diff.newGuests.map((g, i) => <li key={i}><span aria-hidden="true">▲</span> {g.firstName} {g.lastName}{g.isChild ? " (child)" : ""}</li>)}</ul>
        </section>
      )}
      {diff.missingPeople.length > 0 && <p className="rq-muted">Some answers are for people no longer in this household and will be skipped.</p>}
    </div>
  );
}

function DiffLine({ label, from, to }) {
  return (
    <div className="rq-diffline">
      <span className="rq-diff-label">{label}</span>
      <span className="rq-diff-values"><span className="rq-from">{from}</span> <span aria-hidden="true">→</span><span className="sr-only"> changes to </span> <strong>{to}</strong></span>
    </div>
  );
}
