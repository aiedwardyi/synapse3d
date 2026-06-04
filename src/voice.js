import { extractDirectCommand, extractWakeCommand } from './voice-command.js'

const RESTART_DEBOUNCE_MS = 350
const RESTART_BACKOFF_MS = 1200
const TIGHT_ERROR_WINDOW_MS = 1000
const MAX_CONSECUTIVE_ERRORS = 3
const WATCHDOG_THRESHOLD_MS = 9000
const WATCHDOG_POLL_MS = 2000
const RECYCLE_WINDOW_MS = 10000
const MAX_RECYCLES_IN_WINDOW = 4
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
  let lastActivityAt = 0
  let watchdogTimerId = null
  let recycleTimestamps = []

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
    recycleTimestamps = []
    spinUpRecognition()
    startWatchdog()
  }

  function stop() {
    if (!active) return
    active = false
    restartPending = false
    disarmAwaitingAnswer()
    clearRestartTimer()
    stopWatchdog()
    teardownRecognition()
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
    lastActivityAt = nowMs()
    instance.continuous = true
    instance.interimResults = false
    instance.lang = 'en-US'
    instance.onstart = () => {
      if (recognition !== instance) return
      markActivity()
    }
    instance.onaudiostart = () => {
      if (recognition !== instance) return
      markActivity()
    }
    instance.onsoundstart = () => {
      if (recognition !== instance) return
      markActivity()
    }
    instance.onspeechstart = () => {
      if (recognition !== instance) return
      markActivity()
    }
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
      // Recycle on a backoff rather than killing the listener.
      teardownRecognition()
      reportError(err?.message || 'start-failed', err)
      // Surface the retry so a thrown start is observable instead of silently
      // idle. Suppressed mid-conversation so the clarify prompt stays put.
      if (active && !awaitingAnswer) emitState({ state: 'reconnecting' })
      if (active && !restartPending) {
        restartPending = true
        restartTimerId = setTimeout(() => {
          restartTimerId = null
          restartPending = false
          if (!active) return
          spinUpRecognition()
        }, RESTART_BACKOFF_MS)
        restartTimerId?.unref?.()
      }
      return
    }

    // Stay silent mid-conversation so a recycle does not wipe the clarify prompt.
    if (!awaitingAnswer) emitState({ state: 'listening' })
  }

  function markActivity() {
    lastActivityAt = nowMs()
    if (!restartPending) return
    // Activity resumed before the scheduled recycle fired, so the engine is
    // alive after all; cancel the recycle instead of cutting off an in-flight
    // utterance.
    clearRestartTimer()
    restartPending = false
    if (!awaitingAnswer) emitState({ state: 'listening' })
  }

  function teardownRecognition() {
    const instance = recognition
    if (!instance) return
    // Drop the reference first so any late event from this instance is ignored
    // by the identity guard, then detach every handler and stop it. This mirrors
    // the clean slate a page reload gives the engine.
    recognition = null
    instance.onstart = null
    instance.onaudiostart = null
    instance.onsoundstart = null
    instance.onspeechstart = null
    instance.onresult = null
    instance.onerror = null
    instance.onend = null
    try {
      instance.stop()
    } catch {
      // Recognition was never fully started or is mid-teardown; nothing to do.
    }
  }

  function handleResult(event) {
    if (!active) return
    markActivity()
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
      // bare command if it matches a direct action or starts with a recognised
      // note-opening verb.
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
      stopListeningWithError(errorName)
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
      stopListeningWithError(`restart-loop:${errorName}`)
      return
    }

    // A transient error is followed by onend, but recycle directly too so a
    // missing onend cannot leave the engine wedged.
    scheduleRecycle()
  }

  function stopListeningWithError(text) {
    active = false
    restartPending = false
    disarmAwaitingAnswer()
    clearRestartTimer()
    stopWatchdog()
    teardownRecognition()
    reportError(text)
    emitState({ state: 'error', text })
  }

  function handleEnd() {
    if (!active) return
    scheduleRecycle()
  }

  // Recycle the recognizer: surface a brief reconnecting state, then tear down
  // the wedged instance and build a fresh one on a debounce that backs off if
  // recycles keep firing in a short window.
  function scheduleRecycle() {
    if (!active || restartPending) return

    restartPending = true
    // Mid-conversation the recycle runs silently so the clarify prompt and its
    // options stay on screen; awaitingAnswer is preserved across the rebuild.
    if (!awaitingAnswer) emitState({ state: 'reconnecting' })

    const now = nowMs()
    const recentRecycleCount = noteRecycle(now)
    const delayMs = recycleDelayMs({
      recentRecycleCount,
      maxRecycles: MAX_RECYCLES_IN_WINDOW,
      baseDelayMs: RESTART_DEBOUNCE_MS,
      backoffDelayMs: RESTART_BACKOFF_MS
    })

    clearRestartTimer()
    restartTimerId = setTimeout(() => {
      restartTimerId = null
      restartPending = false
      if (!active) return
      teardownRecognition()
      spinUpRecognition()
    }, delayMs)
    restartTimerId?.unref?.()
  }

  function startWatchdog() {
    stopWatchdog()
    watchdogTimerId = setTimeout(tickWatchdog, WATCHDOG_POLL_MS)
    watchdogTimerId?.unref?.()
  }

  function stopWatchdog() {
    if (watchdogTimerId === null) return
    clearTimeout(watchdogTimerId)
    watchdogTimerId = null
  }

  function tickWatchdog() {
    watchdogTimerId = null
    if (!active) return

    const now = nowMs()
    const status = restartPending ? 'reconnecting' : 'listening'
    if (
      shouldRecycleNow({
        status,
        lastActivityAt,
        now,
        thresholdMs: WATCHDOG_THRESHOLD_MS,
        recentRecycleCount: countRecentRecycles(now),
        maxRecycles: MAX_RECYCLES_IN_WINDOW
      })
    ) {
      scheduleRecycle()
    }

    startWatchdog()
  }

  function noteRecycle(now) {
    recycleTimestamps.push(now)
    pruneRecycleTimestamps(now)
    return recycleTimestamps.length
  }

  function countRecentRecycles(now) {
    pruneRecycleTimestamps(now)
    return recycleTimestamps.length
  }

  function pruneRecycleTimestamps(now) {
    const cutoff = now - RECYCLE_WINDOW_MS
    recycleTimestamps = recycleTimestamps.filter(timestamp => timestamp >= cutoff)
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

// Pure recycle decision for the inactivity watchdog. Recycle only while the
// engine claims to be listening, no liveness event has landed within the
// threshold, and we are not already backing off a recent recycle burst.
export function shouldRecycleNow({
  status,
  lastActivityAt,
  now,
  thresholdMs,
  recentRecycleCount = 0,
  maxRecycles = Infinity
}) {
  if (status !== 'listening') return false
  if (recentRecycleCount >= maxRecycles) return false
  if (!Number.isFinite(lastActivityAt) || !Number.isFinite(now) || !Number.isFinite(thresholdMs)) {
    return false
  }
  return now - lastActivityAt >= thresholdMs
}

// Pure backoff: stretch the delay once recycles churn past the cap so a wedged
// engine cannot drive a tight recycle loop.
export function recycleDelayMs({
  recentRecycleCount = 0,
  maxRecycles = Infinity,
  baseDelayMs,
  backoffDelayMs
}) {
  return recentRecycleCount >= maxRecycles ? backoffDelayMs : baseDelayMs
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
