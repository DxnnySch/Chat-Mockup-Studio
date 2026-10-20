// SVG renderer for the flow-diagram DSL. Hover styles live in chat.css (work in exported HTML too).
import { parseDiagram, layoutDiagram } from '../diagramLayout.js';
import { esc } from '../markdown.js';

export function diagramSvg(block, { fs, theme, width }) {
  const th = theme.diagram;
  const f = fs * (th.fontScale || 0.72);
  const parsed = parseDiagram(block.src);
  if (!parsed.nodes.length) return `<div class="blk-placeholder" style="height:120px">Empty diagram — write e.g. <code>A[Start] --&gt; B[End]</code></div>`;
  // auto direction: prefer the DSL direction, flip to the other if the diagram would be shrunk to fit
  const dirs = block.dir ? [block.dir] : [parsed.dir, parsed.dir === 'LR' ? 'TD' : 'LR'];
  let lay = null, best = -1;
  for (const dir of dirs) {
    const L = layoutDiagram(parsed, { dir, charW: f * 0.6, padX: f * 1.1, minW: f * 4.2, h: f * 2.6, gapX: f * 2.4, gapY: f * 1.5, margin: f * 0.8 });
    const sc = Math.min(1, (width || L.width) / L.width);
    if (sc > best + 1e-6) { best = sc; lay = L; }
    if (sc >= 1) break;
  }
  const sw = Math.max(1.6, f * 0.1);
  const id = 'ar' + Math.random().toString(36).slice(2, 6);
  let g = `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="${f * 0.45}" markerHeight="${f * 0.45}" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${th.edgeColor}"/></marker></defs>`;
  lay.edges.forEach((e, i) => {
    const dx = Math.abs(e.x2 - e.x1) / 2, dy = Math.abs(e.y2 - e.y1) / 2;
    const c1 = e.horiz && !e.back ? [e.x1 + dx, e.y1, e.x2 - dx, e.y2] : !e.horiz && !e.back ? [e.x1, e.y1 + dy, e.x2, e.y2 - dy] : [e.x1, e.y1 + f * 2.2, e.x2, e.y2 + f * 2.2];
    g += `<g class="dg-edge" data-from="${esc(e.from)}" data-to="${esc(e.to)}"><path d="M${e.x1} ${e.y1}C${c1[0]} ${c1[1]} ${c1[2]} ${c1[3]} ${e.x2} ${e.y2}" fill="none" stroke="${th.edgeColor}" stroke-width="${sw}" ${e.back ? `stroke-dasharray="${f * 0.4} ${f * 0.3}"` : ''} marker-end="url(#${id})"/>`;
    if (e.label) {
      const mx = (e.x1 + e.x2) / 2, my = (e.y1 + e.y2) / 2 + (e.back ? f * 1.6 : 0), tw = e.label.length * f * 0.58 + f;
      g += `<rect x="${mx - tw / 2}" y="${my - f * 0.8}" width="${tw}" height="${f * 1.4}" rx="${f * 0.3}" fill="${theme.colors.surface}" opacity="0.92"/><text x="${mx}" y="${my + f * 0.25}" text-anchor="middle" font-size="${f * 0.9}" fill="${th.edgeColor}" font-weight="600">${esc(e.label)}</text>`;
    }
    g += '</g>';
  });
  lay.nodes.forEach(n => {
    const stroke = n.color || th.nodeBorder, fill = n.color ? n.color + '22' : th.nodeBg;
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    let shape;
    if (n.shape === 'diamond') shape = `<polygon points="${cx},${n.y} ${n.x + n.w},${cy} ${cx},${n.y + n.h} ${n.x},${cy}"/>`;
    else if (n.shape === 'circle') shape = `<ellipse cx="${cx}" cy="${cy}" rx="${n.w / 2}" ry="${n.h / 2}"/>`;
    else if (n.shape === 'round' || n.shape === 'stadium') shape = `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${n.shape === 'stadium' ? n.h / 2 : n.h * 0.3}"/>`;
    else shape = `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${f * 0.25}"/>`;
    g += `<g class="dg-node" data-id="${esc(n.id)}"><g fill="${fill}" stroke="${stroke}" stroke-width="${sw * 1.2}">${shape}</g><text x="${cx}" y="${cy + f * 0.35}" text-anchor="middle" font-size="${f}" font-weight="600" fill="${th.nodeText}">${esc(n.label)}</text><title>${esc(n.label)} (${esc(n.id)})</title></g>`;
  });
  const maxW = width || lay.width;
  const H = lay.height + (lay.edges.some(e => e.back) ? f * 3 : 0);   // back edges bow out below the nodes
  return `<svg class="diagram-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lay.width} ${H}" width="${Math.round(lay.width)}" height="${Math.round(H)}" style="max-width:${Math.min(100, Math.round(lay.width / maxW * 100) || 100)}%;max-width:100%;height:auto;font-family:inherit">${g}</svg>`;
}
