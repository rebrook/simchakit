// The Guide's views: Start here, Section, Topic and Search results. Presentational: the modal owns state.
import { GUIDE_SECTIONS, GUIDE_GROUPS, GUIDE_TASKS } from "@/constants/guideContent.js";
import { getSection, getTopic, sectionsInGroup, newTopics, highlightRuns, snippet } from "./guideModel.js";

export const Mark = ({ text, query }) => highlightRuns(text, query).map((r, i) => r.hit ? <mark key={i}>{r.text}</mark> : r.text);
const NewBadge = () => <span className="gd-new"><span aria-hidden="true">✦</span> New</span>;
const Dot = ({ color }) => <i className="gd-dot" aria-hidden="true" style={{ background: color }} />;

function Crumb({ narrow, back, trail }) {
  return (
    <nav className="gd-crumb" aria-label="Breadcrumb">
      {narrow
        ? <button type="button" className="gd-back" onClick={back.onClick}><span aria-hidden="true">‹</span> {back.label}</button>
        : trail.map((c, i) => (
          <span key={i} className="gd-crumb-i">
            {c.onClick ? <button type="button" onClick={c.onClick}>{c.label}</button> : <span aria-current="page">{c.label}</span>}
            {i < trail.length - 1 && <span aria-hidden="true"> ›</span>}
          </span>
        ))}
    </nav>
  );
}

export function TopicRow({ section, topic, query, showSection, onOpen }) {
  const extra = query ? snippet(topic, query) : "";
  return (
    <button type="button" className="gd-row" onClick={() => onOpen(section.id, topic.id)}>
      <span className="gd-row-a">
        {showSection && <span className="gd-kicker">{section.title}</span>}
        <b><Mark text={topic.title} query={query || ""} />{topic.isNew && <NewBadge />}</b>
        <span className="gd-row-s"><Mark text={topic.summary} query={query || ""} /></span>
        {extra && <span className="gd-row-s gd-snip"><Mark text={extra} query={query} /></span>}
      </span>
      <span className="gd-chev" aria-hidden="true">›</span>
    </button>
  );
}

export function SectionList({ onOpenSection }) {
  return GUIDE_GROUPS.map(g => (
    <div key={g}>
      <h4 className="gd-lbl">{g}</h4>
      <div className="gd-sg">
        {sectionsInGroup(g).map(s => (
          <button key={s.id} type="button" className="gd-sc" onClick={() => onOpenSection(s.id)}>
            <Dot color={s.color} /><span>{s.title}</span><em>{s.topics.length}</em>
          </button>
        ))}
      </div>
    </div>
  ));
}

export function HomeView({ narrow, onOpen, onOpenSection, headingRef }) {
  return (
    <>
      <h3 className="gd-h" ref={headingRef} tabIndex={-1}>How can we help?</h3>
      <p className="gd-lead">Start with a common task, or browse by section.</p>
      <div className="gd-tasks">
        {GUIDE_TASKS.map(k => (
          <button key={k.title} type="button" className="gd-tk" onClick={() => onOpen(k.section, k.topic)}><b>{k.title}</b><span>{k.hint}</span></button>
        ))}
      </div>
      {narrow ? <SectionList onOpenSection={onOpenSection} /> : (
        <>
          <h4 className="gd-lbl">New in v5</h4>
          <div className="gd-list">
            {newTopics().map(({ section, topic }) => <TopicRow key={section.id + topic.id} section={section} topic={topic} showSection onOpen={onOpen} />)}
          </div>
        </>
      )}
    </>
  );
}

