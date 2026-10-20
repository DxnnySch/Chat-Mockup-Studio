// Colour maths for contrast checks and palettes. Pure.
export function parseColor(str) {
  if (!str) return null;
  str = String(str).trim();
  let m;
  if ((m = str.match(/^#([0-9a-f]{3,8})$/i))) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1 };
  }
  if ((m = str.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/i))) {
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: +m[1], g: +m[2], b: +m[3], a };
  }
  if (str === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  return null;
}
export function composite(fg, bg) {
  const a = fg.a + bg.a * (1 - fg.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const f = (c, d) => (c * fg.a + d * bg.a * (1 - fg.a)) / a;
  return { r: f(fg.r, bg.r), g: f(fg.g, bg.g), b: f(fg.b, bg.b), a };
}
export function luminance({ r, g, b }) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrast(c1, c2) {
  const a = luminance(c1), b = luminance(c2);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
export const toHex = ({ r, g, b }) => '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
export function readableOn(bg) {
  const c = parseColor(bg) || { r: 255, g: 255, b: 255, a: 1 };
  return contrast(c, { r: 0, g: 0, b: 0, a: 1 }) >= contrast(c, { r: 255, g: 255, b: 255, a: 1 }) ? '#111111' : '#ffffff';
}
// Colour-blind-safe palettes (Okabe-Ito, Tol bright, Viridis picks)
export const PALETTES = {
  'Okabe-Ito': ['#0072B2', '#E69F00', '#009E73', '#D55E00', '#56B4E9', '#CC79A7', '#F0E442', '#000000'],
  'Tol bright': ['#4477AA', '#EE6677', '#228833', '#CCBB44', '#66CCEE', '#AA3377', '#BBBBBB'],
  'Viridis': ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'],
  'Mono blue': ['#08306b', '#2171b5', '#6baed6', '#bdd7e7', '#eff3ff'],
};
