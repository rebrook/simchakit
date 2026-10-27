// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.3.0 — api/_lib/rsvp-submit.js  (POST /api/rsvp)
// Body: { token?, answers: [{ personId, sectionId, status: yes|no|unsure }],
//         details: [{ personId, mealChoice, dietary, kosher }], address, note,
//         newGuests: [{ firstName, lastName, isChild }] }
// (token may be the X-RSVP-Token header instead.)
//
// A reply is validated against a strict schema AND against what the GET view
// returned: unknown people, sub-events or meal choices are rejected (400), lengths
// are capped, and added guests are capped by the event's plus-one rule. It is stored
// as a PENDING proposal in rsvp_replies for the host to review; a resubmission
// supersedes the earlier pending one (the old row is marked rejected with
// superseded_at set, the new row points back through `supersedes`).
//
// autoApply: the accept logic ships with V5-R3. Until then a reply always waits for
// the host, even when rsvp_settings.autoApply is true (see the `autoApplied: false`
// in the response).
// No login: the private token is the credential. No token or personal data is logged.
// ─────────────────────────────────────────────────────────────────────────────

import { isValidRsvpToken } from "../../src-v3/utils/rsvpToken.js";
import {
  getServiceClient, loadByToken, buildView, closedState, readToken, rateLimited, clientIp,
} from "./rsvp-shared.js";

const NOT_FOUND = { error: "NOT_FOUND", message: "This link isn't valid. Please check it or ask your host to resend it." };

const TOP_KEYS     = ["token", "answers", "details", "address", "note", "newGuests"];
const ANSWER_KEYS  = ["personId", "sectionId", "status"];
const DETAIL_KEYS  = ["personId", "mealChoice", "dietary", "kosher"];
const ADDRESS_KEYS = ["address1", "address2", "city", "stateProvince", "postalCode", "country"];
const GUEST_KEYS   = ["firstName", "lastName", "isChild"];
const STATUSES     = ["yes", "no", "unsure"];

const MAX_ANSWERS = 200;
const MAX_DETAILS = 50;
const MAX_NOTE    = 1000;
const MAX_SHORT   = 120;   // address parts, meal choice
const MAX_DIETARY = 300;
const MAX_NAME    = 60;
const SUBMITS_PER_HOUR = 10;

// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const clean = (v) => String(v).replace(CONTROL_RE, "").trim();
const isPlainObject = (v) => v && typeof v === "object" && !Array.isArray(v);
const extraKeys = (obj, allowed) => Object.keys(obj).filter(k => !allowed.includes(k));

