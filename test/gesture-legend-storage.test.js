import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { hasSeenLegend, markLegendSeen } from '../src/gesture-legend-storage.js'

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')

afterEach(() => {
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(globalThis, 'localStorage', originalLocalStorageDescriptor)
    return
  }

  delete globalThis.localStorage
})

test('hasSeenLegend returns false on a fresh localStorage', () => {
  setLocalStorage(createMemoryStorage())

  assert.equal(hasSeenLegend(), false)
})

test('markLegendSeen stores the seen flag', () => {
  setLocalStorage(createMemoryStorage())

  markLegendSeen()

  assert.equal(hasSeenLegend(), true)
})

test('markLegendSeen does not throw when localStorage writes throw', () => {
  setLocalStorage({
    getItem() {
      return null
    },
    setItem() {
      throw new Error('storage disabled')
    }
  })

  assert.doesNotThrow(() => markLegendSeen())
  assert.equal(hasSeenLegend(), false)
})

test('hasSeenLegend returns false when localStorage reads throw', () => {
  setThrowingLocalStorageGetter()

  assert.equal(hasSeenLegend(), false)
})

function setLocalStorage(storage) {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage
  })
}

function setThrowingLocalStorageGetter() {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('storage blocked')
    }
  })
}

function createMemoryStorage() {
  const values = new Map()

  return {
    getItem(key) {
      return values.get(key) || null
    },
    setItem(key, value) {
      values.set(key, value)
    }
  }
}
