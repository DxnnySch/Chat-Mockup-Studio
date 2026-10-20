# Chat Mockup Studio — Design

## Intent
Generate faked-but-convincing screenshots of a user talking to an LLM chatbot, for scientific posters,
slides and papers. Everything visual must be editable; output must be legible at poster distance and
sharp at print resolution.

## Goals
- Edit the *conversation* (messages, roles, blocks) and the *look* (fonts, colors, bubbles, avatars,
  chrome, spacing, backgrounds) live, with WYSIWYG preview.
- Message content blocks: markdown text (+ LaTeX math), code, image, video (frame + player UI),
  table, chart (bar/line/scatter, error bars), flow diagram (text DSL, hover-interactive),
  callout, file attachment, quote, tool call, reasoning ("thinking") panel.
- Provenance: numbered inline citations `[1]`, source list in 3 styles (footnotes / chips / cards).
- Meta info per message: model, latency, tokens, confidence, date, custom items; actions row
  (copy/like/dislike/regenerate/share), reactions, version pager, edited flag, error state,
  typing indicator, streaming cursor, follow-up suggestion chips.
- Poster tooling: canvas presets (poster column, slide 16:9, square, A4, custom), physical width →
  effective pt sizes, effective DPI, readability report (min font pt, WCAG contrast), colour-blind-safe
  palettes, transparent background, annotation layer (numbered badges, arrows, boxes, labels).
- Export: PNG (1–8×, transparent optional), SVG, standalone interactive HTML, project JSON, print/PDF.
- Presets (generic, not brand-copies): Clean Light, Clean Dark, Warm Serif, Bubbles, Terminal,
  Poster High-Contrast. Custom presets can be saved.
- Raw JSON editor for the whole project ("anything is editable"). Undo/redo. Autosave (IndexedDB).
- Custom fonts (upload), custom avatars (upload image / emoji / initials / icon).

## Non-goals
Real LLM calls, multi-user, accounts, mobile-optimised editor UI, pixel-perfect copies of any
commercial product (no logos/trademarks).

## Anti-goals
Tiny, low-contrast text by default; export differing from preview; losing work on reload.

## Constraints / my calls (user delegated all decisions)
- Static ES-module web app, no build step; zero-dependency Node static server (`npm start`,
  http://localhost:5173). Vendored libs: KaTeX (math), html-to-image (raster/SVG export).
- Works offline. System font stacks by default; fonts can be uploaded.
- Project = one JSON document (`project`), assets (images/video frames/fonts) embedded as data URLs.
- Preview and export use the same DOM (`#stage`); export scales it.

## Architecture
`state.js` store (get/set path, undo/redo, subscribe, persist) → `render/chat.js` renders project to
DOM with CSS variables → `ui/*` editor panels generated from field schemas (`schema.js`) →
`export.js`. Pure helpers (markdown, diagram layout, charts, color math, readability math) are
unit tested with `node --test`; an end-to-end Playwright script drives system Chrome.
