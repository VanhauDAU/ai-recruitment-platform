import {
  BankOutlined,
  BellOutlined,
  DownOutlined,
  FilterOutlined,
  PushpinOutlined,
  RightOutlined,
  SearchOutlined,
  UpOutlined,
} from '@ant-design/icons'
import { Button, Checkbox, Empty, Input, InputNumber, Pagination, Select, message } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getIndustries, getJobCategories, getJobStats, getJobs } from '../../api/jobService'
import { getProvinces } from '../../api/locationService'
import CategoryPicker from '../../components/job/CategoryPicker'
import JobCard from '../../components/job/JobCard'
import JobCardSkeleton from '../../components/job/JobCardSkeleton'
import LocationFilter from '../../components/job/LocationFilter'
import SearchDropdown, { SEARCH_BY_TABS, saveHistory } from '../../components/ui/SearchDropdown'
import { useHideOnScroll } from '../../hooks/useHideOnScroll'
import {
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_YEARS_LABELS,
  POSITION_LEVEL_LABELS,
  SALARY_RANGES,
  WEEKEND_POLICY_OPTIONS,
  WORK_TYPE_LABELS,
  formatNumber,
} from '../../constants/jobOptions'

const PAGE_SIZE = 20
// Params thuộc sidebar "Lọc nâng cao" — bị xoá bởi nút "Xóa lọc" (giữ search/location).
const FILTER_KEYS = [
  'category', 'work_type', 'employment_type', 'experience_level',
  'salary_gte', 'salary_lte', 'salary_negotiable', 'ordering',
  'weekend_policy', 'experience_years', 'position_level', 'industry',
]
const SAVED_FILTER_KEY = 'saved_job_filter'
const VISIBLE_GROUPS = 6

function parseIdList(values) {
  return values
    .flatMap((value) => String(value || '').split(','))
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0)
}

function getLocationIds(params) {
  return parseIdList([...params.getAll('location'), params.get('locations')])
}

function buildJobParams(params) {
  const next = new URLSearchParams(params)
  const locationIds = getLocationIds(params)
  next.delete('location')
  next.delete('locations')
  locationIds.forEach((id) => next.append('location', id))
  return next
}

