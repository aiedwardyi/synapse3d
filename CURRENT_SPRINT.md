# Current Sprint - v1.0.0 Launch

v1.0.0 polish merged (PR #12, commit 03fdf70). Repo is ship-ready. What remains for public launch is asset-level: demo video and live deployment.

## Done

- [x] README.md rewritten for portfolio audience
- [x] MIT LICENSE added
- [x] README project tree, privacy/security section, and contribution section added
- [x] SECURITY.md and CONTRIBUTING.md added for standard open-source expectations
- [x] package.json metadata (description, keywords, repository, bugs, homepage, author, license, engines)
- [x] CI workflow hardened: concurrency cancel-in-progress, npm cache, npm ci, build runs in CI
- [x] Vite vendor chunk split: three + 3d-force-graph + mediapipe in separate chunks, no more chunk size warning
- [x] 172 unit tests passing on main
- [x] `npm run build` clean, no warnings
- [x] `npm run dev` clean

## Remaining for public launch

- [ ] Create GitHub Release tagged `v1.0.0` against latest `main`. Title: `v1.0.0`. Description: pull from README's `## Release notes` section.
- [ ] Pin synapse3d to the GitHub profile page (one-click action in profile customization).
- [ ] Record 30-60 second demo video showing all four gestures end-to-end. Save as `.mp4` or compressed `.gif`. Embed in README, replacing the "Demo video and screenshots coming soon" line.
- [ ] Pick a deploy host. GitHub Pages (free, integrated) or Vercel (cleaner domain, free for personal). Add deploy workflow at `.github/workflows/deploy.yml`. Verify `vite.config.js` has the correct `base` path for the chosen host.
- [ ] Verify deployed app works end-to-end: vault picker, webcam permission, MediaPipe model load, all four gestures.
- [ ] Add live demo URL to README (replace the bullet under Quick start, or add a one-line banner near the top).

## Blocked

- None. Demo video and deploy are Edward's calls on timing.

## After full launch

Pick one:
1. **v1.5:** semantic clustering via embeddings, attribute-based coloring, topology toggles. ML work, aligns with Andrew Ng track.
2. **Phase 7c if needed:** tuning panel for smoothing parameters - only if real deployed usage shows jitter/lag.
3. **v2 stretch:** voice + Claude API tool use, or custom gesture classifier (MLP on landmark sequences).
