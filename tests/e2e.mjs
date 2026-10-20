// End-to-end test: drives system Chrome against the local server. Run: npm run test:e2e
import { chromium } from 'playwright-core';
import { start } from '../server.mjs';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const OUT = new URL('./out/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
mkdirSync(OUT, { recursive: true });
const CHROMES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'];
const exe = CHROMES.find(existsSync);
assert.ok(exe, 'No Chrome/Edge found');

// fake OpenAI-compatible upstream so the AI-assist flow is tested without network / real key
import { createServer } from 'node:http';
const upstreamCalls = [];
const upstream = createServer((req, res) => {
  let b = ''; req.on('data', c => (b += c));
  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url.endsWith('/models')) return res.end(JSON.stringify({ data: [{ id: 'alias-huge-no-thinking' }, { id: 'alias-huge' }] }));
    const body = JSON.parse(b); upstreamCalls.push({ auth: req.headers.authorization, body });
    const user = body.messages.at(-1).content;
    if (user.includes('FAILME')) { res.statusCode = 500; return res.end(JSON.stringify({ error: { message: 'upstream exploded' } })); }
    if (user.includes('JSON array')) return res.end(JSON.stringify({ choices: [{ message: { content: 'Sure:\n```json\n[{"title":"Gen A","site":"Example J.","year":"2024","url":"https://example.org/a","snippet":"s"},{"title":"Gen B","site":"Example C.","year":"2025","url":"https://example.org/b","snippet":"t"}]\n```' } }] }));
    if (user.includes('multi-panel scientific figure')) return res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ title: 'Gen figure', caption: 'Figure 9 · synthetic', layout: 'row', panels: [
      { title: 'Trend', chartType: 'line', csv: 'Year,A,B@right\n2000,1,5\n2001,2,4\n2002,3,3\n2003,4,1', xLabel: 'Year', yLabel: 'A', y2Label: 'B' },
      { title: 'Scatter', chartType: 'scatter', csv: 'B,A,Year@label\n5,1,2000\n4,2,2001\n3,3,2002\n1,4,2003', trend: true, showR: true, labelPoints: true }] }) } }] }));
    const instr = (user.match(/User's instruction: ([^\n]*)/) || [])[1];
    res.end(JSON.stringify({ choices: [{ message: { content: 'GENERATED: ' + instr } }] }));
  });
});
await new Promise(r => upstream.listen(5188, '127.0.0.1', r));
const server = await start(5199, { LLM_API_KEY: 'test-key-123', LLM_BASE_URL: 'http://127.0.0.1:5188/v1' });
const browser = await chromium.launch({ executablePath: exe, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1700, height: 1000 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));

let failed = 0;
const step = async (name, fn) => {
  try { await fn(); console.log('  ✔', name); } catch (e) { failed++; console.log('  ✘', name, '\n     ', e.message.split('\n')[0]); }
};

await page.goto('http://localhost:5199/');
await page.waitForSelector('body[data-ready="1"]');

await step('renders sample conversation', async () => {
  assert.equal(await page.locator('#stage .msg').count(), 2);
  assert.ok(await page.locator('#stage .chart-svg').count() >= 1, 'chart');
  assert.ok(await page.locator('#stage .diagram-svg').count() >= 1, 'diagram');
  assert.ok(await page.locator('#stage .katex').count() >= 1, 'math');
  assert.equal(await page.locator('#stage .src-card').count(), 3);
  await page.screenshot({ path: OUT + 'editor.png' });
  
});

await step('editing text updates stage live', async () => {
  const ta = page.locator('#left textarea').first();
  await ta.fill('Hello **poster** world');
  await page.waitForFunction(() => document.querySelector('#stage .msg').innerText.includes('Hello poster world'));
});

