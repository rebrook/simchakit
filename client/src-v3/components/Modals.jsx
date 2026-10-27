// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.11.0 — Modals.jsx
// GuideModal: unchanged from V2.
// ActivityLogModal: reads from Supabase audit_log table directly.
// WhatsNewModal: moved to WhatsNewModal.jsx; reads the small whats-new/*.json files (V5.4-W1).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { supabase }            from "@/lib/supabase.js";
import { GUIDE_SECTIONS, ACTION_COLORS } from "@/constants/ui.js";
import { Icon }                from "@/utils/iconMap.jsx";
import { ConfirmDialog }       from "@/components/shared/ConfirmDialog.jsx";

// ── GuideModal ────────────────────────────────────────────────────────────────
// target: { section, topic } from #/guide/section/topic. Opens that section and scrolls to the topic.
const guideSlug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export function GuideModal({ onClose, target = null }) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const [collapsed, setCollapsed] = useState(() =>
    isMobile ? Object.fromEntries(GUIDE_SECTIONS.filter(s => s.id !== target?.section).map(s => [s.id, true])) : {}
  );
  useEffect(() => {
    if (!target?.topic) return;
    const t = setTimeout(() => document.getElementById(`guide-${target.section}-${target.topic}`)?.scrollIntoView({ block: "start" }), 60);
    return () => clearTimeout(t);
  }, [target]);
  const toggle = (id) => setCollapsed(c => ({ ...c, [id]: !c[id] }));

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg" style={{ maxWidth:700, display:"flex", flexDirection:"column", overflow:"hidden" }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title"><Icon name="bookOpen" context="menu" style={{ marginRight: 6 }} /> SimchaKit Guide</div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" context="button" /></button>
        </div>
        <div className="modal-body" style={{ overflowY:"auto", flex:1, minHeight:0, paddingTop:16 }}>

          <div style={{ background:"linear-gradient(135deg, var(--accent-dark) 0%, var(--accent-primary) 100%)", borderRadius:"var(--radius-md)", padding:"20px 24px", marginBottom:24 }}>
            <div style={{ fontSize:15, fontWeight:800, color:"#fff", marginBottom:6 }}>Welcome to SimchaKit</div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.85)", lineHeight:1.7 }}>
              SimchaKit is an event planning dashboard for B'nei Mitzvot, weddings, and other simchas. Everything you need — guests, budget, vendors, tasks, seating, gifts, and a planning calendar — in one place, synced across all your devices.
            </div>
            <a
              href="https://about.simcha-kit.com/resources/new-user-training.html"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display:"inline-flex", alignItems:"center", gap:6, marginTop:14, padding:"9px 16px", borderRadius:"var(--radius-sm)", background:"rgba(255,255,255,0.18)", border:"1px solid rgba(255,255,255,0.35)", color:"#fff", fontSize:13, fontWeight:700, textDecoration:"none" }}
            >
              <Icon name="bookOpen" context="inline" /> Open the new user training slides
            </a>
          </div>

          {GUIDE_SECTIONS.map(section => {
            const isCollapsed = !!collapsed[section.id];
            return (
              <div key={section.id} style={{ border:"1px solid var(--border)", borderRadius:"var(--radius-md)", marginBottom:12, overflow:"hidden" }}>
                <button onClick={() => toggle(section.id)} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"13px 18px", background:isCollapsed?"var(--bg-surface)":"var(--bg-subtle)", border:"none", cursor:"pointer", borderBottom:isCollapsed?"none":"1px solid var(--border)", transition:"background 0.15s ease", textAlign:"left" }}>
                  <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:28, height:28, borderRadius:"var(--radius-sm)", background:section.colorLight, border:"1px solid var(--border)", flexShrink:0 }}><Icon name={section.icon} context="inline" /></span>
                  <span style={{ fontSize:15, fontWeight:700, color:"var(--text-primary)", flex:1 }}>{section.title}</span>
                  <span style={{ color:"var(--text-muted)", transform:isCollapsed?"none":"rotate(180deg)", transition:"transform 0.2s ease", display:"inline-flex" }}><Icon name="chevronDown" context="inline" /></span>
                </button>
                {!isCollapsed && (
                  <div style={{ padding:"16px 18px", background:"var(--bg-surface)" }}>
                    {section.items.map((item, i) => (
                      <div key={i} id={`guide-${section.id}-${guideSlug(item.heading)}`} style={{ marginBottom:i<section.items.length-1?16:0, paddingBottom:i<section.items.length-1?16:0, borderBottom:i<section.items.length-1?"1px solid var(--border)":"none" }}>
                        <div style={{ fontSize:13, fontWeight:700, color:section.color, marginBottom:4 }}>{item.heading}</div>
                        <div style={{ fontSize:13, color:"var(--text-secondary)", lineHeight:1.65 }}>{item.body}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ textAlign:"center", padding:"16px 0 8px", fontSize:12, color:"var(--text-muted)" }}>
            SimchaKit · Brook Creative LLC
          </div>
        </div>
      </div>
    </div>
  );
}

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
