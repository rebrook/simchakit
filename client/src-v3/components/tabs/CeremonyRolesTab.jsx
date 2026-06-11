// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.20.4 — CeremonyRolesTab.jsx
// Ceremony roles stored as a single document in ceremony_roles table
// (one row per event, data.roles = array of role objects).
// Drag-and-drop reordering via @dnd-kit. Section ordering via sectionOrder.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import {
  DndContext, closestCenter,
  KeyboardSensor, MouseSensor, TouchSensor,
  useSensor, useSensors, DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable,
  verticalListSortingStrategy, arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase }      from "@/lib/supabase.js";
import { ArchivedNotice } from "@/components/shared/ArchivedNotice.jsx";
import { Icon }            from "@/utils/iconMap.jsx";

// ── Helpers ──────────────────────────────────────────────────────────────────
function newRoleId() { return "cr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7); }

/**
 * Build a map of section name → numeric order for sorting.
 * If any role has an explicit sectionOrder, uses stored values.
 * Otherwise derives order from the first appearance of each section
 * in the sortOrder-sorted list (backward compatible, no write on load).
 */
function getSectionOrderMap(roles) {
  if (!roles.length) return {};
  const anyExplicit = roles.some(r => r.sectionOrder != null);
  if (anyExplicit) {
    const map = {};
    roles.forEach(r => {
      const sec = r.section || "Other";
      const ord = r.sectionOrder ?? 999;
      if (!(sec in map) || ord < map[sec]) map[sec] = ord;
    });
    return map;
  }
  // Derive from first appearance in sortOrder
  const sorted = [...roles].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const map = {};
  let idx = 0;
  sorted.forEach(r => {
    const sec = r.section || "Other";
    if (!(sec in map)) map[sec] = idx++;
  });
  return map;
}

// ── Role templates ───────────────────────────────────────────────────────────
function buildMitzvahTemplate() {
  return [
    { section: "Torah Service", sectionOrder: 0, role: "Aliyah 1 — Kohen",        assignee: "", hebrewName: "", notes: "Often grandparents or older siblings" },
    { section: "Torah Service", sectionOrder: 0, role: "Aliyah 2 — Levi",         assignee: "", hebrewName: "", notes: "Often grandparents or older siblings" },
    { section: "Torah Service", sectionOrder: 0, role: "Aliyah 3 — Parents",      assignee: "", hebrewName: "", notes: "Usually the parents" },
    { section: "Torah Service", sectionOrder: 0, role: "Aliyah 4 — Maftir",       assignee: "", hebrewName: "", notes: "Bar/Bat Mitzvah" },
    { section: "Torah Service", sectionOrder: 0, role: "Hagbah (Lifting Torah)",   assignee: "", hebrewName: "", notes: "Must be someone with prior experience — Torah weighs ~50 lbs" },
    { section: "Torah Service", sectionOrder: 0, role: "Gelilah (Dressing Torah)", assignee: "", hebrewName: "", notes: "Rolls and dresses the Torah after reading" },
    { section: "Torah Service", sectionOrder: 0, role: "Opening Ark",              assignee: "", hebrewName: "", notes: "Opens ark and hands Torah to cantor; appropriate for non-Jewish family" },
    { section: "Torah Service", sectionOrder: 0, role: "Returning Torah",          assignee: "", hebrewName: "", notes: "Opens ark when Torah is returned; appropriate for non-Jewish family" },
    { section: "English Readings", sectionOrder: 1, role: "Prayer for Our Country", assignee: "", hebrewName: "", notes: "" },
    { section: "English Readings", sectionOrder: 1, role: "Prayer for Israel",      assignee: "", hebrewName: "", notes: "" },
    { section: "English Readings", sectionOrder: 1, role: "Prayer for Peace",       assignee: "", hebrewName: "", notes: "" },
    { section: "Service Participation", sectionOrder: 2, role: "Parental Blessing / Speech", assignee: "", hebrewName: "", notes: "Brief is better — 150 words or less recommended" },
    { section: "Service Participation", sectionOrder: 2, role: "Ushers",             assignee: "", hebrewName: "", notes: "Assist with distributing prayer books" },
    { section: "Service Participation", sectionOrder: 2, role: "Friday Evening Service", assignee: "", hebrewName: "", notes: "Note participation — Yes / No" },
    { section: "Service Participation", sectionOrder: 2, role: "Morning Minyan",     assignee: "", hebrewName: "", notes: "Monday or Thursday morning the week prior" },
  ].map((r, i) => ({ ...r, id: newRoleId(), sortOrder: i }));
}

function buildWeddingTemplate() {
  return [
    { section: "Wedding Party",      sectionOrder: 0, role: "Officiant",              assignee: "", hebrewName: "", notes: "" },
    { section: "Wedding Party",      sectionOrder: 0, role: "Best Man",               assignee: "", hebrewName: "", notes: "" },
    { section: "Wedding Party",      sectionOrder: 0, role: "Maid / Matron of Honor", assignee: "", hebrewName: "", notes: "" },
    { section: "Wedding Party",      sectionOrder: 0, role: "Groomsmen",              assignee: "", hebrewName: "", notes: "" },
    { section: "Wedding Party",      sectionOrder: 0, role: "Bridesmaids",            assignee: "", hebrewName: "", notes: "" },
    { section: "Ceremony Roles",     sectionOrder: 1, role: "Flower Girl",            assignee: "", hebrewName: "", notes: "" },
    { section: "Ceremony Roles",     sectionOrder: 1, role: "Ring Bearer",            assignee: "", hebrewName: "", notes: "" },
    { section: "Ceremony Roles",     sectionOrder: 1, role: "Candle Lighters",        assignee: "", hebrewName: "", notes: "" },
    { section: "Ceremony Roles",     sectionOrder: 1, role: "Ketubah Witnesses",      assignee: "", hebrewName: "", notes: "Two witnesses required; must be Jewish in most traditions" },
    { section: "Readings & Blessings", sectionOrder: 2, role: "Reader 1",             assignee: "", hebrewName: "", notes: "" },
    { section: "Readings & Blessings", sectionOrder: 2, role: "Reader 2",             assignee: "", hebrewName: "", notes: "" },
    { section: "Readings & Blessings", sectionOrder: 2, role: "Reader 3",             assignee: "", hebrewName: "", notes: "" },
  ].map((r, i) => ({ ...r, id: newRoleId(), sortOrder: i }));
}

const ROLE_TEMPLATES = {
  "bat-mitzvah":  buildMitzvahTemplate(),
  "bar-mitzvah":  buildMitzvahTemplate(),
  "bnei-mitzvah": buildMitzvahTemplate(),
  "wedding":      buildWeddingTemplate(),
};

// ── Grid column definition (shared between header + rows) ────────────────────
const GRID_COLS = "32px 1fr 1fr 0.7fr 1.2fr 140px";

// ── Scoped collision detection ───────────────────────────────────────────────
// When dragging a section (sec: prefix), only consider other sections as drop
// targets. When dragging a role, only consider other roles. Without this,
// closestCenter checks ALL droppable nodes across nested SortableContexts and
// often matches a role row instead of the section container, causing silent
// drop rejection. Pattern from dnd-kit MultipleContainers example.
function scopedCollision(args) {
  const activeId = String(args.active.id);
  const isSection = activeId.startsWith("sec:");
  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter(c => {
      const id = String(c.id);
      return isSection ? id.startsWith("sec:") : !id.startsWith("sec:");
    }),
  });
}

