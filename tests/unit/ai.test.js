import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { buildPrompt, cleanOutput, parseSourcesJson, parseFieldPath, conversationContext } from '../../src/aiPrompts.js';
import { loadEnvFile, llmConfig, isLocalRequest } from '../../server/llm.mjs';
import { start } from '../../server.mjs';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('buildPrompt: perspective, current text, context, default instruction', () => {
  const u = buildPrompt({ kind: 'markdown', role: 'user', label: 'Message text', instruction: 'ask about effect size', current: '- RAG\n- hallucination', context: '[User]: hi' });
  assert.match(u.prompt, /human USER/); assert.match(u.prompt, /- RAG/); assert.match(u.prompt, /Conversation so far/); assert.match(u.prompt, /ask about effect size/);
  const a = buildPrompt({ kind: 'markdown', role: 'assistant', current: 'raw answer', instruction: '' });
  assert.match(a.prompt, /AI ASSISTANT/); assert.match(a.prompt, /Improve and format/);
  assert.ok(!buildPrompt({ kind: 'csv-chart', current: 'x', useCurrent: false }).prompt.includes('Current content'));
  assert.match(buildPrompt({ kind: 'code', lang: 'python' }).prompt, /Language: python/);
});

test('cleanOutput strips fences, preambles, quotes, bullets', () => {
  assert.equal(cleanOutput('```csv\na,b\n1,2\n```', 'csv-chart'), 'a,b\n1,2');
  assert.equal(cleanOutput('Sure, here is the text:\n\nHello there', 'markdown'), 'Hello there');
  assert.equal(cleanOutput('"Short title"', 'plain'), 'Short title');
  assert.equal(cleanOutput('- one\n2. two\n\n* three', 'lines'), 'one\ntwo\nthree');
  assert.equal(cleanOutput('', 'plain'), '');
});

test('parseSourcesJson tolerates fences/prose and rejects junk', () => {
  const s = parseSourcesJson('Here:\n```json\n[{"title":"A","site":"S","year":2024,"url":"https://example.org/a"}]\n```');
  assert.equal(s.length, 1); assert.equal(s[0].year, '2024'); assert.equal(s[0].authors, '');
  assert.throws(() => parseSourcesJson('no json here'));
  assert.throws(() => parseSourcesJson('[{bad}]'));
  assert.throws(() => parseSourcesJson('[]'));
});

test('parseFieldPath + conversationContext', () => {
  assert.deepEqual(parseFieldPath('messages.3.blocks.1.text'), { msgIndex: 3, blockIndex: 1 });
  assert.deepEqual(parseFieldPath('theme.font.size'), { msgIndex: null, blockIndex: null });
  const st = { participants: { user: { name: 'U' }, assistant: { name: 'A' } }, messages: [{ role: 'user', blocks: [{ type: 'text', text: 'hello' }] }, { role: 'assistant', blocks: [{ type: 'chart' }] }] };
  const c = conversationContext(st, 1);
  assert.match(c, /\[U\]: hello/); assert.match(c, /\[A\].*chart.*<<</);
  assert.equal(conversationContext({ messages: [] }, 0), '');
});

test('env parsing and config', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cc-')); const p = join(dir, '.env');
  writeFileSync(p, '# c\nLLM_API_KEY="abc"\nLLM_BASE_URL=https://x.test/v1/\n\nBAD LINE\n');
  const env = loadEnvFile(p); assert.equal(env.LLM_API_KEY, 'abc');
  const c = llmConfig(env); assert.equal(c.base, 'https://x.test/v1'); assert.equal(c.model, 'alias-huge-no-thinking');
  assert.deepEqual(loadEnvFile(join(dir, 'missing')), {});
});

test('isLocalRequest rejects foreign host/origin', () => {
  assert.ok(isLocalRequest({ headers: { host: 'localhost:5173' } }));
  assert.ok(isLocalRequest({ headers: { host: '127.0.0.1:5173', origin: 'http://127.0.0.1:5173' } }));
  assert.ok(!isLocalRequest({ headers: { host: 'localhost:5173', origin: 'http://evil.example' } }));
  assert.ok(!isLocalRequest({ headers: { host: 'lab-pc.local:5173' } }));
});

test('proxy: forwards with key, hides key, blocks dotfiles / bad origin / bad input', async () => {
  const seen = [];
  const up = createServer((req, res) => {
    let b = ''; req.on('data', c => (b += c));
    req.on('end', () => {
      seen.push({ url: req.url, auth: req.headers.authorization, body: b ? JSON.parse(b) : null });
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/v1/models') return res.end(JSON.stringify({ data: [{ id: 'm-chat' }, { id: 'Qwen/Qwen3-Embedding-4B' }, { id: 'a-model' }] }));
      if (JSON.parse(b).messages.at(-1).content.includes('BOOM')) { res.statusCode = 429; return res.end(JSON.stringify({ error: { message: 'slow down' } })); }
      res.end(JSON.stringify({ choices: [{ message: { content: 'pong' } }] }));
    });
  });
  await new Promise(r => up.listen(5186, '127.0.0.1', r));
  const srv = await start(5185, { LLM_API_KEY: 'sekret-key', LLM_BASE_URL: 'http://127.0.0.1:5186/v1' });
  const call = (p, o) => fetch('http://localhost:5185' + p, o);
  const post = (body, headers = {}) => call('/api/llm/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });
  try {
    assert.deepEqual(await (await call('/api/llm/status')).json(), { configured: true, model: 'alias-huge-no-thinking', endpoint: '127.0.0.1:5186' });
    assert.deepEqual((await (await call('/api/llm/models')).json()).models, ['a-model', 'm-chat']);
    const ok = await post(JSON.stringify({ system: 's', prompt: 'hi', model: 'm-chat' }));
    assert.equal((await ok.json()).text, 'pong');
    const sent = seen.at(-1);
    assert.equal(sent.auth, 'Bearer sekret-key'); assert.equal(sent.body.model, 'm-chat'); assert.equal(sent.body.messages[0].role, 'system');
    assert.equal((await post(JSON.stringify({ prompt: 'BOOM' }))).status, 429);
    assert.equal((await post(JSON.stringify({ prompt: '  ' }))).status, 400);
    assert.equal((await call('/api/llm/chat', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'x' })).status, 415);
    assert.equal((await post('{nope')).status, 400);
    assert.equal((await post('{"prompt":"x"}', { Origin: 'http://evil.example' })).status, 403);
    for (const p of ['/.env', '/server/llm.mjs', '/package.json', '/node_modules/katex/package.json', '/%2e%2e/.env']) assert.equal((await call(p)).status, 404, p);
    assert.equal((await call('/index.html')).status, 200);
  } finally { srv.close(); up.close(); }
});

test('proxy without key answers 503 and status.configured=false', async () => {
  const srv = await start(5184, {});
  try {
    assert.equal((await (await fetch('http://localhost:5184/api/llm/status')).json()).configured, false);
    const r = await fetch('http://localhost:5184/api/llm/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"prompt":"x"}' });
    assert.equal(r.status, 503);
  } finally { srv.close(); }
});
