// Right panel: Style / Canvas / People / Poster / Notes / JSON tabs.
import { app, readFile } from './app.js';
import { h, Panel, setScope } from './fields.js';
import { PRESETS } from '../presets.js';
import { baseCanvas, baseChrome, baseTheme, ICONS, normalizeProject, newProject, baseParticipants } from '../defaults.js';
import { merge, clone, uid } from '../util.js';
import { kvGet, kvSet, kvKeys, kvDel } from '../state.js';
import { buildPoster } from './poster.js';
import { buildNotes } from './annotations.js';

const TABS = [['style', 'Style'], ['canvas', 'Canvas'], ['people', 'People'], ['poster', 'Poster'], ['notes', 'Notes'], ['json', 'JSON']];
let active = 'style', root, body, posterApi;

export function buildRight(el) {
  root = el; render();
}
export function rebuildRight() { render(); }
export function setTab(t) { active = t; render(); }
export function refreshPoster() { posterApi?.refresh?.(); }

function render() {
  const keep = root.scrollTop;
  setScope('r:' + active);
  root.innerHTML = '';
  const tabs = h('div', { class: 'tabs' }, TABS.map(([k, l]) => h('button', { class: 'tab' + (k === active ? ' active' : ''), onclick: () => { active = k; render(); } }, l)));
  body = h('div', {});
  root.append(tabs, body);
  posterApi = null;
  const panel = ({ style: styleTab, canvas: canvasTab, people: peopleTab, poster: posterTab, notes: notesTab, json: jsonTab })[active]();
  body.append(panel.el);
  root.scrollTop = keep;
  if (panel.sync) {
    const unsub = app.store.subscribe((_, meta) => { if (!panel.el.isConnected) { unsub(); return; } if (!meta.replaced) panel.sync(); });
  }
}

const T = (path, label, type, extra = {}) => ({ path, label, type, ...extra });
const R = (path, label, min, max, step = 1, extra = {}) => ({ path, label, type: 'range', min, max, step, ...extra });
const SHADOWS = ['none', 'sm', 'md', 'lg'];
const roleDefs = (r) => [
  T(`theme.${r}.layout`, 'Layout', 'select', { options: [['bubble', 'Bubble'], ['plain', 'Plain (no box)'], ['card', 'Card']] }),
  T(`theme.${r}.align`, 'Align', 'select', { options: [['left', 'Left'], ['right', 'Right'], ['center', 'Center']] }),
  T(`theme.${r}.bg`, 'Background', 'color'), T(`theme.${r}.color`, 'Text colour', 'color'),
  R(`theme.${r}.radius`, 'Corner radius', 0, 60), R(`theme.${r}.borderWidth`, 'Border width', 0, 8), T(`theme.${r}.borderColor`, 'Border colour', 'color'),
  R(`theme.${r}.maxWidth`, 'Max width %', 30, 100), R(`theme.${r}.padX`, 'Padding X', 0, 70), R(`theme.${r}.padY`, 'Padding Y', 0, 70),
  T(`theme.${r}.shadow`, 'Shadow', 'select', { options: SHADOWS }), R(`theme.${r}.fontScale`, 'Font scale', 0.5, 2, 0.05),
];

export async function applyPreset(name, custom) {
  const preset = custom || PRESETS[name];
  if (!preset) return;
  app.store.update(s => {
    s.canvas = merge(merge(s.canvas, { bg: baseCanvas().bg, transparent: false }), preset.canvas || {});
    s.chrome = merge(baseChrome(), preset.chrome || {});
    s.theme = merge(baseTheme(), preset.theme || {});
    s.participants = merge(s.participants, preset.participants || {});
  }, null);
  app.toast('Preset applied: ' + name);
  rebuildRight(); app.rebuildPanels?.();
}

