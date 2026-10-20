// Chart data parsing + scales + regression. Pure.
export function parseCSV(text) {
  const rows = [];
  for (const raw of String(text ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    if (!raw.trim()) continue;
    const cells = []; let cur = '', q = false;
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      if (q) { if (c === '"') { if (raw[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === ',' || c === ';' || c === '\t') { cells.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    cells.push(cur.trim()); rows.push(cells);
  }
  return rows;
}
const num = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };

export function niceTicks(min, max, count = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) max = min + 1;
  const span = max - min, raw = span / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || 10 * mag;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step * 1e-9; v += step) ticks.push(+v.toFixed(10));
  return ticks;
}

/** Ordinary least squares y = slope·x + intercept with Pearson r. null if undefined (n<2 or constant x). */
export function linreg(pts) {
  const p = pts.filter(q => Number.isFinite(q.x) && Number.isFinite(q.y));
  const n = p.length; if (n < 2) return null;
  const mx = p.reduce((s, q) => s + q.x, 0) / n, my = p.reduce((s, q) => s + q.y, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (const q of p) { sxx += (q.x - mx) ** 2; sxy += (q.x - mx) * (q.y - my); syy += (q.y - my) ** 2; }
  if (sxx === 0) return null;
  const slope = sxy / sxx, r = syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy);
  return { slope, intercept: my - slope * mx, r, r2: r * r, n };
}

/**
 * CSV conventions (first column = x / category):
 *  - extra columns = series; header "name@right" puts a series on the right y-axis
 *  - header "<s>±", "<s>_err", "<s> err", "_sd", "_sem" = error bars of series <s>
 *  - header "label" or "<name>@label" = per-point text label (not plotted)
 */
export function buildChart({ type = 'bar', csv = '', xTickCount = 6 } = {}) {
  const rows = parseCSV(csv);
  if (rows.length < 2 || rows[0].length < 2) return { error: 'Need a header row and at least one data row (CSV).' };
  const header = rows[0], data = rows.slice(1);
  const cols = header.map((raw, i) => {
    let name = raw, axis = 'left', label = false, m;
    if ((m = name.match(/^(.*?)\s*@(right|r|left|l|label)$/i))) { name = m[1] || m[2]; const t = m[2].toLowerCase(); axis = t === 'right' || t === 'r' ? 'right' : 'left'; label = t === 'label'; }
    if (i > 0 && /^labels?$/i.test(name)) label = true;
    return { i, raw, name, axis, label };
  });
  const errFor = {}, seriesCols = []; let labelCol = null;
  cols.forEach(c => {
    if (c.i === 0) return;
    if (c.label) { if (labelCol === null) labelCol = c.i; return; }
    const m = c.name.match(/^(.*?)\s*(±|_err|\s+err|_sd|_sem)$/i);
    const target = m && cols.find(x => x.i > 0 && !x.label && x.name === m[1]);
    if (target) errFor[target.i] = c.i; else seriesCols.push(c);
  });
  if (!seriesCols.length) return { error: 'No numeric series columns.' };
  const numericX = type !== 'bar' && data.every(r => num(r[0]) !== null);
  const categories = data.map(r => r[0]);
  const series = seriesCols.map(c => ({
    name: c.name, axis: c.axis,
    points: data.map((r, ri) => ({
      x: numericX ? num(r[0]) : ri, label: labelCol !== null ? r[labelCol] || '' : r[0], y: num(r[c.i]), err: errFor[c.i] ? num(r[errFor[c.i]]) : null,
    })).filter(p => p.y !== null),
  })).filter(s => s.points.length);
  if (!series.length) return { error: 'No numeric values found.' };
  if (series.every(s => s.axis === 'right')) series.forEach(s => (s.axis = 'left'));
  const dom = (list) => {
    const ys = list.flatMap(s => s.points.flatMap(p => [p.y - (p.err || 0), p.y + (p.err || 0)]));
    let lo = Math.min(...ys), hi = Math.max(...ys);
    if (type === 'bar') { lo = Math.min(0, lo); hi = Math.max(0, hi); }
    return niceTicks(lo, hi, 5);
  };
  const left = series.filter(s => s.axis === 'left'), right = series.filter(s => s.axis === 'right');
  const yTicks = dom(left), y2Ticks = right.length ? dom(right) : null;
  let x, xTicks = null;
  if (numericX) {
    const xs = series.flatMap(s => s.points.map(p => p.x));
    let lo = Math.min(...xs), hi = Math.max(...xs);
    const pad = type === 'scatter' ? (hi - lo || 1) * 0.05 : 0;
    lo -= pad; hi += pad; if (lo === hi) { lo -= 0.5; hi += 0.5; }
    xTicks = niceTicks(lo, hi, Math.max(2, xTickCount)).filter(t => t >= lo - 1e-9 && t <= hi + 1e-9);
    x = [lo, hi];
    series.forEach(s => (s.reg = linreg(s.points)));
  } else x = [0, Math.max(0, categories.length - 1)];
  return { type, numericX, categories, series, yTicks, y2Ticks, xTicks, y: [yTicks[0], yTicks.at(-1)], y2: y2Ticks ? [y2Ticks[0], y2Ticks.at(-1)] : null, x, hasLabels: labelCol !== null };
}
