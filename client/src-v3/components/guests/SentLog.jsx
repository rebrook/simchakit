// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.1.0 — components/guests/SentLog.jsx
// The "Messages" view in the Guests tab: every message_log row (email sends and
// manual "sent another way" marks) with per-household delivery status as labeled
// chips. Failed email rows offer "Retry failed", which sends the same message to
// just the failed households as a new log entry (the original stays as history;
// the household's chip follows the latest entry).
// Owners and editors can retry; viewers read only; archived events are read-only.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from "react";
import { SentChip } from "@/components/guests/SentChip.jsx";
import { kindLabel, channelLabel } from "@/utils/messageTemplates.js";
import { describeEntry, shortDate } from "@/utils/messageStatus.js";
import { callGuestApi, describeApiError } from "@/utils/messageApi.js";

const isFailed = (r) => r.status === "failed" || r.status === "bounced";

export function SentLog({ eventId, logs, recipients, error, loading, households, isArchived, isViewer, onChanged, showToast }) {
  const [openId,   setOpenId]   = useState(null);
  const [retrying, setRetrying] = useState(null);
  const [notice,   setNotice]   = useState("");

  const nameByKey = useMemo(() => new Map(households.map(h => [h._rowId, h.formalName || "Household"])), [households]);
  const byMessage = useMemo(() => {
    const m = new Map();
    recipients.forEach(r => {
      if (!m.has(r.messageId)) m.set(r.messageId, []);
      m.get(r.messageId).push(r);
    });
    return m;
  }, [recipients]);

  const retry = async (log, failedRows) => {
    setRetrying(log.id); setNotice("");
    const res = await callGuestApi("send", {
      eventId,
      kind:         log.kind,
      subject:      log.subject,
      bodyTemplate: log.body_snapshot,
      householdIds: failedRows.map(r => r.householdId),
    });
    setRetrying(null);
    if (!res.ok) { setNotice(describeApiError(res)); return; }
    const total = res.data.sent + res.data.failed;
    showToast?.(`Retried ${total} household${total !== 1 ? "s" : ""}: ${res.data.sent} sent${res.data.failed ? `, ${res.data.failed} failed` : ""}`);
    onChanged?.();
  };

  if (loading) return <div style={{ padding: "32px 0", textAlign: "center", color: "var(--text-muted)" }}>Loading messages…</div>;

  if (error) {
    return (
      <div className="msg-notice error" role="alert">
        Message history could not be loaded. Households still show their existing sent status. If this is a new setup, the V5.0-M2 database update may not have been applied yet.
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 18, marginBottom: 8 }}>No messages yet</div>
        <div style={{ fontSize: 13 }}>Messages you send, and mailings you record as sent another way, will appear here.</div>
      </div>
    );
  }

  return (
    <div className="msg-log">
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 4px" }}>
        Households marked sent before messaging was added show as "Sent (manual)" in the guest list and are not listed here.
      </p>
      {notice && <div className="msg-notice error" role="alert">{notice}</div>}
      {logs.map(log => {
        const rows = byMessage.get(log.id) || [];
        const failedRows = rows.filter(isFailed);
        const isOpen = openId === log.id;
        const canRetry = !isViewer && !isArchived && (log.channel || "email") === "email" && failedRows.length > 0;
        return (
          <div key={log.id} className="msg-log-item">
            <button type="button" className="msg-log-head" aria-expanded={isOpen} onClick={() => setOpenId(isOpen ? null : log.id)}>
              <span className="msg-log-title">{kindLabel(log.kind)}</span>
              <span className="tag tag-muted" style={{ fontSize: 11 }}>{channelLabel(log.channel)}</span>
              <span className="msg-log-meta">{shortDate(log.sent_at)}</span>
              <span className="msg-log-meta">{log.recipient_count} household{log.recipient_count !== 1 ? "s" : ""}</span>
              {failedRows.length > 0 && (
                <span className="msg-chip failed compact"><span className="msg-chip-shape" aria-hidden="true">▲</span> {failedRows.length} failed</span>
              )}
            </button>
            {isOpen && (
              <div className="msg-log-detail">
                {(log.channel || "email") === "email" && <div className="msg-log-meta">Subject: {log.subject}</div>}
                {rows.map(r => (
                  <div key={r.householdId} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <span style={{ minWidth: 160, fontWeight: 600 }}>{nameByKey.get(r.householdId) || "Removed household"}</span>
                    <SentChip status={describeEntry({ status: r.status, channel: log.channel, sentAt: log.sent_at })} kindLabel={kindLabel(log.kind)} showKind={false} />
                    {r.email && <span className="msg-log-meta">{r.email}</span>}
                  </div>
                ))}
                {canRetry && (
                  <div>
                    <button type="button" className="btn btn-secondary btn-sm" disabled={retrying === log.id}
                      onClick={() => retry(log, failedRows)}>
                      {retrying === log.id ? "Retrying…" : `Retry failed (${failedRows.length})`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
