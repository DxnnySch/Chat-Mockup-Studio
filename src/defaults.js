// Default project shape, font stacks, sample conversation and validation.
import { merge, clone, uid } from './util.js';

export const FONT_STACKS = {
  'Sans (system)': 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  'Humanist': '"Segoe UI", "Gill Sans", Candara, Optima, "Trebuchet MS", sans-serif',
  'Geometric': '"Century Gothic", "Avenir Next", Futura, "Trebuchet MS", sans-serif',
  'Rounded': '"Varela Round", "Nunito", "Arial Rounded MT Bold", "Segoe UI", sans-serif',
  'Serif': 'Georgia, "Times New Roman", "Noto Serif", serif',
  'Book serif': '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  'Mono': 'ui-monospace, "Cascadia Code", Consolas, "SF Mono", Menlo, monospace',
  'Arial': 'Arial, Helvetica, sans-serif',
  'Times': '"Times New Roman", Times, serif',
};

export const ICONS = ['spark', 'bot', 'brain', 'user', 'flask', 'atom', 'chat', 'star', 'leaf', 'book', 'cap', 'cpu'];

export const baseTheme = () => ({
  font: { body: FONT_STACKS['Sans (system)'], heading: FONT_STACKS['Sans (system)'], mono: FONT_STACKS.Mono, size: 22, lineHeight: 1.5, weight: 400, letterSpacing: 0 },
  colors: { text: '#1f2328', muted: '#5b6470', accent: '#2563eb', link: '#1d4ed8', surface: '#ffffff', border: '#d9dee5', codeBg: '#f3f5f8', codeText: '#1f2328' },
  gap: 24,
  user: { align: 'right', layout: 'bubble', bg: '#e8eefc', color: '#1f2328', radius: 20, borderWidth: 0, borderColor: '#c7d3f5', maxWidth: 78, padX: 20, padY: 14, shadow: 'none', fontScale: 1 },
  assistant: { align: 'left', layout: 'plain', bg: 'transparent', color: '#1f2328', radius: 20, borderWidth: 0, borderColor: '#d9dee5', maxWidth: 100, padX: 0, padY: 0, shadow: 'none', fontScale: 1 },
  avatar: { show: true, size: 48, shape: 'circle', position: 'side', ring: 0, ringColor: '#ffffff', gap: 16 },
  names: { show: true, showForUser: false, scale: 0.72, weight: 700, uppercase: false },
  time: { show: false, scale: 0.65 },
  sources: { style: 'cards', title: 'Sources', scale: 0.7, showSnippet: true, showIndex: true, columns: 1, showSite: true },
  meta: { show: true, scale: 0.66, position: 'below', separator: ' · ', showLabels: false, fields: ['model', 'latency', 'tokens', 'confidence', 'date', 'custom'] },
  actions: { show: true, items: ['copy', 'like', 'dislike', 'regenerate', 'share'], scale: 0.8, color: '#5b6470' },
  thinking: { bg: '#f6f7f9', color: '#5b6470', borderColor: '#d9dee5', scale: 0.82 },
  code: { radius: 12, scale: 0.82, showHeader: true, lineNumbers: false },
  media: { radius: 14, borderWidth: 1, borderColor: '#d9dee5', captionScale: 0.68 },
  chart: { palette: 'Okabe-Ito', gridColor: '#e3e7ec', axisColor: '#5b6470', fontScale: 0.7, barRadius: 3 },
  diagram: { nodeBg: '#eef3ff', nodeBorder: '#2563eb', nodeText: '#1f2328', edgeColor: '#5b6470', fontScale: 0.72 },
  chip: { bg: '#ffffff', color: '#1f2328', borderColor: '#d9dee5', radius: 999 },
});

export const baseCanvas = () => ({
  width: 1000, minHeight: 0, padding: 40, radius: 0, physicalCm: 30, exportScale: 3, minPt: 18, goodPt: 24,
  bg: { mode: 'solid', color: '#ffffff', color2: '#eef2ff', angle: 160, image: '' },
  transparent: false, border: 0, borderColor: '#d9dee5', shadow: false,
});

export const baseChrome = () => ({
  header: { show: true, style: 'window', title: 'Research Assistant', subtitle: 'Online', modelBadge: 'Model-X 1', bg: '#f6f7f9', color: '#1f2328', border: true, controls: 'mac', align: 'left' },
  input: { show: true, placeholder: 'Message Research Assistant…', text: '', bg: '#f6f7f9', color: '#1f2328', radius: 28, border: '#d9dee5', sendColor: '#2563eb', attach: true, mic: false, disclaimer: 'AI can make mistakes. Check important information.' },
  frame: { style: 'card', color: '#111827', radius: 18, thickness: 14, bodyPad: 32, shadow: true },
});

export const baseParticipants = () => ({
  user: { name: 'You', avatar: { type: 'initials', value: 'YO', bg: '#2563eb', color: '#ffffff', image: '' } },
  assistant: { name: 'Assistant', model: 'Model-X 1', avatar: { type: 'icon', value: 'spark', bg: '#111827', color: '#ffffff', image: '' } },
});

