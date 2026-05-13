// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — App.v3.jsx
// Auth-aware root. Handles sign-in, magic link callback, and event routing.
// Phase 4: profile upsert on first sign-in, EventPicker, event selection.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { supabase }            from "@/lib/supabase.js";
import { AuthPage }            from "@/components/auth/AuthPage.jsx";
import { AuthCallback }        from "@/components/auth/AuthCallback.jsx";
import { EventPicker }         from "@/components/events/EventPicker.jsx";
import { AppShell }            from "@/components/shell/AppShell.jsx";
import { useDarkMode }         from "@/hooks/useDarkMode.js";
import { ThemeProvider }       from "@/components/shared/ThemeProvider.jsx";

const DEMO_EVENT_ID = "440a8b9e-e92e-4ad6-b352-41965bd8383b"; // Bart's Bar Mitzvah demo event
const IS_DEMO      = window.location.pathname === "/demo";

export default function AppV3() {
  const [session, setSession] = useState(undefined); // undefined = loading
  useDarkMode();

  // Demo mode — bypass auth entirely, ensure anon Supabase client
  if (IS_DEMO) {
    // Sign out any existing session so Supabase uses the anon key for all requests
    supabase.auth.signOut();
    return (
      <>
        <ThemeProvider palette="rose" />
        <AppShell
          session={null}
          eventId={DEMO_EVENT_ID}
          isDemoMode={true}
          onBack={() => window.location.replace("/")}
        />
      </>
    );
  }

  const isCallback = window.location.hash.includes("access_token") ||
                     window.location.hash.includes("error_description") ||
                     window.location.search.includes("code=");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);

        // On sign-in, upsert user_profiles row (safe no-op if row already exists)
        if (event === "SIGNED_IN" && session?.user) {
          const { id, email } = session.user;
          supabase
            .from("user_profiles")
            .upsert(
              { id, email, updated_at: new Date().toISOString() },
              { onConflict: "id", ignoreDuplicates: false }
            )
            .then(({ error }) => {
              if (error) console.warn("[SimchaKit] user_profiles upsert failed:", error.message);
            });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      <ThemeProvider palette="rose" />
      <AppContent session={session} isCallback={isCallback} />
    </>
  );
}

function AppContent({ session, isCallback }) {
  const [selectedEventId, setSelectedEventId] = useState(null);

  // Loading spinner
  if (session === undefined) {
    return (
      <div style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        height:         "100vh",
        background:     "var(--bg-base)",
        color:          "var(--text-muted)",
        fontFamily:     "var(--font-body)",
        fontSize:       14,
        gap:            12,
      }}>
        <div style={{
          width:          18,
          height:         18,
          border:         "2px solid var(--border)",
          borderTopColor: "var(--accent-primary)",
          borderRadius:   "50%",
          animation:      "spin 0.8s linear infinite",
          flexShrink:     0,
        }} />
        Loading SimchaKit…
      </div>
    );
  }

  // Magic link callback
  if (isCallback) {
    return <AuthCallback onComplete={() => window.location.replace("/")} />;
  }

  // Not signed in
  if (!session) {
    return <AuthPage />;
  }

  // Signed in — event selected → full app shell
  if (selectedEventId) {
    return (
      <AppShell
        session={session}
        eventId={selectedEventId}
        onBack={() => setSelectedEventId(null)}
      />
    );
  }

  // Signed in — no event selected → event picker
  return (
    <>
      {/* SimchaKit header — matches V2 index.html exactly */}
      <header style={headerStyles.header}>
        <div style={headerStyles.inner}>
          <img src="/apple-touch-icon.png" alt="SimchaKit" style={{ width: 40, height: 40, borderRadius: 8, display: "block", flexShrink: 0 }} />
          <div>
            <div style={headerStyles.title}>SimchaKit</div>
            <div style={headerStyles.sub}>SimchaKit is the all-in-one planning hub for B&apos;nei Mitzvot, weddings, and every Jewish lifecycle celebration.</div>
          </div>
        </div>
      </header>

      <EventPicker
        session={session}
        onSelectEvent={setSelectedEventId}
      />
    </>
  );
}

const headerStyles = {
  header: {
    background:   "var(--bg-surface)",
    borderBottom: "1px solid var(--border)",
    padding:      "0 24px",
    boxShadow:    "0 1px 3px rgba(28,22,20,0.08)",
  },
  inner: {
    maxWidth:   1000,
    margin:     "0 auto",
    display:    "flex",
    alignItems: "center",
    gap:        10,
    height:     60,
  },
  title: {
    fontFamily: "\"Cormorant Garamond\", Georgia, serif",
    fontSize:   22,
    fontWeight: 600,
    color:      "var(--text-primary)",
  },
  sub: {
    fontSize:   12,
    color:      "var(--text-muted)",
    marginLeft: 4,
    marginTop:  2,
  },
};
