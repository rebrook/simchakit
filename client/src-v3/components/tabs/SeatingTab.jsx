// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — SeatingTab.jsx
// Ported from V2. Tables and people via useEventData.
// Seating config stored as single document in seating table.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { supabase }           from "@/lib/supabase.js";
import { useEventData, peoplePromoteColumns } from "@/hooks/useEventData.js";
import { useSearchHighlight } from "@/hooks/useSearchHighlight.js";
import { newTableId }         from "@/utils/ids.js";
import { exportSeatingByTable, exportSeatingByPerson, generateSeatingPrintHTML } from "@/utils/exports.js";
import { autoSeatByHousehold } from "@/utils/seating.js";
import { ArchivedNotice }     from "@/components/shared/ArchivedNotice.jsx";

export function SeatingTab({ eventId, event, adminConfig, showToast, isArchived, setActiveTab, searchHighlight, clearSearchHighlight }) {
  const { items: tables,     loading: tLoading, save: saveTable, remove: removeTable } = useEventData(eventId, "tables");
  const { items: people,     loading: pLoading, save: savePerson }                     = useEventData(eventId, "people", { promoteColumns: peoplePromoteColumns });
  const { items: households, loading: hLoading, save: saveHousehold }                   = useEventData(eventId, "households");

  // Seating config — single document pattern
  const [seatingConfig,  setSeatingConfig]  = useState({});
  const [seatingRowId,   setSeatingRowId]   = useState(null);
  const [configLoading,  setConfigLoading]  = useState(true);

  const [setupOpen,        setSetupOpen]        = useState(true);
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [assignModalTable, setAssignModalTable] = useState(null);
  const [showTableModal,   setShowTableModal]   = useState(false);
  const [editTable,        setEditTable]        = useState(null);
  const [deleteConfirm,    setDeleteConfirm]    = useState(null);
  const [unseatedSearch,   setUnseatedSearch]   = useState("");
  const [unseatedGroup,    setUnseatedGroup]    = useState("All");
  const [mobilePanel,      setMobilePanel]      = useState("tables");
  const [isMobile,         setIsMobile]         = useState(() => window.innerWidth < 768);
  const [showExportModal,  setShowExportModal]  = useState(false);
  const [printHTML,        setPrintHTML]        = useState(null);
  const [showAutoSeat,     setShowAutoSeat]     = useState(false);
  const [autoSeatResult,   setAutoSeatResult]   = useState(null);

  useSearchHighlight(searchHighlight, clearSearchHighlight, "seating");

  // Load seating config
  useEffect(() => {
    if (!eventId) return;
    async function load() {
      const { data: rows } = await supabase
        .from("seating")
        .select("id, data")
        .eq("event_id", eventId)
        .limit(1);
      if (rows && rows.length > 0) {
        setSeatingRowId(rows[0].id);
        setSeatingConfig(rows[0].data?.config || {});
        setSetupOpen(!rows[0].data?.config?.hasSeating);
      }
      setConfigLoading(false);
    }
    load();
  }, [eventId]);

  // Save seating config
  const saveConfig = async (cfg) => {
    setSeatingConfig(cfg);
    const row = {
      ...(seatingRowId ? { id: seatingRowId } : {}),
      event_id:   eventId,
      data:       { config: cfg },
      updated_at: new Date().toISOString(),
    };
    const { data: saved, error } = await supabase
      .from("seating")
      .upsert(row, { onConflict: "id" })
      .select("id")
      .single();
    if (!error && saved && !seatingRowId) setSeatingRowId(saved.id);
  };

  // Resize listener
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Derive seating config values — must be before migration hook
  const hasSeating       = !!seatingConfig.hasSeating;
  const enabledSections  = seatingConfig.enabledSections || (seatingConfig.eventSectionId ? [seatingConfig.eventSectionId] : []);
  const [activeSectionId, setActiveSectionId] = useState(() => enabledSections[0] || "");
  useEffect(() => {
    if (enabledSections.length > 0 && !enabledSections.includes(activeSectionId)) {
      setActiveSectionId(enabledSections[0]);
    }
  }, [enabledSections.join(",")]);
  const sectionId        = activeSectionId;
  const timeline    = (adminConfig?.timeline || []).slice().sort((a, b) => (a.startDate||"").localeCompare(b.startDate||""));
  const activeSection = timeline.find(e => e.id === sectionId) || null;

  // Re-open setup if no sections enabled yet — placed here so hasSeating and
  // enabledSections are already declared (avoids TDZ)
  useEffect(() => {
    if (!seatingConfig.hasSeating || enabledSections.length === 0) setSetupOpen(true);
  }, [seatingConfig.hasSeating, enabledSections.length]);

  // One-time migration: strip stale adultTableId / kidsTableId from households
  // and migrate flat tableId → tableAssignments on people
  const migrated = useRef(false);
  useEffect(() => {
    if (migrated.current || households.length === 0) return;
    migrated.current = true;

    // Migrate households
    const needsHHMigration = households.some(h => "adultTableId" in h || "kidsTableId" in h);
    if (needsHHMigration) {
      const cleaned = households.map(h => {
        const c = { ...h };
        delete c.adultTableId;
        delete c.kidsTableId;
        return c;
      });
      cleaned.forEach(h => saveHousehold(h));
    }

    // Migrate people: flat tableId → tableAssignments
    const firstSection = enabledSections[0] || seatingConfig.eventSectionId || "";
    const needsPeopleMigration = people.some(p => p.tableId && !p.tableAssignments);
    if (needsPeopleMigration && firstSection) {
      people.forEach(p => {
        if (p.tableId && !p.tableAssignments) {
          const c = { ...p, tableAssignments: { [firstSection]: p.tableId } };
          delete c.tableId;
          savePerson(c);
        }
      });
    }

    // Migrate tables: add sectionId to tables that don't have one
    const firstSectionForTables = enabledSections[0] || seatingConfig.eventSectionId || "";
    if (firstSectionForTables) {
      tables.forEach(t => {
        if (!t.sectionId) saveTable({ ...t, sectionId: firstSectionForTables });
      });
    }

    // Migrate seatingConfig: eventSectionId → enabledSections
    if (seatingConfig.eventSectionId && !seatingConfig.enabledSections) {
      saveConfig({ ...seatingConfig, enabledSections: [seatingConfig.eventSectionId], eventSectionId: undefined });
    }
  }, [households]);

  // Table ordering
  const sortedTables = [...tables].filter(t => t.sectionId === sectionId || !t.sectionId).sort((a, b) => {
    const aO = a.order ?? tables.indexOf(a);
    const bO = b.order ?? tables.indexOf(b);
    return aO - bO;
  });

  const handleMoveTable = async (id, direction) => {
    if (isArchived) return;
    const idx  = sortedTables.findIndex(t => t.id === id);
    const newI = direction === "up" ? idx - 1 : idx + 1;
    if (newI < 0 || newI >= sortedTables.length) return;
    const reordered = [...sortedTables];
    [reordered[idx], reordered[newI]] = [reordered[newI], reordered[idx]];
    for (let i = 0; i < reordered.length; i++) {
      await saveTable({ ...reordered[i], order: i });
    }
  };

  const handleAddTable    = async (t)  => { if (isArchived) return; await saveTable({ ...t, sectionId });                          showToast("Table added");   setShowTableModal(false); };
  const handleEditTable   = async (t)  => { if (isArchived) return; await saveTable(t);                          showToast("Table updated"); setEditTable(null);       };
  const handleDeleteTable = async (id) => {
    if (isArchived) return;
    const assigned = people.filter(p =>
      p.tableAssignments ? Object.values(p.tableAssignments).includes(id) : p.tableId === id
    );
    for (const p of assigned) {
      if (p.tableAssignments) {
        const ta = { ...p.tableAssignments };
        Object.keys(ta).forEach(sid => { if (ta[sid] === id) delete ta[sid]; });
        await savePerson({ ...p, tableAssignments: ta });
      } else {
        await savePerson({ ...p, tableId: null });
      }
    }
    const table = tables.find(t => t.id === id);
    if (table) await removeTable(table._rowId);
    showToast("Table deleted");
    setDeleteConfirm(null);
  };

  const assignPerson = async (personId, tableId) => {
    if (isArchived) return;
    const p = people.find(x => x.id === personId);
    if (p) {
      const ta = { ...(p.tableAssignments || {}), [sectionId]: tableId };
      const c = { ...p, tableAssignments: ta };
      delete c.tableId;
      await savePerson(c);
    }
    showToast("Guest assigned");
    setSelectedPersonId(null);
  };

  const unassignPerson = async (personId) => {
    if (isArchived) return;
    const p = people.find(x => x.id === personId);
    if (p) {
      const ta = { ...(p.tableAssignments || {}) };
      delete ta[sectionId];
      await savePerson({ ...p, tableAssignments: ta });
    }
    showToast("Guest unassigned");
  };

  const handleAutoSeat = async () => {
    const result = autoSeatByHousehold(scopedPeople, sortedTables, households, sectionId);
    for (const { personId, tableId } of result.assignments) {
      const p = people.find(x => x.id === personId);
      if (p) {
        const ta = { ...(p.tableAssignments || {}), [sectionId]: tableId };
        const c = { ...p, tableAssignments: ta };
        delete c.tableId;
        await savePerson(c);
      }
    }
    setShowAutoSeat(false);
    setAutoSeatResult(result);
  };

  const handlePersonClick = (personId) => {
    if (isArchived) return;
    setSelectedPersonId(id => id === personId ? null : personId);
  };

  const handleTableClick = (tableId) => {
    if (!selectedPersonId || isArchived) return;
    assignPerson(selectedPersonId, tableId);
  };

  // Derived helpers
  const householdMap = Object.fromEntries(households.map(h => [h.id, h]));
  const getPersonDisplayName = (p) => {
    if (p.firstName || p.lastName) return `${p.firstName || ""} ${p.lastName || ""}`.trim();
    return p.name || "Unnamed";
  };
  const getPersonGroup         = (p) => householdMap[p.householdId]?.group || "";
  const getPersonHouseholdName = (p) => {
    const hh = householdMap[p.householdId];
    return hh ? (hh.formalName || hh.name2 || "") : "";
  };

  // Scoped people: confirmed for active section.
  // Fallback: if nobody has attendingSections set yet, show all people so
  // seating can be used before RSVPs are confirmed per sub-event.
  const anyoneHasSections = people.some(p => (p.attendingSections||[]).length > 0);
  const scopedPeople = hasSeating && sectionId
    ? (anyoneHasSections
        ? people.filter(p => (p.attendingSections||[]).includes(sectionId))
        : people)
    : [];

  const getPersonTableId = (p) => p.tableAssignments?.[sectionId] || p.tableId || null;
  const unseated    = scopedPeople.filter(p => !getPersonTableId(p));
  const tbdPeople   = hasSeating && sectionId
    ? people.filter(p => {
        const hh = householdMap[p.householdId];
        return hh && (hh.eventSections||[]).includes(sectionId) && (p.attendingSections||[]).length === 0;
      })
    : [];

  const unseatedFiltered = unseated.filter(p => {
    const name  = getPersonDisplayName(p).toLowerCase();
    const group = getPersonGroup(p);
    if (unseatedGroup !== "All" && group !== unseatedGroup) return false;
    if (unseatedSearch && !name.includes(unseatedSearch.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    const ga = getPersonGroup(a), gb = getPersonGroup(b);
    if (ga !== gb) return ga.localeCompare(gb);
    return getPersonDisplayName(a).localeCompare(getPersonDisplayName(b));
  });

  const groups       = [...new Set(scopedPeople.map(p => getPersonGroup(p)).filter(Boolean))].sort();
  const totalSeats   = sortedTables.reduce((s, t) => s + (parseInt(t.capacity) || 0), 0);
  const seated       = scopedPeople.filter(p => getPersonTableId(p)).length;
  const totalPeople  = scopedPeople.length;
  const tableOccupants = (tableId) => people.filter(p => getPersonTableId(p) === tableId);
  const selectedPerson = selectedPersonId ? people.find(p => p.id === selectedPersonId) : null;

  const TYPE_BADGE = {
    "Adult": { bg: "var(--blue-light)",  color: "var(--blue)"  },
    "Kids":  { bg: "var(--gold-light)",  color: "var(--gold)"  },
    "Mixed": { bg: "var(--green-light)", color: "var(--green)" },
  };

  if (tLoading || pLoading || hLoading || configLoading) return <div style={loadingStyle}>Loading seating chart…</div>;

  return (
    <div className="tab-content">
      {isArchived && <ArchivedNotice />}

      {/* Header */}
      <div className="section-header">
        <div>
          <div className="section-title">Seating Chart</div>
          <div className="section-sub">
            {selectedPerson
              ? <span style={{ color: "var(--accent-primary)", fontWeight: 600 }}>❆ {getPersonDisplayName(selectedPerson)} selected — click a table to assign</span>
              : activeSection
                ? `Seating for: ${activeSection.icon||"📅"} ${activeSection.title}`
                : "Configure seating setup below to get started."}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setSetupOpen(o => !o)} style={{ fontSize: 12 }}>⚙ Setup</button>
          {hasSeating && sectionId && (sortedTables.length > 0 || scopedPeople.length > 0) && (
            <button className="btn btn-secondary" onClick={() => setShowExportModal(true)}>↓ Export Seating</button>
          )}
          {hasSeating && sectionId && unseated.length > 0 && sortedTables.length > 0 && !isArchived && (
            <button className="btn btn-secondary" onClick={() => setShowAutoSeat(true)}>✨ Auto-Seat</button>
          )}
          {hasSeating && sectionId && (
            <button className="btn btn-primary" disabled={isArchived} onClick={() => setShowTableModal(true)}>+ Add Table</button>
          )}
        </div>
      </div>

      {/* Setup panel */}
      <div style={{ marginBottom: 20, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
        <div onClick={() => setSetupOpen(o => !o)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", cursor: "pointer", background: "var(--bg-subtle)", borderBottom: setupOpen ? "1px solid var(--border)" : "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 15 }}>⚙</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Seating Setup</div>
              {!setupOpen && (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {hasSeating && enabledSections.length > 0
                    ? `${enabledSections.length} sub-event${enabledSections.length !== 1 ? "s" : ""} with seating · Assigned seating on`
                    : hasSeating ? "Select sub-events to continue"
                    : "Assigned seating off"}
                </div>
              )}
            </div>
          </div>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{setupOpen ? "▴" : "▾"}</span>
        </div>
        {setupOpen && (
          <div style={{ padding: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 16 }}>
              <input type="checkbox" checked={hasSeating}
                onChange={e => saveConfig({ ...seatingConfig, hasSeating: e.target.checked, enabledSections: seatingConfig.enabledSections || [] })}
                style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--accent-primary)" }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>This event has assigned seating</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Enable seating for one or more sub-events below. Each sub-event has its own independent set of tables.</div>
              </div>
            </label>
            {hasSeating && (
              <div style={{ marginBottom: 0 }}>
                <div className="form-label" style={{ marginBottom: 8 }}>Which sub-events have assigned seating?</div>
                {timeline.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 0" }}>No timeline entries found. Add sub-events in Admin Mode first.</div>
                ) : (
                  <>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {timeline.map(entry => {
                        const isEnabled = enabledSections.includes(entry.id);
                        return (
                          <label key={entry.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "8px 10px", borderRadius: "var(--radius-sm)", background: "transparent", border: `2px solid ${isEnabled ? "var(--accent-primary)" : "var(--border)"}`, transition: "all 0.15s", color: isEnabled ? "var(--accent-primary)" : "var(--text-primary)" }}>
                            <input type="checkbox" checked={isEnabled}
                              onChange={e => {
                                const next = e.target.checked
                                  ? [...enabledSections, entry.id]
                                  : enabledSections.filter(id => id !== entry.id);
                                saveConfig({ ...seatingConfig, hasSeating: true, enabledSections: next });
                              }}
                              style={{ width: 15, height: 15, cursor: "pointer", accentColor: "var(--accent-primary)" }} />
                            <span style={{ fontSize: 13 }}>{entry.icon||"📅"} {entry.title}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>Only confirmed attendees appear unseated. TBD attendees are excluded until confirmed in the Guests tab.</div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pill switcher — only shown when 2+ sections enabled */}
      {hasSeating && enabledSections.length >= 2 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {enabledSections.map(sid => {
            const entry = timeline.find(e => e.id === sid);
            if (!entry) return null;
            const isActive = sid === activeSectionId;
            return (
              <button key={sid}
                className={`btn ${isActive ? "btn-primary" : "btn-ghost"}`}
                style={{ fontSize: 13 }}
                onClick={() => setActiveSectionId(sid)}>
                {entry.icon||"📅"} {entry.title}
              </button>
            );
          })}
        </div>
      )}

      {/* Gated content */}
      {(!hasSeating || enabledSections.length === 0) ? (
        <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)", background: "var(--bg-surface)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🪑</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text-primary)", marginBottom: 8 }}>
            {!hasSeating ? "Assigned seating is off" : "No sub-events selected"}
          </div>
          <div style={{ fontSize: 14, maxWidth: 360, margin: "0 auto" }}>
            {!hasSeating ? "Turn on assigned seating in the Setup panel above to start building your chart."
              : "Select one or more sub-events in the Setup panel above to get started."}
          </div>
        </div>
      ) : (<>

        {/* Stat cards */}
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card"><div className="stat-label">Tables</div><div className="stat-value">{tables.length}</div></div>
          <div className="stat-card"><div className="stat-label">Total Seats</div><div className="stat-value">{totalSeats}</div></div>
          <div className="stat-card"><div className="stat-label">Seated</div><div className="stat-value" style={{ color: "var(--green)" }}>{seated}</div><div className="stat-sub">of {totalPeople} people</div></div>
          <div className="stat-card"><div className="stat-label">Unseated</div><div className="stat-value" style={{ color: unseated.length > 0 ? "var(--red)" : "var(--green)" }}>{unseated.length}</div>{tbdPeople.length > 0 && <div className="stat-sub">{tbdPeople.length} TBD</div>}</div>
        </div>

        {/* Summary line */}
        {tables.length > 0 && (() => {
          const over = tables.filter(t => tableOccupants(t.id).length > (parseInt(t.capacity) || 0));
          return (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span>{tables.length} table{tables.length !== 1 ? "s" : ""} · {totalSeats} seat{totalSeats !== 1 ? "s" : ""} · {seated} seated · {unseated.length} unseated</span>
              {over.length > 0 && <span style={{ color: "var(--red)", fontWeight: 600 }}>· ⚠ {over.length === 1 ? `${over[0].name} is` : `${over.length} tables are`} over capacity</span>}
            </div>
          );
        })()}

        {/* Mobile desktop recommendation */}
        {isMobile && (
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8 }}>
            💡 For the best experience, seating charts are easiest to manage on a desktop or tablet.
          </div>
        )}

        {/* Mobile tab switcher */}
        {isMobile && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button className={`btn ${mobilePanel === "tables" ? "btn-primary" : "btn-ghost"}`} style={{ flex: 1 }} onClick={() => setMobilePanel("tables")}>🪑 Tables ({tables.length})</button>
            <button className={`btn ${mobilePanel === "unseated" ? "btn-primary" : "btn-ghost"}`} style={{ flex: 1 }} onClick={() => setMobilePanel("unseated")}>Unseated ({unseated.length})</button>
          </div>
        )}

        {/* Main layout */}
        <div style={{ display: isMobile ? "block" : "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>

          {/* LEFT: Table cards */}
          {(!isMobile || mobilePanel === "tables") && (
            <div>
              {tables.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--text-muted)", background: "var(--bg-surface)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🪑</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text-primary)", marginBottom: 8 }}>No tables yet</div>
                  <div style={{ fontSize: 14, marginBottom: 24 }}>Add tables to start building your seating chart{activeSection ? ` for ${activeSection.icon||""} ${activeSection.title}` : ""}.</div>
                  <button className="btn btn-primary" onClick={() => setShowTableModal(true)}>+ Add First Table</button>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                  {sortedTables.map((table, tableIndex) => {
                    const lastIndex = sortedTables.length - 1;
                    const occupants = tableOccupants(table.id);
                    const cap       = parseInt(table.capacity) || 0;
                    const filled    = occupants.length;
                    const pct       = cap > 0 ? Math.min(100, Math.round((filled / cap) * 100)) : 0;
                    const isOver    = filled > cap;
                    const isNear    = !isOver && cap > 0 && pct >= 80;
                    const barColor  = isOver ? "var(--red)" : isNear ? "var(--gold)" : "var(--green)";
                    const tb        = TYPE_BADGE[table.type] || TYPE_BADGE["Mixed"];
                    const isTarget  = !!selectedPersonId;

                    const byHousehold = {};
                    occupants.forEach(p => {
                      const hhName = getPersonHouseholdName(p) || "Unknown";
                      if (!byHousehold[hhName]) byHousehold[hhName] = [];
                      byHousehold[hhName].push(p);
                    });

                    return (
                      <div key={table.id} onClick={() => handleTableClick(table.id)} style={{ background: "var(--bg-surface)", border: isTarget ? "2px solid var(--accent-primary)" : "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 16, cursor: isTarget ? "pointer" : "default", transition: "border-color 0.15s, box-shadow 0.15s", boxShadow: isTarget ? "0 0 0 3px var(--accent-light)" : "none" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                          <div>
                            <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>{table.name}</div>
                            {isTarget
                              ? <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "var(--accent-light)", color: "var(--accent-primary)" }}>✦ Click to assign {selectedPerson ? (selectedPerson.firstName || getPersonDisplayName(selectedPerson).split(" ")[0]) : ""}</span>
                              : <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: tb.bg, color: tb.color }}>{table.type}</span>}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: isOver ? "var(--red)" : "var(--text-secondary)" }}>{filled}/{cap}</span>
                            <button className="icon-btn" title="Move up" style={{ fontSize: 12, opacity: tableIndex === 0 ? 0.3 : 1 }} disabled={isArchived || tableIndex === 0} onClick={e => { e.stopPropagation(); handleMoveTable(table.id, "up"); }}>↑</button>
                            <button className="icon-btn" title="Move down" style={{ fontSize: 12, opacity: tableIndex === lastIndex ? 0.3 : 1 }} disabled={isArchived || tableIndex === lastIndex} onClick={e => { e.stopPropagation(); handleMoveTable(table.id, "down"); }}>↓</button>
                            <button className="icon-btn" title="Edit" disabled={isArchived} onClick={e => { e.stopPropagation(); setEditTable(table); }}>✎</button>
                            <button className="icon-btn icon-btn-danger" title="Delete" disabled={isArchived} onClick={e => { e.stopPropagation(); setDeleteConfirm(table); }}>✕</button>
                          </div>
                        </div>
                        <div style={{ height: 5, background: "var(--bg-muted)", borderRadius: 99, overflow: "hidden", marginBottom: 10 }}>
                          <div style={{ height: "100%", width: pct + "%", background: barColor, borderRadius: 99, transition: "width 0.3s ease" }} />
                        </div>
                        {table.notes && <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", marginBottom: 10, lineHeight: 1.5 }}>{table.notes}</div>}
                        <button className="btn btn-ghost" style={{ width: "100%", marginBottom: filled > 0 ? 10 : 0, fontSize: 12 }} onClick={e => { e.stopPropagation(); setAssignModalTable(table); }}>Manage Assignments</button>
                        {filled > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 180, overflowY: "auto" }}>
                            {Object.entries(byHousehold).map(([hhName, members]) => (
                              <div key={hhName}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", padding: "4px 0 2px" }}>{hhName}</div>
                                {members.map(p => (
                                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 4px", borderRadius: 4, fontSize: 13 }}>
                                    <span style={{ color: "var(--text-primary)" }}>{getPersonDisplayName(p)}</span>
                                    <button className="icon-btn icon-btn-danger" style={{ padding: "1px 3px", fontSize: 10 }} onClick={e => { e.stopPropagation(); unassignPerson(p.id); }}>✕</button>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* RIGHT: Unseated panel */}
          {(!isMobile || mobilePanel === "unseated") && (
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden", position: isMobile ? "static" : "sticky", top: 80 }}>
              <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", background: "var(--bg-subtle)" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Unseated ({unseated.length})</div>
                {tbdPeople.length > 0 && <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{tbdPeople.length} person{tbdPeople.length !== 1 ? "s" : ""} not yet confirmed</div>}
                <input className="form-input" style={{ marginBottom: 6, fontSize: 12, padding: "5px 8px" }} placeholder="Search by name…" value={unseatedSearch} onChange={e => setUnseatedSearch(e.target.value)} />
                <select className="form-select" style={{ fontSize: 12, padding: "5px 8px" }} value={unseatedGroup} onChange={e => setUnseatedGroup(e.target.value)}>
                  <option value="All">All Groups</option>
                  {groups.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div style={{ maxHeight: "calc(100vh - 340px)", overflowY: "auto" }}>
                {unseatedFiltered.length === 0 ? (
                  <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                    {scopedPeople.length === 0 ? (
                      <div>
                        <div style={{ marginBottom: 8 }}>No confirmed attendees for this sub-event yet.</div>
                        <div style={{ fontSize: 12, lineHeight: 1.6 }}>Go to the <button onClick={() => setActiveTab && setActiveTab("guests")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent-primary)", fontWeight: 700, fontSize: 12, padding: 0, textDecoration: "underline" }}>Guests tab</button> and confirm per-person attendance.</div>
                      </div>
                    ) : unseated.length === 0 ? "Everyone is seated! 🎉" : "No matching people."}
                  </div>
                ) : (
                  unseatedFiltered.map(p => {
                    const isSelected = selectedPersonId === p.id;
                    const group      = getPersonGroup(p);
                    return (
                      <div key={p.id} onClick={() => handlePersonClick(p.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderBottom: "1px solid var(--border)", cursor: "pointer", background: isSelected ? "var(--accent-light)" : "transparent", borderLeft: isSelected ? "3px solid var(--accent-primary)" : "3px solid transparent", transition: "background 0.12s" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500, color: isSelected ? "var(--accent-dark)" : "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{getPersonDisplayName(p)}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{getPersonHouseholdName(p)}</div>
                        </div>
                        {group && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 99, background: "var(--bg-muted)", color: "var(--text-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>{group}</span>}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

      </>)}

      {showTableModal  && <TableModal tableCount={tables.length} onSave={handleAddTable}  onClose={() => setShowTableModal(false)} isArchived={isArchived} />}
      {editTable       && <TableModal table={editTable} tableCount={tables.length} onSave={handleEditTable} onClose={() => setEditTable(null)} isArchived={isArchived} />}

      {assignModalTable && (
        <AssignModal table={assignModalTable} tables={tables} people={people} households={households} sectionId={sectionId}
          getPersonDisplayName={getPersonDisplayName} getPersonGroup={getPersonGroup} getPersonHouseholdName={getPersonHouseholdName}
          groups={groups} onAssign={assignPerson} onUnassign={unassignPerson} onClose={() => setAssignModalTable(null)} />
      )}

      {deleteConfirm && (() => {
        const affected = tableOccupants(deleteConfirm.id).length;
        return (
          <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}>
            <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header"><div className="modal-title">Delete Table</div><button className="icon-btn" title="Close" onClick={() => setDeleteConfirm(null)}>✕</button></div>
              <div className="modal-body">
                <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6, marginBottom: 4 }}>
                  Permanently delete <strong>{deleteConfirm.name}</strong>?
                  {affected > 0 && <span style={{ color: "var(--red)" }}> {affected} person{affected !== 1 ? "s" : ""} assigned here will be unassigned.</span>}
                </p>
                <div className="modal-footer">
                  <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                  <button className="btn btn-danger" onClick={() => handleDeleteTable(deleteConfirm.id)}>Delete Table</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {showExportModal && (
        <SeatingExportModal tables={sortedTables} people={scopedPeople} households={households} adminConfig={adminConfig || {}}
          sectionId={sectionId}
          sectionTitle={activeSection ? `${activeSection.icon||""} ${activeSection.title}`.trim() : ""}
          onPrint={(html) => { setPrintHTML(html); setShowExportModal(false); }}
          onClose={() => setShowExportModal(false)} />
      )}

      {printHTML && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setPrintHTML(null); }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", width: "95%", maxWidth: 960, height: "90vh", display: "flex", flexDirection: "column", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>Print Preview — Seating Chart</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => { const f = document.getElementById("seating-print-frame"); if (f?.contentWindow) f.contentWindow.print(); }}>🖨 Print</button>
                <button className="icon-btn" title="Close" onClick={() => setPrintHTML(null)}>✕</button>
              </div>
            </div>
            <iframe id="seating-print-frame" srcDoc={printHTML} style={{ flex: 1, border: "none", borderRadius: "0 0 var(--radius-lg) var(--radius-lg)" }} title="Seating Chart Print Preview" />
          </div>
        </div>
      )}

      {/* Auto-Seat confirmation modal */}
      {showAutoSeat && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowAutoSeat(false); }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", width: "90%", maxWidth: 480, padding: "28px", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>✨ Auto-Seat Guests</div>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 8 }}>
              SimchaKit will assign all <strong>{unseated.length} unseated guest{unseated.length !== 1 ? "s" : ""}</strong> to available tables, keeping households together where possible. Guests already assigned to tables will not be moved.
            </p>
            {sortedTables.some(t => t.type === "kids") && (
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
                👧 Kids will be assigned to kids tables, adults to adult tables.
              </p>
            )}
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
              You can manually adjust any assignment after auto-seat runs.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setShowAutoSeat(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAutoSeat}>Run Auto-Seat</button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Seat result modal */}
      {autoSeatResult && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setAutoSeatResult(null); }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", width: "90%", maxWidth: 480, padding: "28px", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>✨ Auto-Seat Complete</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "var(--green-light)", border: "1px solid var(--green)", borderRadius: "var(--radius-md)", marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>✓</span>
              <span style={{ fontSize: 14, color: "var(--green)", fontWeight: 600 }}>{autoSeatResult.seatedCount} guest{autoSeatResult.seatedCount !== 1 ? "s" : ""} seated automatically</span>
            </div>
            {autoSeatResult.splits.length > 0 && (
              <div style={{ padding: "10px 14px", background: "var(--gold-light)", border: "1px solid var(--gold)", borderRadius: "var(--radius-md)", marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gold)", marginBottom: 4 }}>⚠ {autoSeatResult.splits.length} household{autoSeatResult.splits.length !== 1 ? "s" : ""} split across tables</div>
                {autoSeatResult.splits.map((s, i) => (
                  <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)" }}>{s.householdName}</div>
                ))}
              </div>
            )}
            {autoSeatResult.unplaced.length > 0 && (
              <div style={{ padding: "10px 14px", background: "var(--red-light)", border: "1px solid var(--red)", borderRadius: "var(--radius-md)", marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--red)", marginBottom: 4 }}>⚠ {autoSeatResult.unplaced.length} guest{autoSeatResult.unplaced.length !== 1 ? "s" : ""} could not be placed — not enough remaining seat capacity</div>
                {autoSeatResult.unplaced.map((u, i) => (
                  <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)" }}>{u.personName}</div>
                ))}
              </div>
            )}
            {autoSeatResult.splits.length === 0 && autoSeatResult.unplaced.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>✓ All households seated together with no splits.</div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button className="btn btn-primary" onClick={() => setAutoSeatResult(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AssignModal, TableModal, SeatingExportModal ───────────────────────────────
export function AssignModal({ table, tables, people, households, sectionId, getPersonDisplayName, getPersonGroup, getPersonHouseholdName, groups, onAssign, onUnassign, onClose }) {
  const [search, setSearch]           = useState("");
  const [groupFilter, setGroupFilter] = useState("All");

  const cap      = parseInt(table.capacity) || 0;
  const getPersonTableId = (p) => sectionId ? (p.tableAssignments?.[sectionId] || null) : p.tableId;
  const assigned = people.filter(p => getPersonTableId(p) === table.id);
  const available = people.filter(p => !getPersonTableId(p) && (sectionId ? (p.attendingSections||[]).includes(sectionId) : true));

  const filteredAvailable = available.filter(p => {
    if (groupFilter !== "All" && getPersonGroup(p) !== groupFilter) return false;
    if (search && !getPersonDisplayName(p).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    const ga = getPersonGroup(a), gb = getPersonGroup(b);
    if (ga !== gb) return ga.localeCompare(gb);
    return getPersonDisplayName(a).localeCompare(getPersonDisplayName(b));
  });

  const byHousehold = {};
  assigned.forEach(p => {
    const hhName = getPersonHouseholdName(p) || "Unknown";
    if (!byHousehold[hhName]) byHousehold[hhName] = [];
    byHousehold[hhName].push(p);
  });

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header"><div className="modal-title">Manage — {table.name}</div><button className="icon-btn" title="Close" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{assigned.length} of {cap} seats filled</span>
            <div style={{ flex: 1, height: 5, background: "var(--bg-muted)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 99, width: cap > 0 ? Math.min(100, Math.round((assigned.length/cap)*100)) + "%" : "0%", background: assigned.length > cap ? "var(--red)" : assigned.length/cap >= 0.8 ? "var(--gold)" : "var(--green)", transition: "width 0.3s ease" }} />
            </div>
          </div>
          {assigned.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Currently Assigned ({assigned.length})</div>
              <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
                {Object.entries(byHousehold).map(([hhName, members]) => (
                  <div key={hhName}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", padding: "5px 10px 2px", background: "var(--bg-subtle)" }}>{hhName}</div>
                    {members.map(p => (
                      <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 10px", borderTop: "1px solid var(--border)" }}>
                        <span style={{ fontSize: 13 }}>{getPersonDisplayName(p)}</span>
                        <button className="icon-btn icon-btn-danger" onClick={() => onUnassign(p.id)} title="Unassign">✕</button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input className="form-input" style={{ flex: 1, fontSize: 12, padding: "5px 8px" }} placeholder="Search by name…" value={search} onChange={e => setSearch(e.target.value)} />
            <select className="form-input" style={{ width: 140, fontSize: 12, padding: "5px 8px" }} value={groupFilter} onChange={e => setGroupFilter(e.target.value)}>
              <option value="All">All Groups</option>
              {groups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Available ({filteredAvailable.length})</div>
          <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
            {filteredAvailable.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>{available.length === 0 ? "All people are assigned to tables." : "No matching people."}</div>
            ) : filteredAvailable.map(p => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{getPersonDisplayName(p)}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{getPersonHouseholdName(p)} · {getPersonGroup(p)}</div>
                </div>
                <button className="btn btn-primary" style={{ fontSize: 11, padding: "3px 10px" }} onClick={() => onAssign(p.id, table.id)}>+ Assign</button>
              </div>
            ))}
          </div>
          <div className="modal-footer" style={{ marginTop: 16 }}><button className="btn btn-ghost" onClick={onClose}>Done</button></div>
        </div>
      </div>
    </div>
  );
}

export function TableModal({ table, tableCount, onSave, onClose, isArchived }) {
  const isEdit = !!table;
  const [form, setForm] = useState(table || { id: newTableId(), name: `Table ${(tableCount || 0) + 1}`, type: "Mixed", capacity: 10, notes: "" });
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.name.trim() || !form.capacity) return;
    onSave({ ...form, name: form.name.trim(), capacity: parseInt(form.capacity) || 10 });
  };

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header"><div className="modal-title">{isEdit ? "Edit Table" : "Add Table"}</div><button className="icon-btn" title="Close" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div className="form-row">
            <label className="form-label">Table Name *</label>
            <input className="form-input" autoFocus value={form.name} onChange={e => setF("name", e.target.value)} placeholder="e.g., Table 1, Head Table, Kids Table A" />
          </div>
          <div className="form-row two-col">
            <div>
              <label className="form-label">Type</label>
              <select className="form-input" value={form.type} onChange={e => setF("type", e.target.value)}>
                <option value="Adult">Adult</option>
                <option value="Kids">Kids</option>
                <option value="Mixed">Mixed</option>
              </select>
            </div>
            <div>
              <label className="form-label">Capacity (seats) *</label>
              <input className="form-input" type="number" min="1" value={form.capacity} onChange={e => setF("capacity", e.target.value)} placeholder="10" />
            </div>
          </div>
          <div className="form-row">
            <label className="form-label">Notes</label>
            <textarea className="form-input notes-area" rows={2} value={form.notes || ""} onChange={e => setF("notes", e.target.value)} placeholder="Location, special needs, etc." />
          </div>
          <div className="modal-footer">
            <span style={{fontSize:11,color:"var(--text-muted)",marginRight:"auto"}}>* required</span>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={!form.name.trim() || !form.capacity || isArchived}>{isEdit ? "Save Changes" : "Add Table"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SeatingExportModal({ tables, people, households, adminConfig, sectionId, sectionTitle, onPrint, onClose }) {
  const [activeExport, setActiveExport] = useState(null);
  const [copied,       setCopied]       = useState(false);
  const csvContent = activeExport === "byTable" ? exportSeatingByTable(tables, people, households, sectionId) : activeExport === "byPerson" ? exportSeatingByPerson(tables, people, households, sectionId) : "";
  const handlePrint = () => {
    const mainEvt = (adminConfig?.timeline||[]).find(e => e.isMainEvent);
    onPrint(generateSeatingPrintHTML(tables, people, households, adminConfig.name || "", mainEvt?.startDate || "", adminConfig.theme || {}, sectionTitle || "", sectionId || ""));
  };
  const OPTION = (active) => ({ flex: 1, padding: "14px 16px", borderRadius: "var(--radius-md)", border: active ? "2px solid var(--accent-primary)" : "2px solid var(--border)", background: active ? "var(--accent-light)" : "var(--bg-surface)", cursor: "pointer", textAlign: "left", transition: "border-color 0.15s" });
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header"><div className="modal-title">Export Seating Chart</div><button className="icon-btn" title="Close" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <button style={OPTION(activeExport === "byTable")} onClick={() => { setActiveExport("byTable"); setCopied(false); }}><div style={{ fontSize: 20, marginBottom: 6 }}>📋</div><div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)", marginBottom: 4 }}>By Table</div><div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>Tables as columns, names listed underneath. Best for venue staff and day-of binders.</div></button>
            <button style={OPTION(activeExport === "byPerson")} onClick={() => { setActiveExport("byPerson"); setCopied(false); }}><div style={{ fontSize: 20, marginBottom: 6 }}>👤</div><div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)", marginBottom: 4 }}>By Person</div><div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>One row per person with table, household, group, and meal. Best for planning and catering.</div></button>
            <button style={OPTION(false)} onClick={handlePrint}><div style={{ fontSize: 20, marginBottom: 6 }}>🖨</div><div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)", marginBottom: 4 }}>Printable View</div><div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>Grouped by table with names, household, group, meal, and dietary flags. Print-ready.</div></button>
          </div>
          {activeExport && (<>
            <div className="alert alert-info" style={{ marginBottom: 10 }}>{activeExport === "byTable" ? "Copy the CSV and paste into Excel. Tables appear as columns." : "Copy the CSV and paste into Excel. One row per person."}</div>
            <textarea readOnly value={csvContent} onClick={e => e.target.select()} style={{ width: "100%", minHeight: 180, background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 10, fontFamily: "var(--font-mono, monospace)", fontSize: 11, resize: "vertical" }} />
            <div className="modal-footer" style={{ marginTop: 12 }}>
              <button className="btn btn-ghost" onClick={onClose}>Close</button>
              <button className="btn btn-primary" onClick={() => navigator.clipboard.writeText(csvContent).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}>{copied ? "✓ Copied!" : "Copy to Clipboard"}</button>
            </div>
          </>)}
          {!activeExport && <div className="modal-footer"><button className="btn btn-ghost" onClick={onClose}>Cancel</button></div>}
        </div>
      </div>
    </div>
  );
}

const loadingStyle = { padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 };
