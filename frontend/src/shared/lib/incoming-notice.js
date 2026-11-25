// Toast + chuông cho một thông báo vừa đến qua realtime. Hạ tầng thuần: nhận
// tiêu đề/hành động đã dựng sẵn, không biết loại sự kiện nghiệp vụ.
import { useSyncExternalStore } from 'react'
import { SILENT_TOAST_CLASS, toastSoundOptions } from './sound-effects'
import { message } from './toast'
import { m } from '@/shared/config/i18n'

const SOUND_KEY = 'procv:notification-sound'
const CLAIM_PREFIX = 'procv:notice-claim:'
const CLAIM_TTL_MS = 60_000
// Tab đang hiển thị giành trước; tab ẩn chỉ nhận khi không tab nào đang mở.
const HIDDEN_TAB_DELAY_MS = 400
const CLAIM_SETTLE_MS = 60
const tabId = Math.random().toString(36).slice(2)
const soundListeners = new Set()

function readStorage(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key, value) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function isNotificationSoundOn() {
  return readStorage(SOUND_KEY) !== 'off'
}

export function setNotificationSoundOn(on) {
  writeStorage(SOUND_KEY, on ? null : 'off')
  soundListeners.forEach((listener) => listener())
}

function subscribeSound(listener) {
  soundListeners.add(listener)
  const onStorage = (event) => event.key === SOUND_KEY && listener()
  window.addEventListener('storage', onStorage)
  return () => {
    soundListeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** Trạng thái chuông, đồng bộ giữa các tab. */
export function useNotificationSound() {
  const on = useSyncExternalStore(subscribeSound, isNotificationSoundOn, () => true)
  return [on, setNotificationSoundOn]
}

const wait = (ms) => new Promise((resolve) => { window.setTimeout(resolve, ms) })

// Mỗi tab của cùng tài khoản đều nhận sự kiện; chỉ một tab được kêu. Ghi rồi đọc
// lại sau một nhịp: tab ghi sau cùng thắng, các tab khác thấy và nhường.
export async function claimNotice(id) {
  if (!id) return true
  const key = `${CLAIM_PREFIX}${id}`
  if (document.visibilityState !== 'visible') await wait(HIDDEN_TAB_DELAY_MS)
  if (readStorage(key)) return false
  if (!writeStorage(key, tabId)) return true // không có storage: tự quyết cho tab này
  await wait(CLAIM_SETTLE_MS)
  if (readStorage(key) !== tabId) return false
  window.setTimeout(() => writeStorage(key, null), CLAIM_TTL_MS)
  return true
}

/** Chỉ đường dẫn nội bộ của SPA mới thành nút "Xem" (không `//host`, không URL ngoài). */
export function isInternalPath(path) {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')
}

/**
 * Hiện toast cho thông báo `id`, kèm chuông nếu người dùng bật; `onOpen(path)`
 * chạy khi bấm "Xem". Trả về `false` khi một tab khác đã báo thông báo này.
 */
export async function announceNotice({ id, title, path, onOpen }) {
  if (!(await claimNotice(id))) return false
  const sound = isNotificationSoundOn() ? toastSoundOptions('incoming') : { className: SILENT_TOAST_CLASS }
  const action = onOpen && isInternalPath(path)
    ? { label: m.notification_open(), onClick: () => onOpen(path) }
    : undefined
  message.info(title, { ...sound, id, action, duration: 6_000 })
  return true
}
