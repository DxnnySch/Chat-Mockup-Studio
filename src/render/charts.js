// SVG chart renderer: bar / line / area / scatter, error bars, dual y-axis, trend line + Pearson r, point labels.
import { buildChart } from '../chartMath.js';
import { PALETTES } from '../color.js';
import { esc } from '../markdown.js';

const fmt = (v) => String(+v.toPrecision(4));
const minus = (s) => String(s).replace('-', '−');
export const fmtR = (r) => minus(r.toFixed(2));
const wrap = (label, maxChars) => {
  const words = String(label).split(/\s+/); const lines = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
};

const textW = (s, size) => String(s).length * size * 0.58;
/** Fit a label into maxPx: one line, else two balanced lines, else shrink (>=78%), else ellipsis. */
export function fitLabel(text, maxPx, size) {
  text = String(text || '');
  if (!text) return { lines: [], size };
  if (textW(text, size) <= maxPx) return { lines: [text], size };
  const words = text.split(/\s+/);
  let best = [text];
  for (let k = 1; k < words.length; k++) {
    const a = words.slice(0, k).join(' '), b = words.slice(k).join(' ');
    if (Math.max(textW(a, size), textW(b, size)) < Math.max(...best.map(l => textW(l, size)))) best = [a, b];
  }
  const widest = Math.max(...best.map(l => textW(l, size)));
  if (widest <= maxPx) return { lines: best, size };
  const k = maxPx / widest, sz = Math.max(size * 0.78, size * k);
  const maxChars = Math.max(4, Math.floor(maxPx / (sz * 0.58)));
  return { lines: best.map(l => (l.length > maxChars ? l.slice(0, maxChars - 1) + '\u2026' : l)), size: sz };
}
const rotLabel = (fit, cx, cy, deg, fill) => !fit.lines.length ? '' :
  `<text transform="translate(${cx} ${cy}) rotate(${deg})" text-anchor="middle" font-size="${fit.size * 1.05}" font-weight="600" fill="${fill}">${fit.lines.map((l, k) => `<tspan x="0" ${k ? `dy="${fit.size * 1.25}"` : ''}>${esc(l)}</tspan>`).join('')}</text>`;

