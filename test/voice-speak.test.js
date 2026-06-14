import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import {
  isSpeechSupported,
  speak,
  cancelSpeech,
  speechForOutcome
} from '../src/voice-speak.js'

const originalWindow = globalThis.window

afterEach(() => {
  globalThis.window = originalWindow
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
