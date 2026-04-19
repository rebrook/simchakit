// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — App.v3.jsx
// Auth-aware root. Handles sign-in, magic link callback, and event routing.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { supabase }            from "@/lib/supabase.js";
import { AuthPage }            from "@/components/auth/AuthPage.jsx";
import { AuthCallback }        from "@/components/auth/AuthCallback.jsx";
import { useDarkMode }         from "@/hooks/useDarkMode.js";
import { ThemeProvider }       from "@/components/shared/ThemeProvider.jsx";

export default function AppV3() {
  const [session,  setSession]  = useState(undefined); // undefined = loading
  const [darkMode, setDarkMode] = useDarkMode();

  // Detect magic link callback URL
  const isCallback = window.location.hash.includes("access_token") ||
                     window.location.hash.includes("error_description") ||
                     window.location.search.includes("code=");

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Loading state — wait for session check before rendering anything
  if (session === undefined) {
    return (
      <ThemeProvider darkMode={darkMode}>
        <div style={{
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
          height:          "100vh",
          background:      "var(--bg-app)",
          color:           "var(--text-muted)",
          fontFamily:      "var(--font-body)",
          fontSize:        14,
          gap:             12,
        }}>
          <div style={{
            width:           18,
            height:          18,
            border:          "2px solid var(--border)",
            borderTopColor:  "var(--accent-primary)",
            borderRadius:    "50%",
            animation:       "spin 0.8s linear infinite",
            flexShrink:      0,
          }} />
          Loading SimchaKit…
        </div>
      </ThemeProvider>
    );
  }

  // Magic link callback handler
  if (isCallback) {
    return (
      <ThemeProvider darkMode={darkMode}>
        <AuthCallback onComplete={() => {
          // Auth state change listener will update session automatically
          window.location.replace("/");
        }} />
      </ThemeProvider>
    );
  }

  // Not signed in — show auth page
  if (!session) {
    return (
      <ThemeProvider darkMode={darkMode}>
        <AuthPage />
      </ThemeProvider>
    );
  }

  // Signed in — placeholder until event picker is built in Phase 4
  return (
    <ThemeProvider darkMode={darkMode}>
      <div style={{
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        height:         "100vh",
        background:     "var(--bg-app)",
        fontFamily:     "var(--font-body)",
        gap:            16,
        padding:        24,
        textAlign:      "center",
      }}>
        <div style={{ fontSize: 40 }}>✡</div>
        <div style={{
          fontFamily:  "var(--font-display)",
          fontSize:    24,
          fontWeight:  700,
          color:       "var(--text-primary)",
        }}>
          Welcome to SimchaKit
        </div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 360 }}>
          Signed in as <strong>{session.user.email}</strong>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Event picker coming in Phase 4…
        </div>
        <button
          className="btn btn-secondary"
          style={{ marginTop: 8 }}
          onClick={() => supabase.auth.signOut()}
        >
          Sign out
        </button>
      </div>
    </ThemeProvider>
  );
}
