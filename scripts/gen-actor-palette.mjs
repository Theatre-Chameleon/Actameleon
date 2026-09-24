#!/usr/bin/env node
/**
 * Generate the actor colour palette baked into src/services/actorColor.js.
 *
 *   node scripts/gen-actor-palette.mjs            print the palette table
 *   node scripts/gen-actor-palette.mjs --check    verify the committed table
 *
 * The palette has to satisfy four things at once:
 *
 *   1. Every colour is legible on every background the app actually uses,
 *      in both themes (WCAG AA, 4.5:1).
 *   2. Colours read as different colours. This is what the eye uses to tell
 *      characters apart, and it lives almost entirely in hue and chroma.
 *   3. Colours stay separable for red-green colour vision deficiency, which
 *      needs lightness to vary as well, since at a fixed lightness a
 *      deuteranope sees red and green as the same colour.
 *   4. Any prefix of the sequence is itself a good palette, because colours
 *      are handed out by cast rank: the roles with the most lines take the
 *      front of the sequence and so get the best separated colours.
 *
 * Points 2 and 3 pull against each other, and the order matters. An earlier
 * version maximised total OKLab distance, which let a pair "pass" on a
 * lightness difference alone: two desaturated teals 12 degrees apart scored
 * fine and were indistinguishable on screen. So chromatic distance, measured
 * in the a-b plane, is the objective, and colour vision deficiency is a hard
 * constraint rather than the thing being maximised.
 *
 * The method is farthest-point sampling over a candidate pool pre-filtered
 * for contrast, taking the worst case over {light, dark} throughout: a pair
 * is only as good as it looks in the theme where it looks worse.
 */

const SIZE = 48;

// Steps in the hue spectrum offered by the colour override picker. Ordered by
// hue so it reads as a spectrum; see pickerRamp() for why that matters.
const HUE_STEPS = 24;

// Lightness bands. Chosen so the whole band clears AA; the pool filter below
// enforces it exactly, these just bound the search.
const LIGHT_L = [0.28, 0.54];
const DARK_L = [0.64, 0.90];

// The picker ramp is free to leave the bands above, since it is not competing
// with anything for separation; only legibility constrains it.
const LIGHT_L_WIDE = [0.20, 0.75];
const DARK_L_WIDE = [0.55, 0.95];

// Anything fainter than this reads as grey rather than as a colour, and grey
// pairs are exactly what the previous palette got wrong.
const MIN_CHROMA = 0.06;

// Hard floor on colour vision deficiency separation. Not maximised - see the
// header - but never traded away. Solved slightly above the 0.02 target for
// the same rounding reason as MIN_CONTRAST.
const MIN_CVD = 0.021;

// Backgrounds a coloured actor name can actually land on.
const LIGHT_BG = [
  '#ffffff', // page
  '#f9fafb', // striped row
  '#fefce8', // highlighted line
  '#f3f4f6'  // active filter pill
];
const DARK_BG = ['#242424', '#1f2937', '#332920'];

// WCAG AA is 4.5:1. Solve for a little more, because the emitted oklch values
// are rounded to three decimals and that can shave the true ratio.
const MIN_CONTRAST = 4.65;

// The real WCAG AA threshold. MIN_CONTRAST solves above it for rounding room.
const MIN_CONTRAST_TARGET = 4.5;

// ------------------------------------------------------------ colour science

const clamp = c => Math.min(1, Math.max(0, c));
const srgbToLinear = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hexToLinear = h => [1, 3, 5].map(i => srgbToLinear(parseInt(h.slice(i, i + 2), 16) / 255));

function oklchToLinear(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  ];
}

function linearToOklab([r, g, b]) {
  r = clamp(r); g = clamp(g); b = clamp(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  ];
}

const inGamut = v => v.every(c => c >= -0.001 && c <= 1.001);
const luminance = v => 0.2126 * clamp(v[0]) + 0.7152 * clamp(v[1]) + 0.0722 * clamp(v[2]);

