// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — AuthPage.jsx
// Magic link sign-in. Matches SimchaKit's existing CSS variable system.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { supabase } from "@/lib/supabase.js";

export function AuthPage() {
  const [email,   setEmail]   = useState("");
  const [status,  setStatus]  = useState("idle");  // idle | loading | sent | error
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    setErrorMsg("");

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("sent");
    }
  };

  return (
    <div style={{
      minHeight:       "100vh",
      display:         "flex",
      alignItems:      "center",
      justifyContent:  "center",
      background:      "var(--bg-app)",
      padding:         "24px 16px",
      fontFamily:      "var(--font-body)",
    }}>
      <div style={{
        width:           "100%",
        maxWidth:        420,
        display:         "flex",
        flexDirection:   "column",
        gap:             24,
      }}>

        {/* Logo + wordmark */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12, lineHeight: 1 }}>✡</div>
          <div style={{
            fontFamily:  "var(--font-display)",
            fontSize:    32,
            fontWeight:  800,
            color:       "var(--text-primary)",
            letterSpacing: "-0.02em",
            lineHeight:  1,
          }}>
            SimchaKit
          </div>
          <div style={{
            fontSize:    14,
            color:       "var(--text-muted)",
            marginTop:   8,
          }}>
            Jewish lifecycle event planning
          </div>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: "32px 28px" }}>

          {status === "sent" ? (
            // Success state
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📬</div>
              <div style={{
                fontFamily:  "var(--font-display)",
                fontSize:    20,
                fontWeight:  700,
                color:       "var(--text-primary)",
                marginBottom: 12,
              }}>
                Check your email
              </div>
              <div style={{
                fontSize:    14,
                color:       "var(--text-secondary)",
                lineHeight:  1.6,
                marginBottom: 24,
              }}>
                We sent a sign-in link to <strong>{email}</strong>.
                Click the link in that email to continue.
              </div>
              <div style={{
                fontSize:    12,
                color:       "var(--text-muted)",
                lineHeight:  1.5,
              }}>
                Didn't receive it? Check your spam folder, or{" "}
                <button
                  style={{
                    background: "none",
                    border:     "none",
                    cursor:     "pointer",
                    color:      "var(--accent-primary)",
                    fontSize:   12,
                    padding:    0,
                    textDecoration: "underline",
                  }}
                  onClick={() => setStatus("idle")}
                >
                  try again
                </button>.
              </div>
            </div>
          ) : (
            // Sign-in form
            <>
              <div style={{
                fontFamily:   "var(--font-display)",
                fontSize:     20,
                fontWeight:   700,
                color:        "var(--text-primary)",
                marginBottom: 8,
              }}>
                Sign in
              </div>
              <div style={{
                fontSize:     13,
                color:        "var(--text-muted)",
                marginBottom: 24,
                lineHeight:   1.5,
              }}>
                Enter your email and we'll send you a magic link — no password needed.
              </div>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Email address</label>
                  <input
                    className="form-input"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoFocus
                    autoComplete="email"
                    disabled={status === "loading"}
                    required
                  />
                </div>

                {status === "error" && (
                  <div style={{
                    fontSize:    13,
                    color:       "var(--red)",
                    background:  "var(--red-light)",
                    border:      "1px solid var(--red)",
                    borderRadius: "var(--radius-sm)",
                    padding:     "10px 12px",
                    lineHeight:  1.5,
                  }}>
                    {errorMsg || "Something went wrong. Please try again."}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={status === "loading" || !email.trim()}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  {status === "loading" ? (
                    <>
                      <div style={{
                        width:           14,
                        height:          14,
                        border:          "2px solid rgba(255,255,255,0.3)",
                        borderTopColor:  "white",
                        borderRadius:    "50%",
                        animation:       "spin 0.8s linear infinite",
                        flexShrink:      0,
                      }} />
                      Sending…
                    </>
                  ) : (
                    "Send Magic Link →"
                  )}
                </button>
              </form>
            </>
          )}

        </div>

        {/* Footer */}
        <div style={{
          textAlign:  "center",
          fontSize:   12,
          color:      "var(--text-muted)",
          lineHeight: 1.5,
        }}>
          By signing in you agree to our{" "}
          <a href="/terms" style={{ color: "var(--text-muted)" }}>Terms of Service</a>
          {" "}and{" "}
          <a href="/privacy" style={{ color: "var(--text-muted)" }}>Privacy Policy</a>.
        </div>

      </div>
    </div>
  );
}
