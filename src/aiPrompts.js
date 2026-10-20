// Prompt construction + output cleaning for LLM assist. Pure (no DOM / network).
import { correlatedSeries, timeSeriesCsv, scatterCsv } from './synth.js';

export const KINDS = {
  markdown: 'Markdown. Supported: **bold**, *italic*, `code`, lists ("- " / "1. "), "> " quotes, "## " headings, inline math $...$ and block math $$...$$ (LaTeX), links, and citation markers like [1] or [1,2] that refer to the message\'s numbered sources. Keep it poster-friendly: short paragraphs, no filler.',
  plain: 'A short single line of plain text (no markdown, no surrounding quotes).',
  'plain-multi': 'Plain text (no markdown headings, no surrounding quotes). Short paragraphs allowed.',
  lines: 'One item per line. No numbering, no bullets, no quotes.',
  'csv-chart': 'CSV with a header row. First column = x value or category label; every further column = one numeric series (dot as decimal separator). Optionally add an error column named "<series>±". At most 8 data rows. Output only the CSV.',
  'csv-table': 'CSV with a header row; cells may contain short text or numbers (dot decimals). At most 8 data rows. Output only the CSV.',
  diagram: 'Flow-diagram DSL, one statement per line: `A[Label] --> B(Rounded) --> C{Decision} : edge label`; shapes: [box] (round) {diamond} ((circle)) [[stadium]]; optional `style A #16a34a`; optional `direction LR` or `direction TD`. Use short IDs (A, B, C…) and short labels. 4–9 nodes. Output only the DSL.',
  code: 'Only raw source code — no markdown fences and no explanation. Comments inside the code are fine.',
  figure: 'A single JSON object describing a multi-panel scientific figure for a mock-up with ILLUSTRATIVE SYNTHETIC data (never claim it is real). Schema: {"title": string (optional), "caption": string (e.g. "Figure 1 · … (illustrative synthetic data)"), "layout": "row"|"col"|"grid", "synthetic": {...} (optional, see below), "panels": [ {"title": string (do NOT write panel letters like "(a)" — they are added automatically), "chartType": "line"|"bar"|"scatter"|"area", "csv": string, "source": "timeseries"|"scatter", "xLabel": string, "yLabel": string, "y2Label": string, "trend": boolean, "showR": boolean, "showN": boolean, "labelPoints": boolean, "labelEvery": integer, "zeroLine": boolean, "legend": boolean} ] } with 1 to 4 panels.\n\nTWO YEARLY VARIABLES AND THEIR RELATIONSHIP: do NOT write the numbers. Add "synthetic": {"from": 1979, "to": 2020, "rho": target Pearson r between A and B (usually moderate, e.g. -0.55), "seed": any integer, "aName": string, "aUnit": string, "aMean": number, "aTrend": total change of A over the period (same unit as A), "aNoise": year-to-year standard deviation of A, "bName": string, "bUnit": string, "bMean": number, "bSd": standard deviation of B} and give panels "source": "timeseries" (both series on a dual-axis line chart, A left, B right) or "source": "scatter" (B on x against A on y, points labelled with years, trend line and r shown) INSTEAD of a csv; axis labels and chart type are then filled in automatically. The generator makes the data realistic and noisy.\n\nOTHER DATA (bars, curves, small tables): write the "csv" string yourself (use \\n for line breaks inside the JSON), at most 12 rows. First column = x value or category; every further column = one numeric series; a header ending in "@right" puts a series on a right y-axis; "<series>±" is an error-bar column; a header "label" or ending in "@label" supplies point labels and is not plotted. Use realistic magnitudes, visible noise, modest trends. Output only the JSON object.',
  svg: 'One standalone SVG document and nothing else: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 H">…</svg> (choose H, typically 300–520). Use only shapes, paths, text, gradients and markers; NO scripts, NO <style>, NO external images, fonts or links, NO foreignObject. Use font-family="inherit" for text, font-size at least 22 for labels and 28 for titles (the figure is viewed from a distance on a poster), high-contrast colour-blind-safe colours (e.g. #0072B2 #D55E00 #009E73 #E69F00), transparent background, and keep all content inside the viewBox with a 16-unit margin.',
  sources: 'A JSON array of 3 to 5 objects with the string fields "title", "site", "authors", "year", "url", "snippet" (snippet = one sentence that the source supports). These are ILLUSTRATIVE PLACEHOLDER references for a mock-up: use plausible but clearly example-style venues, "https://example.org/…" URLs and no DOIs. Output only the JSON array.',
};

const BASE = 'You are an assistant embedded in a tool that creates mock-up screenshots of LLM chatbot conversations for scientific posters. You write the content of exactly ONE field. Output ONLY that content: no preamble, no explanation, no surrounding quotes, and no code fence unless the format itself requires it. Reply in the language of the user\'s instruction or current text unless told otherwise. Any facts or numbers are for illustration in a mock-up; keep them plausible and never present them as real measurements.';

