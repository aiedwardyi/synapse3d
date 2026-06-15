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

// Talk-back voice character: a deep male "Jarvis". Lower pitch = deeper. Tweak to taste.
const JARVIS_PITCH = 0.9
const JARVIS_RATE = 1.0

// SpeechSynthesis exposes no gender flag, so match known male voice names: British
// neural first (Jarvis is British), then US neural, then classic Windows males.
// Returns null (use default voice) when none match or voices have not loaded yet.
const MALE_VOICE_PATTERNS = [
  /Microsoft (Ryan|Thomas|Arthur).*(Online|Natural|Neural)/i,
  /Microsoft (Guy|Christopher|Eric|Brian|Davis|Andrew|Roger|Steffan).*(Online|Natural|Neural)/i,
  /Google UK English Male/i,
  /\bmale\b/i,
  /Google US English/i,
  /Microsoft (George|James|Mark|David)/i
]

let loggedVoices = false
function pickJarvisVoice() {
  let voices = []
  try { voices = window.speechSynthesis.getVoices() } catch { return null }
  if (!Array.isArray(voices) || voices.length === 0) return null
  const english = voices.filter(v => /^en/i.test(v.lang))
  const pool = english.length ? english : voices
  let chosen = null
  for (const pattern of MALE_VOICE_PATTERNS) {
    chosen = pool.find(v => pattern.test(v.name))
    if (chosen) break
  }
  if (!loggedVoices) {
    loggedVoices = true
    // Temporary: surfaces the picked voice + your installed options so the pick can be tuned.
    console.log('[jarvis] picked:', chosen?.name || '(browser default)', '| available en:', pool.map(v => v.name))
  }
  return chosen
}

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
    utterance.rate = JARVIS_RATE
    utterance.pitch = JARVIS_PITCH
    const voice = pickJarvisVoice()
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    }
    utterance.onend = finish
    utterance.onerror = finish
    activeUtterances.add(utterance)
    // Generous and length-aware so it never fires during real speech (a premature
    // fire would resume the mic mid-utterance and reintroduce self-hearing), but
    // still rescues the mic if the engine drops both lifecycle events.
    const safetyMs = Math.max(5000, text.length * 200 + 3000)
    safetyTimerId = setTimeout(finish, safetyMs)
    safetyTimerId?.unref?.()
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
// should stay silent (every listener state, and an unrecognized navigation done).
export function speechForOutcome(state, text) {
  if (state === 'opened') return text ? `Opened ${text}` : 'Opened'
  if (state === 'unmatched') return 'No match found'
  if (state === 'done') return navigationSpeech(text)
  return null
}

// Pure: a short spoken confirmation for a completed navigation or camera command.
// Maps the status label set at the dispatch site (main.js) to a natural phrase, and
// returns null for an unrecognized label so we stay silent rather than read it raw.
function navigationSpeech(text) {
  const raw = (text || '').trim()
  const key = raw.toLowerCase()
  const fixed = {
    close: 'Closed',
    next: 'Next',
    previous: 'Previous',
    clear: 'Cleared',
    recenter: 'Recentered',
    'zoom in': 'Zooming in',
    'zoom out': 'Zooming out'
  }
  if (Object.hasOwn(fixed, key)) return fixed[key]
  // rotate/select carry an argument; keep the original case (note labels matter).
  if (key.startsWith('rotate ')) return `Rotating ${raw.slice('rotate '.length)}`
  if (key.startsWith('select ')) return `Selected ${raw.slice('select '.length)}`
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
