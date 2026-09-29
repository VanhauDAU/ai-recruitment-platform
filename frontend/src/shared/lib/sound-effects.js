export const DEFAULT_TOAST_SOUND = 'notification'

export const SOUND_EFFECTS = Object.freeze({
  notification: Object.freeze({
    src: '/audio/effects/notification.mp3',
    toastClassName: 'app-toast--sound-notification',
    volume: 0.02,
  }),
  done: Object.freeze({
    src: '/audio/effects/done.mp3',
    toastClassName: 'app-toast--sound-done',
    volume: 0.2,
  }),
})

export function getSoundEffect(name) {
  return SOUND_EFFECTS[name] || null
}

// Workflow chỉ cần gắn semantic sound vào toast; player toàn cục chịu trách
// nhiệm preload, browser audio policy và tránh phát trùng.
export function toastSoundOptions(name) {
  const effect = getSoundEffect(name)
  return effect ? { className: effect.toastClassName } : {}
}

export function getToastSoundName(toast) {
  const matched = Object.entries(SOUND_EFFECTS).find(([, effect]) => (
    toast.classList.contains(effect.toastClassName)
  ))
  return matched?.[0] || DEFAULT_TOAST_SOUND
}
