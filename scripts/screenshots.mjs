// Regenerates the README screenshots in docs/img:  npm run screenshots   (needs Chrome or Edge installed)
import { chromium } from 'playwright-core';
import { start } from '../server.mjs';
import { mkdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'img');
mkdirSync(OUT, { recursive: true });
const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
if (!exe) throw new Error('No Chrome/Edge found');

const server = await start(5190, { LLM_API_KEY: 'demo-not-used' });   // dummy key so the AI dialog shows as configured; nothing here calls the LLM
const browser = await chromium.launch({ executablePath: exe });
const page = await (await browser.newContext({ viewport: { width: 1680, height: 980 }, deviceScaleFactor: 1 })).newPage();
page.on('pageerror', e => console.error('page error:', e.message));
await page.goto('http://localhost:5190/'); await page.waitForSelector('body[data-ready="1"]');

const wait = (ms = 500) => page.waitForTimeout(ms);
const file = (n) => join(OUT, n);
const report = (n) => console.log('  ✔', n, Math.round(statSync(file(n)).size / 1024) + ' KB');

/** Export the stage exactly like the app's PNG export and save it. */
async function exportStage(name, scale = 1) {
  const b64 = await page.evaluate(async (s) => {
    const m = await import('/src/export.js'); const blob = await m.pngBlob(s);
    return await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(blob); });
  }, scale);
  (await import('node:fs')).writeFileSync(file(name), Buffer.from(b64, 'base64')); report(name);
}
/** Replace the project with a patch of the sample (runs in the page). */
async function setProject(spec) {
  await page.evaluate(async (spec) => {
    const { newProject, normalizeProject } = await import('/src/defaults.js');
    const p = newProject(); Object.assign(p, spec.top || {});
    if (spec.canvas) Object.assign(p.canvas, spec.canvas);
    if (spec.messages) p.messages = spec.messages;
    p.annotations = spec.annotations || [];
    __app.store.replace(normalizeProject(p)); __app.sel.msg = null; __app.rebuildPanels();
  }, spec);
  await wait(450);
}
const text = (t) => ({ id: 'b' + Math.random().toString(36).slice(2, 7), type: 'text', text: t });
const blk = (type, extra) => ({ id: 'b' + Math.random().toString(36).slice(2, 7), type, ...extra });

// ---------------------------------------------------------------- 1. editor overview
console.log('Screenshots →', OUT);
await page.locator('#right .tab', { hasText: 'Style' }).click();
await page.locator('#left .msg-item').nth(1).click(); await wait();
await page.screenshot({ path: file('editor.jpg'), type: 'jpeg', quality: 88 }); report('editor.jpg');

// ---------------------------------------------------------------- 2. two-panel figure (the "sea-ice vs. jet stream" question)
await setProject({
  canvas: { width: 1100 }, messages: [
    { id: 'u1', role: 'user', blocks: [text('Could you sketch a quick two-panel figure as a sanity check? Panel (a): from 1979–2020, September Arctic sea-ice anomalies next to how wavy the jet stream gets in autumn–winter (from ERA5). Panel (b): those two plotted against each other with a trend line and the correlation $r$ shown. I just want a quick glance at whether low-ice years line up with a wavier jet before going deeper.')] },
    { id: 'a1', role: 'assistant', blocks: [text('Here is a quick sanity check. Low-ice years tend to coincide with a **wavier jet** (moderate negative correlation), but the trend is shared, so detrend before reading anything causal into it. *(Illustrative synthetic data.)*')], meta: { model: 'Model-X 1', latency: '6.1 s' } },
  ],
});
await page.locator('#left .msg-item').nth(1).click();
await page.locator('#left select.add-block-type').selectOption('figure');
await page.getByRole('button', { name: '+ Add block' }).click();
await page.waitForSelector('#stage .blk-figure'); await wait(500);
await page.evaluate(() => { __app.sel.msg = null; __app.store.set('theme.assistant.maxWidth', 100); }); await wait(400);
await exportStage('figure.png', 1);

// ---------------------------------------------------------------- 4. block gallery
await setProject({
  canvas: { width: 1000 }, messages: [
    { id: 'u1', role: 'user', blocks: [text('Show me what you can render in an answer.')] },
    { id: 'a1', role: 'assistant', thinking: { text: 'List the supported content blocks and show one of each.', duration: 4, open: true }, blocks: [
      text('Everything below is **fake but convincing** — and fully editable. Math works too: $\\sigma = \\sqrt{\\tfrac{1}{N}\\sum_i (x_i-\\mu)^2}$ [1].'),
      blk('code', { lang: 'python', filename: 'analysis.py', code: 'import numpy as np\n\nx = np.random.default_rng(1).normal(size=100)\nprint(x.mean().round(3), x.std().round(3))' }),
      blk('table', { csv: 'Model,Accuracy,F1\nBaseline,0.71,0.68\nOurs,0.84,0.82', caption: 'Table 1 · Results (illustrative).' }),
      blk('diagram', { src: 'Q[Query] --> R(Retrieve) --> G[Generate]\nG --> V{Verified?}\nV --> A[Answer] : yes\nV --> R : no\nstyle A #16a34a', caption: 'Flow diagram from a tiny text DSL.' }),
      blk('callout', { kind: 'warn', title: 'Caveat', text: 'Callouts flag limitations or key findings.' }),
      blk('tool', { name: 'search_papers', status: 'done', args: '{"query": "retrieval augmented generation"}', result: '12 results' }),
      blk('video', { caption: 'Video block: grab a still frame from your clip, player UI is drawn on top.', progress: 22, time: '0:14 / 1:05' }),
    ], sources: [{ id: 's1', title: 'Grounded generation reduces unsupported claims', site: 'Journal of Example Studies', year: '2024', url: 'https://example.org/1', authors: 'Doe, J.', snippet: 'Retrieval grounding lowered unsupported statements by 38%.' }], meta: { model: 'Model-X 1', latency: '3.8 s', tokens: '540 tokens', confidence: '' } },
  ],
});
await exportStage('blocks.png', 1);

