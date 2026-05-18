# Current Sprint - v1.0.0

v1.0.0 released (commit c2a8966).

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
1. **v1.5:** semantic clustering via embeddings, attribute-based coloring, topology toggles.
2. **Phase 7c if needed:** tuning panel for smoothing parameters - only if real deployed usage shows jitter/lag.
3. **v2 stretch:** voice + Claude API tool use, or custom gesture classifier (MLP on landmark sequences).
