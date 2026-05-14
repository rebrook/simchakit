// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — PaywallGate.jsx
// Shown when a user tries to create an additional event.
// Handles coupon validation, Stripe Checkout redirect, and free coupon flow.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";

const INTRO_CUTOFF   = new Date("2026-08-31T23:59:59Z");
const PRICE_INTRO    = 29;
const PRICE_REGULAR  = 49;

function currentPrice() {
  return new Date() <= INTRO_CUTOFF ? PRICE_INTRO : PRICE_REGULAR;
}

function isIntroActive() {
  return new Date() <= INTRO_CUTOFF;
}

export function PaywallGate({ session, onFreeEventGranted, onCancel }) {
  const [couponInput,   setCouponInput]   = useState("");
  const [couponStatus,  setCouponStatus]  = useState("idle"); // idle | checking | valid | invalid
  const [couponData,    setCouponData]    = useState(null);   // { discount, value, message }
  const [checkoutStatus, setCheckoutStatus] = useState("idle"); // idle | loading | error
  const [errorMsg,      setErrorMsg]      = useState("");

  const price       = currentPrice();
  const introActive = isIntroActive();

  // ── Discounted price after coupon ────────────────────────────────────────
  function discountedPrice() {
    if (!couponData || couponData.discount === "free") return 0;
    if (couponData.discount === "percent") {
      return Math.max(0, price - Math.round(price * couponData.value / 100));
    }
    if (couponData.discount === "fixed") {
      return Math.max(0, price - couponData.value / 100);
    }
    return price;
  }

  // ── Validate coupon code ─────────────────────────────────────────────────
  async function handleValidateCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponStatus("checking");
    setCouponData(null);

    try {
      const res  = await fetch("/api/validate-coupon", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code }),
      });
      const data = await res.json();

      if (data.valid) {
        setCouponStatus("valid");
        setCouponData(data);
      } else {
        setCouponStatus("invalid");
        setErrorMsg(data.message || "Invalid coupon code.");
      }
    } catch {
      setCouponStatus("invalid");
      setErrorMsg("Could not validate coupon. Please try again.");
    }
  }

  // ── Proceed to payment (Stripe or free) ──────────────────────────────────
  async function handleProceed() {
    setCheckoutStatus("loading");
    setErrorMsg("");

    try {
      const res  = await fetch("/api/create-checkout-session", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          userId:     session.user.id,
          userEmail:  session.user.email,
          couponCode: couponData ? couponInput.trim().toUpperCase() : undefined,
        }),
      });
      const data = await res.json();

      if (data.free) {
        // Free coupon — no Stripe needed, notify parent
        onFreeEventGranted();
        return;
      }

      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
        return;
      }

      throw new Error(data.error || "Could not start checkout.");
    } catch (err) {
      setCheckoutStatus("error");
      setErrorMsg(err.message || "Something went wrong. Please try again.");
    }
  }

  const isFree          = couponData?.discount === "free";
  const finalPrice      = couponData ? discountedPrice() : price;
  const canProceed      = checkoutStatus !== "loading";

  return (
    <div style={styles.wrap}>

      {/* Header */}
      <div style={styles.title}>Create Your Event</div>
      <div style={styles.subtitle}>
        Each event requires a one-time purchase. Your planning data is stored securely and never expires.
      </div>

      {/* Pricing card */}
      <div style={styles.priceCard}>
        <div style={styles.priceRow}>
          <div>
            <div style={styles.priceAmount}>
              {isFree ? "Free" : `$${finalPrice}`}
            </div>
            {couponData && !isFree && (
              <div style={styles.priceOriginal}>
                <span style={{ textDecoration: "line-through", color: "var(--text-muted)" }}>
                  ${price}
                </span>
                <span style={{ color: "var(--green)", marginLeft: 6, fontWeight: 600 }}>
                  {couponData.discount === "percent"
                    ? `${couponData.value}% off`
                    : `$${(couponData.value / 100).toFixed(2)} off`}
                </span>
              </div>
            )}
            <div style={styles.priceLabel}>one-time per event</div>
          </div>
          {introActive && (
            <div style={styles.introBadge}>
              Introductory pricing — ends Aug 31, 2026
            </div>
          )}
        </div>
      </div>

      {/* Coupon code field */}
      <div style={styles.couponRow}>
        <div style={styles.couponInputWrap}>
          <input
            style={{
              ...styles.couponInput,
              borderColor: couponStatus === "valid"
                ? "var(--green)"
                : couponStatus === "invalid"
                  ? "var(--red)"
                  : "var(--border-strong)",
            }}
            type="text"
            value={couponInput}
            onChange={e => {
              setCouponInput(e.target.value.toUpperCase());
              setCouponStatus("idle");
              setCouponData(null);
              setErrorMsg("");
            }}
            onKeyDown={e => { if (e.key === "Enter") handleValidateCoupon(); }}
            placeholder="Coupon code (optional)"
            disabled={checkoutStatus === "loading"}
            autoComplete="off"
            spellCheck={false}
          />
          {couponStatus === "valid" && (
            <span style={styles.couponCheck}>✓</span>
          )}
        </div>
        <button
          style={{
            ...styles.btnApply,
            opacity: couponInput.trim().length === 0 || couponStatus === "checking" ? 0.45 : 1,
            cursor:  couponInput.trim().length === 0 || couponStatus === "checking"
              ? "not-allowed" : "pointer",
          }}
          onClick={handleValidateCoupon}
          disabled={couponInput.trim().length === 0 || couponStatus === "checking"}
        >
          {couponStatus === "checking" ? "Checking…" : "Apply"}
        </button>
      </div>

      {/* Coupon feedback */}
      {couponStatus === "valid" && couponData && (
        <div style={styles.couponSuccess}>{couponData.message}</div>
      )}
      {couponStatus === "invalid" && (
        <div style={styles.couponError}>{errorMsg}</div>
      )}

      {/* Actions */}
      <div style={styles.actions}>
        <button
          style={{
            ...styles.btnProceed,
            opacity: canProceed ? 1 : 0.55,
            cursor:  canProceed ? "pointer" : "not-allowed",
            background: isFree ? "var(--green)" : "var(--text-primary)",
          }}
          onClick={handleProceed}
          disabled={!canProceed}
        >
          {checkoutStatus === "loading"
            ? "Please wait…"
            : isFree
              ? "Redeem Free Event"
              : `Pay $${finalPrice} — Continue`}
        </button>
        <button style={styles.btnCancel} onClick={onCancel} disabled={checkoutStatus === "loading"}>
          ← Cancel
        </button>
      </div>

      {/* Checkout error */}
      {checkoutStatus === "error" && (
        <div style={styles.checkoutError}>{errorMsg}</div>
      )}

      {/* Trust note */}
      <div style={styles.trustNote}>
        🔒 Payments are processed securely by Stripe. SimchaKit never stores your payment details.
      </div>

      {/* Support contact */}
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
        Having trouble? Email <a href="mailto:hello@simcha-kit.com" style={{ color: "var(--text-muted)" }}>hello@simcha-kit.com</a> and we'll sort it out.
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    background:   "var(--bg-surface)",
    border:       "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    padding:      "28px 24px",
    marginBottom: "24px",
    boxShadow:    "var(--shadow-sm)",
    maxWidth:     520,
  },
  title: {
    fontFamily:   "var(--font-display)",
    fontSize:     18,
    fontWeight:   600,
    color:        "var(--text-primary)",
    marginBottom: 8,
  },
  subtitle: {
    fontSize:     13,
    color:        "var(--text-secondary)",
    lineHeight:   1.6,
    marginBottom: 20,
  },
  priceCard: {
    background:   "var(--bg-subtle)",
    border:       "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    padding:      "16px 18px",
    marginBottom: 18,
  },
  priceRow: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "flex-start",
    gap:            12,
    flexWrap:       "wrap",
  },
  priceAmount: {
    fontFamily:   "var(--font-display)",
    fontSize:     32,
    fontWeight:   700,
    color:        "var(--text-primary)",
    lineHeight:   1,
  },
  priceOriginal: {
    fontSize:   13,
    marginTop:  4,
    display:    "flex",
    alignItems: "center",
  },
  priceLabel: {
    fontSize:  12,
    color:     "var(--text-muted)",
    marginTop: 4,
  },
  introBadge: {
    fontSize:     11,
    fontWeight:   600,
    color:        "var(--gold)",
    background:   "var(--gold-light)",
    padding:      "4px 10px",
    borderRadius: "var(--radius-sm)",
    whiteSpace:   "nowrap",
    alignSelf:    "flex-start",
  },
  couponRow: {
    display:  "flex",
    gap:      8,
    marginBottom: 6,
  },
  couponInputWrap: {
    flex:     1,
    position: "relative",
  },
  couponInput: {
    width:        "100%",
    padding:      "9px 36px 9px 12px",
    border:       "1px solid var(--border-strong)",
    borderRadius: "var(--radius-sm)",
    fontFamily:   "var(--font-body)",
    fontSize:     13,
    fontWeight:   600,
    letterSpacing: "0.08em",
    color:        "var(--text-primary)",
    background:   "var(--bg-surface)",
    outline:      "none",
    textTransform: "uppercase",
    boxSizing:    "border-box",
  },
  couponCheck: {
    position:  "absolute",
    right:     10,
    top:       "50%",
    transform: "translateY(-50%)",
    color:     "var(--green)",
    fontSize:  14,
    fontWeight: 700,
  },
  btnApply: {
    padding:      "9px 16px",
    background:   "var(--bg-subtle)",
    border:       "1px solid var(--border-strong)",
    borderRadius: "var(--radius-sm)",
    fontFamily:   "var(--font-body)",
    fontSize:     13,
    fontWeight:   600,
    color:        "var(--text-primary)",
    whiteSpace:   "nowrap",
    minHeight:    36,
    transition:   "opacity var(--transition)",
  },
  couponSuccess: {
    fontSize:    12,
    color:       "var(--green)",
    fontWeight:  600,
    marginBottom: 14,
  },
  couponError: {
    fontSize:    12,
    color:       "var(--red)",
    marginBottom: 14,
  },
  actions: {
    display:    "flex",
    alignItems: "center",
    gap:        16,
    marginTop:  20,
    marginBottom: 8,
  },
  btnProceed: {
    padding:      "10px 22px",
    color:        "white",
    border:       "none",
    borderRadius: "var(--radius-sm)",
    fontFamily:   "var(--font-body)",
    fontSize:     14,
    fontWeight:   600,
    minHeight:    40,
    whiteSpace:   "nowrap",
    transition:   "opacity var(--transition)",
  },
  btnCancel: {
    background:  "none",
    border:      "none",
    fontFamily:  "var(--font-body)",
    fontSize:    13,
    color:       "var(--text-muted)",
    cursor:      "pointer",
    padding:     0,
  },
  checkoutError: {
    fontSize:   12,
    color:      "var(--red)",
    marginTop:  8,
  },
  trustNote: {
    fontSize:   11,
    color:      "var(--text-muted)",
    marginTop:  16,
    lineHeight: 1.5,
  },
};
