export async function initVaultControls({
  pickButton,
  changeButton,
  pickVault,
  getCachedVault,
  hasVaultPermission,
  requestVaultPermission,
  loadAndRender,
  onError = console.error
}) {
  let cached = await getCachedVault()

  function reportError(err) {
    if (err?.name !== 'AbortError') {
      onError(err)
    }
  }

  function showPicker(useCached) {
    pickButton.textContent = useCached ? 'Open Vault' : 'Pick Vault Folder'
    pickButton.hidden = false
  }

  async function loadVault(handle) {
    await loadAndRender(handle)
    pickButton.hidden = true
    changeButton.hidden = false
  }

  changeButton.addEventListener('click', async () => {
    try {
      const handle = await pickVault()
      await loadVault(handle)
      cached = handle
    } catch (err) {
      reportError(err)
    }
  })

  pickButton.addEventListener('click', async () => {
    try {
      let handle

      if (cached) {
        const granted = await requestVaultPermission(cached)
        if (granted) {
          handle = cached
        } else {
          cached = null
          showPicker(false)
          return
        }
      } else {
        handle = await pickVault()
      }

      await loadVault(handle)
      cached = handle
    } catch (err) {
      reportError(err)
      showPicker(Boolean(cached))
    }
  })

  if (cached) {
    let hasPermission = false

    try {
      hasPermission = await hasVaultPermission(cached)
    } catch (err) {
      reportError(err)
      cached = null
    }

    if (hasPermission) {
      try {
        await loadVault(cached)
        return
      } catch (err) {
        reportError(err)
        cached = null
      }
    }
  }

  showPicker(Boolean(cached))
}
