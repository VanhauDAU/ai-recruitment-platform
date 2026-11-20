// Khung ảnh theo loại slide: slide ảnh trang chủ 8:3, ảnh minh họa slide chữ 4:3.
export const CROP_ASPECTS = { image: 8 / 3, promo: 4 / 3 }
export const CROP_OUTPUT_WIDTH = { image: 1600, promo: 960 }
const OUTPUT_TYPE = 'image/webp'
const OUTPUT_QUALITY = 0.9

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

/**
 * Vẽ vùng đã chọn (pixel của ảnh gốc) ra canvas đúng tỉ lệ khung.
 * Không phóng to: ảnh gốc nhỏ hơn `maxWidth` thì giữ nguyên độ phân giải vùng cắt.
 */
export async function cropToFile(src, area, { maxWidth, name = 'banner.webp' }) {
  const image = await loadImage(src)
  const width = Math.round(Math.min(maxWidth, area.width))
  const height = Math.round(width * (area.height / area.width))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, width, height)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, OUTPUT_TYPE, OUTPUT_QUALITY))
  return new File([blob], name.replace(/\.[^.]+$/, '') + '.webp', { type: OUTPUT_TYPE })
}
