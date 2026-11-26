// Thu nhỏ ảnh trên trình duyệt trước khi tải lên: ảnh chụp điện thoại vài MB (hay ảnh
// bìa PNG) đi qua mạng tới server rồi lên R2 rất chậm, trong khi server vẫn mã hóa lại
// và thu nhỏ về cùng trần. Ảnh đã nhỏ, trình duyệt không giải mã/mã hóa được, hoặc bản
// thu nhỏ không nhẹ hơn thì giữ nguyên tệp gốc.

const SMALL_ENOUGH_BYTES = 300 * 1024

function encode(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

export async function shrinkImage(file, { maxWidth, maxHeight, quality = 0.85 }) {
  if (typeof createImageBitmap !== 'function' || !file?.type?.startsWith('image/')) return file
  let bitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }
  try {
    const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height)
    if (scale === 1 && file.size <= SMALL_ENOUGH_BYTES) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    // WebP giữ được nền trong suốt; trình duyệt không mã hóa WebP thì ảnh không phải
    // PNG đi JPEG, còn PNG (có thể trong suốt) giữ tệp gốc.
    let blob = await encode(canvas, 'image/webp', quality)
    if (blob?.type !== 'image/webp') {
      blob = file.type === 'image/png' ? null : await encode(canvas, 'image/jpeg', quality)
    }
    if (!blob || blob.size >= file.size) return file
    const extension = blob.type === 'image/webp' ? 'webp' : 'jpg'
    const name = `${file.name.replace(/\.[^.]+$/, '') || 'image'}.${extension}`
    return new File([blob], name, { type: blob.type, lastModified: file.lastModified })
  } finally {
    bitmap.close?.()
  }
}
