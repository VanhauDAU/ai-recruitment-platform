import { CheckOutlined, ClockCircleOutlined, CloseOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { formatNumber } from '@/entities/job'
import { SEARCH_BY_TABS, clearHistory, getHistory, removeHistoryEntry } from '../model/search-history'

export default function SearchHistorySection({ isOpen, onSearchByChange, onSelect, searchBy }) {
  const [history, setHistory] = useState([])

  useEffect(() => {
    if (isOpen) setHistory(getHistory())
  }, [isOpen])

  function removeEntry(event, entry) {
    event.stopPropagation()
    removeHistoryEntry(entry)
    setHistory(getHistory())
  }

  function clearAll(event) {
    event.stopPropagation()
    clearHistory()
    setHistory([])
  }

  return (
    <div className="w-full shrink-0 p-4 md:w-[420px]">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="shrink-0 text-sm text-gray-500">Tìm kiếm theo:</span>
        {SEARCH_BY_TABS.map((tab) => {
          const active = searchBy === tab.key
          return <button key={tab.key} type="button" onClick={() => onSearchByChange?.(tab.key)} className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ${active ? 'border-[var(--brand-primary)] bg-green-50 text-[var(--brand-primary)]' : 'border-gray-200 text-gray-600 hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]'}`}>{active && <CheckOutlined className="text-[10px]" />}{tab.label}</button>
        })}
      </div>

      {history.length > 0 && <><div className="mb-2 mt-4 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Từ khóa tìm kiếm gần đây</span><button onClick={clearAll} className="cursor-pointer text-xs font-medium text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)]">Xóa tất cả</button></div><ul className="space-y-0.5">{history.map((entry) => <li key={`${entry.q}-${entry.by}`}><button onClick={() => onSelect(entry.q, entry.by)} className="group flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-gray-50"><ClockCircleOutlined className="shrink-0 text-gray-300" /><span className="min-w-0 flex-1"><span className="block truncate text-sm text-gray-700">{entry.q}</span>{entry.count > 0 && <span className="block text-xs text-[var(--brand-primary)]">{formatNumber(entry.count)} việc làm</span>}</span><span role="button" tabIndex={-1} onClick={(event) => removeEntry(event, entry)} className="shrink-0 cursor-pointer rounded p-0.5 text-gray-300 opacity-0 transition-all hover:text-gray-500 group-hover:opacity-100"><CloseOutlined className="text-[10px]" /></span></button></li>)}</ul></>}
    </div>
  )
}
