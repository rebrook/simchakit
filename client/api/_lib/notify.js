// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3 — api/notify.js
// Vercel serverless function.
// POST { type, data }
// Sends email notifications to rebrook@me.com via Gmail SMTP.
// Types: "new_user" | "new_event" | "client_error"
// ─────────────────────────────────────────────────────────────────────────────

import nodemailer from "nodemailer";

const GMAIL_USER    = "rebrook@gmail.com";
const NOTIFY_TO     = "rebrook@me.com";
const APP_PASSWORD  = process.env.GMAIL_APP_PASSWORD;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_USER,
    pass: APP_PASSWORD,
  },
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { type, data } = req.body || {};

  if (!type || !data) {
    return res.status(400).json({ error: "Missing type or data." });
  }

  let subject, text;

  if (type === "new_user") {
    subject = `SimchaKit: New user signed up`;
    text = [
      `A new user has signed up for SimchaKit.`,
      ``,
      `Email: ${data.email}`,
      `User ID: ${data.userId}`,
      `Time: ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET`,
      ``,
      `View in admin: https://admin.simcha-kit.com`,
    ].join("\n");
  } else if (type === "new_event") {
    // Look up user email from Supabase
    let userEmail = data.email || "unknown";
    if (!userEmail || userEmail === "unknown") {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("email")
        .eq("id", data.userId)
        .single();
      userEmail = profile?.email || "unknown";
    }

    subject = `SimchaKit: New event created`;
    text = [
      `A new event has been created on SimchaKit.`,
      ``,
      `Event: ${data.eventName}`,
      `Type: ${data.eventType}`,
      `Owner: ${userEmail}`,
      `User ID: ${data.userId}`,
      `Event ID: ${data.eventId}`,
      `Time: ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET`,
      ``,
      `View in admin: https://admin.simcha-kit.com`,
    ].join("\n");
  } else if (type === "client_error") {
    const d = data || {};
    subject = `SimchaKit: Client error (${d.source || "unknown"})`;
    text = [
      `A client-side error was caught and reported automatically.`,
      ``,
      `Error ID: ${d.errorId || "unknown"}`,
      `Source: ${d.source || "unknown"}`,
      `Message: ${d.message || "unknown"}`,
      `Path: ${d.path || "unknown"}`,
      `Event ID: ${d.eventId || "none"}`,
      `Active tab: ${d.activeTab || "none"}`,
      `Collaborator role: ${d.collaboratorRole || "none"}`,
      `User: ${d.userEmail || "unknown"} (${d.userId || "no user id"})`,
      `Online: ${d.online === false ? "no" : "yes"}`,
      `Viewport: ${d.viewport || "unknown"}`,
      `User agent: ${d.userAgent || "unknown"}`,
      `Time: ${d.timestamp || new Date().toISOString()}`,
      ``,
      `Stack:`,
      d.stack || "(no stack available)",
      ``,
      `Component stack:`,
      d.componentStack || "(no component stack available)",
      ``,
      `This error was also logged to the client_errors table for later reference.`,
    ].join("\n");
  } else {
    return res.status(400).json({ error: "Unknown notification type." });
  }

  try {
    await transporter.sendMail({
      from:    `"SimchaKit" <${GMAIL_USER}>`,
      to:      NOTIFY_TO,
      subject,
      text,
    });
    return res.status(200).json({ sent: true });
  } catch (err) {
    console.error("[SimchaKit] Notify email failed:", err.message);
    return res.status(500).json({ error: "Failed to send notification." });
  }
}
