// Annotation layer: list/editor (Notes tab) + drag interaction on the stage.
import { app } from './app.js';
import { h, Panel } from './fields.js';
import { uid } from '../util.js';
import { rebuildRight } from './inspector.js';

const NEW = {
  badge: { type: 'badge', text: 'A', x: 24, y: 120, color: '#d62728', size: 44 },
  label: { type: 'label', text: 'Key finding', x: 60, y: 200, color: '#d62728', textColor: '#ffffff', bg: '', size: 24 },
  arrow: { type: 'arrow', x: 160, y: 260, x2: 300, y2: 260, color: '#d62728', strokeWidth: 6 },
  box: { type: 'box', x: 40, y: 140, w: 360, h: 120, color: '#d62728', strokeWidth: 5, radius: 14, dashed: false, fill: false },
};
const idx = () => app.store.get().annotations.findIndex(a => a.id === app.sel.anno);

export function buildNotes() {
  const p = new Panel();
  const st = app.store.get();
  p.add(h('div', { class: 'note' }, 'Add numbered badges, labels, arrows and highlight boxes. Drag them on the canvas (arrows: drag the tip to re-aim). Annotations are part of every export — hide them by deleting or via “Preview”.'));
  p.add(h('div', { class: 'row' }, Object.keys(NEW).map(t => h('button', { onclick: () => {
    const a = { id: uid('n'), ...JSON.parse(JSON.stringify(NEW[t])) };
    app.store.update(s => s.annotations.push(a)); app.select({ anno: a.id }); rebuildRight();
  } }, '+ ' + t[0].toUpperCase() + t.slice(1)))));
  st.annotations.forEach(a => p.add(h('div', { class: 'msg-item' + (a.id === app.sel.anno ? ' sel' : ''), onclick: () => { app.select({ anno: a.id }); rebuildRight(); } },
    h('span', { class: 'role', style: `background:${a.color || '#d62728'}` }, a.type[0].toUpperCase()), h('span', { class: 'snip' }, a.text || a.type),
    h('button', { class: 'small ghost danger', onclick: (e) => { e.stopPropagation(); app.store.update(s => (s.annotations = s.annotations.filter(x => x.id !== a.id))); rebuildRight(); } }, '✕'))));
  const i = idx();
  if (i >= 0) {
    const a = st.annotations[i], P = (k) => `annotations.${i}.${k}`;
    p.add(h('h3', {}, 'Selected annotation'));
    const defs = [{ path: P('color'), label: 'Colour', type: 'color' }];
    if (a.type !== 'arrow' && a.type !== 'box') defs.unshift({ path: P('text'), label: 'Text', type: 'text' });
    if (a.type === 'label') defs.push({ path: P('textColor'), label: 'Text colour', type: 'color' }, { path: P('bg'), label: 'Fill (blank = colour)', type: 'color' }, { path: P('border'), label: 'Outline', type: 'toggle' }, { path: P('w'), label: 'Fixed width', type: 'number' });
    if (a.type === 'badge' || a.type === 'label') defs.push({ path: P('size'), label: 'Size (px)', type: 'range', min: 12, max: 160 });
    if (a.type === 'arrow') defs.push({ path: P('strokeWidth'), label: 'Thickness', type: 'range', min: 1, max: 24 }, { path: P('x2'), label: 'Tip X', type: 'number' }, { path: P('y2'), label: 'Tip Y', type: 'number' });
    if (a.type === 'box') defs.push({ path: P('w'), label: 'Width', type: 'number' }, { path: P('h'), label: 'Height', type: 'number' }, { path: P('strokeWidth'), label: 'Thickness', type: 'range', min: 1, max: 24 }, { path: P('radius'), label: 'Radius', type: 'range', min: 0, max: 60 }, { path: P('dashed'), label: 'Dashed', type: 'toggle' }, { path: P('fill'), label: 'Tinted fill', type: 'toggle' });
    defs.push({ path: P('x'), label: a.type === 'arrow' ? 'Tail X' : 'X', type: 'number' }, { path: P('y'), label: a.type === 'arrow' ? 'Tail Y' : 'Y', type: 'number' });
    const g = h('div', {}); defs.forEach(d => g.append(p.field(d)));
    p.add(g);
  }
  return p;
}

/** Pointer-based dragging of annotations inside the stage. `getZoom()` converts screen → stage px. */
export function installAnnotationDrag(stage, getZoom) {
  let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    if (!stage.classList.contains('editing')) return;
    const el = e.target.closest?.('[data-aid]'); if (!el) return;
    const id = el.dataset.aid; const s = app.store.get();
    const i = s.annotations.findIndex(a => a.id === id); if (i < 0) return;
    e.preventDefault(); e.stopPropagation();
    const a = s.annotations[i]; const z = getZoom();
    const r = stage.getBoundingClientRect();
    const px = (e.clientX - r.left) / z, py = (e.clientY - r.top) / z;
    const tip = a.type === 'arrow' && Math.hypot(px - a.x2, py - a.y2) < 26;
    drag = { i, id, px, py, a: { ...a }, tip };
    stage.setPointerCapture(e.pointerId);
    app.select({ anno: id }); rebuildRight();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const z = getZoom(), r = stage.getBoundingClientRect();
    const dx = (e.clientX - r.left) / z - drag.px, dy = (e.clientY - r.top) / z - drag.py, o = drag.a;
    const R = Math.round;
    app.store.update(s => {
      const a = s.annotations[drag.i]; if (!a) return;
      if (drag.tip) { a.x2 = R(o.x2 + dx); a.y2 = R(o.y2 + dy); }
      else { a.x = R(o.x + dx); a.y = R(o.y + dy); if (a.type === 'arrow') { a.x2 = R(o.x2 + dx); a.y2 = R(o.y2 + dy); } }
    }, 'drag:' + drag.id);
  });
  const end = (e) => { if (drag) { drag = null; try { stage.releasePointerCapture(e.pointerId); } catch { /* ignore */ } rebuildRight(); } };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
}
