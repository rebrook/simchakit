// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — ThemeProvider.jsx
// Self-contained: PALETTES and color utilities inlined.
// No imports outside of React — cannot break from missing src-v3 files.
// ─────────────────────────────────────────────────────────────────────────────

// ── Palettes (from src/constants/theme.js) ────────────────────────────────────
const PALETTES = {
  "rose":      { accent: "#c4637a", "accent-dark": "#93374d", "accent-light": "#fdf0f3", "accent-medium": "#e8a0b0", "accent-text": "#ffffff" },
  "navy-gold": { accent: "#b8962e", "accent-dark": "#6e5a1b", "accent-light": "#fdf8ec", "accent-medium": "#d4b96a", "accent-text": "#ffffff" },
  "forest":    { accent: "#3d7a5e", "accent-dark": "#1e3c2e", "accent-light": "#eef6f1", "accent-medium": "#82bca0", "accent-text": "#ffffff" },
  "purple":    { accent: "#6b4fa0", "accent-dark": "#413062", "accent-light": "#f3eefa", "accent-medium": "#a98fd4", "accent-text": "#ffffff" },
  "slate":     { accent: "#3d5a80", "accent-dark": "#1f2e41", "accent-light": "#eef2f8", "accent-medium": "#7a9ec0", "accent-text": "#ffffff" },
  "copper":    { accent: "#b06030", "accent-dark": "#67381c", "accent-light": "#fdf4ee", "accent-medium": "#d4946a", "accent-text": "#ffffff" },
  "teal":      { accent: "#2a8a8a", "accent-dark": "#144343", "accent-light": "#eaf6f6", "accent-medium": "#70bcbc", "accent-text": "#ffffff" },
  "charcoal":  { accent: "#4a4a4a", "accent-dark": "#2b2b2b", "accent-light": "#f4f4f4", "accent-medium": "#909090", "accent-text": "#ffffff" },
  "blush":     { accent: "#c47a8a", "accent-dark": "#9c4558", "accent-light": "#fdf0f3", "accent-medium": "#e0a8b8", "accent-text": "#ffffff" },
};

// ── Color utilities (from src/utils/color.js) ─────────────────────────────────
function hexToHSL(hex) {
  if (!hex || hex.length < 7) return { h: 0, s: 0, l: 0.5 };
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r)      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else                h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s, l };
}

function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if      (h < 60)  { r=c; g=x; b=0; }
  else if (h < 120) { r=x; g=c; b=0; }
  else if (h < 180) { r=0; g=c; b=x; }
  else if (h < 240) { r=0; g=x; b=c; }
  else if (h < 300) { r=x; g=0; b=c; }
  else              { r=c; g=0; b=x; }
  const toHex = v => Math.round((v + m) * 255).toString(16).padStart(2,"0");
  return "#" + toHex(r) + toHex(g) + toHex(b);
}

function relativeLuminance(hex) {
  const toLinear = v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  const r = toLinear(parseInt(hex.slice(1,3),16)/255);
  const g = toLinear(parseInt(hex.slice(3,5),16)/255);
  const b = toLinear(parseInt(hex.slice(5,7),16)/255);
  return 0.2126*r + 0.7152*g + 0.0722*b;
}

function wcagTextColor(bgHex) {
  const lum = relativeLuminance(bgHex);
  const contrastWhite = (lum + 0.05) > 0 ? (1.05) / (lum + 0.05) : 21;
  const contrastBlack = (lum + 0.05) > 0 ? (lum + 0.05) / 0.05   : 1;
  return contrastWhite >= contrastBlack ? "#ffffff" : "#1c1614";
}

function darkenAccent(hex) {
  if (!hex || hex.length < 7) return hex;
  const { h, s, l } = hexToHSL(hex);
  const amount = l < 0.35 ? 0.12 : 0.18;
  return hslToHex(h, s, Math.max(0, l - amount));
}

function deriveCustomPalette(hex) {
  if (!hex || hex.length < 7) hex = "#c4637a";
  const { h, s } = hexToHSL(hex);
  const sCap = Math.min(s, 0.85);
  const lightAccent  = hex;
  const lightLight   = hslToHex(h, Math.min(sCap, 0.35), 0.96);
  const lightMedium  = hslToHex(h, sCap * 0.75, 0.72);
  const lightText    = wcagTextColor(lightAccent);
  const darkAccent   = hslToHex(h, Math.min(sCap * 0.85, 0.70), 0.70);
  const darkLight    = hslToHex(h, Math.min(sCap * 0.40, 0.35), 0.13);
  const darkMedium   = hslToHex(h, Math.min(sCap * 0.80, 0.65), 0.55);
  const darkText     = "#ffffff";
  return {
    light: { accent: lightAccent, "accent-dark": darkenAccent(lightAccent), "accent-light": lightLight, "accent-medium": lightMedium, "accent-text": lightText },
    dark:  { accent: darkAccent,  "accent-dark": darkenAccent(darkAccent),  "accent-light": darkLight,  "accent-medium": darkMedium,  "accent-text": darkText  },
  };
}

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
