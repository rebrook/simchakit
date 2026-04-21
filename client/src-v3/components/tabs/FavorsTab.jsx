// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — FavorsTab.jsx
// Ported from V2. Uses useEventData for Supabase persistence.
// favorConfig saved directly to events.admin_config via Supabase + onConfigSaved.
// Field names match Supabase schema: personName, personId, printName,
// preprint ("TBD"/"Yes"/"No"), attending ("TBD"/"Yes"/"No"), size, category, notes.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useEffect, useCallback } from "react";
import { useEventData }       from "@/hooks/useEventData.js";
import { useSearchHighlight } from "@/hooks/useSearchHighlight.js";
import { SHIRT_SIZES }        from "@/constants/theme.js";
import { newFavorId }         from "@/utils/ids.js";
import { exportFavorsCSV, generateFavorPrintHTML } from "@/utils/exports.js";
import { ArchivedNotice }     from "@/components/shared/ArchivedNotice.jsx";
import { supabase }           from "@/lib/supabase.js";

const STATUS_STYLE = { "Yes": "var(--green)", "No": "var(--red)", "TBD": "var(--text-muted)" };

const DEFAULT_CONFIG = {
  givingFavors:    false,
  favorDescription: "",
  whoGets:         "all",
  needsSizing:     false,
  sizeSource:      "shirt",
  isPersonalized:  false,
  eventSectionId:  "",
};

