// Checks the admin console's text/background pairs (client/src-admin/admin.css) are at least 4.5:1,
// light and dark. Run: node scripts/check-admin-contrast.mjs   Exits non-zero on a failure.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../client/src-admin/admin.css"), "utf8");
const block = (sel) => {
  const m = css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([^}]*)\\}"));
  return Object.fromEntries([...(m?.[1] || "").matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map(x => [x[1], x[2]]));
};
const light = block(":root");
const dark  = { ...light, ...block(':root[data-theme="dark"]') };

const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const PAIRS = [
  ["text", "bg"], ["text", "surface"], ["text", "surface-2"], ["muted", "bg"], ["muted", "surface"], ["muted", "surface-2"],
  ["link", "bg"], ["link", "surface"], ["btn-text", "btn-bg"],
  ["ok", "ok-bg"], ["ok", "surface"], ["bad", "bad-bg"], ["bad", "surface"], ["warn", "warn-bg"],
  ["side-text", "side-bg"], ["side-muted", "side-bg"],
];
let failed = false;
for (const [name, pal] of [["light", light], ["dark", dark]]) {
  for (const [fg, bg] of PAIRS) {
    if (!pal[fg] || !pal[bg]) { console.log(`MISSING ${name} ${fg}/${bg}`); failed = true; continue; }
    const r = cr(pal[fg], pal[bg]);
    if (r < 4.5) failed = true;
    console.log(`${r >= 4.5 ? "pass" : "FAIL"} ${r.toFixed(1)}  ${name}  ${fg} on ${bg}`);
  }
}
if (cr("#1e1a10", light.gold) < 4.5) { failed = true; console.log("FAIL badge text on gold"); }
process.exit(failed ? 1 : 0);
