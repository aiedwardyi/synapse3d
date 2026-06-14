import assert from 'node:assert/strict'
import { afterEach, beforeEach, test, mock } from 'node:test'
import {
  isSpeechSupported,
  speak,
  cancelSpeech,
  speechForOutcome,
  clarificationSpeech,
  VOICE_ASK_FALLBACK
} from '../src/voice-speak.js'

const originalWindow = globalThis.window

beforeEach(() => {
  mock.timers.enable({ apis: ['setTimeout'] })
})

afterEach(() => {
  globalThis.window = originalWindow
  mock.timers.reset()
})

// Install a fake SpeechSynthesis surface that records utterances. cancel() fires
// each utterance's onend, mirroring how a real engine surfaces cancellation.
function makeSpeechWindow() {
  const utterances = []
  class FakeUtterance {
    constructor(text) {
      this.text = text
      this.lang = ''
      this.onend = null
      this.onerror = null
    }
  }
  const speechSynthesis = {
    spoken: [],
    speak(utterance) {
      this.spoken.push(utterance)
      utterances.push(utterance)
    },
    cancel() {
      for (const utterance of utterances) utterance.onend?.()
    }
  }
  globalThis.window = { speechSynthesis, SpeechSynthesisUtterance: FakeUtterance }
  return { speechSynthesis, utterances }
}

test('speechForOutcome phrases opened with the note text', () => {
  assert.equal(speechForOutcome('opened', 'My Note'), 'Opened My Note')
})

test('speechForOutcome opened drops the trailing word when text is undefined', () => {
  assert.equal(speechForOutcome('opened', undefined), 'Opened')
})

test('speechForOutcome opened drops the trailing word when text is empty', () => {
  assert.equal(speechForOutcome('opened', ''), 'Opened')
})

test('speechForOutcome announces unmatched as a generic miss', () => {
  assert.equal(speechForOutcome('unmatched', 'kitchen sink'), 'No match found')
})

test('speechForOutcome stays silent for listener states and navigation done', () => {
  for (const state of [
    'listening',
    'armed',
    'processing',
    'heard',
    'reconnecting',
    'error',
    'idle',
    'done'
  ]) {
    assert.equal(speechForOutcome(state, 'whatever'), null)
  }
})

test('isSpeechSupported is false without a window', () => {
  globalThis.window = undefined
  assert.equal(isSpeechSupported(), false)
})

test('isSpeechSupported is false when speechSynthesis is missing', () => {
  globalThis.window = { SpeechSynthesisUtterance: function () {} }
  assert.equal(isSpeechSupported(), false)
})

test('isSpeechSupported is false when SpeechSynthesisUtterance is missing', () => {
  globalThis.window = { speechSynthesis: {} }
  assert.equal(isSpeechSupported(), false)
})

test('isSpeechSupported is true when both APIs exist', () => {
  makeSpeechWindow()
  assert.equal(isSpeechSupported(), true)
})

test('speak sends the text to the synthesizer with en-US lang', () => {
  const { speechSynthesis, utterances } = makeSpeechWindow()
  speak('hello there')
  assert.equal(speechSynthesis.spoken.length, 1)
  assert.equal(utterances[0].text, 'hello there')
  assert.equal(utterances[0].lang, 'en-US')
})

test('speak is a no-op but still calls onDone when unsupported', () => {
  globalThis.window = undefined
  let done = 0
  assert.doesNotThrow(() => speak('hello', { onDone: () => { done++ } }))
  assert.equal(done, 1)
})

test('speak calls onDone for empty text without speaking', () => {
  const { speechSynthesis } = makeSpeechWindow()
  let done = 0
  speak('', { onDone: () => { done++ } })
  assert.equal(done, 1)
  assert.equal(speechSynthesis.spoken.length, 0)
})

test('speak fires onDone once when the utterance ends', () => {
  const { utterances } = makeSpeechWindow()
  let done = 0
  speak('hello', { onDone: () => { done++ } })
  utterances[0].onend()
  assert.equal(done, 1)
})

test('speak fires onDone when the utterance errors', () => {
  const { utterances } = makeSpeechWindow()
  let done = 0
  speak('hello', { onDone: () => { done++ } })
  utterances[0].onerror()
  assert.equal(done, 1)
})

test('cancelSpeech surfaces onDone through the utterance end handler', () => {
  makeSpeechWindow()
  let done = 0
  speak('hello', { onDone: () => { done++ } })
  cancelSpeech()
  assert.equal(done, 1)
})

test('speak never calls onDone more than once across end, error and cancel', () => {
  const { utterances } = makeSpeechWindow()
  let done = 0
  speak('hello', { onDone: () => { done++ } })
  utterances[0].onend()
  utterances[0].onerror()
  cancelSpeech()
  assert.equal(done, 1)
})

test('cancelSpeech is safe when speech is unsupported', () => {
  globalThis.window = undefined
  assert.doesNotThrow(() => cancelSpeech())
})

test('speak completes via the fail-safe timer when neither event fires', () => {
  makeSpeechWindow()
  let done = 0
  speak('hello', { onDone: () => { done++ } })

  // 'hello' is 5 chars, so the bound is max(5000, 5 * 200 + 3000) = 5000ms. The
  // fail-safe must not fire before then (which would resume the mic mid-speech).
  mock.timers.tick(4000)
  assert.equal(done, 0)

  // Past the bound it completes exactly once even though no onend/onerror fired.
  mock.timers.tick(2000)
  assert.equal(done, 1)
})

test('the fail-safe timer is cleared once a real event fires', () => {
  const { utterances } = makeSpeechWindow()
  let done = 0
  speak('hello', { onDone: () => { done++ } })

  utterances[0].onend()
  assert.equal(done, 1)

  // A later fail-safe deadline must not fire a second completion.
  mock.timers.tick(60000)
  assert.equal(done, 1)
})

test('clarificationSpeech appends a single label as-is', () => {
  assert.equal(clarificationSpeech('Pick a note', ['Alpha']), 'Pick a note Alpha')
})

test('clarificationSpeech joins two labels with or', () => {
  assert.equal(
    clarificationSpeech('Which note did you mean?', ['Alpha', 'Beta']),
    'Which note did you mean? Alpha or Beta'
  )
})

test('clarificationSpeech joins three or more labels with commas and a final or', () => {
  assert.equal(
    clarificationSpeech('Pick a note', ['Alpha', 'Beta', 'Gamma']),
    'Pick a note Alpha, Beta, or Gamma'
  )
})

test('clarificationSpeech uses the shared fallback when the question is empty', () => {
  assert.equal(clarificationSpeech('', ['Alpha', 'Beta']), 'Which one? Alpha or Beta')
  assert.equal(clarificationSpeech(undefined, ['Alpha', 'Beta']), 'Which one? Alpha or Beta')
})

test('clarificationSpeech speaks the question alone when there are no labels', () => {
  assert.equal(clarificationSpeech('Which note?', []), 'Which note?')
  assert.equal(clarificationSpeech('Which note?', undefined), 'Which note?')
})

test('clarificationSpeech filters empty labels before phrasing them', () => {
  assert.equal(clarificationSpeech('Pick', ['Alpha', '', 'Beta']), 'Pick Alpha or Beta')
})

test('clarificationSpeech returns the bare fallback when empty with no labels', () => {
  assert.equal(clarificationSpeech('', []), VOICE_ASK_FALLBACK)
})
