// Local server: static files + /api/llm/* proxy. `npm start` → http://localhost:5173 (bound to 127.0.0.1 only).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi, loadEnvFile } from './server/llm.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
// Only these top-level entries are public. Everything else (.env, server/, node_modules, tests, docs…) is not served.
const PUBLIC = new Set(['index.html', 'src', 'css', 'vendor']);

export function start(port = Number(process.env.PORT) || 5173, env = { ...loadEnvFile(join(root, '.env')), ...process.env }) {
  const server = createServer(async (req, res) => {
    try {
      if (await handleApi(req, res, env)) return;
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = resolve(join(root, normalize(p)));
      const rel = file.slice(root.length + 1).split(sep);
      if (!file.startsWith(root + sep) || !PUBLIC.has(rel[0]) || rel.some(s => s.startsWith('.'))) { res.writeHead(404).end('Not found'); return; }
      const s = await stat(file);
      if (!s.isFile()) throw new Error('nf');
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(await readFile(file));
    } catch { res.writeHead(404).end('Not found'); }
  });
  return new Promise(r => server.listen(port, '127.0.0.1', () => {
    const k = env.LLM_API_KEY || env.OPENAI_API_KEY;
    console.log(`Chat Mockup Studio: http://localhost:${port}   (LLM assist: ${k ? 'enabled' : 'no API key in .env'})`);
    r(server);
  }));
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) start();
