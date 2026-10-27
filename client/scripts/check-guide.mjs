// Fails when the guide content breaks a rule: a section with no topics, a topic with no summary, a duplicate
// title, a related link or task card that points nowhere, or search that cannot find "seat", "import", "RSVP".
// Run: node scripts/check-guide.mjs (also runs from vite.config.v3.js). Resolves "@" to src-v3.
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src-v3");
register("data:text/javascript," + encodeURIComponent(`export async function resolve(s, c, n) { return n(s.startsWith("@/") ? ${JSON.stringify(pathToFileURL(root).href)} + "/" + s.slice(2) : s, c); }`));
const { checkGuideContent } = await import(pathToFileURL(path.join(root, "components/guide/guideModel.js")).href);
const bad = checkGuideContent();
if (bad.length) { console.error("Guide content problems:\n  " + bad.join("\n  ")); process.exit(1); }
console.log("guide: content OK");
