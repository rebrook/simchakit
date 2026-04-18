import { useState, useEffect } from "react";
import { ArchivedNotice } from "@/components/shared/ArchivedNotice.jsx";

// ── Role templates per event type ─────────────────────────────────────────────
const ROLE_TEMPLATES = {
  "bat-mitzvah":  buildMitzvahTemplate(),
  "bar-mitzvah":  buildMitzvahTemplate(),
  "bnei-mitzvah": buildMitzvahTemplate(),
  "wedding":      buildWeddingTemplate(),
};

function buildMitzvahTemplate() {
  return [
    { section: "Torah Service", role: "Aliyah 1 — Kohen",     assignee: "", hebrewName: "", notes: "Often grandparents or older siblings" },
    { section: "Torah Service", role: "Aliyah 2 — Levi",      assignee: "", hebrewName: "", notes: "Often grandparents or older siblings" },
    { section: "Torah Service", role: "Aliyah 3 — Parents",   assignee: "", hebrewName: "", notes: "Usually the parents" },
    { section: "Torah Service", role: "Aliyah 4 — Maftir",    assignee: "", hebrewName: "", notes: "Bar/Bat Mitzvah" },
    { section: "Torah Service", role: "Hagbah (Lifting Torah)",  assignee: "", hebrewName: "", notes: "Must be someone with prior experience — Torah weighs ~50 lbs" },
    { section: "Torah Service", role: "Gelilah (Dressing Torah)", assignee: "", hebrewName: "", notes: "Rolls and dresses the Torah after reading" },
    { section: "Torah Service", role: "Opening Ark",           assignee: "", hebrewName: "", notes: "Opens ark and hands Torah to cantor; appropriate for non-Jewish family" },
    { section: "Torah Service", role: "Returning Torah",       assignee: "", hebrewName: "", notes: "Opens ark when Torah is returned; appropriate for non-Jewish family" },
    { section: "English Readings", role: "Prayer for Our Country", assignee: "", hebrewName: "", notes: "" },
    { section: "English Readings", role: "Prayer for Israel",      assignee: "", hebrewName: "", notes: "" },
    { section: "English Readings", role: "Prayer for Peace",       assignee: "", hebrewName: "", notes: "" },
    { section: "Service Participation", role: "Parental Blessing / Speech", assignee: "", hebrewName: "", notes: "Brief is better — 150 words or less recommended" },
    { section: "Service Participation", role: "Ushers",             assignee: "", hebrewName: "", notes: "Assist with distributing prayer books" },
    { section: "Service Participation", role: "Friday Evening Service", assignee: "", hebrewName: "", notes: "Note participation — Yes / No" },
    { section: "Service Participation", role: "Morning Minyan",     assignee: "", hebrewName: "", notes: "Monday or Thursday morning the week prior" },
  ].map((r, i) => ({ ...r, id: newRoleId(i), sortOrder: i }));
}

function buildWeddingTemplate() {
  return [
    { section: "Wedding Party", role: "Officiant",             assignee: "", hebrewName: "", notes: "" },
    { section: "Wedding Party", role: "Best Man",              assignee: "", hebrewName: "", notes: "" },
    { section: "Wedding Party", role: "Maid / Matron of Honor", assignee: "", hebrewName: "", notes: "" },
    { section: "Wedding Party", role: "Groomsmen",             assignee: "", hebrewName: "", notes: "" },
    { section: "Wedding Party", role: "Bridesmaids",           assignee: "", hebrewName: "", notes: "" },
    { section: "Ceremony Roles", role: "Flower Girl",          assignee: "", hebrewName: "", notes: "" },
    { section: "Ceremony Roles", role: "Ring Bearer",          assignee: "", hebrewName: "", notes: "" },
    { section: "Ceremony Roles", role: "Candle Lighters",      assignee: "", hebrewName: "", notes: "" },
    { section: "Ceremony Roles", role: "Ketubah Witnesses",    assignee: "", hebrewName: "", notes: "Two witnesses required; must be Jewish in most traditions" },
    { section: "Readings & Blessings", role: "Reader 1",       assignee: "", hebrewName: "", notes: "" },
    { section: "Readings & Blessings", role: "Reader 2",       assignee: "", hebrewName: "", notes: "" },
    { section: "Readings & Blessings", role: "Reader 3",       assignee: "", hebrewName: "", notes: "" },
  ].map((r, i) => ({ ...r, id: newRoleId(i), sortOrder: i }));
}