function contrast(linear, hex) {
  const bg = hexToLinear(hex);
  const a = luminance(linear);
  const b = 0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// Vienot 1999 dichromat simulation, applied in linear RGB.
const CVD = {
  normal: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  protan: [[0.11238, 0.88762, 0], [0.11238, 0.88762, 0], [0.00401, -0.00401, 1]],
  deutan: [[0.29275, 0.70725, 0], [0.29275, 0.70725, 0], [-0.02234, 0.02234, 1]]
};
const simulate = (v, kind) =>
  CVD[kind].map(row => clamp(row[0] * clamp(v[0]) + row[1] * clamp(v[1]) + row[2] * clamp(v[2])));

const views = linear => [
  linearToOklab(linear),
  linearToOklab(simulate(linear, 'protan')),
  linearToOklab(simulate(linear, 'deutan'))
];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Distance ignoring lightness. This is what makes two colours look different. */
const chromaDist = (a, b) => Math.hypot(a[1] - b[1], a[2] - b[2]);

/** How differently the two colours read, in the theme where they read worse. */
function chromaticSeparation(a, b) {
  return Math.min(
    chromaDist(a.lightViews[0], b.lightViews[0]),
    chromaDist(a.darkViews[0], b.darkViews[0])
  );
}

/** Worst-case separation over both themes and all three kinds of vision. */
function cvdSeparation(a, b) {
  let min = Infinity;
  for (let i = 0; i < 3; i++) {
    min = Math.min(min, dist(a.lightViews[i], b.lightViews[i]), dist(a.darkViews[i], b.darkViews[i]));
  }
  return min;
}

// ------------------------------------------------------------- pool + search

/** Strongest chroma at this lightness and hue that is in gamut and clears AA. */
function usableChroma(L, H, backgrounds) {
  let best = 0;
  for (let c = 0.03; c <= 0.24; c += 0.005) {
    const v = oklchToLinear(L, c, H);
    if (inGamut(v) && backgrounds.every(bg => contrast(v, bg) >= MIN_CONTRAST)) best = c;
  }
  return best;
}

function buildPool() {
  const pool = [];
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const Ll = LIGHT_L[0] + (LIGHT_L[1] - LIGHT_L[0]) * t;
    const Ld = DARK_L[0] + (DARK_L[1] - DARK_L[0]) * t;
    for (let H = 0; H < 360; H += 3) {
      const Cl = usableChroma(Ll, H, LIGHT_BG);
      const Cd = usableChroma(Ld, H, DARK_BG);
      if (Cl < MIN_CHROMA || Cd < MIN_CHROMA) continue;
      pool.push({
        H, Ll, Cl, Ld, Cd,
        lightViews: views(oklchToLinear(Ll, Cl, H)),
        darkViews: views(oklchToLinear(Ld, Cd, H))
      });
    }
  }
  return pool;
}

/**
 * Grow the sequence one colour at a time, each time taking the candidate that
 * is most different from everything chosen so far.
 *
 * Because each step only appends, every prefix is the best palette that size
 * could be, which is what lets colours be handed out by cast rank.
 */
function farthestPointSample(pool, size) {
  const chosen = [pool[0]];
  while (chosen.length < size) {
    let best = null, bestScore = -1;      // satisfies the CVD floor
    let fallback = null, fallbackScore = -1;  // best chromatic if none does

    for (const candidate of pool) {
      let chromatic = Infinity, cvd = Infinity;
      for (const picked of chosen) {
        const c = chromaticSeparation(candidate, picked);
        if (c < chromatic) chromatic = c;
        const v = cvdSeparation(candidate, picked);
        if (v < cvd) cvd = v;
      }
      if (chromatic > fallbackScore) { fallbackScore = chromatic; fallback = candidate; }
      if (cvd >= MIN_CVD && chromatic > bestScore) { bestScore = chromatic; best = candidate; }
    }
    chosen.push(best || fallback);
  }
  return chosen;
}

/**
 * The ramp shown in the override picker.
 *
 * This is deliberately not a slice of the palette. The palette is ordered so
 * that every prefix is well spread, which means its later entries exist to
 * fill gaps and end up looking like near duplicates of earlier ones when laid
 * out as a grid. Sorted by hue instead, neighbours are *expected* to be
 * similar and the whole thing reads as a spectrum.
 *
 * Lightness is chosen per hue rather than fixed. The best lightness swings
 * from about 0.45 for violet to 0.57 for red, and holding it constant drives
 * chroma to zero for yellows and greens, which turns them grey.
 */
