// "✨ AI" assist dialog: describe what you want in natural language, preview the result, apply it to the field.
import { app } from './app.js';
import { h } from './fields.js';
import { llmStatus, llmModels, llmGenerate } from '../llm.js';
import { buildPrompt, cleanOutput, conversationContext, QUICK } from '../aiPrompts.js';

let status = null, models = null;
const MODEL_KEY = 'chatmock.llmModel';
const getModel = () => { try { return localStorage.getItem(MODEL_KEY) || ''; } catch { return ''; } };
const setModel = (m) => { try { localStorage.setItem(MODEL_KEY, m); } catch { /* private mode */ } };

/**
 * opts: { label, kind, role, lang, current, msgIndex, apply(text) → may throw, instruction? }
 * `apply` receives the cleaned result; throwing keeps the dialog open and shows the message.
 */
export async function openAi(opts) {
  document.querySelector('.ai-overlay')?.remove();
  status ||= await llmStatus();
  const kind = opts.kind || 'plain-multi';
  const hasCurrent = !!String(opts.current || '').trim();

  const instr = h('textarea', { rows: 3, placeholder: kind === 'sources' ? 'e.g. 3 papers on retrieval grounding, one survey' : 'Describe what you want… e.g. “make the user ask about the effect size, based on: - RAG - hallucinations - sources”', spellcheck: 'false' });
  instr.value = opts.instruction || '';
  const useCur = h('input', { type: 'checkbox' }); const refineKind = kind === 'figure' || kind === 'svg';
  useCur.checked = hasCurrent && !refineKind;   // figures/SVG: start fresh by default, tick to refine the current one
  const useCtx = h('input', { type: 'checkbox' }); useCtx.checked = opts.msgIndex != null;
  const modelSel = h('select', {}, h('option', { value: '' }, 'Default model'));
  const result = h('textarea', { rows: 8, spellcheck: 'false', placeholder: 'The generated text appears here — you can edit it before applying.' });
  const err = h('div', { class: 'ai-err' });
  const gen = h('button', { class: 'primary' }, '✨ Generate');
  const apply = h('button', { disabled: true }, 'Apply to field');
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };

  const chips = h('div', { class: 'ai-chips' }, (QUICK[kind] || []).map(q => h('button', { class: 'small', type: 'button', onclick: () => { instr.value = q; instr.focus(); } }, q)));

  const dlg = h('div', { class: 'ai-dialog', role: 'dialog', 'aria-label': 'AI assist' },
    h('div', { class: 'ai-head' }, h('b', {}, '✨ AI assist'), h('span', { class: 'ai-sub' }, opts.label || ''), h('button', { class: 'small ghost', onclick: close, title: 'Close (Esc)' }, '✕')),
    status.configured ? null : h('div', { class: 'ai-err' }, 'No API key configured. Add LLM_API_KEY to the .env file next to server.mjs and restart `npm start`.'),
    h('label', { class: 'ai-lbl' }, 'What do you want here?'), instr, chips,
    h('div', { class: 'row' },
      hasCurrent ? h('label', { class: 'ai-chk' }, useCur, refineKind ? 'Refine the current figure instead of starting fresh' : 'Use current text as input') : null,
      opts.msgIndex != null ? h('label', { class: 'ai-chk' }, useCtx, 'Include conversation as context') : null),
    h('div', { class: 'row' }, gen, modelSel, h('span', { class: 'ai-sub' }, status.model ? `default: ${status.model}` : '')),
    err,
    h('label', { class: 'ai-lbl' }, 'Result'), result,
    h('div', { class: 'row' }, apply, h('button', { onclick: close }, 'Cancel')));
  const overlay = h('div', { class: 'ai-overlay', onmousedown: (e) => { if (e.target === overlay) close(); } }, dlg);
  document.body.append(overlay); document.addEventListener('keydown', onKey);
  instr.focus();

  // model list (best effort; selection persists)
  (async () => {
    try {
      models ||= await llmModels();
      models.models.forEach(m => modelSel.append(h('option', { value: m }, m)));
      const saved = getModel(); if (saved && models.models.includes(saved)) modelSel.value = saved;
    } catch { /* default model still works */ }
  })();
  modelSel.addEventListener('change', () => setModel(modelSel.value));

  const run = async () => {
    err.textContent = ''; gen.disabled = true; gen.textContent = '⏳ Generating…'; apply.disabled = true;
    try {
      const state = app.store.get();
      const { system, prompt } = buildPrompt({
        kind, role: opts.role, label: opts.label, instruction: instr.value, current: opts.current, useCurrent: useCur.checked,
        context: useCtx.checked ? conversationContext(state, opts.msgIndex) : '', lang: opts.lang,
      });
      const text = await llmGenerate({ system, prompt, model: modelSel.value || undefined, maxTokens: kind === 'svg' ? 3500 : kind === 'figure' ? 2500 : kind === 'sources' || kind === 'markdown' ? 2200 : 1500 });
      result.value = cleanOutput(text, kind); apply.disabled = !result.value;
    } catch (e) { err.textContent = e.message; }
    finally { gen.disabled = false; gen.textContent = result.value ? '↻ Regenerate' : '✨ Generate'; }
  };
  gen.onclick = run;
  instr.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (status.configured) run(); } });
  apply.onclick = () => {
    try { opts.apply(result.value); close(); app.toast('Applied — Ctrl+Z to undo'); }
    catch (e) { err.textContent = e.message; }
  };
  if (!status.configured) gen.disabled = true;
}
