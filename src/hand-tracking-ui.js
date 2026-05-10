export function updateTrackingButtonAfterRender(button, trackingStarted) {
  if (!button || trackingStarted) return

  button.hidden = false
  button.disabled = false
}

export function resetTrackingUiAfterError({ button, video, canvas, stopVideoStream }) {
  stopVideoStream(video)
  button.hidden = false
  button.disabled = false
  video.hidden = true
  canvas.hidden = true
}
