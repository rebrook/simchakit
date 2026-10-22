// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit — PrintOrShareButton.jsx
// Print-preview header button. Desktop: iframe print. Mobile: two-tap PDF
// share (Prepare → Share) driven by usePdfShare, since iframe print is
// unreliable on iOS Safari.
// ─────────────────────────────────────────────────────────────────────────────

import { Icon } from "@/utils/iconMap.jsx";

export function PrintOrShareButton({ isMobile, pdf, onPrint, printLabel = "Print", shareLabel = "Share PDF", prepareLabel = "Prepare PDF", style }) {
  if (!isMobile) {
    return (
      <button className="btn btn-primary" style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, ...style }} onClick={onPrint}>
        <Icon name="printer" context="inline" /> {printLabel}
      </button>
    );
  }
  const busy = pdf.state === "generating" || pdf.state === "sharing";
  return (
    <button className="btn btn-primary" onClick={pdf.click} disabled={busy}
      style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, opacity: busy ? 0.6 : 1, ...style }}>
      {pdf.state === "generating" ? "Generating…"
        : pdf.state === "sharing" ? "Sharing…"
        : pdf.state === "ready" ? <><Icon name="share" context="inline" /> {shareLabel}</>
        : <><Icon name="fileText" context="inline" /> {prepareLabel}</>}
    </button>
  );
}
