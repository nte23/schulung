# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A browser-based presentation for a **KI (AI) Workshop** ("Grundlagen der generativen KI") in German. No build tools, no framework — pure HTML/CSS/JS served as static files.

## Architecture

The presentation uses a step-based engine (not a traditional slide deck). Pages are full-viewport containers; each page can host multiple sequential animation steps.

- **index.html** — Pages defined as `<div class="page" id="pg-NAME">` elements. Elements with `data-anim` are auto-managed by the engine for entrance animations. Scripts loaded at bottom: `nn.js` → `engine.js` → `steps.js`.
- **engine.js** — `Engine` class: manages step sequencing, page transitions, keyboard/click navigation, progress bar, and forward/backward traversal. Steps are declarative objects with `page`, `enter`, `exit` selectors or custom `timeline(tl, engine)` + `replay()` functions. `goTo()` restores every page from pristine boot-time innerHTML snapshots, kills all tweens and FX-registered timers, runs `onReset` hooks, then replays steps instantly via `replayInstant()`.
- **steps.js** — Defines the `STEPS` array and all step-builder functions. Contains the teleprompter effect (`buildZielStep`), typewriter (`buildTypewriter`), tokenization morph (`buildTokenize`), and neural net transitions (`buildTokensToNN`, `buildNNActivation`). Boots the `Engine` on DOMContentLoaded.
- **nn.js** — `NeuralNetViz` class: builds a DOM+SVG neural network visualization with layered nodes, edge connections, animated bolt activation, and a 3D explosion effect with depth layers.
- **styles.css** — CSS variables in `:root` define the design system. Light theme with amber accent (`--accent: #fabb43`). Font: Inter via Google Fonts.

### Step System

Each step in the `STEPS` array is either:
1. **Declarative**: `{ page, enter: [...selectors], exit: [...selectors], stagger }` — the engine builds the GSAP timeline automatically
2. **Custom**: `{ timeline: (tl, engine) => { ... }, replay: () => { ... } }` — full control over the GSAP timeline; `replay()` must set the same end-state instantly (used by `goTo()` for backward navigation)

Every custom step **must** implement `replay()` to support backward navigation.

### DOM State Management

- `data-anim` elements receive entrance animations managed by the engine; their classes and styles are restored automatically when `goTo()` restores the page from its boot-time snapshot.
- `#morphWords` container uses mutually exclusive layout classes: `sentence` (default), `typing-mode` (gap:0, typewriter), `split` (tokenized), `nn-input` (left-aligned for NN transition). Steps must swap these correctly.
- `nnViz` and `nnAmbientViz` are mutable globals in steps.js. Their destruction on navigation is handled by an `engine.onReset()` hook registered in the steps.js boot block — `goTo()` itself no longer references them directly. `ensureNN()` lazily creates the viz.

## Key Conventions

- Language: all slide content and speaker notes are in **German**
- All animations use GSAP (loaded from CDN). Shared constants (`FADE_IN_DURATION`, `FADE_OUT_DURATION`, etc.) are defined at the top of `engine.js`.
- New pages: add `<div class="page" id="pg-NAME">` in index.html, then add step objects to the `STEPS` array in `steps.js`
- Navigation: arrow keys, Space, Enter, or click. Dev nav buttons at bottom-right. URL hash (e.g., `#8`) jumps to a specific step.
- **State reset**: `goTo()` restores every page from pristine boot-time innerHTML
  snapshots — never add manual reset code to the engine. Step-specific cleanup
  (stopping loops, nulling viz instances) registers via `engine.onReset(fn)` in
  the steps.js boot block.
- **Timers**: never call raw `setInterval`/`setTimeout`/`requestAnimationFrame`
  in steps.js — use `FX.setInterval`/`FX.setTimeout`/`FX.raf` (engine.js) so
  navigation kills them. Inside `NeuralNetViz`, use `this._setTimeout`.
- **Every custom step still needs `replay()`** — and `npm run test:backnav`
  verifies forward state === jump state for every step. Run it after adding
  or changing any step. `--from N --to M` scopes the run; `--spam` tests
  rapid clicking.
- **Input**: clicking during an animation fast-forwards it (progress(1));
  design timelines so their end state is valid at any moment.
- `.superpowers/brainstorm/visual-session/` contains design prototypes — reference/scratch files, not production code

## Running

Open `index.html` directly in a browser — no server or build step required. For local dev with live reload, any static file server works (e.g., `python3 -m http.server`).
