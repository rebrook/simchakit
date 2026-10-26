// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — api/validate-coupon.js
// Vercel serverless function.
// POST { code: string }
// Returns { valid, discount, value, message }
// Uses Supabase service role key (bypasses RLS) — never exposed to browser.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code } = req.body || {};

  if (!code || typeof code !== "string" || code.trim().length === 0) {
    return res.status(400).json({ valid: false, message: "No code provided." });
  }

  const normalized = code.trim().toUpperCase();

  const { data: coupon, error } = await supabase
    .from("coupon_codes")
    .select("id, code, discount, value, max_uses, uses, expires_at, active")
    .eq("code", normalized)
    .single();

  if (error || !coupon) {
    return res.status(200).json({ valid: false, message: "Invalid coupon code." });
  }

  if (!coupon.active) {
    return res.status(200).json({ valid: false, message: "This coupon is no longer active." });
  }

  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return res.status(200).json({ valid: false, message: "This coupon has expired." });
  }

  if (coupon.max_uses !== null && coupon.uses >= coupon.max_uses) {
    return res.status(200).json({ valid: false, message: "This coupon has reached its maximum uses." });
  }

  // Valid — return discount details (never return the full row)
  return res.status(200).json({
    valid:    true,
    discount: coupon.discount, // "free" | "percent" | "fixed"
    value:    coupon.value,    // percent off or cents off; 0 if "free"
    message:  coupon.discount === "free"
      ? "Free event coupon applied!"
      : coupon.discount === "percent"
        ? `${coupon.value}% discount applied!`
        : `$${(coupon.value / 100).toFixed(2)} discount applied!`,
  });
}
