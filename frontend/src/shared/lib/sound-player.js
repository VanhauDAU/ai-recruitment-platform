import { getSoundEffect, isSoundOn } from './sound-effects'

// Phát hiệu ứng ngắn qua Web Audio: chỉnh âm lượng bằng GainNode vì Safari iOS bỏ qua
// `volume` của thẻ <audio>. Dùng chung cho lớp toast (ToastSoundEffect) và hiệu ứng UI.

export function createAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext
  return AudioContext ? new AudioContext() : null
}

/** Tải và giải mã tệp của một hiệu ứng; trả về null khi không tải được. */
export function decodeSoundEffect(audioContext, name) {
  const effect = getSoundEffect(name)
  if (!effect || !audioContext) return Promise.resolve(null)
  return fetch(effect.src)
    .then((response) => {
      if (!response.ok) throw new Error(`Could not load sound effect: ${name}`)
      return response.arrayBuffer()
    })
    .then((audioData) => audioContext.decodeAudioData(audioData))
    .catch(() => null)
}

export function playSoundBuffer(audioContext, buffer, volume) {
  if (!audioContext || audioContext.state !== 'running' || !buffer) return
  const source = audioContext.createBufferSource()
  const gain = audioContext.createGain()
  source.buffer = buffer
  gain.gain.setValueAtTime(volume, audioContext.currentTime)
  source.connect(gain)
  gain.connect(audioContext.destination)
  source.start()
}

let sharedContext = null
const sharedBuffers = new Map()

/**
 * Phát một hiệu ứng UI theo thao tác của người dùng (gọi trong handler click/chạm để trình
 * duyệt cho phép mở âm thanh). Tải ở lần phát đầu; tôn trọng công tắc tắt chuông với hiệu
 * ứng `followsMute`. Không bao giờ ném lỗi ra luồng gọi.
 */
export function playSoundEffect(name) {
  const effect = getSoundEffect(name)
  if (!effect || (effect.followsMute && !isSoundOn())) return
  sharedContext ||= createAudioContext()
  if (!sharedContext) return
  const ready = sharedContext.state === 'running' ? Promise.resolve() : sharedContext.resume().catch(() => {})
  if (!sharedBuffers.has(name)) {
    sharedBuffers.set(name, decodeSoundEffect(sharedContext, name).then((buffer) => {
      if (!buffer) sharedBuffers.delete(name)
      return buffer
    }))
  }
  Promise.all([ready, sharedBuffers.get(name)])
    .then(([, buffer]) => playSoundBuffer(sharedContext, buffer, effect.volume))
    .catch(() => {})
}