function presetBar() {
  const wrap = h('div', {});
  const sel = h('select', {}, Object.keys(PRESETS).map(n => h('option', { value: n }, n)));
  const saved = h('select', {}, h('option', { value: '' }, 'My presets…'));
  kvKeys('preset:').then(keys => keys.forEach(k => saved.append(h('option', { value: k }, String(k).slice(7)))));
  wrap.append(
    h('div', { class: 'row' }, sel, h('button', { class: 'primary', onclick: () => applyPreset(sel.value) }, 'Apply preset')),
    h('div', { class: 'row' }, saved,
      h('button', { class: 'small', onclick: async () => { if (!saved.value) return; const p = JSON.parse(await kvGet(saved.value)); applyPreset(String(saved.value).slice(7), p); } }, 'Apply'),
      h('button', { class: 'small danger', onclick: async () => { if (saved.value) { await kvDel(saved.value); rebuildRight(); } } }, 'Delete'),
      h('button', { class: 'small', onclick: async () => {
        const name = prompt('Name for this look:'); if (!name) return;
        const s = app.store.get();
        await kvSet('preset:' + name, JSON.stringify({ theme: s.theme, chrome: s.chrome, canvas: { bg: s.canvas.bg, padding: s.canvas.padding, radius: s.canvas.radius }, participants: s.participants }));
        app.toast('Saved preset “' + name + '”'); rebuildRight();
      } }, 'Save current…')));
  return wrap;
}

function fontUpload() {
  const f = h('input', { type: 'file', accept: '.ttf,.otf,.woff,.woff2,font/*', hidden: true });
  f.addEventListener('change', async () => {
    const file = f.files[0]; if (!file) return;
    const name = file.name.replace(/\.[^.]+$/, '').replace(/[^\w -]/g, '').trim() || 'Custom font';
    app.store.update(s => { s.fonts = (s.fonts || []).filter(x => x.name !== name); s.fonts.push({ name, data: null }); });
    const data = await readFile(file);
    app.store.update(s => { s.fonts.find(x => x.name === name).data = data; });
    app.toast(`Font “${name}” added — pick it in a font dropdown (“${name} (uploaded)”).`); rebuildRight();
  });
  const n = (app.store.get().fonts || []).length;
  return h('div', { class: 'row' }, h('button', { class: 'small', onclick: () => f.click() }, 'Upload font file…'), h('span', { class: 'note' }, n ? `${n} uploaded` : 'ttf / otf / woff / woff2'), f);
}

