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
  // Thông báo mới đến qua realtime: cùng tiếng chuông nhưng đủ nghe khi người
  // dùng đang ở tab khác hoặc không nhìn màn hình.
  incoming: Object.freeze({
    src: '/audio/effects/notification.mp3',
    toastClassName: 'app-toast--sound-incoming',
    volume: 0.35,
  }),
})

// Toast mang class này không phát âm thanh (người dùng đã tắt chuông).
export const SILENT_TOAST_CLASS = 'app-toast--silent'

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
  if (toast.classList.contains(SILENT_TOAST_CLASS)) return null
  const matched = Object.entries(SOUND_EFFECTS).find(([, effect]) => (
    toast.classList.contains(effect.toastClassName)
  ))
  return matched?.[0] || DEFAULT_TOAST_SOUND
}
