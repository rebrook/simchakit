// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit Admin — App.admin.jsx
// Auth-aware root. Verifies user is in admin_users before showing the dashboard.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { supabase }     from "@/lib/supabase.js";
import { AdminShell }   from "@/components/AdminShell.jsx";

export default function AppAdmin() {
  const [session,    setSession]    = useState(undefined); // undefined = loading
  const [isAdmin,    setIsAdmin]    = useState(false);
  const [checking,   setChecking]   = useState(false);
  const [email,      setEmail]      = useState("");
  const [sent,       setSent]       = useState(false);
  const [sending,    setSending]    = useState(false);
  const [sendError,  setSendError]  = useState("");

  const isCallback = window.location.hash.includes("access_token") ||
                     window.location.search.includes("code=");

  // Handle magic link callback
  useEffect(() => {
    if (isCallback) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) window.location.replace("/");
      });
    }
  }, [isCallback]);

  // Auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Check admin_users when session is set
  useEffect(() => {
    if (!session?.user) { setIsAdmin(false); return; }
    setChecking(true);
    supabase
      .from("admin_users")
      .select("id")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        setIsAdmin(!!data);
        setChecking(false);
      });
  }, [session]);

  async function handleSendLink() {
    if (!email.trim()) return;
    setSending(true);
    setSendError("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) { setSendError(error.message); setSending(false); }
    else { setSent(true); setSending(false); }
  }

  // Loading
  if (session === undefined || isCallback || checking) {
    return <Centered><Spinner />Loading…</Centered>;
  }

  // Not signed in — show sign-in form
  if (!session) {
    return (
      <Centered>
        <div style={styles.loginCard}>
          <div style={styles.loginTitle}>SimchaKit Admin</div>
          <div style={styles.loginSub}>Brook Creative LLC</div>
          {sent ? (
            <div style={styles.sentMsg}>
              ✓ Magic link sent to <strong>{email}</strong>.<br />
              Check your email and click the link to sign in.
            </div>
          ) : (
            <>
              <input
                style={styles.loginInput}
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSendLink(); }}
                autoFocus
              />
              {sendError && <div style={styles.loginError}>{sendError}</div>}
              <button
                style={{ ...styles.loginBtn, opacity: sending || !email.trim() ? 0.5 : 1 }}
                onClick={handleSendLink}
                disabled={sending || !email.trim()}
              >
                {sending ? "Sending…" : "Send Magic Link"}
              </button>
            </>
          )}
        </div>
      </Centered>
    );
  }

  // Signed in but not admin
  if (!isAdmin) {
    return (
      <Centered>
        <div style={styles.loginCard}>
          <div style={styles.loginTitle}>Access Denied</div>
            <div style={{ ...styles.loginSub, marginTop: 8 }}>
            {session.user.email} is not authorized to access this dashboard.
          </div>
          <button style={{ ...styles.loginBtn, marginTop: 20 }} onClick={() => supabase.auth.signOut()}>
            Sign Out
          </button>
        </div>
      </Centered>
    );
  }

  // Authorized admin
  return <AdminShell session={session} />;
}

function Centered({ children }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "#f8f9fa", fontFamily: "system-ui, sans-serif",
      gap: 10, color: "#666", fontSize: 14,
    }}>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{
      width: 18, height: 18, border: "2px solid #ddd",
      borderTopColor: "#666", borderRadius: "50%",
      animation: "spin 0.8s linear infinite", flexShrink: 0,
    }} />
  );
}

const styles = {
  loginCard: {
    background: "white", borderRadius: 12, padding: "36px 32px",
    boxShadow: "0 2px 16px rgba(0,0,0,0.08)", width: 360,
    fontFamily: "system-ui, sans-serif",
  },
  loginTitle: {
    fontSize: 22, fontWeight: 700, color: "#111", marginBottom: 4,
  },
  loginSub: {
    fontSize: 13, color: "#888", marginBottom: 24,
  },
  loginInput: {
    width: "100%", padding: "10px 12px", border: "1px solid #ddd",
    borderRadius: 8, fontSize: 14, outline: "none",
    boxSizing: "border-box", marginBottom: 10,
  },
  loginBtn: {
    width: "100%", padding: "10px 0", background: "#111", color: "white",
    border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600,
    cursor: "pointer", transition: "opacity 0.2s",
  },
  loginError: {
    fontSize: 12, color: "#c00", marginBottom: 8,
  },
  sentMsg: {
    fontSize: 13, color: "#333", lineHeight: 1.6,
    background: "#f0faf0", border: "1px solid #b3e6b3",
    borderRadius: 8, padding: "12px 14px",
  },
};
