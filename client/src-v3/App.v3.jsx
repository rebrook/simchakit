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
import { OnboardingModal }     from "@/components/events/OnboardingModal.jsx";
import { AppShell }            from "@/components/shell/AppShell.jsx";
import { useDarkMode }         from "@/hooks/useDarkMode.js";
import { ThemeProvider }       from "@/components/shared/ThemeProvider.jsx";

const DEMO_EVENT_ID       = "440a8b9e-e92e-4ad6-b352-41965bd8383b"; // Bart's Bar Mitzvah demo event
const IS_DEMO             = window.location.pathname === "/demo";
const PENDING_INVITE_KEY  = "simchakit-pending-invite";

// Detect /invite/{token} path and store token for post-auth acceptance
const inviteMatch = window.location.pathname.match(/^\/invite\/([0-9a-f-]{36})$/i);
if (inviteMatch) {
  localStorage.setItem(PENDING_INVITE_KEY, inviteMatch[1]);
  // Redirect to root so the auth flow can proceed cleanly
  window.history.replaceState({}, "", "/");
}

export default function AppV3() {
  const [session, setSession]         = useState(undefined); // undefined = loading
  const [inviteError, setInviteError] = useState(null);
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

        // On sign-in, accept any pending invite token stored before auth
        if (event === "SIGNED_IN" && session?.user) {
          const pendingToken = localStorage.getItem(PENDING_INVITE_KEY);
          if (pendingToken) {
            localStorage.removeItem(PENDING_INVITE_KEY);
            fetch("/api/accept-invite", {
              method:  "POST",
              headers: {
                "Content-Type":  "application/json",
                "Authorization": "Bearer " + session.access_token,
              },
              // No userId in the body — the server derives identity from the
              // Authorization header token, never from client-supplied fields.
              body: JSON.stringify({ token: pendingToken }),
            })
            .then(async (res) => {
              const data = await res.json().catch(() => ({}));
              return { ok: res.ok, data };
            })
            .then(({ ok, data }) => {
              if (ok && data.accepted) {
                // Reload so EventPicker fetches the updated collaborator event list
                window.location.replace("/");
              } else {
                setInviteError("We couldn't add you to the event — ask for a new invite link.");
              }
            })
            .catch(() => {
              setInviteError("We couldn't add you to the event — ask for a new invite link.");
            });
          }
        }

        // On sign-in, upsert user_profiles row (safe no-op if row already exists)
        if (event === "SIGNED_IN" && session?.user) {
          const { id, email } = session.user;
          supabase
            .from("user_profiles")
            .upsert(
              { id, email, updated_at: new Date().toISOString() },
              { onConflict: "id", ignoreDuplicates: false }
            )
            .then(({ error, data }) => {
              if (error) console.warn("[SimchaKit] user_profiles upsert failed:", error.message);
              // Notify on first sign-in (new user) — check account age rather than
              // event_count, which stays 0 until the user creates their first event
              // and would re-trigger the notification on every subsequent login.
              supabase
                .from("user_profiles")
                .select("display_name")
                .eq("id", id)
                .single()
                .then(({ data: profile }) => {
                  const acctAge   = Date.now() - new Date(session.user.created_at).getTime();
                  const isNewUser = acctAge < 60_000; // created within last 60 seconds
                  const hasName   = !!(profile?.display_name);

                  if (isNewUser) {
                    // Admin notification
                    fetch("/api/notify", {
                      method:  "POST",
                      headers: { "Content-Type": "application/json" },
                      body:    JSON.stringify({ type: "new_user", data: { email, userId: id } }),
                    }).catch((err) => console.warn("[SimchaKit] notify (new_user) failed", err));

                    // Brevo contact sync — new user (includes SIGNUP_DATE)
                    fetch("/api/brevo-sync", {
                      method:  "POST",
                      headers: { "Content-Type": "application/json" },
                      body:    JSON.stringify({
                        email,
                        isNewUser: true,
                        attributes: {
                          SIGNUP_DATE: new Date().toISOString().slice(0, 10),
                          LAST_LOGIN:  new Date().toISOString().slice(0, 10),
                          ...(hasName && { FIRSTNAME: profile.display_name }),
                        },
                      }),
                    }).catch((err) => console.warn("[SimchaKit] brevo-sync (new user) failed", err));
                  } else {
                    // Returning user — update LAST_LOGIN and FIRSTNAME if set
                    fetch("/api/brevo-sync", {
                      method:  "POST",
                      headers: { "Content-Type": "application/json" },
                      body:    JSON.stringify({
                        email,
                        isNewUser: false,
                        attributes: {
                          LAST_LOGIN: new Date().toISOString().slice(0, 10),
                          ...(hasName && { FIRSTNAME: profile.display_name }),
                        },
                      }),
                    }).catch((err) => console.warn("[SimchaKit] brevo-sync (returning user) failed", err));
                  }
                });
            });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      <ThemeProvider palette="rose" />
      <AppContent
        session={session}
        isCallback={isCallback}
        inviteError={inviteError}
        onDismissInviteError={() => setInviteError(null)}
      />
    </>
  );
}