/** "messages.2.blocks.0.text" → { msgIndex: 2, blockIndex: 0 } (nulls when not a message path). */
export function parseFieldPath(path) {
  const m = String(path || '').match(/^messages\.(\d+)(?:\.blocks\.(\d+))?/);
  return { msgIndex: m ? +m[1] : null, blockIndex: m && m[2] !== undefined ? +m[2] : null };
}

const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

/** Compact transcript of the conversation so the model can stay consistent with it. */
export function conversationContext(state, msgIndex, { maxMessages = 8, maxChars = 600 } = {}) {
  const msgs = state?.messages || [];
  if (!msgs.length) return '';
  const names = { user: state.participants?.user?.name || 'User', assistant: state.participants?.assistant?.name || 'Assistant' };
  const start = Math.max(0, (msgIndex ?? msgs.length) - maxMessages + 1);
  return msgs.slice(start, msgIndex == null ? undefined : msgIndex + 1).map((m, k) => {
    const text = (m.blocks || []).filter(b => b.type === 'text' && b.text).map(b => b.text).join(' ');
    const extra = (m.blocks || []).filter(b => b.type !== 'text').map(b => b.type).join(', ');
    const marker = start + k === msgIndex ? '  <<< the field being edited belongs to this message' : '';
    return `[${names[m.role === 'user' ? 'user' : 'assistant']}]: ${clip(text, maxChars)}${extra ? ` (also contains: ${extra})` : ''}${marker}`;
  }).join('\n');
}

export function buildPrompt({ kind = 'plain-multi', role = null, label = 'text', instruction = '', current = '', useCurrent = true, context = '', lang = '' }) {
  let rules = KINDS[kind] || KINDS['plain-multi'];
  if (kind === 'code' && lang) rules += ` Language: ${lang}.`;
  let roleLine = '';
  if (kind === 'markdown' || kind === 'plain-multi') {
    if (role === 'user') roleLine = '\nPerspective: write it as the human USER talking to the chatbot (first person, natural phrasing, no assistant-style headings or bullet formatting unless asked).';
    else if (role === 'assistant') roleLine = '\nPerspective: write it as the AI ASSISTANT\'s reply to the user: helpful, accurate-sounding and well structured.';
  }
  const cur = useCurrent && String(current || '').trim();
  const instr = String(instruction || '').trim() || (cur ? 'Improve and format the current content; keep its meaning.' : 'Write suitable content.');
  const prompt = [
    `Field: ${label}`, `Required format: ${rules}${roleLine}`,
    context ? `\nConversation so far (for consistency):\n${context}` : '',
    cur ? `\nCurrent content of the field:\n<<<\n${current}\n>>>` : '',
    `\nUser's instruction: ${instr}`,
  ].filter(Boolean).join('\n');
  return { system: BASE, prompt };
}

