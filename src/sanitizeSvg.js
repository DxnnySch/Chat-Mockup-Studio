// Allow-list SVG sanitiser for LLM-written figures. Pure string processing (no DOM) so it can be unit tested.
// Anything not explicitly allowed is dropped: scripts, styles, foreignObject, images, links, event handlers, external URLs.

const EL = new Set(('svg g path rect circle ellipse line polyline polygon text tspan defs lineargradient radialgradient stop clippath marker title desc pattern symbol ' +
  'filter fegaussianblur feoffset fecolormatrix femerge femergenode feflood fecomposite fedropshadow').split(' '));
const DROP_WITH_CONTENT = new Set('script style foreignobject iframe object embed animate animatetransform animatemotion set image use a metadata audio video canvas'.split(' '));
const ATTR = new Set(('id class d x y x1 y1 x2 y2 cx cy r rx ry fx fy width height points transform fill stroke stroke-width stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit ' +
  'opacity fill-opacity stroke-opacity fill-rule clip-rule font-family font-size font-weight font-style text-anchor dominant-baseline alignment-baseline letter-spacing text-decoration ' +
  'viewbox preserveaspectratio xmlns offset stop-color stop-opacity gradientunits gradienttransform spreadmethod clip-path clippathunits marker-start marker-mid marker-end markerwidth markerheight markerunits refx refy orient ' +
  'patternunits patterntransform dx dy rotate lengthadjust style filter stddeviation in in2 result mode values type flood-color flood-opacity operator k1 k2 k3 k4 xml:space paint-order vector-effect').split(' '));
const BAD_VALUE = /javascript:|data:|vbscript:|expression\s*\(|@import|<|url\(\s*['"]?\s*(?!#)/i;
const TAG = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\/?[a-zA-Z][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*\/?>|[^<]+|</g;

function attrs(src) {
  const out = []; const re = /([^\s=/"'<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g; let m;
  while ((m = re.exec(src))) {
    const name = m[1], val = m[2] ?? m[3] ?? m[4] ?? '';
    const lower = name.toLowerCase();
    if (lower.startsWith('on') || !ATTR.has(lower) || BAD_VALUE.test(val)) continue;
    out.push([name, val]);
  }
  return out;
}

export function sanitizeSvg(input, { maxLength = 300000 } = {}) {
  const src = String(input ?? '');
  if (src.length > maxLength) throw new Error('SVG is too large.');
  if (!/<svg[\s>]/i.test(src)) throw new Error('No <svg> element found.');
  const tokens = src.match(TAG) || [];
  let out = '', skipName = null, skipDepth = 0, seenRoot = false;
  for (const tok of tokens) {
    if (!tok.startsWith('<')) { if (!skipName) out += tok.replace(/>/g, '&gt;'); continue; }
    if (tok.startsWith('<!--') || tok.startsWith('<![CDATA[') || tok === '<') continue;
    const m = tok.match(/^<(\/?)([a-zA-Z][\w:-]*)([\s\S]*?)(\/?)>$/);
    if (!m) continue;
    const closing = m[1] === '/', name = m[2].toLowerCase(), selfClose = m[4] === '/';
    if (skipName) {
      if (name === skipName) { if (closing) { if (--skipDepth === 0) skipName = null; } else if (!selfClose) skipDepth++; }
      continue;
    }
    if (DROP_WITH_CONTENT.has(name)) { if (!closing && !selfClose) { skipName = name; skipDepth = 1; } continue; }
    if (!EL.has(name)) continue;                       // unknown element: drop the tag, keep nothing else
    if (closing) { out += `</${name === 'lineargradient' ? 'linearGradient' : name === 'radialgradient' ? 'radialGradient' : name === 'clippath' ? 'clipPath' : name}>`; continue; }
    let a = attrs(m[3]);
    const canon = { lineargradient: 'linearGradient', radialgradient: 'radialGradient', clippath: 'clipPath' }[name] || name;
    if (name === 'svg' && !seenRoot) {
      seenRoot = true;
      const get = (k) => a.find(([n]) => n.toLowerCase() === k)?.[1];
      let vb = get('viewbox');
      if (!vb) { const w = parseFloat(get('width')), h = parseFloat(get('height')); vb = w > 0 && h > 0 ? `0 0 ${w} ${h}` : '0 0 800 450'; }
      a = a.filter(([n]) => !['viewbox', 'width', 'height', 'xmlns', 'style', 'preserveaspectratio'].includes(n.toLowerCase()));
      a.push(['xmlns', 'http://www.w3.org/2000/svg'], ['viewBox', vb], ['style', 'width:100%;height:auto;display:block;max-width:100%']);
    } else if (name === 'svg') continue;               // nested <svg>: drop
    out += `<${canon}${a.map(([n, v]) => ` ${n}="${v.replace(/"/g, '&quot;')}"`).join('')}${selfClose ? '/' : ''}>`;
  }
  if (!seenRoot) throw new Error('No <svg> root element found.');
  return out;
}