export function chartSvg(block, { width, fs, theme }) {
  const W = Math.max(200, Math.round(width));
  const H = Math.max(120, +block.height || 300);
  const model = buildChart({ type: block.chartType || 'bar', csv: block.csv, xTickCount: Math.floor((W - 120) / (fs * (theme.chart.fontScale || 0.7) * 4.2)) });
  if (model.error) return `<div class="blk-placeholder" style="height:${H}px">${esc(model.error)}</div>`;
  const th = theme.chart;
  const f = fs * (th.fontScale || 0.7);
  const names = String(block.colors || '').split(/[,\s]+/).filter(Boolean);
  const palette = names.length ? names : (PALETTES[block.palette || th.palette] || PALETTES['Okabe-Ito']);
  const col = (i) => palette[i % palette.length];
  const dual = !!model.y2Ticks;
  const multi = model.series.length > 1 || (block.legend && !block.yLabel);   // a lone series is already named by the axis label
  const tickW = (ticks) => Math.max(...ticks.map(t => fmt(t).length)) * f * 0.6;
  const ph0 = Math.max(60, H * 0.6);                       // estimate of plot height before margins are known
  const yFit = fitLabel(block.yLabel, ph0, f), y2Fit = dual ? fitLabel(block.y2Label, ph0, f) : { lines: [], size: f };
  const labW = (fit) => (fit.lines.length ? fit.lines.length * fit.size * 1.25 + fit.size * 0.5 : 0);
  const left = tickW(model.yTicks) + labW(yFit) + 14;
  const right = dual ? tickW(model.y2Ticks) + labW(y2Fit) + 14 : 14;
  // legend: wrap entries onto rows that fit the plot width
  const legendItems = multi ? model.series.map(s => {
    const full = s.name + (dual && s.axis === 'right' ? ' (right)' : '');
    const maxC = Math.max(8, Math.floor((W - f * 3) / (f * 0.58)));
    return full.length > maxC ? full.slice(0, maxC - 1) + '\u2026' : full;
  }) : [];
  const legendRows = []; { let cur = [], w = 0; legendItems.forEach((l, i) => { const iw = l.length * f * 0.58 + f * 2.4; if (cur.length && w + iw > W - f) { legendRows.push(cur); cur = []; w = 0; } cur.push([l, i, w]); w += iw; }); if (cur.length) legendRows.push(cur); }
  const legendH = legendRows.length ? legendRows.length * f * 1.6 + f * 0.3 : 0;
  const slotCount = model.numericX ? 1 : Math.max(1, model.categories.length);
  const maxChars = Math.max(4, Math.floor(((W - left - right) / slotCount) / (f * 0.58)));
  const catLines = model.numericX ? [] : model.categories.map(c => wrap(c, maxChars));
  const catRows = model.numericX ? 1 : Math.max(1, ...catLines.map(l => l.length));
  const bottom = catRows * f * 1.3 + (block.xLabel ? f * 1.7 : 0) + 12;
  const top = legendH + f * 0.9 + 4;
  const pw = W - left - right, ph = H - top - bottom;
  const [y0, y1] = model.y, [x0, x1] = model.x;
  const sy = (v) => top + ph - ((v - y0) / (y1 - y0 || 1)) * ph;
  const sy2 = (v) => { const [a, b] = model.y2; return top + ph - ((v - a) / (b - a || 1)) * ph; };
  const scaleOf = (s) => (s.axis === 'right' && dual ? sy2 : sy);
  const n = model.categories.length;
  const sx = (p) => model.numericX ? left + ((p.x - x0) / (x1 - x0 || 1)) * pw : left + (p.x + 0.5) * (pw / Math.max(1, n));
  const sw = Math.max(1.5, f * 0.14);
  const colorOf = (s) => col(model.series.indexOf(s));
  const firstL = model.series.find(s => s.axis === 'left'), firstR = model.series.find(s => s.axis === 'right');
  const lAxisCol = dual ? colorOf(firstL) : th.axisColor, rAxisCol = dual ? colorOf(firstR) : th.axisColor;
  let g = '';
  // grid + left axis
  model.yTicks.forEach(t => {
    const y = sy(t);
    g += `<line x1="${left}" x2="${left + pw}" y1="${y}" y2="${y}" stroke="${th.gridColor}" stroke-width="${Math.max(1, sw * 0.5)}"/>`;
    g += `<text x="${left - 8}" y="${y + f * 0.35}" text-anchor="end" font-size="${f}" fill="${lAxisCol}">${fmt(t)}</text>`;
  });
  g += `<line x1="${left}" x2="${left}" y1="${top}" y2="${top + ph}" stroke="${lAxisCol}" stroke-width="${sw * 0.8}"/>`;
  const baseY = sy(Math.max(y0, Math.min(0, y1)));
  g += `<line x1="${left}" x2="${left + pw}" y1="${top + ph}" y2="${top + ph}" stroke="${th.axisColor}" stroke-width="${sw * 0.7}"/>`;
  if (model.type === 'bar' || (block.zeroLine && y0 < 0 && y1 > 0)) {
    g += `<line x1="${left}" x2="${left + pw}" y1="${baseY}" y2="${baseY}" stroke="${th.axisColor}" stroke-width="${sw * 0.7}" ${model.type === 'bar' ? '' : `stroke-dasharray="${f * 0.4} ${f * 0.3}"`}/>`;
  }
  // right axis
  if (dual) {
    g += `<line x1="${left + pw}" x2="${left + pw}" y1="${top}" y2="${top + ph}" stroke="${rAxisCol}" stroke-width="${sw * 0.8}"/>`;
    model.y2Ticks.forEach(t => { g += `<text x="${left + pw + 8}" y="${sy2(t) + f * 0.35}" text-anchor="start" font-size="${f}" fill="${rAxisCol}">${fmt(t)}</text>`; });
    g += rotLabel(y2Fit, W - y2Fit.size * 0.45 - (y2Fit.lines.length - 1) * y2Fit.size * 1.25, top + ph / 2, 90, rAxisCol);
  }
  // x labels
  if (model.numericX) {
    model.xTicks.forEach(t => {
      const x = left + ((t - x0) / (x1 - x0 || 1)) * pw;
      g += `<line x1="${x}" x2="${x}" y1="${top + ph}" y2="${top + ph + f * 0.35}" stroke="${th.axisColor}" stroke-width="${sw * 0.6}"/>`;
      g += `<text x="${x}" y="${top + ph + f * 1.4}" text-anchor="middle" font-size="${f}" fill="${th.axisColor}">${fmt(t)}</text>`;
    });
  } else {
    catLines.forEach((lines, i) => {
      const x = left + (i + 0.5) * (pw / n);
      lines.forEach((ln, k) => { g += `<text x="${x}" y="${top + ph + f * 1.3 + k * f * 1.25}" text-anchor="middle" font-size="${f}" fill="${th.axisColor}">${esc(ln)}</text>`; });
    });
  }
  if (block.xLabel) g += `<text x="${left + pw / 2}" y="${H - 6}" text-anchor="middle" font-size="${f * 1.05}" font-weight="600" fill="${th.axisColor}">${esc(block.xLabel)}</text>`;
  g += rotLabel(yFit, yFit.size * 0.95, top + ph / 2, -90, lAxisCol);

  const errBar = (x, p, sc) => {
    if (!p.err) return '';
    const a = sc(p.y - p.err), b = sc(p.y + p.err), cap = Math.max(3, f * 0.3);
    return `<path d="M${x} ${a}V${b}M${x - cap} ${a}H${x + cap}M${x - cap} ${b}H${x + cap}" stroke="${th.axisColor}" stroke-width="${sw * 0.8}" fill="none"/>`;
  };
  const tip = (s, p) => `<title>${esc(s.name)} · ${esc(p.label)}: ${fmt(p.y)}${p.err ? ' ± ' + fmt(p.err) : ''}</title>`;
  const manyPts = Math.max(...model.series.map(s => s.points.length)) > 24;
  const markers = block.markers ?? !manyPts;

  model.series.forEach((s, si) => {
    const c = col(si), sc = scaleOf(s);
    if (model.type === 'bar') {
      const slot = pw / Math.max(1, n), inner = slot * 0.72, bw = inner / model.series.length;
      s.points.forEach(p => {
        const cx = left + (p.x + 0.5) * slot, x = cx - inner / 2 + si * bw, yy = sc(p.y);
        const r = Math.min(th.barRadius || 0, bw / 2, Math.abs(baseY - yy));
        g += `<g class="ch-bar"><rect x="${x + 1}" y="${Math.min(yy, baseY)}" width="${Math.max(1, bw - 2)}" height="${Math.abs(baseY - yy)}" rx="${r}" fill="${c}">${tip(s, p)}</rect>`;
        g += errBar(x + bw / 2, p, sc);
        if (block.showValues) g += `<text x="${x + bw / 2}" y="${yy - (p.err ? Math.abs(sc(p.y) - sc(p.y + p.err)) : 0) - 5}" text-anchor="middle" font-size="${f}" font-weight="600" fill="${theme.colors.text}">${fmt(p.y)}</text>`;
        g += '</g>';
      });
      return;
    }
    const pts = s.points.map(p => [sx(p), sc(p.y), p]);
    if (model.type === 'area' && pts.length > 1) g += `<polygon points="${pts.map(q => q[0] + ',' + q[1]).join(' ')} ${pts.at(-1)[0]},${baseY} ${pts[0][0]},${baseY}" fill="${c}" opacity="0.18"/>`;
    if ((model.type === 'line' || model.type === 'area') && pts.length > 1) g += `<polyline fill="none" stroke="${c}" stroke-width="${sw * 1.6}" stroke-linejoin="round" stroke-linecap="round" points="${pts.map(q => q[0] + ',' + q[1]).join(' ')}"/>`;
    // trend line (least squares) for scatter / numeric-x line charts
    if (block.trend && s.reg && model.numericX) {
      const xa = Math.min(...s.points.map(p => p.x)), xb = Math.max(...s.points.map(p => p.x));
      const ya = s.reg.slope * xa + s.reg.intercept, yb = s.reg.slope * xb + s.reg.intercept;
      g += `<line class="ch-trend" x1="${sx({ x: xa })}" y1="${sc(ya)}" x2="${sx({ x: xb })}" y2="${sc(yb)}" stroke="${model.type === 'scatter' ? th.axisColor : c}" stroke-width="${sw * 1.4}" stroke-dasharray="${f * 0.6} ${f * 0.4}" stroke-linecap="round"/>`;
    }
    const showPts = model.type === 'scatter' || markers;
    pts.forEach(([x, y, p], k) => {
      g += errBar(x, p, sc);
      if (showPts) g += `<circle class="ch-pt" cx="${x}" cy="${y}" r="${Math.max(3.2, f * (model.type === 'scatter' ? 0.34 : 0.36))}" fill="${c}" stroke="${theme.colors.surface}" stroke-width="${sw * 0.6}">${tip(s, p)}</circle>`;
      if (block.showValues) g += `<text x="${x}" y="${y - f * 0.8}" text-anchor="middle" font-size="${f}" font-weight="600" fill="${theme.colors.text}">${fmt(p.y)}</text>`;
      if (block.labelPoints && p.label && k % Math.max(1, +block.labelEvery || 1) === 0) g += `<text x="${x + f * 0.45}" y="${y - f * 0.4}" font-size="${f * 0.78}" fill="${th.axisColor}">${esc(p.label)}</text>`;
    });
  });

  // correlation box
  const regs = model.series.filter(s => s.reg && model.numericX);
  if ((block.showR || block.statText) && regs.length) {
    const lines = block.statText ? [esc(block.statText)] : regs.map(s => {
      const nPart = block.showN ? `  (n = ${s.reg.n})` : '';
      const pre = regs.length > 1 ? `${esc(s.name)}: ` : '';
      return `${pre}<tspan font-style="italic">r</tspan> = ${fmtR(s.reg.r)}${nPart}`;
    });
    const plain = (block.statText ? [block.statText] : regs.map(s => `${regs.length > 1 ? s.name + ': ' : ''}r = ${fmtR(s.reg.r)}${block.showN ? `  (n = ${s.reg.n})` : ''}`));
    const bw = Math.max(...plain.map(t => t.length)) * f * 0.54 + f * 1.1, bh = lines.length * f * 1.4 + f * 0.5;
    const negative = regs[0].reg.slope < 0;
    const bx = negative ? left + pw - bw - f * 0.6 : left + f * 0.6, by = top + f * 0.5;
    g += `<g class="ch-stat"><rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${f * 0.4}" fill="${theme.colors.surface}" fill-opacity="0.92" stroke="${th.gridColor}" stroke-width="${sw * 0.6}"/>`;
    lines.forEach((t, k) => { g += `<text x="${bx + f * 0.6}" y="${by + f * 1.2 + k * f * 1.4}" font-size="${f * 1.05}" font-weight="700" fill="${theme.colors.text}">${t}</text>`; });
    g += '</g>';
  }
  legendRows.forEach((row, ri) => row.forEach(([label, si, off]) => {
    const y = f * 0.45 + ri * f * 1.6;
    g += `<rect x="${f * 0.5 + off}" y="${y}" width="${f}" height="${f}" rx="${f * 0.2}" fill="${col(si)}"/><text x="${f * 0.5 + off + f * 1.4}" y="${y + f * 0.85}" font-size="${f}" fill="${theme.colors.text}">${esc(label)}</text>`;
  }));
  return `<svg class="chart-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="max-width:100%;height:auto;font-family:inherit">${g}</svg>`;
}
