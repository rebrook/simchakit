// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.9.0 — components/overview/ReadinessCard.jsx
// Four measures in a 2 by 2 grid: Meals chosen, Budget paid, Tasks done, Vendors. Each has its
// count, a bar and one takeaway line. The card is as tall as its content (it is not stretched to
// match a neighbouring column).
// ─────────────────────────────────────────────────────────────────────────────

import { InfoPopover } from "@/components/shared/InfoPopover.jsx";

function Measure({ label, value, of, pct, line, go, onClick, info }) {
  return (
    <div>
      <button type="button" className="ov-rd-btn" onClick={onClick}>
        <div className="l">{label}</div>
        <div className="v">{value}{of ? <small> of {of}</small> : null}</div>
        <div className="ov-pb" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${label}: ${pct}%`}><u style={{ "--w": go ? `${pct}%` : "0%" }} /></div>
        <div className="ov-sm">{line}</div>
      </button>
      {info}
    </div>
  );
}

export function ReadinessCard({ meals, budget, tasks, vendors, line, go, nav, mealInfo }) {
  const pct = (n, d) => (d > 0 ? Math.max(0, Math.min(100, Math.round((n / d) * 100))) : 0);
  return (
    <section className="ov-card ov-a-r" aria-labelledby="ov-ready-title">
      <h2 id="ov-ready-title" className="ov-vh">Readiness</h2>
      <div className="ov-rd">
        <Measure label="Meals chosen" value={meals.value} of={meals.of} pct={pct(meals.value, meals.of)} line={line.meals} go={go} onClick={() => nav("guests")} info={mealInfo} />
        <Measure label="Budget paid" value={budget.value} of={budget.of} pct={pct(budget.raw, budget.rawOf)} line={line.budget} go={go} onClick={() => nav("budget")} />
        <Measure label="Tasks done" value={tasks.value} of={tasks.of} pct={pct(tasks.value, tasks.of)} line={line.tasks} go={go} onClick={() => nav("tasks")} />
        <Measure label="Vendors" value={vendors.value} of={vendors.of} pct={pct(vendors.value, vendors.of)} line={line.vendors} go={go} onClick={() => nav("vendors")} />
      </div>
    </section>
  );
}
