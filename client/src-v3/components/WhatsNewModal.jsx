// What's new window with two tabs. Highlights: unseen highlights first (at most three, large, with a
// New label), one disclosure for the smaller unseen changes, then the last three months of highlights
// as compact cards, seen or not. All release notes: the searchable archive. Data comes from
// public/whats-new/index.json and the month files it opens, never the old changelog.
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { loadJson, loadUnseen, isUnseen } from "@/lib/whatsNew.js";

const KINDS = {
  new:      { label: "New",      glyph: "✦" },
  improved: { label: "Improved", glyph: "↑" },
  fixed:    { label: "Fixed",    glyph: "✓" },
};
const monthName = (m) => new Date(m + "-01T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
const dayName   = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const when      = (e) => `${e.release} · ${dayName(e.date)}`;
const plural    = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const newest    = (a, b) => (a.id < b.id ? 1 : -1);

function Kind({ kind }) {
  const k = KINDS[kind] || KINDS.improved;
  return <span className="wn-kind"><span aria-hidden="true">{k.glyph}</span>{k.label}</span>;
}

function LoadError({ onRetry }) {
  return (
    <div className="wn-state" role="alert">
      <p className="wn-state-t">Could not load release notes</p>
      <p className="wn-sub">Check your connection and try again.</p>
      <button type="button" className="wn-btn" onClick={onRetry}>Try again</button>
    </div>
  );
}

// Show me only when the person can open that tab; Learn more only when there is a guide topic. No dead buttons.
function Actions({ entry, canShow, onShowMe, onLearnMore }) {
  const show = entry.show && (!canShow || canShow(entry.show));
  if (!show && !entry.guide) return null;
  return (
    <div className="wn-act">
      {show && <button type="button" className="wn-btn wn-fill" onClick={() => onShowMe?.(entry)}>Show me</button>}
      {entry.guide && <button type="button" className="wn-link" onClick={() => onLearnMore?.(entry.guide)}>Learn more</button>}
    </div>
  );
}

export function WhatsNewModal({ onClose, index, lastSeen, onSeen, onShowMe, onLearnMore, canShow }) {
  const [tab, setTab]     = useState("highlights");
  const [nonce, setNonce] = useState(0);
  const [ix, setIx]       = useState(index || null);
  const [data, setData]   = useState(null);          // { highlights, rest } unseen, for the Highlights tab
  const [error, setError] = useState(false);
  const [openMore, setOpenMore] = useState(false);
  const baseline = useRef(lastSeen);                 // what was unseen when the window opened
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const opener = useRef(typeof document !== "undefined" ? document.activeElement : null);

  // Opening the window counts as seeing it, so the dot clears on every device.
  useEffect(() => { onSeen?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let live = true;
    setError(false); setData(null);
    (ix ? Promise.resolve(ix) : loadJson("index", { fresh: nonce > 0 }))
      .then(i => { if (live) setIx(i); return loadUnseen(i, baseline.current); })
      .then(d => { if (live) setData(d); })
      .catch(() => { if (live) setError(true); });
    return () => { live = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  // Focus the heading, return focus to the opener, Escape closes, Tab stays inside.
  useEffect(() => {
    const prev = opener.current;
    headingRef.current?.focus();
    const key = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const f = [...dialogRef.current.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled && el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === headingRef.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); if (prev && prev.focus && document.contains(prev)) prev.focus(); };
  }, [onClose]);

  const retry = () => setNonce(n => n + 1);
  const hasUnseen = !!data && (data.highlights.length > 0 || data.rest.length > 0);
  const upToDate = !!data && !hasUnseen;

  // Last three months of highlights that are not already shown above (large cards or the disclosure).
  const earlier = useMemo(() => {
    if (!ix || !data) return [];
    const taken = new Set(data.highlights.map(h => h.id));
    return [...(ix.highlights || [])].filter(h => !taken.has(h.id) && !isUnseen(h, baseline.current)).sort(newest);
  }, [ix, data]);

  return (
    <div className="modal-backdrop wn-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} className={`wn-modal${tab === "archive" ? " wn-wide" : ""}`} role="dialog" aria-modal="true"
           aria-label="What's new" onMouseDown={e => e.stopPropagation()}>
        <header className="wn-hd">
          <div>
            <h2 className="wn-title" ref={headingRef} tabIndex={-1}>What's new</h2>
            <p className="wn-sub">{ix?.current ? `You are on ${ix.current}` : " "}</p>
          </div>
          <button type="button" className="wn-x" aria-label="Close" onClick={onClose}><span aria-hidden="true">×</span></button>
        </header>
        <div className="wn-tabs" role="tablist" aria-label="What's new views">
          <button type="button" role="tab" id="wn-t-hl" aria-selected={tab === "highlights"} aria-controls="wn-p" className="wn-tab" onClick={() => setTab("highlights")}>Highlights</button>
          <button type="button" role="tab" id="wn-t-ar" aria-selected={tab === "archive"} aria-controls="wn-p" className="wn-tab" onClick={() => setTab("archive")}>All release notes</button>
        </div>
        <div id="wn-p" role="tabpanel" aria-labelledby={tab === "archive" ? "wn-t-ar" : "wn-t-hl"} className="wn-panel">
          {tab === "archive" ? <Archive index={ix} onIndex={setIx} /> : error ? <LoadError onRetry={retry} />
            : !data || !ix ? <div className="wn-state" role="status"><p className="wn-sub">Loading…</p></div>
            : (
              <div className="wn-bd">
                {upToDate && <p className="wn-note">You are up to date. Nothing new since your last visit.</p>}
                {data.highlights.map(h => (
                  <article key={h.id} className="wn-card">
                    <div className="wn-meta"><span className="wn-newlbl"><span aria-hidden="true">✦</span>New</span><span className="wn-area">{h.area}</span><span>{when(h)}</span></div>
                    <h3 className="wn-card-t">{h.title}</h3>
                    {h.body && <p className="wn-body">{h.body}</p>}
                    <Actions entry={h} canShow={canShow} onShowMe={onShowMe} onLearnMore={onLearnMore} />
                  </article>
                ))}
                {data.rest.length > 0 && (
                  <div className="wn-more">
                    <button type="button" className="wn-more-b" aria-expanded={openMore} onClick={() => setOpenMore(v => !v)}>
                      <span>{plural(data.rest.length, "smaller change")}</span><span>{openMore ? "Hide" : "Show"}</span>
                    </button>
                    {openMore && data.rest.map(e => (
                      <div key={e.id} className="wn-li">
                        <Kind kind={e.kind} />
                        <span className="wn-li-t"><span className="wn-area">{e.area}</span> {e.title}</span>
                        <span className="wn-li-d">{when(e)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {earlier.length > 0 && (
                  <section aria-labelledby="wn-earlier">
                    <h3 className="wn-sec" id="wn-earlier">{hasUnseen ? "Earlier highlights" : "Recent highlights"}</h3>
                    {earlier.map(h => (
                      <article key={h.id} className="wn-mini">
                        <div className="wn-meta"><span className="wn-area">{h.area}</span><span>{when(h)}</span></div>
                        <h4 className="wn-mini-t">{h.title}</h4>
                        <Actions entry={h} canShow={canShow} onShowMe={onShowMe} onLearnMore={onLearnMore} />
                      </article>
                    ))}
                  </section>
                )}
              </div>
            )}
        </div>
        <footer className="wn-ft">
          {tab === "archive" ? <button type="button" className="wn-link" onClick={() => setTab("highlights")}>Back to highlights</button>
            : <button type="button" className="wn-link" onClick={() => setTab("archive")}>All release notes</button>}
          {tab === "highlights" && hasUnseen
            ? <button type="button" className="wn-btn wn-fill" onClick={() => { onSeen?.(); onClose(); }}>Got it</button>
            : <button type="button" className="wn-btn" onClick={onClose}>Close</button>}
        </footer>
      </div>
    </div>
  );
}

// ── Release archive ──────────────────────────────────────────────────────────
function Archive({ index, onIndex }) {
  const [files, setFiles]   = useState({});            // month -> entries
  const [opened, setOpened] = useState({});            // month -> true when the person opened an older month
  const [q, setQ]           = useState("");
  const [kinds, setKinds]   = useState({ new: true, improved: true, fixed: true });
  const [hlOnly, setHlOnly] = useState(false);
  const [area, setArea]     = useState("All");
  const [error, setError]   = useState(false);
  const [nonce, setNonce]   = useState(0);

  const allKinds = kinds.new && kinds.improved && kinds.fixed;
  const filtering = q.trim() !== "" || area !== "All" || !allKinds || hlOnly;
  const months = useMemo(() => index?.months || [], [index]);

  const fetchMonth = useCallback((m) => {
    loadJson(m).then(f => setFiles(prev => ({ ...prev, [m]: f.entries }))).catch(() => setError(true));
  }, []);

  useEffect(() => {
    if (index) return;
    setError(false);
    loadJson("index", { fresh: nonce > 0 }).then(onIndex).catch(() => setError(true));
  }, [index, nonce, onIndex]);

  // The current month always loads. While searching or filtering, every month loads so results are complete.
  useEffect(() => {
    months.forEach((m, i) => { if (!files[m.month] && (i === 0 || filtering || opened[m.month])) fetchMonth(m.month); });
  }, [months, filtering, opened, files, fetchMonth, nonce]);

  const match = useCallback((e) => {
    const s = q.trim().toLowerCase();
    return kinds[e.kind] && (!hlOnly || e.highlight) && (area === "All" || e.area === area)
      && (!s || `${e.title} ${e.area} ${e.release}`.toLowerCase().includes(s));
  }, [q, kinds, hlOnly, area]);

  const groups = useMemo(() => months.map(m => ({ ...m, rows: files[m.month] ? files[m.month].filter(match) : null })), [months, files, match]);
  const visible = groups.filter(g => !filtering || (g.rows && g.rows.length > 0));
  const stillLoading = filtering && groups.some(g => !g.rows);
  const noResults = filtering && !stillLoading && visible.length === 0;
  const areas = ["All", ...Object.keys(index?.areas || {}).sort()];
  const areaCount = (a) => a === "All" ? months.reduce((n, m) => n + m.count, 0) : (index?.areas?.[a] || 0);
  const clear = () => { setQ(""); setArea("All"); setHlOnly(false); setKinds({ new: true, improved: true, fixed: true }); };
  const toggleKind = (k) => setKinds(prev => ({ ...prev, [k]: !prev[k] }));

  const controls = (
    <>
      <label className="wn-search">
        <span aria-hidden="true">⌕</span>
        <input type="search" placeholder="Search notes or a version" aria-label="Search release notes or a version" value={q} onChange={e => setQ(e.target.value)} />
      </label>
      <div className="wn-chips" role="group" aria-label="Type">
        {Object.entries(KINDS).map(([k, v]) => (
          <button key={k} type="button" className="wn-chip" aria-pressed={!!kinds[k]} onClick={() => toggleKind(k)}>
            <span aria-hidden="true">{kinds[k] ? "✓" : ""}</span>{v.label}
          </button>
        ))}
        <button type="button" className="wn-chip" aria-pressed={hlOnly} onClick={() => setHlOnly(v => !v)}>
          <span aria-hidden="true">{hlOnly ? "✓" : ""}</span>Highlights only
        </button>
      </div>
    </>
  );

  if (error) return <LoadError onRetry={() => { setError(false); setNonce(n => n + 1); }} />;
  return (
    <div className="wn-gb">
      <aside className="wn-rail">
        {controls}
        <p className="wn-rg">Area</p>
        <div className="wn-areas">
          {areas.map(a => (
            <button key={a} type="button" className="wn-ri" aria-pressed={area === a} onClick={() => setArea(a)}>
              <span>{a}</span><em>{areaCount(a)}</em>
            </button>
          ))}
        </div>
      </aside>
      <div className="wn-rail-n">
        {controls}
        <div className="wn-arow" role="group" aria-label="Area">
          {areas.map(a => (
            <button key={a} type="button" className="wn-chip" aria-pressed={area === a} onClick={() => setArea(a)}>
              <span aria-hidden="true">{area === a ? "✓" : ""}</span>{a} <em>{areaCount(a)}</em>
            </button>
          ))}
        </div>
      </div>
      <div className="wn-mn" aria-live="polite">
        {!index ? <p className="wn-sub">Loading…</p>
          : noResults ? (
            <div className="wn-none">
              <p>Nothing matches. Clear the search or choose another area.</p>
              <button type="button" className="wn-btn" onClick={clear}>Clear filters</button>
            </div>
          ) : visible.map((g, i) => {
            const open = filtering || i === 0 || opened[g.month];
            return (
              <section key={g.month} className="wn-month">
                <div className="wn-mh"><h3>{monthName(g.month)}</h3><span>{plural(g.rows ? g.rows.length : g.count, "change")}</span></div>
                {open ? (g.rows ? g.rows.map(e => (
                  <div key={e.id} className="wn-row">
                    <span className="wn-row-k"><Kind kind={e.kind} /></span>
                    <span className="wn-area">{e.area}</span>
                    <span className="wn-row-t">{e.highlight && <strong className="wn-hl">Highlight. </strong>}{e.title}</span>
                    <span className="wn-row-d">{when(e)}</span>
                  </div>
                )) : <p className="wn-sub">Loading…</p>)
                  : <button type="button" className="wn-link" onClick={() => setOpened(o => ({ ...o, [g.month]: true }))}>Show {plural(g.count, "change")}</button>}
              </section>
            );
          })}
      </div>
    </div>
  );
}
