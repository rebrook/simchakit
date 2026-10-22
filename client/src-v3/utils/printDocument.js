// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit — printDocument.js
// Native print for generated HTML documents, with no iframe and no PDF library.
// The document is placed in a print-only container in the main page; App.css
// hides everything else under @media print. window.print() then runs on the
// page itself, so iOS opens the system print sheet (which has its own preview,
// Share and Save to Files). Real text, vector output, one tap.
// ─────────────────────────────────────────────────────────────────────────────

const ROOT_ID = "print-root";

// Phones and tablets: the system print sheet is the preview, so skip ours.
export function isTouchPrimary() {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
}

function removeRoot() {
  document.getElementById(ROOT_ID)?.remove();
}

const imagesReady = (root, ms = 2000) => {
  const pending = [...root.querySelectorAll("img")].filter(i => !i.complete);
  if (!pending.length) return null;
  return Promise.race([
    Promise.all(pending.map(i => new Promise(r => { i.onload = i.onerror = r; }))),
    new Promise(r => setTimeout(r, ms)),
  ]);
};

/** Print a full HTML document string (as produced by the generate*PrintHTML helpers). */
export function printDocument(html) {
  removeRoot();
  const root = document.createElement("div");
  root.id = ROOT_ID;
  // Generator CSS applies to print only, so it can't affect the app on screen.
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map(m => `<style>@media print{${m[1]}}</style>`).join("");
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  root.innerHTML = styles + (body ? body[1] : html);
  document.body.appendChild(root);

  window.addEventListener("afterprint", removeRoot, { once: true });
  const go = () => requestAnimationFrame(() => window.print());
  const wait = imagesReady(root);
  if (wait) wait.then(go); else go();
}
