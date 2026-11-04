// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit Admin — BriefingPage.jsx
// Weekly briefing: this week's decisions from the planning agents, with Approve / Reject / Defer.
// Every digest field is rendered as a React text node. Nothing is injected as HTML.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";

const STATUS = { approved: "Approved", rejected: "Rejected", deferred: "Deferred" };
const STATUS_CLASS = { approved: "ok", rejected: "bad", deferred: "warn" };

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

function FactBadge({ digest }) {
  return digest.fact_checked
    ? <span className="bf-pill ok">Fact-checked</span>
    : <span className="bf-pill bad">Not fact-checked</span>;
}

function DecisionCard({ digest, item, history, decide }) {
  const [reason, setReason] = useState("");
  const [busy,   setBusy]   = useState("");
  const [error,  setError]  = useState("");
  const current = history[0];

  async function choose(decision) {
    setBusy(decision); setError("");
    const msg = await decide(digest, item, decision, reason);
    setBusy("");
    if (msg) setError(msg); else setReason("");
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

      <div className="bf-actions">
        {current && (
          <div className="bf-status">
            <span className={`bf-pill ${STATUS_CLASS[current.decision] || "warn"}`}>{STATUS[current.decision] || s(current.decision)}</span>
            <span>{fmtStamp(current.decided_at)}</span>
            {current.reason && <span>“{current.reason}”</span>}
          </div>
        )}
        <label className="bf-label" htmlFor={`reason-${item.item_no}`} style={{ marginTop: 0 }}>
          {current ? "Change your decision (optional reason)" : "Reason (optional)"}
        </label>
        <textarea id={`reason-${item.item_no}`} value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
        <div className="bf-btns">
          <button type="button" className="ax-btn ok"  disabled={!!busy} onClick={() => choose("approved")}>{busy === "approved" ? "Saving…" : "Approve"}</button>
          <button type="button" className="ax-btn bad" disabled={!!busy} onClick={() => choose("rejected")}>{busy === "rejected" ? "Saving…" : "Reject"}</button>
          <button type="button" className="ax-btn ghost" disabled={!!busy} onClick={() => choose("deferred")}>{busy === "deferred" ? "Saving…" : "Defer"}</button>
        </div>
        {error && <p className="ax-error" role="alert" style={{ marginTop: 8 }}>Could not save: {error}</p>}
        {history.length > 1 && (
          <ul className="bf-history" aria-label="Earlier decisions">
            {history.slice(1).map((h) => (
              <li key={h.id}>{STATUS[h.decision] || s(h.decision)}, {fmtStamp(h.decided_at)}{h.reason ? `: ${h.reason}` : ""}</li>
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
