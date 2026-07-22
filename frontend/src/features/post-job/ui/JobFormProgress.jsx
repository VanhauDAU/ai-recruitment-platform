import { CheckOutlined, ExclamationOutlined } from '@ant-design/icons'

function itemHasError(item, invalidFieldNames) {
  return item.errorFields?.some((fieldName) => (
    [...(invalidFieldNames || [])].some((invalidName) => invalidName === fieldName || invalidName.startsWith(`${fieldName}.`))
  ))
}

export default function JobFormProgress({ sections, activeSection, openSections, invalidFieldNames, onSelect }) {
  const completed = sections.reduce((total, item) => total + item.completed, 0)
  const total = sections.reduce((sum, item) => sum + item.total, 0)
  const percent = total ? Math.round((completed / total) * 100) : 0

  return (
    <nav aria-label="Tiến độ tạo tin" className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-extrabold text-slate-900">Nội dung tin</span>
        <span className="text-xs font-bold text-[var(--brand-primary)]">{percent}%</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-[var(--brand-primary)] transition-all" style={{ width: `${percent}%` }} />
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {sections.map((section, index) => {
          const complete = section.total > 0 && section.completed === section.total
          return (
            <li key={section.key}>
              <button
                type="button"
                onClick={() => {
                  onSelect(section.key)
                  requestAnimationFrame(() => document.getElementById(section.key)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
                }}
                aria-current={activeSection === section.key ? 'step' : undefined}
                className={`group block w-full min-w-0 rounded-xl px-2 py-2 text-left text-sm transition ${activeSection === section.key ? 'bg-[var(--brand-primary-soft)] !text-[var(--brand-primary-hover)]' : '!text-slate-600 hover:bg-[var(--brand-primary-soft)] hover:!text-[var(--brand-primary-hover)]'}`}
              >
                <span className="flex items-center gap-3">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${complete ? 'bg-[var(--brand-primary)] text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {complete ? <CheckOutlined /> : index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate whitespace-nowrap font-semibold" title={section.label}>{section.label}</span>
                  {section.total > 0 && <span className="text-[11px] text-slate-400">{section.completed}/{section.total}</span>}
                </span>
                {openSections?.has(section.key) && section.items.length > 0 && (
                  <span className="mt-2 hidden space-y-1 pl-9 xl:block">
                    {section.items.map((item) => {
                      const itemInvalid = itemHasError(item, invalidFieldNames)
                      return (
                      <span key={item.label} className={`flex min-w-0 items-center gap-2 text-[11px] leading-4 ${itemInvalid ? 'text-red-600' : 'text-slate-400'}`}>
                        <span
                          aria-label={itemInvalid ? `${item.label} có lỗi` : undefined}
                          className={`flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full ${itemInvalid ? 'bg-red-50 text-[8px] text-red-600' : item.done ? 'bg-[var(--brand-primary)]' : 'border border-slate-300'}`}
                        >
                          {itemInvalid && <ExclamationOutlined />}
                        </span>
                        <span className="min-w-0 truncate whitespace-nowrap" title={item.label}>{item.label}</span>
                      </span>
                      )
                    })}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
