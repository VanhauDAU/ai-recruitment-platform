import { CheckOutlined, ClockCircleOutlined, CloseOutlined, FireOutlined, SearchOutlined } from '@ant-design/icons'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { getJobSuggestions, getJobs } from '../../api/jobService'
import { companyInitial, formatNumber, formatSalary } from '../../constants/jobOptions'
import useDebouncedValue from '../../hooks/useDebouncedValue'

const HISTORY_KEY = 'search_history'
const MAX_HISTORY = 8

export const SEARCH_BY_TABS = [
  { key: 'title', label: 'Tên việc làm' },
  { key: 'company', label: 'Tên công ty' },
  { key: 'both', label: 'Cả hai' },
]

const MIN_SUGGESTED = 6
const MAX_KEYWORD_SUGGESTIONS = 8

// History entries: { q: string, by: 'title'|'company'|'both', count: number|null }.
// Tolerate the legacy plain-string format by normalising on read.
function getHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    return raw.map((e) => (typeof e === 'string' ? { q: e, by: 'title', count: null } : e)).filter((e) => e?.q)
  } catch {
    return []
  }
}

// Persist a search immediately, then backfill its result count ("N việc làm").
// Writing first makes it survive an immediate navigation; the count updates async.
export function saveHistory(keyword, by = 'title') {
  const q = (keyword || '').trim()
  if (!q) return
  const rest = getHistory().filter((e) => !(e.q === q && e.by === by))
  localStorage.setItem(HISTORY_KEY, JSON.stringify([{ q, by, count: null }, ...rest].slice(0, MAX_HISTORY)))

  const params = { search: q, page_size: 1 }
  if (by !== 'title') params.search_by = by
  getJobs(params)
    .then((data) => {
      const list = getHistory()
      const idx = list.findIndex((e) => e.q === q && e.by === by)
      if (idx === -1) return
      list[idx] = { ...list[idx], count: data.count ?? null }
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list))
    })
    .catch(() => {})
}

function removeHistory(entry) {
  const updated = getHistory().filter((e) => !(e.q === entry.q && e.by === entry.by))
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
}

// Highlights the matched query substring in a suggestion (matched = đậm, phần còn lại = nhạt).
function Highlight({ text, query }) {
  const i = text.toLowerCase().indexOf(query.toLowerCase())
  if (i === -1) return <span className="text-gray-500">{text}</span>
  return (
    <>
      <span className="text-gray-400">{text.slice(0, i)}</span>
      <span className="font-semibold text-gray-800">{text.slice(i, i + query.length)}</span>
      <span className="text-gray-400">{text.slice(i + query.length)}</span>
    </>
  )
}

/**
 * SearchDropdown — rich search panel shown when the hero search input is focused.
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - onSelect: (keyword, searchBy) => void  — user picked a recent keyword
 *  - keyword                               — current search input, used to build dynamic keyword suggestions
 *  - searchBy, onSearchByChange              — the "Tìm kiếm theo" tab (controlled by parent)
 *  - wrapperRef: ref of the search box container (click-outside detection)
 */
