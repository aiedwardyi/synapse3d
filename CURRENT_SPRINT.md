# Current Sprint - Phase 3b: Raycasting and Node Selection

Goal: cast a ray from the smoothed fingertip cursor into the 3D scene, detect intersected nodes, highlight the selected node, and display an info card with the node's metadata. Builds on the cover-correct landmark transform, pinch detector, and fingertip cursor shipped in Phase 3a.

## Tasks

- [ ] `src/gesture-raycasting.js` - `raycastFromPoint(screenPoint, camera, scene)` using three.js `Raycaster`. Accepts cursor in viewport [0,1] coords, converts to NDC, returns the closest intersected node mesh or null.
- [ ] `src/selection-panel.js` - functions to create, update, and hide an info card DOM element rooted next to the graph. Pure DOM operations, no graph or scene imports.
- [ ] Modify `src/main.js` - tag node meshes with `userData.isNode` (and node id) via `nodeThreeObject` callback on the force graph. Wire raycasting into the tracking callback: on pinch transition false -> true, raycast at the current cursor position, update selection state, show info card. On pinch transition true -> false, do nothing (selection persists until next pinch).
- [ ] Modify `index.html` - add `<div id="selection-panel">` container, hidden by default.
- [ ] Modify `src/style.css` - styling for `#selection-panel` (positioned, dark background matching theme, readable on top of webcam + graph), and a visual highlight cue for the selected node mesh (color/scale change applied via three.js material, not CSS).
- [ ] `test/gesture-raycasting.test.js` - unit tests for the NDC conversion and intersection logic, using a stub camera and stub scene.
- [ ] `test/selection-panel.test.js` - unit tests for create/update/hide DOM behavior using jsdom-style stubs.
- [ ] Verify: pinching while the cursor sits over a node selects that node; the info card shows the node's title and tags; the highlighted mesh is visually distinct; pinching empty space deselects (or leaves selection unchanged - decide and document).

## Done

- (in progress)

## Blocked

- None.

## Next sprint preview - Phase 4

Extend pinch into pinch-and-hold to grab a node. Drag the node along its current depth plane (not midair 3D).
