// Poster tab: print geometry, text-size & contrast report, one-click fixes, colour-blind-safe palettes.
import { app } from './app.js';
import { h, Panel } from './fields.js';
import { effectivePt, effectiveDpi, level, wcagLevel } from '../readability.js';
import { parseColor, composite, contrast, PALETTES } from '../color.js';
import { esc } from '../markdown.js';

const CATS = [
  ['.disclaimer', 'Input disclaimer'], ['.chat-header', 'Header'], ['.chat-input', 'Input bar'], ['.msg-head', 'Names / time'], ['.msg-meta', 'Meta info'],
  ['.sources', 'Sources'], ['figcaption', 'Figure captions'], ['.chart-svg', 'Chart labels'], ['.diagram-svg', 'Diagram labels'], ['.followups', 'Follow-up chips'],
  ['.actions', 'Reactions / pager'], ['.code-head', 'Code header'], ['.blk-code', 'Code'], ['.tbl', 'Tables'], ['.think', 'Reasoning panel'], ['.blk-tool', 'Tool call'], ['.bubble', 'Message text'],
];
// theme scale key to raise when a category is too small
const SCALE_KEY = { 'Names / time': 'theme.names.scale', 'Meta info': 'theme.meta.scale', 'Sources': 'theme.sources.scale', 'Figure captions': 'theme.media.captionScale', 'Chart labels': 'theme.chart.fontScale',
  'Diagram labels': 'theme.diagram.fontScale', 'Header': 'theme.chromeScale', 'Input disclaimer': 'theme.chromeScale', 'Code': 'theme.code.scale', 'Reasoning panel': 'theme.thinking.scale' };

const catOf = (el) => { for (const [sel, name] of CATS) if (el.closest(sel)) return name; return 'Other'; };

function bgOf(el, stage, canvas) {
  let acc = { r: 0, g: 0, b: 0, a: 0 };
  for (let n = el; n && n !== stage.parentElement; n = n.parentElement) {
    if (n === stage) { // gradient / image backgrounds: approximate with the base colour
      const c = parseColor(getComputedStyle(n).backgroundColor);
      acc = composite(acc, canvas.transparent ? { r: 255, g: 255, b: 255, a: 1 } : (c && c.a > 0 ? c : parseColor(canvas.bg.color) || { r: 255, g: 255, b: 255, a: 1 }));
      break;
    }
    const c = parseColor(getComputedStyle(n).backgroundColor);
    if (c && c.a > 0) acc = composite(acc, c);
    if (acc.a >= 0.999) break;
  }
  return acc.a >= 0.999 ? acc : composite(acc, { r: 255, g: 255, b: 255, a: 1 });
}

/** Scan the rendered stage → { cats: [{name, minPx, pt, lvl, count}], contrast: [{name, ratio, text}] } */
export function scanStage(stage, project) {
  const cv = project.canvas;
  const cats = new Map(), cons = new Map();
  const walker = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const txt = n.nodeValue.trim(); if (!txt) continue;
    const el = n.parentElement; if (!el || el.closest('style, .anno-layer, .katex-mathml, .cite, .src-idx, .avatar, .msg-badge')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    let px = parseFloat(cs.fontSize);
    const svg = el.closest('svg');
    if (svg && svg.viewBox?.baseVal?.width) px *= svg.clientWidth / svg.viewBox.baseVal.width;
    if (el.closest('.katex')) px = Math.max(px, 0);
    const cat = catOf(el);
    const c = cats.get(cat) || { name: cat, minPx: Infinity, count: 0, sample: '' };
    if (px < c.minPx) { c.minPx = px; c.sample = txt.slice(0, 28); }
    c.count++; cats.set(cat, c);
    const fg = parseColor(cs.color) || parseColor(cs.fill);
    if (fg) {
      const bg = bgOf(el, stage, cv);
      const op = parseFloat(cs.opacity) || 1;
      const eff = composite({ ...fg, a: (fg.a ?? 1) * op }, bg);
      const ratio = contrast({ ...eff, a: 1 }, { ...bg, a: 1 });
      const prev = cons.get(cat);
      if (!prev || ratio < prev.ratio) cons.set(cat, { name: cat, ratio, text: txt.slice(0, 28), large: px >= 24 });
    }
  }
  const out = [...cats.values()].filter(c => Number.isFinite(c.minPx)).map(c => {
    const pt = effectivePt(c.minPx, cv.width, cv.physicalCm);
    return { ...c, pt, lvl: level(pt, { min: cv.minPt, good: cv.goodPt }) };
  }).sort((a, b) => a.pt - b.pt);
  return { cats: out, contrast: [...cons.values()].sort((a, b) => a.ratio - b.ratio) };
}

