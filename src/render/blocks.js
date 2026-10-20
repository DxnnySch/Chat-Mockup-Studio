// Content-block renderers: each returns an HTML string. All user text goes through esc()/markdown().
import { markdown, inline, esc } from '../markdown.js';
import { highlight } from '../highlight.js';
import { parseCSV } from '../chartMath.js';
import { icon } from './icons.js';
import { chartSvg } from './charts.js';
import { diagramSvg } from './diagram.js';
import { sanitizeSvg } from '../sanitizeSvg.js';

export const px = (n) => `${Math.round(n * 100) / 100}px`;

export function resolveSrc(ctx, v) {
  if (!v) return '';
  if (typeof v === 'string' && v.startsWith('asset:')) return ctx.project.assets?.[v.slice(6)]?.data || '';
  return String(v);
}
const posterOf = (ctx, b) => {
  if (b.poster) return resolveSrc(ctx, b.poster);
  if (typeof b.src === 'string' && b.src.startsWith('asset:')) return ctx.project.assets?.[b.src.slice(6)]?.poster || '';
  return '';
};
const caption = (ctx, b) => (b.caption ? `<figcaption style="font-size:${px(ctx.fs * ctx.theme.media.captionScale)}">${inline(b.caption)}</figcaption>` : '');
const mediaStyle = (ctx, b) => {
  const m = ctx.theme.media;
  return `border-radius:${px(b.radius ?? m.radius)};border:${b.border ?? m.borderWidth}px solid ${m.borderColor};`;
};

const CALLOUT = {
  info: ['#2563eb', 'info'], warn: ['#b45309', 'warn'], success: ['#15803d', 'check'], error: ['#b91c1c', 'error'], note: ['#6b7280', 'quote'],
};

