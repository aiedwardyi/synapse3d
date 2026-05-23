# Current Sprint - v1.0.0

v1.0.0 released (commit c2a8966).

## HUD and atmosphere pass (merged, commit ec66203)

- [x] Monospace technical-readout typography on the HUD, gesture legend, selection panel, and controls
- [x] CSS-only corner-bracket framing on the glass panels
- [x] Graph links tuned toward the accent color with low-count directional link particles
- [x] Lightweight three.js starfield behind the graph (`src/starfield.js`) with guarded inputs and unit coverage
- [x] 181 tests passing, build clean, CI green

## Note reader and graph navigability (merged, commit 0df0bf4)

- [x] Click-to-open note reader: glass readout panel, markdown rendering (`src/markdown.js`, `src/note-reader.js`), opened via an entry-point function so it can be driven programmatically
- [x] PREV / NEXT through a note's linked neighbors, CLOSE and Escape to dismiss, 1-based linked counter
- [x] Open/close slide and fade animation, respecting reduced-motion preferences
- [x] Hover highlight and floating name label so a node is identifiable before selecting (`src/hover-target.js`)
- [x] Stable layout: the force simulation settles once then stops; dragging moves only the grabbed node and its edges (`src/link-render-sync.js`)
- [x] Directional link particles quiet during interaction and restore when idle (`src/gesture-particles.js`)
- [x] 223 tests passing, build clean, CI green

## Done

- [x] README.md with "What it demonstrates" framing, three in-app screenshots, three badges (CI, License, Version)
- [x] MIT LICENSE
- [x] CONTRIBUTING.md + SECURITY.md
- [x] README project tree, privacy/security section, and contribution section
- [x] package.json metadata (description, keywords, repository, bugs, homepage, author, license, engines)
- [x] CI workflow: concurrency cancel-in-progress, npm cache, npm ci, build runs alongside tests
- [x] Vite vendor chunk split: three + 3d-force-graph + mediapipe in separate chunks, no chunk-size warning
- [x] 172 unit tests passing on main
- [x] `npm run build` clean
- [x] `npm run dev` clean
- [x] GitHub Release v1.0.0 published with release notes (commit c2a8966)

## Optional follow-ups

- [ ] Pin synapse3d to GitHub profile
- [ ] Record 30-60 second demo video showing all four gestures
- [ ] Deploy to GitHub Pages or Vercel
- [ ] Add live demo URL to README

## Blocked

- None.

## Future work

Pick one when ready:
1. **Media node previews:** image/video previews on nodes. Adds render cost and depends on the vault carrying media plus embed parsing; scope deliberately.
2. **Open by gesture or voice:** a dedicated gesture or a voice command to open the reader, reusing its existing programmatic entry point.
3. **v1.5:** semantic clustering via embeddings, attribute-based coloring, topology toggles.
4. **Smoothing tuning panel if needed:** only if real usage shows jitter or lag.
5. **v2 stretch:** voice control, or a custom gesture classifier.
