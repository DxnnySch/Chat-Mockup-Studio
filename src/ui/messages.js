// Left panel: conversation list + editor for the selected message and its blocks.
import { app, addAsset } from './app.js';
import { h, Panel, grp, setScope } from './fields.js';
import { openAi } from './ai.js';
import { openSynth } from './synth.js';
import { correlatedSeries, timeSeriesCsv, scatterCsv } from '../synth.js';
import { parseSourcesJson, parseFigureJson } from '../aiPrompts.js';
import { uid, clone } from '../util.js';
import { BLOCK_TYPES } from '../render/blocks.js';
import { PALETTES } from '../color.js';

// blocks are expanded by default; only explicitly collapsed ones are remembered
const closedBlocks = new Set();
const openSrc = new Set();
const seenMsgs = new Set();
let container;

const BLOCK_LABEL = { text: 'Text', code: 'Code', image: 'Image', video: 'Video', table: 'Table', chart: 'Chart', diagram: 'Diagram', callout: 'Callout', file: 'File', quote: 'Quote', tool: 'Tool call', figure: 'Figure (multi-panel)', svg: 'Custom SVG', divider: 'Divider' };
const NEW_BLOCK = {
  text: { text: 'New paragraph with **bold**, *italic* and a citation [1].' },
  code: { lang: 'python', filename: 'analysis.py', code: 'import numpy as np\n\nx = np.linspace(0, 1, 5)\nprint(x.mean())  # 0.5' },
  image: { src: '', placeholder: 'Image', caption: '', width: 100, aspect: '16/9' },
  video: { src: '', time: '0:12 / 1:30', progress: 14, controls: true, bigPlay: true, caption: '', width: 100, aspect: '16/9' },
  table: { csv: 'Model,Accuracy,F1\nBaseline,0.71,0.68\nOurs,0.84,0.82', caption: 'Table 1 · Results (illustrative).', header: true, striped: true },
  chart: { chartType: 'line', title: 'Accuracy over epochs', csv: 'Epoch,Train,Validation\n1,0.52,0.50\n2,0.68,0.63\n3,0.79,0.71\n4,0.86,0.74\n5,0.91,0.75', xLabel: 'Epoch', yLabel: 'Accuracy', height: 300, legend: true },
  diagram: { src: 'direction LR\nA[Input] --> B(Model) --> C[Output]', caption: '' },
  callout: { kind: 'info', title: 'Note', text: 'Callouts highlight caveats or key findings.' },
  file: { name: 'dataset.csv', size: '2.4 MB', kind: 'CSV' },
  quote: { text: 'A quoted passage.', cite: 'Source' },
  tool: { name: 'search_papers', status: 'done', args: '{"query": "retrieval augmented generation"}', result: '12 results' },
  figure: defaultFigure(),
  svg: { title: '', code: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 300"><rect x="20" y="90" width="200" height="120" rx="16" fill="#E8F1FB" stroke="#0072B2" stroke-width="4"/><text x="120" y="158" text-anchor="middle" font-family="inherit" font-size="28" font-weight="700" fill="#1f2328">Input</text><path d="M230 150H330" stroke="#555" stroke-width="5" marker-end="url(#a)"/><defs><marker id="a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="#555"/></marker></defs><rect x="340" y="90" width="200" height="120" rx="16" fill="#FDF0E3" stroke="#D55E00" stroke-width="4"/><text x="440" y="158" text-anchor="middle" font-family="inherit" font-size="28" font-weight="700" fill="#1f2328">Model</text><path d="M550 150H650" stroke="#555" stroke-width="5" marker-end="url(#a)"/><circle cx="715" cy="150" r="60" fill="#E3F5EE" stroke="#009E73" stroke-width="4"/><text x="715" y="158" text-anchor="middle" font-family="inherit" font-size="28" font-weight="700" fill="#1f2328">Out</text></svg>', caption: '', width: 100 },
  divider: {},
};

function defaultFigure() {
  const s = correlatedSeries({ from: 1979, to: 2020, rho: -0.55, seed: 11, a: { mean: 0, trend: -1.8, noise: 0.45 }, b: { mean: 1.2, sd: 0.25 } });
  const A = 'Sea-ice anomaly (10⁶ km²)', B = 'Jet waviness (index)';
  return {
    title: '', layout: 'row', panelHeight: 280, letters: true, width: 100, caption: 'Figure 1 · Illustrative synthetic data.',
    panels: [
      { title: 'Sea-ice anomaly and jet waviness', chartType: 'line', csv: timeSeriesCsv(s, A, B), xLabel: 'Year', yLabel: A, y2Label: B, zeroLine: true, legend: true },
      { title: 'Low-ice years vs. wavier jet', chartType: 'scatter', csv: scatterCsv(s, B, A), xLabel: B, yLabel: A, trend: true, showR: true, showN: true, labelPoints: true, labelEvery: 5, zeroLine: true },
    ],
  };
}

const msgIndex = () => app.store.get().messages.findIndex(m => m.id === app.sel.msg);
const snippet = (m) => {
  const t = (m.blocks || []).find(b => b.type === 'text')?.text || (m.blocks?.[0] ? '[' + m.blocks[0].type + ']' : '(empty)');
  return t.replace(/\s+/g, ' ').slice(0, 60);
};
export function refreshLeft() { if (container) build(container); }
export function focusBlock(id) { closedBlocks.delete(id); refreshLeft(); setTimeout(() => container.querySelector(`[data-bid="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30); }

export function buildLeft(el) { container = el; build(el); }

function mutate(fn, key) { app.store.update(fn, key); }
function move(arr, i, d) { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; }

function build(el) {
  const scroll = el.scrollTop;
  el.innerHTML = '';
  const st = app.store.get();
  if (!st.messages.some(m => m.id === app.sel.msg)) app.sel.msg = st.messages[0]?.id ?? null;
  const pane = h('div', { class: 'pane' });
  pane.append(h('h3', { style: 'margin-top:0' }, 'Conversation'));
  st.messages.forEach((m, i) => {
    const sel = m.id === app.sel.msg;
    pane.append(h('div', { class: 'msg-item' + (sel ? ' sel' : ''), onclick: () => { app.select({ msg: m.id }); refreshLeft(); } },
      h('span', { class: 'role', style: `background:${m.role === 'user' ? st.participants.user.avatar.bg : st.participants.assistant.avatar.bg}` }, m.role === 'user' ? 'U' : 'A'),
      h('span', { class: 'snip' }, snippet(m)),
      h('button', { class: 'small ghost', title: 'Move up', onclick: (e) => { e.stopPropagation(); mutate(s => move(s.messages, i, -1)); refreshLeft(); } }, '↑'),
      h('button', { class: 'small ghost', title: 'Move down', onclick: (e) => { e.stopPropagation(); mutate(s => move(s.messages, i, 1)); refreshLeft(); } }, '↓'),
      h('button', { class: 'small ghost', title: 'Duplicate', onclick: (e) => { e.stopPropagation(); const c = clone(m); c.id = uid('m'); c.blocks.forEach(b => (b.id = uid('b'))); mutate(s => s.messages.splice(i + 1, 0, c)); app.select({ msg: c.id }); refreshLeft(); } }, '⧉'),
      h('button', { class: 'small ghost danger', title: 'Delete', onclick: (e) => { e.stopPropagation(); mutate(s => s.messages.splice(i, 1)); refreshLeft(); } }, '✕')));
  });
  pane.append(h('div', { class: 'row' },
    h('button', { onclick: () => addMessage('user') }, '+ User message'),
    h('button', { onclick: () => addMessage('assistant') }, '+ Assistant message')));
  const i = msgIndex();
  if (i >= 0) pane.append(messageEditor(i));
  el.append(pane);
  el.scrollTop = scroll;
}

function addMessage(role) {
  const m = { id: uid('m'), role, time: '', blocks: [{ id: uid('b'), type: 'text', text: role === 'user' ? 'Your question…' : 'The answer…' }] };
  if (role === 'assistant') Object.assign(m, { sources: [], meta: { model: app.store.get().participants.assistant.model, latency: '', tokens: '', confidence: '', date: '', custom: [] } });
  const i = msgIndex();
  mutate(s => s.messages.splice(i >= 0 ? i + 1 : s.messages.length, 0, m));
  app.select({ msg: m.id }); refreshLeft();
}

function messageEditor(i) {
  const m = app.store.get().messages[i];
  const P = (k) => `messages.${i}.${k}`;
  setScope('msg');
  const panel = new Panel();
  if (!seenMsgs.has(m.id)) { seenMsgs.add(m.id); (m.blocks || []).slice(3).forEach(b => closedBlocks.add(b.id)); }
  const wrap = h('div', {}, h('h3', {}, 'Selected message'));
  panel.el.style.padding = '0';

  panel.group('Basics', [
    { path: P('role'), label: 'Role', type: 'select', options: [['user', 'User'], ['assistant', 'Assistant']], onWrite: (v) => { app.store.set(P('role'), v); refreshLeft(); } },
    { path: P('name'), label: 'Name override', type: 'text', placeholder: 'default from People tab' },
    { path: P('time'), label: 'Time', type: 'text', placeholder: '10:42' },
    { path: P('annotation'), label: 'Badge (A, B, 1…)', type: 'text', hint: 'Shows a numbered/lettered badge on the message — handy for referencing it in poster text.' },
    { path: P('hideAvatar'), label: 'Hide avatar', type: 'toggle' },
    { path: P('actionsMode'), label: 'Action icons', type: 'select', options: [['auto', 'Default (assistant only)'], ['on', 'Always'], ['off', 'Never']] },
    { path: P('liked'), label: 'Liked', type: 'toggle' },
    { path: P('edited'), label: '“(edited)” label', type: 'toggle' },
    { path: P('typing'), label: 'Typing indicator', type: 'toggle', hint: 'Replaces content with animated-looking dots.' },
    { path: P('cursor'), label: 'Streaming cursor', type: 'toggle' },
    { path: P('error'), label: 'Error text', type: 'text', placeholder: 'e.g. Something went wrong.' },
  ], true);

  // blocks
  const bl = h('div', {});
  (m.blocks || []).forEach((b, bi) => bl.append(blockCard(i, bi, b, panel)));
  const sel = h('select', { class: 'add-block-type' }, BLOCK_TYPES.map(t => h('option', { value: t }, BLOCK_LABEL[t] || t)));
  bl.append(h('div', { class: 'row' }, sel, h('button', { class: 'primary', onclick: () => {
    const nb = { id: uid('b'), type: sel.value, ...clone(NEW_BLOCK[sel.value]) };
    mutate(s => s.messages[i].blocks.push(nb)); closedBlocks.delete(nb.id); refreshLeft();
  } }, '+ Add block')));
  const gb = grp(`Content blocks (${m.blocks?.length || 0})`, h('div', { class: 'grp-body' }, bl), true, 'blocks');
  panel.el.append(gb);

  // thinking
  panel.group('Reasoning panel ("Thought for…")', [
    { path: P('thinking.text'), label: 'Text', type: 'area', aiLabel: 'Reasoning text', rows: 3 },
    { path: P('thinking.duration'), label: 'Duration (s)', type: 'number' },
    { path: P('thinking.label'), label: 'Label', type: 'text', placeholder: 'Thought for' },
    { path: P('thinking.open'), label: 'Expanded', type: 'toggle' },
  ]);

  // sources
  const sb = h('div', {});
  (m.sources || []).forEach((s, si) => {
    const body = new Panel(); body.el.style.padding = '0';
    [['title', 'Title'], ['site', 'Site / venue'], ['authors', 'Authors'], ['year', 'Year'], ['url', 'URL'], ['tag', 'Tag (optional)']].forEach(([k, l]) => body.el.append(body.field({ path: P(`sources.${si}.${k}`), label: l, type: 'text', ai: k === 'title' || k === 'authors' })));
    body.el.append(body.field({ path: P(`sources.${si}.snippet`), label: 'Snippet', type: 'area', aiLabel: 'Source snippet', rows: 2 }));
    sb.append(card({ id: m.id + 's' + si, title: `[${si + 1}] ${s.title || 'Untitled source'}`, open: openSrc.has(m.id + (s.id || si)), toggle: () => { const k = m.id + (s.id || si); openSrc.has(k) ? openSrc.delete(k) : openSrc.add(k); refreshLeft(); }, body: body.el, panel,
      actions: [['↑', () => mutate(st => move(st.messages[i].sources, si, -1))], ['↓', () => mutate(st => move(st.messages[i].sources, si, 1))], ['✕', () => mutate(st => st.messages[i].sources.splice(si, 1)), true]] }));
    panel.syncs.push(...body.syncs);
  });
  sb.append(h('button', { class: 'ai-btn', onclick: () => openAi({ label: 'Sources', kind: 'sources', role: 'assistant', current: '', msgIndex: i, apply: (text) => {
    const list = parseSourcesJson(text).map(s => ({ id: uid('s'), ...s }));
    mutate(st => { (st.messages[i].sources ||= []).push(...list); }); refreshLeft();
  } }) }, '✨ Generate sources…'), ' ', h('button', { onclick: () => { const nid = uid('s'); mutate(s => (s.messages[i].sources ||= []).push({ id: nid, title: 'New source', site: 'Journal', authors: 'Author, A.', year: '2025', url: 'https://example.org', snippet: '' })); openSrc.add(m.id + nid); refreshLeft(); } }, '+ Add source'));
  panel.el.append(grp(`Sources / provenance (${m.sources?.length || 0})`, h('div', { class: 'grp-body' }, h('div', { class: 'note' }, 'Cite in text with [1], [2] or [1,2]. Display style (cards / chips / footnotes) is set in Style → Sources.'), sb), false, 'sources'));

  // meta
  const mp = new Panel(); mp.el.style.padding = '0';
  [['model', 'Model'], ['latency', 'Latency'], ['tokens', 'Tokens'], ['confidence', 'Confidence'], ['date', 'Date']].forEach(([k, l]) => mp.el.append(mp.field({ path: P('meta.' + k), label: l, type: 'text' })));
  const cm = h('div', {});
  ((m.meta && m.meta.custom) || []).forEach((c, ci) => {
    const r = new Panel(); r.el.style.padding = '0';
    cm.append(h('div', { class: 'row' }, r.field({ path: P(`meta.custom.${ci}.k`), type: 'text', placeholder: 'label' }), r.field({ path: P(`meta.custom.${ci}.v`), type: 'text', placeholder: 'value' }),
      h('button', { class: 'small danger', onclick: () => { mutate(s => s.messages[i].meta.custom.splice(ci, 1)); refreshLeft(); } }, '✕')));
    mp.syncs.push(...r.syncs);
  });
  cm.append(h('button', { class: 'small', onclick: () => { mutate(s => { const mm = s.messages[i]; mm.meta ||= {}; (mm.meta.custom ||= []).push({ k: 'Temp', v: '0.2' }); }); refreshLeft(); } }, '+ Custom item'));
  mp.el.append(cm);
  panel.syncs.push(...mp.syncs);
  panel.el.append(grp('Meta information', h('div', { class: 'grp-body' }, mp.el)));

  panel.group('Follow-ups, reactions, versions', [
    { path: P('followups'), label: 'Follow-up chips', type: 'lines', aiKind: 'lines', hint: 'One suggestion per line.' },
    { path: P('reactions'), label: 'Reactions', type: 'text', placeholder: '👍 3, ❤️ 2',
      get: (s) => (s.messages[i].reactions || []).map(r => `${r.emoji} ${r.count ?? ''}`.trim()).join(', '),
      onWrite: (v) => app.store.set(P('reactions'), v.split(',').map(x => x.trim()).filter(Boolean).map(x => { const [e, c] = x.split(/\s+/); return { emoji: e, count: c ? +c : '' }; }), 'reactions') },
    { path: P('versions.count'), label: 'Versions', type: 'number', min: 1, hint: '>1 shows a “2/3” pager.' },
    { path: P('versions.index'), label: 'Shown version', type: 'number', min: 1 },
  ]);

  const R = m.role === 'user' ? 'user' : 'assistant';
  const ov = (k, label, type, extra = {}) => ({ path: P('style.' + k), fallback: `theme.${R}.${k}`, label, type, clearable: true, ...extra });
  panel.group('Style overrides (this message only)', [
    ov('layout', 'Layout', 'select', { options: [['bubble', 'Bubble'], ['plain', 'Plain'], ['card', 'Card']] }),
    ov('align', 'Align', 'select', { options: [['left', 'Left'], ['right', 'Right'], ['center', 'Center']] }),
    ov('bg', 'Background', 'color'), ov('color', 'Text colour', 'color'),
    ov('radius', 'Corner radius', 'range', { min: 0, max: 60 }), ov('borderWidth', 'Border width', 'range', { min: 0, max: 8 }), ov('borderColor', 'Border colour', 'color'),
    ov('maxWidth', 'Max width %', 'range', { min: 30, max: 100 }), ov('padX', 'Padding X', 'range', { min: 0, max: 60 }), ov('padY', 'Padding Y', 'range', { min: 0, max: 60 }),
    ov('shadow', 'Shadow', 'select', { options: ['none', 'sm', 'md', 'lg'] }), ov('fontScale', 'Font scale', 'range', { min: 0.5, max: 2, step: 0.05 }),
  ]);
  const avStyle = [
    { path: P('avatar.type'), label: 'Avatar override', type: 'select', options: [['', 'Inherit'], ['initials', 'Initials'], ['emoji', 'Emoji'], ['icon', 'Icon'], ['image', 'Image']] },
    { path: P('avatar.value'), label: 'Avatar value', type: 'text' },
  ];
  panel.group('Avatar override', avStyle);

  wrap.append(panel.el);
  const unsub = app.store.subscribe((_, meta) => { if (!wrap.isConnected) { unsub(); return; } if (!meta.replaced) panel.sync(); });
  return wrap;
}

function card({ title, sub, open, toggle, body, actions = [], selected, id }) {
  const head = h('div', { class: 'card-head', onclick: toggle },
    h('span', { class: 'ttl' }, title, sub ? h('span', { class: 'sub' }, ' ' + sub) : null),
    actions.map(([t, fn, danger]) => h('button', { class: 'small ghost' + (danger ? ' danger' : ''), onclick: (e) => { e.stopPropagation(); fn(); refreshLeft(); } }, t)));
  return h('div', { class: 'card' + (open ? '' : ' collapsed') + (selected ? ' sel' : ''), 'data-bid': id }, head, h('div', { class: 'card-body' }, body));
}

function blockCard(i, bi, b, panel) {
  const P = (k) => `messages.${i}.blocks.${bi}.${k}`;
  const body = new Panel(); body.el.style.padding = '0';
  const F = (d) => body.el.append(body.field(d));
  const wide = (extra) => ({ wide: true, ...extra });
  switch (b.type) {
    case 'text': F(wide({ path: P('text'), type: 'area', aiKind: 'markdown', aiLabel: 'Message text', rows: 9, hint: 'Markdown: **bold** *italic* `code` · lists · > quote · ## heading · $inline$ and $$display$$ LaTeX · [1] citations · [link](https://…)' })); break;
    case 'code': F({ path: P('lang'), label: 'Language', type: 'text' }); F({ path: P('filename'), label: 'Filename', type: 'text' }); F(wide({ path: P('code'), type: 'area', aiKind: 'code', aiLangPath: P('lang'), aiLabel: 'Code', rows: 8 })); break;
    case 'image':
      F({ path: P('src'), label: 'Image', type: 'image' }); F({ path: P('placeholder'), label: 'Placeholder text', type: 'text' }); F({ path: P('alt'), label: 'Alt text', type: 'text' });
      F({ path: P('caption'), label: 'Caption', type: 'text', ai: true }); F({ path: P('width'), label: 'Width %', type: 'range', min: 10, max: 100 });
      F({ path: P('height'), label: 'Fixed height px', type: 'number', min: 0, hint: '0 / empty = natural height' }); F({ path: P('fit'), label: 'Fit', type: 'select', options: ['cover', 'contain'] });
      F({ path: P('aspect'), label: 'Placeholder aspect', type: 'text', placeholder: '16/9' }); F({ path: P('radius'), label: 'Radius override', type: 'number' }); F({ path: P('align'), label: 'Align', type: 'select', options: ['left', 'center'] }); break;
    case 'video':
      body.el.append(videoTools(i, bi, b));
      F({ path: P('poster'), label: 'Poster image', type: 'image', hint: 'Or grab a frame from a video file above.' }); F({ path: P('time'), label: 'Time label', type: 'text' });
      F({ path: P('progress'), label: 'Progress %', type: 'range', min: 0, max: 100 }); F({ path: P('controls'), label: 'Control bar', type: 'toggle' }); F({ path: P('bigPlay'), label: 'Big play button', type: 'toggle' });
      F({ path: P('caption'), label: 'Caption', type: 'text', ai: true }); F({ path: P('width'), label: 'Width %', type: 'range', min: 10, max: 100 }); F({ path: P('aspect'), label: 'Aspect (no poster)', type: 'text', placeholder: '16/9' }); break;
    case 'table': F(wide({ path: P('csv'), type: 'area', aiKind: 'csv-table', aiLabel: 'Table data (CSV)', rows: 6, hint: 'CSV: first row = header. Markdown allowed in cells.' })); F({ path: P('header'), label: 'Header row', type: 'toggle' }); F({ path: P('striped'), label: 'Striped', type: 'toggle' }); F({ path: P('caption'), label: 'Caption', type: 'text', ai: true }); break;
    case 'chart':
      F({ path: P('chartType'), label: 'Type', type: 'select', options: [['bar', 'Bar'], ['line', 'Line'], ['scatter', 'Scatter']] }); F({ path: P('title'), label: 'Title', type: 'text', ai: true });
      F(wide({ path: P('csv'), type: 'area', aiKind: 'csv-chart', aiLabel: 'Chart data (CSV)', rows: 7, hint: 'First column = x / category; other columns = series. Add a column named "<series>±" (or _err / _sd) for error bars.' }));
      F({ path: P('xLabel'), label: 'X label', type: 'text' }); F({ path: P('yLabel'), label: 'Y label', type: 'text' }); F({ path: P('height'), label: 'Height', type: 'range', min: 140, max: 700, step: 10 });
      F({ path: P('palette'), label: 'Palette', type: 'palette' }); F({ path: P('colors'), label: 'Custom colours', type: 'text', placeholder: '#0072B2, #D55E00' });
      F({ path: P('legend'), label: 'Legend', type: 'toggle' }); F({ path: P('showValues'), label: 'Value labels', type: 'toggle' }); F({ path: P('width'), label: 'Width %', type: 'range', min: 30, max: 100 }); F({ path: P('caption'), label: 'Caption', type: 'text', ai: true }); break;
    case 'diagram':
      F(wide({ path: P('src'), type: 'area', aiKind: 'diagram', aiLabel: 'Diagram', rows: 8, hint: 'A[Label] --> B(Round) --> C{Decision} : edge text · ((circle)) · [[stadium]] · style A #16a34a · direction LR|TD' }));
      F({ path: P('dir'), label: 'Direction', type: 'select', options: [['', 'Auto (fit width)'], ['LR', 'Left → right'], ['TD', 'Top → down']] }); F({ path: P('title'), label: 'Title', type: 'text', ai: true }); F({ path: P('caption'), label: 'Caption', type: 'text', ai: true }); break;
    case 'figure': figureEditor(i, bi, b, body, F, P); break;
    case 'svg':
      F({ path: P('title'), label: 'Title', type: 'text', ai: true }); F({ path: P('width'), label: 'Width %', type: 'range', min: 20, max: 100 });
      F(wide({ path: P('code'), type: 'area', aiKind: 'svg', aiLabel: 'SVG code', rows: 10, hint: 'Paste SVG or describe a figure with ✨ AI. Scripts, links, images and external references are stripped automatically.' }));
      F({ path: P('caption'), label: 'Caption', type: 'text', ai: true }); break;
    case 'callout': F({ path: P('kind'), label: 'Kind', type: 'select', options: ['info', 'warn', 'success', 'error', 'note'] }); F({ path: P('title'), label: 'Title', type: 'text', ai: true }); F(wide({ path: P('text'), type: 'area', aiKind: 'markdown', aiLabel: 'Callout text', rows: 3 })); break;
    case 'file': F({ path: P('name'), label: 'File name', type: 'text' }); F({ path: P('size'), label: 'Size', type: 'text' }); F({ path: P('kind'), label: 'Kind', type: 'text' }); break;
    case 'quote': F(wide({ path: P('text'), type: 'area', aiLabel: 'Quote', rows: 3 })); F({ path: P('cite'), label: 'Cite', type: 'text' }); break;
    case 'tool': F({ path: P('name'), label: 'Tool name', type: 'text' }); F({ path: P('status'), label: 'Status', type: 'select', options: ['done', 'running', 'error'] }); F(wide({ path: P('args'), type: 'area', aiKind: 'code', aiLabel: 'Arguments', rows: 3 })); F(wide({ path: P('result'), type: 'area', aiKind: 'code', aiLabel: 'Result', rows: 3 })); break;
    default: body.el.append(h('div', { class: 'note' }, 'No options.'));
  }
  panel.syncs.push(...body.syncs);
  const open = !closedBlocks.has(b.id);
  return card({
    id: b.id, title: BLOCK_LABEL[b.type] || b.type, sub: b.type === 'text' ? (b.text || '').replace(/\s+/g, ' ').slice(0, 30) : (b.title || b.caption || b.name || ''), open, selected: app.sel.block === b.id,
    toggle: () => { open ? closedBlocks.add(b.id) : closedBlocks.delete(b.id); app.select({ block: b.id }); refreshLeft(); }, body: body.el,
    actions: [['↑', () => mutate(s => move(s.messages[i].blocks, bi, -1))], ['↓', () => mutate(s => move(s.messages[i].blocks, bi, 1))],
      ['⧉', () => mutate(s => { const c = clone(s.messages[i].blocks[bi]); c.id = uid('b'); s.messages[i].blocks.splice(bi + 1, 0, c); })], ['✕', () => mutate(s => s.messages[i].blocks.splice(bi, 1)), true]],
  });
}

/** Grab a still frame from a local video file and store it as the poster (the video itself is not stored). */
function videoTools(i, bi, b) {
  const P = (k) => `messages.${i}.blocks.${bi}.${k}`;
  const file = h('input', { type: 'file', accept: 'video/*', hidden: true });
  const t = h('input', { type: 'number', min: 0, step: 0.1, value: 1, style: 'width:80px' });
  const info = h('span', { class: 'note' }, app.videoFiles.has(b.id) ? 'Video loaded for this session.' : 'Choose a video file to grab a frame.');
  const grab = async () => {
    const url = app.videoFiles.get(b.id); if (!url) return app.toast('Choose a video file first', true);
    try {
      const { dataUrl, duration, at } = await frameAt(url, +t.value || 0);
      const blob = await (await fetch(dataUrl)).blob();
      const ref = await addAsset(new File([blob], 'frame.jpg', { type: 'image/jpeg' }));
      const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      app.store.update(s => { const bb = s.messages[i].blocks[bi]; bb.poster = ref; bb.time = `${fmtT(at)} / ${fmtT(duration)}`; bb.progress = Math.round(at / duration * 100); });
      refreshLeft();
    } catch (e) { app.toast('Could not read video: ' + e.message, true); }
  };
  file.addEventListener('change', () => { if (!file.files[0]) return; app.videoFiles.set(b.id, URL.createObjectURL(file.files[0])); info.textContent = file.files[0].name; grab(); });
  return h('div', { class: 'fld wide' }, h('label', {}, 'Video frame'), h('div', { class: 'row' }, h('button', { class: 'small', onclick: () => file.click() }, 'Choose video…'), 'at', t, 's', h('button', { class: 'small', onclick: grab }, 'Grab frame')), info, file);
}
function frameAt(url, t) {
  return new Promise((res, rej) => {
    const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = url; v.crossOrigin = 'anonymous';
    v.onerror = () => rej(new Error('unsupported file'));
    v.onloadedmetadata = () => { v.currentTime = Math.min(Math.max(0, t), Math.max(0, v.duration - 0.05)); };
    v.onseeked = () => {
      const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext('2d').drawImage(v, 0, 0); res({ dataUrl: c.toDataURL('image/jpeg', 0.92), duration: v.duration, at: v.currentTime });
    };
  });
}

const closedPanels = new Set();
/** Editor for the multi-panel figure block. */
function figureEditor(i, bi, b, body, F, P) {
  const act = (label, fn, cls = '') => h('button', { class: 'small ' + cls, onclick: fn }, label);
  const setFigure = (f) => { app.store.update(s => { Object.assign(s.messages[i].blocks[bi], f); }); refreshLeft(); };
  body.el.append(h('div', { class: 'row' },
    h('button', { class: 'ai-btn', onclick: () => openAi({
      label: 'Figure (panels + synthetic data)', kind: 'figure', role: 'assistant', msgIndex: i,
      current: JSON.stringify({ title: b.title, caption: b.caption, layout: b.layout, panels: b.panels }, null, 1), instruction: '',
      apply: (text) => { const f = parseFigureJson(text); setFigure({ ...f, title: f.title || b.title || '', caption: f.caption || b.caption || '' }); },
    }) }, '✨ Build figure from description…'),
    act('🎲 Synthetic correlated data…', () => openSynth({ apply: ({ panels, layout }) => setFigure({ panels, layout }) }))));
  F({ path: P('title'), label: 'Title', type: 'text', ai: true });
  F({ path: P('layout'), label: 'Layout', type: 'select', options: [['row', 'Side by side'], ['col', 'Stacked'], ['grid', '2-column grid']] });
  F({ path: P('panelHeight'), label: 'Panel height', type: 'range', min: 140, max: 620, step: 10 });
  F({ path: P('letters'), label: 'Panel letters (a), (b)', type: 'toggle' });
  F({ path: P('width'), label: 'Width %', type: 'range', min: 30, max: 100 });
  F({ path: P('caption'), label: 'Caption', type: 'text', ai: true });
  (b.panels || []).forEach((p, pi) => {
    const Q = (k) => P('panels.' + pi + '.' + k), key = b.id + ':' + pi;
    const pb = new Panel(); pb.el.style.padding = '0';
    const G = (d) => pb.el.append(pb.field(d));
    G({ path: Q('title'), label: 'Title', type: 'text', ai: true });
    G({ path: Q('chartType'), label: 'Type', type: 'select', options: [['line', 'Line'], ['area', 'Area'], ['scatter', 'Scatter'], ['bar', 'Bar']] });
    G({ path: Q('csv'), type: 'area', rows: 6, wide: true, aiKind: 'csv-chart', aiLabel: 'Panel data (CSV)', hint: 'Columns: x, series…  ·  "name@right" = right axis  ·  "Year@label" = point labels  ·  "name±" = error bars' });
    G({ path: Q('xLabel'), label: 'X label', type: 'text' }); G({ path: Q('yLabel'), label: 'Y label', type: 'text' }); G({ path: Q('y2Label'), label: 'Right Y label', type: 'text' });
    G({ path: Q('trend'), label: 'Trend line', type: 'toggle' }); G({ path: Q('showR'), label: 'Show r', type: 'toggle', hint: 'Pearson r computed from this panel’s data.' });
    G({ path: Q('showN'), label: 'Show n', type: 'toggle' }); G({ path: Q('statText'), label: 'Override stat text', type: 'text', placeholder: 'e.g. r = −0.58, p < 0.001' });
    G({ path: Q('labelPoints'), label: 'Point labels', type: 'toggle' }); G({ path: Q('labelEvery'), label: 'Label every n-th', type: 'number', min: 1 });
    G({ path: Q('zeroLine'), label: 'Zero line', type: 'toggle' }); G({ path: Q('legend'), label: 'Legend', type: 'toggle' });
    G({ path: Q('markers'), label: 'Markers on lines', type: 'toggle' }); G({ path: Q('height'), label: 'Own height', type: 'number', min: 0, placeholder: 'figure default' });
    G({ path: Q('palette'), label: 'Palette', type: 'palette' }); G({ path: Q('colors'), label: 'Custom colours', type: 'text' });
    const open = !closedPanels.has(key);
    body.el.append(card({
      id: key, title: '(' + String.fromCharCode(97 + pi) + ') ' + (p.title || 'Panel'), open, body: pb.el,
      toggle: () => { open ? closedPanels.add(key) : closedPanels.delete(key); refreshLeft(); },
      actions: [['↑', () => mutate(s => move(s.messages[i].blocks[bi].panels, pi, -1))], ['↓', () => mutate(s => move(s.messages[i].blocks[bi].panels, pi, 1))],
        ['⧉', () => mutate(s => { const ps = s.messages[i].blocks[bi].panels; ps.splice(pi + 1, 0, clone(ps[pi])); })], ['✕', () => mutate(s => s.messages[i].blocks[bi].panels.splice(pi, 1)), true]],
    }));
    body.syncs.push(...pb.syncs);
  });
  body.el.append(act('+ Add panel', () => { mutate(s => { (s.messages[i].blocks[bi].panels ||= []).push({ title: 'New panel', chartType: 'bar', csv: 'Group,Value\nA,1\nB,2\nC,3', yLabel: 'Value' }); }); refreshLeft(); }));
}
