import { extractDirectCommand, extractWakeCommand } from './voice-command.js'

const RESTART_DEBOUNCE_MS = 350
const RESTART_BACKOFF_MS = 1200
const TIGHT_ERROR_WINDOW_MS = 1000
const MAX_CONSECUTIVE_ERRORS = 3
const PERMANENT_ERROR_NAMES = new Set(['not-allowed', 'service-not-allowed'])
const QUIET_ERROR_NAMES = new Set(['no-speech', 'aborted'])

export function createVoiceListener({
  onCommand,
  onError,
  onStateChange,
  wakeWords
} = {}) {
  const RecognitionImpl = resolveRecognitionConstructor()
  const supported = Boolean(RecognitionImpl)

  let recognition = null
  let active = false
  let restartPending = false
  let lastErrorAt = 0
  let consecutiveErrors = 0

  function isSupported() {
    return supported
  }

  function isListening() {
    return active
  }

  function start() {
    if (!supported || active) return
    active = true
    restartPending = false
    consecutiveErrors = 0
    spinUpRecognition()
    emitState({ state: 'listening' })
  }

  function stop() {
    if (!active) return
    active = false
    restartPending = false
    safelyStopRecognition()
    emitState({ state: 'idle' })
  }

  function spinUpRecognition() {
    recognition = new RecognitionImpl()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognition.onresult = handleResult
    recognition.onerror = handleError
    recognition.onend = handleEnd

    try {
      recognition.start()
    } catch (err) {
      // Chrome throws InvalidStateError if the prior recognition is still tearing down.
      // Retry on a backoff rather than killing the listener.
      safelyStopRecognition()
      recognition = null
      reportError(err?.message || 'start-failed', err)
      if (active && !restartPending) {
        restartPending = true
        setTimeout(() => {
          restartPending = false
          if (!active) return
          spinUpRecognition()
        }, RESTART_BACKOFF_MS)
      }
    }
  }

  function safelyStopRecognition() {
    if (!recognition) return
    try {
      recognition.stop()
    } catch {
      // Recognition was never fully started or is mid-teardown; nothing to do.
    }
  }

  function handleResult(event) {
    if (!active) return
    const results = event?.results
    if (!results) return

    const startIndex = Number.isFinite(event.resultIndex) ? event.resultIndex : 0
    for (let i = startIndex; i < results.length; i++) {
      const result = results[i]
      if (!result?.isFinal) continue

      const transcript = result[0]?.transcript
      if (typeof transcript !== 'string') continue

      processTranscript(transcript)
    }
  }

  function processTranscript(transcript) {
    const trimmed = typeof transcript === 'string' ? transcript.trim() : ''
    let command = extractWakeCommand(trimmed, wakeWords ? { wakeWords } : undefined)

    if (command === null) {
      // Chrome STT often drops short leading words like "claude". Accept a
      // bare command if it starts with a recognised action verb; the matcher
      // still requires a real label so casual conversation can't trigger it.
      command = extractDirectCommand(trimmed)
      if (command === null) {
        emitState({ state: 'heard', text: trimmed })
        return
      }
    }

    if (command === '') {
      emitState({ state: 'armed' })
      return
    }

    emitState({ state: 'processing', text: command })
    Promise
      .resolve(onCommand?.(command))
      .catch(err => reportError(err?.message || 'on-command-failed', err))
  }

  function handleError(event) {
    const errorName = event?.error || 'unknown'

    if (PERMANENT_ERROR_NAMES.has(errorName)) {
      active = false
      reportError(errorName)
      emitState({ state: 'idle' })
      return
    }

    if (QUIET_ERROR_NAMES.has(errorName)) return

    const now = nowMs()
    if (now - lastErrorAt < TIGHT_ERROR_WINDOW_MS) {
      consecutiveErrors += 1
    } else {
      consecutiveErrors = 1
    }
    lastErrorAt = now

    if (consecutiveErrors > MAX_CONSECUTIVE_ERRORS) {
      active = false
      safelyStopRecognition()
      reportError(`restart-loop:${errorName}`)
      emitState({ state: 'idle' })
    }
  }

  function handleEnd() {
    if (!active || restartPending) return

    restartPending = true
    setTimeout(() => {
      restartPending = false
      if (!active) return
      spinUpRecognition()
    }, RESTART_DEBOUNCE_MS)
  }

  function emitState(state) {
    try {
      onStateChange?.(state)
    } catch {
      // status renderers must not break the listener
    }
  }

  function reportError(message, cause) {
    try {
      onError?.(cause instanceof Error ? cause : new Error(String(message)))
    } catch {
      // upstream error handler must not crash the listener
    }
  }

  return { start, stop, isListening, isSupported }
}

function resolveRecognitionConstructor() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}
