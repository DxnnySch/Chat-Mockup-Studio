import test from 'node:test';
import assert from 'node:assert/strict';
import { markdown, inline } from '../../src/markdown.js';
import { parseDiagram, layoutDiagram } from '../../src/diagramLayout.js';
import { buildChart, niceTicks, parseCSV } from '../../src/chartMath.js';
import { contrast, parseColor, readableOn } from '../../src/color.js';
import { effectivePt, effectiveDpi, level } from '../../src/readability.js';

test('markdown escapes raw HTML', () => {
  const h = markdown('<script>alert(1)</script> **x**');
  assert.ok(!h.includes('<script>')); assert.ok(h.includes('<strong>x</strong>'));
});
test('markdown handles unterminated emphasis and prices', () => {
  assert.doesNotThrow(() => markdown('**bold and $5 and $6 *x'));
  assert.ok(!markdown('costs $5 and $6').includes('class="math"'));
});
test('markdown citations, math, lists, code', () => {
  assert.match(inline('see [1, 2]'), /<sup class="cite" data-n="1">1<\/sup><sup class="cite" data-n="2">2<\/sup>/);
  assert.match(inline('$E=mc^2$'), /class="math" data-tex="E=mc\^2"/);
  assert.match(markdown('- a\n- b'), /<ul><li>a<\/li><li>b<\/li><\/ul>/);
  assert.match(markdown('```py\nx<1\n```'), /x&lt;1/);
});
test('markdown blocks javascript: links', () => {
  assert.ok(inline('[x](javascript:alert(1))').includes('href="#"'));
});
test('diagram: parse + layout + cycle terminates', () => {
  const p = parseDiagram('A[Start] --> B{Ok?} : yes\nB --> C\nC --> A');
  assert.equal(p.nodes.length, 3);
  const l = layoutDiagram(p);
  assert.equal(l.edges.length, 3);
  assert.ok(l.edges.some(e => e.back));
  assert.ok(l.width > 0 && l.height > 0);
});
test('diagram: empty / garbage input', () => {
  assert.deepEqual(layoutDiagram(parseDiagram('')).nodes, []);
  assert.doesNotThrow(() => layoutDiagram(parseDiagram('!!! --> ???\nA --> A')));
});
test('chart: parse, errors, bad csv', () => {
  const c = buildChart({ type: 'bar', csv: 'm,acc,acc±\nA,0.8,0.05\nB,0.9,0.02' });
  assert.equal(c.series.length, 1); assert.equal(c.series[0].points[0].err, 0.05);
  assert.ok(buildChart({ csv: '' }).error); assert.ok(buildChart({ csv: 'a,b\nx,y' }).error);
  assert.deepEqual(niceTicks(0, 1, 5).slice(0, 2), [0, 0.2]);
  assert.equal(parseCSV('a,"b,c"\n1,2')[0][1], 'b,c');
});
test('color contrast', () => {
  assert.equal(Math.round(contrast(parseColor('#000'), parseColor('#fff'))), 21);
  assert.equal(readableOn('#000000'), '#ffffff');
  assert.equal(parseColor('rgba(0,0,0,0.5)').a, 0.5);
});
test('readability maths', () => {
  assert.ok(Math.abs(effectivePt(32, 1000, (1000 / 96) * 2.54) - 24) < 1e-6);
  assert.equal(level(24), 'ok'); assert.equal(level(20), 'warn'); assert.equal(level(10), 'bad');
  assert.ok(Math.abs(effectiveDpi(1000, 3, 2.54) - 3000) < 1e-6);
});