const msg = (role, blocks, extra = {}) => ({ id: uid('m'), role, blocks, ...extra });
export const textBlock = (text = '') => ({ id: uid('b'), type: 'text', text });

export function sampleConversation() {
  return [
    msg('user', [textBlock('How much does retrieval-augmented generation (RAG) reduce hallucinations compared with a plain LLM? Please include sources and a quick overview of the pipeline.')], { time: '10:41' }),
    msg('assistant', [
      textBlock('Across recent evaluations, **retrieval grounding reduces unsupported claims substantially**, but the gain depends on retrieval quality [1][2]. In a typical setup the faithfulness score is modelled as\n\n$$F = \\frac{|\\text{supported claims}|}{|\\text{all claims}|}$$\n\nIllustrative results (not real data):'),
      { id: uid('b'), type: 'chart', chartType: 'bar', title: 'Faithfulness by method', csv: 'Method,Faithfulness,Faithfulness±\nPlain LLM,0.61,0.04\nRAG (dense),0.78,0.03\nRAG (hybrid),0.84,0.03\nRAG + verifier,0.91,0.02', xLabel: '', yLabel: 'Faithfulness (0–1)', height: 300, caption: 'Figure 1 · Mean ± SD over 5 runs (illustrative).', legend: false },
      { id: uid('b'), type: 'diagram', src: 'direction LR\nQ[User query] --> R(Retriever)\nR --> D[Documents]\nR --> G[Generator]\nG --> V{Verified?}\nV --> A[Answer + citations] : yes\nV --> R : no\nstyle A #16a34a', caption: 'Figure 2 · Simplified RAG pipeline (hover nodes).' },
      textBlock('**Key takeaways**\n\n- Hybrid retrieval beats dense-only retrieval in most benchmarks [2]\n- A verification step adds the largest single gain [3]\n- Citing sources makes answers *auditable*, not automatically *correct*'),
    ], {
      time: '10:41', thinking: { text: 'The user wants a quantitative comparison. I will recall typical evaluation settings, then summarise with a chart and a pipeline overview, and attach sources.', duration: 8, open: false },
      sources: [
        { title: 'Grounded generation reduces unsupported claims in open-domain QA', site: 'Journal of Example Studies', url: 'https://example.org/paper-1', year: '2024', authors: 'Doe, J.; Roe, R.', snippet: 'Retrieval grounding lowered unsupported statements by 38% relative to the ungrounded baseline.' },
        { title: 'Hybrid sparse–dense retrieval for evidence selection', site: 'Proc. of the Example Conf. 2025', url: 'https://example.org/paper-2', year: '2025', authors: 'Mustermann, M.', snippet: 'Hybrid retrievers improved recall@10 by 6.1 points over dense-only retrieval.' },
        { title: 'Post-hoc verification of generated answers', site: 'arXiv preprint', url: 'https://example.org/paper-3', year: '2025', authors: 'Smith, A.; Kim, B.', snippet: 'A verifier model filtered 71% of hallucinated statements before display.' },
      ],
      meta: { model: 'Model-X 1', latency: '4.2 s', tokens: '612 tokens', confidence: '', date: '', custom: [] },
      followups: ['Show the evaluation protocol', 'Which retrievers were compared?', 'Export as table'],
      reactions: [], versions: { count: 1, index: 1 },
    }),
  ];
}

const withSrcIds = (m) => (m.sources ? { ...m, sources: m.sources.map(s => ({ id: s.id || uid('s'), ...s })) } : m);

export function newProject() {
  return {
    version: 1, name: 'Untitled mockup',
    canvas: baseCanvas(), chrome: baseChrome(), theme: baseTheme(), participants: baseParticipants(),
    messages: sampleConversation().map(withSrcIds), annotations: [], fonts: [], assets: {},
  };
}

/** Fill gaps with defaults so older / hand-edited JSON never crashes the renderer. Throws on garbage. */
export function normalizeProject(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('Project must be a JSON object.');
  if (p.messages !== undefined && !Array.isArray(p.messages)) throw new Error('"messages" must be an array.');
  const base = newProject();
  const out = merge({ ...base, messages: [], annotations: [], fonts: [], assets: {} }, p);
  out.messages = (p.messages ?? base.messages).map(m => {
    if (!m || typeof m !== 'object') throw new Error('Every message must be an object.');
    const mm = clone(m);
    mm.id ||= uid('m'); mm.role = mm.role === 'user' ? 'user' : 'assistant';
    if (Array.isArray(mm.sources)) mm.sources = mm.sources.filter(s => s && typeof s === 'object').map(s => ({ id: s.id || uid('s'), ...s }));
    mm.blocks = Array.isArray(mm.blocks) ? mm.blocks.filter(b => b && typeof b === 'object').map(b => ({ id: b.id || uid('b'), ...b })) : [];
    return mm;
  });
  return out;
}
