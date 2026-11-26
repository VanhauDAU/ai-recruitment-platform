const TABS = [
  ['info', 'Thông tin'],
  ['company', 'Công ty'],
  ['related', 'Việc liên quan'],
]

/** Mobile: chia phần dưới khối đầu tin thành 3 tab; panel ẩn bằng `hidden` để giữ trạng thái. */
export default function JobDetailTabs({ active, onChange, relatedCount = 0, panels }) {
  function handleKeyDown(event) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    if (!step) return
    const index = TABS.findIndex(([key]) => key === active)
    const next = TABS[(index + step + TABS.length) % TABS.length][0]
    onChange(next)
    document.getElementById(`job-tab-${next}`)?.focus()
  }

  return (
    <div id="job-detail-tabs" className="job-tabs">
      <div className="job-tabs__bar">
        <div role="tablist" aria-label="Nội dung tin tuyển dụng" className="job-tabs__list" onKeyDown={handleKeyDown}>
          {TABS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`job-tab-${key}`}
              aria-selected={active === key}
              aria-controls={`job-tabpanel-${key}`}
              tabIndex={active === key ? 0 : -1}
              onClick={() => onChange(key)}
              className="job-tabs__tab"
            >
              {label}
              {key === 'related' && relatedCount > 0 && <>{' '}<span className="job-tabs__count">{relatedCount}</span></>}
            </button>
          ))}
        </div>
      </div>
      {TABS.map(([key]) => (
        <div key={key} role="tabpanel" id={`job-tabpanel-${key}`} aria-labelledby={`job-tab-${key}`} hidden={active !== key}>
          {panels[key]}
        </div>
      ))}
    </div>
  )
}