await step('adding a message and block works', async () => {
  await page.getByRole('button', { name: '+ User message' }).click();
  assert.equal(await page.locator('#stage .msg').count(), 3);
  await page.locator('#left select.add-block-type').selectOption('callout');
  await page.getByRole('button', { name: '+ Add block' }).click();
  assert.ok(await page.locator('#stage .blk-callout').count() >= 1);
});

await step('undo / redo', async () => {
  await page.locator('#btnUndo').click();
  assert.equal(await page.locator('#stage .blk-callout').count(), 0);
  assert.equal(await page.locator('#stage .msg').count(), 3); // callout block undone, message stays
  await page.locator('#btnRedo').click();
  assert.ok(await page.locator('#stage .blk-callout').count() >= 1);
});

for (const preset of ['Clean Dark', 'Warm Serif', 'Bubbles', 'Terminal', 'Poster High-Contrast', 'Clean Light']) {
  await step('preset ' + preset, async () => {
    await page.locator('#right select').first().selectOption(preset);
    await page.getByRole('button', { name: 'Apply preset' }).click();
    await page.waitForTimeout(150);
    await page.locator('#stage').screenshot({ path: OUT + 'preset-' + preset.replace(/\W+/g, '-') + '.png' });
    assert.ok(await page.locator('#stage .msg').count() >= 2);
  });
}

await step('poster tab reports text sizes and contrast', async () => {
  await page.locator('#right .tab', { hasText: 'Poster' }).click();
  await page.waitForSelector('#right .rep-row');
  assert.ok(await page.locator('#right .rep-row').count() >= 5);
  await page.getByRole('button', { name: /Auto-fix/ }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + 'poster-tab.png' });
});

await step('annotations can be added and dragged', async () => {
  await page.locator('#right .tab', { hasText: 'Notes' }).click();
  await page.getByRole('button', { name: '+ Badge' }).click();
  await page.getByRole('button', { name: '+ Arrow' }).click();
  await page.getByRole('button', { name: '+ Box' }).click();
  await page.waitForSelector('#stage .anno-badge');
  const before = await page.evaluate(() => __app.store.get().annotations[0].x);
  const box = await page.locator('#stage .anno-badge').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + 100, box.y + 80, { steps: 5 }); await page.mouse.up();
  const after = await page.evaluate(() => __app.store.get().annotations[0].x);
  assert.notEqual(before, after);
});

await step('PNG export is non-blank and correctly sized', async () => {
  const info = await page.evaluate(async () => {
    const m = await import('/src/export.js');
    const w = document.getElementById('stage').offsetWidth, hgt = document.getElementById('stage').offsetHeight;
    const blob = await m.pngBlob(2);
    const bmp = await createImageBitmap(blob);
    const c = new OffscreenCanvas(bmp.width, bmp.height); const g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
    const d = g.getImageData(0, 0, bmp.width, bmp.height).data;
    const seen = new Set(); for (let i = 0; i < d.length; i += 4 * 997) seen.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]);
    const buf = new Uint8Array(await blob.arrayBuffer());
    return { w, hgt, bw: bmp.width, bh: bmp.height, colors: seen.size, size: blob.size, b64: btoa(String.fromCharCode(...buf.slice(0, 0))) };
  });
  assert.equal(info.bw, info.w * 2); assert.equal(info.bh, info.hgt * 2);
  assert.ok(info.colors > 12, 'image looks blank: ' + info.colors);
  const dataUrl = await page.evaluate(async () => { const m = await import('/src/export.js'); const b = await m.pngBlob(1.5); return await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); }); });
  writeFileSync(OUT + 'export.png', Buffer.from(dataUrl.split(',')[1], 'base64'));
});

await step('SVG and HTML export produce documents', async () => {
  const r = await page.evaluate(async () => {
    const m = await import('/src/export.js'); const html = await m.htmlDocument();
    return { html: html.length, hasStage: html.includes('class="stage'), hasKatex: html.includes('katex') };
  });
  assert.ok(r.html > 5000 && r.hasStage && r.hasKatex);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(async () => (await import('/src/export.js')).exportSvg())]);
  assert.match(dl.suggestedFilename(), /\.svg$/);
});

