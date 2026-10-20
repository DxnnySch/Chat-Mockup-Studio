// Bootstrap: load project, wire store → renderer, panels, toolbar and menus.
import { createStore, autosave, kvGet, kvSet, kvDel, kvKeys } from './state.js';
import { newProject, normalizeProject } from './defaults.js';
import { renderChat } from './render/chat.js';
import { app, readFile } from './ui/app.js';
import { buildLeft, refreshLeft, focusBlock } from './ui/messages.js';
import { buildRight, rebuildRight, setTab, refreshPoster } from './ui/inspector.js';
import { installAnnotationDrag } from './ui/annotations.js';
import { h } from './ui/fields.js';
import { exportPng, copyPng, exportSvg, exportHtml, exportJson, printPdf } from './export.js';
import { uid } from './util.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage'), scaler = $('scaler'), viewport = $('viewport');
const ui = { zoom: 1, preview: false, exporting: false };

async function loadInitial() {
  try {
    const raw = await kvGet('current');
    if (raw) return normalizeProject(JSON.parse(raw));
  } catch (e) { console.warn('Could not restore saved project:', e); }
  return newProject();
}

function doRender() {
  const p = app.store.get();
  renderChat(p, stage, { selectedId: app.sel.msg, selectedAnno: app.sel.anno, editing: !ui.preview && !ui.exporting, exporting: ui.exporting });
  if (!ui.exporting) {
    stage.style.transform = `scale(${ui.zoom})`;
    scaler.style.width = stage.offsetWidth * ui.zoom + 'px';
    scaler.style.height = stage.offsetHeight * ui.zoom + 'px';
  } else { stage.style.transform = 'none'; }
  $('zoomLabel').textContent = Math.round(ui.zoom * 100) + '%';
  document.title = `${p.name} — Chat Mockup Studio`;
}
let raf = 0, posterT = 0;
function schedule() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0; doRender();
    clearTimeout(posterT); posterT = setTimeout(refreshPoster, 250);
  });
}

app.withCleanStage = async (fn) => {
  ui.exporting = true; doRender();
  try { return await fn(stage); } finally { ui.exporting = false; doRender(); }
};
app.rebuildPanels = () => { refreshLeft(); rebuildRight(); $('projName').value = app.store.get().name; };

function fit() {
  const w = viewport.clientWidth - 64;
  ui.zoom = Math.max(0.1, Math.min(2, w / stage.offsetWidth));
  doRender();
}
function setZoom(z) { ui.zoom = Math.max(0.1, Math.min(3, z)); doRender(); }

function toolbar() {
  $('btnUndo').onclick = () => { app.store.undo(); };
  $('btnRedo').onclick = () => { app.store.redo(); };
  $('zoomIn').onclick = () => setZoom(ui.zoom * 1.15);
  $('zoomOut').onclick = () => setZoom(ui.zoom / 1.15);
  $('zoomFit').onclick = fit;
  $('chkPreview').onchange = (e) => { ui.preview = e.target.checked; doRender(); };
  $('projName').oninput = (e) => app.store.set('name', e.target.value);
  viewport.addEventListener('wheel', (e) => { if (e.ctrlKey) { e.preventDefault(); setZoom(ui.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)); } }, { passive: false });
  addEventListener('keydown', (e) => {
    const t = e.target; if (t.matches?.('input, textarea, select')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? app.store.redo() : app.store.undo(); }
    else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); app.store.redo(); }
    else if (e.key === 'Delete' && app.sel.anno) { app.store.update(s => (s.annotations = s.annotations.filter(a => a.id !== app.sel.anno))); app.select({ anno: null }); rebuildRight(); }
  });
}

function menu(id, build) {
  const m = $(id), btn = m.querySelector('.menu-btn'), pop = m.querySelector('.menu-pop');
  btn.onclick = async (e) => {
    e.stopPropagation();
    const was = m.classList.contains('open');
    document.querySelectorAll('.menu.open').forEach(x => x.classList.remove('open'));
    if (!was) { pop.innerHTML = ''; await build(pop, () => m.classList.remove('open')); m.classList.add('open'); }
  };
  pop.onclick = (e) => e.stopPropagation();
}
const item = (label, fn, close) => h('button', { onclick: async () => { close?.(); try { await fn(); } catch (e) { console.error(e); app.toast(String(e.message || e), true); } } }, label);

