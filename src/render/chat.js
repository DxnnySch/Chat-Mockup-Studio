// Renders a project into the #stage element. Pure function of the project (+ selection for editor outlines).
import { merge } from '../util.js';
import { esc, inline } from '../markdown.js';
import { icon } from './icons.js';
import { renderBlock, px, resolveSrc } from './blocks.js';

const SHADOW = { none: 'none', sm: '0 1px 4px rgba(0,0,0,.14)', md: '0 4px 16px rgba(0,0,0,.16)', lg: '0 14px 36px rgba(0,0,0,.22)' };

function avatarHtml(av, size, theme, ctx) {
  const A = theme.avatar;
  const radius = A.shape === 'circle' ? '50%' : A.shape === 'rounded' ? '24%' : '4px';
  const ring = A.ring ? `box-shadow:0 0 0 ${A.ring}px ${A.ringColor};` : '';
  let inner;
  const imgSrc = resolveSrc(ctx, av.image);
  if (av.type === 'image' && imgSrc) inner = `<img src="${esc(imgSrc)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block">`;
  else if (av.type === 'emoji') inner = `<span style="font-size:${px(size * 0.55)};line-height:1">${esc(av.value)}</span>`;
  else if (av.type === 'icon') inner = icon(av.value || 'spark', size * 0.56, av.color);
  else inner = `<span style="font-size:${px(size * 0.38)};font-weight:700;letter-spacing:.02em">${esc(String(av.value || '?').slice(0, 3))}</span>`;
  return `<div class="avatar" style="width:${px(size)};height:${px(size)};border-radius:${radius};background:${av.bg};color:${av.color};${ring}">${inner}</div>`;
}

function sourcesHtml(m, theme, fs) {
  const S = theme.sources, list = m.sources || [];
  if (!list.length) return '';
  const sz = fs * S.scale, c = theme.colors;
  const title = S.title ? `<div class="src-title" style="font-size:${px(sz)};color:${c.muted}">${icon('link', sz, c.muted)} ${esc(S.title)}</div>` : '';
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const idx = (i) => (S.showIndex ? `<span class="src-idx" style="background:${c.accent};width:${px(sz * 1.35)};height:${px(sz * 1.35)};font-size:${px(sz * 0.85)}">${i + 1}</span>` : '');
  let body;
  if (S.style === 'chips') {
    body = `<div class="src-chips">${list.map((s, i) => `<span class="chip" style="font-size:${px(sz)};background:${theme.chip.bg};color:${theme.chip.color};border:1px solid ${theme.chip.borderColor};border-radius:${theme.chip.radius}px">${idx(i)}${esc(s.site || host(s.url) || s.title)}${s.year ? ` <span style="color:${c.muted}">${esc(s.year)}</span>` : ''}</span>`).join('')}</div>`;
  } else if (S.style === 'footnotes') {
    body = `<ol class="src-foot" style="font-size:${px(sz)};color:${c.muted}">${list.map((s, i) => `<li value="${i + 1}"><span class="fn-n">[${i + 1}]</span> ${s.authors ? esc(s.authors) + ' ' : ''}${s.year ? `(${esc(s.year)}). ` : ''}<i>${esc(s.title)}</i>${s.site ? '. ' + esc(s.site) : ''}${s.url ? '. ' + esc(s.url) : ''}</li>`).join('')}</ol>`;
  } else {
    body = `<div class="src-cards" style="grid-template-columns:repeat(${Math.max(1, S.columns | 0)},minmax(0,1fr))">${list.map((s, i) => `<div class="src-card" style="font-size:${px(sz)};background:${theme.chip.bg};border:1px solid ${theme.chip.borderColor};border-radius:${px(Math.min(theme.chip.radius, 18))}">
      <div class="src-top">${idx(i)}<span class="src-site" style="color:${c.muted}">${S.showSite ? esc(s.site || host(s.url)) : ''}${s.year ? ' · ' + esc(s.year) : ''}</span>${s.tag ? `<span class="src-tag" style="border-color:${c.accent};color:${c.accent}">${esc(s.tag)}</span>` : ''}</div>
      <div class="src-name" style="color:${theme.chip.color}">${esc(s.title)}</div>
      ${s.authors ? `<div style="color:${c.muted}">${esc(s.authors)}</div>` : ''}
      ${S.showSnippet && s.snippet ? `<div class="src-snip" style="color:${c.muted}">${esc(s.snippet)}</div>` : ''}</div>`).join('')}</div>`;
  }
  return `<div class="sources">${title}${body}</div>`;
}

