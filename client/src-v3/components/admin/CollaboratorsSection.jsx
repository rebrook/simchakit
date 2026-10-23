// Moved verbatim from AdminPanel.jsx (V4.44.0 module split) — no behavior changes.
import { useState, useEffect } from "react";
import { supabase }          from "@/lib/supabase.js";
import { Icon }                          from "@/utils/iconMap.jsx";

// ─────────────────────────────────────────────────────────────────────────────
// CollaboratorsSection
// Renders inside AdminPanel (owner-only). Manages invite flow and collaborator list.
// ─────────────────────────────────────────────────────────────────────────────

export function CollaboratorsSection({ eventId, userId, eventName }) {
  const [collaborators,  setCollaborators]  = useState([]);
  const [invitations,    setInvitations]    = useState([]); // pending (not yet accepted)
  const [loadStatus,     setLoadStatus]     = useState("loading");
  const [inviteEmail,    setInviteEmail]    = useState("");
  const [inviteRole,     setInviteRole]     = useState("editor");
  const [inviteMessage,  setInviteMessage]  = useState("");
  const [sending,        setSending]        = useState(false);
  const [sendResult,     setSendResult]     = useState(null); // { ok, message }
  const [copyStatus,     setCopyStatus]     = useState(null); // null | 'copying' | 'copied'
  const [removing,       setRemoving]       = useState(null); // collaborator id being removed

  const COLLABORATOR_CAP = 5;
  const totalCount = collaborators.length + invitations.length;

  useEffect(() => {
    loadCollaborators();
  }, [eventId]);

  async function loadCollaborators() {
    setLoadStatus("loading");
    const [collabRes, inviteRes] = await Promise.all([
      supabase.rpc("get_event_collaborators", { p_event_id: eventId }),
      supabase
        .from("event_invitations")
        .select("id, email, role, created_at, expires_at")
        .eq("event_id", eventId)
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true }),
    ]);

    // Email is stored directly on event_collaborators row at accept time
    setCollaborators(collabRes.data || []);
    setInvitations(inviteRes.data || []);
    setLoadStatus("ready");
  }

  async function handleSendInvite(e) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch("/api/send-invite", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          eventId,
          inviteeEmail: inviteEmail.trim(),
          role:         inviteRole,
          eventName:    eventName,
          userId:       userId,
          message:      inviteMessage.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.sent) {
        setSendResult({ ok: true, message: `Invitation sent to ${inviteEmail.trim()}.` });
        setInviteEmail("");
        setInviteMessage("");
        loadCollaborators();
      } else if (data.warning) {
        setSendResult({ ok: true, message: `Invitation created. Email delivery failed -- share this link: ${data.inviteUrl}` });
        loadCollaborators();
      } else {
        const msgs = {
          CAP_REACHED:          "This event has reached the 5-collaborator limit.",
          ALREADY_COLLABORATOR: "This person is already a collaborator on this event.",
          NOT_OWNER:            "Only the event owner can send invitations.",
          INVALID_ROLE:         "Please select a valid role.",
        };
        setSendResult({ ok: false, message: msgs[data.error] || "Could not send invitation. Please try again." });
      }
    } catch {
      setSendResult({ ok: false, message: "Network error. Please try again." });
    }
    setSending(false);
  }

  async function handleCopyLink() {
    setCopyStatus("copying");
    try {
      const res = await fetch("/api/send-invite", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          eventId,
          role:        inviteRole,
          eventName:   eventName,
          userId:      userId,
        }),
      });
      const data = await res.json();
      if (data.inviteUrl) {
        await navigator.clipboard.writeText(data.inviteUrl);
        setCopyStatus("copied");
        setTimeout(() => setCopyStatus(null), 2500);
        loadCollaborators();
      } else {
        setCopyStatus(null);
      }
    } catch {
      setCopyStatus(null);
    }
  }

  async function handleRemove(collaboratorId) {
    setRemoving(collaboratorId);
    await supabase
      .from("event_collaborators")
      .delete()
      .eq("id", collaboratorId)
      .eq("event_id", eventId);
    setRemoving(null);
    loadCollaborators();
  }

  async function handleRescindInvitation(invitationId) {
    await supabase
      .from("event_invitations")
      .delete()
      .eq("id", invitationId)
      .eq("event_id", eventId);
    loadCollaborators();
  }

  const atCap = totalCount >= COLLABORATOR_CAP;

  return (
    <div className="admin-section">
      <div className="admin-section-title">Collaborators</div>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.6 }}>
        Invite others to help plan this event. Editors can add and edit planning data. Viewers can follow along without making changes. Collaborators are covered by your purchase at no extra cost.
      </p>

      {/* ── Count indicator ── */}
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
        {totalCount} of {COLLABORATOR_CAP} collaborators
        {atCap && <span style={{ color: "var(--gold)", fontWeight: 600, marginLeft: 8 }}>Limit reached</span>}
      </div>

      {/* ── Current collaborators ── */}
      {loadStatus === "ready" && collaborators.length > 0 && (
        <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          {collaborators.map(c => (
            <div key={c.id} style={{
              display:      "flex",
              alignItems:   "center",
              justifyContent: "space-between",
              gap:          12,
              padding:      "10px 12px",
              background:   "var(--bg-subtle)",
              borderRadius: "var(--radius-sm)",
              border:       "1px solid var(--border)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span style={{ fontSize: 16 }}>{c.role === "editor" ? <Icon name="pencil" context="inline" /> : c.role === "coordinator" ? <Icon name="ceremony" context="inline" /> : <Icon name="eye" context="inline" />}</span>
                <div style={{ minWidth: 0 }}>
                  {c.display_name && (
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{c.display_name}</div>
                  )}
                  {c.email && <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 1 }}>{c.email}</div>}
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, textTransform: "capitalize" }}>{c.role} · Joined {new Date(c.accepted_at).toLocaleDateString()}</div>
                </div>
              </div>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 11, padding: "4px 10px", color: "var(--red)", flexShrink: 0 }}
                onClick={() => handleRemove(c.id)}
                disabled={removing === c.id}
              >
                {removing === c.id ? "Removing…" : "Remove"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Pending invitations ── */}
      {loadStatus === "ready" && invitations.length > 0 && (
        <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Pending</div>
          {invitations.map(inv => (
            <div key={inv.id} style={{
              display:      "flex",
              alignItems:   "center",
              justifyContent: "space-between",
              gap:          12,
              padding:      "10px 12px",
              background:   "var(--bg-subtle)",
              borderRadius: "var(--radius-sm)",
              border:       "1px dashed var(--border)",
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "capitalize" }}>{inv.role} -- {inv.email || "Link invite"}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Expires {new Date(inv.expires_at).toLocaleDateString()}</div>
              </div>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 11, padding: "4px 10px", color: "var(--text-muted)", flexShrink: 0 }}
                onClick={() => handleRescindInvitation(inv.id)}
              >
                Rescind
              </button>
            </div>
          ))}
        </div>
      )}

      {loadStatus === "ready" && collaborators.length === 0 && invitations.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>No collaborators yet.</div>
      )}

      {/* ── Invite form ── */}
      {!atCap && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>Send an Invitation</div>

          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="form-input" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
              <option value="editor">Editor: full planning access</option>
              <option value="viewer">Viewer: read-only access</option>
              <option value="coordinator">Ritual Coordinator: ceremony and prep only</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Email address</label>
            <input
              className="form-input"
              type="email"
              placeholder="co-planner@example.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Personal message (optional)</label>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder="Add a note to your invitation…"
              value={inviteMessage}
              onChange={e => setInviteMessage(e.target.value)}
            />
          </div>

          {sendResult && (
            <div style={{
              fontSize:     12,
              padding:      "8px 12px",
              borderRadius: "var(--radius-sm)",
              marginBottom: 12,
              background:   sendResult.ok ? "var(--green-light)" : "var(--red-light)",
              color:        sendResult.ok ? "var(--green)" : "var(--red)",
              border:       `1px solid ${sendResult.ok ? "var(--green)" : "var(--red)"}`,
            }}>
              {sendResult.message}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              className="btn btn-primary"
              onClick={handleSendInvite}
              disabled={sending || !inviteEmail.trim()}
            >
              {sending ? "Sending…" : "Send Invitation"}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleCopyLink}
              disabled={copyStatus === "copying"}
              title="Generate a shareable invite link without sending an email"
            >
              {copyStatus === "copied" ? <><Icon name="check" context="badge" /> Copied!</> : copyStatus === "copying" ? "Generating…" : "Copy Invite Link"}
            </button>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
            Invite links expire after 7 days. Use "Copy Invite Link" to share via message instead of email.
          </div>
        </div>
      )}
    </div>
  );
}
