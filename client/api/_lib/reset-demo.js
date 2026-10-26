// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3 — api/reset-demo.js
// Resets demo event to baseline Simpsons data.
// V3 schema: all rows use { id (uuid), event_id, data: jsonb, ...indexed }
// All seed IDs are UUIDs. Cross-references pre-resolved. No duplicate IDs.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

const DEMO_EVENT_ID   = "440a8b9e-e92e-4ad6-b352-41965bd8383b";
const DEMO_USER_EMAIL = "demo@simchakit.app";

const COLLECTIONS = [
  "households", "people", "expenses", "vendors", "tasks",
  "prep", "tables", "gifts", "favors", "ceremony_roles",
  "audit_log", "dayof",
];

import { SEED } from "./demo-seed.js";

// Derive each seeded guest's per-sub-event answers (sectionRsvp, V4.28.0+) from
// the attendance data already in the seed, so the seed does not have to be
// hand-edited and the demo works from every nightly reset:
//   - a guest who has answered (isAttending true) is Yes for each sub-event in
//     their attendingSections or seated in (a seat means they are attending),
//     and No for the other sub-events; with neither, they are left TBD;
//   - a guest who declined (isAttending false) is No for every sub-event;
//   - a guest who has not answered (isAttending null) is left TBD.
// attendingSections stays in the seed data, but the app no longer reads it.
function withSectionRsvp(people, timeline) {
  return people.map(p => {
    if (p.sectionRsvp) return p;
    const rsvp = {};
    if (p.isAttending === true) {
      const yes = new Set([...(p.attendingSections || []), ...Object.keys(p.tableAssignments || {})]);
      if (yes.size > 0) (timeline || []).forEach(e => { rsvp[e.id] = yes.has(e.id) ? "Yes" : "No"; });
    } else if (p.isAttending === false) {
      (timeline || []).forEach(e => { rsvp[e.id] = "No"; });
    }
    return { ...p, sectionRsvp: rsvp };
  });
}

// Wrap records into V3 schema rows: { id, event_id, data, ...indexedCols }
function toRows(eventId, records, indexedCols = {}) {
  const now = new Date().toISOString();
  return records.map(r => {
    const row = { id: r.id, event_id: eventId, data: r, created_at: now, updated_at: now };
    for (const [col, field] of Object.entries(indexedCols)) {
      row[col] = r[field] != null ? r[field] : null;
    }
    return row;
  });
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization || "";
  const token      = authHeader.replace("Bearer ", "");
  const isCron     = req.headers["x-vercel-cron"] === "1";

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!isCron && token !== process.env.ADMIN_RESET_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  try {
    // 1. Find or create demo system user
    const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) throw new Error("Could not list users: " + listErr.message);
    let demoUser = users.find(u => u.email === DEMO_USER_EMAIL);
    if (!demoUser) {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: DEMO_USER_EMAIL, email_confirm: true,
        user_metadata: { name: "SimchaKit Demo" },
      });
      if (createErr) throw new Error("Could not create demo user: " + createErr.message);
      demoUser = created.user;
    }

    // 2. Upsert demo event row
    const { error: eventErr } = await supabase.from("events").upsert({
      id: DEMO_EVENT_ID, owner_id: demoUser.id,
      name: SEED.adminConfig.name, type: SEED.adminConfig.type,
      admin_config: SEED.adminConfig, quick_notes: SEED.quickNotes || "",
      archived: false, updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    if (eventErr) throw new Error("Could not upsert event: " + eventErr.message);

    // 3. Hard-delete all existing collection data for demo event
    for (const col of COLLECTIONS) {
      const { error } = await supabase.from(col).delete().eq("event_id", DEMO_EVENT_ID);
      if (error) console.warn(`[reset-demo] Clear ${col}: ${error.message}`);
    }

    // 4. Insert fresh seed data — all IDs are unique UUIDs, safe to insert
    const inserts = [
      { table: "households",     rows: toRows(DEMO_EVENT_ID, SEED.households,    { group_name: "group", status: "status", out_of_town: "outOfTown" }) },
      { table: "people",         rows: toRows(DEMO_EVENT_ID, withSectionRsvp(SEED.people, SEED.adminConfig.timeline)) },
      { table: "expenses",       rows: toRows(DEMO_EVENT_ID, SEED.expenses)       },
      { table: "vendors",        rows: toRows(DEMO_EVENT_ID, SEED.vendors)        },
      { table: "tasks",          rows: toRows(DEMO_EVENT_ID, SEED.tasks)          },
      { table: "prep",           rows: toRows(DEMO_EVENT_ID, SEED.prep)           },
      { table: "tables",         rows: toRows(DEMO_EVENT_ID, SEED.tables)         },
      { table: "gifts",          rows: toRows(DEMO_EVENT_ID, SEED.gifts)          },
      { table: "favors",         rows: toRows(DEMO_EVENT_ID, SEED.favors)         },
      { table: "ceremony_roles", rows: [{
          id: "6fc82695-9b28-4b3e-8f05-1a8f54368976",
          event_id: DEMO_EVENT_ID,
          data: { roles: SEED.ceremonyRoles },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]
      },
    ];
    for (const { table, rows } of inserts) {
      if (!rows || rows.length === 0) continue;
      const { error } = await supabase.from(table).insert(rows);
      if (error) throw new Error(`Failed to insert ${table}: ${error.message}`);
    }

    // 5. Upsert dayOf document
    if (SEED.dayOf) {
      const { error } = await supabase.from("dayof").upsert({
        event_id: DEMO_EVENT_ID, data: SEED.dayOf,
        updated_at: new Date().toISOString(),
      }, { onConflict: "event_id" });
      if (error) console.warn("[reset-demo] dayof upsert:", error.message);
    }

    console.log("[reset-demo] Reset complete at " + new Date().toISOString());
    return res.status(200).json({
      ok: true, message: "Demo event reset successfully",
      eventId: DEMO_EVENT_ID, timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error("[reset-demo] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
