// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — ThemeProvider.jsx
// Palettes live in constants/theme.js and color helpers in utils/color.js (one
// copy each; the earlier inlined copies were removed in V4.49.2).
//
// V5.8.2: --accent-fill and --on-accent are the colors for anything filled with the accent
// (filled button, event banner). They are chosen per palette so the text reaches 4.5:1:
// white or dark ink, whichever contrasts more, with the fill darkened if neither does.
// ─────────────────────────────────────────────────────────────────────────────

import { PALETTES } from "@/constants/theme.js";
import { deriveCustomPalette, accentFillColors } from "@/utils/color.js";

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
      `  --accent-fill:     ${accentFillColors(lm.accent).fill};`,
      `  --on-accent:       ${accentFillColors(lm.accent).text};`,
      "}",
      "[data-theme=\"dark\"] {",
      `  --accent-primary:  ${dm.accent};`,
      `  --accent-dark:     ${dm["accent-dark"]};`,
      `  --accent-light:    ${dm["accent-light"]};`,
      `  --accent-medium:   ${dm["accent-medium"]};`,
      `  --accent-text:     ${dm["accent-text"]};`,
      `  --accent-fill:     ${accentFillColors(dm.accent).fill};`,
      `  --on-accent:       ${accentFillColors(dm.accent).text};`,
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
      `  --accent-fill:     ${accentFillColors(p.accent).fill};`,
      `  --on-accent:       ${accentFillColors(p.accent).text};`,
      "}",
    ].join("\n");
  }
  return <style>{css}</style>;
}
