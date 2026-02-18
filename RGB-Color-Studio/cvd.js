/* cvd.js — Color Vision Deficiency simulation (Brettel/Viénot matrices, all 8 types) */

const CVD = (() => {
  // Simulation matrices (Viénot 1999 / Brettel 1997)
  // Each transforms linear RGB to simulated linear RGB

  const matrices = {
    protanopia: [
      [0.152286, 1.052583, -0.204868],
      [0.114503, 0.786281,  0.099216],
      [-0.003882, -0.048116, 1.051998]
    ],
    protanomaly: [
      [0.458064, 0.679578, -0.137642],
      [0.092785, 0.846313,  0.060902],
      [-0.007494, -0.016807, 1.024301]
    ],
    deuteranopia: [
      [0.367322, 0.860646, -0.227968],
      [0.280085, 0.672501,  0.047413],
      [-0.011820, 0.042940,  0.968881]
    ],
    deuteranomaly: [
      [0.547494, 0.607765, -0.155259],
      [0.181692, 0.781742,  0.036566],
      [-0.010410, 0.027275,  0.983136]
    ],
    tritanopia: [
      [1.255528, -0.076749, -0.178779],
      [-0.078411, 0.930809,  0.147602],
      [0.004733,  0.691367,  0.303900]
    ],
    tritanomaly: [
      [1.017277, 0.027029, -0.044306],
      [-0.006113, 0.958479,  0.047634],
      [0.006379,  0.248708,  0.744913]
    ],
    achromatopsia: [
      [0.2126, 0.7152, 0.0722],
      [0.2126, 0.7152, 0.0722],
      [0.2126, 0.7152, 0.0722]
    ],
    achromatomaly: [
      [0.618, 0.320, 0.062],
      [0.163, 0.775, 0.062],
      [0.163, 0.320, 0.516]
    ]
  };

  function simulate(color, type) {
    const matrix = matrices[type];
    if (!matrix) return color;

    // Convert to linear RGB
    const lr = ColorMath.srgbToLinear(color.r);
    const lg = ColorMath.srgbToLinear(color.g);
    const lb = ColorMath.srgbToLinear(color.b);

    // Apply matrix
    const sr = matrix[0][0] * lr + matrix[0][1] * lg + matrix[0][2] * lb;
    const sg = matrix[1][0] * lr + matrix[1][1] * lg + matrix[1][2] * lb;
    const sb = matrix[2][0] * lr + matrix[2][1] * lg + matrix[2][2] * lb;

    // Convert back to sRGB
    return {
      r: Math.round(ColorMath.linearToSrgb(sr) * 255),
      g: Math.round(ColorMath.linearToSrgb(sg) * 255),
      b: Math.round(ColorMath.linearToSrgb(sb) * 255)
    };
  }

  // Check if two colors are perceptually distinguishable
  function areDistinguishable(c1, c2) {
    const lab1 = ColorMath.rgbToOklab(c1.r, c1.g, c1.b);
    const lab2 = ColorMath.rgbToOklab(c2.r, c2.g, c2.b);
    const dL = lab1.L - lab2.L;
    const da = lab1.a - lab2.a;
    const db = lab1.b - lab2.b;
    const deltaE = Math.sqrt(dL * dL + da * da + db * db);
    return deltaE > 0.04; // Perceptual threshold in OKLab
  }

  // Score a palette for a given CVD type: % of pairs still distinguishable
  function safePaletteScore(palette, type) {
    if (palette.length < 2) return 100;
    const simulated = palette.map(c => simulate(c, type));
    let total = 0, distinguishable = 0;
    for (let i = 0; i < simulated.length; i++) {
      for (let j = i + 1; j < simulated.length; j++) {
        total++;
        if (areDistinguishable(simulated[i], simulated[j])) {
          distinguishable++;
        }
      }
    }
    return Math.round((distinguishable / total) * 100);
  }

  const typeLabels = {
    protanopia: { name: 'Protanopia', desc: 'Red-blind', prevalence: '~1% males' },
    protanomaly: { name: 'Protanomaly', desc: 'Red-weak', prevalence: '~1% males' },
    deuteranopia: { name: 'Deuteranopia', desc: 'Green-blind', prevalence: '~1% males' },
    deuteranomaly: { name: 'Deuteranomaly', desc: 'Green-weak', prevalence: '~5% males' },
    tritanopia: { name: 'Tritanopia', desc: 'Blue-blind', prevalence: '~0.003%' },
    tritanomaly: { name: 'Tritanomaly', desc: 'Blue-weak', prevalence: 'Rare' },
    achromatopsia: { name: 'Achromatopsia', desc: 'Monochromacy', prevalence: 'Very rare' },
    achromatomaly: { name: 'Achromatomaly', desc: 'Partial mono', prevalence: 'Very rare' }
  };

  const types = Object.keys(matrices);

  return { simulate, areDistinguishable, safePaletteScore, types, typeLabels };
})();
