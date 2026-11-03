// First-touch campaign attribution: remembers where a person came from (campaign tags on the link, or an
// outside referrer host) until they sign up, then stores it on their profile so we can tell which post or
// channel brought them. Best effort and privacy-light: only the tags, the referrer's hostname and the landing
// path are kept, never a full URL, and guest RSVP links (/r/<token>) are skipped.
import { supabase } from "@/lib/supabase.js";

const KEY  = "simchakit.attribution";
const TAGS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"];

const clip = (v) => String(v).slice(0, 60);

export function captureAttribution() {
  try {
    if (window.location.pathname.startsWith("/r/")) return;
    if (localStorage.getItem(KEY)) return;

    const params = new URLSearchParams(window.location.search);
    const found  = {};
    TAGS.forEach((t) => {
      const v = params.get(t);
      if (v) found[t.replace("utm_", "")] = clip(v);
    });

    let referrer = "";
    try { referrer = document.referrer ? new URL(document.referrer).hostname : ""; } catch { /* unparseable referrer */ }
    if (referrer === window.location.hostname) referrer = "";

    if (!Object.keys(found).length && !referrer) return;
    localStorage.setItem(KEY, JSON.stringify({
      ...found,
      ...(referrer ? { referrer: clip(referrer) } : {}),
      landing: window.location.pathname.slice(0, 60),
      at:      new Date().toISOString(),
    }));
  } catch { /* storage blocked: skip */ }
}

// Called once, when a brand-new account signs in.
export async function saveSignupSource(userId) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const { error } = await supabase
      .from("user_profiles")
      .update({ signup_source: JSON.parse(raw) })
      .eq("id", userId);
    if (error) console.warn("[SimchaKit] signup_source save failed:", error.message);
  } catch { /* best effort */ }
}
