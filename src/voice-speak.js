// Spoken talk-back for the voice layer. Pure phrasing (speechForOutcome) is kept
// separate from the thin SpeechSynthesis side effects so the logic stays testable
// without a browser. Every entry point is a safe no-op when speech is unsupported.

export function isSpeechSupported() {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.speechSynthesis) &&
    Boolean(window.SpeechSynthesisUtterance)
  )
}

// Speak text, invoking onDone exactly once when speech finishes (onend), fails
// (onerror), or is cancelled (which surfaces through those same handlers). When
// speech is unsupported or text is empty, no-op but still call onDone so callers
// that revive the mic in onDone are not left waiting forever.
export function speak(text, { onDone } = {}) {
  let called = false
  const finish = () => {
    if (called) return
    called = true
    try {
      onDone?.()
    } catch {
      // a talk-back consumer must not crash the speech path
    }
  }

  if (!isSpeechSupported() || !text) {
    finish()
    return
  }

  try {
    const utterance = new window.SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.onend = finish
    utterance.onerror = finish
    window.speechSynthesis.speak(utterance)
  } catch {
    // A thrown speak never fires onend, so revive the caller immediately.
    finish()
  }
}

export function cancelSpeech() {
  if (!isSpeechSupported()) return
  try {
    window.speechSynthesis.cancel()
  } catch {
    // cancel on an idle engine is harmless; nothing to do
  }
}

// Pure: the spoken phrase for a finished voice outcome, or null when the state
// should stay silent (every listener state and navigation 'done').
export function speechForOutcome(state, text) {
  if (state === 'opened') return `Opened ${text}`
  if (state === 'unmatched') return 'No match found'
  return null
}
