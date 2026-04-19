// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — AuthCallback.jsx
// Handles the magic link redirect. Supabase processes the token from the URL
// hash automatically via onAuthStateChange in App.v3.jsx.
// This component just shows a loading state while that happens.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { supabase }            from "@/lib/supabase.js";

export function AuthCallback({ onComplete }) {
  const [error, setError] = useState(null);

  useEffect(() => {
    // Supabase automatically exchanges the token in the URL hash.
    // We just need to wait for the session to be established.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session) {
          onComplete();
        }
        if (event === "TOKEN_REFRESHED" && session) {
          onComplete();
        }
      }
    );

    // Safety timeout — if nothing happens in 8s, show an error
    const timeout = setTimeout(() => {
      setError("Sign-in timed out. Please try again.");
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [onComplete]);

  return (
    <div style={{
      minHeight:       "100vh",
      display:         "flex",
      alignItems:      "center",
      justifyContent:  "center",
      background:      "var(--bg-base)",
      fontFamily:      "var(--font-body)",
      padding:         24,
    }}>
      <div style={{
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        gap:            16,
        textAlign:      "center",
        maxWidth:       320,
      }}>
        {error ? (
          <>
            <div style={{ fontSize: 36 }}>⚠️</div>
            <div style={{
              fontFamily:  "var(--font-display)",
              fontSize:    18,
              fontWeight:  700,
              color:       "var(--text-primary)",
            }}>
              Sign-in failed
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
              {error}
            </div>
            <button
              className="btn btn-primary"
              onClick={() => window.location.replace("/")}
            >
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <div style={{
              width:          32,
              height:         32,
              border:         "3px solid var(--border)",
              borderTopColor: "var(--accent-primary)",
              borderRadius:   "50%",
              animation:      "spin 0.8s linear infinite",
            }} />
            <div style={{
              fontFamily:  "var(--font-display)",
              fontSize:    18,
              fontWeight:  700,
              color:       "var(--text-primary)",
            }}>
              Signing you in…
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Just a moment
            </div>
          </>
        )}
      </div>
    </div>
  );
}
