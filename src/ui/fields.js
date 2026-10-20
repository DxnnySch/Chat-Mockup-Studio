// Schema-driven form controls bound to store paths.
import { app, addAsset } from './app.js';
import { getPath, delPath } from '../util.js';
import { parseColor, toHex, PALETTES } from '../color.js';
import { FONT_STACKS } from '../defaults.js';
import { esc } from '../markdown.js';
import { openAi } from './ai.js';
import { parseFieldPath } from '../aiPrompts.js';

const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, ''); else if (v !== false && v != null) e.setAttribute(k, v);
  }
  kids.flat().forEach(k => k != null && e.append(k.nodeType ? k : document.createTextNode(k)));
  return e;
};
export { h };

// Open/closed state of collapsible groups survives panel rebuilds (keyed by scope + title).
const openGroups = new Map();
let scope = 'x';
export const setScope = (s) => { scope = s; };
export function grp(title, bodyEl, dflt = false, key = title) {
  const k = scope + ':' + key;
  const d = h('details', { class: 'grp' }, h('summary', {}, title), bodyEl);
  d.open = openGroups.has(k) ? openGroups.get(k) : dflt;
  d.addEventListener('toggle', () => openGroups.set(k, d.open));
  return d;
}

const norm = (o) => o.map(x => (Array.isArray(x) ? x : [x, x]));

/** Panel = a container that owns a set of bound fields and keeps them in sync with the store. */
export class Panel {
  constructor() { this.el = h('div', { class: 'pane' }); this.syncs = []; }
  add(node) { this.el.append(node); return node; }
  group(title, defs, open = false) {
    const body = h('div', { class: 'grp-body' });
    defs.forEach(d => body.append(this.field(d)));
    const g = grp(title, body, open);
    this.el.append(g); return g;
  }
  field(def) { const f = makeField(def); this.syncs.push(f.sync); f.sync(); return f.el; }
  sync() { this.syncs.forEach(fn => fn()); }
}

