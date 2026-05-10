# Current Sprint - Phase 3: Pinch to Select

Goal: detect pinch gesture (thumb-index distance), raycast from fingertip into the 3D scene, highlight intersected node, show an info card. Introduce one-euro filter to smooth landmark jitter.

## Prerequisite

The fullscreen webcam uses `object-fit: cover`, which crops the 640x480 source on wider viewports. MediaPipe returns landmarks normalized to the source frame, so without a coordinate transform the drawn landmarks drift away from the visible hand. This must be solved before raycasting, otherwise pinch position and cursor position will not agree.

- [ ] Compute cover-crop transform and apply the inverse to landmarks before drawing and raycasting (or switch to a matched capture aspect ratio)
- [ ] Verify landmarks stay aligned with the visible hand at multiple viewport widths

## Tasks

- [ ] `src/gestures.js` - `detectPinch(landmarks)` and `createOneEuroFilter()` (pure JS, ~30 lines)
- [ ] `src/gesture-raycasting.js` - `raycastFromPoint(screenPoint, camera, scene)` using three.js Raycaster
- [ ] `src/selection-panel.js` - create, update, hide info card DOM elements
- [ ] Modify `src/main.js` - wire pinch detection + raycasting into hand tracking callback, tag node meshes with `userData.isNode`
- [ ] Modify `index.html` - add `<div id="selection-panel">`
- [ ] Modify `src/style.css` - `.selected-node` highlight, `#selection-panel` card styling
- [ ] `test/gestures.test.js` - unit tests for `detectPinch` and `createOneEuroFilter`
- [ ] Tune pinch threshold via testing. Use a hand-scale-normalized ratio (e.g. thumb-index distance divided by wrist-to-middle-MCP distance) rather than a raw absolute value, so the threshold generalizes across hand sizes and camera distances.
- [ ] Verify raycasting hits correct nodes and info card positions correctly

## Done

- (in progress)

## Blocked

- None.

## Next sprint preview - Phase 4

Extend pinch into pinch-and-hold to grab a node. Drag the node along its current depth plane (not midair 3D).
