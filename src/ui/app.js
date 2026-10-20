// Shared mutable app context (store + UI selection) used by all UI modules.
export const app = {
  store: null,
  sel: { msg: null, block: null, anno: null },
  listeners: new Set(),
  toast(msg, err = false) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = 'show' + (err ? ' err' : '');
    clearTimeout(app._tt); app._tt = setTimeout(() => (t.className = ''), err ? 4500 : 2200);
  },
  /** Called by modules when selection changes so other panels can refresh. */
  select(patch) { Object.assign(app.sel, patch); app.listeners.forEach(fn => fn(app.sel)); },
  onSelect(fn) { app.listeners.add(fn); },
  videoFiles: new Map(), // blockId -> object URL (session only; used to grab frames)
};

export function readFile(file, as = 'dataURL') {
  return new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error);
    as === 'text' ? r.readAsText(file) : r.readAsDataURL(file);
  });
}
const AID = () => 'a' + Math.random().toString(36).slice(2, 9);
/** Store an uploaded file as a project asset, returns 'asset:<id>'. */
export async function addAsset(file, extra = {}) {
  const data = await readFile(file);
  const id = AID();
  app.store.update(s => { s.assets[id] = { name: file.name, type: file.type, data, ...extra }; }, 'asset');
  return 'asset:' + id;
}
