// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.2.0 — api/_lib/email-shell.js
// The one layout every guest email goes out in (save the date, invitation, RSVP
// reminder, thank-you, custom), for the real send, the dry_run preview and the
// test send alike. A plain module, not a serverless function.
//
// Matches the SimchaKit welcome email (the same family as the collaborator invite
// and lifecycle emails): cream page, cream card with rounded corners and a soft
// shadow, Georgia serif, a rule under the header, a navy/accent button, a quiet
// footer. Differences are deliberate:
//   * the header carries the EVENT (logo, name, date) and its accent color, not
//     the SimchaKit logo;
//   * every text color is checked for contrast (4.5:1 for text, button text
//     against the button); an accent that is too light is darkened for text and
//     buttons only. The card stays light so every palette reads in light and dark
//     mail clients (color-scheme is pinned to light);
//   * footer text is darker than the welcome email's grays, to reach 4.5:1.
//
// Palettes come read-only from the app's own constants (src-v3/constants/theme.js
// and utils/color.js, both dependency-free), so a palette change is picked up here
// automatically. Table layout, inline styles, single column, nothing remote
// except the host's own logo image and links.
// ─────────────────────────────────────────────────────────────────────────────

import { PALETTES } from "../../src-v3/constants/theme.js";
import { deriveCustomPalette } from "../../src-v3/utils/color.js";

const PAGE_BG   = "#f4f0e8";
const CARD_BG   = "#fdfaf4";
const FOOTER_BG = "#f7f3ea";
const TEXT      = "#1a1a1a";
const HEADING   = "#0d1b2e";
const MUTED     = "#5c5238";   // 6.6:1 on FOOTER_BG
const RULE      = "#e5dece";

const FONT = "Georgia,'Times New Roman',serif";
const ABOUT_URL = "https://about.simcha-kit.com";

const RSVP_BUTTON_LABEL = {
  invitation:    "Reply to the invitation",
  rsvp_reminder: "Reply to the invitation",
};