function newRoleId(seed) {
  return "cr_" + Date.now() + "_" + (seed ?? Math.random().toString(36).slice(2, 7));
}

// ── Main Tab ──────────────────────────────────────────────────────────────────
export function CeremonyRolesTab({ state, updateData, isArchived, showToast, adminConfig }) {
  const roles    = state?.ceremonyRoles || [];
  const eventType = adminConfig?.type || "other";

  const [showModal,     setShowModal]     = useState(false);
  const [editRole,      setEditRole]      = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [search,        setSearch]        = useState("");
  const [filterSection, setFilterSection] = useState("all");
  const [isMobile,      setIsMobile]      = useState(() => window.innerWidth < 640);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const saveRoles = (next) => updateData("ceremonyRoles", next);

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
    const sorted = [...roles].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const idx = sorted.findIndex(r => r.id === id);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const updated = sorted.map(r => ({ ...r }));
    const tmpOrder = updated[idx].sortOrder;
    updated[idx].sortOrder = updated[swapIdx].sortOrder;
    updated[swapIdx].sortOrder = tmpOrder;
    saveRoles(updated);
  };

  const loadTemplate = () => {
    if (isArchived) return;
    const template = ROLE_TEMPLATES[eventType] || ROLE_TEMPLATES["bat-mitzvah"];
    saveRoles(template.map((r, i) => ({ ...r, id: newRoleId(i) })));
    showToast("Template loaded");
  };

  // ── Unique sections for filter dropdown ────────────────────────────────────
  const sections = [...new Set(roles.map(r => r.section).filter(Boolean))];

  // ── Filtered + sorted roles ────────────────────────────────────────────────
  const filtered = roles
    .filter(r => {
      if (filterSection !== "all" && r.section !== filterSection) return false;
      if (search) {
        const q = search.toLowerCase();
        return (r.role || "").toLowerCase().includes(q) ||
               (r.assignee || "").toLowerCase().includes(q) ||
               (r.section || "").toLowerCase().includes(q) ||
               (r.notes || "").toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  // Group by section for display
  const grouped = filtered.reduce((acc, r) => {
    const sec = r.section || "Other";
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push(r);
    return acc;
  }, {});

  const assignedCount = roles.filter(r => r.assignee && r.assignee.trim()).length;
  const unassignedCount = roles.length - assignedCount;

  const hasTemplate = !!ROLE_TEMPLATES[eventType];

  return (
    <div className="tab-content">
      {isArchived && <ArchivedNotice />}

      {/* ── Header ── */}
      <div className="section-header">
        <div>
          <div className="section-title">Ceremony Roles</div>
          <div className="section-sub">
            Assign family and friends to ceremony honors and service roles.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {roles.length === 0 && hasTemplate && (
            <button className="btn btn-secondary" disabled={isArchived}
              onClick={loadTemplate}>
              ✦ Load Template
            </button>
          )}
          <button className="btn btn-primary" disabled={isArchived}
            onClick={() => setShowModal(true)}>
            + Add Role
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      {roles.length > 0 && (
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Total Roles</div>
            <div className="stat-value">{roles.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Assigned</div>
            <div className="stat-value" style={{ color: "var(--green)" }}>{assignedCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Unassigned</div>
            <div className="stat-value" style={{ color: unassignedCount > 0 ? "var(--gold)" : "var(--green)" }}>
              {unassignedCount}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Sections</div>
            <div className="stat-value">{sections.length}</div>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {roles.length === 0 && (
        <div style={{
          textAlign: "center", padding: "60px 24px", color: "var(--text-muted)",
          background: "var(--bg-surface)", borderRadius: "var(--radius-md)",
          border: "1px solid var(--border)",
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📜</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text-primary)", marginBottom: 8 }}>
            No ceremony roles yet
          </div>
          <div style={{ fontSize: 14, marginBottom: 24, maxWidth: 360, margin: "0 auto 24px" }}>
            {hasTemplate
              ? "Load the pre-built template for your event type, or add roles manually."
              : "Add roles manually to track who will participate in the ceremony."}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            {hasTemplate && (
              <button className="btn btn-secondary" disabled={isArchived} onClick={loadTemplate}>
                ✦ Load Template
              </button>
            )}
            <button className="btn btn-primary" disabled={isArchived} onClick={() => setShowModal(true)}>
              + Add First Role
            </button>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      {roles.length > 0 && (
        <div className="filter-bar">
          <input className="form-input"
            placeholder="Search roles or assignees…"
            value={search} onChange={e => setSearch(e.target.value)} />
          {sections.length > 1 && (
            <select className="form-select"
              value={filterSection} onChange={e => setFilterSection(e.target.value)}>
              <option value="all">All Sections</option>
              {sections.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>
      )}

      {/* ── Roles grouped by section ── */}
      {Object.keys(grouped).length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {Object.entries(grouped).map(([section, sectionRoles]) => (
            <div key={section} style={{
              background: "var(--bg-surface)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)", overflow: "hidden",
            }}>
              {/* Section header */}
              <div style={{
                padding: "10px 16px", background: "var(--bg-subtle)",
                borderBottom: "1px solid var(--border)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
                  {section}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                  {sectionRoles.filter(r => r.assignee?.trim()).length}/{sectionRoles.length} assigned
                </div>
              </div>

              {/* Roles in section */}
              {isMobile ? (
                /* Mobile card layout */
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {sectionRoles.map((role, idx) => (
                    <div key={role.id} style={{
                      padding: "12px 16px",
                      borderBottom: idx < sectionRoles.length - 1 ? "1px solid var(--border)" : "none",
                      borderLeft: role.assignee?.trim() ? "3px solid transparent" : "3px solid var(--gold)",
                      background: role.assignee?.trim() ? "transparent" : "var(--gold-light)",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", marginBottom: 2 }}>
                            {role.role}
                          </div>
                          {role.assignee ? (
                            <div style={{ fontSize: 13, color: "var(--accent-primary)", fontWeight: 500 }}>
                              {role.assignee}
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                              Unassigned
                            </div>
                          )}
                          {role.hebrewName && (
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                              Hebrew: {role.hebrewName}
                            </div>
                          )}
                          {role.notes && (
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.4 }}>
                              {role.notes}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                          <button className="icon-btn" title="Move up"
                            onClick={() => moveRole(role.id, "up")}
                            disabled={isArchived || idx === 0}>↑</button>
                          <button className="icon-btn" title="Move down"
                            onClick={() => moveRole(role.id, "down")}
                            disabled={isArchived || idx === sectionRoles.length - 1}>↓</button>
                          <button className="icon-btn" title="Edit"
                            onClick={() => setEditRole(role)}>✎</button>
                          <button className="icon-btn icon-btn-danger" title="Delete"
                            onClick={() => setDeleteConfirm(role.id)}>✕</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Desktop table layout */
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-subtle)" }}>
                      <th style={{ padding: "8px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>Role</th>
                      <th style={{ padding: "8px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>Assignee</th>
                      <th style={{ padding: "8px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>Hebrew Name</th>
                      <th style={{ padding: "8px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>Notes</th>
                      <th style={{ padding: "8px 14px", textAlign: "right", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", width: 100 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectionRoles.map((role, idx) => (
                      <tr key={role.id} style={{
                        borderBottom: "1px solid var(--border)",
                        borderLeft: role.assignee?.trim() ? "3px solid transparent" : "3px solid var(--gold)",
                        background: role.assignee?.trim() ? "transparent" : "var(--gold-light)",
                      }}>
                        <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--text-primary)" }}>
                          {role.role}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          {role.assignee ? (
                            <span style={{ color: "var(--accent-primary)", fontWeight: 500 }}>{role.assignee}</span>
                          ) : (
                            <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: 12 }}>Unassigned</span>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px", color: "var(--text-secondary)", fontSize: 12 }}>
                          {role.hebrewName || ""}
                        </td>
                        <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontSize: 12, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {role.notes || ""}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right" }}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                            <button className="icon-btn" title="Move up" style={{ fontSize: 11 }}
                              onClick={() => moveRole(role.id, "up")}
                              disabled={isArchived || idx === 0}>↑</button>
                            <button className="icon-btn" title="Move down" style={{ fontSize: 11 }}
                              onClick={() => moveRole(role.id, "down")}
                              disabled={isArchived || idx === sectionRoles.length - 1}>↓</button>
                            <button className="icon-btn" title="Edit"
                              onClick={() => setEditRole(role)}>✎</button>
                            <button className="icon-btn icon-btn-danger" title="Delete"
                              onClick={() => setDeleteConfirm(role.id)}>✕</button>
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

      {/* Load template button when roles exist */}
      {roles.length > 0 && hasTemplate && !isArchived && (
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <button className="btn btn-ghost btn-sm"
            style={{ fontSize: 12, color: "var(--text-muted)" }}
            onClick={() => setDeleteConfirm("__reset__")}>
            ↺ Reset to template
          </button>
        </div>
      )}

      {/* ── Role modal ── */}
      {(showModal || editRole) && (
        <RoleModal
          role={editRole}
          existingSections={sections}
          onSave={editRole ? handleEdit : handleAdd}
          onClose={() => { setShowModal(false); setEditRole(null); }}
          isArchived={isArchived}
        />
      )}

      {/* ── Delete / reset confirm ── */}
      {deleteConfirm && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                {deleteConfirm === "__reset__" ? "Reset to Template?" : "Remove Role?"}
              </div>
              <button className="icon-btn" title="Close" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                {deleteConfirm === "__reset__"
                  ? "This will replace all current roles with the default template for your event type. This cannot be undone."
                  : "This role will be permanently removed. This cannot be undone."}
              </p>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={() => {
                  if (deleteConfirm === "__reset__") {
                    loadTemplate();
                    setDeleteConfirm(null);
                  } else {
                    handleDelete(deleteConfirm);
                  }
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

// ── Role Modal ────────────────────────────────────────────────────────────────
export function RoleModal({ role, existingSections, onSave, onClose, isArchived }) {
  const isEdit = !!role;
  const [form, setForm] = useState(role || {
    id:          "cr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    section:     existingSections[0] || "",
    role:        "",
    assignee:    "",
    hebrewName:  "",
    notes:       "",
    sortOrder:   0,
  });
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.role.trim()) return;
    onSave({ ...form, role: form.role.trim(), assignee: form.assignee.trim() });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? "Edit Role" : "Add Role"}</div>
          <button className="icon-btn" title="Close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ overflowY: "auto", maxHeight: "calc(85vh - 120px)" }}>
          <div className="form-group">
            <label className="form-label">Section *</label>
            <input className="form-input" list="section-list"
              value={form.section}
              onChange={e => setF("section", e.target.value)}
              placeholder="e.g. Torah Service, Wedding Party" />
            <datalist id="section-list">
              {existingSections.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div className="form-group">
            <label className="form-label">Role Name *</label>
            <input className="form-input"
              value={form.role}
              onChange={e => setF("role", e.target.value)}
              placeholder="e.g. Aliyah 1, Best Man, Ring Bearer"
              autoFocus={!isEdit} />
          </div>
          <div className="form-group">
            <label className="form-label">Assignee</label>
            <input className="form-input"
              value={form.assignee}
              onChange={e => setF("assignee", e.target.value)}
              placeholder="Name of person filling this role" />
          </div>
          <div className="form-group">
            <label className="form-label">Hebrew Name (optional)</label>
            <input className="form-input"
              value={form.hebrewName}
              onChange={e => setF("hebrewName", e.target.value)}
              placeholder="e.g. Yosef ben Avraham v'Sarah" />
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5 }}>
              Format: First name + ben/bat + father's name + v' + mother's name
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <input className="form-input"
              value={form.notes}
              onChange={e => setF("notes", e.target.value)}
              placeholder="Relationship, instructions, requirements…" />
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary"
              disabled={!form.role.trim() || isArchived}
              onClick={handleSave}>
              {isEdit ? "Save Changes" : "Add Role"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
