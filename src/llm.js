// Browser client for the local /api/llm proxy (the API key stays on the server).
async function json(r) { try { return await r.json(); } catch { return {}; } }

export async function llmStatus() {
  try { return await json(await fetch('/api/llm/status')); } catch { return { configured: false }; }
}
export async function llmModels() {
  const r = await fetch('/api/llm/models'); const j = await json(r);
  if (!r.ok) throw new Error(j.error || 'Could not load models');
  return j;
}
export async function llmGenerate({ system, prompt, model, maxTokens = 1500, temperature }) {
  let r;
  try { r = await fetch('/api/llm/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system, prompt, model, maxTokens, temperature }) }); }
  catch { throw new Error('Cannot reach the local server — is `npm start` running?'); }
  const j = await json(r);
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j.text;
}
