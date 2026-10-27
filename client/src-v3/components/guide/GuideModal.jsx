// Help center: a two-pane dialog on desktop (grouped section rail, search, article pages) and a
// full-screen drill-down on a phone (Start here, a section, a topic). Content: constants/guideContent.js.
import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import { getSection, getTopic, searchGuide, guideHash } from "./guideModel.js";
import { HomeView, SectionView, TopicView, ResultsView, Rail } from "./GuideViews.jsx";
import { useDialog } from "./useDialog.js";

const SLIDES_URL = "https://about.simcha-kit.com/resources/new-user-training.html";
const SUPPORT_URL = "mailto:hello@simcha-kit.com";

const initialView = (target) => {
  const s = target?.sectionId && getSection(target.sectionId) ? target.sectionId : null;
  if (!s) return { v: "home", s: null, t: null };
  const t = target.topicId && getTopic(s, target.topicId) ? target.topicId : null;
  return t ? { v: "topic", s, t } : { v: "section", s, t: null };
};
const keyOf = (v) => `${v.v}|${v.s}|${v.t}`;

function useNarrow() {
  const mq = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(max-width: 639px)") : null;
  const [narrow, setNarrow] = useState(!!mq?.matches);
  useEffect(() => {
    if (!mq) return;
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [mq]);
  return narrow;
}

// target: { sectionId, topicId?, fromTab? }. Opened from a tab, the section shows a "Help for this tab" note.
export function GuideModal({ onClose, target = null }) {
  const narrow = useNarrow();
  const [view, setView] = useState(() => initialView(target));
  const [q, setQ] = useState("");
  const dialogRef = useRef(null), searchRef = useRef(null), titleRef = useRef(null), headingRef = useRef(null), mainRef = useRef(null);
  const memo = useRef({});            // scroll position per view, restored when going back
  const restoring = useRef(false);
  const first = useRef(true);

  useDialog(dialogRef, { onClose, initialFocus: narrow ? titleRef : searchRef });

  const go = useCallback((next, { back = false } = {}) => {
    if (mainRef.current) memo.current[keyOf(view)] = mainRef.current.scrollTop;
    if (!back) delete memo.current[keyOf(next)];
    restoring.current = back;
    setQ("");
    setView(next);
  }, [view]);
  const openTopic   = (s, t) => go({ v: "topic", s, t });
  const openSection = (s) => go({ v: "section", s, t: null });
  const home        = (opts) => go({ v: "home", s: null, t: null }, opts);
  const toHome      = () => home({ back: true });
  const toSection   = () => go({ v: "section", s: view.s, t: null }, { back: true });

  // Scroll: top on the way in, remembered position on the way back. Focus the new heading for keyboard and screen readers.
  useLayoutEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = restoring.current ? (memo.current[keyOf(view)] ?? 0) : 0;
    restoring.current = false;
    if (first.current) { first.current = false; return; }
    headingRef.current?.focus({ preventScroll: true });
  }, [view]);

  // Keep the address bar's #/guide link in step with where the reader is; the shell removes it on close.
  useEffect(() => {
    try { window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}${guideHash(view.s, view.t)}`); } catch { /* ignore */ }
  }, [view]);

  // "/" jumps to search from anywhere in the dialog except a text field.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
      e.preventDefault(); searchRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const searching = q.trim() !== "";
  const results = useMemo(() => searching ? searchGuide(q) : [], [q, searching]);
  const section = view.s ? getSection(view.s) : null;
  const topic = section && view.t ? getTopic(view.s, view.t) : null;

  let body;
  if (searching) body = <ResultsView query={q} results={results} onOpen={openTopic} />;
  else if (view.v === "topic" && topic) body = <TopicView narrow={narrow} section={section} topic={topic} onHome={toHome} onSection={toSection} onOpen={openTopic} headingRef={headingRef} />;
  else if (view.v === "section" && section) body = <SectionView narrow={narrow} section={section} fromTab={!!target?.fromTab && view.s === target.sectionId} onHome={toHome} onOpen={openTopic} headingRef={headingRef} />;
  else body = <HomeView narrow={narrow} onOpen={openTopic} onOpenSection={openSection} headingRef={headingRef} />;

  return (
    <div className="modal-backdrop gd-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="gd-modal" role="dialog" aria-modal="true" aria-label="SimchaKit Guide" onMouseDown={e => e.stopPropagation()}>
        <header className="gd-hd">
          <h2 className="gd-title" ref={titleRef} tabIndex={-1}>Guide</h2>
          <label className="gd-search">
            <span aria-hidden="true">⌕</span>
            <input ref={searchRef} type="search" placeholder="Search the guide" aria-label="Search the guide" value={q} onChange={e => setQ(e.target.value)} />
            {!narrow && <kbd aria-hidden="true">/</kbd>}
          </label>
          <button type="button" className="gd-x" aria-label="Close guide" onClick={onClose}><span aria-hidden="true">×</span></button>
        </header>
        <div className="gd-bd">
          {!narrow && <Rail view={searching ? { v: "search" } : view} onHome={() => home()} onOpenSection={openSection} />}
          <div className="gd-main" ref={mainRef}>{body}</div>
        </div>
        <footer className="gd-ft">
          <a href={SLIDES_URL} target="_blank" rel="noopener noreferrer">Open the new user training slides</a>
          <span aria-hidden="true">·</span>
          <a href={SUPPORT_URL}>Contact support</a>
        </footer>
      </div>
    </div>
  );
}
