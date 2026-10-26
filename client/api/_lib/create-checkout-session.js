// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — api/create-checkout-session.js
// Vercel serverless function.
// POST { userId, userEmail, couponCode? }
// Returns { url } for Stripe Checkout, or { free: true } for free coupons.
// ─────────────────────────────────────────────────────────────────────────────

import Stripe       from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Intro pricing ends Aug 31 2026
const INTRO_CUTOFF    = new Date("2026-08-31T23:59:59Z");
const PRICE_INTRO     = process.env.STRIPE_PRICE_INTRO;    // $29
const PRICE_REGULAR   = process.env.STRIPE_PRICE_REGULAR;  // $49
const APP_URL         = process.env.VITE_APP_URL || "https://simchakit.vercel.app";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId, userEmail, couponCode } = req.body || {};

  if (!userId || !userEmail) {
    return res.status(400).json({ error: "Missing userId or userEmail." });
  }

  // ── Validate coupon if provided ──────────────────────────────────────────
  let couponRow = null;
  if (couponCode) {
    const normalized = couponCode.trim().toUpperCase();
    const { data: coupon } = await supabase
      .from("coupon_codes")
      .select("id, discount, value, max_uses, uses, expires_at, active")
      .eq("code", normalized)
      .single();

    if (
      coupon &&
      coupon.active &&
      (!coupon.expires_at || new Date(coupon.expires_at) >= new Date()) &&
      (coupon.max_uses === null || coupon.uses < coupon.max_uses)
    ) {
      couponRow = coupon;
    }
  }

  // ── Free coupon — skip Stripe entirely ──────────────────────────────────
  if (couponRow && couponRow.discount === "free") {
    // Increment uses
    await supabase
      .from("coupon_codes")
      .update({ uses: couponRow.uses + 1 })
      .eq("id", couponRow.id);

    // Insert a $0 purchase record
    await supabase.from("purchases").insert({
      owner_id:    userId,
      coupon_code: couponCode.trim().toUpperCase(),
      amount_cents: 0,
      status:      "completed",
    });

    return res.status(200).json({ free: true });
  }

  // ── Determine price ───────────────────────────────────────────────────────
  const isIntro   = new Date() <= INTRO_CUTOFF;
  const priceId   = isIntro ? PRICE_INTRO : PRICE_REGULAR;
  const basePrice = isIntro ? 2900 : 4900; // cents

  // ── Calculate discount for non-free coupons ───────────────────────────────
  let discountCents = 0;
  let stripeDiscountParams = {};

  if (couponRow) {
    if (couponRow.discount === "percent") {
      discountCents = Math.round(basePrice * (couponRow.value / 100));
    } else if (couponRow.discount === "fixed") {
      discountCents = Math.min(couponRow.value, basePrice);
    }

    if (discountCents > 0) {
      // Create a one-time Stripe coupon for this session
      const stripeCoupon = await stripe.coupons.create({
        amount_off: discountCents,
        currency:   "usd",
        duration:   "once",
      });
      stripeDiscountParams = { discounts: [{ coupon: stripeCoupon.id }] };
    }
  }

  // ── Create Stripe Checkout session ───────────────────────────────────────
  const session = await stripe.checkout.sessions.create({
    mode:               "payment",
    customer_email:     userEmail,
    line_items: [{
      price:    priceId,
      quantity: 1,
    }],
    ...stripeDiscountParams,
    success_url: `${APP_URL}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${APP_URL}/?payment=cancelled`,
    metadata: {
      userId,
      couponCode: couponCode ? couponCode.trim().toUpperCase() : "",
    },
    // Pre-insert a pending purchase record so we can poll for it
    client_reference_id: userId,
  });

  // Insert pending purchase record
  await supabase.from("purchases").insert({
    owner_id:         userId,
    stripe_session_id: session.id,
    coupon_code:      couponCode ? couponCode.trim().toUpperCase() : null,
    amount_cents:     basePrice - discountCents,
    status:           "pending",
  });

  return res.status(200).json({ url: session.url });
}