function slugifyVietnamese(text = '') {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function shortLocationName(name = '') {
  return name.replace(/^Thành phố |^Tỉnh /, '')
}

function pathForLocation(ids, provinces) {
  if (!ids.length) return '/viec-lam'
  const province = provinces.find((p) => ids.includes(p.id))
  return province ? `/viec-lam/tai/${slugifyVietnamese(shortLocationName(province.name))}` : '/viec-lam'
}

function FilterSection({ title, children }) {
  return (
    <div className="border-t border-dashed border-gray-200 pt-4">
      <h4 className="mb-3 text-[15px] font-semibold text-gray-800">{title}</h4>
      {children}
    </div>
  )
}

// Chip bo tròn — nền tảng cho mọi bộ lọc dạng lựa chọn (tự xuống hàng gọn, không vỡ layout).
function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm transition ${
        active
          ? 'border-[#00b14f] bg-green-50 font-medium text-[#00b14f]'
          : 'border-gray-200 bg-white text-gray-600 hover:border-[#00b14f] hover:text-[#00b14f]'
      }`}
    >
      {children}
    </button>
  )
}

// Chọn 1 (radio): bấm lại chip đang chọn để bỏ. '' = chưa chọn (chip "Tất cả").
function SingleChips({ value, onChange, options, allLabel = 'Tất cả' }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Chip active={!value} onClick={() => onChange('')}>{allLabel}</Chip>
      {options.map(([v, label]) => (
        <Chip key={v} active={value === v} onClick={() => onChange(value === v ? '' : v)}>{label}</Chip>
      ))}
    </div>
  )
}

// Chọn nhiều (checkbox): "Tất cả" xoá hết; mỗi chip toggle độc lập.
function MultiChips({ values, onToggle, onClear, options, allLabel = 'Tất cả' }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Chip active={values.length === 0} onClick={onClear}>{allLabel}</Chip>
      {options.map(([v, label]) => (
        <Chip key={v} active={values.includes(v)} onClick={() => onToggle(v)}>{label}</Chip>
      ))}
    </div>
  )
}

export default function JobList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [demandCounts, setDemandCounts] = useState({})
  const [provinces, setProvinces] = useState([])
  const [data, setData] = useState({ results: [], count: 0 })
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState(searchParams.get('search') || '')
  const [expandedGroups, setExpandedGroups] = useState({})
  const [showAllGroups, setShowAllGroups] = useState(false)
  const [hanoiSuggest, setHanoiSuggest] = useState(null) // { id, count }
  const [salaryFrom, setSalaryFrom] = useState(null) // triệu
  const [salaryTo, setSalaryTo] = useState(null)
  const [industries, setIndustries] = useState([])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const searchBoxRef = useRef(null)

  // Thanh tìm kiếm sticky né header (header tự ẩn khi cuộn xuống); sidebar dính ngay dưới nó.
  const headerVisible = useHideOnScroll()
  const searchTop = headerVisible ? 64 : 0
  const sidebarTop = searchTop + 76

  const page = Number(searchParams.get('page') || 1)
  const selectedLocations = getLocationIds(searchParams)
  const selectedCategories = searchParams.getAll('category').map(Number)
  const searchBy = searchParams.get('search_by') || 'title'
  const ordering = searchParams.get('ordering') || ''

  const groups = useMemo(() => categories.filter((c) => !c.parent), [categories])
  const childrenOf = useMemo(() => {
    const m = {}
    for (const c of categories) if (c.parent) (m[c.parent] ||= []).push(c)
    return m
  }, [categories])

  useEffect(() => {
    getJobCategories().then(setCategories).catch(() => {})
    getJobStats()
      .then((s) => setDemandCounts(Object.fromEntries((s.demand || []).map((d) => [d.id, d.count]))))
      .catch(() => {})
    getProvinces().then(setProvinces).catch(() => {})
    getIndustries().then(setIndustries).catch(() => {})
  }, [])

  useEffect(() => {
    setKeyword(searchParams.get('search') || '')
  }, [searchParams])

  useEffect(() => {
    setLoading(true)
    getJobs(buildJobParams(searchParams))
      .then(setData)
      .catch(() => setData({ results: [], count: 0 }))
      .finally(() => setLoading(false))
  }, [searchParams])

  // Gợi ý "Có N việc làm tại Hà Nội" khi chưa lọc địa điểm (đếm với cùng bộ lọc hiện tại).
  useEffect(() => {
    if (selectedLocations.length || !provinces.length) {
      setHanoiSuggest(null)
      return undefined
    }
    const hn = provinces.find((p) => p.name.includes('Hà Nội'))
    if (!hn) return undefined
    let cancelled = false
    const params = buildJobParams(searchParams)
    params.delete('page')
    params.append('location', hn.id)
    params.set('page_size', '1')
    getJobs(params)
      .then((d) => !cancelled && setHanoiSuggest({ id: hn.id, count: d.count ?? 0 }))
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, provinces])

  // ── URL param helpers ─────────────────────────────────────────────
  function updateParams(entries) {
    const next = new URLSearchParams(searchParams)
    for (const [k, v] of Object.entries(entries)) {
      if (v === undefined || v === null || v === '') next.delete(k)
      else next.set(k, v)
    }
    next.delete('page')
    setSearchParams(next)
  }

  function setListParam(key, ids) {
    const next = new URLSearchParams(searchParams)
    next.delete(key)
    ids.forEach((id) => next.append(key, id))
    next.delete('page')
    setSearchParams(next)
  }

  function setLocationParam(ids) {
    const next = new URLSearchParams(searchParams)
    next.delete('location')
    next.delete('locations')
    if (ids.length) next.set('locations', ids.join(','))
    next.delete('page')
    const pathname = pathForLocation(ids, provinces)
    const query = next.toString()
    navigate(query ? `${pathname}?${query}` : pathname)
  }

  function toggleCategory(id) {
    setListParam(
      'category',
      selectedCategories.includes(id) ? selectedCategories.filter((c) => c !== id) : [...selectedCategories, id],
    )
  }

  // ── Ô tìm kiếm + dropdown (giống trang chủ) ──────────────────────
  function runSearch(kw = keyword, by = searchBy) {
    saveHistory(kw, by)
    setDropdownOpen(false)
    updateParams({ search: kw.trim() || null, search_by: by === 'title' ? null : by })
  }

  function handleDropdownSelect(kw, by = searchBy) {
    setKeyword(kw)
    runSearch(kw, by)
  }

  function toggleExperienceYears(value) {
    const current = searchParams.getAll('experience_years')
    setListParam(
      'experience_years',
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    )
  }

  function clearFilters() {
    const next = new URLSearchParams(searchParams)
    FILTER_KEYS.forEach((k) => next.delete(k))
    next.delete('page')
    setSearchParams(next)
    setSalaryFrom(null)
    setSalaryTo(null)
  }

  function saveFilter() {
    localStorage.setItem(SAVED_FILTER_KEY, searchParams.toString())
    message.success('Đã lưu bộ lọc hiện tại')
  }

  // ── Mức lương: radio bucket / thoả thuận / khoảng tự nhập ─────────
  const gte = searchParams.get('salary_gte') || ''
  const lte = searchParams.get('salary_lte') || ''
  const matchedRange = SALARY_RANGES.find((r) => String(r.gte ?? '') === gte && String(r.lte ?? '') === lte)
  const salaryKey = searchParams.get('salary_negotiable')
    ? 'nego'
    : matchedRange
      ? matchedRange.key
      : gte || lte
        ? 'custom'
        : ''

  function onSalaryChange(key) {
    if (key === 'nego') {
      updateParams({ salary_negotiable: '1', salary_gte: null, salary_lte: null })
      return
    }
    const r = SALARY_RANGES.find((x) => x.key === key)
    updateParams({ salary_negotiable: null, salary_gte: r?.gte ?? null, salary_lte: r?.lte ?? null })
  }

  function applyCustomSalary() {
    updateParams({
      salary_negotiable: null,
      salary_gte: salaryFrom ? salaryFrom * 1_000_000 : null,
      salary_lte: salaryTo ? salaryTo * 1_000_000 : null,
    })
  }

  const results = Array.isArray(data) ? data : data.results || []
  const count = Array.isArray(data) ? data.length : data.count || 0
  const hasFilters = FILTER_KEYS.some((k) => searchParams.has(k))
  // Chuỗi danh mục cha → con cho breadcrumb kiểu TopCV (khi chọn đúng 1 danh mục).
  const catChain = (() => {
    if (selectedCategories.length !== 1) return []
    const byId = Object.fromEntries(categories.map((c) => [c.id, c]))
    const chain = []
    let cur = byId[selectedCategories[0]]
    while (cur) {
      chain.unshift(cur)
      cur = byId[cur.parent]
    }
    return chain
  })()
  const catName = catChain.at(-1)?.name || null
  const contextLabel = searchParams.get('search') || catName || ''
  const visibleGroups = showAllGroups ? groups : groups.slice(0, VISIBLE_GROUPS)

  return (
    <div>
      {/* ── Thanh tìm kiếm nền xanh, sticky né header ── */}
      <div
        style={{ top: searchTop }}
        className="sticky z-20 bg-gradient-to-r from-[#00734d] to-[#00b14f] transition-[top] duration-300"
      >
        <div className="max-w-6xl mx-auto flex flex-col gap-2 px-4 py-3 md:flex-row">
          <div className="md:w-64 [&_button]:!h-11 [&_button]:!rounded-lg">
            <CategoryPicker
              categories={categories}
              value={selectedCategories}
              onChange={(ids) => setListParam('category', ids)}
            />
          </div>
          <div ref={searchBoxRef} className="relative flex flex-1 flex-col gap-2 md:flex-row">
            <Input
              size="large"
              placeholder="Vị trí tuyển dụng, tên công ty"
              prefix={<SearchOutlined className="text-gray-400" />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onFocus={() => setDropdownOpen(true)}
              onPressEnter={() => runSearch()}
              allowClear
              className="flex-1 !h-11 !rounded-lg"
            />
            <div className="md:w-72 [&>button]:!h-11 [&>button]:!rounded-lg">
              <LocationFilter value={selectedLocations} onChange={setLocationParam} size="large" />
            </div>
            <Button
              type="primary"
              size="large"
              onClick={() => runSearch()}
              className="!h-11 !rounded-lg !px-8 !font-bold !bg-[#00b14f] hover:!bg-[#009944]"
            >
              Tìm kiếm
            </Button>
            <SearchDropdown
              open={dropdownOpen}
              onClose={() => setDropdownOpen(false)}
              onSelect={handleDropdownSelect}
              keyword={keyword}
              searchBy={searchBy}
              onSearchByChange={(by) => updateParams({ search_by: by === 'title' ? null : by })}
              wrapperRef={searchBoxRef}
            />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-5">
        {/* ── Heading + breadcrumb + nút thông báo ── */}
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              Tuyển dụng <span className="text-[#00b14f]">{loading ? '…' : formatNumber(count)} việc làm</span>
              {contextLabel && ` ${contextLabel}`}
              <span className="ml-2 text-sm font-normal text-gray-400">
                [Update {new Date().toLocaleDateString('vi-VN')}]
              </span>
            </h1>
            <nav className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-gray-500">
              <Link to="/" className="hover:text-[#00b14f]">Trang chủ</Link>
              <RightOutlined className="text-[10px] text-gray-300" />
              {catChain.length === 0 ? (
                <span>Việc làm</span>
              ) : (
                catChain.map((c, i) => (
                  <span key={c.id} className="flex items-center gap-1.5">
                    {i > 0 && <RightOutlined className="text-[10px] text-gray-300" />}
                    {i < catChain.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setListParam('category', [c.id])}
                        className="cursor-pointer hover:text-[#00b14f]"
                      >
                        {i === 0 ? `Việc làm ${c.name}` : c.name}
                      </button>
                    ) : (
                      <span className="text-gray-700">{i === 0 ? `Việc làm ${c.name}` : c.name}</span>
                    )}
                  </span>
                ))
              )}
            </nav>
          </div>
          <span
            title="Sắp ra mắt"
            className="inline-flex w-fit shrink-0 cursor-not-allowed items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600"
          >
            <BellOutlined /> Tạo thông báo việc làm
          </span>
        </div>

        {/* ── Gợi ý địa điểm ── */}
        {hanoiSuggest?.count > 0 && (
          <button
            type="button"
            onClick={() => setListParam('location', [hanoiSuggest.id])}
            className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm transition hover:border-[#00b14f]"
          >
            Có <b>{formatNumber(hanoiSuggest.count)}</b> việc làm tại Hà Nội.
            <span className="font-semibold text-[#00b14f]">Xem ngay →</span>
          </button>
        )}

        <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-4">
          {/* ── Sidebar lọc nâng cao: dính viewport, có thanh cuộn riêng khi dài hơn màn hình ── */}
          <aside
            style={{ '--sb-top': `${sidebarTop}px` }}
            className="filter-sidebar rounded-xl border border-gray-200 bg-white p-4 transition-[top] duration-300 lg:sticky lg:top-[var(--sb-top)] lg:max-h-[calc(100vh-var(--sb-top)-1rem)] lg:overflow-y-scroll"
          >
            <style>{`
              .filter-sidebar { scrollbar-width: thin; scrollbar-color: transparent transparent; }
              .filter-sidebar:hover { scrollbar-color: #d1d5db transparent; }
              .filter-sidebar::-webkit-scrollbar { width: 4px; }
              .filter-sidebar::-webkit-scrollbar-thumb { background: transparent; border-radius: 99px; transition: background 0.2s; }
              .filter-sidebar:hover::-webkit-scrollbar-thumb { background: #d1d5db; }
              .filter-sidebar::-webkit-scrollbar-track { background: transparent; }
            `}</style>
            <div className="mb-4 flex items-center gap-2">
              <FilterOutlined className="text-[#00b14f]" />
              <span className="text-base font-bold text-gray-900">Lọc nâng cao</span>
            </div>

            <FilterSection
              title={
                <span className="inline-flex items-center gap-1.5">
                  Nghỉ thứ 7
                  <span className="rounded-full bg-gradient-to-r from-[#00b14f] to-teal-400 px-2 py-0.5 text-[10px] font-bold text-white">
                    AI ✦
                  </span>
                </span>
              }
            >
              <SingleChips
                value={searchParams.get('weekend_policy') || ''}
                onChange={(v) => updateParams({ weekend_policy: v })}
                options={WEEKEND_POLICY_OPTIONS}
                allLabel="Không lọc"
              />
            </FilterSection>

            <div className="mt-4" />
            <FilterSection title="Theo danh mục nghề">
              <div className="space-y-2">
                {visibleGroups.map((g) => {
                  const kids = childrenOf[g.id] || []
                  const open = expandedGroups[g.id]
                  return (
                    <div key={g.id}>
                      <div className="flex items-center justify-between gap-1">
                        <Checkbox
                          checked={selectedCategories.includes(g.id)}
                          onChange={() => toggleCategory(g.id)}
                          className="min-w-0 flex-1 [&_span:last-child]:!pr-0"
                        >
                          <span className="text-sm text-gray-700">
                            {g.name}
                            {demandCounts[g.id] != null && (
                              <span className="ml-1 text-xs text-gray-400">({formatNumber(demandCounts[g.id])})</span>
                            )}
                          </span>
                        </Checkbox>
                        {kids.length > 0 && (
                          <button
                            type="button"
                            aria-label={open ? 'Thu gọn' : 'Mở rộng'}
                            onClick={() => setExpandedGroups((prev) => ({ ...prev, [g.id]: !open }))}
                            className="shrink-0 cursor-pointer p-1 text-gray-400 hover:text-[#00b14f]"
                          >
                            {open ? <UpOutlined className="text-[10px]" /> : <DownOutlined className="text-[10px]" />}
                          </button>
                        )}
                      </div>
                      {open && (
                        <div className="mt-1.5 ml-6 space-y-1.5">
                          {kids.map((c) => (
                            <Checkbox
                              key={c.id}
                              checked={selectedCategories.includes(c.id)}
                              onChange={() => toggleCategory(c.id)}
                              className="!flex"
                            >
                              <span className="text-sm text-gray-600">{c.name}</span>
                            </Checkbox>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                {groups.length > VISIBLE_GROUPS && (
                  <button
                    type="button"
                    onClick={() => setShowAllGroups(!showAllGroups)}
                    className="cursor-pointer text-sm font-medium text-[#00b14f] hover:text-[#008a3e]"
                  >
                    {showAllGroups ? 'Thu gọn' : `Xem thêm (${groups.length - VISIBLE_GROUPS})`}
                  </button>
                )}
              </div>
            </FilterSection>

            <div className="mt-4">
              <FilterSection title="Kinh nghiệm">
                <MultiChips
                  values={searchParams.getAll('experience_years')}
                  onToggle={toggleExperienceYears}
                  onClear={() => setListParam('experience_years', [])}
                  options={Object.entries(EXPERIENCE_YEARS_LABELS)}
                />
              </FilterSection>
            </div>

            <div className="mt-4">
              <FilterSection title="Lĩnh vực công ty">
                <Select
                  className="w-full"
                  allowClear
                  showSearch
                  placeholder="Tất cả lĩnh vực"
                  suffixIcon={<BankOutlined className="text-gray-400" />}
                  value={searchParams.get('industry') || undefined}
                  onChange={(v) => updateParams({ industry: v })}
                  options={industries.map((name) => ({ value: name, label: name }))}
                />
              </FilterSection>
            </div>

            <div className="mt-4">
              <FilterSection title="Mức lương">
                <SingleChips
                  value={salaryKey === 'custom' ? '' : salaryKey}
                  onChange={onSalaryChange}
                  options={[...SALARY_RANGES.map((r) => [r.key, r.label]), ['nego', 'Thoả thuận']]}
                />
                <div className="mt-3 flex items-center gap-2">
                  <InputNumber min={0} placeholder="Từ" value={salaryFrom} onChange={setSalaryFrom} className="!w-full" controls={false} />
                  <span className="text-gray-400">-</span>
                  <InputNumber min={0} placeholder="Đến" value={salaryTo} onChange={setSalaryTo} className="!w-full" controls={false} />
                  <span className="text-sm text-gray-500">triệu</span>
                </div>
                <Button
                  block
                  disabled={!salaryFrom && !salaryTo}
                  onClick={applyCustomSalary}
                  className="mt-2 !rounded-full"
                >
                  Áp dụng
                </Button>
              </FilterSection>
            </div>

            <div className="mt-4">
              <FilterSection title="Cấp bậc">
                <SingleChips
                  value={searchParams.get('position_level') || ''}
                  onChange={(v) => updateParams({ position_level: v })}
                  options={Object.entries(POSITION_LEVEL_LABELS)}
                />
              </FilterSection>
            </div>

            <div className="mt-4">
              <FilterSection title="Hình thức làm việc">
                <SingleChips
                  value={searchParams.get('work_type') || ''}
                  onChange={(v) => updateParams({ work_type: v })}
                  options={Object.entries(WORK_TYPE_LABELS)}
                />
              </FilterSection>
            </div>

            <div className="mt-4">
              <FilterSection title="Loại hình làm việc">
                <SingleChips
                  value={searchParams.get('employment_type') || ''}
                  onChange={(v) => updateParams({ employment_type: v })}
                  options={Object.entries(EMPLOYMENT_TYPE_LABELS)}
                />
              </FilterSection>
            </div>

            {/* Thanh hành động dính đáy sidebar (như TopCV) — luôn thấy khi cuộn bộ lọc. */}
            <div className="sticky bottom-0 -mx-4 -mb-4 mt-5 flex gap-2 border-t border-gray-100 bg-white px-4 py-3">
              <Button block disabled={!hasFilters} onClick={clearFilters} className="!rounded-full">
                Xóa lọc
              </Button>
              <Button
                block
                icon={<PushpinOutlined />}
                onClick={saveFilter}
                className="!rounded-full !border-[#00b14f] !text-[#00b14f] hover:!bg-green-50"
              >
                Lưu bộ lọc
              </Button>
            </div>
          </aside>

          {/* ── Danh sách việc làm ── */}
          <div className="lg:col-span-3">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-500">Tìm kiếm theo:</span>
                {SEARCH_BY_TABS.map((tab) => {
                  const active = searchBy === tab.key
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => updateParams({ search_by: tab.key === 'title' ? null : tab.key })}
                      className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                        active
                          ? 'border-[#00b14f] bg-green-50 text-[#00b14f]'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-[#00b14f] hover:text-[#00b14f]'
                      }`}
                    >
                      {active && '✓ '}
                      {tab.label}
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-sm text-gray-500">Sắp xếp theo:</span>
                <Select
                  value={ordering}
                  onChange={(v) => updateParams({ ordering: v })}
                  className="w-40"
                  options={[
                    { value: '', label: 'Mới nhất' },
                    { value: 'salary_desc', label: 'Lương cao nhất' },
                  ]}
                />
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <JobCardSkeleton key={i} />
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white py-16">
                <Empty description="Không tìm thấy việc làm phù hợp" />
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((job) => (
                  <JobCard key={job.public_id} job={job} />
                ))}
              </div>
            )}

            {count > PAGE_SIZE && (
              <div className="mt-6 flex justify-center">
                <Pagination
                  current={page}
                  pageSize={PAGE_SIZE}
                  total={count}
                  onChange={(p) => {
                    const next = new URLSearchParams(searchParams)
                    next.set('page', p)
                    setSearchParams(next)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  showSizeChanger={false}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
