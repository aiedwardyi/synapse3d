# Current Sprint - v1.0.0

v1.0.0 released (commit c2a8966).

## HUD and atmosphere pass (merged, commit ec66203)

- [x] Monospace technical-readout typography on the HUD, gesture legend, selection panel, and controls
- [x] CSS-only corner-bracket framing on the glass panels
- [x] Graph links tuned toward the accent color with low-count directional link particles
- [x] Lightweight three.js starfield behind the graph (`src/starfield.js`) with guarded inputs and unit coverage
- [x] 181 tests passing, build clean, CI green

## Note reader and graph navigability (merged, commit 0df0bf4)

- [x] Click-to-open note reader: glass readout panel, markdown rendering (`src/markdown.js`, `src/note-reader.js`), opened via an entry-point function so it can be driven programmatically
- [x] PREV / NEXT through a note's linked neighbors, CLOSE and Escape to dismiss, 1-based linked counter
- [x] Open/close slide and fade animation, respecting reduced-motion preferences
- [x] Hover highlight and floating name label so a node is identifiable before selecting (`src/hover-target.js`)
- [x] Stable layout: the force simulation settles once then stops; dragging moves only the grabbed node and its edges (`src/link-render-sync.js`)
- [x] Directional link particles quiet during interaction and restore when idle (`src/gesture-particles.js`)
- [x] 223 tests passing, build clean, CI green

## Voice control (merged, commit cad3424)

- [x] Open a note by voice: a wake word arms a spoken command that opens the matching note, reusing the reader's programmatic entry point
- [x] Local command matcher (exact, word-boundary substring, all-words) with a natural-language fallback that reads candidate note bodies and recency to resolve ambiguous phrasing
- [x] Conversational clarification: when a request is ambiguous, a short follow-up question is shown and the next spoken phrase is treated as the answer
- [x] Direct command vocabulary: close, next, previous, select, clear, recenter, zoom, and rotate
- [x] Prompt caching on the natural-language calls to reduce cost on repeated sessions
- [x] Visible microphone error states; the voice toggle is available without starting hand tracking first
- [x] 336 tests passing, build clean, CI green

## Voice recognizer reliability (merged, commit d41e773)

- [x] Recycle the recognizer instead of restarting it: full teardown and a fresh instance on end and error, reproducing the page-reload recovery automatically
- [x] Inactivity watchdog recycles a wedged listener after roughly nine seconds of no activity while listening
- [x] Brief reconnecting state surfaced during a recycle; a thrown start now emits reconnecting instead of going silently idle
- [x] Recycle runs silently during a clarification (reconnecting and listening emissions gated while awaiting an answer) so the prompt stays on screen; awaiting-answer mode preserved across rebuilds
- [x] Activity handler cancels a pending recycle so resumed speech is not cut off mid-utterance
- [x] Recycle and watchdog decision logic kept as pure functions with unit coverage; watchdog wiring covered with fake timers
- [x] 350 tests passing, build clean, CI green

## Voice latency polish (merged, commit 7c55086)

- [x] Switched intent matching to a faster, lighter model (Haiku), trimming latency on every spoken command
- [x] Connection warmup fired once when voice is enabled, so the first command of a session skips cold connection setup and a cold cache; skips when no API key is configured and never blocks voice start
- [x] 354 tests passing, build clean, CI green

## Voice talk-back (merged, commit 65bc229)

- [x] Spoken clarification questions: when the app asks which note you meant, the question is now spoken as well as shown
- [x] Spoken command confirmations on every command (open, close, next, previous, select, clear, recenter, zoom, rotate), not only on opening a note
- [x] The recognizer is released before the app speaks and resumes listening only after speech ends, so the microphone and speaker never contend for the same audio device
- [x] A neural voice at slightly lowered pitch for the spoken read
- [x] A new command cancels any pending speech so a fast follow-up is not queued behind the previous utterance
- [x] A fail-safe timer resumes listening even if a speech-end event never arrives, and sequence guards prevent a stale utterance from resuming the microphone for the wrong turn
- [x] 393 tests passing, build clean, CI green

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

## Known issues

- The status readout has no dedicated reconnecting label, so during a recognizer recycle it briefly shows the generic listening-result text. Cosmetic; recovery works.
- The browser speech engine waits for a pause before finalizing a phrase, which adds inherent latency before processing begins. Not addressed; it is standard browser behavior.

## Future work

Pick one when ready:
1. **Media node previews:** image/video previews on nodes. Adds render cost and depends on the vault carrying media plus embed parsing; scope deliberately.
2. **Semantic clustering (v1.5):** group similar notes via embeddings so related notes drift together in space, with attribute-based coloring and topology toggles.
3. **Smoothing tuning panel if needed:** only if real usage shows jitter or lag.
4. **Custom gesture classifier:** a small model over landmark sequences for gestures the tracker does not ship.