function metaItems(m, theme) {
  const M = m.meta || {}, F = theme.meta.fields || ['model', 'latency', 'tokens', 'confidence', 'date', 'custom'];
  const L = { model: 'Model', latency: 'Latency', tokens: 'Tokens', confidence: 'Confidence', date: 'Date' };
  const out = [];
  for (const k of ['model', 'latency', 'tokens', 'confidence', 'date']) {
    if (F.includes(k) && M[k]) out.push(theme.meta.showLabels ? `${L[k]}: ${M[k]}` : (k === 'confidence' ? `${M[k]} confidence` : M[k]));
  }
  if (F.includes('custom')) (M.custom || []).forEach(c => { if (c && (c.k || c.v)) out.push(c.k ? `${c.k}: ${c.v}` : c.v); });
  return out;
}

function messageHtml(m, project, base) {
  const { theme, canvasInner } = base;
  const role = m.role === 'user' ? 'user' : 'assistant';
  const R = merge(theme[role], m.style || {});
  const part = project.participants[role];
  const av = merge(part.avatar, m.avatar || {});
  const fs = theme.font.size * R.fontScale;
  const c = theme.colors;
  const showAvatar = theme.avatar.show && !m.hideAvatar;
  const side = showAvatar && theme.avatar.position === 'side';
  const top = showAvatar && theme.avatar.position === 'top';
  const colW = canvasInner - (side ? theme.avatar.size + theme.avatar.gap : 0);
  const availW = colW * (R.maxWidth / 100) - 2 * R.padX - 2 * R.borderWidth;
  const ctx = { project, theme, fs, availW };

  const layout = R.layout;
  const hasBox = layout !== 'plain';
  const bg = hasBox ? R.bg : 'transparent';
  const border = layout === 'card' ? Math.max(1, R.borderWidth) : R.borderWidth;
  const shadow = layout === 'card' && R.shadow === 'none' ? 'sm' : R.shadow;
  const boxStyle = `background:${bg};color:${R.color};border-radius:${px(R.radius)};padding:${px(R.padY)} ${px(R.padX)};border:${border}px solid ${R.borderColor};box-shadow:${SHADOW[shadow] || 'none'};max-width:${R.maxWidth}%;font-size:${px(fs)};`;

  // head: name / time / inline meta
  const showName = theme.names.show && (role === 'assistant' || theme.names.showForUser);
  const items = metaItems(m, theme);
  const inlineMeta = theme.meta.show && theme.meta.position === 'inline' && items.length;
  let head = '';
  if (showName || top || (theme.time.show && m.time) || inlineMeta) {
    head = `<div class="msg-head" style="font-size:${px(theme.font.size * theme.names.scale)};color:${c.muted}">`
      + (top ? avatarHtml(av, theme.avatar.size * 0.62, theme, ctx) : '')
      + (showName ? `<span class="msg-name" style="font-weight:${theme.names.weight};color:${c.text};${theme.names.uppercase ? 'text-transform:uppercase;letter-spacing:.06em;' : ''}">${esc(m.name || part.name)}</span>` : '')
      + (theme.time.show && m.time ? `<span class="msg-time" style="font-size:${px(theme.font.size * theme.time.scale)}">${esc(m.time)}</span>` : '')
      + (inlineMeta ? `<span class="msg-meta-inline" style="font-size:${px(theme.font.size * theme.meta.scale)}">${esc(items.join(theme.meta.separator))}</span>` : '')
      + (m.edited ? `<span class="msg-edited">(edited)</span>` : '') + '</div>';
  }

  // body
  let inner = '';
  if (m.typing) {
    inner = `<div class="typing" style="height:${px(fs)}"><i></i><i></i><i></i></div>`;
  } else {
    if (m.thinking && (m.thinking.text || m.thinking.duration)) {
      const T = theme.thinking, open = m.thinking.open;
      inner += `<div class="think" style="background:${T.bg};color:${T.color};border:1px solid ${T.borderColor};font-size:${px(fs * T.scale)}"><div class="think-head">${icon('brain', fs * T.scale * 1.1)}<span>${esc(m.thinking.label || 'Thought for')} ${m.thinking.duration ? esc(m.thinking.duration) + ' s' : ''}</span><span class="think-chev" style="transform:rotate(${open ? 90 : 0}deg)">${icon('chevron', fs * T.scale)}</span></div>${open ? `<div class="think-body">${inline(m.thinking.text || '').replace(/\n/g, '<br>')}</div>` : ''}</div>`;
    }
    let blocks = (m.blocks || []).map(b => renderBlock(b, ctx)).join('');
    if (m.cursor) {
      const caret = `<span class="caret" style="background:${R.color}"></span>`;
      blocks = /<\/(p|li)>(?![\s\S]*<\/(p|li)>)/.test(blocks) ? blocks.replace(/<\/(p|li)>(?![\s\S]*<\/(p|li)>)/, caret + '</$1>') : blocks + caret;
    }
    inner += blocks;
    if (m.error) inner += `<div class="msg-error" style="font-size:${px(fs * 0.85)}">${icon('error', fs * 0.95)} ${esc(m.error)}</div>`;
  }
  const badge = m.annotation ? `<span class="msg-badge" style="background:${base.badgeColor};width:${px(fs * 1.5)};height:${px(fs * 1.5)};font-size:${px(fs * 0.85)};${role === 'user' ? 'right' : 'left'}:${px(-fs * 0.6)}">${esc(m.annotation)}</span>` : '';
  const bubble = `<div class="bubble layout-${layout}" style="${boxStyle}">${badge}${inner}</div>`;

  // footer parts
  let foot = '';
  if (!m.typing) {
    if (m.sources?.length) foot += sourcesHtml(m, theme, theme.font.size);
    if (theme.meta.show && theme.meta.position === 'below' && items.length) {
      foot += `<div class="msg-meta" style="font-size:${px(theme.font.size * theme.meta.scale)};color:${c.muted}">${esc(items.join(theme.meta.separator))}</div>`;
    }
    const showActions = m.actionsMode === 'on' || (m.actionsMode !== 'off' && role === 'assistant' && theme.actions.show);
    const A = theme.actions, asz = theme.font.size * A.scale;
    const v = m.versions;
    if (showActions || (m.reactions || []).length || (v && v.count > 1)) {
      foot += `<div class="actions" style="color:${A.color}">`
        + (v && v.count > 1 ? `<span class="pager" style="font-size:${px(theme.font.size * 0.62)}">${icon('chevron', asz * 0.8)}<b>${v.index}/${v.count}</b>${icon('chevron', asz * 0.8)}</span>` : '')
        + (showActions ? A.items.map(k => `<span class="act act-${k}">${icon(k === 'like' && m.liked ? 'like' : k, asz, m[k === 'like' ? 'liked' : k === 'dislike' ? 'disliked' : '_'] ? theme.colors.accent : 'currentColor')}</span>`).join('') : '')
        + (m.reactions || []).map(r => `<span class="reaction" style="font-size:${px(theme.font.size * 0.62)};border:1px solid ${theme.chip.borderColor};background:${theme.chip.bg};color:${theme.chip.color}">${esc(r.emoji)} ${esc(r.count ?? '')}</span>`).join('')
        + '</div>';
    }
    if ((m.followups || []).length) {
      foot += `<div class="followups">${m.followups.map(f => `<span class="chip" style="font-size:${px(theme.font.size * 0.7)};background:${theme.chip.bg};color:${theme.chip.color};border:1px solid ${theme.chip.borderColor};border-radius:${theme.chip.radius}px">${esc(f)}</span>`).join('')}</div>`;
    }
  }

  const mainAlign = R.align === 'right' ? 'flex-end' : R.align === 'center' ? 'center' : 'flex-start';
  const row = R.align === 'right' ? 'row-reverse' : 'row';
  return `<div class="msg role-${role}" data-mid="${esc(m.id)}" style="flex-direction:${row};gap:${px(theme.avatar.gap)};">`
    + (side ? `<div class="av-col">${avatarHtml(av, theme.avatar.size, theme, ctx)}</div>` : '')
    + `<div class="msg-main" style="align-items:${mainAlign};${R.align === 'right' ? 'text-align:left;' : ''}">${head}${bubble}${foot ? `<div class="msg-foot" style="align-items:${mainAlign};max-width:${R.maxWidth}%;${R.maxWidth < 100 ? '' : 'width:100%;'}">${foot}</div>` : ''}</div></div>`;
}

