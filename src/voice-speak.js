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

// Live utterances are held here so the engine cannot garbage-collect one before
// it finishes; a GC'd utterance can drop its onend (a known Chrome bug) and
// strand the paused mic. Each utterance is removed the moment it completes.
const activeUtterances = new Set()

// Speak text, invoking onDone exactly once when speech finishes (onend), fails
// (onerror), or is cancelled (which surfaces through those same handlers). A
// length-aware fail-safe timer completes the call even if no event ever fires.
// When speech is unsupported or text is empty, no-op but still call onDone so
// callers that revive the mic in onDone are not left waiting forever.
export function speak(text, { onDone } = {}) {
  let called = false
  let utterance = null
  let safetyTimerId = null
  const finish = () => {
    if (called) return
    called = true
    if (safetyTimerId !== null) {
      clearTimeout(safetyTimerId)
      safetyTimerId = null
    }
    if (utterance) activeUtterances.delete(utterance)
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
    utterance = new window.SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.onend = finish
    utterance.onstart = () => console.log('[talkback] onstart fired:', JSON.stringify(text))
    utterance.onerror = (e) => { console.log('[talkback] onerror:', e && e.error); finish() }
    activeUtterances.add(utterance)
    // Generous and length-aware so it never fires during real speech (a premature
    // fire would resume the mic mid-utterance and reintroduce self-hearing), but
    // still rescues the mic if the engine drops both lifecycle events.
    const safetyMs = Math.max(5000, text.length * 200 + 3000)
    safetyTimerId = setTimeout(finish, safetyMs)
    safetyTimerId?.unref?.()
    window.speechSynthesis.speak(utterance)
    console.log('[talkback] after speak →', {
      speaking: window.speechSynthesis.speaking,
      pending: window.speechSynthesis.pending,
      paused: window.speechSynthesis.paused
    })
  } catch (err) {
    console.log('[talkback] speak threw:', err && err.message)
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
  if (state === 'opened') return text ? `Opened ${text}` : 'Opened'
  if (state === 'unmatched') return 'No match found'
  return null
}

// Spoken and on-screen clarify prompts share this so they cannot drift.
export const VOICE_ASK_FALLBACK = 'Which one?'

// Pure: the spoken clarification. Voice-only users pick by saying a label, so the
// phrase names the choices after the question (or the shared fallback when empty).
// Empty labels are dropped; the rest read naturally: one as-is, two joined with
// 'or', three or more as 'A, B, or C'.
export function clarificationSpeech(question, optionLabels) {
  const prompt = question || VOICE_ASK_FALLBACK
  const labels = (optionLabels || []).filter(label => label)
  if (labels.length === 0) return prompt
  return `${prompt} ${joinLabels(labels)}`
}

function joinLabels(labels) {
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')}, or ${labels[labels.length - 1]}`
}
