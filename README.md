# Synapse3D

Hand-controlled 3D knowledge graph. Browse an Obsidian vault as a living constellation - pinch to grab nodes, open your palm to orbit, spread two hands to zoom. All in the browser, no install, no server.

[![CI](https://github.com/aiedwardyi/synapse3d/actions/workflows/ci.yml/badge.svg)](https://github.com/aiedwardyi/synapse3d/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](https://github.com/aiedwardyi/synapse3d/releases)

> Demo video and screenshots coming soon.

## Overview

Synapse3D parses an Obsidian-format note vault and renders it as a 3D force-directed graph in the browser. Webcam-based hand tracking replaces mouse and keyboard with a gestural interface: every interaction - select, drag, orbit, zoom - is driven by hand pose. The pipeline is fully client-side. Notes never leave the machine.

## Gesture vocabulary

| Gesture | Action |
| --- | --- |
| Pinch (thumb + index) | Select a node |
| Pinch and hold, then move | Drag the node along its depth plane |
| Open palm (one hand) | Orbit the camera around the current target |
| Two open palms, change spread | Zoom (spread to zoom in, close to zoom out) |

Selected nodes glow via UnrealBloomPass post-processing. A live HUD in the top-right corner shows the current gesture state. A first-run modal teaches the vocabulary; localStorage suppresses it on subsequent visits.

## Tech stack

- **Vanilla JS** - no framework, no TypeScript, no build-time magic beyond Vite
- **three.js 0.184** + **3d-force-graph 1.80** - rendering and force-directed layout
- **@mediapipe/tasks-vision** - 21-point hand landmark detection in WebAssembly
- **One-euro filter** - landmark smoothing, custom implementation
- **File System Access API** - direct vault access; directory handle cached via `idb-keyval`
- **Vite 8** - dev server, bundler
- **node:test** + **GitHub Actions** - tests and CI

## Quick start

Requirements: Node 20+, a Chromium-based browser.

```bash
git clone https://github.com/aiedwardyi/synapse3d.git
cd synapse3d
npm install
npm run dev
```

Open `http://localhost:5173`, click _Pick a vault_, grant webcam permission, then click _Enable hand tracking_.

## How it works

The per-frame pipeline:

1. **MediaPipe HandLandmarker** detects up to two hands and emits 21 landmarks per hand at video frame rate
2. **Handedness bucketing** (`src/handedness.js`) assigns each detected hand to a stable `{ left, right }` slot using MediaPipe's classifier output. Raw array index can swap between frames; classifier labels do not
3. **Cover-transform** (`src/landmark-transform.js`) maps source-pixel landmarks into mirrored viewport coordinates, accounting for `object-fit: cover` crop
4. **Gesture detectors** (`src/gestures.js`) compute hand-scale-normalized ratios for pinch and palm-openness, with hysteresis on each transition to prevent flicker
5. **One-euro filtering** smooths cursor and palm-anchor positions; a separate filter on the scalar hand spread handles zoom
6. **Gesture priority resolver** (`src/main.js`) picks the active gesture each frame: `drag > zoom > orbit > select > idle`
7. **Controllers** (`src/drag.js`, `src/camera-orbit.js`, `src/camera-zoom.js`) apply state to the three.js camera and node meshes using `THREE.Spherical` for orbit and a captured view-direction unit vector for zoom dolly
8. **Render** through 3d-force-graph's `EffectComposer` with an attached `UnrealBloomPass`; selected nodes bump `emissive` and `emissiveIntensity` to cross the bloom threshold

## Project structure

```text
src/
  main.js                       entry point, gesture pipeline
  vault.js                      File System Access vault picker + parser
  vault-controller.js           vault-picker button orchestration
  hand-tracking.js              MediaPipe HandLandmarker wrapper
  hand-tracking-ui.js           tracking-button state helpers
  hand-overlay.js               landmark and fingertip cursor rendering
  handedness.js                 stable hand identity bucketing
  landmark-transform.js         cover transform + mirror
  gestures.js                   pinch + palm detectors, one-euro filter
  gesture-raycasting.js         screen-point to scene raycast
  drag.js                       pinch-drag controller
  camera-orbit.js               open-palm orbit controller
  camera-zoom.js                two-hand zoom controller
  node-mesh.js                  node mesh creation + highlight properties
  node-selection-hit.js         click-handler to selection-hit adapter
  pinch-selection-attempt.js    one-shot pinch -> raycast state machine
  material-tracker.js           GPU material disposal tracking
  selection-panel.js            selected-node info panel
  gesture-hud.js                live gesture state indicator
  gesture-legend.js             first-run modal overlay
  gesture-legend-storage.js     localStorage wrapper with defensive try/catch
  style.css                     dark theme, layout
test/
  (one test file per source module)
```

## Testing

```bash
npm test
```

172 unit tests cover gesture math, controllers, vault parsing, landmark transforms, raycasting, and DOM modules. Tests are pure - no browser, no MediaPipe at test time. The suite runs in under half a second on `node:test`.

## Browser support

Chromium-based browsers on desktop (Chrome, Edge, Brave, Arc). Requirements:

- File System Access API (Chromium only)
- Webcam access (HTTPS or localhost)
- ES2022+ JavaScript

Not supported: Firefox, Safari, mobile browsers. These omissions are deliberate - File System Access API is the cleanest way to read a local Obsidian vault without an upload step, and it is currently Chromium-only.

## Release notes

### v1.0.0

- Full gesture vocabulary: pinch select, pinch drag, single-hand orbit, two-hand zoom
- Obsidian vault parsing with `[[wikilink]]` edge extraction and `#tag` color clustering
- UnrealBloomPass selection highlight
- Live gesture HUD and first-run legend with accessibility-conscious markup
- 172 unit tests, CI on main

## License

MIT. See [LICENSE](LICENSE).
