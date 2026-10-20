// Minimal, language-agnostic syntax highlighter → HTML. Pure.
import { esc } from './markdown.js';

const KW = new Set(('def class return if elif else for while in not and or is import from as with try except finally raise lambda yield pass break continue None True False ' +
  'function const let var new this async await export default switch case typeof null undefined true false void throw catch ' +
  'int float double char bool string struct enum public private static final package interface extends implements fn mut pub use impl match SELECT FROM WHERE JOIN GROUP BY ORDER LIMIT INSERT UPDATE DELETE').split(' '));

export function highlight(code, lang = '') {
  const re = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*|--[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)|([A-Za-z_][\w]*)/g;
  const hashComment = /^(py|python|sh|bash|r|yaml|yml|toml|rb|ruby)$/i.test(lang);
  const dashComment = /^(sql|lua|hs)$/i.test(lang);
  let out = '', last = 0, m;
  const src = String(code ?? '');
  while ((m = re.exec(src))) {
    out += esc(src.slice(last, m.index)); last = re.lastIndex;
    const [tok, cmt, str, nr, id] = m;
    if (cmt) {
      const isHash = cmt[0] === '#', isDash = cmt.startsWith('--');
      if ((isHash && !hashComment && lang) || (isDash && !dashComment && lang)) out += esc(tok);
      else out += `<span class="tk-c">${esc(tok)}</span>`;
    } else if (str) out += `<span class="tk-s">${esc(tok)}</span>`;
    else if (nr) out += `<span class="tk-n">${esc(tok)}</span>`;
    else if (id) out += KW.has(tok) ? `<span class="tk-k">${esc(tok)}</span>` : /^[A-Z]/.test(tok) ? `<span class="tk-t">${esc(tok)}</span>` : esc(tok);
  }
  return out + esc(src.slice(last));
}
