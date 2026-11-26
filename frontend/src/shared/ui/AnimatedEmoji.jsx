// Emoji động Noto (CC BY 4.0) — nguồn và cách tạo file ở public/images/emoji/README.md.
// Bản tĩnh luôn hiện; bản động chỉ gắn khi `animated` để không tải nhiều ảnh động cùng lúc.
const EMOJI_DIR = '/images/emoji'
const LAYER = { position: 'absolute', inset: 0, width: '100%', height: '100%' }

/** `size` đặt kích thước nội tuyến; bỏ trống thì để CSS của `className` quyết định. */
export default function AnimatedEmoji({ name, animated = false, size, className = '' }) {
  const box = size ? { width: size, height: size } : null
  const pixels = size || 56
  return (
    <span className={className} style={{ position: 'relative', display: 'block', ...box }} aria-hidden="true">
      <img src={`${EMOJI_DIR}/${name}-static.webp`} alt="" width={pixels} height={pixels} loading="lazy" decoding="async" style={LAYER} />
      {animated && <img src={`${EMOJI_DIR}/${name}.webp`} alt="" width={pixels} height={pixels} decoding="async" style={LAYER} />}
    </span>
  )
}
