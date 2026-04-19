// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — api/stripe-webhook.js
// Vercel serverless function.
// Receives Stripe webhook events. Verifies signature.
// On checkout.session.completed → marks purchase as completed,
// increments coupon uses if applicable.
// ─────────────────────────────────────────────────────────────────────────────

import Stripe          from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Vercel serverless functions parse the body by default.
// We need the raw body to verify Stripe's signature.
export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end",  ()    => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sig     = req.headers["stripe-signature"];
  const rawBody = await getRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("[SimchaKit] Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  // ── Handle checkout.session.completed ────────────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session    = event.data.object;
    const userId     = session.metadata?.userId;
    const couponCode = session.metadata?.couponCode || null;

    if (!userId) {
      console.error("[SimchaKit] Webhook: no userId in session metadata");
      return res.status(200).json({ received: true }); // still 200 to prevent Stripe retries
    }

    // Mark purchase as completed
    const { error: updateError } = await supabase
      .from("purchases")
      .update({
        status:       "completed",
        updated_at:   new Date().toISOString(),
        stripe_payment_intent: session.payment_intent || null,
      })
      .eq("stripe_session_id", session.id);

    if (updateError) {
      console.error("[SimchaKit] Webhook: could not update purchase:", updateError.message);
    }

    // Increment coupon uses if a coupon was applied
    if (couponCode) {
      const { data: coupon } = await supabase
        .from("coupon_codes")
        .select("id, uses")
        .eq("code", couponCode)
        .single();

      if (coupon) {
        await supabase
          .from("coupon_codes")
          .update({ uses: coupon.uses + 1 })
          .eq("id", coupon.id);
      }
    }

    console.log(`[SimchaKit] Webhook: purchase completed for user ${userId}, session ${session.id}`);
  }

  // Always return 200 — Stripe retries on any non-2xx
  return res.status(200).json({ received: true });
}
