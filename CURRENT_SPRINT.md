# Current Sprint - Phase 3: Pinch to Select

Goal: detect pinch gesture (thumb-index distance), raycast from fingertip into the 3D scene, highlight intersected node, show an info card. Introduce one-euro filter to smooth landmark jitter.

## Tasks
- [ ] `src/gestures.js` - `detectPinch(landmarks)` and `createOneEuroFilter()` (pure JS, ~30 lines)
- [ ] `src/gesture-raycasting.js` - `raycastFromPoint(screenPoint, camera, scene)` using three.js Raycaster
- [ ] `src/selection-panel.js` - create, update, hide info card DOM elements
- [ ] Modify `src/main.js` - wire pinch detection + raycasting into hand tracking callback, tag node meshes with `userData.isNode`
- [ ] Modify `index.html` - add `<div id="selection-panel">`
- [ ] Modify `src/style.css` - `.selected-node` highlight, `#selection-panel` card styling
- [ ] `test/gestures.test.js` - unit tests for `detectPinch` and `createOneEuroFilter`
- [ ] Tune pinch threshold via testing (target: ~0.04 distance in [0,1] space)
- [ ] Verify raycasting hits correct nodes and info card positions correctly

## Done
- (in progress)

## Blocked
- None.

## Next sprint preview - Phase 4
Extend pinch into pinch-and-hold to grab a node. Drag the node along its current depth plane (not midair 3D).
