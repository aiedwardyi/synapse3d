export function updateTrackingButtonAfterRender(button, trackingStarted) {
  if (!button || trackingStarted) return

  button.hidden = false
  button.disabled = false
}

export function resetTrackingUiAfterError({ button, video, canvas, stopVideoStream }) {
  try {
    stopVideoStream?.(video)
  } catch (err) {
    console.warn('Failed to stop video stream during tracking reset:', err)
  }

  if (button) {
    button.hidden = false
    button.disabled = false
  }
  if (video) video.hidden = true
  if (canvas) canvas.hidden = true
}
