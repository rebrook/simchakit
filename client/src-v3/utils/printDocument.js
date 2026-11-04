// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit — printDocument.js
// Native print for generated HTML documents, with no iframe and no PDF library.
// The document is placed in a print-only container in the main page; App.css
// hides everything else under @media print (while html.printing-doc is set,
// so ordinary screens still print as themselves). window.print() then runs on the
// page itself, so iOS opens the system print sheet (which has its own preview,
// Share and Save to Files). Real text, vector output, one tap.
// ─────────────────────────────────────────────────────────────────────────────

const ROOT_ID = "print-root";
const PAGE_STYLE_ID = "print-page-css";

// Phones and tablets: the system print sheet is the preview, so skip ours.
export function isTouchPrimary() {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
}

let cancelCleanup = null;

function removeRoot() {
  if (cancelCleanup) { cancelCleanup(); cancelCleanup = null; }
  document.documentElement.classList.remove("printing-doc");
  document.getElementById(ROOT_ID)?.remove();
  document.getElementById(PAGE_STYLE_ID)?.remove();
}

// iOS Safari fires afterprint as soon as the print sheet opens, and the sheet draws (and
// redraws) its preview from the live page after that. Removing the document on afterprint
// therefore left the preview showing the ordinary page. The system print sheet receives no
// events in the page, so the first tap back in the page, or a long timer, is the safe moment.
function cleanupAfterSheet() {
  const clear = () => removeRoot();
  const timer = setTimeout(clear, 10 * 60 * 1000);
  window.addEventListener("pointerdown", clear, { capture: true, once: true });
  cancelCleanup = () => {
    clearTimeout(timer);
    window.removeEventListener("pointerdown", clear, { capture: true });
  };
}

/** Print a full HTML document string (as produced by the generate*PrintHTML helpers). Call from a click handler. */
export function printDocument(html) {
  removeRoot();
  const root = document.createElement("div");
  root.id = ROOT_ID;
  // Generator CSS applies to print only, so it can't affect the app on screen.
  // A <style data-page-css> block (an @page size) must stay top level, since @page
  // cannot sit inside @media; it is applied to the document until printing ends.
  const styles = [...html.matchAll(/<style([^>]*)>([\s\S]*?)<\/style>/g)]
    .filter(m => !/data-page-css/.test(m[1]))
    .map(m => `<style>@media print{${m[2]}}</style>`).join("");
  const pageCss = html.match(/<style[^>]*data-page-css[^>]*>([\s\S]*?)<\/style>/);
  if (pageCss) {
    const el = document.createElement("style");
    el.id = PAGE_STYLE_ID;
    el.textContent = pageCss[1];
    document.head.appendChild(el);
  }
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  root.innerHTML = styles + (body ? body[1] : html);
  document.body.appendChild(root);
  // print.css shows only #print-root while this class is on <html>.
  document.documentElement.classList.add("printing-doc");

  cleanupAfterSheet();
  // Must stay synchronous: iOS Safari blocks print() ("blocked from
  // automatically printing") unless it runs inside the user's tap, so we
  // cannot wait for images or a frame. Already-cached images (e.g. the logo)
  // are rendered; call this from the click handler.
  window.print();
}
