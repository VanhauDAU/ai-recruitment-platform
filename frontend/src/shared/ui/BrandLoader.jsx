const ANIMATED_SRC = '/images/loading/procv-loader.webp'
const STATIC_SRC = '/images/loading/procv-loader-static.webp'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Linh vật ProCV dùng cho mọi trạng thái chờ. Bỏ `size` khi caller muốn style
// quyết định kích thước, như indicator dùng chung của antd Spin.
// `percent` bị antd Spin tiêm vào indicator lúc clone nên phải nhận rồi bỏ đi,
// tránh rơi xuống thẻ img thành attribute lạ.
export default function BrandLoader({ size, className = '', style, percent: _percent, ...rest }) {
  return (
    <img
      {...rest}
      src={prefersReducedMotion() ? STATIC_SRC : ANIMATED_SRC}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      draggable={false}
      className={`inline-block select-none object-contain ${className}`}
      style={size ? { width: size, height: size, ...style } : style}
    />
  )
}