function menus() {
  addEventListener('click', () => document.querySelectorAll('.menu.open').forEach(x => x.classList.remove('open')));
  menu('menuExport', (pop, close) => {
    const s = app.store.get();
    pop.append(
      h('div', { class: 'mhead' }, 'Image'),
      h('div', { class: 'mrow' }, 'Scale ×', h('input', { type: 'number', min: 1, max: 8, step: 0.5, value: s.canvas.exportScale, oninput: (e) => app.store.set('canvas.exportScale', +e.target.value || 1, 'xs') }),
        h('small', { style: 'color:var(--ui-muted)' }, `${Math.round(s.canvas.width * s.canvas.exportScale)} px wide`)),
      item('⬇ PNG', exportPng, close), item('⧉ Copy PNG to clipboard', copyPng, close),
      item('⬇ SVG (vector container)', exportSvg, close),
      h('hr'), h('div', { class: 'mhead' }, 'Document'),
      item('⬇ Standalone interactive HTML', exportHtml, close), item('🖨 Print / save as PDF…', printPdf, close),
      h('hr'), item('⬇ Project file (.json)', exportJson, close));
  });
  menu('menuProject', async (pop, close) => {
    pop.append(
      item('New — sample conversation', () => confirmReplace(newProject()), close),
      item('New — empty conversation', () => { const p = newProject(); p.messages = []; p.name = 'Untitled mockup'; confirmReplace(p); }, close),
      h('hr'), item('Import project (.json)…', () => $('fileOpen').click(), close),
      item('Save to browser as…', async () => {
        const name = prompt('Save project as:', app.store.get().name); if (!name) return;
        await kvSet('proj:' + name, JSON.stringify(app.store.get())); app.toast('Saved “' + name + '” in this browser');
      }, close), h('hr'), h('div', { class: 'mhead' }, 'Saved in this browser'));
    const keys = await kvKeys('proj:');
    if (!keys.length) pop.append(h('div', { class: 'mrow', style: 'color:var(--ui-muted)' }, 'Nothing saved yet'));
    keys.forEach(k => pop.append(h('div', { class: 'mrow' },
      h('button', { style: 'flex:1', onclick: async () => { close(); const raw = await kvGet(k); try { app.store.replace(normalizeProject(JSON.parse(raw))); app.rebuildPanels(); } catch (e) { app.toast('Could not open: ' + e.message, true); } } }, String(k).slice(5)),
      h('button', { class: 'small danger', onclick: async (e) => { await kvDel(k); e.target.parentElement.remove(); } }, '✕'))));
  });
  $('fileOpen').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { app.store.replace(normalizeProject(JSON.parse(await readFile(f, 'text')))); app.rebuildPanels(); fit(); app.toast('Imported ' + f.name); }
    catch (err) { app.toast('Import failed: ' + err.message, true); }
    e.target.value = '';
  };
}
function confirmReplace(p) { if (confirm('Replace the current project? (You can undo with Ctrl+Z.)')) { app.store.replace(p); app.sel.msg = null; app.rebuildPanels(); fit(); } }

function stageClicks() {
  stage.addEventListener('click', (e) => {
    if (!stage.classList.contains('editing')) return;
    const an = e.target.closest('[data-aid]');
    if (an) { app.select({ anno: an.dataset.aid }); setTab('notes'); return; }
    const msg = e.target.closest('.msg'); if (!msg) return;
    const patch = { msg: msg.dataset.mid, anno: null };
    const bw = e.target.closest('.bwrap');
    if (bw) patch.block = bw.dataset.bid;
    app.select(patch); refreshLeft();
    if (bw) focusBlock(bw.dataset.bid);
  });
  installAnnotationDrag(stage, () => ui.zoom);
}

async function main() {
  app.store = createStore(await loadInitial());
  autosave(app.store);
  app.store.subscribe((_, meta) => {
    schedule();
    $('btnUndo').disabled = !app.store.canUndo(); $('btnRedo').disabled = !app.store.canRedo();
    if (meta.replaced) app.rebuildPanels();
  });
  app.onSelect(() => schedule());
  buildLeft($('left')); buildRight($('right'));
  $('projName').value = app.store.get().name;
  toolbar(); menus(); stageClicks();
  doRender(); fit();
  addEventListener('resize', () => schedule());
  document.fonts?.ready.then(schedule);
  window.__app = app; // handy for debugging & the e2e test
  document.body.dataset.ready = '1';
}
main().catch(e => { console.error(e); document.body.prepend(h('pre', { style: 'color:#b00;padding:20px' }, 'Startup error: ' + e.stack)); });