function styleTab() {
  const p = new Panel();
  p.add(presetBar());
  p.group('Typography', [
    T('theme.font.body', 'Body font', 'font'), T('theme.font.heading', 'Heading font', 'font'), T('theme.font.mono', 'Code font', 'font'),
    R('theme.font.size', 'Base size (px)', 10, 72), R('theme.font.lineHeight', 'Line height', 1, 2.2, 0.05),
    T('theme.font.weight', 'Weight', 'select', { options: [300, 400, 500, 600, 700].map(Number) }), R('theme.font.letterSpacing', 'Letter spacing (em)', -0.05, 0.2, 0.005),
  ], true);
  p.el.lastChild.querySelector('.grp-body').append(fontUpload());
  p.group('Colours', ['text', 'muted', 'accent', 'link', 'surface', 'border', 'codeBg', 'codeText'].map(k => T('theme.colors.' + k, k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()), 'color')));
  p.group('Spacing', [R('theme.gap', 'Message gap', 0, 90)]);
  p.group('User messages', roleDefs('user'));
  p.group('Assistant messages', roleDefs('assistant'));
  p.group('Avatars', [
    T('theme.avatar.show', 'Show avatars', 'toggle'), R('theme.avatar.size', 'Size', 20, 120), T('theme.avatar.shape', 'Shape', 'select', { options: ['circle', 'rounded', 'square'] }),
    T('theme.avatar.position', 'Position', 'select', { options: [['side', 'Beside message'], ['top', 'Above message (small)']] }), R('theme.avatar.gap', 'Gap', 0, 50),
    R('theme.avatar.ring', 'Ring width', 0, 10), T('theme.avatar.ringColor', 'Ring colour', 'color'),
  ]);
  p.group('Names & time', [
    T('theme.names.show', 'Show names', 'toggle'), T('theme.names.showForUser', 'Names for user too', 'toggle'), R('theme.names.scale', 'Size', 0.4, 1.3, 0.02),
    T('theme.names.weight', 'Weight', 'select', { options: [400, 500, 600, 700, 800].map(Number) }), T('theme.names.uppercase', 'Uppercase', 'toggle'),
    T('theme.time.show', 'Show timestamps', 'toggle'), R('theme.time.scale', 'Timestamp size', 0.4, 1.3, 0.02), R('theme.chromeScale', 'Header / footer small text', 0.4, 1.2, 0.02),
  ]);
  p.group('Sources / provenance', [
    T('theme.sources.style', 'Style', 'select', { options: [['cards', 'Cards'], ['chips', 'Chips'], ['footnotes', 'Footnote list']] }), T('theme.sources.title', 'Heading', 'text'),
    R('theme.sources.scale', 'Size', 0.4, 1.3, 0.02), R('theme.sources.columns', 'Card columns', 1, 4), T('theme.sources.showSnippet', 'Show snippet', 'toggle'),
    T('theme.sources.showIndex', 'Show index badge', 'toggle'), T('theme.sources.showSite', 'Show site', 'toggle'),
  ]);
  p.group('Meta information', [
    T('theme.meta.show', 'Show meta', 'toggle'), T('theme.meta.position', 'Position', 'select', { options: [['below', 'Below message'], ['inline', 'Next to name']] }),
    T('theme.meta.fields', 'Fields', 'checks', { options: [['model', 'Model'], ['latency', 'Latency'], ['tokens', 'Tokens'], ['confidence', 'Confidence'], ['date', 'Date'], ['custom', 'Custom']] }),
    T('theme.meta.showLabels', 'Show labels', 'toggle'), T('theme.meta.separator', 'Separator', 'text'), R('theme.meta.scale', 'Size', 0.4, 1.3, 0.02),
  ]);
  p.group('Action icons', [
    T('theme.actions.show', 'Show on assistant', 'toggle'),
    T('theme.actions.items', 'Icons', 'checks', { options: [['copy', 'Copy'], ['like', 'Like'], ['dislike', 'Dislike'], ['regenerate', 'Regenerate'], ['share', 'Share'], ['speak', 'Read aloud'], ['more', 'More']] }),
    R('theme.actions.scale', 'Size', 0.4, 1.6, 0.02), T('theme.actions.color', 'Colour', 'color'),
  ]);
  p.group('Reasoning panel', [T('theme.thinking.bg', 'Background', 'color'), T('theme.thinking.color', 'Text', 'color'), T('theme.thinking.borderColor', 'Border', 'color'), R('theme.thinking.scale', 'Size', 0.5, 1.2, 0.02)]);
  p.group('Code blocks', [R('theme.code.radius', 'Radius', 0, 30), R('theme.code.scale', 'Size', 0.5, 1.2, 0.02), T('theme.code.showHeader', 'Header bar', 'toggle'), T('theme.code.lineNumbers', 'Line numbers', 'toggle')]);
  p.group('Images, video & tables', [R('theme.media.radius', 'Radius', 0, 40), R('theme.media.borderWidth', 'Border width', 0, 8), T('theme.media.borderColor', 'Border colour', 'color'), R('theme.media.captionScale', 'Caption size', 0.4, 1.2, 0.02)]);
  p.group('Charts', [T('theme.chart.palette', 'Palette', 'palette'), T('theme.chart.gridColor', 'Grid', 'color'), T('theme.chart.axisColor', 'Axis / labels', 'color'), R('theme.chart.fontScale', 'Label size', 0.4, 1.3, 0.02), R('theme.chart.barRadius', 'Bar radius', 0, 14)]);
  p.group('Diagrams', [T('theme.diagram.nodeBg', 'Node fill', 'color'), T('theme.diagram.nodeBorder', 'Node border', 'color'), T('theme.diagram.nodeText', 'Node text', 'color'), T('theme.diagram.edgeColor', 'Edges', 'color'), R('theme.diagram.fontScale', 'Label size', 0.4, 1.3, 0.02)]);
  p.group('Chips (follow-ups, sources, reactions)', [T('theme.chip.bg', 'Background', 'color'), T('theme.chip.color', 'Text', 'color'), T('theme.chip.borderColor', 'Border', 'color'), R('theme.chip.radius', 'Radius', 0, 999)]);
  return p;
}

