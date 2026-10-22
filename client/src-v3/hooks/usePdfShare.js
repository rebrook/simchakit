// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit — usePdfShare.js
// Two-tap PDF share for mobile. iOS Safari expires user activation across async
// work, so we cannot await html2pdf and then call navigator.share in the same
// gesture (NotAllowedError).
//
// Tap 1 (generate): render getHtml() offscreen at 816px, build a PDF blob and
//   cache it as a File. State becomes "ready".
// Tap 2 (share): navigator.share({ files }) directly inside the fresh click.
//
// Any failure restores the button and falls back to a text share (if
// fallbackText is given), then onFallback. Never sticks on "generating".
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useCallback } from "react";

// Sanitize for filenames: strip non-alphanumeric except spaces/hyphens, collapse
export function sanitizeFileName(name) {
  return (name || "Event").replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 60);
}

const ROOT_CLASS = "pdf-share-root";

// Body rules don't apply to a div container. Re-target them at the container,
// keeping type/colour but dropping layout and screen background (padding/margin/max-width/background), since the
// PDF margin is set by html2pdf.
function scopeBodyRules(css) {
  return css.replace(/(^|[}\s])body\s*\{([^}]*)\}/g, (_, pre, decls) => {
    const kept = decls.split(";").filter(d => d.trim() && !/^\s*(padding|margin|max-width|background)\b/.test(d)).join(";");
    return `${pre}.${ROOT_CLASS}{${kept}}`;
  });
}

/**
 * @param {object}   opts
 * @param {Function} opts.getHtml        returns the full HTML document string
 * @param {string}   opts.filename       e.g. "My-Event-brief.pdf"
 * @param {string}   [opts.title]        share-sheet title
 * @param {Function} [opts.fallbackText] returns text for a text-only share
 * @param {Function} [opts.onFallback]   last resort when nothing can be shared
 * @param {Array}    [opts.deps]         when these change a ready PDF is discarded
 * @param {boolean}  [opts.inheritBody]  apply the document's body styles to the render
 * @returns {{ state: "idle"|"generating"|"ready"|"sharing", generate: Function, share: Function, click: Function }}
 */
export function usePdfShare({ getHtml, filename, title, fallbackText, onFallback, deps = [], inheritBody = false }) {
  const [state, setState] = useState("idle");
  const fileRef = useRef(null);
  const stateRef = useRef("idle");
  const set = (s) => { stateRef.current = s; setState(s); };

  // Never share a stale document: only reset ready → idle.
  useEffect(() => {
    if (stateRef.current === "ready") {
      fileRef.current = null;
      set("idle");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const textShare = useCallback(async () => {
    const text = fallbackText?.();
    try {
      if (text && navigator.share) {
        await navigator.share({ title, text });
        return;
      }
    } catch (err) {
      if (err.name === "AbortError") return;
    }
    onFallback?.();
  }, [fallbackText, onFallback, title]);

  // Tap 1
  const generate = useCallback(async () => {
    set("generating");
    let container = null;
    try {
      const html = getHtml();
      const html2pdf = (await import("html2pdf.js")).default; // code-split

      // 816px = Letter width at 96dpi
      container = document.createElement("div");
      container.className = ROOT_CLASS;
      container.style.cssText = "position:fixed;left:-9999px;top:0;width:816px;overflow:hidden;";
      document.body.appendChild(container);

      // Inject all <style> blocks + <body> content. Skip the Google Fonts
      // <link>; the app's already-loaded fonts are used.
      const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
        .map(m => `<style>${inheritBody ? scopeBodyRules(m[1]) : m[1]}</style>`).join("");
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
      container.innerHTML = styles + (bodyMatch ? bodyMatch[1] : html);

      await document.fonts.ready;

      const blob = await html2pdf().set({
        margin:      [10, 10, 10, 10],
        filename,
        image:       { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, logging: false, width: 816 },
        jsPDF:       { unit: "mm", format: "letter", orientation: "portrait" },
        pagebreak:   { mode: ["css", "legacy"] },
      }).from(container).outputPdf("blob");

      fileRef.current = new File([blob], filename, { type: "application/pdf" });
      set("ready");
    } catch (err) {
      console.warn("[SimchaKit] PDF generation failed:", err);
      fileRef.current = null;
      set("idle");
      textShare();
    } finally {
      if (container?.parentNode) container.parentNode.removeChild(container);
    }
  }, [getHtml, filename, inheritBody, textShare]);

  // Tap 2 — must run inside a fresh click
  const share = useCallback(async () => {
    const file = fileRef.current;
    if (!file) { set("idle"); return; }
    set("sharing");
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title });
        set("ready"); // keep cached PDF for re-sharing
        return;
      }
      await textShare();
      set(fileRef.current ? "ready" : "idle");
    } catch (err) {
      if (err.name !== "AbortError") {
        console.warn("[SimchaKit] Share failed:", err);
        textShare();
      }
      set(fileRef.current ? "ready" : "idle");
    }
  }, [title, textShare]);

  // Button handler: routes to the right tap
  const click = useCallback(() => {
    if (stateRef.current === "ready") share();
    else if (stateRef.current === "idle") generate();
  }, [generate, share]);

  return { state, generate, share, click };
}