/** Strip the typical chatty wrappers models add despite instructions. */
export function cleanOutput(text, kind = 'plain') {
  let t = String(text ?? '').replace(/\r\n?/g, '\n').trim();
  t = t.replace(/^(here('s| is| are)|sure|certainly|of course)[^\n]*:\s*\n+/i, '');
  const fence = t.match(/^```[\w+-]*\n([\s\S]*?)\n?```$/);
  if (fence) t = fence[1];
  if (kind === 'svg') { const a = t.indexOf('<svg'), z = t.lastIndexOf('</svg>'); if (a >= 0 && z > a) t = t.slice(a, z + 6); }
  if (kind === 'plain' || kind === 'lines') t = t.replace(/^(["“”'`])([\s\S]*)\1$/, '$2').trim();
  if (kind === 'lines') t = t.split('\n').map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim()).filter(Boolean).join('\n');
  return t.trim();
}

export function parseSourcesJson(text) {
  const t = String(text || '');
  const a = t.indexOf('['), b = t.lastIndexOf(']');
  if (a < 0 || b <= a) throw new Error('The answer did not contain a JSON array.');
  let arr; try { arr = JSON.parse(t.slice(a, b + 1)); } catch { throw new Error('The answer is not valid JSON — press Generate again.'); }
  if (!Array.isArray(arr) || !arr.length) throw new Error('No sources in the answer.');
  const s = (v) => (v == null ? '' : String(v));
  return arr.filter(x => x && typeof x === 'object').map(x => ({ title: s(x.title) || 'Untitled', site: s(x.site), authors: s(x.authors), year: s(x.year), url: s(x.url), snippet: s(x.snippet) }));
}

const clipStr = (v, n = 300) => String(v ?? '').slice(0, n);
const bool = (v) => v === true || v === 'true';

/** Validate/normalise the figure JSON returned by the model into block fields (expands the "synthetic" generator spec). */
export function parseFigureJson(text) {
  const t = String(text || '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('The answer did not contain a JSON object.');
  let o; try { o = JSON.parse(t.slice(a, b + 1)); } catch { throw new Error('The answer is not valid JSON — press Generate again.'); }
  if (!o || !Array.isArray(o.panels) || !o.panels.length) throw new Error('The figure has no panels.');
  const numIn = (v, d, lo, hi) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
  let data = null, A = '', B = '';
  const sy = o.synthetic && typeof o.synthetic === 'object' ? o.synthetic : null;
  if (sy) {
    const from = Math.round(numIn(sy.from, 1979, 1000, 2200)), to = Math.round(numIn(sy.to, from + 41, from + 3, from + 250));
    data = correlatedSeries({
      from, to, rho: numIn(sy.rho, -0.5, -0.95, 0.95), seed: Math.round(numIn(sy.seed, 7, 1, 99999)),
      a: { mean: numIn(sy.aMean, 0, -1e6, 1e6), trend: numIn(sy.aTrend, -1, -1e6, 1e6), noise: numIn(sy.aNoise, 0.5, 0.001, 1e6) },
      b: { mean: numIn(sy.bMean, 0, -1e6, 1e6), sd: numIn(sy.bSd, 1, 0.001, 1e6) },
    });
    const lab = (n, u, d) => clipStr(n || d, 60) + (u ? ' (' + clipStr(u, 24) + ')' : '');
    A = lab(sy.aName, sy.aUnit, 'Series A'); B = lab(sy.bName, sy.bUnit, 'Series B');
  }
  const panels = o.panels.slice(0, 6).map(p => {
    if (!p || typeof p !== 'object') return null;
    let base = {};
    if (data && p.source === 'timeseries') base = { chartType: 'line', csv: timeSeriesCsv(data, A, B), xLabel: 'Year', yLabel: A, y2Label: B, legend: true, zeroLine: true };
    else if (data && p.source === 'scatter') base = { chartType: 'scatter', csv: scatterCsv(data, B, A), xLabel: B, yLabel: A, trend: true, showR: true, showN: true, labelPoints: true, labelEvery: 5, zeroLine: true };
    else if (typeof p.csv === 'string' && p.csv.trim().includes('\n')) base = { csv: p.csv.slice(0, 40000) };
    else return null;
    const out = { title: clipStr(p.title, 160).replace(/^\(?[a-f]\)\s*/i, ''), chartType: base.chartType || (['line', 'bar', 'scatter', 'area'].includes(p.chartType) ? p.chartType : 'line'), csv: base.csv };
    for (const k of ['xLabel', 'yLabel', 'y2Label']) out[k] = base[k] || clipStr(p[k], 120);
    for (const k of ['trend', 'showR', 'showN', 'labelPoints', 'zeroLine', 'legend']) out[k] = p[k] !== undefined ? bool(p[k]) : !!base[k];
    out.labelEvery = Math.max(1, Math.min(50, parseInt(p.labelEvery, 10) || base.labelEvery || 1));
    return out;
  }).filter(Boolean);
  if (!panels.length) throw new Error('No panel contained usable data (give a csv, or a "source" together with "synthetic").');
  return { title: clipStr(o.title, 200), caption: clipStr(o.caption, 400), layout: ['row', 'col', 'grid'].includes(o.layout) ? o.layout : 'row', panels };
}

/** One-click starting instructions per field kind. */
export const QUICK = {
  figure: ['Two panels: two yearly time series on dual axes, then a scatter of one against the other with trend line and r', 'Bar chart comparing 4 methods with error bars plus a learning curve', '2×2 grid: four small bar charts, one per benchmark'],
  svg: ['A schematic of a three-stage pipeline with icons-as-shapes and short labels', 'A simple map-like diagram with labelled regions (abstract shapes)', 'A conceptual 2×2 matrix with axis labels and four labelled quadrants'],
  markdown: ['Turn my bullet points into a natural paragraph', 'Format as short bullet list with bold key terms', 'Make it more concise', 'Add a citation marker [1] where a claim needs support', 'Explain it for a non-expert'],
  'plain-multi': ['Turn my bullet points into a natural message', 'Make it more concise', 'Fix grammar and wording'],
  plain: ['Make it shorter', 'Write a fitting title', 'Fix grammar and wording'],
  lines: ['Suggest 3 follow-up questions a researcher might ask', 'Make them shorter'],
  'csv-chart': ['Generate illustrative results for 4 methods with error bars', 'Generate a learning curve over 6 epochs for train and validation'],
  'csv-table': ['Generate a small results table comparing a baseline with our method'],
  diagram: ['Draw the pipeline described in my text as a flow diagram', 'Add a verification step with a feedback loop'],
  code: ['Write a short, readable example', 'Add comments explaining each step'],
  sources: ['Generate sources that support the answer above'],
};
