// What's new: small host-only release notes (public/whats-new/*.json), the per-account "last seen
// release" (user_profiles.last_seen_release), and the one-time New pill. Nothing here fetches the old
// 690KB changelog. The newest release id sorts last, so "unseen" is a plain string comparison.
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase.js";
import { isNewFeature, markFeatureSeen } from "@/constants/newFeatures.js";

const cache = new Map();
export function loadJson(name, { fresh = false } = {}) {
  if (!fresh && cache.has(name)) return cache.get(name);
  const p = fetch(`/whats-new/${name}.json`)
    .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
    .catch(err => { cache.delete(name); throw err; });
  cache.set(name, p);
  return p;
}

const newest = (a, b) => (a.id < b.id ? 1 : -1);
export const isUnseen = (entry, lastSeen) => !lastSeen || entry.id > lastSeen;
export const unseenHighlights = (index, lastSeen) =>
  (index?.highlights || []).filter(e => isUnseen(e, lastSeen)).sort(newest).slice(0, 3);

// The highlights to show (at most three) and the other unseen host entries, read from the month
// files between the last seen month and now (at most the latest two when nothing was ever seen).
export async function loadUnseen(index, lastSeen) {
  if (lastSeen && (!index?.latestRelease || lastSeen >= index.latestRelease)) return { highlights: [], rest: [] };
  const highlights = unseenHighlights(index, lastSeen);
  const months = (index?.months || []).map(m => m.month);
  const from = lastSeen ? months.indexOf(lastSeen.slice(0, 7)) : 1;
  const wanted = months.slice(0, from < 0 ? months.length : Math.min(from + 1, 3));
  const files = await Promise.all(wanted.map(m => loadJson(m)));
  const shown = new Set(highlights.map(h => h.id));
  const rest = files.flatMap(f => f.entries).filter(e => isUnseen(e, lastSeen) && !shown.has(e.id)).sort(newest);
  return { highlights, rest };
}

// Account state: index, last seen release, a dot count, and a write that clears the dot everywhere.
// `last` is undefined until loaded, null when the person has never opened What's new.
export function useWhatsNew({ session, isDemoMode }) {
  const userId = session?.user?.id;
  const [index, setIndex] = useState(null);
  const [last, setLast] = useState(undefined);
  const [saved, setSaved] = useState(!isDemoMode);   // false: the column is unreadable, so nothing is tracked

  useEffect(() => { loadJson("index").then(setIndex).catch(() => {}); }, []);

  useEffect(() => {
    if (isDemoMode || !userId) { setLast(null); setSaved(false); return; }
    let live = true;
    supabase.from("user_profiles").select("last_seen_release").eq("id", userId).single()
      .then(({ data, error }) => {
        if (!live) return;
        if (error) { setSaved(false); setLast(null); return; }
        setSaved(true);
        setLast(data?.last_seen_release ?? null);
      });
    return () => { live = false; };
  }, [userId, isDemoMode]);

  const markSeen = useCallback((release = index?.latestRelease) => {
    if (!release) return;
    setLast(prev => (prev && prev >= release ? prev : release));
    if (!saved || !userId) return;
    supabase.from("user_profiles").update({ last_seen_release: release, updated_at: new Date().toISOString() }).eq("id", userId)
      .then(({ error }) => { if (error) console.warn("[SimchaKit] last_seen_release save failed:", error.message); });
  }, [index, saved, userId]);

  // A brand-new account starts at the current release so it is never greeted by old news.
  useEffect(() => {
    if (!saved || last !== null || !index?.latestRelease || !session?.user?.created_at) return;
    if (Date.now() - new Date(session.user.created_at).getTime() < 864e5) markSeen(index.latestRelease);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, last, index]);

  const unseen = saved && last !== undefined && index ? unseenHighlights(index, last) : [];
  return { index, last, unseenCount: unseen.length, hasUnseen: unseen.length > 0, markSeen, tracked: saved };
}

// One-time "New" pill on a feature (constants/newFeatures.js). Shown 14 days or until opened.
export function useNewFeature(key) {
  const [isNew, setIsNew] = useState(() => isNewFeature(key));
  const markSeen = useCallback(() => { if (isNew) { markFeatureSeen(key); setIsNew(false); } }, [isNew, key]);
  return { isNew, markSeen };
}

// Show me: open the feature's tab, then find the element tagged data-wn-focus="<focus>" and bring it
// into view and focus. Waits a moment for the tab to render and gives up quietly.
export function focusFeature(focus, key = focus) {
  if (!focus) return;
  markFeatureSeen(key);
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  let tries = 0;
  const look = () => {
    const el = document.querySelector(`[data-wn-focus~="${focus}"]`);
    if (el) {
      if (!el.matches("button, a, input, select, textarea, [tabindex]")) el.setAttribute("tabindex", "-1");
      el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      el.focus({ preventScroll: true });
    } else if (++tries < 20) setTimeout(look, 100);
  };
  setTimeout(look, 120);
}

// Auto-open: once per release with an unseen highlight, on the Overview only, never over another
// dialog or a focused text field, never in demo mode. `ready` is the shell's "nothing else is going on".
export function useAutoOpen({ enabled, hasUnseen, release, open }) {
  const done = useRef(null);
  useEffect(() => {
    if (!enabled || !hasUnseen || !release || done.current === release) return;
    const t = setTimeout(() => {
      const a = document.activeElement;
      const typing = a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable);
      if (typing || document.querySelector('.modal-backdrop, [role="dialog"], [aria-modal="true"]')) return;
      done.current = release;
      open();
    }, 1800);
    return () => clearTimeout(t);
  }, [enabled, hasUnseen, release, open]);
}