function AppContent({ session, isCallback, inviteError, onDismissInviteError }) {
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [displayName,     setDisplayName]     = useState(null); // null = not yet loaded
  const [showOnboarding,  setShowOnboarding]  = useState(false);
  const [isNewUser,       setIsNewUser]       = useState(false);

  // Load display_name and determine onboarding state on sign-in
  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from("user_profiles")
      .select("display_name, event_count")
      .eq("id", session.user.id)
      .single()
      .then(({ data: profile }) => {
        const name = profile?.display_name || null;
        const count = profile?.event_count ?? 0;
        setDisplayName(name);
        if (!name && count === 0) {
          setIsNewUser(true);
          setShowOnboarding(true);
        }
      });
  }, [session?.user?.id]);

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
        displayName={displayName}
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
          <div style={headerStyles.title}>SimchaKit</div>
        </div>
      </header>

      {inviteError && (
        <div className="alert alert-error" style={{ margin: "16px 24px 0", maxWidth: 1000, marginLeft: "auto", marginRight: "auto" }}>
          <span>{inviteError}</span>
          <button
            type="button"
            className="icon-btn"
            onClick={onDismissInviteError}
            aria-label="Dismiss"
            style={{ marginLeft: "auto" }}
          >
            ×
          </button>
        </div>
      )}

      {showOnboarding && (
        <OnboardingModal
          userId={session.user.id}
          isRequired={isNewUser}
          initialName=""
          onSave={(name) => {
            setDisplayName(name);
            setShowOnboarding(false);
            // Sync to Brevo
            fetch("/api/brevo-sync", {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({
                email:     session.user.email,
                isNewUser: false,
                attributes: { FIRSTNAME: name },
              }),
            }).catch((err) => console.warn("[SimchaKit] brevo-sync (onboarding save) failed", err));
          }}
          onDismiss={() => setShowOnboarding(false)}
        />
      )}

      <EventPicker
        session={session}
        displayName={displayName}
        onSelectEvent={setSelectedEventId}
        onEditName={() => setShowOnboarding(true)}
      />
    </>
  );
}

const headerStyles = {
  header: {
    background:   "var(--bg-surface)",
    borderBottom: "1px solid var(--border)",
    padding:      "0 24px",
    boxShadow:    "0 1px 2px rgba(28,22,20,0.06)",
  },
  inner: {
    maxWidth:      1000,
    margin:        "0 auto",
    display:       "flex",
    alignItems:    "center",
    gap:           10,
    paddingTop:    8,
    paddingBottom: 8,
    minHeight:     48,
  },
  title: {
    fontFamily: "var(--font-display)",
    fontSize:   20,
    fontWeight: 600,
    color:      "var(--text-primary)",
  },
};
