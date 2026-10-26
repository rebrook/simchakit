// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.4.0 — rsvp/rsvpApi.js
// The guest page's only server access: GET and POST /api/rsvp (V5-R1). The private
// token goes in the X-RSVP-Token header, never an API URL. The guest page never talks
// to Supabase. Every call resolves { ok, status, data, retryAfter?, offline? } and
// never throws, so the page can always show something kind.
// ─────────────────────────────────────────────────────────────────────────────

async function call(method, token, body) {
  try {
    const res = await fetch("/api/rsvp", {
      method,
      headers: { "X-RSVP-Token": token, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
    const data = await res.json().catch(() => ({}));
    const retryAfter = Number(res.headers.get("Retry-After")) || 0;
    return { ok: res.ok, status: res.status, data, retryAfter };
  } catch {
    return { ok: false, status: 0, data: {}, offline: true };
  }
}

export const loadRsvp = (token) => call("GET", token);
export const sendRsvp = (token, body) => call("POST", token, body);

// Plain-language text for a failed send.
export function describeSendError(result) {
  if (result.offline) return "We couldn't reach the server. Check your connection and try again; your answers are still here.";
  if (result.status === 429) {
    const wait = result.retryAfter ? ` Please try again in about ${Math.ceil(result.retryAfter / 60)} minute${result.retryAfter > 90 ? "s" : ""}.` : " Please try again in a little while.";
    return `${result.data?.message || "Too many tries."}${wait}`;
  }
  if (result.status === 400) return result.data?.message || "Some of your answers could not be saved. Please check them and try again.";
  return result.data?.message || "We couldn't save your reply. Please try again; your answers are still here.";
}
