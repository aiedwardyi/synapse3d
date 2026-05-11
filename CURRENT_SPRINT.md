# Current Sprint - Phase 4: Pinch and Hold to Drag

Goal: while a pinch is held, drag the selected node through 3D space along its current camera-facing depth plane. On release, the node stays at its new position (pinned). Builds on the pinch detector, fingertip cursor, and raycaster from Phase 3.

## Tasks

- [ ] `src/drag.js` - `createDragController()` returning `{ beginDrag, updateDrag, endDrag, isDragging, getTargetNode }`. `beginDrag(hit, camera)` captures the target node and builds a drag plane at the node's current world position, perpendicular to the camera's forward direction. `updateDrag(cursor, camera, raycaster)` intersects the cursor ray with the drag plane and writes the result into the target node's `fx`, `fy`, `fz` (the force-layout fixed-position fields). `endDrag()` clears internal drag state but leaves `fx/fy/fz` set so the node stays pinned. Pure in the sense of taking dependencies as arguments, but stateful internally.
- [ ] Modify `src/main.js` - on pinch transition false -> true with a hit: call `selectNode(hit)` AND `drag.beginDrag(hit, graph.camera())`. On pinch transition true -> false: call `drag.endDrag()`. Every frame while pinching and `drag.isDragging()`: call `drag.updateDrag(cursorPoint, graph.camera(), raycaster)`.
- [ ] `test/drag.test.js` - unit tests using stub camera, raycaster, and node. Verify: no-op when nothing being dragged; `beginDrag` records target and depth; `updateDrag` writes new `fx/fy/fz` from a plane intersection; `endDrag` clears internal target but does not clear `fx/fy/fz` on the node.
- [ ] Verify: pinching a node and moving the hand drags it through 3D space at the node's original depth. Release pinch and the node stays where it was dropped. Other nodes' force-layout positions adjust around the pinned one. Selecting then moving a second node leaves the first pinned where it was.

## Done

- (in progress)

## Blocked

- None.

## Next sprint preview - Phase 5

Map open-palm hand motion to camera orbit. Hand position deltas drive azimuth and elevation. Decoupled from selection and drag so the user can navigate while a node is active.
