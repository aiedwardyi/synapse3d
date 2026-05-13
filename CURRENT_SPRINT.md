# Current Sprint - Phase 5: Open Palm to Orbit

Goal: detect an open-palm gesture; while the palm is open, hand motion drives camera orbit around the graph's center. Azimuth (yaw) responds to horizontal hand motion, elevation (pitch) to vertical. Decoupled from selection and drag so the user can navigate while a node is highlighted or pinned.

## Tasks

- [ ] `src/gestures.js` - add `palmOpenness(landmarks)` returning a 0-1 ratio of how open the hand is (e.g. average fingertip-to-palm-center distance divided by hand scale), and `createPalmOpenDetector({ enterRatio, exitRatio })` returning a stateful function with hysteresis. Open palm = all four fingers extended.
- [ ] `src/camera-orbit.js` - `createOrbitController()` returning `{ beginOrbit, updateOrbit, endOrbit, isOrbiting }`. `beginOrbit(palmAnchor, camera)` captures the starting palm position and camera spherical coords. `updateOrbit(palmPosition, camera)` computes the delta from the anchor and applies it as azimuth + elevation deltas to the camera, keeping the lookAt target fixed. `endOrbit()` clears state.
- [ ] Modify `src/main.js` - run palm-open detection on the first hand each frame. On open transition false -> true (and no pinch active): begin orbit. While open: update orbit each frame. On close: end orbit.
- [ ] Resolve gesture conflict: pinch and open palm are mutually exclusive. Pinch wins if both are detected (drag takes priority over orbit). Document the priority rule.
- [ ] `test/gestures.test.js` - extend with palm-openness tests: closed fist returns low ratio, open hand returns high ratio, scale-invariant.
- [ ] `test/camera-orbit.test.js` - state machine and delta math with a real `THREE.PerspectiveCamera`. Beginning orbit captures starting spherical coords; updating with a delta applies expected azimuth/elevation; ending clears state.
- [ ] Verify: with vault loaded, open palm, hand moves left -> camera orbits right around the center (or whichever direction feels natural; document choice). Selected node remains selected during orbit. Pinned node positions remain pinned. Drag plane in Phase 4 was built from camera direction; verify that orbiting then re-pinching builds a fresh plane (the existing beginDrag already does this on each pinch, so this should just work).

## Done

- (in progress)

## Blocked

- None.

## Next sprint preview - Phase 6

Two-hand spread to zoom. Distance between palms maps to camera dolly. Spread to zoom in, pinch hands together to zoom out.