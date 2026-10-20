// Small shared helpers. Pure (DOM-free).
export const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9);

/** Deep clone of JSON-like data. Strings are shared, so big data-URLs are not copied. */
export function clone(v) {
  if (Array.isArray(v)) return v.map(clone);
  if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = clone(v[k]); return o; }
  return v;
}
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** Deep merge b over a (arrays replaced). Returns new object. */
export function merge(a, b) {
  if (!isObj(a) || !isObj(b)) return b === undefined ? clone(a) : clone(b);
  const o = clone(a);
  for (const k in b) o[k] = isObj(b[k]) && isObj(o[k]) ? merge(o[k], b[k]) : clone(b[k]);
  return o;
}
const keys = (path) => (Array.isArray(path) ? path : String(path).split('.').filter(k => k !== ''));
export function getPath(obj, path, dflt) {
  let cur = obj;
  for (const k of keys(path)) { if (cur == null) return dflt; cur = cur[k]; }
  return cur === undefined ? dflt : cur;
}
/** Mutating set; creates intermediate objects. Blocks prototype pollution. */
export function setPath(obj, path, value) {
  const ks = keys(path);
  if (ks.some(k => k === '__proto__' || k === 'constructor' || k === 'prototype')) throw new Error('bad path');
  let cur = obj;
  ks.slice(0, -1).forEach((k, i) => { if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = /^\d+$/.test(ks[i + 1]) ? [] : {}; cur = cur[k]; });
  cur[ks[ks.length - 1]] = value;
  return obj;
}
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const debounce = (fn, ms) => { let t; const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; d.flush = (...a) => { clearTimeout(t); fn(...a); }; return d; };
export function delPath(obj, path) {
  const ks = keys(path); let cur = obj;
  for (const k of ks.slice(0, -1)) { if (cur == null) return obj; cur = cur[k]; }
  if (cur != null) delete cur[ks[ks.length - 1]];
  return obj;
}
