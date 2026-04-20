// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit Admin — api/admin-query.js
// Vercel serverless function.
// POST { query, params, token }
// Verifies the caller is in admin_users before running any query.
// Uses service role key — never exposed to browser.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

// Anon client — used only to verify the JWT
const supabaseAnon = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Service role client — used for all admin queries (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { query, params, token } = req.body || {};

  if (!token) {
    return res.status(401).json({ error: "No token provided." });
  }

  // ── Verify JWT and get user ───────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }

  // ── Verify user is in admin_users ─────────────────────────────────────────
  const { data: adminRow } = await supabaseAdmin
    .from("admin_users")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!adminRow) {
    return res.status(403).json({ error: "Not authorized." });
  }

  // ── Run requested query ───────────────────────────────────────────────────
  try {
    let result;

    switch (query) {

      case "stats": {
        // Dashboard summary stats
        const [users, events, purchases] = await Promise.all([
          supabaseAdmin.from("user_profiles").select("id", { count: "exact", head: true }),
          supabaseAdmin.from("events").select("id", { count: "exact", head: true }),
          supabaseAdmin.from("purchases").select("amount_cents, status, created_at"),
        ]);
        const completedPurchases = (purchases.data || []).filter(p => p.status === "completed");
        const totalRevenueCents  = completedPurchases.reduce((s, p) => s + (p.amount_cents || 0), 0);

        // Monthly revenue — last 6 months
        const monthly = {};
        completedPurchases.forEach(p => {
          const month = p.created_at.slice(0, 7); // "2026-04"
          monthly[month] = (monthly[month] || 0) + (p.amount_cents || 0);
        });

        result = {
          userCount:        users.count    || 0,
          eventCount:       events.count   || 0,
          purchaseCount:    completedPurchases.length,
          totalRevenueCents,
          monthlyRevenue:   monthly,
        };
        break;
      }

      case "users": {
        const { data } = await supabaseAdmin
          .from("user_profiles")
          .select("id, email, display_name, event_count, created_at, updated_at")
          .order("created_at", { ascending: false });
        result = data || [];
        break;
      }

      case "user_detail": {
        // Events and purchases for a specific user
        const { userId } = params || {};
        if (!userId) return res.status(400).json({ error: "Missing userId." });
        const [eventsRes, purchasesRes] = await Promise.all([
          supabaseAdmin.from("events").select("id, name, type, archived, created_at").eq("owner_id", userId).order("created_at", { ascending: false }),
          supabaseAdmin.from("purchases").select("id, amount_cents, status, coupon_code, stripe_session_id, created_at").eq("owner_id", userId).order("created_at", { ascending: false }),
        ]);
        result = { events: eventsRes.data || [], purchases: purchasesRes.data || [] };
        break;
      }

      case "events": {
        // All events with owner email
        const { data: eventsData } = await supabaseAdmin
          .from("events")
          .select("id, name, type, archived, owner_id, created_at")
          .order("created_at", { ascending: false });

        // Enrich with owner email from user_profiles
        const ownerIds = [...new Set((eventsData || []).map(e => e.owner_id))];
        const { data: profiles } = await supabaseAdmin
          .from("user_profiles")
          .select("id, email")
          .in("id", ownerIds);

        const emailMap = {};
        (profiles || []).forEach(p => { emailMap[p.id] = p.email; });
        result = (eventsData || []).map(e => ({ ...e, ownerEmail: emailMap[e.owner_id] || "" }));
        break;
      }

      case "purchases": {
        const { data: purchasesData } = await supabaseAdmin
          .from("purchases")
          .select("id, owner_id, event_id, amount_cents, status, coupon_code, stripe_session_id, stripe_payment_intent, created_at, updated_at")
          .order("created_at", { ascending: false });

        // Enrich with owner email
        const ownerIds = [...new Set((purchasesData || []).map(p => p.owner_id))];
        const { data: profiles } = await supabaseAdmin
          .from("user_profiles")
          .select("id, email")
          .in("id", ownerIds);

        const emailMap = {};
        (profiles || []).forEach(p => { emailMap[p.id] = p.email; });
        result = (purchasesData || []).map(p => ({ ...p, ownerEmail: emailMap[p.owner_id] || "" }));
        break;
      }

      case "grant_purchase": {
        // Manually mark a purchase as completed (gifted event, support case)
        const { userId: grantUserId, notes } = params || {};
        if (!grantUserId) return res.status(400).json({ error: "Missing userId." });
        const { data: newPurchase, error: grantError } = await supabaseAdmin
          .from("purchases")
          .insert({
            owner_id:    grantUserId,
            amount_cents: 0,
            status:      "completed",
            coupon_code: notes || "MANUAL_GRANT",
          })
          .select()
          .single();
        if (grantError) return res.status(500).json({ error: grantError.message });
        result = newPurchase;
        break;
      }

      case "refund_purchase": {
        const { purchaseId } = params || {};
        if (!purchaseId) return res.status(400).json({ error: "Missing purchaseId." });
        const { error: refundError } = await supabaseAdmin
          .from("purchases")
          .update({ status: "refunded", updated_at: new Date().toISOString() })
          .eq("id", purchaseId);
        if (refundError) return res.status(500).json({ error: refundError.message });
        result = { ok: true };
        break;
      }

      case "coupons": {
        const { data } = await supabaseAdmin
          .from("coupon_codes")
          .select("*")
          .order("created_at", { ascending: false });
        result = data || [];
        break;
      }

      case "create_coupon": {
        const { code, discount, value, maxUses, expiresAt, createdBy } = params || {};
        if (!code || !discount) return res.status(400).json({ error: "Missing code or discount." });
        const { data: newCoupon, error: couponError } = await supabaseAdmin
          .from("coupon_codes")
          .insert({
            code:       code.trim().toUpperCase(),
            discount,
            value:      value || 0,
            max_uses:   maxUses || null,
            expires_at: expiresAt || null,
            created_by: createdBy || user.email,
            active:     true,
          })
          .select()
          .single();
        if (couponError) return res.status(500).json({ error: couponError.message });
        result = newCoupon;
        break;
      }

      case "toggle_coupon": {
        const { couponId, active } = params || {};
        if (!couponId) return res.status(400).json({ error: "Missing couponId." });
        const { error: toggleError } = await supabaseAdmin
          .from("coupon_codes")
          .update({ active })
          .eq("id", couponId);
        if (toggleError) return res.status(500).json({ error: toggleError.message });
        result = { ok: true };
        break;
      }

      default:
        return res.status(400).json({ error: `Unknown query: ${query}` });
    }

    return res.status(200).json({ data: result });

  } catch (err) {
    console.error("[SimchaKit Admin] admin-query error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