function headerHtml(project) {
  const H = project.chrome.header, theme = project.theme, fs = theme.font.size;
  if (!H.show) return '';
  const ctl = H.controls === 'mac' ? `<span class="wc mac"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i></span>`
    : H.controls === 'win' ? `<span class="wc win" style="color:${H.color}"><b>—</b><b>▢</b><b>✕</b></span>` : '';
  const av = H.style === 'bar' ? `<span class="hd-av">${avatarHtml(project.participants.assistant.avatar, fs * 1.9, theme, { project })}</span>` : '';
  const badge = H.modelBadge ? `<span class="hd-badge" style="border:1px solid ${theme.colors.border};font-size:${px(fs * 0.62)}">${esc(H.modelBadge)}</span>` : '';
  const center = H.align === 'center' || H.style === 'minimal';
  const title = `<div class="hd-title" style="text-align:${center ? 'center' : 'left'}"><div style="font-weight:700;font-size:${px(fs * 0.85)}">${esc(H.title)}</div>${H.subtitle ? `<div class="hd-sub" style="font-size:${px(fs * 0.58)};color:${theme.colors.muted}"><i class="dot"></i>${esc(H.subtitle)}</div>` : ''}</div>`;
  return `<div class="chat-header hd-${H.style}" style="background:${H.bg};color:${H.color};${H.border ? `border-bottom:1px solid ${theme.colors.border};` : ''}padding:${px(fs * 0.55)} ${px(fs * 0.9)}">${H.controls === 'win' ? '' : ctl}${av}${title}${badge}${H.controls === 'win' ? ctl : ''}</div>`;
}