// Returns { problems: string[], payload }. `view` is the open GET view for this token.
function validate(body, view) {
  const problems = [];
  const payload = { answers: [], details: [], address: null, note: "", newGuests: [] };
  if (!isPlainObject(body)) return { problems: ["Request body must be a JSON object."], payload };

  const stray = extraKeys(body, TOP_KEYS);
  if (stray.length) problems.push(`Unknown fields: ${stray.join(", ")}.`);

  const personIds  = new Set(view.people.map(p => p.id));
  const sectionIds = new Set(view.sections.map(s => s.id));

  // answers
  const answers = body.answers ?? [];
  if (!Array.isArray(answers) || answers.length > MAX_ANSWERS) problems.push(`answers must be a list of at most ${MAX_ANSWERS}.`);
  else {
    const seen = new Set();
    answers.forEach((a, i) => {
      if (!isPlainObject(a) || extraKeys(a, ANSWER_KEYS).length) return problems.push(`answers[${i}] is not valid.`);
      if (!personIds.has(a.personId))   return problems.push(`answers[${i}].personId is not part of this household.`);
      if (!sectionIds.has(a.sectionId)) return problems.push(`answers[${i}].sectionId is not an event you are invited to.`);
      if (!STATUSES.includes(a.status)) return problems.push(`answers[${i}].status must be yes, no or unsure.`);
      const key = `${a.personId}|${a.sectionId}`;
      if (seen.has(key)) return problems.push(`answers[${i}] repeats an earlier answer.`);
      seen.add(key);
      payload.answers.push({ personId: a.personId, sectionId: a.sectionId, status: a.status });
    });
  }

  // details
  const details = body.details ?? [];
  if (!Array.isArray(details) || details.length > MAX_DETAILS) problems.push(`details must be a list of at most ${MAX_DETAILS}.`);
  else {
    const seen = new Set();
    details.forEach((d, i) => {
      if (!isPlainObject(d) || extraKeys(d, DETAIL_KEYS).length) return problems.push(`details[${i}] is not valid.`);
      if (!personIds.has(d.personId)) return problems.push(`details[${i}].personId is not part of this household.`);
      if (seen.has(d.personId))       return problems.push(`details[${i}] repeats an earlier person.`);
      seen.add(d.personId);
      const out = { personId: d.personId };
      if (d.mealChoice !== undefined) {
        const meal = typeof d.mealChoice === "string" ? clean(d.mealChoice) : null;
        if (meal === null || meal.length > MAX_SHORT || (meal !== "" && !view.mealOptions.includes(meal))) return problems.push(`details[${i}].mealChoice is not one of the meal options.`);
        out.mealChoice = meal;
      }
      if (d.dietary !== undefined) {
        const diet = typeof d.dietary === "string" ? clean(d.dietary) : null;
        if (diet === null || diet.length > MAX_DIETARY) return problems.push(`details[${i}].dietary is too long.`);
        out.dietary = diet;
      }
      if (d.kosher !== undefined) {
        if (typeof d.kosher !== "boolean") return problems.push(`details[${i}].kosher must be true or false.`);
        out.kosher = d.kosher;
      }
      payload.details.push(out);
    });
  }

  // address
  if (body.address !== undefined && body.address !== null) {
    if (!isPlainObject(body.address) || extraKeys(body.address, ADDRESS_KEYS).length) problems.push("address is not valid.");
    else {
      const addr = {};
      for (const k of ADDRESS_KEYS) {
        if (body.address[k] === undefined) continue;
        if (typeof body.address[k] !== "string" || body.address[k].length > MAX_SHORT) { problems.push(`address.${k} is too long.`); continue; }
        addr[k] = clean(body.address[k]);
      }
      payload.address = addr;
    }
  }

  // note
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== "string" || body.note.length > MAX_NOTE) problems.push(`note must be text of at most ${MAX_NOTE} characters.`);
    else payload.note = clean(body.note);
  }

  // newGuests (the plus-one rule)
  const guests = body.newGuests ?? [];
  const cap = view.maxNewGuests;
  if (!Array.isArray(guests)) problems.push("newGuests must be a list.");
  else if (guests.length > cap) {
    problems.push(cap === 0 ? "Adding guests is not available for this event." : `You can add at most ${cap} guest${cap !== 1 ? "s" : ""}.`);
  } else {
    guests.forEach((g, i) => {
      if (!isPlainObject(g) || extraKeys(g, GUEST_KEYS).length) return problems.push(`newGuests[${i}] is not valid.`);
      const first = typeof g.firstName === "string" ? clean(g.firstName) : "";
      const last  = g.lastName === undefined ? "" : (typeof g.lastName === "string" ? clean(g.lastName) : null);
      if (!first || first.length > MAX_NAME) return problems.push(`newGuests[${i}].firstName is required (up to ${MAX_NAME} characters).`);
      if (last === null || last.length > MAX_NAME) return problems.push(`newGuests[${i}].lastName is too long.`);
      if (g.isChild !== undefined && typeof g.isChild !== "boolean") return problems.push(`newGuests[${i}].isChild must be true or false.`);
      payload.newGuests.push({ firstName: first, lastName: last, isChild: g.isChild === true });
    });
  }

  return { problems, payload };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (rateLimited("post-ip", clientIp(req), 20, 60_000)) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "RATE_LIMITED", message: "Too many requests. Please wait a minute and try again." });
  }

  const token = readToken(req);
  if (!isValidRsvpToken(token)) return res.status(404).json(NOT_FOUND);
  if (rateLimited("post-token", token, 10, 60_000)) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "RATE_LIMITED", message: "Too many requests. Please wait a minute and try again." });
  }

  try {
    const supabase = await getServiceClient();
    const ctx = await loadByToken(supabase, token);
    if (!ctx) return res.status(404).json(NOT_FOUND);

    const closed = closedState(ctx);
    if (closed) return res.status(409).json({ error: "CLOSED", ...closed });

    const { problems, payload } = validate(req.body, buildView(ctx));
    if (problems.length) return res.status(400).json({ error: "INVALID_REQUEST", message: "Some of your answers could not be saved.", problems });

    const householdId = ctx.household._rowId;

    // Per-household ceiling (the in-memory limits above are best effort per instance).
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase.from("rsvp_replies")
      .select("id", { count: "exact", head: true }).eq("household_id", householdId).gte("submitted_at", hourAgo);
    if ((count || 0) >= SUBMITS_PER_HOUR) {
      res.setHeader("Retry-After", "600");
      return res.status(429).json({ error: "RATE_LIMITED", message: "You've updated your reply several times already. Please try again in a little while." });
    }

    // Supersede the earlier pending reply, then insert the new one. The partial unique
    // index allows one pending reply per household, so a simultaneous submit retries once.
    let previousId = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data: old } = await supabase.from("rsvp_replies")
        .update({ status: "rejected", superseded_at: new Date().toISOString() })
        .eq("household_id", householdId).eq("status", "pending").select("id").maybeSingle();
      previousId = old?.id || previousId;

      const { data: row, error } = await supabase.from("rsvp_replies")
        .insert({ event_id: ctx.event.id, household_id: householdId, status: "pending", payload, supersedes: previousId })
        .select("id, submitted_at").single();
      if (!error) {
        // A notification-panel entry for the host (best effort; never blocks or fails the guest).
        // Only the household's name goes in it: no answers, no token.
        try {
          await supabase.from("audit_log").insert({
            event_id: ctx.event.id,
            data: { action: "Added", detail: `RSVP reply from ${ctx.household.formalName || "a household"}`, collection: "rsvp", actorId: null, actorName: "A guest" },
          });
        } catch { /* ignore */ }
        return res.status(200).json({ ok: true, submittedAt: row.submitted_at, autoApplied: false });
      }
      if (error.code !== "23505") throw new Error("insert failed");
    }
    throw new Error("could not store reply");
  } catch {
    console.error("[SimchaKit] rsvp-submit: could not store a reply.");
    return res.status(500).json({ error: "SERVER_ERROR", message: "We couldn't save your reply. Please try again in a moment." });
  }
}
