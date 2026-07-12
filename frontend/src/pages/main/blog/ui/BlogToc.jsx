import { useMemo, useState } from 'react'
import { DownOutlined } from '@ant-design/icons'

// Gắn số thứ tự kiểu 1. / 1.1 cho heading: h2 tăng số chính, h3 tăng số phụ.
function numberToc(toc) {
  let major = 0
  let minor = 0
  return toc.map((item) => {
    if (item.level === 2) {
      major += 1
      minor = 0
      return { ...item, number: `${major}.` }
    }
    minor += 1
    return { ...item, number: `${major}.${minor}` }
  })
}

// Mục lục sinh từ heading của bài: đánh số rõ ràng, bấm cuộn tới mục, thu gọn
// mở rộng bằng animation grid-rows cho mượt.
export default function BlogToc({ toc, collapsible = true, onNavigate }) {
  const [open, setOpen] = useState(true)
  const numbered = useMemo(() => numberToc(toc || []), [toc])
  if (!numbered.length) return null

  function goto(event, id) {
    event.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    onNavigate?.()
  }

  return (
    <nav className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80 sm:rounded-2xl">
      <button
        type="button"
        onClick={() => collapsible && setOpen((v) => !v)}
        className={`flex w-full items-center justify-between px-4 py-3 text-left ${collapsible ? 'cursor-pointer' : 'cursor-default'}`}
        aria-expanded={open}
      >
        <span className="text-sm font-bold text-slate-900">Mục lục</span>
        {collapsible && (
          <DownOutlined
            className={`text-xs text-slate-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <ol className="space-y-1 px-3 pb-3 sm:px-4 sm:pb-4">
            {numbered.map((item) => (
              <li key={item.id} className={item.level === 3 ? 'pl-3 sm:pl-5' : ''}>
                <a
                  href={`#${item.id}`}
                  onClick={(e) => goto(e, item.id)}
                  className="group/toc flex gap-2 rounded-lg px-2 py-1 text-sm leading-6 !text-slate-900 transition-colors duration-200 hover:bg-[var(--brand-primary-soft)] hover:!text-slate-900"
                >
                  <span className={`shrink-0 !text-slate-900 ${item.level === 2 ? 'font-bold' : 'text-xs font-normal leading-6'}`}>
                    {item.number}
                  </span>
                  <span className={item.level === 2 ? 'font-bold' : 'font-normal'}>{item.text}</span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </nav>
  )
}
