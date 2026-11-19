// Cắt ảnh đại diện phía trình duyệt: người dùng chọn một vùng vuông trên ảnh gốc,
// chỉ phần đã cắt (JPEG vuông) được gửi lên `/auth/avatar/`. Mọi toạ độ tính theo
// pixel thật của ảnh gốc nên vùng cắt không phụ thuộc kích thước hiển thị.

import { m } from '@/shared/config/i18n'

export const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp'
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024
export const AVATAR_MIN_SIDE = 200
export const AVATAR_OUTPUT_SIZE = 400
const MIN_CROP_SIZE = 100
const INITIAL_CROP_RATIO = 0.8

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

/** Lỗi về định dạng/dung lượng (kiểm tra trước khi đọc ảnh), hoặc '' nếu hợp lệ. */
export function validateAvatarFile(file) {
  if (!AVATAR_ACCEPT.split(',').includes(file?.type)) return m.account_avatar_error_type()
  if (file.size > AVATAR_MAX_BYTES) return m.account_avatar_error_size()
  return ''
}

/** Lỗi về kích thước ảnh sau khi đọc được, hoặc '' nếu hợp lệ. */
export function validateAvatarDimensions(width, height) {
  if (Math.min(width, height) < AVATAR_MIN_SIDE) {
    return m.account_avatar_error_too_small({ width, height, min: AVATAR_MIN_SIDE })
  }
  return ''
}

export function initialCrop(width, height) {
  const size = Math.round(Math.min(width, height) * INITIAL_CROP_RATIO)
  return { x: Math.round((width - size) / 2), y: Math.round((height - size) / 2), size }
}

export function moveCrop(crop, dx, dy, width, height) {
  return {
    ...crop,
    x: Math.round(clamp(crop.x + dx, 0, width - crop.size)),
    y: Math.round(clamp(crop.y + dy, 0, height - crop.size)),
  }
}

/**
 * Kéo một góc (`sx`, `sy` = ±1, hướng từ góc đối diện tới góc đang kéo); góc đối
 * diện đứng yên, vùng cắt giữ hình vuông và không vượt khỏi ảnh.
 */
export function resizeCrop(crop, { sx, sy }, dx, dy, width, height) {
  const anchorX = sx > 0 ? crop.x : crop.x + crop.size
  const anchorY = sy > 0 ? crop.y : crop.y + crop.size
  const maxSize = Math.min(sx > 0 ? width - anchorX : anchorX, sy > 0 ? height - anchorY : anchorY)
  const size = Math.round(clamp(crop.size + (sx * dx + sy * dy) / 2, Math.min(MIN_CROP_SIZE, maxSize), maxSize))
  return { x: sx > 0 ? anchorX : anchorX - size, y: sy > 0 ? anchorY : anchorY - size, size }
}

export function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => resolve({ url, image, width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(m.account_avatar_error_read()))
    }
    image.src = url
  })
}

/** Vẽ vùng cắt ra JPEG vuông (nền trắng cho ảnh PNG/WebP trong suốt). */
export function cropToFile(image, crop) {
  const output = Math.min(AVATAR_OUTPUT_SIZE, crop.size)
  const canvas = document.createElement('canvas')
  canvas.width = output
  canvas.height = output
  const context = canvas.getContext('2d')
  context.fillStyle = '#fff'
  context.fillRect(0, 0, output, output)
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, crop.x, crop.y, crop.size, crop.size, 0, 0, output, output)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }))
      else reject(new Error(m.account_avatar_error_crop()))
    }, 'image/jpeg', 0.9)
  })
}