export default function SearchDropdown({
  open,
  onClose,
  onSelect,
  keyword = '',
  searchBy = 'title',
  onSearchByChange,
  wrapperRef,
}) {
  const navigate = useNavigate()
  const [history, setHistory] = useState([])
  const [keywordSuggestions, setKeywordSuggestions] = useState([])
  const [suggested, setSuggested] = useState([])
  const [loading, setLoading] = useState(true)
  const [rect, setRect] = useState(null)
  const dropdownRef = useRef(null)
  const debouncedKeyword = useDebouncedValue(keyword, 250)

  // Render in a portal on <body> so the panel escapes the hero header's stacking
  // context (isolation:isolate + overflow:hidden) — otherwise it gets clipped and
  // painted below the next section. Position is tracked from the search box.
  useEffect(() => {
    if (!open) return undefined
    function update() {
      if (wrapperRef?.current) setRect(wrapperRef.current.getBoundingClientRect())
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, wrapperRef])

  // "Jobs you might like" — follows the typed text (else the latest search, else newest),
  // then tops up with newest jobs so the list is always ≥ 5.
  useEffect(() => {
    if (!open) return undefined
    const hist = getHistory()
    setHistory(hist)

    let cancelled = false
    setLoading(true)
    const q = debouncedKeyword.trim()
    const base = q ? { search: q, by: searchBy } : hist[0] ? { search: hist[0].q, by: hist[0].by } : null

    async function load() {
      let results = []
      try {
        if (base) {
          const params = { page_size: 8, search: base.search }
          if (base.by !== 'title') params.search_by = base.by
          const data = await getJobs(params)
          results = data.results || data
        }
        if (results.length < MIN_SUGGESTED) {
          const seen = new Set(results.map((j) => j.public_id))
          const newest = await getJobs({ page_size: MIN_SUGGESTED + 3 })
          for (const job of newest.results || newest) {
            if (results.length >= MIN_SUGGESTED) break
            if (!seen.has(job.public_id)) results.push(job)
          }
        }
      } catch {
        results = []
      }
      if (!cancelled) {
        setSuggested(results.slice(0, MIN_SUGGESTED))
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [open, debouncedKeyword, searchBy])

  // Keyword autocomplete from the backend, driven by the typed text (not a fixed list).
  useEffect(() => {
    if (!open) return undefined
    const q = debouncedKeyword.trim()
    if (!q) {
      setKeywordSuggestions([])
      return undefined
    }
    let cancelled = false
    getJobSuggestions(q, searchBy)
      .then((list) => !cancelled && setKeywordSuggestions(list.slice(0, MAX_KEYWORD_SUGGESTIONS)))
      .catch(() => !cancelled && setKeywordSuggestions([]))
    return () => {
      cancelled = true
    }
  }, [open, debouncedKeyword, searchBy])

  // Click outside → close.
  useEffect(() => {
    if (!open) return undefined
    function handleClick(e) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        wrapperRef?.current && !wrapperRef.current.contains(e.target)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, onClose, wrapperRef])

  if (!open || !rect) return null

  function handleRemove(e, entry) {
    e.stopPropagation()
    removeHistory(entry)
    setHistory(getHistory())
  }

  function clearAll(e) {
    e.stopPropagation()
    localStorage.removeItem(HISTORY_KEY)
    setHistory([])
  }

  return createPortal(
    <div
      ref={dropdownRef}
      className="fixed z-[100] rounded-2xl border border-gray-100 bg-white text-left shadow-2xl shadow-black/10 overflow-hidden"
      style={{ left: rect.left, top: rect.bottom + 8, width: rect.width, animation: 'dropdownFadeIn 0.18s ease both' }}
    >
      <style>{`@keyframes dropdownFadeIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div className="flex flex-col md:flex-row md:divide-x divide-gray-100">
        {/* ── Left: search-by tabs + recent keywords ── */}
        <div className="w-full md:w-[420px] shrink-0 p-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="shrink-0 text-sm text-gray-500">Tìm kiếm theo:</span>
            {SEARCH_BY_TABS.map((tab) => {
              const active = searchBy === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onSearchByChange?.(tab.key)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                    active
                      ? 'border-[#00b14f] bg-green-50 text-[#00b14f]'
                      : 'border-gray-200 text-gray-600 hover:border-[#00b14f] hover:text-[#00b14f]'
                  }`}
                >
                  {active && <CheckOutlined className="text-[10px]" />}
                  {tab.label}
                </button>
              )
            })}
          </div>

          {keywordSuggestions.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Từ khóa gợi ý</p>
              <ul>
                {keywordSuggestions.map((kw) => (
                  <li key={kw}>
                    <button
                      type="button"
                      onClick={() => onSelect(kw, searchBy)}
                      className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-green-50 cursor-pointer"
                    >
                      <SearchOutlined className="shrink-0 text-gray-300 group-hover:text-[#00b14f]" />
                      <span className="truncate">
                        <Highlight text={kw} query={keyword.trim()} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {history.length > 0 && (
            <>
              <div className="mt-4 mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Từ khóa tìm kiếm gần đây
                </span>
                <button onClick={clearAll} className="text-xs font-medium text-[#00b14f] hover:text-[#008a3e] cursor-pointer">
                  Xóa tất cả
                </button>
              </div>
              <ul className="space-y-0.5">
                {history.map((e) => (
                  <li key={`${e.q}-${e.by}`}>
                    <button
                      onClick={() => onSelect(e.q, e.by)}
                      className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <ClockCircleOutlined className="shrink-0 text-gray-300" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-gray-700">{e.q}</span>
                        {e.count > 0 && (
                          <span className="block text-xs text-[#00b14f]">{formatNumber(e.count)} việc làm</span>
                        )}
                      </span>
                      <span
                        role="button"
                        tabIndex={-1}
                        onClick={(ev) => handleRemove(ev, e)}
                        className="shrink-0 rounded p-0.5 text-gray-300 opacity-0 transition-all hover:text-gray-500 group-hover:opacity-100 cursor-pointer"
                      >
                        <CloseOutlined className="text-[10px]" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* ── Right: jobs you might like ── */}
        <div className="min-w-0 flex-1 p-4">
          <div className="mb-3 flex items-center gap-1.5">
            <FireOutlined className="text-orange-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Việc làm có thể bạn quan tâm
            </span>
          </div>

          {loading ? (
            <ul className="space-y-1">
              {Array.from({ length: MIN_SUGGESTED }).map((_, i) => (
                <li key={i} className="h-[54px] rounded-lg bg-gray-50 animate-pulse" />
              ))}
            </ul>
          ) : suggested.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">Chưa có việc làm phù hợp.</p>
          ) : (
            <ul className="space-y-1">
              {suggested.map((job) => (
                <li key={job.public_id}>
                  <button
                    onClick={() => {
                      onClose()
                      navigate(`/viec-lam/${job.slug}`)
                    }}
                    className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100 text-sm font-bold text-[#00b14f] ring-1 ring-emerald-100">
                      {companyInitial(job.company_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800 group-hover:text-[#00b14f] transition-colors">
                        {job.title}
                      </p>
                      <p className="truncate text-xs text-gray-400">{job.company_name}</p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-[#00b14f]">{formatSalary(job)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