export function FavorsTab({
  eventId, event, adminConfig, showToast,
  isArchived, searchHighlight, clearSearchHighlight,
  setActiveTab, onConfigSaved,
}) {
  const { items: favors,     loading: fLoading, save, remove } = useEventData(eventId, "favors");
  const { items: people,     loading: pLoading }                = useEventData(eventId, "people");
  const { items: households, loading: hLoading }                = useEventData(eventId, "households");

  // ── Local favorConfig — editable inline, saved to Supabase ───────────────
  const [localConfig,   setLocalConfig]   = useState(() => ({ ...DEFAULT_CONFIG, ...(adminConfig?.favorConfig || {}) }));
  const [configSaving,  setConfigSaving]  = useState(false);
  const [setupOpen,     setSetupOpen]     = useState(!localConfig.givingFavors);

  // Sync if adminConfig changes from outside (e.g. AdminPanel save)
  useEffect(() => {
    if (adminConfig?.favorConfig) {
      setLocalConfig(prev => ({ ...DEFAULT_CONFIG, ...adminConfig.favorConfig, ...prev }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally only on mount — local edits take precedence

  // ── Mobile detection ──────────────────────────────────────────────────────
  const [isMobile,    setIsMobile]    = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  const [mobilePanel, setMobilePanel] = useState("favors");

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // ── Filter + modal state ──────────────────────────────────────────────────
  const [filterSize,   setFilterSize]   = useState("all");
  const [filterPre,    setFilterPre]    = useState("all");
  const [filterAtt,    setFilterAtt]    = useState("all");
  const [filterCat,    setFilterCat]    = useState("all");
  const [search,       setSearch]       = useState("");
  const [availSearch,  setAvailSearch]  = useState("");
  const [availGroup,   setAvailGroup]   = useState("All");
  const [showModal,    setShowModal]    = useState(false);
  const [editFavor,    setEditFavor]    = useState(null);
  const [deleteConfirm,setDeleteConfirm]= useState(null);
  const [showExport,   setShowExport]   = useState(false);
  const [printHTML,    setPrintHTML]    = useState(null);
  const [syncConfirm,  setSyncConfirm]  = useState(false);
  const [openTip,      setOpenTip]      = useState(null);

  useSearchHighlight(searchHighlight, clearSearchHighlight, "favors");

  // ── Sizes from adminConfig or fallback ────────────────────────────────────
  const sizes = useMemo(() =>
    (adminConfig?.shirtSizes || SHIRT_SIZES.filter(s => s)),
    [adminConfig]
  );

  // ── Timeline from adminConfig ─────────────────────────────────────────────
  const timeline = useMemo(() =>
    (adminConfig?.timeline || []).slice().sort((a, b) => (a.startDate || "").localeCompare(b.startDate || "")),
    [adminConfig]
  );

  // ── Household + person helpers ────────────────────────────────────────────
  const hhMap = useMemo(() => Object.fromEntries(households.map(h => [h.id, h])), [households]);

  const getPersonDisplayName = (p) =>
    (p.firstName || p.lastName) ? `${p.firstName || ""} ${p.lastName || ""}`.trim() : (p.name || "Unnamed");
  const getPersonHHName = (p) => hhMap[p.householdId]?.formalName || "";
  const getPersonGroup  = (p) => hhMap[p.householdId]?.group || "";

  const groups = useMemo(() =>
    [...new Set(people.map(p => getPersonGroup(p)).filter(Boolean))].sort(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [people, households]
  );

  // ── Available pool ────────────────────────────────────────────────────────
  const assignedPersonIds = useMemo(() => new Set(favors.map(f => f.personId).filter(Boolean)), [favors]);

  const getAvailablePool = useCallback(() => {
    let pool = people.filter(p => !assignedPersonIds.has(p.id));
    if (localConfig.whoGets === "kids")   pool = pool.filter(p => p.isChild);
    if (localConfig.whoGets === "adults") pool = pool.filter(p => !p.isChild);
    return pool;
  }, [people, assignedPersonIds, localConfig.whoGets]);

  const availPool = getAvailablePool();

  const availFiltered = availPool.filter(p => {
    if (availGroup !== "All" && getPersonGroup(p) !== availGroup) return false;
    if (availSearch && !getPersonDisplayName(p).toLowerCase().includes(availSearch.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    const ga = getPersonGroup(a), gb = getPersonGroup(b);
    if (ga !== gb) return ga.localeCompare(gb);
    return getPersonDisplayName(a).localeCompare(getPersonDisplayName(b));
  });

  // ── Filtered favor list ───────────────────────────────────────────────────
  const getLastName = (name) => (name || "").trim().split(" ").pop();

  const filtered = favors.filter(f => {
    if (filterSize !== "all" && f.size !== filterSize) return false;
    if (filterPre  !== "all" && (f.preprint  || "TBD") !== filterPre)  return false;
    if (filterAtt  !== "all") {
      const person = people.find(p => p.id === f.personId);
      const secId  = localConfig.eventSectionId;
      if (secId) {
        const confirmed = person && (person.attendingSections || []).includes(secId);
        const tbd = !person || (person.attendingSections || []).length === 0;
        if (filterAtt === "Yes" && !confirmed) return false;
        else if (filterAtt === "No"  && (confirmed || tbd)) return false;
        else if (filterAtt === "TBD" && !tbd) return false;
      }
    }
    if (filterCat !== "all" && (f.category || "") !== filterCat) return false;
    if (search && !f.personName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => getLastName(a.personName).localeCompare(getLastName(b.personName)));

  const usedCategories = useMemo(() =>
    [...new Set(favors.map(f => f.category || "").filter(Boolean))].sort(),
    [favors]
  );

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalFavors  = favors.length;
  const preprintYes  = favors.filter(f => f.preprint === "Yes").length;
  const preprintTBD  = favors.filter(f => (f.preprint || "TBD") === "TBD").length;
  const sectionId    = localConfig.eventSectionId;
  const attendingYes = sectionId ? favors.filter(f => {
    const person = people.find(p => p.id === f.personId);
    return person && (person.attendingSections || []).includes(sectionId);
  }).length : 0;
  const attendingTBD = sectionId ? favors.filter(f => {
    const person = people.find(p => p.id === f.personId);
    return !person || (person.attendingSections || []).length === 0;
  }).length : 0;

  const sizeCounts = useMemo(() => {
    const c = {};
    favors.forEach(f => { const s = f.size || ""; if (s) c[s] = (c[s] || 0) + 1; });
    return c;
  }, [favors]);

  const usedSizes = [...new Set(favors.map(f => f.size).filter(Boolean))];

  // ── Config save ───────────────────────────────────────────────────────────
  const saveConfig = async () => {
    if (isArchived) return;
    setConfigSaving(true);
    const newAdminConfig = { ...(adminConfig || {}), favorConfig: localConfig };
    const { error } = await supabase.from("events").update({ admin_config: newAdminConfig }).eq("id", eventId);
    setConfigSaving(false);
    if (error) { showToast("Failed to save favor settings"); return; }
    onConfigSaved?.(newAdminConfig);
    showToast("Favor settings saved");
    if (localConfig.givingFavors) setSetupOpen(false);
  };

  const setFC = (key, val) => setLocalConfig(prev => ({ ...prev, [key]: val }));

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const handleAdd    = async (f)  => { if (isArchived) return; await save(f);                         showToast("Favor added");   setShowModal(false); };
  const handleEdit   = async (f)  => { if (isArchived) return; await save(f);                         showToast("Favor updated"); setEditFavor(null);  };
  const handleDelete = async (id) => {
    if (isArchived) return;
    const f = favors.find(x => x.id === id);
    if (f) await remove(f._rowId);
    showToast("Favor deleted");
    setDeleteConfirm(null);
  };

  const cyclePre = async (id) => {
    if (isArchived) return;
    const f = favors.find(x => x.id === id);
    if (!f) return;
    const next = { "TBD": "Yes", "Yes": "No", "No": "TBD" };
    await save({ ...f, preprint: next[f.preprint || "TBD"] || "TBD" });
  };

  // ── Add person from available panel ───────────────────────────────────────
  const addFromPanel = async (p) => {
    if (isArchived) return;
    const name    = getPersonDisplayName(p);
    const sizeVal = localConfig.sizeSource === "pant"   ? p.pantSize  || ""
                  : localConfig.sizeSource === "manual" ? ""
                  : p.shirtSize || "";
    await save({
      id: newFavorId(), personId: p.id, personName: name,
      size: sizeVal, printName: "", preprint: "TBD",
      notes: "", category: "",
    });
    showToast("Favor added");
  };

  // ── People names for modal datalist ──────────────────────────────────────
  const personNames = useMemo(() =>
    people.map(p => ({
      id:        p.id,
      name:      getPersonDisplayName(p),
      shirtSize: p.shirtSize || "",
      pantSize:  p.pantSize  || "",
    })).filter(p => p.name).sort((a, b) => a.name.localeCompare(b.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [people]
  );

  if (fLoading || pLoading || hLoading) return <div style={loadingStyle}>Loading favors…</div>;

  const { givingFavors, needsSizing, isPersonalized } = localConfig;

  return (
    <div className="tab-content">
      {isArchived && <ArchivedNotice />}

      {/* Section header */}
      <div className="section-header">
        <div>
          <div className="section-title">{localConfig.favorDescription || "Favors"}</div>
          <div className="section-subtitle">
            {givingFavors
              ? `${totalFavors} favor${totalFavors !== 1 ? "s" : ""} tracked`
              : "Set up your favor tracker below"}
          </div>
        </div>
        {givingFavors && (
          <div style={{ display: "flex", gap: 8 }}>
            {favors.length > 0 && (
              <button className="btn btn-secondary" onClick={() => setShowExport(true)}>↓ Export</button>
            )}
            <button className="btn btn-primary" disabled={isArchived} onClick={() => setShowModal(true)}>+ Add Manually</button>
          </div>
        )}
      </div>

      {/* Favor Setup card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
          onClick={() => setSetupOpen(o => !o)}>
          <div>
            <div className="card-title" style={{ marginBottom: 0 }}>⚙ Favor Setup</div>
            {!setupOpen && (
              <div className="card-subtitle" style={{ marginBottom: 0, marginTop: 4 }}>
                {givingFavors
                  ? [
                      localConfig.favorDescription || "Favors",
                      localConfig.whoGets === "kids"   ? "Kids only"
                        : localConfig.whoGets === "adults" ? "Adults only"
                        : localConfig.whoGets === "manual" ? "Manual selection"
                        : "All guests",
                      localConfig.needsSizing    ? "Sizing on"    : null,
                      localConfig.isPersonalized ? "Personalized" : null,
                      localConfig.eventSectionId
                        ? `🎫 ${(timeline.find(e => e.id === localConfig.eventSectionId) || {}).title || "Sub-event linked"}`
                        : null,
                    ].filter(Boolean).join(" · ")
                  : "Not configured · click to set up"}
              </div>
            )}
          </div>
          <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--text-muted)", padding: "0 4px", lineHeight: 1 }}>
            {setupOpen ? "▴" : "▾"}
          </button>
        </div>

        {setupOpen && (
          <div style={{ marginTop: 16 }}>
            {/* Giving favors toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: givingFavors ? 14 : 0 }}>
              <input type="checkbox" id="cfg-giving" checked={!!givingFavors}
                onChange={e => { setFC("givingFavors", e.target.checked); if (e.target.checked) setSetupOpen(false); }}
                style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--accent-primary)" }} />
              <label htmlFor="cfg-giving" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", cursor: "pointer" }}>
                Are you giving out favors?
              </label>
            </div>

            {givingFavors && (<>
              {/* What is the favor */}
              <div className="form-row" style={{ marginBottom: 12 }}>
                <label className="form-label">What is the favor?</label>
                <input className="form-input" value={localConfig.favorDescription || ""}
                  onChange={e => setFC("favorDescription", e.target.value)}
                  placeholder="e.g., Sweatshirts, Tote bags, Candles…" />
              </div>

              {/* Who gets one */}
              <div className="form-row" style={{ marginBottom: 12 }}>
                <label className="form-label">Who receives a favor?</label>
                <select className="form-input" value={localConfig.whoGets || "all"}
                  onChange={e => setFC("whoGets", e.target.value)}>
                  <option value="all">All guests</option>
                  <option value="kids">All kids</option>
                  <option value="adults">All adults</option>
                  <option value="manual">Select manually</option>
                </select>
              </div>

              {/* Toggles row */}
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                {[
                  { key: "needsSizing",    label: "Do favors require sizing?" },
                  { key: "isPersonalized", label: "Will favors be personalized?" },
                ].map(({ key, label }) => (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--text-primary)" }}>
                    <input type="checkbox" checked={!!localConfig[key]}
                      onChange={e => setFC(key, e.target.checked)}
                      style={{ width: 15, height: 15, cursor: "pointer", accentColor: "var(--accent-primary)" }} />
                    {label}
                  </label>
                ))}
              </div>

              {/* Size source */}
              {localConfig.needsSizing && (
                <div className="form-row" style={{ marginTop: 12 }}>
                  <label className="form-label">Which size to pre-fill from the guest list?</label>
                  <select className="form-input" value={localConfig.sizeSource || "shirt"}
                    onChange={e => setFC("sizeSource", e.target.value)}>
                    <option value="shirt">Shirt size</option>
                    <option value="pant">Pant size</option>
                    <option value="manual">Don't pre-fill — enter manually</option>
                  </select>
                </div>
              )}

              {/* Sub-event distribution */}
              <div className="form-row" style={{ marginTop: 12 }}>
                <label className="form-label">Distributed at which sub-event?</label>
                <select className="form-input" value={localConfig.eventSectionId || ""}
                  onChange={e => setFC("eventSectionId", e.target.value)}>
                  <option value="">Not linked to a sub-event</option>
                  {timeline.map(entry => (
                    <option key={entry.id} value={entry.id}>{entry.icon || "📅"} {entry.title}</option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  When set, attendance is automatically derived from each person's confirmed sub-event attendance — no manual entry needed.
                </div>
              </div>
            </>)}

            {!isArchived && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                <button className="btn btn-primary btn-sm" onClick={saveConfig} disabled={configSaving}>
                  {configSaving ? "Saving…" : "Save Settings"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content — only when favors are enabled */}
      {givingFavors && (<>

        {/* Stat cards */}
        <div className="stat-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card">
            <div className="stat-label">Total Favors</div>
            <div className="stat-value">{totalFavors}</div>
          </div>
          {isPersonalized && (
            <div className="stat-card">
              <div className="stat-label">Pre-Printed</div>
              <div className="stat-value" style={{ color: "var(--green)" }}>{preprintYes}</div>
              <div className="stat-sub">{preprintTBD} TBD · {favors.length - preprintYes - preprintTBD} No</div>
            </div>
          )}
          {localConfig.eventSectionId && (
            <div className="stat-card">
              <div className="stat-label">Attending</div>
              <div className="stat-value" style={{ color: "var(--green)" }}>{attendingYes}</div>
              <div className="stat-sub">{attendingTBD} TBD</div>
            </div>
          )}
        </div>

        {/* Size summary card */}
        {needsSizing && totalFavors > 0 && (
          <div className="stat-card" style={{ marginBottom: 16 }}>
            <div className="stat-label" style={{ marginBottom: 8 }}>Size Summary</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {sizes.filter(s => s).map(s => {
                const count = sizeCounts[s] || 0;
                return (
                  <div key={s} style={{ padding: "4px 10px", borderRadius: "var(--radius-sm)", background: count > 0 ? "var(--accent-light)" : "var(--bg-muted)", border: `1px solid ${count > 0 ? "var(--accent-medium)" : "var(--border)"}`, fontSize: 12, fontWeight: 600, color: count > 0 ? "var(--accent-primary)" : "var(--text-muted)" }}>
                    {s.split(" | ")[0]}: {count}
                  </div>
                );
              })}
              <div style={{ padding: "4px 10px", borderRadius: "var(--radius-sm)", background: "var(--green-light)", border: "1px solid var(--green)", fontSize: 12, fontWeight: 600, color: "var(--green)" }}>
                Total: {totalFavors}
              </div>
            </div>
          </div>
        )}

        {/* Category breakdown card */}
        {usedCategories.length > 0 && totalFavors > 0 && (
          <div className="stat-card" style={{ marginBottom: 16 }}>
            <div className="stat-label" style={{ marginBottom: 8 }}>By Category</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {usedCategories.map(cat => {
                const count = favors.filter(f => (f.category || "") === cat).length;
                return (
                  <div key={cat} style={{ padding: "4px 10px", borderRadius: "var(--radius-sm)", background: "var(--accent-light)", border: "1px solid var(--accent-medium)", fontSize: 12, fontWeight: 600, color: "var(--accent-primary)", cursor: "pointer" }}
                    onClick={() => setFilterCat(filterCat === cat ? "all" : cat)}
                    title={filterCat === cat ? "Clear filter" : `Filter by ${cat}`}>
                    {cat}: {count}
                  </div>
                );
              })}
              {favors.filter(f => !f.category).length > 0 && (
                <div style={{ padding: "4px 10px", borderRadius: "var(--radius-sm)", background: "var(--bg-muted)", border: "1px solid var(--border)", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                  Uncategorized: {favors.filter(f => !f.category).length}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mobile tab switcher */}
        {isMobile && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button className={`btn ${mobilePanel === "favors" ? "btn-primary" : "btn-ghost"}`} style={{ flex: 1 }}
              onClick={() => setMobilePanel("favors")}>
              ⭐ Favors ({favors.length})
            </button>
            <button className={`btn ${mobilePanel === "available" ? "btn-primary" : "btn-ghost"}`} style={{ flex: 1 }}
              onClick={() => setMobilePanel("available")}>
              Available ({availPool.length})
            </button>
          </div>
        )}

        {/* Main two-column layout */}
        <div style={{ display: isMobile ? "block" : "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>

          {/* LEFT: Favors list */}
          {(!isMobile || mobilePanel === "favors") && <div>
            {/* Filter bar */}
            <div className="filter-bar">
              <input className="form-input" placeholder="Search by name…"
                value={search} onChange={e => setSearch(e.target.value)} />
              {needsSizing && (
                <select className="form-select" value={filterSize} onChange={e => setFilterSize(e.target.value)}>
                  <option value="all">All Sizes</option>
                  {usedSizes.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              {isPersonalized && (
                <select className="form-select" value={filterPre} onChange={e => setFilterPre(e.target.value)}>
                  <option value="all">All Preprint</option>
                  <option value="Yes">Yes</option>
                  <option value="TBD">TBD</option>
                  <option value="No">No</option>
                </select>
              )}
              {localConfig.eventSectionId && (
                <select className="form-select" value={filterAtt} onChange={e => setFilterAtt(e.target.value)}>
                  <option value="all">All Attending</option>
                  <option value="Yes">Yes</option>
                  <option value="TBD">TBD</option>
                  <option value="No">No</option>
                </select>
              )}
              {usedCategories.length > 0 && (
                <select className="form-select" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                  <option value="all">All Categories</option>
                  {usedCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>

            {/* Empty state */}
            {favors.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 24px", color: "var(--text-muted)", background: "var(--bg-surface)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>⭐</div>
                <div style={{ fontSize: 14, marginBottom: 4 }}>No favor recipients yet.</div>
                <div style={{ fontSize: 13 }}>Select people from the Available panel on the right to add them to the list.</div>
              </div>
            ) : (
              <>
                {openTip && (
                  <div style={{ position: "fixed", inset: 0, zIndex: 299 }}
                    onClick={() => setOpenTip(null)} />
                )}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        <th style={TH}>Name</th>
                        <th style={TH}>Category</th>
                        {needsSizing && <th style={TH}>Size</th>}
                        {isPersonalized && (
                          <th style={{ ...TH, position: "relative" }}>
                            Name on Favor
                            <button onClick={e => { e.stopPropagation(); setOpenTip(t => t === "printName" ? null : "printName"); }}
                              aria-label="Name on Favor info"
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 11, marginLeft: 4, padding: 0, lineHeight: 1, verticalAlign: "middle" }}>ⓘ</button>
                            {openTip === "printName" && (
                              <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 300, width: 220, background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-md)", padding: "10px 12px", fontSize: 12, color: "var(--text-secondary)", fontWeight: 400, textTransform: "none", letterSpacing: 0, lineHeight: 1.5, whiteSpace: "normal" }}>
                                The name or text to print on the favor — e.g. a nickname, family role, or custom label. Leave blank to skip personalization for this person.
                              </div>
                            )}
                          </th>
                        )}
                        {isPersonalized && (
                          <th style={{ ...TH, textAlign: "center", position: "relative" }}>
                            Pre-Printed?
                            <button onClick={e => { e.stopPropagation(); setOpenTip(t => t === "preprint" ? null : "preprint"); }}
                              aria-label="Pre-Printed info"
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 11, marginLeft: 4, padding: 0, lineHeight: 1, verticalAlign: "middle" }}>ⓘ</button>
                            {openTip === "preprint" && (
                              <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 300, width: 220, background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-md)", padding: "10px 12px", fontSize: 12, color: "var(--text-secondary)", fontWeight: 400, textTransform: "none", letterSpacing: 0, lineHeight: 1.5, whiteSpace: "normal" }}>
                                Has this person's name already been printed on the favor before the event? Tap the cell to cycle: TBD → Yes → No.
                              </div>
                            )}
                          </th>
                        )}
                        {localConfig.eventSectionId && (
                          <th style={{ ...TH, textAlign: "center" }}>Attending</th>
                        )}
                        <th style={TH}>Notes</th>
                        <th style={{ ...TH, textAlign: "center", width: 64 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr><td colSpan={9} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>No matching entries.</td></tr>
                      ) : (
                        filtered.map(f => (
                          <tr key={f.id || f._rowId} id={`row-${f.id}`} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ ...TD, fontWeight: 600, color: "var(--text-primary)" }}>
                              {f.personName || "—"}
                              {f.personId && <div style={{ fontSize: 11, color: "var(--accent-medium)" }}>● Guest list</div>}
                            </td>
                            <td style={TD}>
                              {f.category ? (
                                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: "var(--radius-sm)", background: "var(--accent-light)", color: "var(--accent-primary)", border: "1px solid var(--accent-medium)" }}>
                                  {f.category}
                                </span>
                              ) : (
                                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>
                              )}
                            </td>
                            {needsSizing && (
                              <td style={{ ...TD, color: "var(--text-secondary)" }}>{f.size || "—"}</td>
                            )}
                            {isPersonalized && (
                              <td style={{ ...TD, color: "var(--text-secondary)" }}>{f.printName || "—"}</td>
                            )}
                            {isPersonalized && (
                              <td style={{ ...TD, textAlign: "center", cursor: "pointer", fontWeight: 600, color: STATUS_STYLE[f.preprint || "TBD"] }}
                                onClick={() => cyclePre(f.id)} title="Click to cycle">
                                {f.preprint || "TBD"}
                              </td>
                            )}
                            {localConfig.eventSectionId && (() => {
                              const person = people.find(p => p.id === f.personId);
                              const confirmed = person && (person.attendingSections || []).includes(localConfig.eventSectionId);
                              const tbd = !person || (person.attendingSections || []).length === 0;
                              const label = confirmed ? "Yes" : tbd ? "TBD" : "No";
                              return (
                                <td style={{ ...TD, textAlign: "center", fontWeight: 600, color: STATUS_STYLE[label] }}>
                                  {label}
                                </td>
                              );
                            })()}
                            <td style={{ ...TD, color: "var(--text-muted)", fontSize: 12, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.notes || "—"}</td>
                            <td style={{ ...TD, textAlign: "center" }}>
                              <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                                <button className="icon-btn" title="Edit"   disabled={isArchived} onClick={() => setEditFavor(f)}>✎</button>
                                <button className="icon-btn icon-btn-danger" title="Delete" disabled={isArchived} onClick={() => setDeleteConfirm(f)}>✕</button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>}

          {/* RIGHT: Available panel */}
          {(!isMobile || mobilePanel === "available") && <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden", position: isMobile ? "static" : "sticky", top: 80 }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", background: "var(--bg-subtle)" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>
                Available ({availPool.length})
              </div>
              <input className="form-input" style={{ marginBottom: 6, fontSize: 12, padding: "5px 8px" }}
                placeholder="Search by name…" value={availSearch} onChange={e => setAvailSearch(e.target.value)} />
              <select className="form-input" style={{ fontSize: 12, padding: "5px 8px" }}
                value={availGroup} onChange={e => setAvailGroup(e.target.value)}>
                <option value="All">All Groups</option>
                {groups.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div style={{ maxHeight: "calc(100vh - 360px)", overflowY: "auto" }}>
              {availFiltered.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                  {people.length === 0 ? (
                    <div>
                      <div style={{ marginBottom: 8 }}>No people added yet.</div>
                      <div style={{ lineHeight: 1.6 }}>
                        Go to the{" "}
                        <button onClick={() => setActiveTab && setActiveTab("guests")}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent-primary)", fontWeight: 700, fontSize: 13, padding: 0, textDecoration: "underline" }}>
                          Guests tab
                        </button>
                        {" "}to add households first.
                      </div>
                    </div>
                  ) : availPool.length === 0 ? (
                    "Everyone matching your filter has been added. 🎉"
                  ) : (
                    "No matching people."
                  )}
                </div>
              ) : (
                availFiltered.map(p => (
                  <div key={p.id}
                    onClick={() => addFromPanel(p)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--bg-subtle)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {getPersonDisplayName(p)}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {getPersonHHName(p)}
                        {p.shirtSize ? ` · ${p.shirtSize}` : ""}
                      </div>
                    </div>
                    {getPersonGroup(p) && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 99, background: "var(--bg-muted)", color: "var(--text-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>
                        {getPersonGroup(p)}
                      </span>
                    )}
                    <span style={{ color: "var(--green)", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>+</span>
                  </div>
                ))
              )}
            </div>
          </div>}
        </div>
      </>)}

      {/* Add modal */}
      {showModal && (
        <FavorModal favorConfig={localConfig} people={people} personNames={personNames} sizes={sizes} favors={favors}
          timeline={timeline} onSave={handleAdd} onClose={() => setShowModal(false)} isArchived={isArchived} />
      )}

      {/* Edit modal */}
      {editFavor && (
        <FavorModal favor={editFavor} favorConfig={localConfig} people={people} personNames={personNames} sizes={sizes} favors={favors}
          timeline={timeline} onSave={handleEdit} onClose={() => setEditFavor(null)} isArchived={isArchived} />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) { setDeleteConfirm(null); } }}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Delete Favor Recipient</div>
              <button className="icon-btn" title="Close" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6 }}>
                Delete <strong>{deleteConfirm.personName || "this person"}</strong> from the favors list?
                {deleteConfirm.personId && " They will return to the Available panel."}
              </p>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm.id)}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export modal */}
      {showExport && (
        <FavorExportModal
          favors={favors} favorConfig={localConfig}
          adminConfig={adminConfig || {}}
          onPrint={html => { setPrintHTML(html); setShowExport(false); }}
          onClose={() => setShowExport(false)}
        />
      )}

      {/* Print preview */}
      {printHTML && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) { setPrintHTML(null); } }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", width: "95%", maxWidth: 960, height: "90vh", display: "flex", flexDirection: "column", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 500, color: "var(--text-primary)" }}>Print Preview — Favor List</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary" style={{ fontSize: 12 }}
                  onClick={() => { const f = document.getElementById("favor-print-frame"); if (f?.contentWindow) f.contentWindow.print(); }}>
                  🖨 Print
                </button>
                <button className="icon-btn" title="Close" onClick={() => setPrintHTML(null)}>✕</button>
              </div>
            </div>
            <iframe id="favor-print-frame" srcDoc={printHTML}
              style={{ flex: 1, border: "none", borderRadius: "0 0 var(--radius-lg) var(--radius-lg)" }}
              title="Favor List Print Preview" />
          </div>
        </div>
      )}
    </div>
  );
}

// ── FavorModal ────────────────────────────────────────────────────────────────
export function FavorModal({ favor, favorConfig, people, personNames, sizes, favors = [], timeline, onSave, onClose, isArchived }) {
  const isEdit = !!favor;
  const [form, setForm] = useState(favor || {
    id: newFavorId(), personId: null, personName: "",
    size: "", printName: "", preprint: "TBD", notes: "", category: "",
  });
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const sizeFromPerson = (p) =>
    favorConfig.sizeSource === "pant"   ? p.pantSize  || ""
  : favorConfig.sizeSource === "manual" ? ""
  : p.shirtSize || "";

  const handleNameChange = (val) => {
    const match = personNames.find(p => p.name.toLowerCase() === val.toLowerCase());
    if (match) {
      setForm(f => ({ ...f, personName: match.name, personId: match.id, size: sizeFromPerson(match) || f.size }));
    } else {
      setForm(f => ({ ...f, personName: val, personId: null }));
    }
  };

  const handleSave = () => {
    if (!form.personName.trim()) return;
    onSave({ ...form, personName: form.personName.trim() });
  };

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? "Edit Favor Entry" : "Add Favor Entry"}</div>
          <button className="icon-btn" title="Close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">

          <div className="form-row">
            <label className="form-label">Person Name *</label>
            <input className="form-input" autoFocus list="favor-person-list"
              value={form.personName} onChange={e => handleNameChange(e.target.value)}
              placeholder="Name or select from guest list…" />
            <datalist id="favor-person-list">
              {personNames.map(p => <option key={p.id} value={p.name} />)}
            </datalist>
            {form.personId && <div style={{ fontSize: 11, color: "var(--accent-medium)", marginTop: 4 }}>● Linked to guest list</div>}
          </div>

          <div className="form-row">
            <label className="form-label">Category</label>
            <input className="form-input" list="favor-category-list"
              value={form.category || ""} onChange={e => setF("category", e.target.value)}
              placeholder="e.g., Student, Family, Staff…" />
            <datalist id="favor-category-list">
              {["Student", "Family", "Staff", "Adult Guest", "Kid Guest", "Vendor", "Other"].map(c => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Optional — used for grouping and filtering</div>
          </div>

          {favorConfig.needsSizing && (
            <div className="form-row">
              <label className="form-label">Size</label>
              <select className="form-input" value={form.size || ""} onChange={e => setF("size", e.target.value)}>
                {["", ...(sizes || [])].map(s => <option key={s} value={s}>{s || "(none)"}</option>)}
              </select>
            </div>
          )}

          {favorConfig.isPersonalized && (<>
            <div className="form-row">
              <label className="form-label">Name on Favor</label>
              <input className="form-input" value={form.printName || ""}
                onChange={e => setF("printName", e.target.value)}
                placeholder="e.g., Dad, Aunt Ains, C-Bizkit" />
              {form.printName?.trim() && favors.some(f => f.id !== form.id && (f.printName || "").trim().toLowerCase() === form.printName.trim().toLowerCase()) && (
                <div style={{ fontSize: 11, color: "var(--gold,#b45309)", marginTop: 4 }}>⚠ This name is already used on another favor entry.</div>
              )}
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>The name or text to print on the favor — e.g. a nickname, family role, or custom label. Leave blank to skip personalization for this person.</div>
            </div>
            <div className="form-row">
              <label className="form-label">Pre-Printed?</label>
              <select className="form-input" value={form.preprint || "TBD"} onChange={e => setF("preprint", e.target.value)}>
                <option value="TBD">TBD</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Has this person's name already been printed on the favor before the event?</div>
            </div>
          </>)}

          {favorConfig.eventSectionId && (() => {
            const person = people.find(p => p.id === form.personId);
            const entry  = (timeline || []).find(e => e.id === favorConfig.eventSectionId);
            const confirmed = person && (person.attendingSections || []).includes(favorConfig.eventSectionId);
            const tbd = !person || (person.attendingSections || []).length === 0;
            const label = confirmed ? "Yes — confirmed" : tbd ? "TBD — attendance not yet set" : "No — not attending this sub-event";
            const color = confirmed ? "var(--green)" : tbd ? "var(--text-muted)" : "var(--red)";
            return (
              <div className="form-row">
                <label className="form-label">Attending {entry ? `${entry.icon || ""} ${entry.title}` : "sub-event"}</label>
                <div style={{ fontSize: 13, fontWeight: 600, color, padding: "8px 0" }}>{label}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  Derived from the person's confirmed sub-event attendance. Edit in the Guests tab.
                </div>
              </div>
            );
          })()}

          <div className="form-row">
            <label className="form-label">Notes</label>
            <textarea className="form-input notes-area" rows={2}
              value={form.notes || ""} onChange={e => setF("notes", e.target.value)}
              placeholder="Any notes…" />
          </div>

          <div className="modal-footer">
            <span style={{ fontSize: 11, color: "var(--text-muted)", marginRight: "auto" }}>* required</span>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={!form.personName.trim() || isArchived}>
              {isEdit ? "Save Changes" : "Add Entry"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── FavorExportModal ──────────────────────────────────────────────────────────
export function FavorExportModal({ favors, favorConfig, adminConfig, onPrint, onClose }) {
  const [showCSV, setShowCSV] = useState(false);
  const [copied,  setCopied]  = useState(false);

  const csvContent = showCSV ? exportFavorsCSV(favors, favorConfig) : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(csvContent).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  };

  const handlePrint = () => {
    const mainEvt = (adminConfig?.timeline || []).find(e => e.isMainEvent);
    onPrint(generateFavorPrintHTML(favors, favorConfig, adminConfig.name || "", mainEvt?.startDate || "", adminConfig.theme || {}));
  };

  const OPT = (active) => ({
    flex: 1, padding: "14px 16px", borderRadius: "var(--radius-md)",
    border: active ? "2px solid var(--accent-primary)" : "2px solid var(--border)",
    background: active ? "var(--accent-light)" : "var(--bg-surface)",
    cursor: "pointer", textAlign: "left", transition: "border-color 0.15s, background 0.15s",
  });

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Export Favor List</div>
          <button className="icon-btn" title="Close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <button style={OPT(showCSV)} onClick={() => { setShowCSV(true); setCopied(false); }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>📋</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)", marginBottom: 4 }}>CSV Export</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>One row per person, sorted by last name. For vendor order forms.</div>
            </button>
            <button style={OPT(false)} onClick={handlePrint}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>🖨</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)", marginBottom: 4 }}>Printable View</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
                {favorConfig.needsSizing ? "Grouped by size with totals. " : "Alphabetical list. "}
                Day-of distribution checklist.
              </div>
            </button>
          </div>
          {showCSV && (<>
            <div className="alert alert-info" style={{ marginBottom: 10 }}>Copy the CSV below and paste into Excel or send to your vendor.</div>
            <textarea readOnly value={csvContent} onClick={e => e.target.select()}
              style={{ width: "100%", minHeight: 160, background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 10, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-primary)", resize: "vertical" }} />
            <div className="modal-footer" style={{ marginTop: 12 }}>
              <button className="btn btn-ghost" onClick={onClose}>Close</button>
              <button className="btn btn-primary" onClick={handleCopy}>{copied ? "✓ Copied!" : "Copy to Clipboard"}</button>
            </div>
          </>)}
          {!showCSV && (
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const loadingStyle = { padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 };
const TH = { padding: "6px 10px", textAlign: "left", fontWeight: 700, color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" };
const TD = { padding: "6px 10px" };
