// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — ThemeProvider.jsx
// Palettes live in constants/theme.js and color helpers in utils/color.js (one
// copy each; the earlier inlined copies were removed in V4.49.2).
//
// V5.9.0: the hero and button colors (--hero-*, --accent-ink, --accent-fill, --on-accent) for the
// nine built-in palettes are precomputed in styles/palette-tokens.css and picked by the
// data-palette attribute this component sets on <html>. Only a host's custom color is computed
// here, with the same rules (see utils/color.js customAccentTokens).
// ─────────────────────────────────────────────────────────────────────────────

import { PALETTES } from "@/constants/theme.js";
import { useEffect } from "react";
import { deriveCustomPalette, customAccentTokens } from "@/utils/color.js";

// ── Component ─────────────────────────────────────────────────────────────────
const tokenLines = (t) => Object.entries(t).map(([k, v]) => `  --${k}: ${v};`);

export function ThemeProvider({ palette, customColor }) {
  const key = palette === "custom" && customColor && customColor.length === 7 ? "custom" : (PALETTES[palette] ? palette : "rose");
  useEffect(() => {
    document.documentElement.setAttribute("data-palette", key);
  }, [key]);
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
      ...tokenLines(customAccentTokens(lm.accent, false)),
      "}",
      "[data-theme=\"dark\"] {",
      `  --accent-primary:  ${dm.accent};`,
      `  --accent-dark:     ${dm["accent-dark"]};`,
      `  --accent-light:    ${dm["accent-light"]};`,
      `  --accent-medium:   ${dm["accent-medium"]};`,
      `  --accent-text:     ${dm["accent-text"]};`,
      ...tokenLines(customAccentTokens(dm.accent, true)),
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
