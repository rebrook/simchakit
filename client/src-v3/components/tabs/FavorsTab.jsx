// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.2.0 — FavorsTab.jsx
// Full V2 parity rebuild. Adds: Favor Setup card (collapsible, inline-editable),
// Available panel (people not yet in favors, one-click add), two-column desktop
// layout, mobile panel switcher, addFromPanel with auto-size, conditional table
// columns, inline cycling toggles, stat cards, size + category breakdown cards.
// favorConfig saved directly to events.admin_config via Supabase + onConfigSaved.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useEffect, useCallback } from "react";
import { useEventData }       from "@/hooks/useEventData.js";
import { useSearchHighlight } from "@/hooks/useSearchHighlight.js";
import { SHIRT_SIZES }        from "@/constants/theme.js";
import { newFavorId }         from "@/utils/ids.js";
import { exportFavorsCSV }    from "@/utils/exports.js";
import { ArchivedNotice }     from "@/components/shared/ArchivedNotice.jsx";
import { supabase }           from "@/lib/supabase.js";

// ── Tri-state helpers (null = TBD, true = Yes, false = No) ───────────────────
const triState = (val) => val === true ? "yes" : val === false ? "no" : "tbd";
const fromTri  = (str) => str === "yes" ? true  : str === "no"  ? false : null;
const cycleState = (val) => val === null ? true : val === true ? false : null;
const triLabel = (val) => val === true ? "Yes" : val === false ? "No" : "TBD";
const triColor = (val, vars) =>
  val === true  ? vars.green :
  val === false ? vars.red   : vars.muted;

// ── CSS variable shorthands ───────────────────────────────────────────────────
const V = {
  green:   "var(--green)",
  red:     "var(--red)",
  muted:   "var(--text-muted)",
  primary: "var(--accent-primary)",
  light:   "var(--accent-light)",
  medium:  "var(--accent-medium)",
};

// ── Default favorConfig ───────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  givingFavors:    false,
  favorDescription: "",
  whoGets:         "all",
  needsSizing:     false,
  sizeSource:      "shirt",
  isPersonalized:  false,
  trackAttendance: false,
};

