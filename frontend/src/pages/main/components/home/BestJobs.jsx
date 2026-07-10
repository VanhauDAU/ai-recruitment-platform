import {
  BulbOutlined,
  CloseOutlined,
  DownOutlined,
  FilterOutlined,
  HeartFilled,
  HeartOutlined,
} from '@ant-design/icons'
import { Dropdown, Skeleton } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getJobs } from '../../../../api/jobService'
import { getProvinces, getWards } from '../../../../api/locationService'
import {
  SALARY_RANGES,
  formatLocations,
  formatSalary,
  stripCompanyPrefix,
} from '../../../../constants/jobOptions'
import ArrowButton from '../../../../components/ui/ArrowButton'
import JobPreviewPanel from './JobPreviewPanel'

const PAGE_SIZE = 12
const ROTATE_MS = 8000
const PREVIEW_DELAY_MS = 500
const LOCATION_CHIP_LIMIT = 15
const OTHER_WARDS_VALUE = '__other_wards__'

const DIMENSIONS = [
  { key: 'location', label: 'Địa điểm' },
  { key: 'salary', label: 'Mức lương' },
  { key: 'experience', label: 'Kinh nghiệm' },
  { key: 'category', label: 'Ngành nghề' },
]

// Deterministic pastel logo tints (bg / text), keyed off the company name.
const LOGO_TINTS = [
  ['#e6f0ff', '#2563eb'],
  ['#eafaf1', '#16a34a'],
  ['#fff1e6', '#ea580c'],
  ['#fdeaf1', '#db2777'],
  ['#f0edfb', '#7c3aed'],
  ['#fff7e0', '#ca8a04'],
]

const shortProvince = (name = '') => name.replace(/^Thành phố |^Tỉnh /, '')
const shortWard = (name = '') => name.replace(/^Phường |^Xã |^Đặc khu /, '')

const EXPERIENCE_FILTER_OPTIONS = [
  { value: null, label: 'Tất cả' },
  { value: 'intern', label: 'Chưa có kinh nghiệm' },
  { value: 'fresher', label: '1 năm trở xuống' },
  { value: 'junior', label: '1 năm' },
  { value: 'middle', label: '2 năm' },
  { value: 'senior', label: '3 năm' },
  { value: 'four_to_five', label: 'Từ 4 - 5 năm', apiValue: 'senior' },
  { value: 'over_five', label: 'Trên 5 năm', apiValue: 'senior' },
]

const PRIORITY_PROVINCES = ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ']
const EMPTY_FILTERS = { location: null, salary: null, experience: null, category: null }

