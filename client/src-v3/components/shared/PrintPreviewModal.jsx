// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit — PrintPreviewModal.jsx
// Desktop print preview for the generated documents. Layout is pure CSS
// (.print-preview in App.css). Touch devices skip this and call
// printDocument() directly, so the system print sheet is the preview.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";
import { Icon } from "@/utils/iconMap.jsx";

export function PrintPreviewModal({ html, title, ariaLabel, onClose, printLabel = "Print", zIndex }) {
  const frameRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="modal-backdrop print-preview-backdrop" style={zIndex ? { zIndex } : undefined}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-preview" role="dialog" aria-modal="true" aria-label={ariaLabel || title} onClick={(e) => e.stopPropagation()}>
        <div className="print-preview-header">
          <div className="print-preview-title">{title}</div>
          <div className="print-preview-actions">
            <button className="btn btn-primary" onClick={() => frameRef.current?.contentWindow?.print()}>
              <Icon name="printer" context="inline" /> {printLabel}
            </button>
            <button className="icon-btn" title="Close" aria-label="Close" onClick={onClose}><Icon name="x" context="button" /></button>
          </div>
        </div>
        <iframe ref={frameRef} className="print-preview-frame" title={title} srcDoc={html}
          sandbox="allow-same-origin allow-modals" />
      </div>
    </div>
  );
}