// ── SortableRoleRow ──────────────────────────────────────────────────────────
function SortableRoleRow({ role, idx, total, isMobile, isReadOnly, moveRole, setEditRole, setDeleteConfirm }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: role.id, disabled: isReadOnly });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    position: "relative",
    zIndex: isDragging ? 10 : "auto",
  };

  const gripStyle = {
    touchAction: "none",
    cursor: isReadOnly ? "default" : "grab",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--text-muted)",
    fontSize: 14,
    userSelect: "none",
    opacity: isReadOnly ? 0.3 : 0.6,
  };

  const unassigned = !role.assignee?.trim();
  const rowBorder = unassigned ? "3px solid var(--gold)" : "3px solid transparent";
  const rowBg = "transparent";

  if (isMobile) {
    return (
      <div ref={setNodeRef} style={{ ...style, padding: "12px 10px 12px 0", borderBottom: idx < total - 1 ? "1px solid var(--border)" : "none", borderLeft: rowBorder, background: rowBg, display: "flex", gap: 6, alignItems: "flex-start" }}>
        {!isReadOnly && (
          <div {...attributes} {...listeners} style={{ ...gripStyle, padding: "2px 6px", flexShrink: 0 }}><Icon name="grip" context="badge" /></div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", marginBottom: 2 }}>{role.role}</div>
          {role.assignee
            ? <div style={{ fontSize: 13, color: "var(--accent-primary)", fontWeight: 500 }}>{role.assignee}</div>
            : <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>Unassigned</div>}
          {role.hebrewName && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Hebrew: {role.hebrewName}</div>}
          {role.notes && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.4 }}>{role.notes}</div>}
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button className="icon-btn" onClick={() => moveRole(role.id, "up")} disabled={isReadOnly || idx === 0} style={{ fontSize: 11 }}>↑</button>
          <button className="icon-btn" onClick={() => moveRole(role.id, "down")} disabled={isReadOnly || idx === total - 1} style={{ fontSize: 11 }}>↓</button>
          <button className="icon-btn" disabled={isReadOnly} onClick={() => !isReadOnly && setEditRole(role)}><Icon name="pencil" context="badge" /></button>
          <button className="icon-btn" disabled={isReadOnly} onClick={() => !isReadOnly && setDeleteConfirm(role.id)}><Icon name="x" context="badge" /></button>
        </div>
      </div>
    );
  }

  // Desktop: div-based grid row
  return (
    <div ref={setNodeRef} style={{ ...style, display: "grid", gridTemplateColumns: GRID_COLS, alignItems: "center", borderBottom: "1px solid var(--border)", borderLeft: rowBorder, background: rowBg, fontSize: 13 }}>
      <div {...attributes} {...listeners} style={gripStyle}>
        {!isReadOnly && <Icon name="grip" context="badge" />}
      </div>
      <div style={{ padding: "10px 14px", fontWeight: 600, color: "var(--text-primary)" }}>{role.role}</div>
      <div style={{ padding: "10px 14px" }}>
        {role.assignee ? <span style={{ color: "var(--accent-primary)", fontWeight: 500 }}>{role.assignee}</span> : <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: 12 }}>Unassigned</span>}
      </div>
      <div style={{ padding: "10px 14px", color: "var(--text-secondary)", fontSize: 12 }}>{role.hebrewName || ""}</div>
      <div style={{ padding: "10px 14px", color: "var(--text-muted)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{role.notes || ""}</div>
      <div style={{ padding: "10px 14px", display: "flex", gap: 4, justifyContent: "flex-end" }}>
        <button className="icon-btn" style={{ fontSize: 11 }} onClick={() => moveRole(role.id, "up")} disabled={isReadOnly || idx === 0}>↑</button>
        <button className="icon-btn" style={{ fontSize: 11 }} onClick={() => moveRole(role.id, "down")} disabled={isReadOnly || idx === total - 1}>↓</button>
        <button className="icon-btn" disabled={isReadOnly} onClick={() => !isReadOnly && setEditRole(role)}><Icon name="pencil" context="badge" /></button>
        <button className="icon-btn" disabled={isReadOnly} onClick={() => !isReadOnly && setDeleteConfirm(role.id)}><Icon name="x" context="badge" /></button>
      </div>
    </div>
  );
}

