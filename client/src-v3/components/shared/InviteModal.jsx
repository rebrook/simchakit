// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.6.0 — InviteModal.jsx
// Lightweight inline invite modal. Opens from sidebar or solo-event prompt.
// Does NOT require admin password. Gated by role (owner/editor) in AppShell.
// Editors can invite viewers or coordinators only (not editors).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { Icon } from "@/utils/iconMap.jsx";

const ROLE_OPTIONS = [
  { value: "editor",      label: "Editor",      desc: "Full planning access" },
  { value: "viewer",      label: "Viewer",      desc: "Read-only access" },
  { value: "coordinator", label: "Coordinator", desc: "Ceremony & Prep only" },
];

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function InviteModal({
  eventId,
  eventName,
  userId,
  collaboratorRole,
  currentCollabCount = 0,
  onClose,
  onInviteSent,
}) {
  const [email, setEmail]       = useState("");
  const [role, setRole]         = useState("editor");
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState(null);
  const [success, setSuccess]   = useState(null);
  const emailRef                = useRef(null);

  // Auto-focus email input on mount
  useEffect(() => {
    const t = setTimeout(() => emailRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  // Escape to close
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Editors cannot select "editor" role
  const isEditor = collaboratorRole === "editor";
  const availableRoles = isEditor
    ? ROLE_OPTIONS.filter(r => r.value !== "editor")
    : ROLE_OPTIONS;

  // If editor's default role is "editor", fix it
  useEffect(() => {
    if (isEditor && role === "editor") setRole("viewer");
  }, [isEditor, role]);

  const slotsUsed = currentCollabCount;
  const slotsLeft = Math.max(0, 5 - slotsUsed);
  const isCoordinatorInvite = role === "coordinator";

  async function handleSend() {
    setError(null);
    const trimmed = email.trim().toLowerCase();

    if (!trimmed) {
      setError("Enter an email address.");
      emailRef.current?.focus();
      return;
    }
    if (!isValidEmail(trimmed)) {
      setError("Enter a valid email address.");
      emailRef.current?.focus();
      return;
    }
    if (!isCoordinatorInvite && slotsLeft <= 0) {
      setError("This event has reached the 5-collaborator limit.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/send-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          inviteeEmail: trimmed,
          role,
          eventName,
          userId,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        const msgs = {
          NOT_AUTHORIZED:       "You don't have permission to send invitations.",
          ESCALATION_DENIED:    "Editors cannot invite other editors.",
          CAP_REACHED:          "This event has reached the 5-collaborator limit.",
          ALREADY_COLLABORATOR: "This person is already a collaborator.",
          INVALID_ROLE:         "Please select a valid role.",
        };
        setError(msgs[data.error] || data.error || "Could not send invitation. Please try again.");
        setSending(false);
        return;
      }

      if (data.warning) {
        // Invitation created but email failed. Show the link to copy.
        setSuccess({ email: trimmed, warning: data.warning, inviteUrl: data.inviteUrl });
      } else {
        setSuccess({ email: trimmed });
      }
      setSending(false);
      if (onInviteSent) onInviteSent();
    } catch {
      setError("Network error. Please try again.");
      setSending(false);
    }
  }

  // Arrow key navigation for radio group
  function handleRoleKeyDown(e) {
    const idx = availableRoles.findIndex(r => r.value === role);
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      const next = (idx + 1) % availableRoles.length;
      setRole(availableRoles[next].value);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = (idx - 1 + availableRoles.length) % availableRoles.length;
      setRole(availableRoles[prev].value);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Invite a co-planner">

        {/* Header */}
        <div className="modal-header">
          <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
            Invite a co-planner
          </span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}
            aria-label="Close"
          >
            <Icon name="x" context="button" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "0 24px 24px" }}>

          {/* Success state */}
          {success ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 36, marginBottom: 12, color: "var(--green)" }}>
                <Icon name="check" context="empty" />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
                Invitation sent to {success.email}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                They'll appear here once they accept.
              </div>
              {success.warning && (
                <div style={{
                  marginTop: 12, padding: "10px 14px", borderRadius: "var(--radius-sm)",
                  background: "var(--orange-light)", border: "1px solid var(--orange)",
                  fontSize: 13, color: "var(--text-primary)", textAlign: "left",
                }}>
                  {success.warning}
                  {success.inviteUrl && (
                    <button
                      style={{
                        display: "block", marginTop: 8, background: "none", border: "none",
                        color: "var(--accent-primary)", cursor: "pointer", fontWeight: 600,
                        fontSize: 13, padding: 0, fontFamily: "var(--font-body)",
                      }}
                      onClick={() => {
                        navigator.clipboard.writeText(success.inviteUrl);
                      }}
                    >
                      <Icon name="link" context="inline" /> Copy invite link
                    </button>
                  )}
                </div>
              )}
              <button
                className="btn btn-secondary"
                style={{ marginTop: 16 }}
                onClick={onClose}
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Slots indicator */}
              {!isCoordinatorInvite && (
                <div style={{
                  fontSize: 12, color: slotsLeft <= 1 ? "var(--red)" : "var(--text-muted)",
                  fontWeight: 600, marginBottom: 14,
                }}>
                  {slotsUsed} of 5 collaborator slots used
                  {slotsLeft === 0 && " (limit reached)"}
                </div>
              )}
              {isCoordinatorInvite && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, marginBottom: 14 }}>
                  Coordinators don't count toward the 5-collaborator limit
                </div>
              )}

              {/* Email input */}
              <label style={{ display: "block", marginBottom: 14 }}>
                <span style={{
                  display: "block", fontSize: 12, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.04em",
                  color: "var(--text-muted)", marginBottom: 5,
                }}>
                  Email address
                </span>
                <input
                  ref={emailRef}
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  placeholder="co-planner@example.com"
                  style={{
                    width: "100%", padding: "10px 12px", fontSize: 15,
                    border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                    background: "var(--bg-base)", color: "var(--text-primary)",
                    fontFamily: "var(--font-body)", outline: "none",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "var(--accent-primary)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                  autoComplete="email"
                />
              </label>

              {/* Role picker (radiogroup) */}
              <div style={{ marginBottom: 14 }}>
                <span style={{
                  display: "block", fontSize: 12, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.04em",
                  color: "var(--text-muted)", marginBottom: 8,
                }}>
                  Role
                </span>
                <div role="radiogroup" aria-label="Collaborator role" onKeyDown={handleRoleKeyDown}
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  {availableRoles.map((opt) => (
                    <label
                      key={opt.value}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 10,
                        padding: "9px 12px", borderRadius: "var(--radius-sm)",
                        border: `1px solid ${role === opt.value ? "var(--accent-primary)" : "var(--border)"}`,
                        background: role === opt.value ? "var(--accent-light)" : "var(--bg-base)",
                        cursor: "pointer", transition: "all 0.12s ease",
                      }}
                    >
                      <input
                        type="radio"
                        name="invite-role"
                        role="radio"
                        value={opt.value}
                        checked={role === opt.value}
                        onChange={() => setRole(opt.value)}
                        aria-checked={role === opt.value}
                        tabIndex={role === opt.value ? 0 : -1}
                        style={{ marginTop: 2, accentColor: "var(--accent-primary)" }}
                      />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                          {opt.label}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>
                          {opt.desc}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  padding: "8px 12px", borderRadius: "var(--radius-sm)",
                  background: "var(--red-light)", border: "1px solid var(--red)",
                  fontSize: 13, color: "var(--text-primary)", marginBottom: 14,
                }}>
                  {error}
                </div>
              )}

              {/* Send button */}
              <button
                className="btn btn-primary"
                onClick={handleSend}
                disabled={sending}
                style={{ width: "100%", justifyContent: "center" }}
              >
                {sending ? "Sending..." : "Send Invitation"}
              </button>

              {/* Magic link helper */}
              <div style={{
                fontSize: 12, color: "var(--text-muted)", textAlign: "center",
                marginTop: 10, lineHeight: 1.4,
              }}>
                They'll get a magic link, no password needed.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
