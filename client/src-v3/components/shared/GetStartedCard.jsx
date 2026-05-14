import { useState, useEffect } from "react";
import { EVENT_TYPE_LABELS_MAP, EVENT_TYPE_ICONS } from "@/constants/events.js";
import { formatDate } from "@/utils/dates.js";

export function GetStartedCard({ state, adminConfig, setActiveTab, onOpenAdmin, onOpenGuide, eventId, onDismissedChange }) {
  const STORAGE_KEY = `simchakit-getstarted-dismissed-${eventId || "default"}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });

  // Report dismissed state to parent on mount and on change
  useEffect(() => {
    if (onDismissedChange) onDismissedChange(dismissed);
  }, [dismissed]);

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    setDismissed(true);
  };

  const restore = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setDismissed(false);
  };

  // Step completion conditions
  const step1Done = !!(adminConfig?.name && adminConfig.name.trim());
  const step2Done = adminConfig !== null && adminConfig !== undefined;
  const step3Done = (adminConfig?.timeline || []).some(e => e.isMainEvent);
  const step4Done = (state?.households || []).length > 0;
  const allDone   = step1Done && step2Done && step3Done && step4Done;

  // Only show if not dismissed and at least one step is incomplete
  if (dismissed || allDone) return null;

  const steps = [
    {
      num:    1,
      done:   step1Done,
      label:  "Name your event",
      detail: step1Done
        ? `"${adminConfig.name}"`
        : "Give your event a name so it appears in the header and on exports.",
      action: { label: "Open Admin", onClick: onOpenAdmin },
    },
    {
      num:    2,
      done:   step2Done,
      label:  "Choose an event type",
      detail: step2Done
        ? `${EVENT_TYPE_LABELS_MAP[adminConfig?.type] || "Event"} ${EVENT_TYPE_ICONS[adminConfig?.type] || "🎉"}`
        : "Set the event type to personalise icons and terminology throughout the app.",
      action: { label: "Open Admin", onClick: onOpenAdmin },
    },
    {
      num:    3,
      done:   step3Done,
      label:  "Add an event date",
      detail: step3Done
        ? (() => { const e = (adminConfig?.timeline||[]).find(x=>x.isMainEvent); return e ? formatDate(e.startDate) : "Date set"; })()
        : "Add a timeline entry and mark it as the main event to start the countdown.",
      action: { label: "Open Admin", onClick: onOpenAdmin },
    },
    {
      num:    4,
      done:   step4Done,
      label:  "Add your first guest",
      detail: step4Done
        ? `${(state?.households||[]).length} household${(state?.households||[]).length !== 1 ? "s" : ""} added`
        : "Head to the Guests tab to start building your guest list.",
      action: { label: "Go to Guests", onClick: () => setActiveTab("guests") },
    },
  ];

  return (
    <div style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)",
      padding: "20px 24px",
      marginBottom: 20,
      boxShadow: "var(--shadow-sm)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>
            {allDone ? "🎉 You're all set!" : "👋 Get Started"}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {allDone
              ? "Your event is configured and ready to go."
              : `${[step1Done, step2Done, step3Done, step4Done].filter(Boolean).length} of 4 steps complete`}
          </div>
        </div>
        <button onClick={dismiss} style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 12, color: "var(--text-muted)", padding: "2px 0",
          textDecoration: "underline", textUnderlineOffset: 3,
        }}>
          Dismiss
        </button>
      </div>

      {/* Steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {steps.map(step => (
          <div key={step.num} style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "10px 14px",
            background: step.done ? "var(--green-light)" : "var(--bg-subtle)",
            border: `1px solid ${step.done ? "var(--green)" : "var(--border)"}`,
            borderRadius: "var(--radius-sm)",
            opacity: step.done ? 0.85 : 1,
          }}>
            {/* Step indicator */}
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: step.done ? 14 : 12, fontWeight: 700,
              background: step.done ? "var(--green)" : "var(--bg-muted)",
              color: step.done ? "white" : "var(--text-muted)",
              border: step.done ? "none" : "2px solid var(--border-strong)",
            }}>
              {step.done ? "✓" : step.num}
            </div>

            {/* Label + detail */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600,
                color: step.done ? "var(--green)" : "var(--text-primary)",
                textDecoration: step.done ? "line-through" : "none",
                textDecorationColor: "var(--green)",
              }}>
                {step.label}
              </div>
              <div style={{ fontSize: 11, color: step.done ? "var(--green)" : "var(--text-muted)", marginTop: 1 }}>
                {step.detail}
              </div>
            </div>

            {/* Action button — only shown if step not done */}
            {!step.done && (
              <button onClick={step.action.onClick} className="btn btn-secondary btn-sm"
                style={{ flexShrink: 0, fontSize: 12 }}>
                {step.action.label} →
              </button>
            )}
          </div>
        ))}
      </div>

      {/* All done — guide prompt */}
      {allDone && (
        <div style={{
          marginTop: 16, padding: "12px 16px",
          background: "linear-gradient(135deg, var(--accent-dark), var(--accent-primary))",
          borderRadius: "var(--radius-sm)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <div style={{ fontSize: 13, color: "white", lineHeight: 1.5 }}>
            Check out the SimchaKit Guide to get the most out of the app.
          </div>
          <button onClick={onOpenGuide} className="btn" style={{
            background: "rgba(255,255,255,0.2)", color: "white",
            border: "1px solid rgba(255,255,255,0.3)", flexShrink: 0, fontSize: 12,
          }}>
            Open Guide →
          </button>
        </div>
      )}
    </div>
  );
}