export function makeField(def) {
  const { path, label, type = 'text', hint, fallback, clearable } = def;
  const store = app.store;
  const read = () => {
    if (def.get) return def.get(store.get());
    const v = getPath(store.get(), path);
    return v === undefined && fallback ? getPath(store.get(), fallback) : v;
  };
  const write = (v) => (def.onWrite ? def.onWrite(v) : store.set(path, v, 'f:' + path));
  const own = () => getPath(store.get(), path) !== undefined;
  let ctl, sync;

  if (type === 'text' || type === 'number') {
    const inp = h('input', { type: type === 'number' ? 'number' : 'text', spellcheck: 'false', min: def.min, max: def.max, step: def.step, placeholder: def.placeholder });
    inp.addEventListener('input', () => { if (type === 'number') { if (inp.value !== '') write(parseFloat(inp.value)); } else write(inp.value); });
    sync = () => { if (document.activeElement !== inp) inp.value = read() ?? ''; };
    ctl = [inp];
  } else if (type === 'area') {
    const ta = h('textarea', { rows: def.rows || 4, spellcheck: 'false', placeholder: def.placeholder });
    ta.addEventListener('input', () => write(ta.value));
    sync = () => { if (document.activeElement !== ta) ta.value = read() ?? ''; };
    ctl = [ta];
  } else if (type === 'lines') {
    const ta = h('textarea', { rows: def.rows || 3, spellcheck: 'false' });
    ta.addEventListener('input', () => write(ta.value.split('\n').filter(l => l.trim())));
    sync = () => { if (document.activeElement !== ta) ta.value = (read() || []).join('\n'); };
    ctl = [ta];
  } else if (type === 'range') {
    const r = h('input', { type: 'range', min: def.min, max: def.max, step: def.step || 1 });
    const n = h('input', { type: 'number', class: 'rv', min: def.min, max: def.max, step: def.step || 1 });
    r.addEventListener('input', () => { n.value = r.value; write(parseFloat(r.value)); });
    n.addEventListener('input', () => { if (n.value !== '') { r.value = n.value; write(parseFloat(n.value)); } });
    sync = () => { const v = read(); r.value = v ?? def.min; if (document.activeElement !== n) n.value = v ?? ''; };
    ctl = [r, n];
  } else if (type === 'color') {
    const c = h('input', { type: 'color' });
    const t = h('input', { type: 'text', spellcheck: 'false' });
    c.addEventListener('input', () => { t.value = c.value; write(c.value); });
    t.addEventListener('input', () => { const p = parseColor(t.value); if (p && p.a === 1) c.value = toHex(p); write(t.value); });
    sync = () => { const v = read() ?? ''; const p = parseColor(v); c.value = p ? toHex(p) : '#000000'; if (document.activeElement !== t) t.value = v; };
    ctl = [c, t];
  } else if (type === 'select') {
    const opts = norm(def.options || []);
    const s = h('select', {}, opts.map(([v, l]) => h('option', { value: v }, l)));
    s.addEventListener('change', () => { const o = opts.find(x => String(x[0]) === s.value); write(typeof o[0] === 'number' ? +s.value : s.value); });
    sync = () => { const v = read(); s.value = v ?? ''; if (v == null) s.selectedIndex = 0; if (s.value !== String(v ?? '') && v != null) { s.append(h('option', { value: v }, String(v))); s.value = v; } };
    ctl = [s];
  } else if (type === 'toggle') {
    const c = h('input', { type: 'checkbox' });
    c.addEventListener('change', () => write(c.checked));
    sync = () => { c.checked = !!read(); };
    ctl = [c];
  } else if (type === 'checks') {
    const opts = norm(def.options);
    const boxes = opts.map(([v, l]) => {
      const c = h('input', { type: 'checkbox' });
      c.addEventListener('change', () => { const cur = new Set(read() || []); c.checked ? cur.add(v) : cur.delete(v); write(opts.map(o => o[0]).filter(k => cur.has(k))); });
      return [c, v, h('label', {}, c, l)];
    });
    sync = () => { const cur = new Set(read() || []); boxes.forEach(([c, v]) => (c.checked = cur.has(v))); };
    ctl = [h('div', { class: 'check-list' }, boxes.map(b => b[2]))];
  } else if (type === 'font') {
    const fonts = [...Object.entries(FONT_STACKS), ...(store.get().fonts || []).map(f => [f.name + ' (uploaded)', `"${f.name}", sans-serif`])];
    const s = h('select', {}, h('option', { value: '' }, 'Custom…'), fonts.map(([n, v]) => h('option', { value: v }, n)));
    const t = h('input', { type: 'text', spellcheck: 'false', placeholder: 'CSS font-family, e.g. "Inter", sans-serif' });
    s.addEventListener('change', () => { if (s.value) { t.value = s.value; write(s.value); } });
    t.addEventListener('input', () => { write(t.value); const m = fonts.find(f => f[1] === t.value); s.value = m ? m[1] : ''; });
    sync = () => { const v = read() ?? ''; s.value = fonts.find(f => f[1] === v) ? v : ''; if (document.activeElement !== t) t.value = v; };
    ctl = [h('div', { style: 'display:flex;flex-direction:column;gap:4px;width:100%' }, s, t)];
  } else if (type === 'palette') {
    const s = h('select', {}, Object.keys(PALETTES).map(n => h('option', { value: n }, n)));
    const sw = h('span', { class: 'swatches' });
    s.addEventListener('change', () => write(s.value));
    sync = () => { const v = read() ?? 'Okabe-Ito'; s.value = v; sw.innerHTML = (PALETTES[v] || []).map(c => `<i style="background:${esc(c)}"></i>`).join(''); };
    ctl = [s, sw];
  } else if (type === 'image') {
    const t = h('input', { type: 'text', spellcheck: 'false', placeholder: 'URL or upload →' });
    const f = h('input', { type: 'file', accept: def.accept || 'image/*', hidden: true });
    const b = h('button', { class: 'small', type: 'button', onclick: () => f.click() }, 'Upload');
    const x = h('button', { class: 'small ghost clear-x', type: 'button', title: 'Remove', onclick: () => { write(''); } }, '✕');
    t.addEventListener('input', () => write(t.value));
    f.addEventListener('change', async () => {
      if (!f.files[0]) return;
      try { write(await addAsset(f.files[0])); def.onUpload?.(f.files[0]); } catch (e) { app.toast('Upload failed: ' + e.message, true); }
      f.value = '';
    });
    sync = () => { const v = read() ?? ''; if (document.activeElement !== t) t.value = String(v).startsWith('asset:') ? '[uploaded image]' : v; };
    ctl = [t, b, x, f];
  }

  const wide = def.wide || type === 'area' || type === 'lines';
  const aiOn = def.ai === false ? false : (!!def.ai || type === 'area' || type === 'lines');
  let btn = null;
  if (aiOn) {
    btn = h('button', { class: 'ai-btn small', type: 'button', title: 'Generate or reformat this with AI', onclick: () => {
      const st = store.get(); const { msgIndex } = parseFieldPath(path);
      const role = msgIndex != null ? (st.messages[msgIndex]?.role === 'user' ? 'user' : 'assistant') : null;
      const cur = type === 'lines' ? (read() || []).join('\n') : (read() ?? '');
      openAi({ label: def.label || def.aiLabel || path, kind: def.aiKind || (type === 'lines' ? 'lines' : type === 'text' ? 'plain' : 'plain-multi'), role,
        lang: def.aiLangPath ? getPath(st, def.aiLangPath, '') : '', current: String(cur), msgIndex,
        apply: (t) => { write(type === 'lines' ? t.split('\n').filter(l => l.trim()) : t); sync(); } });
    } }, '✨ AI');
    if (!wide) ctl.push(btn);
  }
  const row = wide && aiOn
    ? h('div', { class: 'fld wide' }, h('div', { class: 'fld-head' }, h('label', {}, label || def.aiLabel || ''), btn), h('div', { class: 'ctl' }, ctl))
    : h('div', { class: 'fld' + (wide ? ' wide' : '') }, label ? h('label', {}, label) : null, h('div', { class: 'ctl' }, ctl));
  if (clearable) {
    const x = h('button', { class: 'small ghost clear-x', type: 'button', title: 'Reset to inherited value', onclick: () => { store.update(s => delPath(s, path)); app.rebuildPanels?.(); } }, '↺');
    row.querySelector('.ctl').append(x);
    const base = sync; sync = () => { base(); row.style.opacity = own() ? 1 : .6; };
  }
  if (hint) row.append(h('div', { class: 'hint' }, hint));
  return { el: row, sync };
}
