// Flow-diagram DSL parser + layered layout. Pure and cycle-safe.
// Syntax: `A[Label] --> B(Label) : edge text`, `{diamond}`, `((circle))`, `[[stadium]]`,
//         `style A #hex`, `direction LR|TD`, `%% comment`.
export function parseDiagram(src) {
  const nodes = new Map(); const edges = []; let dir = 'LR';
  const ref = (tok) => {
    tok = tok.trim();
    const m = tok.match(/^([\w.-]+)\s*(?:\[\[(.*)\]\]|\(\((.*)\)\)|\[(.*)\]|\((.*)\)|\{(.*)\})?$/);
    if (!m) return null;
    const id = m[1];
    const label = m[2] ?? m[3] ?? m[4] ?? m[5] ?? m[6];
    const shape = m[2] != null ? 'stadium' : m[3] != null ? 'circle' : m[4] != null ? 'rect' : m[5] != null ? 'round' : m[6] != null ? 'diamond' : null;
    const cur = nodes.get(id) || { id, label: id, shape: 'rect', color: null };
    if (label != null) cur.label = label;
    if (shape) cur.shape = shape;
    nodes.set(id, cur);
    return id;
  };
  for (let line of String(src ?? '').split(/\r?\n|;/)) {
    line = line.replace(/%%.*$/, '').trim();
    if (!line) continue;
    let m;
    if ((m = line.match(/^direction\s+(LR|TD|TB|RL|BT)$/i))) { dir = /^(LR|RL)$/i.test(m[1]) ? 'LR' : 'TD'; continue; }
    if ((m = line.match(/^style\s+([\w.-]+)\s+(#[0-9a-f]{3,8})$/i))) {
      const n = nodes.get(m[1]) || { id: m[1], label: m[1], shape: 'rect' }; n.color = m[2]; nodes.set(m[1], n); continue;
    }
    const parts = line.split(/\s*(?:-->|==>|->|---|--)\s*/);
    if (parts.length === 1) { ref(parts[0]); continue; }
    let edgeLabel = null;
    const last = parts[parts.length - 1].match(/^(.*?)\s*:\s*(.+)$/);
    if (last) { parts[parts.length - 1] = last[1]; edgeLabel = last[2]; }
    const ids = parts.map(ref);
    for (let k = 0; k < ids.length - 1; k++) {
      if (ids[k] && ids[k + 1]) edges.push({ from: ids[k], to: ids[k + 1], label: k === ids.length - 2 ? edgeLabel : null });
    }
  }
  return { nodes: [...nodes.values()], edges, dir };
}

export function layoutDiagram(parsed, o = {}) {
  const { charW = 9, padX = 28, minW = 90, h = 52, gapX = 70, gapY = 34, margin = 16 } = o;
  const dir = o.dir || parsed.dir;
  const nodes = parsed.nodes.map(n => ({
    ...n, w: Math.max(minW, n.label.length * charW + padX * 2),
    h: n.shape === 'diamond' ? h + 14 : n.shape === 'circle' ? Math.max(h, 64) : h,
  }));
  const byId = new Map(nodes.map(n => [n.id, n]));
  const adj = new Map(nodes.map(n => [n.id, []]));
  parsed.edges.forEach(e => adj.get(e.from)?.push(e.to));
  // drop back edges via DFS so layering terminates on cycles
  const state = new Map(), back = new Set();
  const dfs = (u) => {
    state.set(u, 1);
    for (const v of adj.get(u)) { if (state.get(v) === 1) back.add(u + '>' + v); else if (!state.get(v)) dfs(v); }
    state.set(u, 2);
  };
  nodes.forEach(n => { if (!state.get(n.id)) dfs(n.id); });
  const fwd = parsed.edges.filter(e => !back.has(e.from + '>' + e.to) && e.from !== e.to && byId.has(e.from) && byId.has(e.to));
  const layer = new Map(nodes.map(n => [n.id, 0]));
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const e of fwd) if (layer.get(e.to) < layer.get(e.from) + 1) { layer.set(e.to, layer.get(e.from) + 1); changed = true; }
    if (!changed) break;
  }
  const layers = [];
  nodes.forEach(n => (layers[layer.get(n.id)] ||= []).push(n));
  for (let l = 1; l < layers.length; l++) {
    const pos = new Map((layers[l - 1] || []).map((n, i) => [n.id, i]));
    const bary = (n) => {
      const ps = fwd.filter(e => e.to === n.id && pos.has(e.from)).map(e => pos.get(e.from));
      return ps.length ? ps.reduce((x, y) => x + y) / ps.length : 0;
    };
    (layers[l] || []).sort((a, b) => bary(a) - bary(b));
  }
  const horiz = dir === 'LR';
  const sizes = layers.map(L => (L ? L.reduce((s, n) => s + (horiz ? n.h : n.w) + (horiz ? gapY : gapX), -(horiz ? gapY : gapX)) : 0));
  const cross = Math.max(0, ...sizes);
  let off = margin;
  layers.forEach((L, li) => {
    if (!L) return;
    const depth = Math.max(...L.map(n => (horiz ? n.w : n.h)));
    let c = margin + (cross - sizes[li]) / 2;
    L.forEach(n => {
      if (horiz) { n.x = off + (depth - n.w) / 2; n.y = c; c += n.h + gapY; }
      else { n.y = off + (depth - n.h) / 2; n.x = c; c += n.w + gapX; }
    });
    off += depth + (horiz ? gapX : gapY);
  });
  const width = horiz ? off - gapX + margin : cross + margin * 2;
  const height = horiz ? cross + margin * 2 : off - gapY + margin;
  const edges = parsed.edges.filter(e => byId.has(e.from) && byId.has(e.to)).map(e => {
    const a = byId.get(e.from), b = byId.get(e.to);
    const isBack = back.has(e.from + '>' + e.to) || e.from === e.to;
    let x1, y1, x2, y2;
    if (horiz) {
      x1 = a.x + a.w; y1 = a.y + a.h / 2; x2 = b.x; y2 = b.y + b.h / 2;
      if (x2 <= x1) { x1 = a.x + a.w / 2; y1 = a.y + a.h; x2 = b.x + b.w / 2; y2 = b.y + b.h; }
    } else {
      x1 = a.x + a.w / 2; y1 = a.y + a.h; x2 = b.x + b.w / 2; y2 = b.y;
      if (y2 <= y1) { x1 = a.x + a.w; y1 = a.y + a.h / 2; x2 = b.x + b.w; y2 = b.y + b.h / 2; }
    }
    return { ...e, x1, y1, x2, y2, back: isBack, horiz };
  });
  return { nodes, edges, width: Math.max(width, 1), height: Math.max(height, 1), dir };
}