export function SectionView({ narrow, section, fromTab, onHome, onOpen, headingRef }) {
  return (
    <>
      <Crumb narrow={narrow} back={{ label: "Guide", onClick: onHome }} trail={[{ label: "Guide", onClick: onHome }, { label: section.group }, { label: section.title }]} />
      {fromTab && (
        <p className="gd-tip gd-ctx"><b>Help for this tab</b><span>You opened the Guide from the {section.title} tab. Here is everything about it.</span></p>
      )}
      <h3 className="gd-h" ref={headingRef} tabIndex={-1}>{section.title}</h3>
      <p className="gd-lead">{section.topics.length} {section.topics.length === 1 ? "topic" : "topics"}</p>
      <div className="gd-list">
        {section.topics.map(t => <TopicRow key={t.id} section={section} topic={t} onOpen={onOpen} />)}
      </div>
    </>
  );
}

export function TopicView({ narrow, section, topic, onHome, onSection, onOpen, headingRef }) {
  const i = section.topics.findIndex(t => t.id === topic.id);
  const prev = section.topics[i - 1], next = section.topics[i + 1];
  return (
    <>
      <Crumb narrow={narrow} back={{ label: section.title, onClick: onSection }}
        trail={[{ label: "Guide", onClick: onHome }, { label: section.title, onClick: onSection }, { label: topic.title }]} />
      <article className="gd-art">
        <h3 className="gd-h" ref={headingRef} tabIndex={-1}>{topic.title}{topic.isNew && <NewBadge />}</h3>
        <p className="gd-lead">{topic.summary}</p>
        {topic.steps && <ol className="gd-steps">{topic.steps.map((s, k) => <li key={k}><span>{s}</span></li>)}</ol>}
        {(topic.body || []).map((p, k) => <p key={k} className="gd-p">{p}</p>)}
        {topic.tip && <p className="gd-tip"><b>Good to know</b><span>{topic.tip}</span></p>}
        {topic.related?.length > 0 && (
          <>
            <h4 className="gd-lbl">Related</h4>
            <div className="gd-rel">
              {topic.related.map(([rs, rt]) => { const t = getTopic(rs, rt); return t && <button key={rs + rt} type="button" onClick={() => onOpen(rs, rt)}>{t.title}</button>; })}
            </div>
          </>
        )}
        <div className="gd-pn">
          {prev ? <button type="button" onClick={() => onOpen(section.id, prev.id)}><small>‹ Previous</small><b>{prev.title}</b></button> : <span />}
          {next ? <button type="button" className="gd-r" onClick={() => onOpen(section.id, next.id)}><small>Next ›</small><b>{next.title}</b></button> : <span />}
        </div>
      </article>
    </>
  );
}

export function ResultsView({ query, results, onOpen }) {
  const n = results.length;
  return (
    <>
      <p className="gd-count" role="status" aria-live="polite">{n === 0 ? `No results for “${query.trim()}”` : `${n} ${n === 1 ? "result" : "results"} for “${query.trim()}”`}</p>
      {n > 0
        ? <div className="gd-list">{results.map(r => <TopicRow key={r.section.id + r.topic.id} section={r.section} topic={r.topic} query={query.trim()} showSection onOpen={onOpen} />)}</div>
        : (
          <div className="gd-empty">
            <b>Nothing found</b>
            <p>Try a shorter word, such as “seat” or “RSVP”. You can also open the training slides below, or browse the sections.</p>
          </div>
        )}
    </>
  );
}

export function Rail({ view, onHome, onOpenSection }) {
  return (
    <nav className="gd-rail" aria-label="Guide sections">
      <button type="button" className="gd-ri" aria-current={view.v === "home" ? "page" : undefined} onClick={onHome}><b>Start here</b></button>
      {GUIDE_GROUPS.map(g => (
        <div key={g}>
          <p className="gd-rg">{g}</p>
          {sectionsInGroup(g).map(s => (
            <button key={s.id} type="button" className="gd-ri" aria-current={view.s === s.id && view.v !== "home" ? "page" : undefined} onClick={() => onOpenSection(s.id)}>
              <Dot color={s.color} /><span>{s.title}</span><em>{s.topics.length}</em>
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
export { GUIDE_SECTIONS, getSection };
