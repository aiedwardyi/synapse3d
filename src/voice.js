import { extractDirectCommand, extractWakeCommand } from './voice-command.js'

const RESTART_DEBOUNCE_MS = 350
const RESTART_BACKOFF_MS = 1200
const TIGHT_ERROR_WINDOW_MS = 1000
const MAX_CONSECUTIVE_ERRORS = 3
const AWAITING_ANSWER_TIMEOUT_MS = 8000
const PERMANENT_ERROR_NAMES = new Set(['not-allowed', 'service-not-allowed'])
const QUIET_ERROR_NAMES = new Set(['no-speech', 'aborted'])

export function createVoiceListener({
  onCommand,
  onAnswer,
  onAnswerTimeout,
  onError,
  onStateChange,
  wakeWords
} = {}) {
  const RecognitionImpl = resolveRecognitionConstructor()
  const supported = Boolean(RecognitionImpl)

  let recognition = null
  let active = false
  let restartPending = false
  let restartTimerId = null
  let lastErrorAt = 0
  let consecutiveErrors = 0
  let awaitingAnswer = false
  let answerTimerId = null

  function isSupported() {
    return supported
  }

  function isListening() {
    return active
  }

  function isAwaitingAnswer() {
    return awaitingAnswer
  }

  function armAwaitingAnswer() {
    if (!active) return
    awaitingAnswer = true
    clearAnswerTimer()
    answerTimerId = setTimeout(() => {
      answerTimerId = null
      if (!awaitingAnswer) return
      awaitingAnswer = false
      try {
        onAnswerTimeout?.()
      } catch {
        // upstream timeout handler must not crash the listener
      }
    }, AWAITING_ANSWER_TIMEOUT_MS)
  }

  function disarmAwaitingAnswer() {
    awaitingAnswer = false
    clearAnswerTimer()
  }

  function clearAnswerTimer() {
    if (answerTimerId === null) return
    clearTimeout(answerTimerId)
    answerTimerId = null
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
    disarmAwaitingAnswer()
    clearRestartTimer()
    safelyStopRecognition()
    emitState({ state: 'idle' })
  }

  function clearRestartTimer() {
    if (restartTimerId === null) return
    clearTimeout(restartTimerId)
    restartTimerId = null
  }

  function spinUpRecognition() {
    const instance = new RecognitionImpl()
    recognition = instance
    instance.continuous = true
    instance.interimResults = false
    instance.lang = 'en-US'
    instance.onresult = event => {
      if (recognition !== instance) return
      handleResult(event)
    }
    instance.onerror = event => {
      if (recognition !== instance) return
      handleError(event)
    }
    instance.onend = () => {
      if (recognition !== instance) return
      handleEnd()
    }

    try {
      instance.start()
    } catch (err) {
      // Chrome throws InvalidStateError if the prior recognition is still tearing down.
      // Retry on a backoff rather than killing the listener.
      safelyStopRecognition()
      recognition = null
      reportError(err?.message || 'start-failed', err)
      if (active && !restartPending) {
        restartPending = true
        restartTimerId = setTimeout(() => {
          restartTimerId = null
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

      // A real final result means recognition is healthy; drop any error
      // counter we accumulated so transient errors across a long session
      // don't eventually trip the restart-loop guard.
      consecutiveErrors = 0
      lastErrorAt = 0

      processTranscript(transcript)
    }
  }

  function processTranscript(transcript) {
    const trimmed = typeof transcript === 'string' ? transcript.trim() : ''
    if (!trimmed) return

    if (awaitingAnswer) {
      // Next final utterance after an ask is treated as the answer; the wake
      // word is bypassed for this single turn.
      disarmAwaitingAnswer()
      emitState({ state: 'processing', text: trimmed })
      Promise
        .resolve(onAnswer?.(trimmed))
        .catch(err => reportError(err?.message || 'on-answer-failed', err))
      return
    }

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
      disarmAwaitingAnswer()
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
      disarmAwaitingAnswer()
      safelyStopRecognition()
      reportError(`restart-loop:${errorName}`)
      emitState({ state: 'idle' })
    }
  }

  function handleEnd() {
    if (!active || restartPending) return

    restartPending = true
    restartTimerId = setTimeout(() => {
      restartTimerId = null
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

  return {
    start,
    stop,
    isListening,
    isSupported,
    armAwaitingAnswer,
    disarmAwaitingAnswer,
    isAwaitingAnswer
  }
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