function inputHtml(project) {
  const I = project.chrome.input, theme = project.theme, fs = theme.font.size;
  if (!I.show) return '';
  const col = I.color;
  return `<div class="chat-input-wrap" style="padding:${px(fs * 0.6)} ${px(fs * 1.1)} ${px(fs * 0.5)}">
    <div class="chat-input" style="background:${I.bg};color:${col};border:1px solid ${I.border};border-radius:${px(I.radius)};font-size:${px(fs * 0.85)};padding:${px(fs * 0.45)} ${px(fs * 0.55)} ${px(fs * 0.45)} ${px(fs * 0.9)}">
      ${I.attach ? `<span class="in-ic" style="opacity:.7">${icon('attach', fs * 1.05)}</span>` : ''}
      <span class="in-text" style="${I.text ? '' : 'opacity:.55'}">${esc(I.text || I.placeholder)}</span>
      ${I.mic ? `<span class="in-ic" style="opacity:.7">${icon('mic', fs * 1.05)}</span>` : ''}
      <span class="send" style="background:${I.sendColor};width:${px(fs * 1.7)};height:${px(fs * 1.7)}">${icon('send', fs * 1.0, '#fff', 2.4)}</span>
    </div>${I.disclaimer ? `<div class="disclaimer" style="font-size:${px(fs * 0.55)};color:${theme.colors.muted}">${esc(I.disclaimer)}</div>` : ''}</div>`;
}

export function annotationsHtml(project, selectedAid, editing) {
  const A = project.annotations || [];
  if (!A.length) return '';
  const fsz = project.theme.font.size;
  let svg = '', html = '';
  A.forEach(a => {
    const sel = editing && a.id === selectedAid ? ' sel' : '';
    const col = a.color || '#d62728';
    const x = +a.x || 0, y = +a.y || 0;
    if (a.type === 'arrow') {
      const x2 = +a.x2 || x + 120, y2 = +a.y2 || y, w = a.strokeWidth || 5;
      const mid = 'mk' + a.id.replace(/\W/g, '');
      svg += `<g class="anno anno-arrow${sel}" data-aid="${esc(a.id)}"><defs><marker id="${mid}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="${3.2}" markerHeight="${3.2}" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${col}"/></marker></defs><line x1="${x}" y1="${y}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${w}" stroke-linecap="round" marker-end="url(#${mid})"/><line class="hit" x1="${x}" y1="${y}" x2="${x2}" y2="${y2}" stroke="transparent" stroke-width="${w + 18}"/></g>`;
    } else if (a.type === 'box') {
      const w = +a.w || 200, hh = +a.h || 120, sw = a.strokeWidth || 4;
      svg += `<g class="anno anno-box${sel}" data-aid="${esc(a.id)}"><rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="${+a.radius || 12}" fill="${a.fill ? col + '22' : 'none'}" stroke="${col}" stroke-width="${sw}" ${a.dashed ? `stroke-dasharray="${sw * 2.5} ${sw * 1.5}"` : ''}/><rect class="hit" x="${x}" y="${y}" width="${w}" height="${hh}" rx="${+a.radius || 12}" fill="none" stroke="transparent" stroke-width="${sw + 16}"/></g>`;
    } else if (a.type === 'badge') {
      const s = +a.size || fsz * 1.6;
      html += `<div class="anno anno-badge${sel}" data-aid="${esc(a.id)}" style="left:${x}px;top:${y}px;width:${px(s)};height:${px(s)};background:${col};color:${a.textColor || '#fff'};font-size:${px(s * 0.55)}">${esc(a.text || 'A')}</div>`;
    } else {
      html += `<div class="anno anno-label${sel}" data-aid="${esc(a.id)}" style="left:${x}px;top:${y}px;${a.w ? `width:${+a.w}px;` : ''}background:${a.bg || col};color:${a.textColor || '#fff'};font-size:${px(+a.size || fsz * 0.8)};border-radius:${+a.radius || 10}px;${a.border ? `border:3px solid ${col};` : ''}">${inline(a.text || 'Label')}</div>`;
    }
  });
  return `<svg class="anno-svg" xmlns="http://www.w3.org/2000/svg">${svg}</svg>${html}`;
}

