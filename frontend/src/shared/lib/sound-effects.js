export const DEFAULT_TOAST_SOUND = 'notification'

// Công tắc chuông trên chuông thông báo (NotificationSoundToggle); hiệu ứng có
// `followsMute` cũng im theo công tắc này.
export const SOUND_PREFERENCE_KEY = 'procv:notification-sound'

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
  // Tin nhắn ProCV Connect mới: tiếng riêng để phân biệt với thông báo; chỉ
  // người dùng có hộp thư mới cần nên tải ở lần phát đầu.
  message: Object.freeze({
    src: '/audio/effects/message.mp3',
    toastClassName: 'app-toast--sound-message',
    volume: 0.35,
    preload: false,
  }),
  // Mốc đáng ăn mừng (nộp hồ sơ, đăng tin, kích hoạt chiến dịch…): hiếm khi
  // phát nên không tải sẵn, chỉ fetch ở lần phát đầu.
  celebrate: Object.freeze({
    src: '/audio/effects/celebrate.mp3',
    toastClassName: 'app-toast--sound-celebrate',
    volume: 0.2,
    preload: false,
    followsMute: true,
  }),
})

// Toast mang class này không phát âm thanh (người dùng đã tắt chuông).
export const SILENT_TOAST_CLASS = 'app-toast--silent'

export function isSoundOn() {
  try {
    return window.localStorage.getItem(SOUND_PREFERENCE_KEY) !== 'off'
  } catch {
    return true
  }
}

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