await step('transparent export keeps alpha', async () => {
  await page.evaluate(() => __app.store.set('canvas.transparent', true));
  const alpha = await page.evaluate(async () => {
    const m = await import('/src/export.js'); const blob = await m.pngBlob(1);
    const bmp = await createImageBitmap(blob); const c = new OffscreenCanvas(bmp.width, bmp.height); const g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
    return g.getImageData(2, 2, 1, 1).data[3];
  });
  assert.equal(alpha, 0);
  await page.evaluate(() => __app.store.set('canvas.transparent', false));
});

await step('invalid JSON import is rejected without data loss', async () => {
  await page.locator('#right .tab', { hasText: 'JSON' }).click();
  const n = await page.evaluate(() => __app.store.get().messages.length);
  await page.locator('#right textarea.json-area').fill('{ "messages": 5 }');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  assert.equal(await page.evaluate(() => __app.store.get().messages.length), n);
  await page.locator('#right textarea.json-area').fill('not json');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  assert.equal(await page.evaluate(() => __app.store.get().messages.length), n);
});

await step('hostile content does not inject HTML', async () => {
  await page.evaluate(() => __app.store.update(s => { s.messages[0].blocks[0].text = '<img src=x onerror="window.__pwn=1"> [x](javascript:window.__pwn=1) $a'; s.messages[0].name = '<b>n</b>'; }));
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.__pwn), undefined);
  assert.equal(await page.locator('#stage img[src="x"]').count(), 0);
});

await step('all block types render without errors', async () => {
  await page.evaluate(() => __app.store.update(s => {
    const mk = (type, extra = {}) => ({ id: 'z' + type, type, ...extra });
    s.messages[1].blocks = [
      mk('code', { lang: 'python', code: 'def f(x):\n  return x*2 # c' }), mk('image', { placeholder: 'Fig' }), mk('video', { caption: 'v' }),
      mk('table', { csv: 'a,b\n1,2' }), mk('chart', { chartType: 'scatter', csv: 'x,y\n1,2\n2,3\n3,5' }), mk('chart', { csv: 'garbage' }), mk('diagram', { src: '' }),
      mk('diagram', { src: 'A-->B-->A' }), mk('callout', { kind: 'warn', text: 't' }), mk('file', {}), mk('quote', { text: 'q' }), mk('tool', { name: 'x' }), mk('divider'), mk('bogus'),
    ];
    s.messages[1].typing = false; s.messages[1].cursor = true; s.messages[1].error = 'fail';
  }));
  await page.waitForTimeout(250);
  assert.ok(await page.locator('#stage .bwrap').count() >= 14);
  const du = await page.evaluate(async () => { const m = await import('/src/export.js'); const b = await m.pngBlob(1); return await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); }); });
  writeFileSync(OUT + 'all-blocks.png', Buffer.from(du.split(',')[1], 'base64'));
});

await step('panels stay open after deleting items / rebuilds', async () => {
  await page.locator('#left .msg-item', { hasText: 'Across recent' }).click();
  const sources = page.locator('#left details.grp', { hasText: 'Sources / provenance' });
  await sources.locator('summary').first().click();
  assert.equal(await sources.evaluate(d => d.open), true);
  const cards = sources.locator('.card');
  const n = await cards.count(); assert.ok(n >= 2);
  await cards.first().locator('.card-head button.danger').click();
  assert.equal(await page.locator('#left details.grp', { hasText: 'Sources / provenance' }).evaluate(d => d.open), true, 'sources group closed');
  assert.equal(await page.locator('#left details.grp', { hasText: 'Sources / provenance' }).locator('.card').count(), n - 1);
  await page.locator('#right .tab', { hasText: 'Style' }).click();
  await page.locator('#right details.grp', { hasText: 'Colours' }).locator('summary').click();
  await page.locator('#right .tab', { hasText: 'Canvas' }).click();
  await page.locator('#right .tab', { hasText: 'Style' }).click();
  assert.equal(await page.locator('#right details.grp', { hasText: 'Colours' }).evaluate(d => d.open), true, 'colours group closed');
});