// ── SortableSectionBlock ─────────────────────────────────────────────────────
function SortableSectionBlock({ sectionId, section, sectionRoles, secIdx, totalSections, isMobile, isReadOnly, moveSection, moveRole, setEditRole, setDeleteConfirm }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sectionId, disabled: isReadOnly });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    overflow: "hidden",
  };

  return (
    <div ref={setNodeRef} style={style}>
      {/* Section header: grip left, name center, assigned + arrows right */}
      <div style={{ padding: "10px 16px", background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
        {!isReadOnly && totalSections > 1 && (
          <div {...attributes} {...listeners} style={{ touchAction: "none", cursor: "grab", color: "var(--text-muted)", fontSize: 14, userSelect: "none", opacity: 0.6, flexShrink: 0 }}><Icon name="grip" context="badge" /></div>
        )}
        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)", flex: 1 }}>{section}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, flexShrink: 0 }}>
          {sectionRoles.filter(r => r.assignee?.trim()).length}/{sectionRoles.length} assigned
        </div>
        {!isReadOnly && totalSections > 1 && (
          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            <button className="icon-btn" style={{ fontSize: 11 }}
              title="Move section up"
              onClick={() => moveSection(section, "up")}
              disabled={secIdx === 0}>↑</button>
            <button className="icon-btn" style={{ fontSize: 11 }}
              title="Move section down"
              onClick={() => moveSection(section, "down")}
              disabled={secIdx === totalSections - 1}>↓</button>
          </div>
        )}
      </div>

      {/* Desktop column headers */}
      {!isMobile && (
        <div style={{ display: "grid", gridTemplateColumns: GRID_COLS, background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)" }}>
          <div />
          {["Role","Assignee","Hebrew Name","Notes",""].map((h, i) => (
            <div key={i} style={{ padding: "8px 14px", textAlign: i === 4 ? "right" : "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>{h}</div>
          ))}
        </div>
      )}

      {/* Sortable roles within section */}
      <SortableContext items={sectionRoles.map(r => r.id)} strategy={verticalListSortingStrategy}>
        {sectionRoles.map((role, idx) => (
          <SortableRoleRow
            key={role.id}
            role={role}
            idx={idx}
            total={sectionRoles.length}
            isMobile={isMobile}
            isReadOnly={isReadOnly}
            moveRole={moveRole}
            setEditRole={setEditRole}
            setDeleteConfirm={setDeleteConfirm}
          />
        ))}
      </SortableContext>
    </div>
  );
}

// ── Drag overlays (floating preview while dragging) ──────────────────────────
function RoleDragPreview({ role }) {
  if (!role) return null;
  return (
    <div style={{
      padding: "10px 16px",
      background: "var(--bg-surface)",
      border: "2px solid var(--accent-primary)",
      borderRadius: "var(--radius-md)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
      fontSize: 13,
      maxWidth: 360,
    }}>
      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{role.role}</div>
      {role.assignee?.trim() && <div style={{ color: "var(--accent-primary)", fontSize: 12, marginTop: 2 }}>{role.assignee}</div>}
      {role.section && <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 2 }}>{role.section}</div>}
    </div>
  );
}

function SectionDragPreview({ name, count }) {
  return (
    <div style={{
      padding: "10px 16px",
      background: "var(--bg-subtle)",
      border: "2px solid var(--accent-primary)",
      borderRadius: "var(--radius-md)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
      display: "flex",
      alignItems: "center",
      gap: 10,
    }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{name}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{count} role{count !== 1 ? "s" : ""}</div>
    </div>
  );
}

// ── CeremonyRolesTab ─────────────────────────────────────────────────────────
export function CeremonyRolesTab({ eventId, event, adminConfig, showToast, isArchived, isViewer }) {
  const [roles,         setRoles]         = useState([]);
  const [rowId,         setRowId]         = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [showModal,     setShowModal]     = useState(false);
  const [editRole,      setEditRole]      = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [search,        setSearch]        = useState("");
  const [filterSection, setFilterSection] = useState("all");
  const [isMobile,      setIsMobile]      = useState(() => window.innerWidth < 640);
  const [activeDragId,  setActiveDragId]  = useState(null);

  const eventType   = adminConfig?.type || "other";
  const hasTemplate = !!ROLE_TEMPLATES[eventType];
  const isReadOnly  = isArchived || isViewer;

  // ── Sensors ────────────────────────────────────────────────────────────────
  const mouseSensor    = useSensor(MouseSensor, { activationConstraint: { distance: 10 } });
  const touchSensor    = useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } });
  const keyboardSensor = useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates });
  const sensors        = useSensors(mouseSensor, touchSensor, keyboardSensor);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // ── Load ───────────────────────────────────────────────────────────────────
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

  // ── Persist ────────────────────────────────────────────────────────────────
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

  // ── Section order map ──────────────────────────────────────────────────────
  const sectionOrderMap = getSectionOrderMap(roles);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const loadTemplate = () => {
    const template = ROLE_TEMPLATES[eventType];
    if (template) { saveRoles(template); showToast("Template loaded"); }
  };

  const handleAdd = (r) => {
    if (isReadOnly) return;
    const maxOrder = roles.reduce((m, x) => Math.max(m, x.sortOrder ?? 0), -1);
    const secOrder = sectionOrderMap[r.section] ?? Object.keys(sectionOrderMap).length;
    saveRoles([...roles, { ...r, sortOrder: maxOrder + 1, sectionOrder: secOrder }]);
    showToast("Role added");
    setShowModal(false);
  };

  const handleEdit = (r) => {
    if (isReadOnly) return;
    const secOrder = sectionOrderMap[r.section] ?? Object.keys(sectionOrderMap).length;
    saveRoles(roles.map(x => x.id === r.id ? { ...r, sectionOrder: secOrder } : x));
    showToast("Role updated");
    setEditRole(null);
  };

  const handleDelete = (id) => {
    if (isReadOnly) return;
    saveRoles(roles.filter(r => r.id !== id));
    showToast("Role removed");
    setDeleteConfirm(null);
  };

  // Move role ↑/↓ within its section
  const moveRole = (id, dir) => {
    if (isReadOnly) return;
    const role = roles.find(r => r.id === id);
    if (!role) return;
    const sectionRoles = roles
      .filter(r => r.section === role.section)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const idx = sectionRoles.findIndex(r => r.id === id);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sectionRoles.length) return;
    const newRoles = roles.map(r => {
      if (r.id === sectionRoles[idx].id) return { ...r, sortOrder: sectionRoles[swapIdx].sortOrder };
      if (r.id === sectionRoles[swapIdx].id) return { ...r, sortOrder: sectionRoles[idx].sortOrder };
      return r;
    });
    saveRoles(newRoles);
  };

  // Move an entire section ↑ or ↓ (sets sectionOrder on ALL roles)
  const moveSection = (sectionName, dir) => {
    if (isReadOnly) return;
    const orderedSections = [...new Set(roles.map(r => r.section || "Other"))]
      .sort((a, b) => (sectionOrderMap[a] ?? 999) - (sectionOrderMap[b] ?? 999));
    const idx = orderedSections.indexOf(sectionName);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= orderedSections.length) return;
    // Build a complete order map with the swap applied
    const newOrderMap = {};
    orderedSections.forEach((sec, i) => { newOrderMap[sec] = i; });
    const temp = newOrderMap[sectionName];
    newOrderMap[sectionName] = newOrderMap[orderedSections[swapIdx]];
    newOrderMap[orderedSections[swapIdx]] = temp;
    // Apply sectionOrder to ALL roles
    const newRoles = roles.map(r => ({ ...r, sectionOrder: newOrderMap[r.section || "Other"] ?? 999 }));
    saveRoles(newRoles);
  };

  // ── Drag-and-drop handlers ─────────────────────────────────────────────────
  const handleDragStart = (event) => setActiveDragId(String(event.active.id));
  const handleDragCancel = () => setActiveDragId(null);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId   = String(over.id);

    // ── Section drag ──────────────────────────────────────────────────────
    if (activeId.startsWith("sec:") && overId.startsWith("sec:")) {
      const activeSec = activeId.slice(4);
      const overSec   = overId.slice(4);
      const orderedSections = sortedGroupEntries.map(([sec]) => sec);
      const oldIdx = orderedSections.indexOf(activeSec);
      const newIdx = orderedSections.indexOf(overSec);
      if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return;
      const reordered = arrayMove(orderedSections, oldIdx, newIdx);
      const newOrderMap = {};
      reordered.forEach((sec, i) => { newOrderMap[sec] = i; });
      const newRoles = roles.map(r => ({ ...r, sectionOrder: newOrderMap[r.section || "Other"] ?? 999 }));
      saveRoles(newRoles);
      return;
    }

    // ── Role drag (within same section only) ──────────────────────────────
    const activeRole = roles.find(r => r.id === activeId);
    const overRole   = roles.find(r => r.id === overId);
    if (!activeRole || !overRole) return;
    if (activeRole.section !== overRole.section) return;

    const sectionRoles = roles
      .filter(r => r.section === activeRole.section)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const oldIndex = sectionRoles.findIndex(r => r.id === activeId);
    const newIndex = sectionRoles.findIndex(r => r.id === overId);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

    const reordered = arrayMove(sectionRoles, oldIndex, newIndex);
    const idToOrder = new Map();
    reordered.forEach((r, i) => idToOrder.set(r.id, i));
    const newRoles = roles.map(r => idToOrder.has(r.id) ? { ...r, sortOrder: idToOrder.get(r.id) } : r);
    saveRoles(newRoles);
  };

  // ── Derived data ───────────────────────────────────────────────────────────
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
    .sort((a, b) => {
      const secA = a.sectionOrder ?? sectionOrderMap[a.section || "Other"] ?? 999;
      const secB = b.sectionOrder ?? sectionOrderMap[b.section || "Other"] ?? 999;
      if (secA !== secB) return secA - secB;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });

  const grouped = filtered.reduce((acc, r) => {
    const sec = r.section || "Other";
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push(r);
    return acc;
  }, {});

  const sortedGroupEntries = Object.entries(grouped)
    .sort((a, b) => (sectionOrderMap[a[0]] ?? 999) - (sectionOrderMap[b[0]] ?? 999));

  const sectionIds = sortedGroupEntries.map(([sec]) => "sec:" + sec);

  const assignedCount   = roles.filter(r => r.assignee?.trim()).length;
  const unassignedCount = roles.length - assignedCount;

  // Resolve drag preview data
  const isDraggingSection = activeDragId?.startsWith("sec:");
  const activeDragRole = !isDraggingSection && activeDragId ? roles.find(r => r.id === activeDragId) : null;
  const activeDragSectionName = isDraggingSection ? activeDragId.slice(4) : null;

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
            <button className="btn btn-secondary" disabled={isReadOnly} onClick={loadTemplate}><Icon name="wand" context="inline" style={{ marginRight: 4 }} /> Load Template</button>
          )}
          <button className="btn btn-primary" disabled={isReadOnly} onClick={() => setShowModal(true)}>+ Add Role</button>
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
          <div style={{ fontSize: 36, marginBottom: 12 }}><Icon name="ceremony" context="empty" /></div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text-primary)", marginBottom: 8 }}>No ceremony roles yet</div>
          <div style={{ fontSize: 14, marginBottom: 24, maxWidth: 360, margin: "0 auto 24px" }}>
            {hasTemplate ? "Load the pre-built template for your event type, or add roles manually." : "Add roles manually to track who will participate."}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            {hasTemplate && <button className="btn btn-secondary" disabled={isReadOnly} onClick={loadTemplate}><Icon name="wand" context="inline" style={{ marginRight: 4 }} /> Load Template</button>}
            <button className="btn btn-primary" disabled={isReadOnly} onClick={() => setShowModal(true)}>+ Add First Role</button>
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

      {/* ── Sections with drag-and-drop ────────────────────────────────────── */}
      {sortedGroupEntries.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={scopedCollision}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {/* Outer sortable context for sections */}
          <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {sortedGroupEntries.map(([section, sectionRoles], secIdx) => (
                <SortableSectionBlock
                  key={section}
                  sectionId={"sec:" + section}
                  section={section}
                  sectionRoles={sectionRoles}
                  secIdx={secIdx}
                  totalSections={sortedGroupEntries.length}
                  isMobile={isMobile}
                  isReadOnly={isReadOnly}
                  moveSection={moveSection}
                  moveRole={moveRole}
                  setEditRole={setEditRole}
                  setDeleteConfirm={setDeleteConfirm}
                />
              ))}
            </div>
          </SortableContext>

          {/* Drag overlay */}
          <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
            {isDraggingSection
              ? <SectionDragPreview name={activeDragSectionName} count={grouped[activeDragSectionName]?.length || 0} />
              : <RoleDragPreview role={activeDragRole} />
            }
          </DragOverlay>
        </DndContext>
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
              <button className="icon-btn" onClick={() => setDeleteConfirm(null)}><Icon name="x" context="button" /></button>
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

// ── RoleModal ────────────────────────────────────────────────────────────────
export function RoleModal({ role, existingSections, onSave, onClose, isArchived }) {
  const [form, setForm] = useState(role || { id: newRoleId(), section: existingSections[0] || "", role: "", assignee: "", hebrewName: "", notes: "", sortOrder: 0 });
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{role ? "Edit Role" : "Add Role"}</div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" context="button" /></button>
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
