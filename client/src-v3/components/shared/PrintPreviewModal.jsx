// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit — PrintPreviewModal.jsx
// One print/export preview for every surface. Layout is pure CSS (.print-preview
// in App.css: full-screen sheet on narrow viewports, centred dialog otherwise).
// Behaviour is by capability, not width: touch devices that can share files get
// a two-tap Prepare PDF → Share PDF flow; everything else gets iframe print().
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";
import { Icon } from "@/utils/iconMap.jsx";
import { usePdfShare, useShareFirst, sanitizeFileName, forTouchPreview } from "@/hooks/usePdfShare.js";

export function PrintPreviewModal({ html, title, ariaLabel, eventName, docLabel, onClose, printLabel = "Print", zIndex }) {
  const frameRef = useRef(null);
  const shareFirst = useShareFirst();
  const doc = docLabel || title;
  const pdf = usePdfShare({
    getHtml: () => html,
    filename: `${sanitizeFileName(eventName)}-${sanitizeFileName(doc).toLowerCase()}.pdf`,
    title: `${eventName || "Event"} — ${doc}`,
    onFallback: () => frameRef.current?.contentWindow?.print(),
    deps: [html],
    inheritBody: true,
  });

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const busy = pdf.state === "generating" || pdf.state === "sharing";
  return (
    <div className="modal-backdrop print-preview-backdrop" style={zIndex ? { zIndex } : undefined}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-preview" role="dialog" aria-modal="true" aria-label={ariaLabel || title} onClick={(e) => e.stopPropagation()}>
        <div className="print-preview-header">
          <div className="print-preview-title">{title}</div>
          <div className="print-preview-actions">
            {shareFirst ? (
              <button className="btn btn-primary" onClick={pdf.click} disabled={busy} aria-busy={busy}>
                {pdf.state === "generating" ? "Generating…"
                  : pdf.state === "sharing" ? "Sharing…"
                  : pdf.state === "ready" ? <><Icon name="share" context="inline" /> Share PDF</>
                  : <><Icon name="fileText" context="inline" /> Prepare PDF</>}
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => frameRef.current?.contentWindow?.print()}>
                <Icon name="printer" context="inline" /> {printLabel}
              </button>
            )}
            <button className="icon-btn" title="Close" aria-label="Close" onClick={onClose}><Icon name="x" context="button" /></button>
          </div>
        </div>
        <div className="print-preview-status" role="status" aria-live="polite">
          {shareFirst && pdf.state === "ready" ? "PDF ready — tap Share PDF to send or save it." : ""}
        </div>
        <iframe ref={frameRef} className="print-preview-frame" title={title}
          srcDoc={shareFirst ? forTouchPreview(html) : html}
          sandbox="allow-same-origin allow-modals" />
      </div>
    </div>
  );
}
