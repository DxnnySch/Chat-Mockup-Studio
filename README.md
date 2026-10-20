# Chat Mockup Studio

Fake-but-convincing LLM chat screenshots for scientific posters, slides and papers. Everything is editable.

```
npm install      # only needed for tests (vendored libs are committed)
npm start        # http://localhost:5173
npm test         # unit tests (node:test)
npm run test:e2e # drives system Chrome/Edge: render, edit, export, reload
```

## Workflow
1. **Left panel** – edit the conversation: add/reorder/duplicate messages; per message edit blocks
   (text+LaTeX, code, image, video frame, table, chart with error bars, flow diagram, callout, file, quote, tool call),
   reasoning panel, **sources** (cite with `[1]`), meta info, follow-ups, reactions, version pager, typing/streaming/error states, per-message style overrides.
   Click anything in the preview to jump to its editor.
2. **Right panel** – *Style* (presets, fonts incl. upload, colours, bubbles, avatars, sources style, …), *Canvas* (size presets, background,
   transparent, window/phone frame, header, input bar), *People* (names, avatars: initials/emoji/icon/image), *Poster*, *Notes* (annotations), *JSON* (whole project, raw).
3. **Poster tab** – printed width → effective pt for every text class, effective DPI, WCAG contrast, one-click “raise text to thresholds”, colour-blind-safe palettes.
4. **Notes tab** – drag-able numbered badges, labels, arrows, highlight boxes (included in exports).
5. **Export ▾** – PNG (1–8×, optional transparency), clipboard, SVG, standalone interactive HTML (hover diagrams/charts), PDF via print, project JSON.

## ✨ AI assist (scads.ai / any OpenAI-compatible endpoint)
Every text area (message text, code, chart/table CSV, diagram DSL, follow-ups, snippets, …) and key one-line fields
(captions, titles, header text) has a **✨ AI** button. Describe what you want in plain language — e.g. *"turn my bullet points into
the question a researcher would ask"* or *"rewrite as 3 bullets with bold key terms, keep the citations"*. The dialog can use the current
text and the conversation so far as context, shows an editable preview, and **Apply** is one undo step (Ctrl+Z).
The message editor also has **✨ Generate sources…** (illustrative placeholder references — replace them with real ones).

Setup: copy `.env.example` to `.env`, set `LLM_API_KEY` (and optionally `LLM_BASE_URL`, `LLM_MODEL`), then `npm start`.
The key stays on the local server (bound to 127.0.0.1, same-origin only); the browser only talks to `/api/llm/*`, and `.env` is never served.
Pick another model per request in the dialog (list comes from the endpoint's `/models`).

## Faking complex content (figures, schematics)
- **Figure (multi-panel)** block: panels (a), (b), … side by side / stacked / grid. Each panel is a line, area, bar or scatter chart with
  dual y-axes (`name@right` column), error bars (`name±`), point labels (`Year@label`), zero line, **trend line and Pearson r computed from the data**
  (or your own override text such as `r = −0.58, p < 0.001`).
- **🎲 Synthetic correlated data…** makes plausible, noisy yearly series with an *exact* target r (seeded → reproducible) and fills a time-series + scatter figure — no LLM needed.
- **✨ Build figure from description…** — paste e.g. “two panels: (a) sea-ice anomaly and jet waviness 1979–2020, (b) scatter with trend line and r”.
  The LLM returns only the *parameters* (years, trend, noise, target r, labels) and the app generates the data, so it is cheap (rate-limit friendly), noisy like real data, and r is exactly what was asked for.
  For bars/curves it writes small CSVs. Tick “Refine the current figure” to modify an existing one.
- **Custom SVG** block: anything else (pipelines, maps, 2×2 matrices…) — describe it with ✨ AI or paste SVG. Output is sanitised (no scripts, styles, images, links or external references).

## Notes
- Autosaves to IndexedDB; *Project ▾* saves/opens named projects and imports/exports JSON (assets embedded).
- Video: choose a file, a frame is grabbed as the poster (the video itself is not stored); player controls are drawn over it.
- SVG export wraps HTML in `<foreignObject>` (text stays live, not outlined); for journals prefer PNG ≥ 300 dpi.
- Sample sources/data are placeholders — replace them; the tool makes mock-ups, not real model output.
- Diagram DSL: `A[Box] --> B(Round) --> C{Decision} : label`, `((circle))`, `[[stadium]]`, `style A #16a34a`, `direction LR|TD` (default: auto-fit).
- Chart CSV: first column = x/category; extra columns = series; a column `name±` (or `_err`, `_sd`) adds error bars.