export const BLOCKS = {
  text: (b) => `<div class="blk blk-text">${markdown(b.text)}</div>`,

  code(b, ctx) {
    const t = ctx.theme.code, c = ctx.theme.colors;
    const head = t.showHeader && (b.lang || b.filename)
      ? `<div class="code-head" style="font-size:${px(ctx.fs * t.scale * 0.85)}"><span>${esc(b.filename || b.lang)}</span><span class="code-copy">${icon('copy', ctx.fs * t.scale * 0.95)} Copy</span></div>` : '';
    const lines = String(b.code ?? '').split('\n');
    const body = t.lineNumbers
      ? lines.map((l, i) => `<span class="ln">${i + 1}</span>${highlight(l, b.lang)}`).join('\n')
      : highlight(b.code, b.lang);
    return `<div class="blk blk-code" style="border-radius:${px(t.radius)};background:${c.codeBg};color:${c.codeText}">${head}<pre style="font-size:${px(ctx.fs * t.scale)};font-family:${esc(ctx.theme.font.mono)}"><code>${body}</code></pre></div>`;
  },

  image(b, ctx) {
    const src = resolveSrc(ctx, b.src);
    const w = b.width ?? 100;
    const inner = src
      ? `<img src="${esc(src)}" alt="${esc(b.alt || '')}" style="width:100%;${b.height ? `height:${+b.height}px;object-fit:${b.fit || 'cover'};` : 'height:auto;'}display:block;${mediaStyle(ctx, b)}">`
      : `<div class="img-ph" style="aspect-ratio:${esc(b.aspect || '16/9')};${mediaStyle(ctx, b)}">${icon('image', ctx.fs * 1.8)}<span>${esc(b.placeholder || 'Image')}</span></div>`;
    return `<figure class="blk blk-fig" style="width:${w}%;margin-left:${b.align === 'center' ? 'auto' : 0};margin-right:${b.align === 'center' ? 'auto' : 0}">${inner}${caption(ctx, b)}</figure>`;
  },

  video(b, ctx) {
    const poster = posterOf(ctx, b);
    const showCtl = b.controls !== false;
    const prog = Math.max(0, Math.min(100, +b.progress || 0));
    const s = ctx.fs * 0.7;
    const ctl = showCtl ? `<div class="vid-ctl" style="font-size:${px(s)}">${icon('play', s * 1.3, '#fff')}<div class="vid-track"><i style="width:${prog}%"></i><b style="left:${prog}%"></b></div><span>${esc(b.time || '0:00 / 0:30')}</span>${icon('speak', s * 1.3, '#fff')}</div>` : '';
    const big = b.bigPlay !== false ? `<div class="vid-play" style="width:${px(ctx.fs * 2.6)};height:${px(ctx.fs * 2.6)}">${icon('play', ctx.fs * 1.3, '#fff')}</div>` : '';
    const bg = poster ? `<img src="${esc(poster)}" alt="" style="width:100%;display:block;${b.height ? `height:${+b.height}px;object-fit:cover;` : ''}">`
      : `<div class="vid-ph" style="aspect-ratio:${esc(b.aspect || '16/9')}"></div>`;
    return `<figure class="blk blk-fig" style="width:${b.width ?? 100}%"><div class="video" style="${mediaStyle(ctx, b)}">${bg}${big}${ctl}</div>${caption(ctx, b)}</figure>`;
  },

  table(b, ctx) {
    const rows = parseCSV(b.csv);
    if (!rows.length) return '<div class="blk-placeholder">Empty table</div>';
    const hasHead = b.header !== false;
    const isNum = (v) => v !== '' && !isNaN(parseFloat(String(v).replace(',', '.'))) && /^[-+\d.,%\s±×e]+$/i.test(v);
    const cell = (tag, v, ci) => `<${tag} style="text-align:${isNum(v) ? 'right' : 'left'}">${inline(v)}</${tag}>`;
    const thead = hasHead ? `<thead><tr>${rows[0].map((v, i) => cell('th', v, i)).join('')}</tr></thead>` : '';
    const body = rows.slice(hasHead ? 1 : 0).map(r => `<tr>${r.map((v, i) => cell('td', v, i)).join('')}</tr>`).join('');
    return `<figure class="blk blk-fig"><div class="tbl-wrap" style="border-radius:${px(ctx.theme.media.radius * 0.6)}"><table class="tbl ${b.striped !== false ? 'striped' : ''}" style="font-size:${px(ctx.fs * 0.82)}">${thead}<tbody>${body}</tbody></table></div>${caption(ctx, b)}</figure>`;
  },

  chart(b, ctx) {
    const title = b.title ? `<div class="chart-title" style="font-size:${px(ctx.fs * 0.85)}">${inline(b.title)}</div>` : '';
    return `<figure class="blk blk-fig blk-chart">${title}${chartSvg(b, { width: ctx.availW * ((b.width ?? 100) / 100), fs: ctx.fs, theme: ctx.theme })}${caption(ctx, b)}</figure>`;
  },

  diagram(b, ctx) {
    return `<figure class="blk blk-fig blk-diagram">${b.title ? `<div class="chart-title" style="font-size:${px(ctx.fs * 0.85)}">${inline(b.title)}</div>` : ''}${diagramSvg(b, { fs: ctx.fs, theme: ctx.theme, width: ctx.availW })}${caption(ctx, b)}</figure>`;
  },

  callout(b, ctx) {
    const [c, ic] = CALLOUT[b.kind] || CALLOUT.info;
    return `<div class="blk blk-callout" style="border-left:${px(ctx.fs * 0.22)} solid ${c};background:${c}1f;border-radius:${px(ctx.fs * 0.35)}"><div class="co-ic" style="color:${c}">${icon(ic, ctx.fs * 1.1)}</div><div class="co-body">${b.title ? `<div class="co-title" style="color:${c}">${inline(b.title)}</div>` : ''}${markdown(b.text)}</div></div>`;
  },

  file(b, ctx) {
    const c = ctx.theme.chip;
    return `<div class="blk blk-file" style="border:1px solid ${c.borderColor};border-radius:${px(ctx.fs * 0.6)};background:${c.bg}"><span class="file-ic" style="background:${ctx.theme.colors.accent}">${icon('file', ctx.fs * 1.1, '#fff')}</span><span><b>${esc(b.name || 'document.pdf')}</b><br><small style="color:${ctx.theme.colors.muted}">${esc(b.size || '1.2 MB')}${b.kind ? ' · ' + esc(b.kind) : ''}</small></span></div>`;
  },

  quote(b, ctx) {
    return `<blockquote class="blk blk-quote" style="border-left:${px(ctx.fs * 0.2)} solid ${ctx.theme.colors.accent}">${markdown(b.text)}${b.cite ? `<cite style="color:${ctx.theme.colors.muted}">— ${inline(b.cite)}</cite>` : ''}</blockquote>`;
  },

  tool(b, ctx) {
    const c = ctx.theme.colors; const st = b.status || 'done';
    const col = st === 'error' ? '#b91c1c' : st === 'running' ? '#b45309' : '#15803d';
    return `<div class="blk blk-tool" style="border:1px solid ${c.border};border-radius:${px(ctx.fs * 0.6)}"><div class="tool-head" style="font-size:${px(ctx.fs * 0.82)}">${icon('tool', ctx.fs * 0.95)}<b>${esc(b.name || 'tool')}</b><span class="tool-st" style="color:${col};border-color:${col}">${esc(st)}</span></div>${b.args ? `<pre style="font-size:${px(ctx.fs * 0.74)};font-family:${esc(ctx.theme.font.mono)};background:${c.codeBg}">${esc(b.args)}</pre>` : ''}${b.result ? `<pre style="font-size:${px(ctx.fs * 0.74)};font-family:${esc(ctx.theme.font.mono)};background:${c.codeBg}">${esc(b.result)}</pre>` : ''}</div>`;
  },

  /** Multi-panel scientific figure: panels share the chart spec (chartType, csv, trend, showR, @right axis …). */
  figure(b, ctx) {
    const panels = (b.panels || []).slice(0, 6);
    if (!panels.length) return '<div class="blk-placeholder">Figure without panels — add one in the editor.</div>';
    const layout = b.layout || 'row';
    const cols = layout === 'col' ? 1 : layout === 'grid' ? Math.min(2, panels.length) : Math.min(panels.length, 3);
    const gap = ctx.fs * 1.1;
    const total = ctx.availW * ((b.width ?? 100) / 100);
    const panelW = (total - gap * (cols - 1)) / cols;
    const body = panels.map((p, i) => {
      const letter = b.letters === false ? '' : `<b class="fig-letter">(${esc(p.letter || String.fromCharCode(97 + i))})</b> `;
      const t = p.title ? inline(p.title) : '';
      return `<div class="fig-panel" style="min-width:0"><div class="fig-ptitle" style="font-size:${px(ctx.fs * 0.82)}">${letter}${t}</div>${chartSvg({ height: b.panelHeight || 260, ...p }, { width: panelW, fs: ctx.fs, theme: ctx.theme })}</div>`;
    }).join('');
    return `<figure class="blk blk-fig blk-figure">${b.title ? `<div class="chart-title" style="font-size:${px(ctx.fs * 0.9)}">${inline(b.title)}</div>` : ''}<div class="fig-grid" style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:${px(gap)};width:${b.width ?? 100}%">${body}</div>${caption(ctx, b)}</figure>`;
  },

  /** Free-form vector figure (typically written by the LLM). Sanitised: no scripts, links, images or external refs. */
  svg(b, ctx) {
    let svg;
    try { svg = sanitizeSvg(b.code); } catch (e) { return `<div class="blk-placeholder">${esc(e.message)} Paste or generate SVG code in the editor.</div>`; }
    return `<figure class="blk blk-fig blk-svg" style="width:${b.width ?? 100}%">${b.title ? `<div class="chart-title" style="font-size:${px(ctx.fs * 0.9)}">${inline(b.title)}</div>` : ''}<div class="svg-wrap">${svg}</div>${caption(ctx, b)}</figure>`;
  },

  divider: (b, ctx) => `<hr class="blk" style="border:0;border-top:1px solid ${ctx.theme.colors.border}">`,
};

export const BLOCK_TYPES = Object.keys(BLOCKS);

export function renderBlock(b, ctx) {
  const fn = BLOCKS[b.type];
  if (!fn) return `<div class="blk-placeholder">Unknown block "${esc(b.type)}"</div>`;
  try { return `<div class="bwrap" data-bid="${esc(b.id)}">${fn(b, ctx)}</div>`; }
  catch (e) { return `<div class="blk-placeholder">Block error: ${esc(e.message)}</div>`; }
}
