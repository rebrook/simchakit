// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — CeremonyRolesTab.jsx
// Ported from V2. Ceremony roles stored as a single document in ceremony_roles
// table (one row per event, data.roles = array of role objects).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { supabase }      from "@/lib/supabase.js";
import { ArchivedNotice } from "@/components/shared/ArchivedNotice.jsx";

// ── Role templates ────────────────────────────────────────────────────────────
function newRoleId() { return "cr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7); }

function buildMitzvahTemplate() {
  return [
    { section: "Torah Service", role: "Aliyah 1 — Kohen",        assignee: "", hebrewName: "", notes: "Often grandparents or older siblings" },
    { section: "Torah Service", role: "Aliyah 2 — Levi",         assignee: "", hebrewName: "", notes: "Often grandparents or older siblings" },
    { section: "Torah Service", role: "Aliyah 3 — Parents",      assignee: "", hebrewName: "", notes: "Usually the parents" },
    { section: "Torah Service", role: "Aliyah 4 — Maftir",       assignee: "", hebrewName: "", notes: "Bar/Bat Mitzvah" },
    { section: "Torah Service", role: "Hagbah (Lifting Torah)",   assignee: "", hebrewName: "", notes: "Must be someone with prior experience — Torah weighs ~50 lbs" },
    { section: "Torah Service", role: "Gelilah (Dressing Torah)", assignee: "", hebrewName: "", notes: "Rolls and dresses the Torah after reading" },
    { section: "Torah Service", role: "Opening Ark",              assignee: "", hebrewName: "", notes: "Opens ark and hands Torah to cantor; appropriate for non-Jewish family" },
    { section: "Torah Service", role: "Returning Torah",          assignee: "", hebrewName: "", notes: "Opens ark when Torah is returned; appropriate for non-Jewish family" },
    { section: "English Readings", role: "Prayer for Our Country", assignee: "", hebrewName: "", notes: "" },
    { section: "English Readings", role: "Prayer for Israel",      assignee: "", hebrewName: "", notes: "" },
    { section: "English Readings", role: "Prayer for Peace",       assignee: "", hebrewName: "", notes: "" },
    { section: "Service Participation", role: "Parental Blessing / Speech", assignee: "", hebrewName: "", notes: "Brief is better — 150 words or less recommended" },
    { section: "Service Participation", role: "Ushers",             assignee: "", hebrewName: "", notes: "Assist with distributing prayer books" },
    { section: "Service Participation", role: "Friday Evening Service", assignee: "", hebrewName: "", notes: "Note participation — Yes / No" },
    { section: "Service Participation", role: "Morning Minyan",     assignee: "", hebrewName: "", notes: "Monday or Thursday morning the week prior" },
  ].map((r, i) => ({ ...r, id: newRoleId(), sortOrder: i }));
}

function buildWeddingTemplate() {
  return [
    { section: "Wedding Party",      role: "Officiant",              assignee: "", hebrewName: "", notes: "" },
    { section: "Wedding Party",      role: "Best Man",               assignee: "", hebrewName: "", notes: "" },
    { section: "Wedding Party",      role: "Maid / Matron of Honor", assignee: "", hebrewName: "", notes: "" },
    { section: "Wedding Party",      role: "Groomsmen",              assignee: "", hebrewName: "", notes: "" },
    { section: "Wedding Party",      role: "Bridesmaids",            assignee: "", hebrewName: "", notes: "" },
    { section: "Ceremony Roles",     role: "Flower Girl",            assignee: "", hebrewName: "", notes: "" },
    { section: "Ceremony Roles",     role: "Ring Bearer",            assignee: "", hebrewName: "", notes: "" },
    { section: "Ceremony Roles",     role: "Candle Lighters",        assignee: "", hebrewName: "", notes: "" },
    { section: "Ceremony Roles",     role: "Ketubah Witnesses",      assignee: "", hebrewName: "", notes: "Two witnesses required; must be Jewish in most traditions" },
    { section: "Readings & Blessings", role: "Reader 1",             assignee: "", hebrewName: "", notes: "" },
    { section: "Readings & Blessings", role: "Reader 2",             assignee: "", hebrewName: "", notes: "" },
    { section: "Readings & Blessings", role: "Reader 3",             assignee: "", hebrewName: "", notes: "" },
  ].map((r, i) => ({ ...r, id: newRoleId(), sortOrder: i }));
}

const ROLE_TEMPLATES = {
  "bat-mitzvah":  buildMitzvahTemplate(),
  "bar-mitzvah":  buildMitzvahTemplate(),
  "bnei-mitzvah": buildMitzvahTemplate(),
  "wedding":      buildWeddingTemplate(),
};

// ── CeremonyRolesTab ──────────────────────────────────────────────────────────
export function CeremonyRolesTab({ eventId, event, adminConfig, showToast, isArchived }) {
  const [roles,         setRoles]         = useState([]);
  const [rowId,         setRowId]         = useState(null); // Supabase row UUID
  const [loading,       setLoading]       = useState(true);
  const [showModal,     setShowModal]     = useState(false);
  const [editRole,      setEditRole]      = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [search,        setSearch]        = useState("");
  const [filterSection, setFilterSection] = useState("all");
  const [isMobile,      setIsMobile]      = useState(() => window.innerWidth < 640);

  const eventType = adminConfig?.type || "other";
  const hasTemplate = !!ROLE_TEMPLATES[eventType];

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!eventId) return;
    async function load() {
      const { data: rows } = await supabase
        .from("ceremony_roles")
        .select("id, data")
        .eq("event_id", eventId)
        .limit(1);

      if (rows && rows.length > 0) {
        setRowId(rows[0].id);
        setRoles(rows[0].data?.roles || []);
      }
      setLoading(false);
    }
    load();
  }, [eventId]);

  // ── Persist ───────────────────────────────────────────────────────────────
  const saveRoles = async (nextRoles) => {
    setRoles(nextRoles);
    const row = {
      ...(rowId ? { id: rowId } : {}),
      event_id:   eventId,
      data:       { roles: nextRoles },
      updated_at: new Date().toISOString(),
    };
    const { data: saved, error } = await supabase
      .from("ceremony_roles")
      .upsert(row, { onConflict: "id" })
      .select("id")
      .single();

    if (error) {
      console.error("[SimchaKit] CeremonyRoles save error:", error.message);
    } else if (!rowId && saved) {
      setRowId(saved.id);
    }
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const loadTemplate = () => {
    const template = ROLE_TEMPLATES[eventType];
    if (template) { saveRoles(template); showToast("Template loaded"); }
  };

  const handleAdd = (r) => {
    if (isArchived) return;
    const maxOrder = roles.reduce((m, x) => Math.max(m, x.sortOrder ?? 0), -1);
    saveRoles([...roles, { ...r, sortOrder: maxOrder + 1 }]);
    showToast("Role added");
    setShowModal(false);
  };

  const handleEdit = (r) => {
    if (isArchived) return;
    saveRoles(roles.map(x => x.id === r.id ? r : x));
    showToast("Role updated");
    setEditRole(null);
  };

  const handleDelete = (id) => {
    if (isArchived) return;
    saveRoles(roles.filter(r => r.id !== id));
    showToast("Role removed");
    setDeleteConfirm(null);
  };

  const moveRole = (id, dir) => {
    if (isArchived) return;
    const idx = roles.findIndex(r => r.id === id);
    if (idx < 0) return;
    const next = [...roles];
    const swap = dir === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[idx].sortOrder, next[swap].sortOrder] = [next[swap].sortOrder, next[idx].sortOrder];
    saveRoles([...next].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
  };

  const sections = [...new Set(roles.map(r => r.section).filter(Boolean))];

  const filtered = roles
    .filter(r => {
      if (filterSection !== "all" && r.section !== filterSection) return false;
      if (search) {
        const q = search.toLowerCase();
        return (r.role||"").toLowerCase().includes(q) || (r.assignee||"").toLowerCase().includes(q) ||
               (r.section||"").toLowerCase().includes(q) || (r.notes||"").toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const grouped = filtered.reduce((acc, r) => {
    const sec = r.section || "Other";
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push(r);
    return acc;
  }, {});

  const assignedCount   = roles.filter(r => r.assignee?.trim()).length;
  const unassignedCount = roles.length - assignedCount;

  if (loading) return <div style={loadingStyle}>Loading ceremony roles…</div>;

  return (
    <div>
      {isArchived && <ArchivedNotice />}

      <div className="section-header">
        <div>
          <div className="section-title">Ceremony Roles</div>
          <div className="section-subtitle">Assign family and friends to ceremony honors and service roles.</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {roles.length === 0 && hasTemplate && (
            <button className="btn btn-secondary" disabled={isArchived} onClick={loadTemplate}>
              ✦ Load Template
            </button>
          )}
          <button className="btn btn-primary" disabled={isArchived} onClick={() => setShowModal(true)}>
            + Add Role
          </button>
        </div>
      </div>

      {roles.length > 0 && (
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card"><div className="stat-label">Total Roles</div><div className="stat-value">{roles.length}</div></div>
          <div className="stat-card"><div className="stat-label">Assigned</div><div className="stat-value" style={{ color: "var(--green)" }}>{assignedCount}</div></div>
          <div className="stat-card"><div className="stat-label">Unassigned</div><div className="stat-value" style={{ color: unassignedCount > 0 ? "var(--gold)" : "var(--green)" }}>{unassignedCount}</div></div>
          <div className="stat-card"><div className="stat-label">Sections</div><div className="stat-value">{sections.length}</div></div>
        </div>
      )}

      {roles.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--text-muted)", background: "var(--bg-surface)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📜</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text-primary)", marginBottom: 8 }}>No ceremony roles yet</div>
          <div style={{ fontSize: 14, marginBottom: 24, maxWidth: 360, margin: "0 auto 24px" }}>
            {hasTemplate ? "Load the pre-built template for your event type, or add roles manually." : "Add roles manually to track who will participate."}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            {hasTemplate && <button className="btn btn-secondary" disabled={isArchived} onClick={loadTemplate}>✦ Load Template</button>}
            <button className="btn btn-primary" disabled={isArchived} onClick={() => setShowModal(true)}>+ Add First Role</button>
          </div>
        </div>
      )}

      {roles.length > 0 && (
        <div className="filter-bar">
          <input className="form-input" placeholder="Search roles or assignees…" value={search} onChange={e => setSearch(e.target.value)} />
          {sections.length > 1 && (
            <select className="form-select" value={filterSection} onChange={e => setFilterSection(e.target.value)}>
              <option value="all">All Sections</option>
              {sections.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>
      )}

      {Object.keys(grouped).length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {Object.entries(grouped).map(([section, sectionRoles]) => (
            <div key={section} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
              <div style={{ padding: "10px 16px", background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{section}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                  {sectionRoles.filter(r => r.assignee?.trim()).length}/{sectionRoles.length} assigned
                </div>
              </div>
              {isMobile ? (
                <div>
                  {sectionRoles.map((role, idx) => (
                    <div key={role.id} style={{ padding: "12px 16px", borderBottom: idx < sectionRoles.length - 1 ? "1px solid var(--border)" : "none", borderLeft: role.assignee?.trim() ? "3px solid transparent" : "3px solid var(--gold)", background: role.assignee?.trim() ? "transparent" : "var(--gold-light)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", marginBottom: 2 }}>{role.role}</div>
                          {role.assignee
                            ? <div style={{ fontSize: 13, color: "var(--accent-primary)", fontWeight: 500 }}>{role.assignee}</div>
                            : <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>Unassigned</div>}
                          {role.hebrewName && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Hebrew: {role.hebrewName}</div>}
                          {role.notes && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.4 }}>{role.notes}</div>}
                        </div>
                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                          <button className="icon-btn" onClick={() => moveRole(role.id, "up")} disabled={isArchived || idx === 0}>↑</button>
                          <button className="icon-btn" onClick={() => moveRole(role.id, "down")} disabled={isArchived || idx === sectionRoles.length - 1}>↓</button>
                          <button className="icon-btn" onClick={() => setEditRole(role)}>✎</button>
                          <button className="icon-btn" onClick={() => setDeleteConfirm(role.id)}>✕</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-subtle)" }}>
                      {["Role","Assignee","Hebrew Name","Notes",""].map((h, i) => (
                        <th key={i} style={{ padding: "8px 14px", textAlign: i === 4 ? "right" : "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", width: i === 4 ? 100 : undefined }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sectionRoles.map((role, idx) => (
                      <tr key={role.id} style={{ borderBottom: "1px solid var(--border)", borderLeft: role.assignee?.trim() ? "3px solid transparent" : "3px solid var(--gold)", background: role.assignee?.trim() ? "transparent" : "var(--gold-light)" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--text-primary)" }}>{role.role}</td>
                        <td style={{ padding: "10px 14px" }}>
                          {role.assignee ? <span style={{ color: "var(--accent-primary)", fontWeight: 500 }}>{role.assignee}</span> : <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: 12 }}>Unassigned</span>}
                        </td>
                        <td style={{ padding: "10px 14px", color: "var(--text-secondary)", fontSize: 12 }}>{role.hebrewName || ""}</td>
                        <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontSize: 12, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{role.notes || ""}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right" }}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                            <button className="icon-btn" style={{ fontSize: 11 }} onClick={() => moveRole(role.id, "up")} disabled={isArchived || idx === 0}>↑</button>
                            <button className="icon-btn" style={{ fontSize: 11 }} onClick={() => moveRole(role.id, "down")} disabled={isArchived || idx === sectionRoles.length - 1}>↓</button>
                            <button className="icon-btn" onClick={() => setEditRole(role)}>✎</button>
                            <button className="icon-btn" onClick={() => setDeleteConfirm(role.id)}>✕</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}

      {roles.length > 0 && hasTemplate && !isArchived && (
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 12, color: "var(--text-muted)" }}
            onClick={() => setDeleteConfirm("__reset__")}>↺ Reset to template</button>
        </div>
      )}

      {(showModal || editRole) && (
        <RoleModal
          role={editRole}
          existingSections={sections}
          onSave={editRole ? handleEdit : handleAdd}
          onClose={() => { setShowModal(false); setEditRole(null); }}
          isArchived={isArchived}
        />
      )}

      {deleteConfirm && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{deleteConfirm === "__reset__" ? "Reset to Template?" : "Remove Role?"}</div>
              <button className="icon-btn" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                {deleteConfirm === "__reset__" ? "This will replace all current roles with the default template. This cannot be undone." : "This role will be permanently removed. This cannot be undone."}
              </p>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={() => {
                  if (deleteConfirm === "__reset__") { loadTemplate(); setDeleteConfirm(null); }
                  else handleDelete(deleteConfirm);
                }}>
                  {deleteConfirm === "__reset__" ? "Reset" : "Remove"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── RoleModal ─────────────────────────────────────────────────────────────────
export function RoleModal({ role, existingSections, onSave, onClose, isArchived }) {
  const [form, setForm] = useState(role || { id: newRoleId(), section: existingSections[0] || "", role: "", assignee: "", hebrewName: "", notes: "", sortOrder: 0 });
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{role ? "Edit Role" : "Add Role"}</div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Section *</label>
            <input className="form-input" list="section-list" value={form.section} onChange={e => setF("section", e.target.value)} placeholder="e.g. Torah Service, Wedding Party" />
            <datalist id="section-list">{existingSections.map(s => <option key={s} value={s} />)}</datalist>
          </div>
          <div className="form-group">
            <label className="form-label">Role Name *</label>
            <input className="form-input" value={form.role} onChange={e => setF("role", e.target.value)} placeholder="e.g. Aliyah 1, Best Man" autoFocus={!role} />
          </div>
          <div className="form-group">
            <label className="form-label">Assignee</label>
            <input className="form-input" value={form.assignee} onChange={e => setF("assignee", e.target.value)} placeholder="Name of person filling this role" />
          </div>
          <div className="form-group">
            <label className="form-label">Hebrew Name (optional)</label>
            <input className="form-input" value={form.hebrewName} onChange={e => setF("hebrewName", e.target.value)} placeholder="e.g. Yosef ben Avraham v'Sarah" />
            <div className="form-hint">Format: First name + ben/bat + father's name + v' + mother's name</div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <input className="form-input" value={form.notes} onChange={e => setF("notes", e.target.value)} placeholder="Relationship, instructions, requirements…" />
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!form.role?.trim() || isArchived}
              onClick={() => onSave({ ...form, role: form.role.trim(), assignee: form.assignee.trim() })}>
              {role ? "Save Changes" : "Add Role"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const loadingStyle = { padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 };
