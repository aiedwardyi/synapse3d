# Contributing

Thanks for taking the time to improve Synapse3D. This is a personal portfolio project, so the bar is intentionally focused: small changes, clear behavior, privacy-preserving defaults, and tests where logic can be exercised outside the browser.

## Local Setup

```bash
npm ci
npm run dev
```

Before opening a PR:

```bash
npm test
npm run build
```

## Project Shape

- Keep the app local-first. Do not add a backend, analytics, vault upload path, or remote note processing without first discussing the privacy tradeoff.
- Prefer one small module per behavior. Most files in `src/` have a matching test file in `test/`.
- Keep gesture math, camera control, and DOM orchestration separated so they can be tested independently.
- Keep dependencies minimal. Add a package only when it replaces substantial complexity or is a well-established domain tool.

## Pull Requests

Good PRs usually include:

- A narrow description of the user-facing behavior or maintenance goal
- Tests for pure logic, controller behavior, parsing, storage fallback, or DOM state changes
- Manual verification notes for webcam, MediaPipe, or visual rendering changes
- README, sprint, or roadmap updates when the public project story changes

Avoid mixing refactors with feature work unless the refactor is necessary for the change being made.

## Review Checklist

Reviewers should look for:

- Gesture conflicts or priority regressions
- Browser permission or local-file privacy regressions
- Untested parser, controller, or coordinate-mapping logic
- Accessibility regressions in the HUD, modal, and selected-node panel
- Bundle or dependency changes that make the app heavier without clear value

Security issues should follow [SECURITY.md](SECURITY.md) instead of being posted with public exploit details.