await step('autosave survives reload', async () => {
  await page.evaluate(() => __app.store.set('name', 'Persist me'));
  await page.waitForTimeout(900);
  await page.reload(); await page.waitForSelector('body[data-ready="1"]');
  assert.equal(await page.evaluate(() => __app.store.get().name), 'Persist me');
});

await step('AI assist: describe → generate → apply → undo', async () => {
  await page.evaluate(() => __app.store.update(s => { s.messages = s.messages.slice(0, 2); s.messages[0].role = 'user'; s.messages[0].blocks = [{ id: 'bx', type: 'text', text: '- RAG\n- hallucinations' }]; }));
  await page.locator('#left .msg-item').first().click();
  await page.locator('#left .ai-btn', { hasText: '✨ AI' }).first().click();
  await page.waitForSelector('.ai-dialog');
  await page.locator('.ai-dialog textarea').first().fill('write this as a user question');
  await page.locator('.ai-dialog button.primary').click();
  await page.waitForFunction(() => document.querySelectorAll('.ai-dialog textarea')[1].value.startsWith('GENERATED'));
  await page.getByRole('button', { name: 'Apply to field' }).click();
  assert.equal(await page.locator('.ai-dialog').count(), 0);
  assert.equal(await page.evaluate(() => __app.store.get().messages[0].blocks[0].text), 'GENERATED: write this as a user question');
  assert.match(await page.locator('#stage .msg').first().innerText(), /GENERATED/);
  const call = upstreamCalls.at(-1);
  assert.equal(call.auth, 'Bearer test-key-123');
  assert.match(call.body.messages.at(-1).content, /human USER/);          // role-aware prompt
  assert.match(call.body.messages.at(-1).content, /- RAG/);               // current text sent
  await page.locator('#btnUndo').click();
  assert.equal(await page.evaluate(() => __app.store.get().messages[0].blocks[0].text), '- RAG\n- hallucinations');
});

