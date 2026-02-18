/* color-math.js — RGB ↔ HSL ↔ OKLab ↔ OKLCh conversions + gamut clamping */

const ColorMath = (() => {
  // --- sRGB linearization ---
  function srgbToLinear(c) {
    c = c / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function linearToSrgb(c) {
    c = Math.max(0, Math.min(1, c));
    return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  }

  // --- RGB ↔ HSL ---
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
    return { h: h * 360, s, l };
  }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    h /= 360;
    if (s === 0) {
      const v = Math.round(l * 255);
      return { r: v, g: v, b: v };
    }
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return {
      r: Math.round(hue2rgb(p, q, h + 1/3) * 255),
      g: Math.round(hue2rgb(p, q, h) * 255),
      b: Math.round(hue2rgb(p, q, h - 1/3) * 255)
    };
  }

  // --- RGB → OKLab ---
  function rgbToOklab(r, g, b) {
    const lr = srgbToLinear(r);
    const lg = srgbToLinear(g);
    const lb = srgbToLinear(b);

    const l_ = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
    const m_ = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
    const s_ = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

    const l_c = Math.cbrt(l_);
    const m_c = Math.cbrt(m_);
    const s_c = Math.cbrt(s_);

    return {
      L: 0.2104542553 * l_c + 0.7936177850 * m_c - 0.0040720468 * s_c,
      a: 1.9779984951 * l_c - 2.4285922050 * m_c + 0.4505937099 * s_c,
      b: 0.0259040371 * l_c + 0.7827717662 * m_c - 0.8086757660 * s_c
    };
  }

  // --- OKLab → RGB ---
  function oklabToRgb(L, a, b) {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

    return {
      r: Math.round(linearToSrgb(r) * 255),
      g: Math.round(linearToSrgb(g) * 255),
      b: Math.round(linearToSrgb(bl) * 255)
    };
  }

  // --- OKLab ↔ OKLCh ---
  function oklabToOklch(L, a, b) {
    const C = Math.sqrt(a * a + b * b);
    let h = Math.atan2(b, a) * 180 / Math.PI;
    if (h < 0) h += 360;
    return { L, C, h };
  }

  function oklchToOklab(L, C, h) {
    const hRad = h * Math.PI / 180;
    return { L, a: C * Math.cos(hRad), b: C * Math.sin(hRad) };
  }

  // --- RGB ↔ OKLCh convenience ---
  function rgbToOklch(r, g, b) {
    const lab = rgbToOklab(r, g, b);
    return oklabToOklch(lab.L, lab.a, lab.b);
  }

  function oklchToRgb(L, C, h) {
    const lab = oklchToOklab(L, C, h);
    return oklabToRgb(lab.L, lab.a, lab.b);
  }

  // --- Gamut clamping (binary search on chroma) ---
  function isInGamut(r, g, b) {
    return r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255;
  }

  function clampToSrgb(L, C, h) {
    let rgb = oklchToRgb(L, C, h);
    if (isInGamut(rgb.r, rgb.g, rgb.b)) return { L, C, h };

    let lo = 0, hi = C;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      rgb = oklchToRgb(L, mid, h);
      if (isInGamut(rgb.r, rgb.g, rgb.b)) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return { L, C: lo, h };
  }

  function oklchToRgbClamped(L, C, h) {
    const clamped = clampToSrgb(L, C, h);
    return oklchToRgb(clamped.L, clamped.C, clamped.h);
  }

  // --- Hex utilities ---
  function rgbToHex(r, g, b) {
    const toHex = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return '#' + toHex(r) + toHex(g) + toHex(b);
  }

  function hexToRgb(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    if (hex.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(hex)) return null;
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16)
    };
  }

  // --- Interpolation helpers ---
  function lerpRgb(c1, c2, t) {
    return {
      r: Math.round(c1.r + (c2.r - c1.r) * t),
      g: Math.round(c1.g + (c2.g - c1.g) * t),
      b: Math.round(c1.b + (c2.b - c1.b) * t)
    };
  }

  function lerpHsl(c1, c2, t) {
    const h1 = rgbToHsl(c1.r, c1.g, c1.b);
    const h2 = rgbToHsl(c2.r, c2.g, c2.b);
    let dh = h2.h - h1.h;
    if (dh > 180) dh -= 360;
    if (dh < -180) dh += 360;
    const h = ((h1.h + dh * t) % 360 + 360) % 360;
    const s = h1.s + (h2.s - h1.s) * t;
    const l = h1.l + (h2.l - h1.l) * t;
    return hslToRgb(h, s, l);
  }

  function lerpOklch(c1, c2, t) {
    const lch1 = rgbToOklch(c1.r, c1.g, c1.b);
    const lch2 = rgbToOklch(c2.r, c2.g, c2.b);
    let dh = lch2.h - lch1.h;
    if (dh > 180) dh -= 360;
    if (dh < -180) dh += 360;
    const h = ((lch1.h + dh * t) % 360 + 360) % 360;
    const L = lch1.L + (lch2.L - lch1.L) * t;
    const C = lch1.C + (lch2.C - lch1.C) * t;
    return oklchToRgbClamped(L, C, h);
  }

  // --- Named CSS colors (subset for nearest-name lookup) ---
  const NAMED_COLORS = {
    aliceblue:[240,248,255],antiquewhite:[250,235,215],aqua:[0,255,255],aquamarine:[127,255,212],
    azure:[240,255,255],beige:[245,245,220],bisque:[255,228,196],black:[0,0,0],
    blanchedalmond:[255,235,205],blue:[0,0,255],blueviolet:[138,43,226],brown:[165,42,42],
    burlywood:[222,184,135],cadetblue:[95,158,160],chartreuse:[127,255,0],chocolate:[210,105,30],
    coral:[255,127,80],cornflowerblue:[100,149,237],cornsilk:[255,248,220],crimson:[220,20,60],
    cyan:[0,255,255],darkblue:[0,0,139],darkcyan:[0,139,139],darkgoldenrod:[184,134,11],
    darkgray:[169,169,169],darkgreen:[0,100,0],darkkhaki:[189,183,107],darkmagenta:[139,0,139],
    darkolivegreen:[85,107,47],darkorange:[255,140,0],darkorchid:[153,50,204],darkred:[139,0,0],
    darksalmon:[233,150,122],darkseagreen:[143,188,143],darkslateblue:[72,61,139],
    darkslategray:[47,79,79],darkturquoise:[0,206,209],darkviolet:[148,0,211],
    deeppink:[255,20,147],deepskyblue:[0,191,255],dimgray:[105,105,105],dodgerblue:[30,144,255],
    firebrick:[178,34,34],floralwhite:[255,250,240],forestgreen:[34,139,34],fuchsia:[255,0,255],
    gainsboro:[220,220,220],ghostwhite:[248,248,255],gold:[255,215,0],goldenrod:[218,165,32],
    gray:[128,128,128],green:[0,128,0],greenyellow:[173,255,47],honeydew:[240,255,240],
    hotpink:[255,105,180],indianred:[205,92,92],indigo:[75,0,130],ivory:[255,255,240],
    khaki:[240,230,140],lavender:[230,230,250],lavenderblush:[255,240,245],lawngreen:[124,252,0],
    lemonchiffon:[255,250,205],lightblue:[173,216,230],lightcoral:[240,128,128],
    lightcyan:[224,255,255],lightgoldenrodyellow:[250,250,210],lightgray:[211,211,211],
    lightgreen:[144,238,144],lightpink:[255,182,193],lightsalmon:[255,160,122],
    lightseagreen:[32,178,170],lightskyblue:[135,206,250],lightslategray:[119,136,153],
    lightsteelblue:[176,196,222],lightyellow:[255,255,224],lime:[0,255,0],limegreen:[50,205,50],
    linen:[250,240,230],magenta:[255,0,255],maroon:[128,0,0],mediumaquamarine:[102,205,170],
    mediumblue:[0,0,205],mediumorchid:[186,85,211],mediumpurple:[147,111,219],
    mediumseagreen:[60,179,113],mediumslateblue:[123,104,238],mediumspringgreen:[0,250,154],
    mediumturquoise:[72,209,204],mediumvioletred:[199,21,133],midnightblue:[25,25,112],
    mintcream:[245,255,250],mistyrose:[255,228,225],moccasin:[255,228,181],navajowhite:[255,222,173],
    navy:[0,0,128],oldlace:[253,245,230],olive:[128,128,0],olivedrab:[107,142,35],
    orange:[255,165,0],orangered:[255,69,0],orchid:[218,112,214],palegoldenrod:[238,232,170],
    palegreen:[152,251,152],paleturquoise:[175,238,238],palevioletred:[219,112,147],
    papayawhip:[255,239,213],peachpuff:[255,218,185],peru:[205,133,63],pink:[255,192,203],
    plum:[221,160,221],powderblue:[176,224,230],purple:[128,0,128],rebeccapurple:[102,51,153],
    red:[255,0,0],rosybrown:[188,143,143],royalblue:[65,105,225],saddlebrown:[139,69,19],
    salmon:[250,128,114],sandybrown:[244,164,96],seagreen:[46,139,87],seashell:[255,245,238],
    sienna:[160,82,45],silver:[192,192,192],skyblue:[135,206,235],slateblue:[106,90,205],
    slategray:[112,128,144],snow:[255,250,250],springgreen:[0,255,127],steelblue:[70,130,180],
    tan:[210,180,140],teal:[0,128,128],thistle:[216,191,216],tomato:[255,99,71],
    turquoise:[64,224,208],violet:[238,130,238],wheat:[245,222,179],white:[255,255,255],
    whitesmoke:[245,245,245],yellow:[255,255,0],yellowgreen:[154,205,50]
  };

  function nearestNamedColor(r, g, b) {
    let best = null, bestDist = Infinity;
    for (const [name, [nr, ng, nb]] of Object.entries(NAMED_COLORS)) {
      const d = (r-nr)**2 + (g-ng)**2 + (b-nb)**2;
      if (d < bestDist) { bestDist = d; best = name; }
    }
    return best;
  }

  return {
    rgbToHsl, hslToRgb,
    rgbToOklab, oklabToRgb,
    rgbToOklch, oklchToRgb, oklchToRgbClamped,
    clampToSrgb,
    rgbToHex, hexToRgb,
    lerpRgb, lerpHsl, lerpOklch,
    nearestNamedColor,
    srgbToLinear, linearToSrgb
  };
})();