const HEX_RE = /^#[0-9a-f]{6}$/i;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ── Color helpers (WCAG relative luminance and contrast ratio) ────────────────
function channel(hex, i) {
  const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
const luminance = (hex) => 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
function mixToward(hex, target, t) {
  const out = [0, 1, 2].map(i => {
    const from = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
    const to   = parseInt(target.slice(1 + i * 2, 3 + i * 2), 16);
    return Math.round(from + (to - from) * t).toString(16).padStart(2, "0");
  });
  return `#${out.join("")}`;
}
// Darkens `hex` (never lightens) until it reaches `min` contrast against `bg`.
function darkenUntil(hex, bg, min) {
  let c = hex;
  for (let i = 0; i < 40 && contrast(c, bg) < min; i++) c = mixToward(c, "#000000", 0.08);
  return c;
}

// The event's accent as a hex, from admin_config.theme (same fields ThemeProvider reads).
function resolveAccent(theme) {
  const t = theme && typeof theme === "object" ? theme : {};
  if (t.palette === "custom" && HEX_RE.test(String(t.customColor || ""))) {
    const lm = deriveCustomPalette(t.customColor).light;
    if (HEX_RE.test(lm?.accent || "")) return lm.accent;
  }
  const p = PALETTES[t.palette] || PALETTES.rose;
  return HEX_RE.test(p.accent) ? p.accent : "#c4637a";
}

const safeHttpsUrl = (u) => (/^https:\/\/[^\s"'<>]+$/i.test(String(u || "").trim()) ? String(u).trim() : "");

// ── Render ────────────────────────────────────────────────────────────────────
// bodyText: the merged message as plain text (this function escapes it).
// Returns { html, text }.
export function renderGuestEmail({
  kind, subject, bodyText, rsvpUrl = "",
  eventName, eventDate, logoUrl, theme,
  senderName, footerText = "", postalAddress = "", unsubscribeUrl,
}) {
  const accent      = resolveAccent(theme);
  const accentRule  = contrast(accent, CARD_BG) >= 3 ? accent : darkenUntil(accent, CARD_BG, 3);
  const linkOnCard  = darkenUntil(accent, CARD_BG, 4.5);
  const linkOnFoot  = darkenUntil(accent, FOOTER_BG, 4.5);
  const buttonBg    = darkenUntil(accent, "#ffffff", 4.5);

  const message = String(bodyText || "").replace(/\r\n?/g, "\n").trim();
  const paragraphs = message.split(/\n{2,}/).map(p =>
    `<p style="margin:0 0 18px;font-family:${FONT};font-size:16px;line-height:1.7;color:${TEXT};text-align:left;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`
  ).join("");

  const logo = safeHttpsUrl(logoUrl);
  const logoHtml = logo
    ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(eventName)}" style="display:block;margin:0 auto 14px;max-height:120px;max-width:240px;width:auto;height:auto;border:0;">`
    : "";
  const dateHtml = eventDate
    ? `<p style="margin:6px 0 0;font-family:${FONT};font-size:14px;font-style:italic;color:${MUTED};line-height:1.5;">${escapeHtml(eventDate)}</p>`
    : "";

  const rsvp = safeHttpsUrl(rsvpUrl);
  const buttonLabel = RSVP_BUTTON_LABEL[kind] || "Open the link";
  const rsvpHtml = rsvp ? `
              <table cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 6px;">
                <tr><td style="background-color:${buttonBg};border-radius:6px;">
                  <a href="${escapeHtml(rsvp)}" style="display:inline-block;padding:14px 32px;font-family:${FONT};font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">${escapeHtml(buttonLabel)}</a>
                </td></tr>
              </table>
              <p style="margin:0 0 18px;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};word-break:break-all;">
                Or open this link: <a href="${escapeHtml(rsvp)}" style="color:${linkOnCard};text-decoration:underline;">${escapeHtml(rsvp)}</a>
              </p>` : "";

  const sender = String(senderName || eventName || "your host").trim();
  const aboutLink = `${ABOUT_URL}?utm_source=guest-email&utm_medium=email&utm_campaign=${encodeURIComponent(kind || "guest")}`;

  const footerTextHtml = footerText
    ? `<p style="margin:0 0 8px;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};">${escapeHtml(footerText).replace(/\r?\n/g, "<br>")}</p>` : "";
  const addressHtml = postalAddress
    ? `<p style="margin:0 0 8px;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};">${escapeHtml(postalAddress).replace(/\r?\n/g, "<br>")}</p>` : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>${escapeHtml(subject || eventName)}</title>
  <style>
    @media only screen and (max-width: 480px) {
      .sk-pad { padding-left: 24px !important; padding-right: 24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${PAGE_BG};font-family:${FONT};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE_BG};">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:${CARD_BG};border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(13,27,46,0.10);">

          <tr>
            <td class="sk-pad" align="center" style="padding:32px 48px 22px;border-bottom:2px solid ${accentRule};">
              ${logoHtml}<p style="margin:0;font-family:${FONT};font-size:22px;line-height:1.3;color:${HEADING};font-weight:600;">${escapeHtml(eventName)}</p>${dateHtml}
            </td>
          </tr>

          <tr>
            <td class="sk-pad" style="padding:32px 48px 20px;">
              ${paragraphs}${rsvpHtml}
            </td>
          </tr>

          <tr>
            <td class="sk-pad" style="padding:0 48px;"><hr style="border:none;border-top:1px solid ${RULE};margin:0;"></td>
          </tr>

          <tr>
            <td class="sk-pad" style="padding:20px 48px 28px;background-color:${FOOTER_BG};">
              <p style="margin:0 0 10px;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};">
                Sent by ${escapeHtml(sender)} using SimchaKit, the planner for simchas and celebrations.
                <a href="${escapeHtml(aboutLink)}" style="color:${linkOnFoot};text-decoration:underline;">Planning your own event? Learn more</a>
              </p>
              ${footerTextHtml}${addressHtml}
              <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">
                You are receiving this because ${escapeHtml(sender)} included you in ${escapeHtml(eventName)}.
                <a href="${escapeHtml(unsubscribeUrl)}" style="color:${linkOnFoot};text-decoration:underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textParts = [message];
  if (rsvp) textParts.push(`${buttonLabel}: ${rsvp}`);
  textParts.push(`--\nSent by ${sender} using SimchaKit, the planner for simchas and celebrations. Planning your own event? ${aboutLink}`);
  if (footerText)    textParts.push(String(footerText));
  if (postalAddress) textParts.push(String(postalAddress));
  textParts.push(`You are receiving this because ${sender} included you in ${eventName}.\nUnsubscribe: ${unsubscribeUrl}`);

  return { html, text: textParts.join("\n\n") };
}
