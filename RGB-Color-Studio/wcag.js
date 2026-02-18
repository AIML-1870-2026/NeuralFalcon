/* wcag.js — WCAG 2.1 contrast ratio, APCA Lc, auto-suggest accessible color */

const WCAG = (() => {
  // Relative luminance per WCAG 2.1
  function relativeLuminance(r, g, b) {
    const rs = ColorMath.srgbToLinear(r);
    const gs = ColorMath.srgbToLinear(g);
    const bs = ColorMath.srgbToLinear(b);
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  // WCAG 2.1 contrast ratio (1:1 to 21:1)
  function contrastRatio(fg, bg) {
    const l1 = relativeLuminance(fg.r, fg.g, fg.b);
    const l2 = relativeLuminance(bg.r, bg.g, bg.b);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  // APCA contrast (simplified WCAG 3 preview)
  function apcaContrast(fg, bg) {
    const coeffs = { r: 0.2126729, g: 0.7151522, b: 0.0721750 };

    function toY(c) {
      const r = Math.pow(c.r / 255, 2.4);
      const g = Math.pow(c.g / 255, 2.4);
      const b = Math.pow(c.b / 255, 2.4);
      return coeffs.r * r + coeffs.g * g + coeffs.b * b;
    }

    let txtY = toY(fg);
    let bgY = toY(bg);

    // Soft clamp
    if (txtY < 0.022) txtY += Math.pow(0.022 - txtY, 1.414);
    if (bgY < 0.022) bgY += Math.pow(0.022 - bgY, 1.414);

    let SAPC;
    if (bgY > txtY) {
      SAPC = (Math.pow(bgY, 0.56) - Math.pow(txtY, 0.57)) * 1.14;
    } else {
      SAPC = (Math.pow(bgY, 0.65) - Math.pow(txtY, 0.62)) * 1.14;
    }

    if (Math.abs(SAPC) < 0.1) return 0;
    return SAPC > 0 ? (SAPC - 0.027) * 100 : (SAPC + 0.027) * 100;
  }

  // Pass/fail checks
  function getLevel(ratio) {
    return {
      aaNormal: ratio >= 4.5,
      aaLarge: ratio >= 3,
      aaaNormal: ratio >= 7,
      aaaLarge: ratio >= 4.5
    };
  }

  // Auto-suggest nearest accessible color (adjust lightness to meet target ratio)
  function nearestAccessible(color, background, targetRatio) {
    const lch = ColorMath.rgbToOklch(color.r, color.g, color.b);
    const bgLum = relativeLuminance(background.r, background.g, background.b);

    // Try adjusting lightness in both directions
    let bestColor = null;
    let bestDist = Infinity;

    for (let dir = -1; dir <= 1; dir += 2) {
      for (let step = 0; step <= 100; step++) {
        const newL = Math.max(0, Math.min(1, lch.L + dir * step * 0.01));
        const rgb = ColorMath.oklchToRgbClamped(newL, lch.C, lch.h);
        const ratio = contrastRatio(rgb, background);
        if (ratio >= targetRatio) {
          const dist = Math.abs(newL - lch.L);
          if (dist < bestDist) {
            bestDist = dist;
            bestColor = rgb;
          }
          break;
        }
      }
    }

    // If lightness alone didn't work, also reduce chroma
    if (!bestColor) {
      for (let l = 0; l <= 100; l++) {
        const newL = l / 100;
        const rgb = ColorMath.oklchToRgbClamped(newL, lch.C * 0.5, lch.h);
        const ratio = contrastRatio(rgb, background);
        if (ratio >= targetRatio) {
          bestColor = rgb;
          break;
        }
      }
    }

    return bestColor || { r: 0, g: 0, b: 0 };
  }

  // Check if a color passes AA against white or black
  function passesAAOnWhiteOrBlack(color) {
    const onWhite = contrastRatio(color, { r: 255, g: 255, b: 255 });
    const onBlack = contrastRatio(color, { r: 0, g: 0, b: 0 });
    return onWhite >= 4.5 || onBlack >= 4.5;
  }

  return {
    relativeLuminance,
    contrastRatio,
    apcaContrast,
    getLevel,
    nearestAccessible,
    passesAAOnWhiteOrBlack
  };
})();
