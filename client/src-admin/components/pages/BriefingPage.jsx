// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit Admin — BriefingPage.jsx
// Weekly briefing: this week's decisions from the planning agents, each with its mockup, the few
// things the team needs from you, and Approve / Not now / Reject / "I have a question".
// Every digest field is rendered as a React text node. Nothing is injected as HTML.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";

const STATUS = { approved: "Approved", rejected: "Rejected", deferred: "Not now", question: "Question sent" };
const STATUS_CLASS = { approved: "ok", rejected: "bad", deferred: "warn", question: "warn" };
const TEAM_STATUS = {
  picked_up: "Team has your answer", in_progress: "Team is working on it", needs_input: "Team needs more from you",
  ready_to_ship: "Ready to ship", done: "Done", declined: "Team can't do this",
};

const arr = (v) => (Array.isArray(v) ? v : []);
const s = (v) => (typeof v === "string" || typeof v === "number" ? String(v) : "");

function fmtWeek(d) {
  const dt = new Date(`${d}T12:00:00`);
  return Number.isNaN(dt.getTime()) ? s(d) : dt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
function fmtStamp(iso) {
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? "" : dt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const httpsOnly = (u) => (/^https:\/\//i.test(s(u)) ? s(u) : "");

function Mockup({ m }) {
  if (!m || !m.kind) return null;
  if (m.kind === "post") {
    const img = httpsOnly(m.image_url);
    return (
      <figure className="bf-mock" aria-label="Preview of the finished post">
        <figcaption className="bf-mock-cap">{s(m.heading) || "Finished post"}{s(m.when) ? `, ${s(m.when)}` : ""}</figcaption>
        <div className="bf-post">
          <p className="bf-post-text">{s(m.text)}</p>
          {img && <img src={img} alt={s(m.image_alt)} loading="lazy" />}
        </div>
      </figure>
    );
  }
  const bImg = httpsOnly(m.before_image_url), aImg = httpsOnly(m.after_image_url);
  return (
    <figure className="bf-mock" aria-label="Before and after">
      <figcaption className="bf-mock-cap">{s(m.heading) || "Before and after"}{s(m.where) ? `, ${s(m.where)}` : ""}</figcaption>
      <div className="bf-ba">
        <div className="bf-ba-col"><div className="bf-label" style={{ marginTop: 0 }}>Before</div>{bImg && <img src={bImg} alt="Before" loading="lazy" />}<p className="bf-text">{s(m.before)}</p></div>
        <div className="bf-ba-col"><div className="bf-label" style={{ marginTop: 0 }}>After</div>{aImg && <img src={aImg} alt="After" loading="lazy" />}<p className="bf-text">{s(m.after)}</p></div>
      </div>
    </figure>
  );
}

function CopyCode({ code }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(code); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked */ }
  }
  return (
    <div className="bf-code">
      <pre>{code}</pre>
      <button type="button" className="ax-btn ghost" onClick={copy}>{done ? "Copied" : "Copy"}</button>
    </div>
  );
}

function ShipCards({ cards }) {
  if (!cards.length) return null;
  return (
    <section className="bf-ship" aria-label="Ready to ship">
      <h2>Ready to ship</h2>
      {cards.map((c, i) => (
        <article className="bf-card" key={i}>
          <h3>{s(c?.title)}</h3>
          <ol className="bf-steps">
            {arr(c?.steps).map((st, k) => (
              <li key={k}>
                <span>{s(st?.text)}</span>
                {s(st?.code) && <CopyCode code={s(st.code)} />}
              </li>
            ))}
          </ol>
        </article>
      ))}
    </section>
  );
}

function FactBadge({ digest }) {
  return digest.fact_checked
    ? <span className="bf-pill ok">Fact-checked</span>
    : <span className="bf-pill bad">Not fact-checked</span>;
}

function DecisionCard({ digest, item, history, decide }) {
  const [reason, setReason] = useState("");
  const [busy,   setBusy]   = useState("");
  const [error,  setError]  = useState("");
  const [values, setValues] = useState({});   // ask id -> typed answer
  const [skips,  setSkips]  = useState({});   // ask id -> true when skipped
  const current = history[0];
  const asks = arr(item.asks);

  async function choose(decision) {
    setError("");
    const answers = {};
    if (decision === "approved") {
      for (const a of asks) {
        if (skips[a.id]) { answers[a.id] = { label: s(a.label), skipped: true }; continue; }
        const v = (values[a.id] || "").trim();
        if (!v) { setError(`Fill in "${s(a.label)}", or tick "Skip this".`); return; }
        answers[a.id] = { label: s(a.label), value: v.slice(0, 500) };
      }
    }
    if (decision === "question" && !reason.trim()) { setError("Type your question in the box first."); return; }
    setBusy(decision);
    const msg = await decide(digest, item, decision, reason, answers);
    setBusy("");
    if (msg) setError(msg); else { setReason(""); setValues({}); setSkips({}); }
  }

  return (
    <article className="bf-card" aria-labelledby={`item-${item.item_no}`}>
      <div className="bf-card-top">
        <h2 id={`item-${item.item_no}`}>{item.item_no}. {s(item.title)}</h2>
      </div>
      <div className="bf-tags">
        {s(item.confidence) && <span className="bf-tag">Confidence: {s(item.confidence)}</span>}
        {s(item.effort) && <span className="bf-tag">Effort: {s(item.effort)}</span>}
      </div>

      {s(item.recommendation) && (<><div className="bf-label">Recommendation</div><p className="bf-text">{s(item.recommendation)}</p></>)}
      {s(item.why) && (<><div className="bf-label">Why</div><p className="bf-text">{s(item.why)}</p></>)}
      {s(item.could_be_wrong) && (<><div className="bf-label">What could make it wrong</div><p className="bf-text">{s(item.could_be_wrong)}</p></>)}
      {arr(item.checks).length > 0 && (
        <>
          <div className="bf-label">Claims</div>
          <ul className="bf-checks">
            {arr(item.checks).map((c, i) => (
              <li key={i}>
                <span className={`bf-pill ${c?.status === "checked" ? "ok" : "warn"}`}>{c?.status === "checked" ? "Checked" : "Unverified"}</span>
                <span>{s(c?.claim)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <Mockup m={item.mockup} />

      {asks.length > 0 && (
        <div className="bf-asks">
          <div className="bf-label">What the team needs from you to go ahead</div>
          {asks.map((a) => (
            <div className="bf-ask" key={a.id}>
              <label htmlFor={`ask-${item.item_no}-${a.id}`}>{s(a.label)}</label>
              {s(a.why) && <p className="bf-ask-why">{s(a.why)}</p>}
              <input
                id={`ask-${item.item_no}-${a.id}`} type="text" maxLength={500}
                value={values[a.id] || ""} disabled={!!skips[a.id]}
                placeholder={s(a.example) ? `For example: ${s(a.example)}` : ""}
                onChange={(e) => setValues({ ...values, [a.id]: e.target.value })}
              />
              <label className="bf-skip">
                <input type="checkbox" checked={!!skips[a.id]} onChange={(e) => setSkips({ ...skips, [a.id]: e.target.checked })} />
                Skip this{s(a.skip_means) ? `: ${s(a.skip_means)}` : ""}
              </label>
            </div>
          ))}
        </div>
      )}

      <div className="bf-actions">
        {current && (
          <div className="bf-status">
            <span className={`bf-pill ${STATUS_CLASS[current.decision] || "warn"}`}>{STATUS[current.decision] || s(current.decision)}</span>
            <span>{fmtStamp(current.decided_at)}</span>
            {current.reason && <span>“{current.reason}”</span>}
            {current.team_status && <span className="bf-pill ok">{TEAM_STATUS[current.team_status] || s(current.team_status)}</span>}
          </div>
        )}
        {current?.team_reply && (
          <div className="bf-reply" role="status">
            <div className="bf-label" style={{ marginTop: 0 }}>Team reply</div>
            <p className="bf-text">{s(current.team_reply)}</p>
          </div>
        )}
        <label className="bf-label" htmlFor={`reason-${item.item_no}`} style={{ marginTop: 0 }}>
          {current ? "Change your answer, or ask a follow-up" : "Note or question (optional, required for a question)"}
        </label>
        <textarea id={`reason-${item.item_no}`} value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
        <div className="bf-btns">
          <button type="button" className="ax-btn ok"  disabled={!!busy} onClick={() => choose("approved")}>{busy === "approved" ? "Saving…" : "Approve"}</button>
          <button type="button" className="ax-btn ghost" disabled={!!busy} onClick={() => choose("deferred")}>{busy === "deferred" ? "Saving…" : "Not now"}</button>
          <button type="button" className="ax-btn bad" disabled={!!busy} onClick={() => choose("rejected")}>{busy === "rejected" ? "Saving…" : "Reject"}</button>
          <button type="button" className="ax-btn ghost" disabled={!!busy} onClick={() => choose("question")}>{busy === "question" ? "Sending…" : "I have a question"}</button>
        </div>
        {error && <p className="ax-error" role="alert" style={{ marginTop: 8 }}>Could not save: {error}</p>}
        {history.length > 1 && (
          <ul className="bf-history" aria-label="Earlier decisions">
            {history.slice(1).map((h) => (
              <li key={h.id}>{STATUS[h.decision] || s(h.decision)}, {fmtStamp(h.decided_at)}{h.reason ? `: ${h.reason}` : ""}{h.team_reply ? ` (team: ${h.team_reply})` : ""}</li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

export function BriefingPage({ briefing }) {
  const { digests, loading, error, historyFor, decide } = briefing;

  if (loading) return <div className="bf"><p>Loading…</p></div>;
  if (error) return <div className="bf"><p className="ax-error" role="alert">Error: {error}</p></div>;

  const [latest, ...past] = digests;
  if (!latest) {
    return (
      <div className="bf">
        <header className="bf-head"><h1>Weekly briefing</h1></header>
        <div className="bf-empty">No briefing yet. The weekly run adds one here.</div>
      </div>
    );
  }

  const p = latest.payload || {};
  const link = /^https:\/\//i.test(s(p.link)) ? s(p.link) : "";

  return (
    <div className="bf">
      <header className="bf-head">
        <h1>Week of {fmtWeek(latest.week_of)}</h1>
        <div className="bf-meta">
          <FactBadge digest={latest} />
          {s(p.usage) && <span>{s(p.usage)}</span>}
          {link && <a className="bf-link" href={link} target="_blank" rel="noopener noreferrer">Full digest</a>}
        </div>
      </header>

      {!latest.fact_checked && (
        <div className="bf-notice" role="alert">
          This digest has not been fact-checked. Treat the numbers and claims below as unconfirmed.
        </div>
      )}

      {arr(p.numbers).length > 0 && (
        <section className="bf-numbers" aria-label="Headline numbers">
          {arr(p.numbers).map((n, i) => (
            <div className="bf-num" key={i}>
              <div className="bf-num-label">{s(n?.label)}</div>
              <div className="bf-num-value">{s(n?.value)}</div>
              {s(n?.note) && <div className="bf-num-note">{s(n.note)}</div>}
            </div>
          ))}
        </section>
      )}

      <ShipCards cards={arr(p.ship)} />

      {arr(p.decisions).length === 0 && <div className="bf-empty">This week's digest has no decisions for you.</div>}
      {arr(p.decisions).map((item) => (
        <DecisionCard key={item.item_no} digest={latest} item={item} history={historyFor(latest.id, item.item_no)} decide={decide} />
      ))}

      {arr(p.held_back).length > 0 && (
        <section className="bf-held" aria-label="Held back">
          <strong>Held back this week</strong>
          <ul>{arr(p.held_back).map((h, i) => <li key={i}>{s(h)}</li>)}</ul>
        </section>
      )}

      {past.length > 0 && (
        <section className="bf-past" aria-label="Previous weeks">
          <h2>Previous weeks</h2>
          {past.map((d) => (
            <details key={d.id}>
              <summary>Week of {fmtWeek(d.week_of)} {d.fact_checked ? "" : "(not fact-checked)"}</summary>
              <ol>
                {arr(d.payload?.decisions).map((it) => {
                  const cur = historyFor(d.id, it.item_no)[0];
                  return (
                    <li key={it.item_no} value={it.item_no}>
                      {s(it.title)}: <strong>{cur ? `${STATUS[cur.decision] || s(cur.decision)} ${fmtStamp(cur.decided_at)}` : "No decision"}</strong>
                      {cur?.reason ? ` (“${cur.reason}”)` : ""}
                    </li>
                  );
                })}
              </ol>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
