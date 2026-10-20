// Dialog: generate correlated synthetic yearly data and fill a two-panel figure (time series + scatter with trend and r).
import { app } from './app.js';
import { h } from './fields.js';
import { correlatedSeries, timeSeriesCsv, scatterCsv } from '../synth.js';
import { linreg } from '../chartMath.js';
import { fmtR } from '../render/charts.js';

const DEFAULTS = {
  from: 1979, to: 2020, seed: 11, rho: -0.55,
  aName: 'Sea-ice anomaly', aUnit: '10⁶ km²', aMean: 0, aTrend: -1.8, aNoise: 0.45,
  bName: 'Jet waviness', bUnit: 'index', bMean: 1.2, bSd: 0.25,
  titleA: 'Sea-ice anomaly and jet waviness, 1979–2020', titleB: 'Low-ice years vs. wavier jet', scatter: true,
};

/** apply({ panels, layout }) receives the new figure panels. */
export function openSynth({ apply }) {
  document.querySelector('.ai-overlay')?.remove();
  const v = { ...DEFAULTS };
  const inputs = {};
  const row = (key, label, type = 'text', extra = {}) => {
    const i = h('input', { type, spellcheck: 'false', ...extra });
    if (type === 'checkbox') { i.checked = !!v[key]; i.addEventListener('change', () => { v[key] = i.checked; update(); }); }
    else { i.value = v[key]; i.addEventListener('input', () => { v[key] = type === 'number' ? parseFloat(i.value) : i.value; update(); }); }
    inputs[key] = i;
    return h('div', { class: 'fld' }, h('label', {}, label), h('div', { class: 'ctl' }, i));
  };
  const info = h('div', { class: 'note' });
  const build = () => {
    const s = correlatedSeries({ from: +v.from, to: +v.to, rho: +v.rho, seed: +v.seed, a: { mean: +v.aMean, trend: +v.aTrend, noise: +v.aNoise }, b: { mean: +v.bMean, sd: +v.bSd } });
    const nameA = `${v.aName} (${v.aUnit})`, nameB = `${v.bName} (${v.bUnit})`;
    const panels = [{
      title: v.titleA, chartType: 'line', csv: timeSeriesCsv(s, nameA, nameB), xLabel: 'Year', yLabel: nameA, y2Label: nameB, zeroLine: true, legend: true,
    }];
    if (v.scatter) panels.push({
      title: v.titleB, chartType: 'scatter', csv: scatterCsv(s, nameB, nameA), xLabel: nameB, yLabel: nameA, trend: true, showR: true, showN: true, labelPoints: true, labelEvery: 5, zeroLine: true,
    });
    return { panels, layout: 'row', stats: linreg(s.years.map((_, i) => ({ x: s.b[i], y: s.a[i] }))) };
  };
  const update = () => { try { const r = build().stats; info.textContent = r ? `Resulting sample correlation: r = ${fmtR(r.r)} (n = ${r.n}) — set exactly by “Target r”.` : 'Check the inputs.'; } catch { info.textContent = 'Check the inputs.'; } };

  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const dlg = h('div', { class: 'ai-dialog', role: 'dialog', 'aria-label': 'Synthetic data' },
    h('div', { class: 'ai-head' }, h('b', {}, '🎲 Synthetic correlated data'), h('span', { class: 'ai-sub' }, 'two panels: time series (dual axis) + scatter with trend & r'), h('button', { class: 'small ghost', onclick: close }, '✕')),
    h('div', { class: 'note' }, 'Generates plausible, clearly fake yearly data with an exact target correlation. No LLM needed — same seed, same figure.'),
    row('from', 'From year', 'number'), row('to', 'To year', 'number'),
    row('aName', 'Series A (left axis)'), row('aUnit', 'A unit'), row('aMean', 'A mean', 'number', { step: 0.1 }), row('aTrend', 'A total change', 'number', { step: 0.1 }), row('aNoise', 'A noise (σ)', 'number', { step: 0.05 }),
    row('bName', 'Series B (right axis)'), row('bUnit', 'B unit'), row('bMean', 'B mean', 'number', { step: 0.1 }), row('bSd', 'B spread (σ)', 'number', { step: 0.05 }),
    row('rho', 'Target r (A vs B)', 'number', { min: -0.99, max: 0.99, step: 0.05 }), row('seed', 'Random seed', 'number'),
    row('titleA', 'Panel (a) title'), row('scatter', 'Add scatter panel (b)', 'checkbox'), row('titleB', 'Panel (b) title'),
    info,
    h('div', { class: 'row' },
      h('button', { class: 'primary', onclick: () => { try { apply(build()); close(); app.toast('Figure data generated — Ctrl+Z to undo'); } catch (e) { app.toast(e.message, true); } } }, 'Apply to figure'),
      h('button', { onclick: () => { v.seed = Math.floor(Math.random() * 9999); inputs.seed.value = v.seed; update(); } }, '🎲 New seed'),
      h('button', { onclick: close }, 'Cancel')));
  const overlay = h('div', { class: 'ai-overlay', onmousedown: (e) => { if (e.target === overlay) close(); } }, dlg);
  document.body.append(overlay); document.addEventListener('keydown', onKey);
  update();
}
