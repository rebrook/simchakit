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
        <div className="ax-login">
          <div className="ax-login-brand">
            <img src="/icon-192.png" alt="" width="44" height="44" />
            <h1>SimchaKit Admin</h1>
          </div>
          <p className="ax-login-sub">Brook Creative LLC</p>
          {sent ? (
            <div className="ax-sent" role="status">
              Magic link sent to <strong>{email}</strong>.<br />
              Check your email and click the link to sign in.
            </div>
          ) : (
            <>
              <label htmlFor="ax-email-in" className="ax-login-sub" style={{ display: "block", marginBottom: 6 }}>Email</label>
              <input
                id="ax-email-in"
                className="ax-input"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSendLink(); }}
                autoFocus
              />
              {sendError && <div className="ax-error" role="alert">{sendError}</div>}
              <button
                className="ax-btn block"
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
        <div className="ax-login">
          <div className="ax-login-brand"><h1>Access Denied</h1></div>
          <p className="ax-login-sub">
            {session.user.email} is not authorized to access this dashboard.
          </p>
          <button className="ax-btn block" onClick={() => supabase.auth.signOut()}>
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
  return <div className="ax-center">{children}</div>;
}

function Spinner() {
  return <div className="ax-spinner" />;
}
