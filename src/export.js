// Export: PNG / SVG / standalone HTML / JSON / print. All use the same DOM as the preview.
import { app } from './ui/app.js';

const slug = (s) => String(s || 'chat-mockup').toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'chat-mockup';

export function download(blobOrText, filename, type = 'text/plain') {
  const blob = blobOrText instanceof Blob ? blobOrText : new Blob([blobOrText], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/** Largest safe pixel ratio for browser canvas limits. */
export function safeScale(w, h, want) {
  return Math.max(0.25, Math.min(want, 16000 / Math.max(w, h), Math.sqrt(150e6 / (w * h))));
}

async function opts(stage, scale) {
  const w = stage.offsetWidth, h = stage.offsetHeight;
  const fontEmbedCSS = await htmlToImage.getFontEmbedCSS(stage).catch(() => '');
  return { width: w, height: h, pixelRatio: safeScale(w, h, scale), cacheBust: false, fontEmbedCSS, style: { transform: 'none', margin: '0' } };
}

export async function pngBlob(scale) {
  return app.withCleanStage(async (stage) => {
    await document.fonts?.ready;
    const o = await opts(stage, scale);
    await htmlToImage.toPng(stage, { ...o, pixelRatio: 0.2 }); // warm-up so images/fonts are decoded
    const requested = scale, used = o.pixelRatio;
    const blob = await htmlToImage.toBlob(stage, o);
    if (!blob) throw new Error('Rendering produced no image');
    if (used < requested) app.toast(`Scale limited to ${used.toFixed(2)}× (browser canvas limit)`);
    return blob;
  });
}

export async function exportPng() {
  const p = app.store.get();
  const blob = await pngBlob(p.canvas.exportScale);
  download(blob, slug(p.name) + '.png'); return blob;
}
export async function copyPng() {
  const blob = await pngBlob(app.store.get().canvas.exportScale);
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  app.toast('PNG copied to clipboard');
}
export async function exportSvg() {
  const p = app.store.get();
  const url = await app.withCleanStage(async (stage) => htmlToImage.toSvg(stage, await opts(stage, 1)));
  const text = decodeURIComponent(url.slice(url.indexOf(',') + 1));
  download(text, slug(p.name) + '.svg', 'image/svg+xml');
}

export async function htmlDocument() {
  return app.withCleanStage(async (stage) => {
    const [chatCss, katexCss] = await Promise.all([fetch('css/chat.css').then(r => r.text()), fetch('vendor/katex/katex.min.css').then(r => r.text())]);
    const fonts = await htmlToImage.getFontEmbedCSS(stage).catch(() => '');
    const p = app.store.get();
    const cleanKatex = katexCss.replace(/@font-face\{[^}]*\}/g, '');
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${slug(p.name)}</title>
<style>${cleanKatex}\n${fonts}\n${chatCss}\nbody{margin:0;background:#e5e7eb;display:flex;justify-content:center;padding:24px}.stage{box-shadow:0 8px 40px rgba(0,0,0,.2)}</style></head><body>${stage.outerHTML}
<script>(function(){var s=document.querySelector('.stage');function f(){var k=Math.min(1,(innerWidth-48)/s.offsetWidth);s.style.zoom=k}f();addEventListener('resize',f)})()</script></body></html>`;
  });
}
export async function exportHtml() { download(await htmlDocument(), slug(app.store.get().name) + '.html', 'text/html'); }

export function exportJson() {
  const p = app.store.get();
  download(JSON.stringify(p, null, 2), slug(p.name) + '.chatmock.json', 'application/json');
}

export async function printPdf() {
  await app.withCleanStage(async (stage) => {
    const st = document.createElement('style');
    st.textContent = `@page{size:${stage.offsetWidth}px ${stage.offsetHeight}px;margin:0}`;
    document.head.append(st);
    await new Promise(r => setTimeout(r, 50));
    window.print();
    st.remove();
  });
}
