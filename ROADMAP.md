# Synapse3D Roadmap

Synapse3D is a browser-based 3D knowledge graph controlled by hand gestures. The architecture is split into incremental phases - each phase ends with a working demo, even if the system isn't yet feature-complete.

## Phase 0 - Skeleton ✅

Vite + three.js + 3d-force-graph rendering hardcoded sample data. Mouse orbit and zoom. Establishes the rendering pipeline.

## Phase 1 - Vault Parser ✅

Read an Obsidian-format vault via the File System Access API. Parse `[[wikilinks]]` into edges and `#tags` into color clusters. Replace hardcoded data with real notes.

## Phase 2 - MediaPipe Hand Tracking ✅

Integrate MediaPipe Tasks `HandLandmarker`. Render a ghost-hand overlay (21 landmarks) to confirm tracking quality before wiring it to interactions.

## Phase 3 - Pinch to Select ✅

Detect pinch gesture (thumb-index distance threshold). Cast a ray from fingertip into the 3D scene, highlight the intersected node, show an info panel. Introduces one-euro filtering for landmark smoothing.

## Phase 4 - Pinch and Hold to Drag ✅

Extend pinch into a sustained grab. Drag the selected node along its current depth plane.

## Phase 5 - Open Palm to Orbit ✅

Map open-palm hand motion to camera orbit. Hand position deltas drive azimuth and elevation. Decoupled from selection so the user can navigate while a node is active.

## Phase 6 - Two-Hand Spread to Zoom ✅

Detect two hands. Distance between palms maps to camera dolly. Spread to zoom in, pinch hands together to zoom out.

## Phase 7 - Polish

Split into 7a and 7b for review-sized PRs.

### Phase 7a - Selection Bloom ✅

Hover/select glow via UnrealBloomPass on the existing 3d-force-graph post-processing composer. Selected nodes bump emissive intensity so they read as glowing relative to the rest of the graph.

### Phase 7b - Gesture HUD + Legend ✅

On-screen indicator of current gesture state (idle, selecting, dragging, orbiting, zooming). First-run legend overlay showing the gesture vocabulary. Includes focus handling, Escape dismissal, and aria-live status markup for keyboard and assistive-tech access.

---

## v1 - Ship

Repo polished for v1.0.0. README rewritten for portfolio audience, MIT license added, package.json metadata filled out, CI hardened (npm caching + concurrency), Vite vendor chunks split, and standard contribution/security docs added. Remaining work for full public launch: create the GitHub release, embed a demo video/GIF in README, and deploy to GitHub Pages or Vercel.

---

## v2 - Stretch

Out of scope for v1 but architecturally compatible:

- **Voice control via Claude API tool use.** Natural-language commands ("show me notes connected to entropy") routed through tool calls that mutate scene state.
- **Custom gesture classifier.** Small MLP trained on landmark sequences for gestures MediaPipe doesn't ship (snap, point, hold-up).
- **Semantic search.** Local embeddings over note content. Nearest-neighbor highlights in graph space.

## Non-goals

- Multiplayer / real-time collaboration.
- Cloud sync - the vault stays on disk.
- Mobile / touch. Webcam + desktop only.