export default function BestJobs({ categories = [] }) {
  const navigate = useNavigate()
  const [dimension, setDimension] = useState('location')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [provinces, setProvinces] = useState([])
  const [featuredWards, setFeaturedWards] = useState([])
  const [jobs, setJobs] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [animKey, setAnimKey] = useState(0)
  const [paused, setPaused] = useState(false)
  const [showHint, setShowHint] = useState(true)
  const [saved, setSaved] = useState(() => new Set())
  const [previewJobId, setPreviewJobId] = useState(null)
  const [previewAnchor, setPreviewAnchor] = useState(null)
  const chipStrip = useRef(null)
  const dragState = useRef({ active: false, startX: 0, scrollLeft: 0, dragged: false, suppressClickUntil: 0 })
  const previewTimer = useRef(null)
  const previewCloseTimer = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function loadLocations() {
      try {
        const provinceData = await getProvinces()
        if (cancelled) return
        setProvinces(provinceData)

        const priority = [
          ...PRIORITY_PROVINCES.map((name) => provinceData.find((p) => p.name.includes(name))).filter(Boolean),
          ...provinceData,
        ]
        const uniquePriority = Array.from(new Map(priority.map((p) => [p.id, p])).values()).slice(0, 5)
        const wardGroups = await Promise.all(uniquePriority.map((p) => getWards(p.id).catch(() => [])))
        if (!cancelled) setFeaturedWards(wardGroups.flat().slice(0, LOCATION_CHIP_LIMIT))
      } catch {
        if (!cancelled) {
          setProvinces([])
          setFeaturedWards([])
        }
      }
    }

    loadLocations()
    return () => {
      cancelled = true
    }
  }, [])

  const parents = useMemo(() => categories.filter((c) => c.parent == null), [categories])

  // Chip options for the active filter dimension.
  const chips = useMemo(() => {
    if (dimension === 'location') {
      const provinceChips = provinces.slice(0, 8).map((p) => ({ value: p.id, label: shortProvince(p.name) }))
      const provinceById = new Map(provinces.map((p) => [p.id, p]))
      const wardChips = featuredWards.map((w) => {
        const province = provinceById.get(w.parent)
        return {
          value: w.id,
          label: province ? `${shortWard(w.name)}, ${shortProvince(province.name)}` : shortWard(w.name),
        }
      })
      const locationChips = [...provinceChips, ...wardChips].slice(0, LOCATION_CHIP_LIMIT)
      return [
        { value: null, label: 'Tất cả' },
        ...locationChips,
        { value: OTHER_WARDS_VALUE, label: 'Các phường/xã còn lại', action: 'openLocations' },
      ]
    }
    if (dimension === 'salary')
      return [
        { value: null, label: 'Tất cả' },
        ...SALARY_RANGES.map((r) => ({ value: r.key, label: r.label })),
        { value: 'negotiable', label: 'Thỏa thuận' },
      ]
    if (dimension === 'experience') return EXPERIENCE_FILTER_OPTIONS
    return [{ value: null, label: 'Tất cả' }, ...parents.map((c) => ({ value: c.id, label: c.name }))]
  }, [dimension, provinces, featuredWards, parents])

  const activeChip = filters[dimension]
  const {
    location: locationFilter,
    salary: salaryFilter,
    experience: experienceFilter,
    category: categoryFilter,
  } = filters

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', page)
    params.set('page_size', PAGE_SIZE)
    if (locationFilter) params.append('location', locationFilter)
    if (categoryFilter) params.append('category', categoryFilter)
    if (experienceFilter) {
      const option = EXPERIENCE_FILTER_OPTIONS.find((x) => x.value === experienceFilter)
      params.set('experience_level', option?.apiValue || experienceFilter)
    }
    if (salaryFilter === 'negotiable') {
      params.set('salary_negotiable', '1')
    } else if (salaryFilter) {
      params.set('salary_bucket', salaryFilter)
    }
    getJobs(params)
      .then((data) => {
        setJobs(data.results || data)
        setCount(data.count ?? (data.results || data).length)
        setAnimKey((k) => k + 1)
      })
      .catch(() => {
        setJobs([])
        setCount(0)
      })
      .finally(() => setLoading(false))
  }, [categoryFilter, experienceFilter, locationFilter, page, salaryFilter])

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  // Auto-advance pages with a smooth fade; pause on hover.
  useEffect(() => {
    if (paused || totalPages <= 1) return
    const timer = setInterval(() => setPage((p) => (p % totalPages) + 1), ROTATE_MS)
    return () => clearInterval(timer)
  }, [paused, totalPages])

  useEffect(() => () => {
    clearTimeout(previewTimer.current)
    clearTimeout(previewCloseTimer.current)
  }, [])

  function pickDimension(key) {
    setDimension(key)
    setFilters(EMPTY_FILTERS)
    setPage(1)
    chipStrip.current?.scrollTo({ left: 0, behavior: 'smooth' })
  }

  function toggleChip(chip) {
    if (chip.action === 'openLocations') {
      navigate('/viec-lam')
      return
    }
    setFilters((f) => ({ ...EMPTY_FILTERS, [dimension]: f[dimension] === chip.value ? null : chip.value }))
    setPage(1)
  }

  function scrollChips(dir) {
    const node = chipStrip.current
    if (!node) return
    node.scrollTo({ left: dir < 0 ? 0 : node.scrollWidth - node.clientWidth, behavior: 'smooth' })
  }

  function startChipDrag(e) {
    const node = chipStrip.current
    if (!node) return
    dragState.current = {
      ...dragState.current,
      active: true,
      startX: e.clientX,
      scrollLeft: node.scrollLeft,
      dragged: false,
    }
  }

  function moveChipDrag(e) {
    const node = chipStrip.current
    if (!node || !dragState.current.active) return
    const delta = e.clientX - dragState.current.startX
    if (Math.abs(delta) > 4) dragState.current.dragged = true
    node.scrollLeft = dragState.current.scrollLeft - delta
  }

  function endChipDrag() {
    const dragged = dragState.current.dragged
    dragState.current = {
      ...dragState.current,
      active: false,
      dragged: false,
      suppressClickUntil: dragged ? Date.now() + 140 : 0,
    }
  }

  function toggleSave(e, id) {
    e.preventDefault()
    e.stopPropagation()
    setSaved((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function showPreviewAfterDelay(jobId, anchorRect) {
    clearTimeout(previewTimer.current)
    clearTimeout(previewCloseTimer.current)
    setPreviewAnchor(anchorRect)
    previewTimer.current = setTimeout(() => {
      setPreviewAnchor(anchorRect)
      setPreviewJobId(jobId)
    }, PREVIEW_DELAY_MS)
  }

  function cancelPreviewDelay() {
    clearTimeout(previewTimer.current)
  }

  function schedulePreviewClose() {
    clearTimeout(previewCloseTimer.current)
    previewCloseTimer.current = setTimeout(() => setPreviewJobId(null), 160)
  }

  function keepPreviewOpen() {
    clearTimeout(previewCloseTimer.current)
  }

  function closePreview() {
    clearTimeout(previewTimer.current)
    clearTimeout(previewCloseTimer.current)
    setPreviewJobId(null)
  }

  const dimLabel = DIMENSIONS.find((d) => d.key === dimension)?.label
  const activeFilterCount = Object.values(filters).filter(Boolean).length
  const goPrev = () => setPage((p) => Math.max(1, p - 1))
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1))

  return (
    <div
      className="rounded-xl border border-gray-200 bg-white p-4 md:p-5 shadow-sm"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg md:text-xl font-bold text-gray-800">Việc làm tốt nhất</h2>
        <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-[var(--brand-primary)]">
          <BulbOutlined /> Gợi ý bởi AI
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => navigate('/viec-lam')} className="text-sm text-[var(--brand-primary)] hover:underline cursor-pointer">
            Xem tất cả
          </button>
          <ArrowButton dir="left" disabled={page <= 1} onClick={goPrev} />
          <ArrowButton dir="right" disabled={page >= totalPages} onClick={goNext} />
        </div>
      </div>

      {/* Filter bar: dimension picker + horizontal chip strip */}
      <div className="flex items-center gap-2 mb-3">
        <Dropdown
          trigger={['click']}
          menu={{
            items: DIMENSIONS.map((d) => ({ key: d.key, label: d.label })),
            onClick: ({ key }) => pickDimension(key),
            selectedKeys: [dimension],
          }}
        >
          <button className="flex shrink-0 items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 h-8 text-sm text-gray-600 cursor-pointer hover:border-[var(--brand-primary)]">
            <FilterOutlined className="text-gray-400" />
            <span className="hidden sm:inline">Lọc theo:</span>
            <span className="font-medium text-[var(--brand-primary)]">{dimLabel}</span>
            {activeFilterCount > 0 && (
              <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand-primary)] px-1 text-[10px] font-semibold text-white">
                {activeFilterCount}
              </span>
            )}
            <DownOutlined className="text-[10px] text-gray-400" />
          </button>
        </Dropdown>

        <ArrowButton dir="left" onClick={() => scrollChips(-1)} />
        <div
          ref={chipStrip}
          onPointerDown={startChipDrag}
          onPointerMove={moveChipDrag}
          onPointerUp={endChipDrag}
          onPointerCancel={endChipDrag}
          className="flex-1 flex items-center gap-2 overflow-x-auto scroll-smooth cursor-grab active:cursor-grabbing select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {chips.length === 0 ? (
            <span className="text-sm text-gray-400">Đang tải…</span>
          ) : (
            chips.map((c) => {
              const active = activeChip === c.value
              return (
                <button
                  key={`${c.value ?? 'all'}-${c.label}`}
                  onClick={() => {
                    if (Date.now() < dragState.current.suppressClickUntil) return
                    toggleChip(c)
                  }}
                  className={`shrink-0 rounded-full border px-4 h-8 text-sm whitespace-nowrap transition cursor-pointer ${
                    active
                      ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]'
                  }`}
                >
                  {c.label}
                </button>
              )
            })
          )}
        </div>
        <ArrowButton dir="right" onClick={() => scrollChips(1)} />
      </div>

      {/* Hint banner */}
      {showHint && (
        <div className="flex items-center gap-2 rounded-md border border-[#c3ebd5] bg-[var(--brand-primary-soft)] px-3 py-2 mb-3 text-sm text-gray-600">
          <BulbOutlined className="text-[var(--brand-primary)]" />
          <span className="flex-1">Gợi ý: Di chuột vào tiêu đề việc làm để xem thêm thông tin chi tiết</span>
          <CloseOutlined className="cursor-pointer text-gray-400 hover:text-gray-600" onClick={() => setShowHint(false)} />
        </div>
      )}

      {/* Job grid */}
      {loading && jobs.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <div key={i} className="rounded-lg border border-gray-200 p-3">
              <Skeleton avatar active paragraph={{ rows: 2 }} />
            </div>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <p className="py-10 text-center text-gray-500">Không tìm thấy việc làm phù hợp với bộ lọc.</p>
      ) : (
        <div key={animKey} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-slide">
          {jobs.map((job) => {
            const company = stripCompanyPrefix(job.company_name)
            const [bg, fg] = LOGO_TINTS[company.length % LOGO_TINTS.length]
            const locationLabel = formatLocations(job)
            return (
	              <div
	                key={job.public_id}
	                className="relative"
	                onMouseLeave={schedulePreviewClose}
	              >
                <a
                  href={`/viec-lam/${job.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative flex gap-3 rounded-lg border border-gray-200 p-3 hover:border-[var(--brand-primary)] hover:shadow-md transition"
                >
                  <div
                    className="w-14 h-14 shrink-0 rounded-md border border-gray-100 flex items-center justify-center text-lg font-bold"
                    style={{ background: bg, color: fg }}
                  >
                    {company.charAt(0) || '?'}
                  </div>
                  <div className="min-w-0 flex-1 pr-5">
	                    <h3
	                      onMouseEnter={(e) => showPreviewAfterDelay(job.public_id, e.currentTarget.getBoundingClientRect())}
	                      onMouseLeave={cancelPreviewDelay}
	                      className="font-semibold text-sm text-gray-800 leading-snug line-clamp-2 group-hover:text-[var(--brand-primary)] cursor-pointer"
                    >
                      {job.title}
                    </h3>
                    <p className="text-xs text-gray-500 truncate mt-1">{job.company_name}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{formatSalary(job)}</span>
                      {locationLabel && (
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{locationLabel}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => toggleSave(e, job.public_id)}
                    className="absolute top-3 right-3 text-gray-300 hover:text-[var(--brand-primary)] cursor-pointer"
                    aria-label="Lưu việc làm"
                  >
                    {saved.has(job.public_id) ? <HeartFilled className="text-[var(--brand-primary)]" /> : <HeartOutlined />}
                  </button>
                </a>
                {previewJobId === job.public_id && (
                  <JobPreviewPanel
	                    job={job}
	                    company={company}
	                    logoBg={bg}
	                    logoFg={fg}
	                    anchorRect={previewAnchor}
	                    onMouseEnter={() => {
	                      keepPreviewOpen()
	                      setPreviewJobId(job.public_id)
	                    }}
                    onMouseLeave={closePreview}
                    onViewDetail={() => navigate(`/viec-lam/${job.slug}`)}
                    onApply={() => navigate(`/viec-lam/${job.slug}`)}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Footer pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-5">
          <ArrowButton dir="left" disabled={page <= 1} onClick={goPrev} />
          <span className="text-sm text-gray-500">
            <span className="font-semibold text-[var(--brand-primary)]">{page}</span> / {totalPages} trang
          </span>
          <ArrowButton dir="right" disabled={page >= totalPages} onClick={goNext} />
        </div>
      )}
    </div>
  )
}
