// Server-side proxy to an OpenAI-compatible endpoint (scads.ai by default). The API key never reaches the browser.
import { readFileSync, existsSync } from 'node:fs';

export function loadEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || raw.trimStart().startsWith('#')) continue;
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

export function llmConfig(env) {
  return {
    key: env.LLM_API_KEY || env.OPENAI_API_KEY || '',
    base: (env.LLM_BASE_URL || 'https://llm.scads.ai/v1').replace(/\/+$/, ''),
    model: env.LLM_MODEL || 'alias-huge-no-thinking',
    timeoutMs: (Number(env.LLM_TIMEOUT_SECONDS) || 120) * 1000,
  };
}

const NON_CHAT = /embed|rerank|\btts\b|\bstt\b|whisper|image-generation|omnivoice|flux/i;
const MAX_BODY = 300 * 1024;

const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };

/** Only same-origin requests from a local page may use the key (blocks other websites / LAN clients). */
export function isLocalRequest(req) {
  const host = req.headers.host || '';
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) return false;
  const origin = req.headers.origin;
  return !origin || origin === `http://${host}`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(Object.assign(new Error('Request too large'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function upstream(cfg, path, init = {}) {
  const r = await fetch(cfg.base + path, { ...init, headers: { Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json', ...(init.headers || {}) }, signal: AbortSignal.timeout(cfg.timeoutMs) });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch { /* non-JSON error page */ }
  return { ok: r.ok, status: r.status, json, text };
}

const errText = (u) => String(u.json?.error?.message || u.json?.detail || u.json?.message || u.text || 'upstream error').replace(/[0-9a-f]{24,}/gi, '…').slice(0, 300);

/** Returns true if the request was an /api/ request and has been answered. */
export async function handleApi(req, res, env) {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith('/api/')) return false;
  if (!isLocalRequest(req)) { send(res, 403, { error: 'Forbidden' }); return true; }
  const cfg = llmConfig(env);
  try {
    if (req.method === 'GET' && url.pathname === '/api/llm/status') {
      send(res, 200, { configured: !!cfg.key, model: cfg.model, endpoint: new URL(cfg.base).host });
    } else if (req.method === 'GET' && url.pathname === '/api/llm/models') {
      if (!cfg.key) return send(res, 503, { error: 'No API key configured (LLM_API_KEY in .env).' }), true;
      const u = await upstream(cfg, '/models');
      if (!u.ok) return send(res, 502, { error: errText(u) }), true;
      const models = (u.json?.data || []).map(m => m.id).filter(id => id && !NON_CHAT.test(id)).sort();
      send(res, 200, { models, default: cfg.model });
    } else if (req.method === 'POST' && url.pathname === '/api/llm/chat') {
      if (!/application\/json/i.test(req.headers['content-type'] || '')) return send(res, 415, { error: 'JSON required' }), true;
      if (!cfg.key) return send(res, 503, { error: 'No API key configured. Add LLM_API_KEY to .env and restart the server.' }), true;
      let body; try { body = JSON.parse(await readBody(req)); } catch (e) { return send(res, e.code === 413 ? 413 : 400, { error: e.code === 413 ? 'Request too large' : 'Invalid JSON' }), true; }
      const prompt = typeof body.prompt === 'string' ? body.prompt : '';
      if (!prompt.trim()) return send(res, 400, { error: 'Empty prompt' }), true;
      const model = typeof body.model === 'string' && /^[\w./:-]{1,80}$/.test(body.model) ? body.model : cfg.model;
      const messages = [...(typeof body.system === 'string' && body.system ? [{ role: 'system', content: body.system }] : []), { role: 'user', content: prompt }];
      const payload = { model, messages, max_tokens: Math.min(4000, Math.max(50, Number(body.maxTokens) || 1500)), temperature: typeof body.temperature === 'number' ? Math.min(1.5, Math.max(0, body.temperature)) : 0.6, enable_thinking: false };
      let u = await upstream(cfg, '/chat/completions', { method: 'POST', body: JSON.stringify(payload) }).catch(e => ({ ok: false, status: 0, json: null, text: String(e.message) }));
      if (!u.ok && (u.status >= 500 || u.status === 0)) { await new Promise(r => setTimeout(r, 1200)); u = await upstream(cfg, '/chat/completions', { method: 'POST', body: JSON.stringify(payload) }).catch(e => ({ ok: false, status: 0, json: null, text: String(e.message) })); }
      if (!u.ok) return send(res, u.status === 429 ? 429 : 502, { error: u.status === 429 ? 'Rate limited by the LLM service — wait a moment and retry. ' + errText(u) : errText(u) }), true;
      const msg = u.json?.choices?.[0]?.message || {};
      const text = msg.content || msg.reasoning_content || '';
      if (!text.trim()) return send(res, 502, { error: 'The model returned an empty answer (try another model).' }), true;
      send(res, 200, { text, model });
    } else send(res, 404, { error: 'Not found' });
  } catch (e) {
    send(res, 502, { error: String(e.message || e).slice(0, 300) });
  }
  return true;
}