export function FavorsTab({
  eventId, event, adminConfig, showToast,
  isArchived, searchHighlight, clearSearchHighlight,
  setActiveTab, onConfigSaved,
}) {
  const { items: favors,     loading: fLoading, save, remove } = useEventData(eventId, "favors");
  const { items: people,     loading: pLoading }                = useEventData(eventId, "people");
  const { items: households, loading: hLoading }                = useEventData(eventId, "households");

  // ── Local favorConfig state (editable inline, saved to Supabase) ──────────
  const [localConfig, setLocalConfig] = useState(() => ({
    ...DEFAULT_CONFIG,
    ...(adminConfig?.favorConfig || {}),
  }));
  const [configOpen,    setConfigOpen]    = useState(!localConfig.givingFavors);
  const [configSaving,  setConfigSaving]  = useState(false);

  // Sync if adminConfig changes from outside (e.g. AdminPanel save)
  useEffect(() => {
    if (adminConfig?.favorConfig) {
      setLocalConfig(prev => ({ ...DEFAULT_CONFIG, ...adminConfig.favorConfig, ...prev }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // intentionally only on mount — local edits take precedence

  // ── Mobile detection ──────────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 640
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // ── Mobile panel switcher ─────────────────────────────────────────────────
  const [mobilePanel, setMobilePanel] = useState("favors");

  // ── Filter state ──────────────────────────────────────────────────────────
  const [filterSize,   setFilterSize]   = useState("all");
  const [filterPre,    setFilterPre]    = useState("all");
  const [filterAtt,    setFilterAtt]    = useState("all");
  const [filterCat,    setFilterCat]    = useState("all");
  const [search,       setSearch]       = useState("");
  const [availSearch,  setAvailSearch]  = useState("");
  const [availGroup,   setAvailGroup]   = useState("All");

  // ── Add/edit modal ────────────────────────────────────────────────────────
  const [showAdd,  setShowAdd]  = useState(false);
  const [editing,  setEditing]  = useState(null);

  useSearchHighlight(searchHighlight, clearSearchHighlight, "favors");

  // ── Sizes from adminConfig or fallback ────────────────────────────────────
  const sizes = useMemo(() =>
    (adminConfig?.sizes || []).filter(Boolean).length > 0
      ? adminConfig.sizes
      : SHIRT_SIZES.filter(Boolean),
    [adminConfig]
  );

  // ── Household map for Available panel ────────────────────────────────────
  const hhMap = useMemo(() => {
    const m = {};
    for (const h of households) m[h.id || h._rowId] = h;
    return m;
  }, [households]);

  // ── Person display helpers ────────────────────────────────────────────────
  const getPersonName = (p) =>
    [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "Unnamed";
  const getPersonGroup = (p) =>
    hhMap[p.householdId]?.group || "";

  // ── Available pool: people not already in favors ──────────────────────────
  const getAvailablePool = useCallback(() => {
    const inFavors = new Set(favors.map(f => f.personId).filter(Boolean));
    return people.filter(p => {
      if (inFavors.has(p.id || p._rowId)) return false;
      if (localConfig.whoGets === "kids")   return p.isChild === true;
      if (localConfig.whoGets === "adults") return p.isChild === false;
      return true; // "all" and "manual" show everyone
    });
  }, [people, favors, localConfig.whoGets]);

  const availPool = getAvailablePool();
  const groups = useMemo(() =>
    ["All", ...new Set(people.map(p => getPersonGroup(p)).filter(Boolean))].sort((a, b) =>
      a === "All" ? -1 : b === "All" ? 1 : a.localeCompare(b)
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [people, households]
  );

  const availFiltered = availPool.filter(p => {
    if (availGroup !== "All" && getPersonGroup(p) !== availGroup) return false;
    if (availSearch && !getPersonName(p).toLowerCase().includes(availSearch.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    const ga = getPersonGroup(a), gb = getPersonGroup(b);
    if (ga !== gb) return ga.localeCompare(gb);
    return getPersonName(a).localeCompare(getPersonName(b));
  });

  // ── Filtered favor list ───────────────────────────────────────────────────
  const getLastName = (name) => (name || "").trim().split(" ").pop();
  const filtered = favors.filter(f => {
    if (filterSize !== "all" && f.size !== filterSize) return false;
    if (filterPre  !== "all" && triState(f.prePrinted) !== filterPre) return false;
    if (filterAtt  !== "all" && triState(f.attending)  !== filterAtt) return false;
    if (filterCat  !== "all" && (f.category || "") !== filterCat)     return false;
    if (search && !getPersonName(f).toLowerCase().includes(search.toLowerCase()) &&
        !(f.nameOnFavor || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => getLastName(a.personName).localeCompare(getLastName(b.personName)));

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalFavors  = favors.length;
  const preprintYes  = favors.filter(f => f.prePrinted === true).length;
  const preprintTBD  = favors.filter(f => f.prePrinted === null || f.prePrinted === undefined).length;
  const attendingYes = favors.filter(f => f.attending  === true).length;
  const attendingTBD = favors.filter(f => f.attending  === null || f.attending  === undefined).length;

  const sizeCounts = useMemo(() => {
    const c = {};
    for (const f of favors) { if (f.size) c[f.size] = (c[f.size] || 0) + 1; }
    return c;
  }, [favors]);

  const usedCategories = useMemo(() =>
    [...new Set(favors.map(f => f.category || "").filter(Boolean))].sort(),
    [favors]
  );

  // ── Config save ───────────────────────────────────────────────────────────
  const saveConfig = async () => {
    if (isArchived) return;
    setConfigSaving(true);
    const newAdminConfig = { ...(adminConfig || {}), favorConfig: localConfig };
    const { error } = await supabase
      .from("events")
      .update({ admin_config: newAdminConfig })
      .eq("id", eventId);
    setConfigSaving(false);
    if (error) {
      showToast("Failed to save favor settings");
      return;
    }
    onConfigSaved?.(newAdminConfig);
    showToast("Favor settings saved");
    if (localConfig.givingFavors) setConfigOpen(false);
  };

  const setFC = (key, val) => setLocalConfig(prev => ({ ...prev, [key]: val }));

  // ── addFromPanel ──────────────────────────────────────────────────────────
  const addFromPanel = async (person) => {
    if (isArchived) return;
    const pid  = person.id || person._rowId;
    const name = getPersonName(person);
    let size = "";
    if (localConfig.needsSizing) {
      if (localConfig.sizeSource === "pant")   size = person.pantSize  || "";
      else if (localConfig.sizeSource === "manual") size = "";
      else                                      size = person.shirtSize || "";
    }
    const category = person.isChild ? "Kid" : "Adult";
    const newFavor = {
      id:         newFavorId(),
      personId:   pid,
      personName: name,
      householdId: person.householdId || "",
      size,
      category,
      nameOnFavor: "",
      prePrinted:  null,
      attending:   null,
      notes:       "",
    };
    await save(newFavor);
    showToast(`${name} added to favors`);
  };

  // ── Inline toggle ─────────────────────────────────────────────────────────
  const toggleField = async (favor, field) => {
    if (isArchived) return;
    await save({ ...favor, [field]: cycleState(favor[field]) });
  };

  // ── Modal save ────────────────────────────────────────────────────────────
  const handleSave = async (data) => {
    await save(data);
    setShowAdd(false);
    setEditing(null);
    showToast(editing ? "Favor updated" : "Favor added");
  };

  const handleDelete = async (f) => {
    if (isArchived) return;
    await remove(f._rowId);
    showToast("Favor removed");
  };

  const handleExport = () => {
    const csv = exportFavorsCSV(favors, localConfig);
    navigator.clipboard.writeText(csv).then(() => showToast("CSV copied to clipboard"));
  };

  // ── People names for modal datalist ──────────────────────────────────────
  const peopleNames = useMemo(() =>
    people.map(p => ({
      name: getPersonName(p),
      id:   p.id || p._rowId,
      shirtSize: p.shirtSize || "",
      pantSize:  p.pantSize  || "",
      isChild:   p.isChild,
    })).filter(p => p.name).sort((a, b) => a.name.localeCompare(b.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [people]
  );

  // ── Loading ───────────────────────────────────────────────────────────────
  if (fLoading || pLoading || hLoading) {
    return <div style={S.loading}>Loading favors…</div>;
  }

  const { givingFavors, needsSizing, isPersonalized, trackAttendance } = localConfig;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {isArchived && <ArchivedNotice />}

      {/* ── Section header ── */}
      <div className="section-header">
        <div>
          <div className="section-title">
            {localConfig.favorDescription || "Favors"}
          </div>
          <div className="section-subtitle">
            {givingFavors
              ? `${totalFavors} recipient${totalFavors !== 1 ? "s" : ""}`
              : "Set up your favor tracker below"}
          </div>
        </div>
        {givingFavors && (
          <div style={{ display: "flex", gap: 8 }}>
            {favors.length > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={handleExport}>
                ↓ Export CSV
              </button>
            )}
            {!isArchived && (
              <button className="btn btn-primary btn-sm"
                onClick={() => { setEditing(null); setShowAdd(true); }}>
                + Add Favor
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Favor Setup card (collapsible) ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}
          onClick={() => setConfigOpen(o => !o)}
        >
          <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
            ⚙ Favor Setup
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {!configOpen && givingFavors && (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {localConfig.favorDescription || "Configured"} · {localConfig.whoGets === "all" ? "All guests" : localConfig.whoGets === "kids" ? "Kids only" : localConfig.whoGets === "adults" ? "Adults only" : "Manual"}{needsSizing ? " · Sizing on" : ""}
              </span>
            )}
            <span style={{ fontSize: 18, color: "var(--text-muted)", lineHeight: 1 }}>
              {configOpen ? "▴" : "▾"}
            </span>
          </div>
        </div>

        {configOpen && (
          <div style={{ marginTop: 16 }}>
            {/* givingFavors toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: givingFavors ? 16 : 0 }}>
              <input type="checkbox" id="cfg-giving" checked={!!givingFavors}
                disabled={isArchived}
                onChange={e => setFC("givingFavors", e.target.checked)}
                style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--accent-primary)" }} />
              <label htmlFor="cfg-giving" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", cursor: "pointer" }}>
                Are you giving out favors?
              </label>
            </div>

            {givingFavors && (<>
              {/* favorDescription */}
              <div className="form-row" style={{ marginBottom: 12 }}>
                <label className="form-label">What is the favor?</label>
                <input className="form-input" value={localConfig.favorDescription || ""}
                  disabled={isArchived}
                  onChange={e => setFC("favorDescription", e.target.value)}
                  placeholder="e.g., Sweatshirts, Tote bags, Candles…" />
              </div>

              {/* whoGets */}
              <div className="form-row" style={{ marginBottom: 12 }}>
                <label className="form-label">Who receives a favor?</label>
                <select className="form-input" value={localConfig.whoGets || "all"}
                  disabled={isArchived}
                  onChange={e => setFC("whoGets", e.target.value)}>
                  <option value="all">All guests</option>
                  <option value="kids">All kids</option>
                  <option value="adults">All adults</option>
                  <option value="manual">Select manually</option>
                </select>
              </div>

              {/* Toggles row */}
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 12 }}>
                {[
                  { key: "needsSizing",     label: "Do favors require sizing?" },
                  { key: "isPersonalized",  label: "Will favors be personalized?" },
                  { key: "trackAttendance", label: "Track attendance for distribution?" },
                ].map(({ key, label }) => (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: isArchived ? "default" : "pointer", fontSize: 13, color: "var(--text-primary)" }}>
                    <input type="checkbox" checked={!!localConfig[key]}
                      disabled={isArchived}
                      onChange={e => setFC(key, e.target.checked)}
                      style={{ width: 15, height: 15, cursor: isArchived ? "default" : "pointer", accentColor: "var(--accent-primary)" }} />
                    {label}
                  </label>
                ))}
              </div>

              {/* sizeSource — only when needsSizing */}
              {localConfig.needsSizing && (
                <div className="form-row" style={{ marginBottom: 12 }}>
                  <label className="form-label">Which size to pre-fill from the guest list?</label>
                  <select className="form-input" value={localConfig.sizeSource || "shirt"}
                    disabled={isArchived}
                    onChange={e => setFC("sizeSource", e.target.value)}>
                    <option value="shirt">Shirt size</option>
                    <option value="pant">Pant size</option>
                    <option value="manual">Don't pre-fill — enter manually</option>
                  </select>
                </div>
              )}
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

      {/* ── Content — only when givingFavors ── */}
      {givingFavors && (<>

        {/* ── Stat cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 16 }}>
          <div className="stat-card">
            <div className="stat-value">{totalFavors}</div>
            <div className="stat-label">Total Favors</div>
          </div>
          {isPersonalized && (
            <div className="stat-card">
              <div className="stat-value" style={{ color: V.green }}>{preprintYes}</div>
              <div className="stat-label">Pre-Printed</div>
              <div style={{ fontSize: 11, color: V.muted, marginTop: 2 }}>{preprintTBD} TBD</div>
            </div>
          )}
          {trackAttendance && (
            <div className="stat-card">
              <div className="stat-value" style={{ color: V.green }}>{attendingYes}</div>
              <div className="stat-label">Attending</div>
              <div style={{ fontSize: 11, color: V.muted, marginTop: 2 }}>{attendingTBD} TBD</div>
            </div>
          )}
          <div className="stat-card">
            <div className="stat-value">{availPool.length}</div>
            <div className="stat-label">Available</div>
            <div style={{ fontSize: 11, color: V.muted, marginTop: 2 }}>not yet added</div>
          </div>
        </div>

        {/* ── Size breakdown ── */}
        {needsSizing && Object.keys(sizeCounts).length > 0 && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="stat-label" style={{ marginBottom: 8 }}>By Size</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {sizes.map(s => {
                const count = sizeCounts[s] || 0;
                return (
                  <div key={s} style={{
                    padding: "4px 10px", borderRadius: "var(--radius-sm)",
                    background: count > 0 ? V.light : "var(--bg-muted)",
                    border: `1px solid ${count > 0 ? V.medium : "var(--border)"}`,
                    fontSize: 12, fontWeight: 600,
                    color: count > 0 ? V.primary : V.muted,
                    cursor: count > 0 ? "pointer" : "default",
                  }}
                    onClick={() => count > 0 && setFilterSize(filterSize === s ? "all" : s)}
                    title={count > 0 ? (filterSize === s ? "Clear filter" : `Filter by ${s}`) : undefined}
                  >
                    {s.split(" | ")[0]}: {count}
                  </div>
                );
              })}
              <div style={{ padding: "4px 10px", borderRadius: "var(--radius-sm)", background: "var(--green-light)", border: "1px solid var(--green)", fontSize: 12, fontWeight: 600, color: V.green }}>
                Total: {totalFavors}
              </div>
            </div>
          </div>
        )}

        {/* ── Category breakdown ── */}
        {usedCategories.length > 0 && totalFavors > 0 && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="stat-label" style={{ marginBottom: 8 }}>By Category</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {usedCategories.map(cat => {
                const count = favors.filter(f => (f.category || "") === cat).length;
                return (
                  <div key={cat} style={{
                    padding: "4px 10px", borderRadius: "var(--radius-sm)",
                    background: V.light, border: `1px solid ${V.medium}`,
                    fontSize: 12, fontWeight: 600, color: V.primary, cursor: "pointer",
                  }}
                    onClick={() => setFilterCat(filterCat === cat ? "all" : cat)}
                    title={filterCat === cat ? "Clear filter" : `Filter by ${cat}`}
                  >
                    {cat}: {count}
                  </div>
                );
              })}
              {favors.filter(f => !f.category).length > 0 && (
                <div style={{ padding: "4px 10px", borderRadius: "var(--radius-sm)", background: "var(--bg-muted)", border: "1px solid var(--border)", fontSize: 12, fontWeight: 600, color: V.muted }}>
                  Uncategorized: {favors.filter(f => !f.category).length}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Mobile panel switcher ── */}
        {isMobile && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button
              className={`btn ${mobilePanel === "favors" ? "btn-primary" : "btn-ghost"}`}
              style={{ flex: 1 }}
              onClick={() => setMobilePanel("favors")}
            >
              ⭐ Favors ({totalFavors})
            </button>
            <button
              className={`btn ${mobilePanel === "available" ? "btn-primary" : "btn-ghost"}`}
              style={{ flex: 1 }}
              onClick={() => setMobilePanel("available")}
            >
              Available ({availPool.length})
            </button>
          </div>
        )}

        {/* ── Two-column layout ── */}
        <div style={{
          display: isMobile ? "block" : "grid",
          gridTemplateColumns: "60% 40%",
          gap: 16,
          alignItems: "start",
        }}>

          {/* ── Left: Favor list ── */}
          {(!isMobile || mobilePanel === "favors") && (
            <div>
              {/* Filter bar */}
              <div className="filter-bar" style={{ marginBottom: 12 }}>
                <input className="form-input" type="text" placeholder="Search by name…"
                  value={search} onChange={e => setSearch(e.target.value)} />
                {needsSizing && (
                  <select className="form-select" value={filterSize} onChange={e => setFilterSize(e.target.value)}>
                    <option value="all">All Sizes</option>
                    {sizes.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
                {isPersonalized && (
                  <select className="form-select" value={filterPre} onChange={e => setFilterPre(e.target.value)}>
                    <option value="all">All Pre-Print</option>
                    <option value="yes">Pre-Printed: Yes</option>
                    <option value="no">Pre-Printed: No</option>
                    <option value="tbd">Pre-Printed: TBD</option>
                  </select>
                )}
                {trackAttendance && (
                  <select className="form-select" value={filterAtt} onChange={e => setFilterAtt(e.target.value)}>
                    <option value="all">All Attending</option>
                    <option value="yes">Attending: Yes</option>
                    <option value="no">Attending: No</option>
                    <option value="tbd">Attending: TBD</option>
                  </select>
                )}
                {usedCategories.length > 0 && (
                  <select className="form-select" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                    <option value="all">All Categories</option>
                    {usedCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              </div>

              {/* Favor table */}
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                {filtered.length === 0 ? (
                  <div style={{ padding: "40px 24px", textAlign: "center", color: V.muted, fontSize: 14 }}>
                    {totalFavors === 0 ? (
                      <>
                        No favor recipients yet.{" "}
                        {availPool.length > 0
                          ? <span>Click a person in the <strong>Available</strong> panel to add them.</span>
                          : people.length === 0
                            ? <span>Add guests first — <button className="btn-link" onClick={() => setActiveTab?.("guests")}>go to Guests tab</button>.</span>
                            : "All guests have been added."}
                      </>
                    ) : "No favors match your filters."}
                  </div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)" }}>
                        <th style={S.th}>Name</th>
                        <th style={S.th}>Category</th>
                        {needsSizing    && <th style={S.th} title="Favor size">Size</th>}
                        {isPersonalized && <th style={S.th} title="Name printed on the favor">Print Name</th>}
                        {isPersonalized && <th style={{ ...S.th, textAlign: "center" }} title="Click to toggle pre-print status">Pre-Printed</th>}
                        {trackAttendance && <th style={{ ...S.th, textAlign: "center" }} title="Click to toggle attendance confirmation">Attending</th>}
                        {!isArchived && <th style={{ ...S.th, width: 60 }}></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(f => (
                        <tr key={f.id || f._rowId} id={`row-${f.id}`}
                          style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ ...S.td, fontWeight: 600 }}>{f.personName}</td>
                          <td style={S.td}>
                            {f.category ? (
                              <span className="tag" style={{ background: "var(--bg-subtle)", fontSize: 11 }}>
                                {f.category}
                              </span>
                            ) : "—"}
                          </td>
                          {needsSizing && (
                            <td style={S.td}>
                              <span className="tag" style={{ background: V.light, color: V.primary, fontSize: 11 }}>
                                {f.size ? f.size.split(" | ")[0] : "TBD"}
                              </span>
                            </td>
                          )}
                          {isPersonalized && (
                            <td style={S.td}>{f.nameOnFavor || <span style={{ color: V.muted }}>—</span>}</td>
                          )}
                          {isPersonalized && (
                            <td style={{ ...S.td, textAlign: "center" }}>
                              <button
                                className="btn-link"
                                style={{ fontWeight: 700, color: triColor(f.prePrinted, V), minWidth: 36 }}
                                title="Click to toggle"
                                onClick={() => toggleField(f, "prePrinted")}
                                disabled={isArchived}
                              >
                                {triLabel(f.prePrinted)}
                              </button>
                            </td>
                          )}
                          {trackAttendance && (
                            <td style={{ ...S.td, textAlign: "center" }}>
                              <button
                                className="btn-link"
                                style={{ fontWeight: 700, color: triColor(f.attending, V), minWidth: 36 }}
                                title="Click to toggle"
                                onClick={() => toggleField(f, "attending")}
                                disabled={isArchived}
                              >
                                {triLabel(f.attending)}
                              </button>
                            </td>
                          )}
                          {!isArchived && (
                            <td style={S.td}>
                              <div style={{ display: "flex", gap: 4 }}>
                                <button className="icon-btn" style={{ width: 26, height: 26 }}
                                  title="Edit favor"
                                  onClick={() => { setEditing(f); setShowAdd(true); }}>✎</button>
                                <button className="icon-btn" style={{ width: 26, height: 26 }}
                                  title="Remove from list"
                                  onClick={() => handleDelete(f)}>✕</button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── Right: Available panel ── */}
          {(!isMobile || mobilePanel === "available") && (
            <div>
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "var(--bg-subtle)" }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)", marginBottom: 8 }}>
                    Available ({availPool.length})
                  </div>
                  <input className="form-input" type="text" placeholder="Search…"
                    value={availSearch} onChange={e => setAvailSearch(e.target.value)}
                    style={{ marginBottom: 6 }} />
                  <select className="form-select" value={availGroup} onChange={e => setAvailGroup(e.target.value)}>
                    {groups.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                <div style={{ maxHeight: 480, overflowY: "auto" }}>
                  {availPool.length === 0 ? (
                    <div style={{ padding: "24px 14px", textAlign: "center", color: V.muted, fontSize: 13 }}>
                      {people.length === 0
                        ? <>No guests yet — <button className="btn-link" onClick={() => setActiveTab?.("guests")}>add guests first</button>.</>
                        : "Everyone has been added! 🎉"}
                    </div>
                  ) : availFiltered.length === 0 ? (
                    <div style={{ padding: "24px 14px", textAlign: "center", color: V.muted, fontSize: 13 }}>
                      No matching people.
                    </div>
                  ) : (
                    availFiltered.map(p => (
                      <div key={p.id || p._rowId}
                        onClick={() => !isArchived && addFromPanel(p)}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "9px 14px", borderBottom: "1px solid var(--border)",
                          cursor: isArchived ? "default" : "pointer",
                        }}
                        onMouseEnter={e => { if (!isArchived) e.currentTarget.style.background = "var(--bg-subtle)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {getPersonName(p)}
                          </div>
                          <div style={{ fontSize: 11, color: V.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {getPersonGroup(p)}
                            {needsSizing && localConfig.sizeSource !== "manual" && (
                              <span style={{ marginLeft: 6 }}>
                                {localConfig.sizeSource === "pant"
                                  ? (p.pantSize  ? `· ${p.pantSize}`  : "· no pant size")
                                  : (p.shirtSize ? `· ${p.shirtSize}` : "· no shirt size")}
                              </span>
                            )}
                          </div>
                        </div>
                        {!isArchived && (
                          <span style={{ fontSize: 18, color: V.green, fontWeight: 700, lineHeight: 1 }}>+</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </>)}

      {/* ── Add / Edit modal ── */}
      {showAdd && (
        <FavorModal
          favor={editing}
          favorConfig={localConfig}
          sizes={sizes}
          peopleNames={peopleNames}
          onSave={handleSave}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          isArchived={isArchived}
        />
      )}
    </div>
  );
}

// ── FavorModal ────────────────────────────────────────────────────────────────
function FavorModal({ favor, favorConfig, sizes, peopleNames, onSave, onClose, isArchived }) {
  const blank = {
    id:          newFavorId(),
    personName:  "",
    personId:    "",
    householdId: "",
    size:        "",
    category:    "",
    nameOnFavor: "",
    prePrinted:  null,
    attending:   null,
    notes:       "",
  };
  const [form, setForm] = useState(favor || blank);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto-fill size when person is selected
  const handleNameChange = (val) => {
    const match = peopleNames.find(p => p.name.toLowerCase() === val.toLowerCase());
    if (match) {
      let size = form.size;
      if (favorConfig.needsSizing) {
        if (favorConfig.sizeSource === "pant")        size = match.pantSize  || form.size;
        else if (favorConfig.sizeSource !== "manual") size = match.shirtSize || form.size;
      }
      const category = match.isChild ? "Kid" : "Adult";
      setForm(f => ({ ...f, personName: match.name, personId: match.id, size, category }));
    } else {
      setForm(f => ({ ...f, personName: val, personId: "" }));
    }
  };

  const { needsSizing, isPersonalized, trackAttendance } = favorConfig;
  const CATEGORIES = ["Adult", "Kid", "Class", "Other"];

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{favor ? "Edit Favor" : "Add Favor"}</div>
          <button className="icon-btn" onClick={onClose} title="Close">✕</button>
        </div>
        <div className="modal-body">
          {/* Person Name */}
          <div className="form-group">
            <label className="form-label">Person Name *</label>
            <input className="form-input" list="favor-people"
              value={form.personName}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="Recipient name"
              autoFocus />
            <datalist id="favor-people">
              {peopleNames.map(p => <option key={p.id} value={p.name} />)}
            </datalist>
          </div>

          {/* Category + Size */}
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={form.category || ""}
                onChange={e => set("category", e.target.value)}>
                <option value="">—</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {needsSizing && (
              <div className="form-group">
                <label className="form-label">Size</label>
                <select className="form-select" value={form.size || ""}
                  onChange={e => set("size", e.target.value)}>
                  <option value="">TBD</option>
                  {sizes.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Print Name */}
          {isPersonalized && (
            <div className="form-group">
              <label className="form-label">Name on Favor</label>
              <input className="form-input" value={form.nameOnFavor || ""}
                onChange={e => set("nameOnFavor", e.target.value)}
                placeholder="e.g. Dad, Aunt Ains, C-Bizkit" />
            </div>
          )}

          {/* Pre-Printed + Attending */}
          {(isPersonalized || trackAttendance) && (
            <div className="form-grid-2">
              {isPersonalized && (
                <div className="form-group">
                  <label className="form-label">Pre-Printed?</label>
                  <select className="form-select" value={triState(form.prePrinted)}
                    onChange={e => set("prePrinted", fromTri(e.target.value))}>
                    <option value="tbd">TBD</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              )}
              {trackAttendance && (
                <div className="form-group">
                  <label className="form-label">Attending?</label>
                  <select className="form-select" value={triState(form.attending)}
                    onChange={e => set("attending", fromTri(e.target.value))}>
                    <option value="tbd">TBD</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">Notes</label>
            <input className="form-input" value={form.notes || ""}
              onChange={e => set("notes", e.target.value)}
              placeholder="Any notes about this favor…" />
          </div>

          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary"
              disabled={!form.personName?.trim() || isArchived}
              onClick={() => onSave({ ...form })}>
              {favor ? "Save Changes" : "Add Favor"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  loading: { padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 },
  th: { padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" },
  td: { padding: "10px 12px", verticalAlign: "middle" },
};
