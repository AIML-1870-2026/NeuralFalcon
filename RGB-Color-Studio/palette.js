/* palette.js — All 12 palette algorithms, all in OKLCh perceptual space */

const Palette = (() => {
  function hueRotate(color, degrees) {
    const lch = ColorMath.rgbToOklch(color.r, color.g, color.b);
    const newH = ((lch.h + degrees) % 360 + 360) % 360;
    return ColorMath.oklchToRgbClamped(lch.L, lch.C, newH);
  }

  // 1. Complementary: hue +180°
  function complementary(color) {
    return [color, hueRotate(color, 180)];
  }

  // 2. Split-complementary: hue ±150°
  function splitComplementary(color) {
    return [color, hueRotate(color, 150), hueRotate(color, -150)];
  }

  // 3. Triadic: hue +120°, +240°
  function triadic(color) {
    return [color, hueRotate(color, 120), hueRotate(color, 240)];
  }

  // 4. Tetradic / Square: hue +90°, +180°, +270°
  function tetradic(color) {
    return [color, hueRotate(color, 90), hueRotate(color, 180), hueRotate(color, 270)];
  }

  // 5. Analogous: hue ±30°, ±60°
  function analogous(color) {
    return [
      hueRotate(color, -60), hueRotate(color, -30),
      color,
      hueRotate(color, 30), hueRotate(color, 60)
    ];
  }

  // 6. Monochromatic: fixed hue, vary lightness and chroma
  function monochromatic(color, steps = 7) {
    const lch = ColorMath.rgbToOklch(color.r, color.g, color.b);
    const result = [];
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const L = 0.15 + t * 0.75; // range L from 0.15 to 0.90
      const C = lch.C * (0.3 + 0.7 * Math.sin(t * Math.PI)); // vary chroma
      result.push(ColorMath.oklchToRgbClamped(L, C, lch.h));
    }
    return result;
  }

  // 7. Tints & Shades: lightness ramp, fixed hue + chroma
  function tintsAndShades(color, steps = 9) {
    const lch = ColorMath.rgbToOklch(color.r, color.g, color.b);
    const result = [];
    for (let i = 0; i < steps; i++) {
      const L = 0.10 + (i / (steps - 1)) * 0.85;
      result.push(ColorMath.oklchToRgbClamped(L, lch.C, lch.h));
    }
    return result;
  }

  // 8. Material Design 3 tonal palette (13 tones)
  function materialDesign3(color) {
    const lch = ColorMath.rgbToOklch(color.r, color.g, color.b);
    const tones = [0, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100];
    return tones.map(tone => {
      const L = tone / 100;
      return ColorMath.oklchToRgbClamped(L, lch.C * (L > 0.05 && L < 0.95 ? 1 : 0.5), lch.h);
    });
  }

  // 9. Tailwind-style scale (50–950)
  function tailwindScale(color) {
    const lch = ColorMath.rgbToOklch(color.r, color.g, color.b);
    const stops = [
      { name: '50',  L: 0.97 },
      { name: '100', L: 0.93 },
      { name: '200', L: 0.86 },
      { name: '300', L: 0.76 },
      { name: '400', L: 0.64 },
      { name: '500', L: 0.53 },
      { name: '600', L: 0.44 },
      { name: '700', L: 0.37 },
      { name: '800', L: 0.29 },
      { name: '900', L: 0.21 },
      { name: '950', L: 0.14 }
    ];
    return stops.map(s => {
      const C = lch.C * (1 - Math.abs(s.L - 0.5) * 0.6);
      return ColorMath.oklchToRgbClamped(s.L, C, lch.h);
    });
  }

  // 10. Pastel / Muted
  function pastel(color) {
    const lch = ColorMath.rgbToOklch(color.r, color.g, color.b);
    const shifts = [-40, -20, 0, 20, 40];
    return shifts.map(dh => {
      const h = ((lch.h + dh) % 360 + 360) % 360;
      return ColorMath.oklchToRgbClamped(0.82, lch.C * 0.35, h);
    });
  }

  // 11. Dark-mode safe: auto fg/bg pairs passing AA
  function darkModeSafe(color) {
    const lch = ColorMath.rgbToOklch(color.r, color.g, color.b);
    const result = [];
    // Generate background at low lightness
    const bgDark = ColorMath.oklchToRgbClamped(0.15, lch.C * 0.3, lch.h);
    // Generate foreground options at high lightness
    const fgLight = ColorMath.oklchToRgbClamped(0.90, lch.C * 0.4, lch.h);
    const accent = ColorMath.oklchToRgbClamped(0.75, lch.C * 0.8, lch.h);
    const muted = ColorMath.oklchToRgbClamped(0.65, lch.C * 0.3, lch.h);
    const subtle = ColorMath.oklchToRgbClamped(0.40, lch.C * 0.2, lch.h);

    result.push(bgDark, subtle, muted, accent, fgLight);

    // Verify and adjust: ensure fg colors pass AA on bg
    return result.map((c, i) => {
      if (i === 0) return c; // bg stays
      const ratio = WCAG.contrastRatio(c, bgDark);
      if (ratio >= 4.5) return c;
      // Boost lightness until passing
      return WCAG.nearestAccessible(c, bgDark, 4.5);
    });
  }

  // 12. Custom N-step: user-defined hue shift and step count
  function customNStep(color, steps = 6, hueShift = 30) {
    const result = [];
    for (let i = 0; i < steps; i++) {
      result.push(hueRotate(color, hueShift * i));
    }
    return result;
  }

  // Palette type metadata
  const types = {
    complementary:       { name: 'Complementary',       desc: 'Hue +180° — 2-color pair', fn: complementary },
    splitComplementary:  { name: 'Split-Complementary', desc: 'Hue ±150° — 3-color', fn: splitComplementary },
    triadic:             { name: 'Triadic',             desc: 'Hue +120°, +240° — equidistant', fn: triadic },
    tetradic:            { name: 'Tetradic / Square',   desc: 'Hue +90°, +180°, +270°', fn: tetradic },
    analogous:           { name: 'Analogous',           desc: 'Hue ±30°, ±60° — harmonious', fn: analogous },
    monochromatic:       { name: 'Monochromatic',       desc: 'Lightness/chroma steps, fixed hue', fn: monochromatic },
    tintsAndShades:      { name: 'Tints & Shades',      desc: 'Lightness ramp (9 steps)', fn: tintsAndShades },
    materialDesign3:     { name: 'Material Design 3',   desc: 'MD3 tonal palette (13 tones)', fn: materialDesign3 },
    tailwindScale:       { name: 'Tailwind Scale',      desc: '50–950 perceptual scale', fn: tailwindScale },
    pastel:              { name: 'Pastel / Muted',      desc: 'Desaturated, light variants', fn: pastel },
    darkModeSafe:        { name: 'Dark-Mode Safe',      desc: 'AA-passing fg/bg pairs', fn: darkModeSafe },
    customNStep:         { name: 'Custom N-Step',       desc: 'User-defined hue shift', fn: customNStep }
  };

  function generate(type, color, opts = {}) {
    const t = types[type];
    if (!t) return [];
    if (type === 'customNStep') return t.fn(color, opts.steps || 6, opts.hueShift || 30);
    if (type === 'monochromatic') return t.fn(color, opts.steps || 7);
    if (type === 'tintsAndShades') return t.fn(color, opts.steps || 9);
    return t.fn(color);
  }

  // Score a palette: best WCAG ratio against white or black
  function scorePalette(colors) {
    let passing = 0;
    for (const c of colors) {
      if (WCAG.passesAAOnWhiteOrBlack(c)) passing++;
    }
    return Math.round((passing / colors.length) * 100);
  }

  // Export as CSS variables
  function exportCSS(colors, prefix = 'color') {
    return colors.map((c, i) =>
      `--${prefix}-${i + 1}: ${ColorMath.rgbToHex(c.r, c.g, c.b)};`
    ).join('\n');
  }

  // Export as Tailwind config JSON
  function exportTailwind(colors, name = 'primary') {
    const stops = ['50','100','200','300','400','500','600','700','800','900','950'];
    const obj = {};
    colors.forEach((c, i) => {
      const key = stops[i] || String((i + 1) * 100);
      obj[key] = ColorMath.rgbToHex(c.r, c.g, c.b);
    });
    return JSON.stringify({ [name]: obj }, null, 2);
  }

  return { types, generate, scorePalette, exportCSS, exportTailwind };
})();
