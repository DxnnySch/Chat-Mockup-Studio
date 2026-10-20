// Observable store with undo/redo (snapshot based) and IndexedDB persistence.
import { clone, getPath, setPath, debounce } from './util.js';

export function createStore(initial) {
  let state = clone(initial);
  const subs = new Set();
  const past = [], future = [];
  let lastKey = null, lastAt = 0;
  const notify = (meta) => subs.forEach(fn => fn(state, meta));

  function snapshot(coalesceKey) {
    const now = Date.now();
    if (coalesceKey && coalesceKey === lastKey && now - lastAt < 800) { lastAt = now; return; }
    past.push(clone(state)); if (past.length > 100) past.shift();
    future.length = 0; lastKey = coalesceKey || null; lastAt = now;
  }
  return {
    get: () => state,
    path: (p, d) => getPath(state, p, d),
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    /** Set a single path. `key` coalesces rapid edits (typing, sliders) into one undo step. */
    set(path, value, key) {
      snapshot(key === undefined ? 'set:' + path : key);
      setPath(state, path, value); notify({ path });
    },
    /** Mutate with a function (arrays, reorder...). */
    update(fn, key) { snapshot(key); fn(state); notify({}); },
    /** Replace the whole project (open/import/reset); undoable. */
    replace(next) { snapshot(null); state = clone(next); notify({ replaced: true }); },
    undo() { if (!past.length) return false; future.push(clone(state)); state = past.pop(); lastKey = null; notify({ replaced: true }); return true; },
    redo() { if (!future.length) return false; past.push(clone(state)); state = future.pop(); lastKey = null; notify({ replaced: true }); return true; },
    canUndo: () => past.length > 0, canRedo: () => future.length > 0,
  };
}

// ---- persistence (IndexedDB key/value) ----
const DB = 'custom-chat-studio';
function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function tx(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction('kv', mode); const out = fn(t.objectStore('kv'));
    t.oncomplete = () => { db.close(); res(out.result); }; t.onerror = () => { db.close(); rej(t.error); };
  });
}
export const kvGet = (k) => tx('readonly', s => s.get(k)).catch(() => undefined);
export const kvSet = (k, v) => tx('readwrite', s => s.put(v, k)).catch(() => undefined);
export const kvDel = (k) => tx('readwrite', s => s.delete(k)).catch(() => undefined);
export const kvKeys = (prefix) => tx('readonly', s => s.getAllKeys()).then(ks => ks.filter(k => String(k).startsWith(prefix))).catch(() => []);

export function autosave(store, key = 'current') {
  const save = debounce(() => kvSet(key, JSON.stringify(store.get())), 400);
  store.subscribe(save);
  addEventListener('beforeunload', () => save.flush());
  return save;
}
