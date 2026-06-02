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

## v1

v1.0.0 released (commit c2a8966). README with portfolio-grade structure, "What it demonstrates" framing, three in-app screenshots, three badges (CI, License, Version). MIT LICENSE, CONTRIBUTING.md, SECURITY.md in place. CI hardened with concurrency + npm caching. Vite vendor chunks split. GitHub Release published with release notes.

Optional follow-ups: demo video/GIF embed in README, deploy to GitHub Pages or Vercel.

A HUD and atmosphere presentation pass was added on top of v1.0.0 (commit ec66203): monospace technical-readout typography, CSS corner-bracket framing on the glass panels, accent-tuned links with low-count directional particles, and a lightweight starfield behind the graph. Presentation only; node geometry and gesture logic are unchanged.

A note reader and graph navigability pass followed (commit 0df0bf4). Selecting a node can now open a readout panel that renders the note's content and pages through its linked notes. Nodes show a hover highlight and name label before selection, the force layout settles once and then holds still so dragging moves only the grabbed node, and directional link particles quiet during interaction. The reader opens through a programmatic entry point so it can later be driven by a gesture or voice command.

A voice control layer followed (commit cad3424). A wake word arms a spoken command; saying the name of a note opens it through that same programmatic entry point. A fast local matcher handles direct phrasing, and a natural-language fallback reads candidate note bodies and recency to resolve ambiguous requests, asking a short clarifying question when needed. A spoken command vocabulary covers opening, closing, paging, selecting, clearing, recentering, zooming, and rotating. Repeated natural-language calls are cached to reduce cost. Transcription uses the browser speech API; the natural-language fallback uses a hosted model and runs when a key is configured, degrading to local matching otherwise. One known issue remains: continuous recognition can intermittently stop capturing until the page is reloaded, and a recognizer-recycle fix is planned.

---

## v2 - Stretch

Out of scope for v1 but architecturally compatible:

- **Spoken confirmation (text-to-speech).** Speak clarification questions and command outcomes aloud, building on the voice control layer.
- **Custom gesture classifier.** Small MLP trained on landmark sequences for gestures MediaPipe doesn't ship (snap, point, hold-up).
- **Semantic search.** Local embeddings over note content. Nearest-neighbor highlights in graph space.

## Non-goals

- Multiplayer / real-time collaboration.
- Cloud sync - the vault stays on disk.
- Mobile / touch. Webcam + desktop only.