await step('AI assist: upstream error is shown, nothing applied', async () => {
  await page.locator('#left .ai-btn', { hasText: '✨ AI' }).first().click();
  await page.locator('.ai-dialog textarea').first().fill('FAILME');
  await page.locator('.ai-dialog button.primary').click();
  await page.waitForSelector('.ai-err:not(:empty)');
  assert.match(await page.locator('.ai-err').first().innerText(), /exploded/);
  assert.equal(await page.getByRole('button', { name: 'Apply to field' }).isDisabled(), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.ai-dialog').count(), 0);
});

await step('AI assist: generate sources appends parsed sources', async () => {
  await page.locator('#left .msg-item').nth(1).click();
  const g = page.locator('#left details.grp', { hasText: 'Sources / provenance' });
  if (!(await g.evaluate(d => d.open))) await g.locator('summary').first().click();
  const before = await page.evaluate(() => (__app.store.get().messages[1].sources || []).length);
  await page.getByRole('button', { name: '✨ Generate sources…' }).click();
  await page.locator('.ai-dialog button.primary').click();
  await page.waitForFunction(() => document.querySelectorAll('.ai-dialog textarea')[1].value.includes('Gen A'));
  await page.getByRole('button', { name: 'Apply to field' }).click();
  assert.equal(await page.evaluate(() => (__app.store.get().messages[1].sources || []).length), before + 2);
});

await step('API key never reaches the browser', async () => {
  const r = await page.evaluate(async () => {
    const out = {};
    out.env = (await fetch('/.env')).status; out.status = await (await fetch('/api/llm/status')).text();
    out.models = await (await fetch('/api/llm/models')).text();
    const files = ['/index.html', '/src/ui/ai.js', '/src/llm.js', '/src/main.js'];
    out.leak = (await Promise.all(files.map(f => fetch(f).then(r => r.text())))).some(t => t.includes('test-key-123'));
    return out;
  });
  assert.equal(r.env, 404); assert.ok(!r.status.includes('test-key') && !r.models.includes('test-key')); assert.equal(r.leak, false);
});

await step('figure block: default, synthetic data dialog, AI figure builder', async () => {
  await page.locator('#left .msg-item').nth(1).click();
  await page.locator('#left select.add-block-type').selectOption('figure');
  await page.getByRole('button', { name: '+ Add block' }).click();
  await page.waitForSelector('#stage .blk-figure');
  assert.equal(await page.locator('#stage .blk-figure .chart-svg').count(), 2);
  assert.ok(await page.locator('#stage .blk-figure .ch-trend').count() >= 1, 'trend line');
  assert.match(await page.locator('#stage .blk-figure .ch-stat').first().textContent(), /r\s*=\s*[\u2212-]0\.\d\d/);
  assert.match(await page.locator('#stage .blk-figure').innerText(), /\(a\)[\s\S]*\(b\)/);
  // synthetic data dialog
  await page.getByRole('button', { name: /Synthetic correlated data/ }).click();
  await page.locator('.ai-dialog .fld', { hasText: 'Target r' }).locator('input').fill('0.7');
  await page.waitForFunction(() => document.querySelector('.ai-dialog .note:last-of-type, .ai-dialog')?.textContent.includes('r = 0.70'));
  await page.getByRole('button', { name: 'Apply to figure' }).click();
  await page.waitForFunction(() => /r\s*=\s*0\.70/.test(document.querySelector('#stage .blk-figure .ch-stat')?.textContent || ''));
  // AI builds a different figure
  await page.getByRole('button', { name: /Build figure from description/ }).click();
  await page.locator('.ai-dialog textarea').first().fill('two panels about trend and scatter');
  await page.locator('.ai-dialog button.primary').click();
  await page.waitForFunction(() => document.querySelectorAll('.ai-dialog textarea')[1].value.includes('Gen figure'));
  await page.getByRole('button', { name: 'Apply to field' }).click();
  await page.waitForFunction(() => document.querySelector('#stage .blk-figure .chart-title')?.textContent.includes('Gen figure'));
  assert.equal(await page.locator('#stage .blk-figure .chart-svg').count(), 2);
  assert.match(await page.locator('#stage .blk-figure .ch-stat').first().textContent(), /r\s*=\s*[\u2212-]0\.9\d/);   // near-perfectly anti-correlated fake data
  await page.screenshot({ path: OUT + 'figure-editor.png' });
});

await step('custom SVG block is sanitised', async () => {
  await page.evaluate(() => __app.store.update(s => { s.messages[1].blocks.push({ id: 'sv1', type: 'svg', code: '<svg viewBox="0 0 100 50" onload="window.__pwn2=1"><script>window.__pwn2=1</script><rect width="50" height="20" fill="#f00" onclick="window.__pwn2=1"/><text x="5" y="40" font-size="12">ok</text></svg>' }); }));
  await page.waitForSelector('#stage .blk-svg svg rect');
  assert.equal(await page.locator('#stage .blk-svg script').count(), 0);
  assert.equal(await page.evaluate(() => window.__pwn2), undefined);
  assert.equal(await page.locator('#stage .blk-svg [onclick], #stage .blk-svg [onload]').count(), 0);
});

await step('no console errors', async () => { const bad = errors.filter(e => !/status of (404|500|502)/.test(e)); assert.deepEqual(bad, [], JSON.stringify(bad)); });

await browser.close(); server.close(); upstream.close();
console.log(failed ? `\n${failed} e2e step(s) FAILED` : '\nAll e2e steps passed');
process.exit(failed ? 1 : 0);
