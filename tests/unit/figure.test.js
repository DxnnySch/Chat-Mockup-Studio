import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChart, linreg } from '../../src/chartMath.js';
import { correlatedSeries, timeSeriesCsv, scatterCsv, rng } from '../../src/synth.js';
import { sanitizeSvg } from '../../src/sanitizeSvg.js';
import { parseFigureJson, cleanOutput } from '../../src/aiPrompts.js';
import { chartSvg } from '../../src/render/charts.js';
import { renderBlock } from '../../src/render/blocks.js';
import { baseTheme, newProject } from '../../src/defaults.js';

test('linreg: perfect line, constant x, too few points', () => {
  const r = linreg([{ x: 1, y: 3 }, { x: 2, y: 5 }, { x: 3, y: 7 }]);
  assert.ok(Math.abs(r.slope - 2) < 1e-9 && Math.abs(r.intercept - 1) < 1e-9 && Math.abs(r.r - 1) < 1e-9);
  assert.equal(linreg([{ x: 1, y: 1 }, { x: 1, y: 2 }]), null); assert.equal(linreg([{ x: 1, y: 1 }]), null);
  assert.ok(linreg([{ x: 1, y: 3 }, { x: 2, y: 2 }, { x: 3, y: 1 }]).r < -0.999);
});

test('buildChart: @right axis, label column, numeric x domain, error columns', () => {
  const m = buildChart({ type: 'line', csv: 'Year,Ice (Mkm2),Wave@right,Note@label\n1980,1.0,5,a\n1981,0.5,7,b\n1982,0.2,9,c' });
  assert.equal(m.series.length, 2); assert.equal(m.series[1].axis, 'right'); assert.equal(m.series[1].name, 'Wave');
  assert.ok(m.y2Ticks && m.hasLabels); assert.equal(m.series[0].points[1].label, 'b');
  assert.deepEqual(m.x, [1980, 1982]); assert.ok(m.xTicks.every(t => t >= 1980 && t <= 1982));
  assert.ok(m.series[0].reg.slope < 0);
  const allRight = buildChart({ type: 'line', csv: 'x,a@right\n1,2\n2,3' }); assert.equal(allRight.y2Ticks, null);
  const err = buildChart({ type: 'bar', csv: 'm,acc@right,acc±\nA,1,.1\nB,2,.2' });
  assert.equal(err.series.length, 1); assert.equal(err.series[0].points[0].err, 0.1);
});

test('synth: exact target correlation, deterministic, valid ranges', () => {
  for (const rho of [-0.8, -0.3, 0, 0.6]) {
    const s = correlatedSeries({ rho, seed: 3 });
    assert.equal(s.years.length, 42);
    const r = linreg(s.years.map((_, i) => ({ x: s.b[i], y: s.a[i] }))).r;
    assert.ok(Math.abs(r - rho) < 0.02, `rho ${rho} got ${r}`);
  }
  assert.deepEqual(correlatedSeries({ seed: 5 }), correlatedSeries({ seed: 5 }));
  assert.notDeepEqual(correlatedSeries({ seed: 5 }).a, correlatedSeries({ seed: 6 }).a);
  assert.ok(correlatedSeries({ from: 2020, to: 1900 }).years.length >= 4);            // reversed range is clamped
  const s = correlatedSeries({ rho: 5 }); assert.ok(s.a.every(Number.isFinite) && s.b.every(Number.isFinite));
  assert.ok(rng(1)() >= 0);
  assert.match(timeSeriesCsv(s, 'A', 'B'), /^Year,A,B@right\n1979,/); assert.match(scatterCsv(s, 'X', 'Y'), /^X,Y,Year@label\n/);
});

test('chartSvg: dual axis, trend, r with proper minus sign, labels; bad data → placeholder', () => {
  const s = correlatedSeries({ rho: -0.6, seed: 2 });
  const theme = baseTheme();
  const sc = chartSvg({ chartType: 'scatter', csv: scatterCsv(s), trend: true, showR: true, showN: true, labelPoints: true, labelEvery: 5, height: 260 }, { width: 400, fs: 22, theme });
  assert.match(sc, /class="ch-trend"/); assert.match(sc, /−\s*0\.60|r<\/tspan> = −0\.6/); assert.match(sc, /n = 42/);
  const ts = chartSvg({ chartType: 'line', csv: timeSeriesCsv(s, 'A', 'B'), y2Label: 'B axis', legend: true, zeroLine: true, height: 260 }, { width: 400, fs: 22, theme });
  assert.match(ts, /\(right\)/); assert.match(ts, /rotate\(90\)/);
  assert.match(chartSvg({ chartType: 'scatter', csv: 'nope' }, { width: 300, fs: 20, theme }), /blk-placeholder/);
  assert.match(chartSvg({ chartType: 'scatter', csv: 'x,y\n1,1\n1,2\n1,3', trend: true, showR: true }, { width: 300, fs: 20, theme }), /<svg/);   // constant x must not throw
  assert.match(chartSvg({ chartType: 'scatter', csv: scatterCsv(s), statText: 'r = −0.58, p < 0.001' }, { width: 400, fs: 22, theme }), /p &lt; 0\.001/);
});

