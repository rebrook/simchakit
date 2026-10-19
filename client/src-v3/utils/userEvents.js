// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.40.0: utils/userEvents.js
// Shared event-list logic for EventPicker and the sidebar EventSwitcher, so the
// two surfaces cannot drift apart on columns, sort order, row shape, or the
// short date format.
//
// What lives here:
//   - EVENT_LIST_COLUMNS: the events column list both surfaces select
//   - formatEventDate: the picker's short date ("Oct 19, 2026"), moved verbatim
//   - sortOwnedEvents: active first, archived last, then created_at ascending
//   - mapCollaboratedRows: event_collaborators rows -> event objects + role
//   - sortSharedEvents: deterministic order for the switcher only
//   - fetchSwitcherEvents: the two RLS-governed selects the switcher needs
//   - palette hint: lets the shell's loading screen use the target event's
//     palette after a switcher selection, instead of passing through rose
//
// EventPicker keeps its own Promise.all (it also loads purchases and
// collaborator counts in parallel) and imports the pure pieces from here.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "@/lib/supabase.js";

export const EVENT_LIST_COLUMNS =
  "id, name, type, archived, admin_config, created_at, updated_at";

// "2026-10-19" -> "Oct 19, 2026". Returns "" for a falsy value and the input
// unchanged when it is not a three-part date string.
export function formatEventDate(d) {
  if (!d) return "";
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const m = parseInt(parts[1], 10) - 1;
  return months[m] + " " + parseInt(parts[2], 10) + ", " + parts[0];
}

// Main-event start date from an event's admin_config. Matches the picker:
// the entry flagged isMainEvent, with no fallback to the first entry.
export function getMainEventStartDate(adminConfig) {
  const timeline = adminConfig?.timeline || [];
  const mainEntry = timeline.find(t => t.isMainEvent);
  return mainEntry?.startDate || "";
}

// Owned events: active first, archived last, then oldest created first.
export function sortOwnedEvents(rows) {
  return [...(rows || [])].sort((a, b) => {
    if (a.archived !== b.archived) return a.archived ? 1 : -1;
    return new Date(a.created_at) - new Date(b.created_at);
  });
}

// event_collaborators rows (with embedded events) -> event objects carrying
// the collaborator role and inviter details. Rows whose event is not visible
// are dropped.
export function mapCollaboratedRows(rows) {
  return (rows || [])
    .filter(r => r.events)
    .map(r => ({
      ...r.events,
      _collaboratorRole: r.role,
      _invitedByEmail:   r.invited_by_email || null,
      _invitedByName:    r.invited_by_name  || null,
    }));
}

// Deterministic order for shared events: active first, archived last, then
// oldest created first, then id as a final tie-break. The shared query has no
// ORDER BY, so without this the switcher could reshuffle between fetches.
export function sortSharedEvents(list) {
  return [...(list || [])].sort((a, b) => {
    if (!!a.archived !== !!b.archived) return a.archived ? 1 : -1;
    const byCreated = new Date(a.created_at) - new Date(b.created_at);
    if (byCreated !== 0) return byCreated;
    return String(a.id).localeCompare(String(b.id));
  });
}

// Fetch both lists for the switcher. Mirrors the picker's behavior: an error
// on the owned query is a failure; an error on the shared query is treated as
// "no shared events" so the owned list still renders.
export async function fetchSwitcherEvents(userId) {
  const [ownedRes, sharedRes] = await Promise.all([
    supabase
      .from("events")
      .select(EVENT_LIST_COLUMNS)
      .eq("owner_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("event_collaborators")
      .select(`role, event_id, invited_by_email, invited_by_name, events(${EVENT_LIST_COLUMNS})`)
      .eq("user_id", userId)
      .not("accepted_at", "is", null),
  ]);

  if (ownedRes.error) {
    return {
      error:  ownedRes.error.message || "Could not load events.",
      owned:  [],
      shared: [],
    };
  }

  const owned    = sortOwnedEvents(ownedRes.data);
  const ownedIds = new Set(owned.map(e => e.id));
  const shared   = sortSharedEvents(
    mapCollaboratedRows(sharedRes.data).filter(e => !ownedIds.has(e.id))
  );

  return { error: null, owned, shared };
}

// ── Palette hint ─────────────────────────────────────────────────────────────
// Set by the switcher just before it selects an event. AppShell's loading
// screen reads it ONLY when the id matches the event being mounted, and clears
// it as soon as the load finishes (success or failure). Picker selections and
// page reloads never set it, so they behave exactly as before.
let paletteHint = null;

export function setPaletteHint(eventId, adminConfig) {
  const theme = adminConfig?.theme || {};
  paletteHint = {
    eventId,
    palette:     theme.palette     || "rose",
    customColor: theme.customColor || "",
  };
}

export function getPaletteHint(eventId) {
  return paletteHint && paletteHint.eventId === eventId ? paletteHint : null;
}

export function clearPaletteHint() {
  paletteHint = null;
}