export function backgroundCss(cv) {
  if (cv.transparent) return 'transparent';
  const b = cv.bg;
  if (b.mode === 'gradient') return `linear-gradient(${b.angle}deg, ${b.color}, ${b.color2})`;
  if (b.mode === 'image' && b.image) return `center / cover no-repeat url("${b.image.replace(/"/g, '%22')}"), ${b.color}`;
  return b.color;
}

export function fontFaceCss(project) {
  return (project.fonts || []).map(f => `@font-face{font-family:"${String(f.name).replace(/"/g, '')}";src:url("${f.data}");font-display:block}`).join('\n');
}

/** Render the whole project into `stage` (a div). */
export function renderChat(project, stage, opts = {}) {
  const { theme, canvas, chrome } = project;
  const fr = chrome.frame;
  const bodyPad = fr.bodyPad ?? 32;
  const phone = fr.style === 'phone';
  const innerW = canvas.width - 2 * canvas.padding - 2 * bodyPad - (phone ? 2 * fr.thickness : fr.style === 'card' ? 2 : 0);
  const base = { theme, canvasInner: innerW, badgeColor: opts.badgeColor || '#d62728' };
  const msgs = project.messages.map(m => messageHtml(m, project, base)).join('');

  stage.className = 'stage' + (canvas.transparent && !opts.exporting ? ' transparent' : '') + (opts.editing && !opts.exporting ? ' editing' : '');
  stage.style.cssText = [
    `width:${canvas.width}px`, `min-height:${canvas.minHeight || 0}px`, `padding:${canvas.padding}px`,
    `background:${backgroundCss(canvas)}`, `border-radius:${canvas.radius}px`,
    canvas.border ? `border:${canvas.border}px solid ${canvas.borderColor}` : '',
    `font-family:${theme.font.body}`, `font-size:${theme.font.size}px`, `line-height:${theme.font.lineHeight}`,
    `font-weight:${theme.font.weight}`, `letter-spacing:${theme.font.letterSpacing}em`, `color:${theme.colors.text}`,
    `--accent:${theme.colors.accent}`, `--link:${theme.colors.link}`, `--muted:${theme.colors.muted}`, `--border:${theme.colors.border}`,
    `--surface:${theme.colors.surface}`, `--heading:${theme.font.heading}`, `--gap:${theme.gap}px`, `--code-bg:${theme.colors.codeBg}`,
  ].filter(Boolean).join(';');

  const frameStyle = fr.style === 'phone'
    ? `background:${theme.colors.surface};border:${fr.thickness}px solid ${fr.color};border-radius:${fr.radius + fr.thickness}px;box-shadow:0 18px 50px rgba(0,0,0,.28);`
    : fr.style === 'card'
      ? `background:${theme.colors.surface};border:1px solid ${theme.colors.border};border-radius:${fr.radius}px;${fr.shadow ? 'box-shadow:0 10px 34px rgba(0,0,0,.16);' : ''}`
      : '';
  stage.innerHTML = `<style>${fontFaceCss(project)}</style>`
    + `<div class="chat-window frame-${fr.style}" style="${frameStyle}">`
    + (phone ? `<div class="notch" style="background:${fr.color}"></div>` : '')
    + headerHtml(project)
    + `<div class="chat-body" style="padding:${bodyPad}px;gap:${theme.gap}px">${msgs || '<div class="empty">No messages yet — add one in the left panel.</div>'}</div>`
    + inputHtml(project) + '</div>'
    + `<div class="anno-layer">${annotationsHtml(project, opts.selectedAnno, opts.editing)}</div>`;

  if (opts.selectedId) stage.querySelector(`[data-mid="${CSS.escape(opts.selectedId)}"]`)?.classList.add('selected');
  if (typeof katex !== 'undefined') {
    stage.querySelectorAll('.math').forEach(el => {
      try { katex.render(el.dataset.tex, el, { displayMode: !!el.dataset.display, throwOnError: false, output: 'html' }); } catch { /* keep raw tex */ }
    });
  }
}
