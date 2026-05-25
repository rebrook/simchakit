// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3 — api/cron/lifecycle-emails.js
// Vercel cron function. Runs daily at 15:00 UTC (10am EST / 11am EDT).
// Skips Saturdays (Shabbat).
//
// For each lifecycle day offset, queries Supabase for events whose main event
// date (admin_config -> timeline -> isMainEvent = true -> startDate) matches
// today +/- the offset. Sends the corresponding Brevo transactional email
// for each matching event owner, then sends collaborator emails.
//
// Owner template IDs:
//   -90 days: 5  (90-Day Checkpoint)
//   -60 days: 6  (60-Day Checkpoint)
//   -30 days: 7  (30-Day Countdown)
//    -7 days: 8  (One Week Away)
//    +1 day:  9  (Mazel Tov)
//   +14 days: 10 (Thank-You Nudge)
//   +30 days: 11 (See You Next Simcha)
//
// Collaborator template IDs:
//   -90/-60/-30/-7 days: 5/6/7/8 (same planning checkpoints, Editors only)
//    +1 day:  9  (Mazel Tov, Editors and Viewers)
//   +14 days: 10 (Thank-You Nudge, Editors only)
//   +30 days: 22 (Editor See You Next Simcha, Editors only)
//   +30 days: 24 (Viewer See You Next Simcha, Viewers only)
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

const BREVO_TRANSACTIONAL_URL = "https://api.brevo.com/v3/smtp/email";

const LIFECYCLE_TEMPLATES = [
  { offsetDays:  90, templateId: 5,  label: "90-Day Checkpoint" },
  { offsetDays:  60, templateId: 6,  label: "60-Day Checkpoint" },
  { offsetDays:  30, templateId: 7,  label: "30-Day Countdown"  },
  { offsetDays:   7, templateId: 8,  label: "One Week Away"     },
  { offsetDays:  -1, templateId: 9,  label: "Mazel Tov"         },
  { offsetDays: -14, templateId: 10, label: "Thank-You Nudge"   },
  { offsetDays: -30, templateId: 11, label: "See You Next Simcha" },
];

// Collaborator template mapping per offset.
// editorTemplateId: template to send to editors (null = skip editors)
// viewerTemplateId: template to send to viewers (null = skip viewers)
const COLLABORATOR_TEMPLATES = {
   90: { editorTemplateId: 5,    viewerTemplateId: null },
   60: { editorTemplateId: 6,    viewerTemplateId: null },
   30: { editorTemplateId: 7,    viewerTemplateId: null },
    7: { editorTemplateId: 8,    viewerTemplateId: null },
   -1: { editorTemplateId: 9,    viewerTemplateId: 9    },
  -14: { editorTemplateId: 10,   viewerTemplateId: null },
  -30: { editorTemplateId: 22,   viewerTemplateId: 24   },
};

export default async function handler(req, res) {
  // Verify this is a legitimate Vercel cron request
  const authHeader = req.headers["authorization"];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Skip Saturdays (Shabbat)
  const today = new Date();
  if (today.getUTCDay() === 6) {
    console.log("[SimchaKit] Lifecycle emails skipped: Shabbat (Saturday).");
    return res.status(200).json({ skipped: true, reason: "Shabbat" });
  }

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) {
    console.error("[SimchaKit] BREVO_API_KEY not set.");
    return res.status(500).json({ error: "Brevo API key not configured." });
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const results = [];

  for (const { offsetDays, templateId, label } of LIFECYCLE_TEMPLATES) {
    // Build the target date string for this offset (YYYY-MM-DD)
    const targetDate = new Date(today);
    targetDate.setUTCDate(today.getUTCDate() + offsetDays);
    const targetDateStr = targetDate.toISOString().slice(0, 10);

    // Query Supabase for events whose main event date matches the target date.
    // The main event date lives inside admin_config -> timeline array,
    // in the entry where isMainEvent = true, under the startDate key.
    const { data: events, error } = await supabase.rpc(
      "get_events_by_main_date",
      { target_date: targetDateStr }
    );

    if (error) {
      console.error(`[SimchaKit] DB error for ${label} (${targetDateStr}):`, error.message);
      results.push({ label, targetDate: targetDateStr, error: error.message });
      continue;
    }

    if (!events || events.length === 0) {
      console.log(`[SimchaKit] No events for ${label} on ${targetDateStr}.`);
      results.push({ label, targetDate: targetDateStr, sent: 0 });
      continue;
    }

    let sent = 0;
    let collabSent = 0;

    for (const event of events) {
      if (!event.email || !event.event_name) continue;

      // ── Owner email ───────────────────────────────────────────────────────
      try {
        const response = await fetch(BREVO_TRANSACTIONAL_URL, {
          method: "POST",
          headers: {
            "accept":       "application/json",
            "content-type": "application/json",
            "api-key":      BREVO_API_KEY,
          },
          body: JSON.stringify({
            to:         [{ email: event.email }],
            templateId: templateId,
            params: {
              EVENT_NAME: event.event_name,
              EVENT_TYPE: event.event_type || "",
            },
          }),
        });

        if (response.status === 201) {
          sent++;
        } else {
          const body = await response.text();
          console.error(`[SimchaKit] Brevo error for ${event.email} (${label}):`, body);
        }
      } catch (err) {
        console.error(`[SimchaKit] Send error for ${event.email} (${label}):`, err.message);
      }

      // ── Collaborator emails ───────────────────────────────────────────────
      const collabConfig = COLLABORATOR_TEMPLATES[offsetDays];
      if (!collabConfig) continue;

      const { data: collaborators, error: collabError } = await supabase
        .from("event_collaborators")
        .select("email, role")
        .eq("event_id", event.event_id)
        .not("accepted_at", "is", null);

      if (collabError) {
        console.error(`[SimchaKit] Collab query error for event ${event.event_id} (${label}):`, collabError.message);
        continue;
      }

      for (const collab of (collaborators || [])) {
        if (!collab.email) continue;

        const tplId = collab.role === "editor"
          ? collabConfig.editorTemplateId
          : collabConfig.viewerTemplateId;

        if (!tplId) continue; // this role does not receive this email

        try {
          const response = await fetch(BREVO_TRANSACTIONAL_URL, {
            method: "POST",
            headers: {
              "accept":       "application/json",
              "content-type": "application/json",
              "api-key":      BREVO_API_KEY,
            },
            body: JSON.stringify({
              to:         [{ email: collab.email }],
              templateId: tplId,
              params: {
                EVENT_NAME: event.event_name,
                EVENT_TYPE: event.event_type || "",
              },
            }),
          });

          if (response.status === 201) {
            collabSent++;
          } else {
            const body = await response.text();
            console.error(`[SimchaKit] Brevo collab error for ${collab.email} (${label}):`, body);
          }
        } catch (err) {
          console.error(`[SimchaKit] Collab send error for ${collab.email} (${label}):`, err.message);
        }
      }
    }

    console.log(`[SimchaKit] ${label} (${targetDateStr}): owners ${sent}/${events.length}, collaborators ${collabSent}`);
    results.push({ label, targetDate: targetDateStr, sent, collabSent, total: events.length });
  }

  return res.status(200).json({ ok: true, results });
}
