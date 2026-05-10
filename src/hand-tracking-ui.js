export function updateTrackingButtonAfterRender(button, trackingStarted) {
  if (!button || trackingStarted) return

  button.hidden = false
  button.disabled = false
}
