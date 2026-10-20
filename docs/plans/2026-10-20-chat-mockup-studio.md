# Chat Mockup Studio Implementation Plan


**Goal:** Build the editor described in the spec.
**Architecture:** see spec. **Tech Stack:** vanilla ES modules, KaTeX, html-to-image, node:test, playwright-core (system Chrome).
**Spec:** docs/specs/2026-10-20-chat-mockup-studio-design.md

## Global Constraints
- No build step; all code under `src/`, served statically. Port 5173.
- Pure helpers must not touch the DOM so they run under `node --test`.

## Review Focus
- Malicious/odd text in markdown (HTML, unterminated `**`, `$` prices) must not break rendering or inject HTML.
- Diagram DSL with cycles / unknown nodes / empty input must not hang.
- Charts with empty or non-numeric CSV must render a placeholder, not throw.
- Reload must restore the project; invalid imported JSON must be rejected with a message.
- Exported PNG must be non-blank and match stage size × scale.

### Task 1: Pure helpers (TDD) — `src/markdown.js`, `src/diagramLayout.js`, `src/chartMath.js`, `src/color.js`, `src/readability.js`
Tests in `tests/unit/*.test.js`: markdown escapes HTML, renders bold/italic/code/lists/citations/math placeholders;
diagram layout terminates on cycles; chart parse handles bad CSV; contrast ratio black/white = 21; effective pt calc.
### Task 2: State store + defaults + presets — `src/state.js`, `src/defaults.js`, `src/presets.js`
### Task 3: Renderer — `src/render/*.js`, `css/chat.css`
### Task 4: Editor UI — schema-driven inspector, message editor, topbar, JSON editor, annotations, readability panel
### Task 5: Export — PNG/SVG/HTML/JSON/print
### Task 6: E2E test with Chrome (render, edit, export, reload), fix defects, README