const SIZES = [['Poster column', 760, 0], ['Poster wide', 1100, 0], ['Slide 16:9', 1920, 1080], ['Square', 1080, 1080], ['A4 portrait', 794, 1123], ['Phone', 480, 0]];
function canvasTab() {
  const p = new Panel();
  const row = h('div', { class: 'row' }, SIZES.map(([n, w, hh]) => h('button', { class: 'small', onclick: () => { app.store.update(s => { s.canvas.width = w; s.canvas.minHeight = hh; }); p.sync(); } }, n)));
  p.add(h('h3', { style: 'margin-top:0' }, 'Canvas size presets')); p.add(row);
  p.group('Canvas', [
    R('canvas.width', 'Width (px)', 320, 3000, 10), R('canvas.minHeight', 'Min height (px)', 0, 3000, 10), R('canvas.padding', 'Outer padding', 0, 200), R('canvas.radius', 'Corner radius', 0, 80),
    T('canvas.bg.mode', 'Background', 'select', { options: [['solid', 'Solid'], ['gradient', 'Gradient'], ['image', 'Image']] }), T('canvas.bg.color', 'Colour', 'color'), T('canvas.bg.color2', 'Colour 2', 'color'),
    R('canvas.bg.angle', 'Gradient angle', 0, 360), T('canvas.bg.image', 'Image', 'image'), T('canvas.transparent', 'Transparent (PNG/SVG)', 'toggle', { hint: 'Exports with an alpha channel — perfect for dropping onto a poster background.' }),
    R('canvas.border', 'Border width', 0, 12), T('canvas.borderColor', 'Border colour', 'color'),
  ], true);
  p.group('Print / export', [
    R('canvas.physicalCm', 'Printed width (cm)', 3, 200, 0.5, { hint: 'Used for the Poster tab: effective point sizes and DPI.' }), R('canvas.exportScale', 'Export scale ×', 1, 8, 0.5),
  ], true);
  p.group('Window frame', [
    T('chrome.frame.style', 'Frame', 'select', { options: [['none', 'None (floating)'], ['card', 'Card'], ['phone', 'Phone']] }), R('chrome.frame.radius', 'Radius', 0, 60), R('chrome.frame.bodyPad', 'Inner padding', 0, 100),
    T('chrome.frame.shadow', 'Shadow (card)', 'toggle'), T('chrome.frame.color', 'Bezel colour (phone)', 'color'), R('chrome.frame.thickness', 'Bezel thickness', 4, 40),
  ]);
  p.group('Header', [
    T('chrome.header.show', 'Show header', 'toggle'), T('chrome.header.style', 'Style', 'select', { options: [['window', 'Window controls'], ['bar', 'App bar with avatar'], ['minimal', 'Minimal centred']] }),
    T('chrome.header.title', 'Title', 'text', { ai: true }), T('chrome.header.subtitle', 'Subtitle / status', 'text', { ai: true }), T('chrome.header.modelBadge', 'Model badge', 'text'),
    T('chrome.header.controls', 'Window buttons', 'select', { options: [['mac', 'Mac dots'], ['win', 'Windows'], ['none', 'None']] }), T('chrome.header.align', 'Title align', 'select', { options: ['left', 'center'] }),
    T('chrome.header.bg', 'Background', 'color'), T('chrome.header.color', 'Text', 'color'), T('chrome.header.border', 'Bottom border', 'toggle'),
  ]);
  p.group('Input bar', [
    T('chrome.input.show', 'Show input bar', 'toggle'), T('chrome.input.placeholder', 'Placeholder', 'text', { ai: true }), T('chrome.input.text', 'Typed text', 'text', { ai: true, hint: 'Leave empty to show the placeholder.' }),
    T('chrome.input.bg', 'Background', 'color'), T('chrome.input.color', 'Text', 'color'), T('chrome.input.border', 'Border', 'color'), R('chrome.input.radius', 'Radius', 0, 60), T('chrome.input.sendColor', 'Send button', 'color'),
    T('chrome.input.attach', 'Attach icon', 'toggle'), T('chrome.input.mic', 'Mic icon', 'toggle'), T('chrome.input.disclaimer', 'Disclaimer', 'text', { ai: true }),
  ]);
  return p;
}

