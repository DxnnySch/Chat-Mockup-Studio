// Tiny, safe markdown → HTML. Pure (no DOM). Math is emitted as placeholders rendered later by KaTeX.
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const safeUrl = (u) => (/^(https?:|mailto:|#)/i.test(u.trim()) ? u.trim() : '#');

export function inline(text) {
  const stash = [];
  const keep = (html) => `\u0000${stash.push(html) - 1}\u0000`;
  let s = String(text ?? '');
  s = s.replace(/`([^`\n]+)`/g, (_, c) => keep(`<code>${esc(c)}</code>`));
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => keep(`<span class="math" data-display="1" data-tex="${esc(t.trim())}">${esc(t)}</span>`));
  s = s.replace(/\$(?!\s)([^$\n]*?[^\s$])\$(?!\d)/g, (_, t) => keep(`<span class="math" data-tex="${esc(t)}">${esc(t)}</span>`));
  s = esc(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => keep(`<a href="${esc(safeUrl(u.replace(/&amp;/g, '&')))}">${t}</a>`));
  s = s.replace(/\[(\d{1,3}(?:\s*,\s*\d{1,3})*)\](?!\()/g, (_, n) =>
    keep(n.split(/\s*,\s*/).map(k => `<sup class="cite" data-n="${k}">${k}</sup>`).join('')));
  s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
  s = s.replace(/(^|[\s(])\*(?=\S)([^*\n]*?\S)\*(?=$|[\s).,;:!?])/g, '$1<em>$2</em>');
  s = s.replace(/(^|[\s(])_(?=\S)([^_\n]*?\S)_(?=$|[\s).,;:!?])/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[+i]);
}

const LIST_RE = /^\s*([-*+]|\d+[.)])\s+/;

export function markdown(src) {
  const lines = String(src ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = line.match(/^```(\w*)/))) {
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre class="codeblock"><code${m[1] ? ` data-lang="${esc(m[1])}"` : ''}>${esc(buf.join('\n'))}</code></pre>`);
    } else if (/^\s*\$\$\s*$/.test(line)) {
      const buf = []; i++;
      while (i < lines.length && !/^\s*\$\$\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++;
      const t = buf.join('\n').trim();
      out.push(`<div class="math-block"><span class="math" data-display="1" data-tex="${esc(t)}">${esc(t)}</span></div>`);
    } else if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      out.push(`<h${m[1].length + 1} class="md-h">${inline(m[2])}</h${m[1].length + 1}>`); i++;
    } else if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { out.push('<hr>'); i++; }
    else if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${markdown(buf.join('\n'))}</blockquote>`);
    } else if (LIST_RE.test(line)) {
      const ordered = /^\s*\d/.test(line);
      const items = [];
      while (i < lines.length && LIST_RE.test(lines[i])) { items.push(`<li>${inline(lines[i].replace(LIST_RE, ''))}</li>`); i++; }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
    } else {
      const buf = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|>\s?)/.test(lines[i]) && !LIST_RE.test(lines[i]) && !/^\s*\$\$\s*$/.test(lines[i])) buf.push(lines[i++]);
      if (!buf.length) buf.push(lines[i++]);
      out.push(`<p>${buf.map(inline).join('<br>')}</p>`);
    }
  }
  return out.join('\n');
}
