// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3 — api/notify.js
// Vercel serverless function.
// POST { type, data }
// Sends email notifications to the owner via Gmail SMTP.
// Types: "new_user" | "new_event" | "client_error"
//
// Auth: new_user and new_event need an Authorization: Bearer <access token>, and the identity in
// the email comes from the token (and, for new_event, from the caller's own event row), never from
// the request body. client_error stays open because a crash can happen signed out or on an RSVP
// page; its fields are clipped and it is rate limited per IP (best effort, per serverless instance).
//
// Environment: GMAIL_USER (sender), GMAIL_APP_PASSWORD, NOTIFY_EMAIL_TO (recipient).
// ─────────────────────────────────────────────────────────────────────────────

import nodemailer from "nodemailer";
import { authenticate } from "./auth.js";

const GMAIL_USER    = process.env.GMAIL_USER;
const NOTIFY_TO     = process.env.NOTIFY_EMAIL_TO;
const APP_PASSWORD  = process.env.GMAIL_APP_PASSWORD;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_USER,
    pass: APP_PASSWORD,
  },
});

const ERROR_WINDOW_MS = 60_000;
const ERROR_MAX       = 10;
const errorHits       = new Map();

function tooManyErrors(ip) {
  const now  = Date.now();
  const hits = (errorHits.get(ip) || []).filter((t) => now - t < ERROR_WINDOW_MS);
  hits.push(now);
  if (errorHits.size > 1000) errorHits.clear();
  errorHits.set(ip, hits);
  return hits.length > ERROR_MAX;
}

// Single line (safe for a subject or a header-like field) and clipped.
const line  = (v, max = 300)  => String(v ?? "").replace(/[\r\n]+/g, " ").slice(0, max);
// Multi-line text, clipped.
const block = (v, max = 4000) => String(v ?? "").slice(0, max);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!GMAIL_USER || !NOTIFY_TO || !APP_PASSWORD) {
    console.error("[SimchaKit] notify: GMAIL_USER, NOTIFY_EMAIL_TO and GMAIL_APP_PASSWORD must be set.");
    return res.status(500).json({ error: "Server configuration error." });
  }

  const { type, data } = req.body || {};

  if (!type || !data) {
    return res.status(400).json({ error: "Missing type or data." });
  }

  let subject, text;

  if (type === "new_user") {
    const auth = await authenticate(req);
    if (!auth) return res.status(401).json({ error: "UNAUTHORIZED" });

    subject = `SimchaKit: New user signed up`;
    text = [
      `A new user has signed up for SimchaKit.`,
      ``,
      `Email: ${line(auth.user.email)}`,
      `User ID: ${auth.user.id}`,
      `Time: ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET`,
      ``,
      `View in admin: https://admin.simcha-kit.com`,
    ].join("\n");
  } else if (type === "new_event") {
    const auth = await authenticate(req);
    if (!auth) return res.status(401).json({ error: "UNAUTHORIZED" });

    // Name and type come from the caller's own event row, not from the request body
    const { data: event } = await auth.supabase
      .from("events")
      .select("id, name, type")
      .eq("id", String(data.eventId || ""))
      .eq("owner_id", auth.user.id)
      .maybeSingle();
    if (!event) return res.status(403).json({ error: "Event not found or access denied." });

    subject = `SimchaKit: New event created`;
    text = [
      `A new event has been created on SimchaKit.`,
      ``,
      `Event: ${line(event.name)}`,
      `Type: ${line(event.type)}`,
      `Owner: ${line(auth.user.email, 200) || "unknown"}`,
      `User ID: ${auth.user.id}`,
      `Event ID: ${event.id}`,
      `Time: ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET`,
      ``,
      `View in admin: https://admin.simcha-kit.com`,
    ].join("\n");
  } else if (type === "client_error") {
    const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
    if (tooManyErrors(ip)) return res.status(429).json({ error: "Too many reports." });

    const d = data || {};
    subject = `SimchaKit: Client error (${line(d.source || "unknown", 60)})`;
    text = [
      `A client-side error was caught and reported automatically.`,
      ``,
      `Error ID: ${line(d.errorId || "unknown", 100)}`,
      `Source: ${line(d.source || "unknown", 100)}`,
      `Message: ${line(d.message || "unknown", 500)}`,
      `Path: ${line(d.path || "unknown", 300)}`,
      `Event ID: ${line(d.eventId || "none", 100)}`,
      `Active tab: ${line(d.activeTab || "none", 100)}`,
      `Collaborator role: ${line(d.collaboratorRole || "none", 100)}`,
      `User: ${line(d.userEmail || "unknown", 200)} (${line(d.userId || "no user id", 100)})`,
      `Online: ${d.online === false ? "no" : "yes"}`,
      `Viewport: ${line(d.viewport || "unknown", 50)}`,
      `User agent: ${line(d.userAgent || "unknown", 300)}`,
      `Time: ${line(d.timestamp || new Date().toISOString(), 50)}`,
      ``,
      `Stack:`,
      block(d.stack) || "(no stack available)",
      ``,
      `Component stack:`,
      block(d.componentStack) || "(no component stack available)",
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
