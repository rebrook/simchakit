// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3 — api/cron/lifecycle-emails.js
// Vercel cron function. Runs daily at 15:00 UTC (10am EST / 11am EDT).
// Skips Saturdays (Shabbat).
//
// For each lifecycle day offset, queries Supabase for events whose main event
// date (admin_config -> timeline -> isMainEvent = true -> startDate) matches
// today +/- the offset. Sends the corresponding Brevo transactional email
// for each matching event.
//
// Template IDs:
//   -90 days: 5  (90-Day Checkpoint)
//   -60 days: 6  (60-Day Checkpoint)
//   -30 days: 7  (30-Day Countdown)
//    -7 days: 8  (One Week Away)
//    +1 day:  9  (Mazel Tov)
//   +14 days: 10 (Thank-You Nudge)
//   +30 days: 11 (See You Next Simcha)
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
    for (const event of events) {
      if (!event.email || !event.event_name) continue;

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
    }

    console.log(`[SimchaKit] ${label} (${targetDateStr}): sent ${sent}/${events.length}`);
    results.push({ label, targetDate: targetDateStr, sent, total: events.length });
  }

  return res.status(200).json({ ok: true, results });
}