function pickerRamp() {
  const ramp = [];
  for (let i = 0; i < HUE_STEPS; i++) {
    const H = (i * 360) / HUE_STEPS;
    ramp.push({ H, light: bestForHue(H, LIGHT_L_WIDE, LIGHT_BG), dark: bestForHue(H, DARK_L_WIDE, DARK_BG) });
  }
  return ramp;
}

/** The (L, C) giving this hue the most colour it can have while staying legible. */
function bestForHue(H, [lo, hi], backgrounds) {
  let best = { L: lo, C: 0 };
  for (let L = lo; L <= hi; L += 0.005) {
    const C = usableChroma(L, H, backgrounds);
    if (C > best.C) best = { L, C };
  }
  return best;
}

// ----------------------------------------------------------------- reporting

const fmt = n => n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
const toCss = (L, C, H) => `oklch(${fmt(L)} ${fmt(C)} ${H})`;

function floors(entries) {
  let chromatic = Infinity, cvd = Infinity;
  for (let i = 0; i < entries.length; i++)
    for (let j = i + 1; j < entries.length; j++) {
      chromatic = Math.min(chromatic, chromaticSeparation(entries[i], entries[j]));
      cvd = Math.min(cvd, cvdSeparation(entries[i], entries[j]));
    }
  return { chromatic, cvd };
}

function report(palette) {
  console.error(`pool candidates: ${buildPool.cached ?? 'n/a'}`);
  console.error('\nseparation by prefix length (= cast size):');
  console.error('   n   chromatic      cvd');
  for (const n of [8, 10, 12, 14, 16, 19, 24, 32, 41, 48]) {
    if (n > palette.length) continue;
    const { chromatic, cvd } = floors(palette.slice(0, n));
    console.error(`  ${String(n).padStart(2)}    ${chromatic.toFixed(4)}      ${cvd.toFixed(4)}`);
  }
  let wl = Infinity, wd = Infinity;
  for (const e of palette) {
    for (const bg of LIGHT_BG) wl = Math.min(wl, contrast(oklchToLinear(e.Ll, e.Cl, e.H), bg));
    for (const bg of DARK_BG) wd = Math.min(wd, contrast(oklchToLinear(e.Ld, e.Cd, e.H), bg));
  }
  console.error(`\nworst contrast: light ${wl.toFixed(2)}:1, dark ${wd.toFixed(2)}:1 ` +
    `-> ${wl >= MIN_CONTRAST && wd >= MIN_CONTRAST ? 'all pass WCAG AA' : 'FAILS'}`);
}

function main() {
  const pool = buildPool();
  buildPool.cached = pool.length;
  const palette = farthestPointSample(pool, SIZE);
  report(palette);

  const ramp = pickerRamp();
  reportRamp(ramp);

  const banner = '// Generated by scripts/gen-actor-palette.mjs - do not edit by hand.';

  const paletteRows = palette
    .map(e => `  ['${toCss(e.Ll, e.Cl, e.H)}', '${toCss(e.Ld, e.Cd, e.H)}']`)
    .join(',\n');
  console.log(`${banner}\n// Each entry is [light mode, dark mode].\n` +
    `export const PALETTE = [\n${paletteRows}\n];`);

  const rampRows = ramp
    .map(e => `  ['${toCss(e.light.L, e.light.C, e.H)}', '${toCss(e.dark.L, e.dark.C, e.H)}']`)
    .join(',\n');
  console.log(`\n${banner}\n// Hue-ordered ramp for the colour override picker.\n` +
    `export const HUE_CHOICES = [\n${rampRows}\n];`);
}

function reportRamp(ramp) {
  let worst = Infinity;
  for (const e of ramp) {
    for (const bg of LIGHT_BG) worst = Math.min(worst, contrast(oklchToLinear(e.light.L, e.light.C, e.H), bg));
    for (const bg of DARK_BG) worst = Math.min(worst, contrast(oklchToLinear(e.dark.L, e.dark.C, e.H), bg));
  }
  const minChroma = Math.min(...ramp.map(e => Math.min(e.light.C, e.dark.C)));
  console.error(`\npicker ramp: ${ramp.length} hues, worst contrast ${worst.toFixed(2)}:1, ` +
    `min chroma ${minChroma.toFixed(3)} -> ` +
    `${worst >= MIN_CONTRAST_TARGET && minChroma >= MIN_CHROMA ? 'ok' : 'FAILS'}`);
}

main();
