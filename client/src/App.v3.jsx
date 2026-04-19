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
  const [session, setSession] = useState(undefined); // undefined = loading
  // useDarkMode sets data-theme on <html> automatically — no props needed
  useDarkMode();

  // Detect magic link callback URL
  const isCallback = window.location.hash.includes("access_token") ||
                     window.location.hash.includes("error_description") ||
                     window.location.search.includes("code=");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => { setSession(session); }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ThemeProvider injects accent CSS vars; useDarkMode handles data-theme on <html>
  return (
    <>
      <ThemeProvider palette="rose" />
      <AppContent session={session} isCallback={isCallback} />
    </>
  );
}

function AppContent({ session, isCallback }) {
  if (session === undefined) {
    return (
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"center",
        height:"100vh", background:"var(--bg-base)", color:"var(--text-muted)",
        fontFamily:"var(--font-body)", fontSize:14, gap:12,
      }}>
        <div style={{
          width:18, height:18,
          border:"2px solid var(--border)", borderTopColor:"var(--accent-primary)",
          borderRadius:"50%", animation:"spin 0.8s linear infinite", flexShrink:0,
        }} />
        Loading SimchaKit…
      </div>
    );
  }

  if (isCallback) {
    return <AuthCallback onComplete={() => window.location.replace("/")} />;
  }

  if (!session) {
    return <AuthPage />;
  }

  return (
    <div style={{
      display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", height:"100vh", background:"var(--bg-base)",
      fontFamily:"var(--font-body)", gap:16, padding:24, textAlign:"center",
    }}>
      <div style={{ fontSize:40 }}>✡</div>
      <div style={{ fontFamily:"var(--font-display)", fontSize:24, fontWeight:700, color:"var(--text-primary)" }}>
        Welcome to SimchaKit
      </div>
      <div style={{ fontSize:14, color:"var(--text-muted)", maxWidth:360 }}>
        Signed in as <strong>{session.user.email}</strong>
      </div>
      <div style={{ fontSize:13, color:"var(--text-muted)" }}>
        Event picker coming in Phase 4…
      </div>
      <button className="btn btn-secondary" style={{ marginTop:8 }}
        onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
    </div>
  );
}
