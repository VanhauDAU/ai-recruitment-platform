/**
 * iOS (Safari và mọi trình duyệt WebKit) chỉ mở bàn phím khi `focus()` chạy đồng bộ
 * trong thao tác chạm; focus sau khi chuyển trang/tải dữ liệu bị bỏ qua. Gọi hàm này
 * ngay trong onClick: focus một ô ẩn để giữ bàn phím, ô thật focus sau đó nhận lại bàn
 * phím và ô ẩn tự gỡ khi mất focus (hoặc sau `timeoutMs` nếu ô thật không xuất hiện).
 */
export function holdKeyboardFocus(timeoutMs = 3000) {
  const input = document.createElement('input')
  input.setAttribute('aria-hidden', 'true')
  input.tabIndex = -1
  // 16px để iOS không phóng to trang khi focus.
  input.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;pointer-events:none'
  const remove = () => input.remove()
  input.addEventListener('blur', remove, { once: true })
  document.body.appendChild(input)
  input.focus({ preventScroll: true })
  window.setTimeout(remove, timeoutMs)
}
