# Current Sprint - Phase 7a: Selection Bloom

Goal: selected nodes glow via UnrealBloomPass. Bloom is wired into the 3d-force-graph post-processing composer so it composes with the existing rendering pipeline. The graph background stays transparent (webcam shows through). Non-selected nodes look unchanged; selected node reads as luminous.

## Tasks

- [ ] Add UnrealBloomPass to the graph's post-processing composer via `graph.postProcessingComposer().addPass(...)`. Reasonable defaults: strength 0.8, radius 0.4, threshold 0.85. Worker tunes empirically.
- [ ] Modify `src/node-mesh.js` - keep mesh creation pattern but ensure material supports emissive output. `MeshLambertMaterial` already exposes `emissive` + `emissiveIntensity` properties; no material swap needed. Document the choice.
- [ ] Modify `src/main.js` - `applyHighlight` sets the selected mesh's `emissive` to the highlight color and `emissiveIntensity` to a tuned value (e.g. 1.5). `revertHighlight` restores both. Preserve the existing white-color + 1.5x scale highlight (bloom adds to it, does not replace it).
- [ ] Verify transparent background still works. `graph.backgroundColor('rgba(0,0,0,0)')` must compose correctly with the bloom pass output. If bloom forces an opaque background, fall back to a clear-pass setup or set bloom's `clearColor` / alpha appropriately. Document the fix.
- [ ] `test/node-mesh.test.js` - if it does not exist, do not create. If it exists, extend to cover the emissive property assignment.
- [ ] No new dedicated bloom test file (this is a render-pipeline change, not a logic change). Manual visual verification only.
- [ ] Verify: selected node glows clearly against the dark scene. Bloom does not bleed into the webcam layer. Non-selected nodes look the same as before. Pinch-drag still selects and grabs.

## Done

- (in progress)

## Blocked

- None.

## Next sprint preview - Phase 7b

Gesture HUD showing current gesture state (idle, selecting, dragging, orbiting, zooming) in a corner overlay. First-run legend overlay listing the four gestures with hand-icon glyphs. Smoothing parameter tuning pass against the bloom-enabled visual layer.