function peopleTab() {
  const p = new Panel();
  for (const [r, title] of [['user', 'User'], ['assistant', 'Assistant']]) {
    const pre = `participants.${r}.`;
    const defs = [T(pre + 'name', 'Display name', 'text')];
    if (r === 'assistant') defs.push(T(pre + 'model', 'Model name', 'text', { hint: 'Used as default for new assistant messages.' }));
    defs.push(
      T(pre + 'avatar.type', 'Avatar type', 'select', { options: [['initials', 'Initials'], ['emoji', 'Emoji'], ['icon', 'Icon'], ['image', 'Image']] }),
      T(pre + 'avatar.value', 'Initials / emoji / icon', 'text'),
      T(pre + 'avatar.value', 'Pick icon', 'select', { options: ICONS, onWrite: (v) => { app.store.set(pre + 'avatar.value', v); app.store.set(pre + 'avatar.type', 'icon'); } }),
      T(pre + 'avatar.image', 'Image', 'image', { onUpload: () => app.store.set(pre + 'avatar.type', 'image') }),
      T(pre + 'avatar.bg', 'Background', 'color'), T(pre + 'avatar.color', 'Foreground', 'color'),
    );
    p.group(title, defs, true);
  }
  p.add(h('div', { class: 'note' }, 'Avatar visibility, size, shape and position are in Style → Avatars. Per-message overrides are in the message editor.'));
  return p;
}

function posterTab() {
  const { panel, api } = buildPoster(); posterApi = api; return panel;
}
function notesTab() { return buildNotes(); }

function jsonTab() {
  const p = new Panel();
  const ta = h('textarea', { class: 'json-area', spellcheck: 'false' });
  const strip = () => { const s = clone(app.store.get()); s.assets = '(assets are kept automatically)'; s.fonts = (s.fonts || []).map(f => ({ name: f.name, data: '(kept)' })); return JSON.stringify(s, null, 2); };
  const load = () => (ta.value = strip());
  load();
  const apply = () => {
    try {
      const cur = app.store.get(); const parsed = JSON.parse(ta.value);
      if (typeof parsed.assets === 'string') parsed.assets = cur.assets;
      if (Array.isArray(parsed.fonts)) parsed.fonts = parsed.fonts.map(f => (f.data === '(kept)' ? cur.fonts.find(x => x.name === f.name) || f : f));
      app.store.replace(normalizeProject(parsed)); app.toast('JSON applied'); app.rebuildPanels?.();
    } catch (e) { app.toast('Invalid project: ' + e.message, true); }
  };
  p.add(h('div', { class: 'note' }, 'Every setting lives in this document. Edit freely, then Apply. Invalid JSON is rejected without changing anything.'));
  p.add(h('div', { class: 'row' }, h('button', { class: 'primary', onclick: apply }, 'Apply'), h('button', { onclick: load }, 'Reload from editor'),
    h('button', { onclick: () => navigator.clipboard?.writeText(ta.value).then(() => app.toast('Copied')) }, 'Copy'),
    h('button', { class: 'danger', onclick: () => { if (confirm('Replace everything with the sample project?')) { app.store.replace(newProject()); app.rebuildPanels?.(); } } }, 'Reset to sample')));
  p.add(ta);
  p.sync = () => { if (document.activeElement !== ta) load(); };
  return p;
}
