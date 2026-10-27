// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.9.0 — utils/hebcal.js
// Hebrew date, parashah and Havdalah time for the Overview hero, from the Hebcal REST API
// (https://www.hebcal.com/home/developer-apis). Hebcal's content is CC-BY, so Hebcal is
// credited in the guide and on the About page. The GPL @hebcal/core library is not used.
//
// Everything here is best effort and never blocks the hero: a failed or slow request resolves
// to null, and the hero simply leaves that line out. Successful answers are cached in
// localStorage per event and date, so each is fetched once.
// ─────────────────────────────────────────────────────────────────────────────

const HC = "https://www.hebcal.com";
const TIMEOUT_MS = 6000;

function cacheGet(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
function cacheSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: fetch again next time */ }
}

async function getJson(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; } finally { clearTimeout(t); }
}

const parts = (iso) => iso.split("-").map(Number);

/**
 * { hebrew, english } for the event date. The Hebrew date always; the parashah or festival name
 * added only when the date is a Shabbat or a major festival. null on any failure.
 * hebrew: "פרשת נח, ו׳ חשון תשפ״ז"   english: "Parashat Noach, 6 Cheshvan 5787"
 */
export async function getHebrewInfo(eventId, isoDate) {
  if (!isoDate) return null;
  const key = `simchakit-hebcal:date:${eventId}:${isoDate}`;
  const hit = cacheGet(key);
  if (hit) return hit;
  const [gy, gm, gd] = parts(isoDate);
  const conv = await getJson(`${HC}/converter?cfg=json&gy=${gy}&gm=${gm}&gd=${gd}&g2h=1&strict=1`);
  if (!conv || !conv.heDateParts) return null;
  let hebrew = `${conv.heDateParts.d} ${conv.heDateParts.m} ${conv.heDateParts.y}`;
  let english = `${conv.hd} ${conv.hm} ${conv.hy}`;
  if (Array.isArray(conv.events) && conv.events.length) {
    // Parashat or a major festival: one more call for the Hebrew name.
    const r = await getJson(`${HC}/hebcal?v=1&cfg=json&maj=on&min=off&mod=off&nx=off&ss=off&mf=off&s=on&i=off&start=${isoDate}&end=${isoDate}`);
    const item = r?.items?.find(i => (i.category === "parashat" || i.category === "holiday") && String(i.date).slice(0, 10) === isoDate);
    if (item?.hebrew) { hebrew = `${item.hebrew}, ${hebrew}`; english = `${item.title}, ${english}`; }
  }
  const out = { hebrew, english };
  cacheSet(key, out);
  return out;
}

// The last US ZIP code in a free-text address, or "".
export function zipFromAddress(address) {
  const m = String(address || "").match(/\b\d{5}(?:-\d{4})?\b/g);
  return m ? m[m.length - 1].slice(0, 5) : "";
}

// "2026-10-17T18:14:00-05:00" -> "6:14 PM" (the venue's local time, as Hebcal gives it)
function clock(iso) {
  const m = String(iso).match(/T(\d{2}):(\d{2})/);
  if (!m) return "";
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
}

/**
 * When Shabbat or the festival ends on that date at the venue's ZIP: { havdalah: "6:14 PM",
 * minutes: 1094, candles: "5:49 PM" | null }, or null when there is none (weekday, no ZIP, failure).
 */
export async function getShabbatTimes(eventId, isoDate, zip) {
  if (!isoDate || !zip) return null;
  const key = `simchakit-hebcal:times:${eventId}:${isoDate}:${zip}`;
  const hit = cacheGet(key);
  if (hit) return hit.none ? null : hit;
  const [gy, gm, gd] = parts(isoDate);
  const r = await getJson(`${HC}/shabbat?cfg=json&zip=${zip}&M=on&gy=${gy}&gm=${gm}&gd=${gd}`);
  if (!r || !Array.isArray(r.items)) return null;
  const onDay = (cat) => r.items.find(i => i.category === cat && String(i.date).slice(0, 10) === isoDate);
  const hav = onDay("havdalah");
  const candles = r.items.find(i => i.category === "candles" && String(i.date).slice(0, 10) === isoDate);
  if (!hav) { cacheSet(key, { none: true }); return null; }
  const hm = String(hav.date).match(/T(\d{2}):(\d{2})/);
  const out = { havdalah: clock(hav.date), minutes: Number(hm[1]) * 60 + Number(hm[2]), candles: candles ? clock(candles.date) : null };
  cacheSet(key, out);
  return out;
}
