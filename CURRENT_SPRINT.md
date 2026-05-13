# Current Sprint - Phase 6: Two-Hand Spread to Zoom

Goal: detect two hands, both with open palms. Distance between palms maps to camera dolly along the current view direction. Spreading hands zooms in, bringing them together zooms out. Single-hand gestures (pinch, drag, single-hand orbit) continue to work when only one hand is visible.

## Tasks

- [ ] `src/camera-zoom.js` - `createZoomController()` returning `{ beginZoom, updateZoom, endZoom, isZooming }`. `beginZoom(spread, camera, lookAtTarget)` captures the starting palm spread and the camera's current radius from the target. `updateZoom(spread, camera)` scales the radius by the ratio of current to anchor spread, repositions the camera along its current offset direction, keeps lookAt fixed. `endZoom()` clears state.
- [ ] Modify `src/main.js` - detect two hands present. Compute palm spread as the distance between palm centers in normalized viewport coords. Resolve hand identity stably across frames (MediaPipe `result.handedness` left/right ordering, not raw array index) so left/right hand assignment does not flip frame-to-frame.
- [ ] Define the activation rule: zoom requires two hands AND both palms open. While zoom is active, suppress single-hand orbit. Pinch on either hand still ends zoom and returns control to selection/drag.
- [ ] `test/camera-zoom.test.js` - state machine and radius math with a real `THREE.PerspectiveCamera`. Beginning zoom captures starting radius; updating with a larger spread shrinks radius (zoom in); updating with a smaller spread grows radius (zoom out); ending clears state. Mirror the structure of `test/camera-orbit.test.js`.
- [ ] Verify: with vault loaded, both hands open in frame, spread hands -> camera dollies in, bring hands closer -> dollies out. Single-hand orbit and pinch still work when only one hand is visible. Hand identity stays stable when hands cross or briefly leave frame.

## Done

- (in progress)

## Blocked

- None.

## Next sprint preview - Phase 7

Polish. Hover glow via UnrealBloomPass. On-screen gesture HUD showing current state. Legend overlay for first-time users. Smoothing parameter tuning pass.