// ---------------------------------------------------------------- 5. style presets (same content, six looks)
const compact = {
  canvas: { width: 900 }, messages: [
    { id: 'u1', role: 'user', blocks: [text('How much does retrieval grounding reduce hallucinations?')] },
    { id: 'a1', role: 'assistant', blocks: [text('Grounding cuts unsupported claims **substantially**, but the gain depends on retrieval quality [1][2].'),
      blk('chart', { chartType: 'bar', title: 'Faithfulness by method', csv: 'Method,Faithfulness,Faithfulness±\nPlain LLM,0.61,0.04\nRAG,0.78,0.03\nRAG + verifier,0.91,0.02', height: 230, yLabel: 'Faithfulness' })],
    sources: [{ id: 's1', title: 'Grounded generation reduces unsupported claims', site: 'J. Example Studies', year: '2024', url: 'https://example.org/1' }, { id: 's2', title: 'Hybrid retrieval for evidence selection', site: 'Example Conf.', year: '2025', url: 'https://example.org/2' }],
    meta: { model: 'Model-X 1', latency: '4.2 s', tokens: '612 tokens' } },
  ],
};
for (const [preset, fname] of [['Clean Light', 'clean-light'], ['Clean Dark', 'clean-dark'], ['Warm Serif', 'warm-serif'], ['Bubbles', 'bubbles'], ['Terminal', 'terminal'], ['Poster High-Contrast', 'poster-high-contrast']]) {
  await setProject(compact);
  await page.locator('#right .tab', { hasText: 'Style' }).click();
  await page.locator('#right select').first().selectOption(preset);
  await page.getByRole('button', { name: 'Apply preset' }).click(); await wait(300);
  await page.evaluate(() => { __app.store.set('theme.sources.style', 'chips'); __app.sel.msg = null; }); await wait(400);
  await exportStage(`preset-${fname}.png`, 0.7);
}

// ---------------------------------------------------------------- 6. annotations for posters
await setProject({
  ...compact, annotations: [
    { id: 'n1', type: 'box', x: 40, y: 560, w: 820, h: 290, color: '#d62728', strokeWidth: 5, radius: 14, dashed: false, fill: false },
    { id: 'n2', type: 'label', x: 470, y: 392, text: 'Verifier: largest gain', color: '#d62728', textColor: '#ffffff', size: 26 },
    { id: 'n3', type: 'arrow', x: 660, y: 440, x2: 690, y2: 478, color: '#d62728', strokeWidth: 6 },
    { id: 'n4', type: 'badge', x: 20, y: 180, text: 'A', color: '#d62728', size: 46 },
  ],
});
await page.evaluate(() => { __app.sel.msg = null; }); await wait(400);
await exportStage('annotations.png', 0.8);

// ---------------------------------------------------------------- 7. poster readability tab
await setProject(compact);
await page.locator('#right .tab', { hasText: 'Poster' }).click(); await wait(900);
await page.getByRole('button', { name: /Auto-fix/ }).click(); await wait(900);   // show the state after the one-click fix
await page.locator('#right').evaluate(e => (e.scrollTop = 0)); await wait(200);
await page.locator('#right').screenshot({ path: file('poster-tab.jpg'), type: 'jpeg', quality: 88 }); report('poster-tab.jpg');

// ---------------------------------------------------------------- 8. ✨ AI assist dialog (static demo content; no API call)
await setProject(compact);
await page.locator('#right .tab', { hasText: 'Style' }).click();
await page.locator('#left .msg-item').first().click(); await wait(200);
await page.evaluate(() => __app.store.set('messages.0.blocks.0.text', '- RAG vs plain LLM\n- hallucination rate\n- want sources')); await wait(300);
await page.evaluate(() => { __app.rebuildPanels(); }); await wait(300);
await page.evaluate(async () => {
  const st = await fetch('/api/llm/status').then(r => r.json());   // dialog works with or without a key; we only fill the text boxes
  const { openAi } = await import('/src/ui/ai.js');
  openAi({ label: 'Message text', kind: 'markdown', role: 'user', current: '- RAG vs plain LLM\n- hallucination rate\n- want sources', msgIndex: 0, apply: () => {} });
});
await page.waitForSelector('.ai-dialog'); await wait(300);
await page.evaluate(() => {
  const [instr, result] = document.querySelectorAll('.ai-dialog textarea');
  instr.value = 'Turn my bullet points into one natural question a researcher would ask';
  result.value = 'Does retrieval-augmented generation actually reduce hallucinations compared to a plain LLM, and can you point me to sources that quantify the difference in hallucination rate?';
  const g = document.querySelector('.ai-dialog button.primary'); g.disabled = false; g.textContent = '↻ Regenerate';
  const a = [...document.querySelectorAll('.ai-dialog button')].find(b => b.textContent === 'Apply to field'); if (a) a.disabled = false;
  document.querySelectorAll('.ai-err').forEach(e => (e.textContent = ''));
});
await page.locator('.ai-dialog').screenshot({ path: file('ai-assist.png') }); report('ai-assist.png');

await browser.close(); server.close();
console.log('done');