export function buildPoster() {
  const panel = new Panel();
  const out = h('div', {});
  const geo = h('div', { class: 'note' });
  panel.group('Print geometry', [
    { path: 'canvas.physicalCm', label: 'Printed width (cm)', type: 'range', min: 3, max: 200, step: 0.5 },
    { path: 'canvas.exportScale', label: 'Export scale ×', type: 'range', min: 1, max: 8, step: 0.5 },
    { path: 'canvas.minPt', label: 'Minimum text (pt)', type: 'number', min: 6, max: 60, hint: 'Below this = red.' },
    { path: 'canvas.goodPt', label: 'Comfortable (pt)', type: 'number', min: 8, max: 80, hint: 'Poster body text is usually ≥ 24 pt; captions ≥ 18 pt.' },
  ], true);
  panel.el.querySelector('.grp-body').append(geo);
  panel.add(h('h3', {}, 'Text size at print size'));
  panel.add(out);

  const fixBtn = h('button', { class: 'primary', onclick: () => {
    const s = app.store.get(), cv = s.canvas;
    const k = (cv.physicalCm / 2.54 * 96) / cv.width;               // CSS px → printed px factor
    const needBase = cv.goodPt / (0.75 * k);                          // base px that gives goodPt for body
    app.store.update(st => {
      if (st.theme.font.size < needBase) st.theme.font.size = Math.min(72, Math.ceil(needBase));
      const fs = st.theme.font.size;
      for (const path of new Set(Object.values(SCALE_KEY))) {
        const keys = path.split('.'); let o = st; keys.slice(0, -1).forEach(q => (o = o[q]));
        const need = (cv.minPt / (fs * 0.75 * k)) * 1.06;      // +6 %: rounding + SVG fit-to-width shrink + the disclaimer's 0.95 factor
        if (o[keys[keys.length - 1]] < need) o[keys[keys.length - 1]] = Math.min(1.3, Math.ceil(need * 100) / 100);
      }
    }, 'autofix');
    app.toast('Raised text sizes to the thresholds'); panel.sync(); refresh();
  } }, 'Auto-fix: raise text to thresholds');
  panel.add(h('div', { class: 'row' }, fixBtn, h('button', { onclick: () => refresh() }, 'Re-scan')));
  panel.add(h('div', { class: 'note' }, 'Raises the base font so message text reaches the comfortable size, then lifts small elements (captions, meta, sources, chart/diagram labels) to the minimum. If the layout grows too tall, reduce the canvas width or increase the printed width.'));

  panel.add(h('h3', {}, 'Colour-blind-safe palettes'));
  const pal = h('div', {});
  Object.entries(PALETTES).forEach(([name, cols]) => {
    pal.append(h('div', { class: 'row' },
      h('span', { class: 'swatches' }, ...cols.map(c => { const i = document.createElement('i'); i.style.background = c; return i; })),
      h('b', { style: 'flex:1' }, name),
      h('button', { class: 'small', title: 'Use for charts', onclick: () => { app.store.set('theme.chart.palette', name, null); panel.sync(); } }, 'Charts'),
      cols.length > 4 ? h('button', { class: 'small', title: 'Use first colour as accent', onclick: () => { app.store.set('theme.colors.accent', cols[0], null); app.store.set('theme.sources.showIndex', true, null); } }, 'Accent') : null));
  });
  panel.add(pal);

  function refresh() {
    const stage = document.getElementById('stage'); const s = app.store.get(), cv = s.canvas;
    const hgt = stage.offsetHeight, wcm = cv.physicalCm, hcm = (hgt / cv.width) * wcm;
    const dpi = effectiveDpi(cv.width, cv.exportScale, wcm);
    geo.innerHTML = `Canvas <b>${cv.width} × ${hgt} px</b> → printed <b>${wcm.toFixed(1)} × ${hcm.toFixed(1)} cm</b><br>Export <b>${Math.round(cv.width * cv.exportScale)} × ${Math.round(hgt * cv.exportScale)} px</b> → <b>${Math.round(dpi)} dpi</b> ${dpi >= 300 ? '✔ print quality' : dpi >= 150 ? '(OK for posters viewed at distance)' : '⚠ low – raise export scale'}`;
    const r = scanStage(stage, s);
    out.innerHTML = '';
    const rep = h('div', { class: 'report' });
    r.cats.forEach(c => rep.append(h('div', { class: 'rep-row' }, h('span', { class: 'badge ' + c.lvl }, c.pt.toFixed(1) + ' pt'), h('span', { class: 'grow' }, c.name, h('small', {}, `smallest: “${c.sample}” · ${c.minPx.toFixed(1)} px`)))));
    out.append(rep, h('h3', {}, 'Contrast (WCAG)'));
    const cr = h('div', { class: 'report' });
    r.contrast.forEach(c => { const lvl = wcagLevel(c.ratio, c.large); cr.append(h('div', { class: 'rep-row' }, h('span', { class: 'badge ' + (lvl === 'fail' ? 'bad' : lvl === 'AA' ? 'warn' : 'ok') }, c.ratio.toFixed(1) + ':1'), h('span', { class: 'grow' }, c.name, h('small', {}, lvl === 'fail' ? 'below WCAG AA — hard to read on a poster' : lvl + (c.large ? ' (large text)' : ''))))); });
    out.append(cr);
  }
  setTimeout(refresh, 50);
  return { panel, api: { refresh } };
}
