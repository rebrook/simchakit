// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.11.0 — Modals.jsx
// GuideModal: moved to components/guide/ (V5-H1).
// ActivityLogModal: reads from Supabase audit_log table directly.
// WhatsNewModal: moved to WhatsNewModal.jsx; reads the small whats-new/*.json files (V5.4-W1).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { supabase }            from "@/lib/supabase.js";
import { ACTION_COLORS } from "@/constants/ui.js";
import { Icon }                from "@/utils/iconMap.jsx";
import { ConfirmDialog }       from "@/components/shared/ConfirmDialog.jsx";

// ── GuideModal ────────────────────────────────────────────────────────────────
// Lives in components/guide/ (V5-H1). Re-exported so existing imports keep working.
export { GuideModal } from "@/components/guide/GuideModal.jsx";

// ── ActivityLogModal ──────────────────────────────────────────────────────────
export function ActivityLogModal({ eventId, isArchived, onClose }) {
  const [entries,          setEntries]          = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [filterAction,     setFilterAction]     = useState("All");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    async function load() {
      const { data } = await supabase
        .from("audit_log")
        .select("id, data, created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(500);
      setEntries((data || []).map(row => ({
        id:         row.id,
        action:     row.data?.action || "Updated",
        detail:     row.data?.detail || "",
        actorName:  row.data?.actorName || null,
        created_at: row.created_at,
      })));
      setLoading(false);
    }
    load();
  }, [eventId]);

  const fmt = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }) +
      " · " + d.toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" });
  };

  const filtered = entries.filter(e =>
    filterAction === "All" || e.action === filterAction
  );

  const handleClear = async () => {
    await supabase.from("audit_log").delete().eq("event_id", eventId);
    setEntries([]);
    setShowClearConfirm(false);
  };

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg" style={{ maxWidth:640, display:"flex", flexDirection:"column", overflow:"hidden" }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title"><Icon name="clipboardList" context="menu" style={{ marginRight: 6 }} /> Activity Log</div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" context="button" /></button>
        </div>

        {/* Filter bar — pinned between header and scroll body */}
        <div style={{ display:"flex", gap:8, padding:"0 24px 12px", flexWrap:"wrap", alignItems:"center", justifyContent:"space-between", flexShrink:0, borderBottom:"1px solid var(--border)" }}>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {["All","Added","Updated","Deleted","Completed"].map(a => (
              <button key={a} onClick={() => setFilterAction(a)} style={{ padding:"4px 12px", borderRadius:99, fontSize:12, fontWeight:600, cursor:"pointer", border:"none", transition:"all 0.15s", background:filterAction===a?"var(--accent-primary)":"var(--bg-subtle)", color:filterAction===a?"white":"var(--text-secondary)" }}>{a}</button>
            ))}
          </div>
          {!isArchived && entries.length > 0 && (
            <button onClick={() => setShowClearConfirm(true)} style={{ padding:"4px 12px", borderRadius:99, fontSize:12, fontWeight:600, cursor:"pointer", border:"1px solid var(--border)", background:"var(--bg-surface)", color:"var(--text-muted)" }}>Clear Log</button>
          )}
        </div>

        {/* Clear Log confirmation dialog */}
        {showClearConfirm && (
          <ConfirmDialog
            title="Clear Activity Log?"
            message="This will permanently wipe all activity log entries. This cannot be undone."
            confirmLabel="Clear Log"
            onConfirm={handleClear}
            onClose={() => setShowClearConfirm(false)}
          />
        )}

        <div className="modal-body" style={{ overflowY:"auto", flex:1, minHeight:0, paddingTop:12 }}>
          {loading ? (
            <div style={{ textAlign:"center", padding:40, color:"var(--text-muted)", fontSize:14 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign:"center", padding:"48px 24px", color:"var(--text-muted)", fontSize:13 }}>
              <div style={{ marginBottom:12 }}><Icon name="clipboardList" context="empty" /></div>
              <div style={{ fontSize:16, fontWeight:700, marginBottom:6, color:"var(--text-primary)" }}>
                {filterAction==="All" ? "No activity yet" : `No ${filterAction} entries`}
              </div>
              <div style={{ fontSize:12, lineHeight:1.6 }}>Changes to guests, expenses, vendors, tasks, and gifts will appear here.</div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              {filtered.map((entry, i) => {
                const ac = ACTION_COLORS[entry.action] || ACTION_COLORS["Updated"];
                return (
                  <div key={entry.id} style={{ display:"flex", gap:12, alignItems:"flex-start", padding:"10px 12px", background:i%2===0?"var(--bg-surface)":"var(--bg-subtle)", borderRadius:"var(--radius-sm)", border:"1px solid var(--border)" }}>
                    <span style={{ fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:99, flexShrink:0, marginTop:2, background:ac.bg, color:ac.color, whiteSpace:"nowrap" }}>{entry.action}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, color:"var(--text-primary)", lineHeight:1.5 }}>
                        {entry.actorName && <span style={{ fontWeight:600 }}>{entry.actorName} &middot; </span>}
                        {entry.detail}
                      </div>
                      <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:3 }}>{fmt(entry.created_at)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── WhatsNewModal ─────────────────────────────────────────────────────────────
// Lives in WhatsNewModal.jsx (V5.4-W1). Re-exported so existing imports keep working.
export { WhatsNewModal } from "./WhatsNewModal.jsx";
