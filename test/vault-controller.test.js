import assert from 'node:assert/strict'
import { test } from 'node:test'
import { initVaultControls } from '../src/vault-controller.js'

function button() {
  const listeners = new Map()

  return {
    hidden: true,
    textContent: '',
    addEventListener(type, listener) {
      listeners.set(type, listener)
    },
    async click() {
      const listener = listeners.get('click')
      assert.ok(listener, 'click listener should be registered')
      await listener()
    }
  }
}

function createControls(overrides = {}) {
  const pickButton = button()
  const changeButton = button()
  const errors = []

  return {
    pickButton,
    changeButton,
    errors,
    deps: {
      pickButton,
      changeButton,
      pickVault: async () => ({ name: 'picked' }),
      getCachedVault: async () => null,
      hasVaultPermission: async () => false,
      requestVaultPermission: async () => false,
      loadAndRender: async () => {},
      onError: err => errors.push(err),
      ...overrides
    }
  }
}

test('shows the picker when cached vault auto-load fails', async () => {
  const cached = { name: 'cached' }
  const { pickButton, changeButton, errors, deps } = createControls({
    getCachedVault: async () => cached,
    hasVaultPermission: async () => true,
    loadAndRender: async () => {
      throw new Error('stale handle')
    }
  })

  await initVaultControls(deps)

  assert.equal(pickButton.hidden, false)
  assert.equal(pickButton.textContent, 'Pick Vault Folder')
  assert.equal(changeButton.hidden, true)
  assert.equal(errors.length, 1)
})

test('keeps the picker visible when selected vault loading fails', async () => {
  const { pickButton, errors, deps } = createControls({
    loadAndRender: async () => {
      throw new Error('parse failed')
    }
  })

  await initVaultControls(deps)
  await pickButton.click()

  assert.equal(pickButton.hidden, false)
  assert.equal(pickButton.textContent, 'Pick Vault Folder')
  assert.equal(errors.length, 1)
})

test('falls back to selecting a new vault when cached permission is denied', async () => {
  const cached = { name: 'cached' }
  const picked = { name: 'picked' }
  const loaded = []
  const { pickButton, changeButton, deps } = createControls({
    getCachedVault: async () => cached,
    requestVaultPermission: async () => false,
    pickVault: async () => picked,
    loadAndRender: async handle => loaded.push(handle)
  })

  await initVaultControls(deps)
  await pickButton.click()

  assert.deepEqual(loaded, [picked])
  assert.equal(pickButton.hidden, true)
  assert.equal(changeButton.hidden, false)
})