test('sanitizeSvg strips active content and keeps drawing primitives', () => {
  const evil = '<svg width="200" height="100" onload="alert(1)"><script>alert(1)</script><style>*{x:url(http://e)}</style>'
    + '<foreignObject><div>hi</div></foreignObject><a href="javascript:alert(1)"><rect id="r" width="10" height="10" fill="url(http://evil/x)" onclick="x()"/></a>'
    + '<image href="data:image/png;base64,AAAA"/><use href="#r"/><g><circle cx="5" cy="5" r="3" fill="#f00"/><text x="1" y="2" font-size="20">A &amp; B</text></g></svg>';
  const out = sanitizeSvg(evil);
  for (const bad of ['script', 'onload', 'onclick', 'foreignObject', 'javascript', 'http://evil', '<style', '<image', '<use', 'data:']) assert.ok(!out.includes(bad), bad + ' survived: ' + out);
  assert.ok(out.includes('<circle') && out.includes('<text') && out.includes('A &amp; B') && out.includes('viewBox="0 0 200 100"'));
  assert.ok(out.startsWith('<svg') && out.endsWith('</svg>'));
  assert.throws(() => sanitizeSvg('<div>no svg</div>')); assert.throws(() => sanitizeSvg('x'.repeat(400000) + '<svg></svg>'));
  assert.ok(sanitizeSvg('<svg><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></svg>').includes('linearGradient'));
  assert.ok(sanitizeSvg('<svg><path d="M0 0L5 5" fill="url(#g)"/></svg>').includes('url(#g)'));
});

test('parseFigureJson validates and normalises', () => {
  const f = parseFigureJson('Here you go:\n```json\n{"title":"T","layout":"weird","panels":[{"title":"a","chartType":"nope","csv":"x,y\\n1,2\\n2,3","trend":true,"showR":"true","labelEvery":"5"},{"csv":"no newline"},{"title":"bad"}]}\n```');
  assert.equal(f.layout, 'row'); assert.equal(f.panels.length, 1); assert.equal(f.panels[0].chartType, 'line');
  assert.equal(f.panels[0].showR, true); assert.equal(f.panels[0].labelEvery, 5);
  assert.throws(() => parseFigureJson('nothing')); assert.throws(() => parseFigureJson('{"panels":[]}')); assert.throws(() => parseFigureJson('{"panels":[{"csv":"x"}]}')); assert.throws(() => parseFigureJson('{broken'));
  assert.equal(cleanOutput('Sure!\n<svg viewBox="0 0 1 1"></svg>\nDone.', 'svg'), '<svg viewBox="0 0 1 1"></svg>');
});

test('parseFigureJson expands the synthetic generator spec (cheap LLM output, exact r)', () => {
  const f = parseFigureJson(JSON.stringify({ title: 'T', caption: 'c', synthetic: { from: 1979, to: 2020, rho: -0.55, seed: 4, aName: 'Ice anomaly', aUnit: '10^6 km2', aMean: 0, aTrend: -1.5, aNoise: 0.5, bName: 'Waviness', bUnit: 'idx', bMean: 1, bSd: 0.2 },
    panels: [{ title: '(a) Time series', source: 'timeseries' }, { title: 'Scatter', source: 'scatter' }, { title: 'bad source without data', source: 'nope' }] }));
  assert.equal(f.panels.length, 2); assert.equal(f.panels[0].title, 'Time series');           // "(a)" prefix stripped
  assert.match(f.panels[0].csv, /^Year,Ice anomaly \(10\^6 km2\),Waviness \(idx\)@right\n1979,/); assert.equal(f.panels[0].csv.split('\n').length, 43);
  assert.equal(f.panels[1].chartType, 'scatter'); assert.ok(f.panels[1].trend && f.panels[1].showR && f.panels[1].labelPoints);
  const m = buildChart({ type: 'scatter', csv: f.panels[1].csv });
  assert.ok(Math.abs(m.series[0].reg.r + 0.55) < 0.02, 'r = ' + m.series[0].reg.r);
  // hostile / absurd numbers are clamped, not trusted
  const g = parseFigureJson(JSON.stringify({ synthetic: { from: -5, to: 99999, rho: 7, aNoise: 0, seed: 'x' }, panels: [{ source: 'scatter' }] }));
  assert.ok(g.panels[0].csv.split('\n').length <= 252);
  assert.throws(() => parseFigureJson(JSON.stringify({ panels: [{ source: 'scatter' }] })));       // source without synthetic
});

test('figure + svg blocks render (and survive junk)', () => {
  const p = newProject(); const ctx = { project: p, theme: p.theme, fs: 22, availW: 700 };
  const fig = p.messages[1].blocks.find(b => b.type === 'text'); assert.ok(fig);
  const html = renderBlock({ id: 'f', type: 'figure', layout: 'row', caption: 'c', panels: [{ title: 'A', chartType: 'line', csv: 'x,y\n1,2\n2,3' }, { title: 'B', chartType: 'scatter', csv: 'x,y\n1,2\n2,3', trend: true, showR: true }] }, ctx);
  assert.match(html, /\(a\)/); assert.match(html, /\(b\)/); assert.equal((html.match(/chart-svg/g) || []).length, 2); assert.match(html, /repeat\(2,/);
  assert.match(renderBlock({ id: 'f', type: 'figure', panels: [] }, ctx), /without panels/);
  assert.match(renderBlock({ id: 's', type: 'svg', code: '<svg viewBox="0 0 10 10"><rect width="5" height="5"/></svg>' }, ctx), /<rect/);
  assert.match(renderBlock({ id: 's', type: 'svg', code: 'garbage' }, ctx), /No &lt;svg&gt;/);
});
