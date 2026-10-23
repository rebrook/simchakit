// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — ThemeProvider.jsx
// Palettes live in constants/theme.js and color helpers in utils/color.js (one
// copy each; the earlier inlined copies were removed in V4.49.2).
// ─────────────────────────────────────────────────────────────────────────────

import { PALETTES } from "@/constants/theme.js";
import { deriveCustomPalette } from "@/utils/color.js";

// ── Component ─────────────────────────────────────────────────────────────────
export function ThemeProvider({ palette, customColor }) {
  let css;
  if (palette === "custom" && customColor && customColor.length === 7) {
    const derived = deriveCustomPalette(customColor);
    const lm = derived.light;
    const dm = derived.dark;
    css = [
      ":root {",
      `  --accent-primary:  ${lm.accent};`,
      `  --accent-dark:     ${lm["accent-dark"]};`,
      `  --accent-light:    ${lm["accent-light"]};`,
      `  --accent-medium:   ${lm["accent-medium"]};`,
      `  --accent-text:     ${lm["accent-text"]};`,
      "}",
      "[data-theme=\"dark\"] {",
      `  --accent-primary:  ${dm.accent};`,
      `  --accent-dark:     ${dm["accent-dark"]};`,
      `  --accent-light:    ${dm["accent-light"]};`,
      `  --accent-medium:   ${dm["accent-medium"]};`,
      `  --accent-text:     ${dm["accent-text"]};`,
      "}",
    ].join("\n");
  } else {
    const p = PALETTES[palette] || PALETTES.rose;
    css = [
      ":root {",
      `  --accent-primary:  ${p.accent};`,
      `  --accent-dark:     ${p["accent-dark"]};`,
      `  --accent-light:    ${p["accent-light"]};`,
      `  --accent-medium:   ${p["accent-medium"]};`,
      `  --accent-text:     ${p["accent-text"]};`,
      "}",
    ].join("\n");
  }
  return <style>{css}</style>;
}
