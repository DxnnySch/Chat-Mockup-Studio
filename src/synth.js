// Seeded synthetic data for "fake but plausible" figures. Pure and deterministic per seed.
export function rng(seed = 1) {
  let a = (seed >>> 0) || 1;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function gauss(rand) { let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length - 1)) || 1; };
const std = (z) => { const m = mean(z), s = sd(z); return z.map(v => (v - m) / s); };
export const round = (v, d = 2) => +v.toFixed(d);

/**
 * Two yearly series with an exact target sample correlation.
 *  A = mean + linear trend (total change `trend` over the period) + noise·N(0,1)
 *  B = bMean + bSd·(rho·z(A) + √(1−rho²)·w)  with w independent of A  → corr(A,B) === rho
 * So B inherits A's trend through the correlation (negative rho ⇒ B rises when A falls).
 */
export function correlatedSeries({ from = 1979, to = 2020, rho = -0.5, seed = 7, a = {}, b = {} } = {}) {
  const A = { mean: 0, trend: -1, noise: 0.5, ...a }, B = { mean: 0, sd: 1, ...b };
  const n = Math.max(4, Math.min(300, Math.floor(to) - Math.floor(from) + 1));
  const R = rng(seed), r = Math.max(-0.99, Math.min(0.99, +rho || 0));
  const years = Array.from({ length: n }, (_, i) => Math.floor(from) + i);
  const aSeries = years.map((_, i) => A.mean + A.trend * (i / (n - 1) - 0.5) + A.noise * gauss(R));
  const zA = std(aSeries);
  const w0 = Array.from({ length: n }, () => gauss(R));
  const mw = mean(w0), cov = mean(w0.map((v, i) => (v - mw) * zA[i]));           // zA has mean 0, var ≈ 1
  const w = std(w0.map((v, i) => v - mw - cov * zA[i]));                          // orthogonalised noise
  const bSeries = zA.map((z, i) => B.mean + B.sd * (r * z + Math.sqrt(1 - r * r) * w[i]));
  return { years, a: aSeries, b: bSeries };
}

/** CSV for a dual-axis time-series panel: Year, A, B@right */
export function timeSeriesCsv(s, nameA = 'Series A', nameB = 'Series B', d = 2) {
  return ['Year,' + nameA + ',' + nameB + '@right', ...s.years.map((y, i) => `${y},${round(s.a[i], d)},${round(s.b[i], d)}`)].join('\n');
}
/** CSV for a scatter panel of B (x) against A (y), points labelled with the year. */
export function scatterCsv(s, nameX = 'Series B', nameY = 'Series A', d = 2) {
  return [nameX + ',' + nameY + ',Year@label', ...s.years.map((y, i) => `${round(s.b[i], d)},${round(s.a[i], d)},${y}`)].join('\n');
}
