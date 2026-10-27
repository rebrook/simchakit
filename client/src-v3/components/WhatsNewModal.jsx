// What's new window: up to three highlights since the person last looked, one disclosure for the
// smaller changes, and a second view, the release archive (search, type chips, areas, months).
// Data comes from public/whats-new/index.json and the month files it opens, never the old changelog.
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { loadJson, loadUnseen } from "@/lib/whatsNew.js";

const KINDS = {
  new:      { label: "New",      glyph: "✦" },
  improved: { label: "Improved", glyph: "↑" },
  fixed:    { label: "Fixed",    glyph: "✓" },
};
const monthName = (m) => new Date(m + "-01T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
const dayName   = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fullDay   = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const plural    = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

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

export function WhatsNewModal({ onClose, index, lastSeen, onSeen, onShowMe, onLearnMore, startView = "whatsnew" }) {
  const [view, setView]   = useState(startView);
  const [nonce, setNonce] = useState(0);
  const [data, setData]   = useState(null);          // { highlights, rest } for the "what's new" view
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
    (index ? Promise.resolve(index) : loadJson("index", { fresh: nonce > 0 }))
      .then(ix => loadUnseen(ix, baseline.current))
      .then(d => { if (live) setData(d); })
      .catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [index, nonce]);

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

  useEffect(() => { headingRef.current?.focus(); }, [view]);

  const retry = () => setNonce(n => n + 1);
  const latestDate = index?.latestDate;

  return (
    <div className="modal-backdrop wn-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} className={`wn-modal${view === "archive" ? " wn-wide" : ""}`} role="dialog" aria-modal="true"
           aria-label={view === "archive" ? "Release notes" : "What's new"} onMouseDown={e => e.stopPropagation()}>
        {view === "archive"
          ? <Archive index={index} headingRef={headingRef} onClose={onClose} onBack={() => setView("whatsnew")} />
          : (
            <>
              <header className="wn-hd">
                <div>
                  <h2 className="wn-title" ref={headingRef} tabIndex={-1}>What's new</h2>
                  <p className="wn-sub">{data && data.highlights.length === 0 && data.rest.length === 0 ? "You are up to date" : baseline.current ? "Since your last visit" : "Recent highlights"}</p>
                </div>
                <button type="button" className="wn-x" aria-label="Close" onClick={onClose}><span aria-hidden="true">×</span></button>
              </header>
              {error ? <LoadError onRetry={retry} />
                : !data ? <div className="wn-state" role="status"><p className="wn-sub">Loading…</p></div>
                : data.highlights.length === 0 && data.rest.length === 0 ? (
                  <div className="wn-up">
                    <p className="wn-big">{latestDate ? `Nothing new since ${fullDay(latestDate)}` : "Nothing new yet"}</p>
                    <p className="wn-sub">You have seen everything in the latest release.</p>
                    <button type="button" className="wn-btn" onClick={() => setView("archive")}>See all release notes</button>
                  </div>
                ) : (
                  <>
                    <div className="wn-bd">
                      {data.highlights.map(h => (
                        <article key={h.id} className="wn-card">
                          <div className="wn-meta"><span className="wn-area">{h.area}</span><span>{dayName(h.date)}</span></div>
                          <h3 className="wn-card-t">{h.title}</h3>
                          {h.body && <p className="wn-body">{h.body}</p>}
                          <div className="wn-act">
                            {h.show && <button type="button" className="wn-btn wn-fill" onClick={() => onShowMe?.(h.show)}>Show me</button>}
                            {h.guide && <button type="button" className="wn-link" onClick={() => onLearnMore?.(h.guide)}>Learn more</button>}
                          </div>
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
                              <span className="wn-li-d">{dayName(e.date)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <footer className="wn-ft">
                      <button type="button" className="wn-link" onClick={() => setView("archive")}>All release notes</button>
                      <button type="button" className="wn-btn wn-fill" onClick={() => { onSeen?.(); onClose(); }}>Got it</button>
                    </footer>
                  </>
                )}
            </>
          )}
      </div>
    </div>
  );
}

// ── Release archive ──────────────────────────────────────────────────────────
function Archive({ index, headingRef, onClose, onBack }) {
  const [ix, setIx]         = useState(index || null);
  const [files, setFiles]   = useState({});            // month -> entries
  const [opened, setOpened] = useState({});            // month -> true when the person opened an older month
  const [q, setQ]           = useState("");
  const [kinds, setKinds]   = useState({ new: true, improved: true, fixed: true });
  const [area, setArea]     = useState("All");
  const [error, setError]   = useState(false);
  const [nonce, setNonce]   = useState(0);

  const filtering = q.trim() !== "" || area !== "All" || !(kinds.new && kinds.improved && kinds.fixed);
  const months = useMemo(() => ix?.months || [], [ix]);

  const fetchMonth = useCallback((m) => {
    loadJson(m).then(f => setFiles(prev => ({ ...prev, [m]: f.entries }))).catch(() => setError(true));
  }, []);

  useEffect(() => {
    setError(false);
    if (ix) return;
    loadJson("index", { fresh: nonce > 0 }).then(setIx).catch(() => setError(true));
  }, [ix, nonce]);

  // The current month always loads. While searching or filtering, every month loads so results are complete.
  useEffect(() => {
    if (!months.length) return;
    months.forEach((m, i) => { if (!files[m.month] && (i === 0 || filtering || opened[m.month])) fetchMonth(m.month); });
  }, [months, filtering, opened, files, fetchMonth, nonce]);

  const match = useCallback((e) => {
    const s = q.trim().toLowerCase();
    return kinds[e.kind] && (area === "All" || e.area === area) && (!s || `${e.title} ${e.area}`.toLowerCase().includes(s));
  }, [q, kinds, area]);

  const groups = useMemo(() => months.map(m => {
    const all = files[m.month];
    const rows = all ? all.filter(match) : null;
    return { ...m, rows };
  }), [months, files, match]);

  const visible = groups.filter(g => !filtering || (g.rows && g.rows.length > 0));
  const stillLoading = filtering && groups.some(g => !g.rows);
  const noResults = filtering && !stillLoading && visible.length === 0;
  const areas = ["All", ...Object.keys(ix?.areas || {}).sort()];
  const areaCount = (a) => a === "All" ? months.reduce((n, m) => n + m.count, 0) : (ix?.areas?.[a] || 0);
  const clear = () => { setQ(""); setArea("All"); setKinds({ new: true, improved: true, fixed: true }); };
  const toggleKind = (k) => setKinds(prev => ({ ...prev, [k]: !prev[k] }));

  const controls = (
    <>
      <label className="wn-search">
        <span aria-hidden="true">⌕</span>
        <input type="search" placeholder="Search release notes" aria-label="Search release notes" value={q} onChange={e => setQ(e.target.value)} />
      </label>
      <div className="wn-chips" role="group" aria-label="Type">
        {Object.entries(KINDS).map(([k, v]) => (
          <button key={k} type="button" className="wn-chip" aria-pressed={!!kinds[k]} onClick={() => toggleKind(k)}>
            <span aria-hidden="true">{kinds[k] ? "✓" : ""}</span>{v.label}
          </button>
        ))}
      </div>
    </>
  );

  return (
    <>
      <header className="wn-hd">
        <div>
          <h2 className="wn-title" ref={headingRef} tabIndex={-1}>Release notes</h2>
          <p className="wn-sub">Everything that changed for hosts, newest first</p>
        </div>
        <button type="button" className="wn-x" aria-label="Close" onClick={onClose}><span aria-hidden="true">×</span></button>
      </header>
      {error ? <LoadError onRetry={() => { setError(false); setNonce(n => n + 1); }} /> : (
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
            {!ix ? <p className="wn-sub">Loading…</p>
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
                        <span className="wn-row-d">{dayName(e.date)}</span>
                      </div>
                    )) : <p className="wn-sub">Loading…</p>)
                      : <button type="button" className="wn-link" onClick={() => setOpened(o => ({ ...o, [g.month]: true }))}>Show {plural(g.count, "change")}</button>}
                  </section>
                );
              })}
          </div>
        </div>
      )}
      <footer className="wn-ft">
        <button type="button" className="wn-link" onClick={onBack}>Back to What's new</button>
        <button type="button" className="wn-btn" onClick={onClose}>Close</button>
      </footer>
    </>
  );
}
