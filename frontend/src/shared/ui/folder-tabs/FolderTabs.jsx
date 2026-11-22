import { useState } from 'react'
import './folder-tabs.css'

// Mũi tên trái/phải, Home/End chuyển tab (mẫu tablist của WAI-ARIA).
const NEXT = { ArrowRight: (i) => i + 1, ArrowLeft: (i) => i - 1, Home: () => 0, End: (_, n) => n - 1 }

// Góc cong dưới tab đang chọn: cung viền nối cột viền dọc với đường kẻ, phần ngoài cung tô màu tab để che đường kẻ.
// Vẽ bằng SVG trong HTML để màu đi theo biến CSS --ftabs-surface/--ftabs-line.
const CORNERS = {
  left: ['M12 0A12 12 0 0 1 0 12H12Z', 'M11.5 0A11.5 11.5 0 0 1 0 11.5'],
  right: ['M0 0A12 12 0 0 0 12 12H0Z', 'M0.5 0A11.5 11.5 0 0 0 12 11.5'],
}
const Corner = ({ side }) => (
  <svg className={`ftabs__corner is-${side}`} viewBox="0 0 12 12" aria-hidden focusable="false">
    <path className="ftabs__corner-fill" d={CORNERS[side][0]} />
    <path className="ftabs__corner-line" d={CORNERS[side][1]} />
  </svg>
)

/**
 * Hàng tab kiểu thẻ hồ sơ: tab đang chọn liền khối với khung nội dung, hai góc dưới cong ra ngoài.
 *
 * - `items`: `{ key, label, icon?, title?, children }`. `title` là chú thích khi nhãn bị cắt.
 * - `extra`: nội dung đặt cuối hàng tab (vd. nút xem trước).
 * - Mặc định nội dung nằm trong khung trắng có viền (dùng trên nền xám); `plain` bỏ khung, chỉ giữ đường kẻ
 *   dưới hàng tab (dùng khi nội dung đã là thẻ, tránh viền chồng viền). Với `plain`, đặt `--ftabs-surface`
 *   bằng màu nền nơi đặt tab để tab đang chọn liền với nền đó.
 * - Mặc định giữ lại tab đã mở để không mất dữ liệu đang nhập; `destroyInactive` thì chỉ dựng tab đang chọn.
 */
export default function FolderTabs({ items, activeKey, onChange, ariaLabel, idPrefix, extra, plain = false, destroyInactive = false, className = '', panelClassName = '' }) {
  const [visited, setVisited] = useState(() => new Set([activeKey]))
  if (!visited.has(activeKey)) setVisited(new Set(visited).add(activeKey))
  const tabId = (key) => `${idPrefix}-tab-${key}`
  const panelId = (key) => `${idPrefix}-panel-${key}`

  const onKeyDown = (event) => {
    const move = NEXT[event.key]
    const index = items.findIndex((item) => item.key === activeKey)
    if (!move || index < 0) return
    event.preventDefault()
    const next = items[(move(index, items.length) + items.length) % items.length]
    onChange(next.key)
    document.getElementById(tabId(next.key))?.focus()
  }

  return (
    <div className={`ftabs ${plain ? 'is-plain' : ''} ${className}`}>
      <div className="ftabs__bar">
        <div className="ftabs__strip" role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown}>
          {items.map((item) => {
            const active = item.key === activeKey
            return (
              <button
                key={item.key}
                id={tabId(item.key)}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={panelId(item.key)}
                tabIndex={active ? 0 : -1}
                title={item.title}
                className={`ftabs__tab ${active ? 'is-active' : ''}`}
                onClick={() => onChange(item.key)}
              >
                {active && <><Corner side="left" /><Corner side="right" /></>}
                {item.icon && <span className="ftabs__icon" aria-hidden>{item.icon}</span>}
                <span className="ftabs__label">{item.label}</span>
              </button>
            )
          })}
        </div>
        {extra && <div className="ftabs__extra">{extra}</div>}
      </div>
      {items.map((item) => {
        const active = item.key === activeKey
        if (!active && (destroyInactive || !visited.has(item.key))) return null
        return (
          <div
            key={item.key}
            id={panelId(item.key)}
            role="tabpanel"
            aria-labelledby={tabId(item.key)}
            hidden={!active}
            className={`ftabs__panel ${panelClassName}`}
          >
            {item.children}
          </div>
        )
      })}
    </div>
  )
}
