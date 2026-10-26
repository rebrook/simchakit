// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.4.0 — rsvp/RsvpApp.jsx   (route /r/:token)
// The guest RSVP site. No account, no sign-in shell, no Supabase: the page talks only
// to /api/rsvp, with the private link token in a request header. Rendered by
// App.v3.jsx ABOVE every auth hook (like DemoApp), so none of the signed-in app's
// effects run for a guest.
//
// Flow: Landing -> Who's coming -> A few details -> Confirmation. A returning guest
// (a reply is already pending) lands on their summary with a Change button; closed
// events show the message and, when allowed, their last answers read-only.
//
// The token is a bearer secret. It stays in the page address only (so the same link
// works for changes) and is redacted from analytics and error reports.
// ─────────────────────────────────────────────────────────────────────────────

import { Component, useEffect, useMemo, useState } from "react";
import { ThemeProvider } from "@/components/shared/ThemeProvider.jsx";
import { isValidRsvpToken } from "@/utils/rsvpToken.js";
import { loadRsvp, sendRsvp, describeSendError } from "@/rsvp/rsvpApi.js";
import {
  initDraft, saveDraft, loadSavedDraft, clearSavedDraft, buildPayload, answerTotal,
} from "@/rsvp/rsvpModel.js";
import { Progress } from "@/rsvp/rsvpUi.jsx";
import { Landing, WhoComing, Details, Confirmation, Closed, Message } from "@/rsvp/Screens.jsx";

const PER_PERSON_ABOVE = 8;   // more answers than this: one person per screen

// A guest page must never show a blank screen. No error reporting here on purpose:
// reports go through the signed-in app's database, which guests do not use.
class GuestBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) {
      return <Message title="Something went wrong">Please reload this page. If it keeps happening, contact your host.</Message>;
    }
    return this.props.children;
  }
}

// Page-level settings for a private page: not indexed, no referrer, light/dark by the
// device (read only; nothing is stored).
function useGuestPage(title) {
  useEffect(() => {
    const metas = [["robots", "noindex, nofollow"], ["referrer", "no-referrer"]].map(([name, content]) => {
      const m = document.createElement("meta");
      m.name = name; m.content = content;
      document.head.appendChild(m);
      return m;
    });
    return () => metas.forEach(m => m.remove());
  }, []);
  useEffect(() => { document.title = title; }, [title]);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.setAttribute("data-theme", mq.matches ? "dark" : "light");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
}

function Frame({ view, step, children }) {
  const theme = view?.event?.theme;
  return (
    <div className="rs-page">
      {theme && <ThemeProvider palette={theme.palette} customColor={theme.customColor} />}
      <main className="rs-main">
        {step > 0 && <Progress step={step} />}
        {children}
      </main>
      <footer className="rs-footer">
        <a href="https://about.simcha-kit.com?utm_source=rsvp-page&utm_medium=guest&utm_campaign=made-with" target="_blank" rel="noopener noreferrer">Made with SimchaKit</a>
      </footer>
    </div>
  );
}

function RsvpFlow({ token }) {
  const [phase, setPhase]   = useState("loading");   // loading | invalid | error | closed | open
  const [view, setView]     = useState(null);
  const [draft, setDraft]   = useState(null);
  const [step, setStep]     = useState("landing");    // landing | who | details | done
  const [personIndex, setPersonIndex] = useState(0);
  const [justSent, setJustSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useGuestPage(view?.event?.name ? `${view.event.name}: RSVP` : "RSVP");

  const apply = (res) => {
    if (res.status === 404 || !isValidRsvpToken(token)) { setPhase("invalid"); return; }
    if (!res.ok) { setPhase("error"); return; }
    const v = res.data;
    setView(v);
    if (v.closed) {
      setDraft(v.people ? initDraft(v) : null);
      setPhase("closed");
      return;
    }
    const saved = loadSavedDraft(token, v.submittedAt);
    setDraft(saved ? saved.draft : initDraft(v));
    setStep(saved ? saved.step || "landing" : v.submittedAt ? "done" : "landing");
    setPhase("open");
  };

  useEffect(() => {
    if (!isValidRsvpToken(token)) { setPhase("invalid"); return; }
    let cancelled = false;
    loadRsvp(token).then(res => { if (!cancelled) apply(res); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Keep in-progress answers for this tab only, until the reply is sent.
  useEffect(() => {
    if (phase === "open" && draft && step !== "done") saveDraft(token, view.submittedAt, draft, step);
  }, [phase, draft, step, token, view]);

  const perPerson = useMemo(() => !!view && !view.closed && answerTotal(view) > PER_PERSON_ABOVE, [view]);

  const submit = async () => {
    setSubmitting(true); setSubmitError("");
    const res = await sendRsvp(token, buildPayload(view, draft));
    setSubmitting(false);
    if (res.ok) {
      clearSavedDraft();
      setView(v => ({ ...v, submittedAt: res.data.submittedAt }));
      setJustSent(true); setStep("done");
      window.scrollTo(0, 0);
      return;
    }
    if (res.status === 409) { loadRsvp(token).then(apply); return; }       // closed while they were typing
    if (res.status === 404) { setPhase("invalid"); return; }
    setSubmitError(describeSendError(res));                                // answers stay on screen
  };

  if (phase === "loading") return <Frame step={0}><p className="rs-loading" role="status">Loading your invitation…</p></Frame>;
  if (phase === "invalid") {
    return <Frame step={0}><Message title="This link isn't working">Please check that you copied the whole link, or ask your host to send it again.</Message></Frame>;
  }
  if (phase === "error") {
    return (
      <Frame step={0}>
        <Message title="We couldn't load your invitation">Please check your connection and try again.</Message>
        <div className="rs-actions"><button type="button" className="rs-btn primary" onClick={() => { setPhase("loading"); loadRsvp(token).then(apply); }}>Try again</button></div>
      </Frame>
    );
  }
  if (phase === "closed") return <Frame view={view} step={0}><Closed view={view} draft={draft} /></Frame>;

  const stepNumber = step === "landing" ? 1 : step === "who" ? 2 : step === "details" ? 3 : 3;
  return (
    <Frame view={view} step={step === "done" ? 0 : stepNumber}>
      {step === "landing" && <Landing view={view} onReply={() => { setStep("who"); setPersonIndex(0); }} />}
      {step === "who" && (
        <WhoComing key={perPerson ? personIndex : "all"} view={view} draft={draft} setDraft={setDraft} perPerson={perPerson}
          personIndex={personIndex} setPersonIndex={setPersonIndex}
          onBack={() => setStep(view.submittedAt ? "done" : "landing")} onContinue={() => { setStep("details"); window.scrollTo(0, 0); }} />
      )}
      {step === "details" && (
        <Details view={view} draft={draft} setDraft={setDraft} maxNewGuests={view.maxNewGuests}
          submitting={submitting} submitError={submitError} onSubmit={submit}
          onBack={() => { setSubmitError(""); setStep("who"); setPersonIndex(perPerson ? view.people.length - 1 : 0); }} />
      )}
      {step === "done" && (
        <Confirmation view={view} draft={draft} justSent={justSent}
          onChange={() => { setJustSent(false); setStep("who"); setPersonIndex(0); window.scrollTo(0, 0); }} />
      )}
    </Frame>
  );
}

export default function RsvpApp({ token }) {
  return <GuestBoundary><RsvpFlow token={token} /></GuestBoundary>;
}
