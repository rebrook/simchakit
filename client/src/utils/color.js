// Color utilities — hex/HSL conversion, WCAG contrast, and palette derivation

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
  // h in degrees, s and l as 0-1
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

// Darken a hex color for gradient second stops (accent-dark).
// Uses adaptive step: 12% for already-dark accents (L < 0.35), 18% for lighter ones.
function darkenAccent(hex) {
  if (!hex || hex.length < 7) return hex;
  const { h, s, l } = hexToHSL(hex);
  const amount = l < 0.35 ? 0.12 : 0.18;
  return hslToHex(h, s, Math.max(0, l - amount));
}

function deriveCustomPalette(hex) {
  if (!hex || hex.length < 7) hex = "#c4637a";
  const { h, s } = hexToHSL(hex);
  const sCap = Math.min(s, 0.85); // prevent over-saturation

  // Light mode
  const lightAccent   = hex;
  const lightLight    = hslToHex(h, Math.min(sCap, 0.35), 0.96);  // very pale tint
  const lightMedium   = hslToHex(h, sCap * 0.75, 0.72);            // mid tone
  const lightText     = wcagTextColor(lightAccent);

  // Dark mode — preserve hue, shift lightness/saturation for dark surfaces
  const darkAccent    = hslToHex(h, Math.min(sCap * 0.85, 0.70), 0.70);  // lighter on dark bg
  const darkLight     = hslToHex(h, Math.min(sCap * 0.40, 0.35), 0.13);  // dark tinted surface
  const darkMedium    = hslToHex(h, Math.min(sCap * 0.80, 0.65), 0.55);  // mid tone for dark
  const darkText      = "#ffffff"; // dark mode accent is always light enough for white text

  return {
    light: { accent: lightAccent, "accent-dark": darkenAccent(lightAccent), "accent-light": lightLight, "accent-medium": lightMedium, "accent-text": lightText },
    dark:  { accent: darkAccent,  "accent-dark": darkenAccent(darkAccent),  "accent-light": darkLight,  "accent-medium": darkMedium,  "accent-text": darkText  },
  };
}

export {
  hexToHSL,
  hslToHex,
  relativeLuminance,
  wcagTextColor,
  darkenAccent,
  deriveCustomPalette,
};
