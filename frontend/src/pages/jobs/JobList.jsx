import {
  AppstoreOutlined,
  BankOutlined,
  BellOutlined,
  CalendarOutlined,
  CloseOutlined,
  DollarOutlined,
  DownOutlined,
  FieldTimeOutlined,
  FilterOutlined,
  InfoCircleFilled,
  LaptopOutlined,
  ReadOutlined,
  RightOutlined,
  RocketOutlined,
  PushpinOutlined,
  SearchOutlined,
  UpOutlined,
} from '@ant-design/icons'
import { Button, Checkbox, Empty, Input, InputNumber, Modal, Pagination, Select, Skeleton, Tooltip, message } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getIndustries, getJobCategories, getJobStats, getJobs } from '../../api/jobService'
import { getLocationsByIds, getProvinces, getWards } from '../../api/locationService'
import CategoryPicker from '../../components/job/CategoryPicker'
import JobCard from '../../components/job/JobCard'
import JobCardSkeleton from '../../components/job/JobCardSkeleton'
import JobQuickView from '../../components/job/JobQuickView'
import LocationFilter from '../../components/job/LocationFilter'
import ArrowButton from '../../components/ui/ArrowButton'
import SearchDropdown, { SEARCH_BY_TABS, saveHistory } from '../../components/ui/SearchDropdown'
import { useAuth } from '../../hooks/useAuth'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import { useHideOnScroll } from '../../hooks/useHideOnScroll'
import Login from '../auth/Login'
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
const SALARY_UNIT = 1_000_000
const SAVED_FILTER_KEY = 'saved_job_filter'
const VISIBLE_GROUPS = 6

// URL gọn (như TopCV) <-> param API backend. URL dùng key ngắn + gộp nhiều giá trị
// bằng dấu phẩy; `toApiParams` khai triển lại thành đúng param backend cần.
const SIMPLE_MAP = { wt: 'work_type', et: 'employment_type', level: 'position_level', weekend: 'weekend_policy', nganh: 'industry', sort: 'ordering' }
const LIST_MAP = { cat: 'category', exp: 'experience_years' }
// Key filter trên URL (dùng cho "Xóa lọc" và kiểm tra đang có lọc).
const FILTER_KEYS = ['cat', 'exp', 'wt', 'et', 'level', 'weekend', 'nganh', 'salary', 'sort']

function parseIdList(values) {
  return values
    .flatMap((value) => String(value || '').split(','))
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0)
}

function getLocationIds(params) {
  return parseIdList([...params.getAll('location'), params.get('locations')])
}

// Đọc param nhiều giá trị dạng "a,b,c" trên URL.
function getCommaList(params, key) {
  const raw = params.get(key)
  return raw ? raw.split(',').filter(Boolean) : []
}

// salary=10-15 | 10- | -15 | nego  (đơn vị triệu VND).
function decodeSalary(v) {
  if (!v) return null
  if (v === 'nego') return { nego: true }
  const [a, b] = v.split('-')
  return { gte: a ? Number(a) * SALARY_UNIT : null, lte: b ? Number(b) * SALARY_UNIT : null }
}
function encodeSalary(gte, lte) {
  if (!gte && !lte) return null
  return `${gte ? gte / SALARY_UNIT : ''}-${lte ? lte / SALARY_UNIT : ''}`
}

// URL gọn -> URLSearchParams gửi cho API backend.
function toApiParams(params) {
  const api = new URLSearchParams()
  for (const k of ['search', 'search_by', 'page']) {
    if (params.get(k)) api.set(k, params.get(k))
  }
  for (const [short, backend] of Object.entries(SIMPLE_MAP)) {
    if (params.get(short)) api.set(backend, params.get(short))
  }
  for (const [short, backend] of Object.entries(LIST_MAP)) {
    getCommaList(params, short).forEach((x) => api.append(backend, x))
  }
  getLocationIds(params).forEach((id) => api.append('location', id))
  const sal = decodeSalary(params.get('salary'))
  if (sal?.nego) api.set('salary_negotiable', '1')
  else if (sal) {
    if (sal.gte) api.set('salary_gte', sal.gte)
    if (sal.lte) api.set('salary_lte', sal.lte)
  }
  return api
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

function locationDisplayName(location) {
  if (!location) return ''
  if (location.level === 'province') return shortLocationName(location.name)
  return location.name
}

function joinLimitedLocationNames(locations, limit) {
  const names = locations.map(locationDisplayName).filter(Boolean)
  if (!names.length) return ''
  if (!Number.isFinite(limit) || names.length <= limit) return names.join(', ')
  return `${names.slice(0, limit).join(', ')},...`
}

function formatLocationGroups(groups, { maxGroups = 2, maxWards = 2 } = {}) {
  if (!groups.length) return ''
  const visibleGroups = Number.isFinite(maxGroups) ? groups.slice(0, maxGroups) : groups
  const labels = visibleGroups.map(({ province, wards, allProvince }) => {
    if (!province) return joinLimitedLocationNames(wards, maxWards)
    if (allProvince || !wards.length) return locationDisplayName(province)
    return `${locationDisplayName(province)} (${joinLimitedLocationNames(wards, maxWards)})`
  }).filter(Boolean)
  if (!labels.length) return ''
  const suffix = Number.isFinite(maxGroups) && groups.length > maxGroups ? ',...' : ''
  return `${labels.join(', ')}${suffix}`
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

// Vài dòng chip/checkbox giả — đặt tạm chỗ cho phần lọc còn đang tải dữ liệu (danh mục, lĩnh vực...).
function FilterSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton.Input key={i} active size="small" style={{ width: `${70 - i * 8}%` }} block />
      ))}
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

// Thẻ ngành nghề/lối tắt trong dải "khám phá nhanh" dưới thanh tìm kiếm (kiểu TopCV).
// `img` = logo ngành (nếu có); ngược lại dùng `icon` (node) trên nền tròn.
function ShortcutCard({ icon, img, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-[128px] shrink-0 cursor-pointer flex-col items-center gap-2 rounded-xl border bg-white px-2 py-3.5 text-center transition ${
        active ? 'border-[#00b14f] bg-green-50/60' : 'border-gray-200 hover:border-[#00b14f] hover:shadow-sm'
      }`}
    >
      <span
        className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-full text-lg ${
          img ? 'bg-white ring-1 ring-gray-100' : active ? 'bg-[#00b14f] text-white' : 'bg-emerald-50 text-[#00b14f]'
        }`}
      >
        {img ? <img src={img} alt="" className="h-7 w-7 object-contain" loading="lazy" /> : icon}
      </span>
      <span className="line-clamp-2 h-8 text-xs font-medium leading-snug text-gray-700">{label}</span>
    </button>
  )
}

function PlaceHighlight({ children }) {
  return (
    <span className="rounded bg-amber-100 px-1 font-semibold text-amber-900 ring-1 ring-amber-200/70">
      {children}
    </span>
  )
}

function PlaceList({ items }) {
  return items.map((item, index) => (
    <span key={item}>
      {index > 0 && ', '}
      <PlaceHighlight>{item}</PlaceHighlight>
    </span>
  ))
}

function WardSuggestionCard({ wards, onSelect }) {
  const [expanded, setExpanded] = useState(false)
  if (!wards.length) return null
  const visibleWards = expanded ? wards : wards.slice(0, 3)
  const canExpand = wards.length > 3

  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-800">Gợi ý phường xã:</h3>
        {canExpand && (
          <button
            type="button"
            aria-label={expanded ? 'Thu gọn gợi ý phường xã' : 'Xem thêm gợi ý phường xã'}
            onClick={() => setExpanded((value) => !value)}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-[#00b14f]"
          >
            <DownOutlined className={`text-xs transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {visibleWards.map((ward) => (
          <button
            key={ward.id}
            type="button"
            onClick={() => onSelect(ward.id)}
            className="cursor-pointer rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-[#00b14f] hover:bg-green-50 hover:text-[#00b14f]"
          >
            {ward.name}
            {ward.provinceName && <span className="ml-1 text-gray-400">tại {ward.provinceName}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function JobList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [demandCounts, setDemandCounts] = useState({})
  const [provinces, setProvinces] = useState([])
  const [selectedLocationDetails, setSelectedLocationDetails] = useState([])
  const [data, setData] = useState({ results: [], count: 0 })
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState(searchParams.get('search') || '')
  const [expandedGroups, setExpandedGroups] = useState({})
  const [showAllGroups, setShowAllGroups] = useState(false)
  const [hanoiSuggest, setHanoiSuggest] = useState(null) // { id, count }
  const [salaryFrom, setSalaryFrom] = useState(null) // triệu
  const [salaryTo, setSalaryTo] = useState(null)
  const [industries, setIndustries] = useState([])
  const [sidebarLoading, setSidebarLoading] = useState(true)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const [quickViewJob, setQuickViewJob] = useState(null) // job đang mở panel "Xem nhanh" (null = layout thường)
  const [dismissedNotice, setDismissedNotice] = useState(null) // id tỉnh đã đóng banner sáp nhập
  const [noticeExpanded, setNoticeExpanded] = useState(false)
  const [noExpCount, setNoExpCount] = useState(null)
  const [suggestedWards, setSuggestedWards] = useState([])
  const searchBoxRef = useRef(null)
  const shortcutScrollerRef = useRef(null)
  const [canScrollShortcutsLeft, setCanScrollShortcutsLeft] = useState(false)
  const [canScrollShortcutsRight, setCanScrollShortcutsRight] = useState(false)
  const latestSearchParamsRef = useRef(searchParams)
  const lastSearchParamRef = useRef(searchParams.get('search') || '')
  const { isAuthenticated } = useAuth()

  // Thanh tìm kiếm sticky né header (header tự ẩn khi cuộn xuống); sidebar dính ngay dưới nó.
  const headerVisible = useHideOnScroll()
  const searchTop = headerVisible ? 64 : 0
  const sidebarTop = searchTop + 76

  const page = Number(searchParams.get('page') || 1)
  const selectedLocations = getLocationIds(searchParams)
  const selectedLocationKey = selectedLocations.join(',')
  const selectedCategories = getCommaList(searchParams, 'cat').map(Number)
  const searchBy = searchParams.get('search_by') || 'title'
  const ordering = searchParams.get('sort') || ''
  const debouncedKeyword = useDebouncedValue(keyword, 450)

  const groups = useMemo(() => categories.filter((c) => !c.parent), [categories])
  const childrenOf = useMemo(() => {
    const m = {}
    for (const c of categories) if (c.parent) (m[c.parent] ||= []).push(c)
    return m
  }, [categories])

  // Bật/tắt nút mũi tên trái/phải của dải "khám phá nhanh" theo vị trí cuộn thực tế.
  useEffect(() => {
    const el = shortcutScrollerRef.current
    if (!el) return undefined
    updateShortcutScrollState()
    el.addEventListener('scroll', updateShortcutScrollState, { passive: true })
    window.addEventListener('resize', updateShortcutScrollState)
    return () => {
      el.removeEventListener('scroll', updateShortcutScrollState)
      window.removeEventListener('resize', updateShortcutScrollState)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarLoading, groups.length])

  useEffect(() => {
    setSidebarLoading(true)
    Promise.allSettled([
      getJobCategories().then(setCategories),
      getJobStats().then((s) => setDemandCounts(Object.fromEntries((s.demand || []).map((d) => [d.id, d.count])))),
      getProvinces().then(setProvinces),
      getIndustries().then(setIndustries),
    ]).finally(() => setSidebarLoading(false))
  }, [])

  useEffect(() => {
    let cancelled = false
    getJobs({ experience_years: 'none', page_size: 1 })
      .then((items) => {
        if (!cancelled) setNoExpCount(items.count ?? (items.results || items).length)
      })
      .catch(() => {
        if (!cancelled) setNoExpCount(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    latestSearchParamsRef.current = searchParams
    const nextSearch = searchParams.get('search') || ''
    if (nextSearch !== lastSearchParamRef.current) {
      lastSearchParamRef.current = nextSearch
      setKeyword(nextSearch)
    }
  }, [searchParams])

  useEffect(() => {
    const nextKeyword = debouncedKeyword.trim()
    const currentParams = latestSearchParamsRef.current
    if (nextKeyword === (currentParams.get('search') || '')) return

    const next = new URLSearchParams(currentParams)
    if (nextKeyword) next.set('search', nextKeyword)
    else next.delete('search')
    next.delete('page')
    setSearchParams(next)
  }, [debouncedKeyword, setSearchParams])

  useEffect(() => {
    if (!selectedLocations.length) {
      setSelectedLocationDetails([])
      return
    }
    let cancelled = false
    getLocationsByIds(selectedLocations)
      .then((items) => {
        if (!cancelled) setSelectedLocationDetails(items)
      })
      .catch(() => {
        if (!cancelled) setSelectedLocationDetails([])
      })
    return () => {
      cancelled = true
    }
  }, [selectedLocationKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getJobs(toApiParams(searchParams))
      .then((items) => {
        if (!cancelled) setData(items)
      })
      .catch(() => {
        if (!cancelled) setData({ results: [], count: 0 })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
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
    const params = toApiParams(searchParams)
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

  // Ghi param nhiều giá trị dạng gọn "a,b,c" (rỗng thì xoá hẳn key).
  function setCommaParam(key, values) {
    const next = new URLSearchParams(searchParams)
    if (values.length) next.set(key, values.join(','))
    else next.delete(key)
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
    setCommaParam(
      'cat',
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
    const current = getCommaList(searchParams, 'exp')
    setCommaParam('exp', current.includes(value) ? current.filter((v) => v !== value) : [...current, value])
  }

  // Cuộn ngang bằng nút mũi tên; trình duyệt đã tự hỗ trợ kéo cảm ứng/trackpad qua overflow-x-auto.
  // (Trước đây tự bắt pointer để kéo bằng chuột, nhưng setPointerCapture đôi khi nuốt luôn click
  // của thẻ bên dưới con trỏ -> chọn nhầm/không chọn được nhiều thẻ. Bỏ hẳn để click luôn đáng tin cậy.)
  function updateShortcutScrollState() {
    const el = shortcutScrollerRef.current
    if (!el) return
    setCanScrollShortcutsLeft(el.scrollLeft > 4)
    setCanScrollShortcutsRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  function scrollShortcuts(direction) {
    shortcutScrollerRef.current?.scrollBy({ left: direction * 320, behavior: 'smooth' })
  }

  function clearFilters() {
    const next = new URLSearchParams(searchParams)
    FILTER_KEYS.forEach((k) => next.delete(k))
    next.delete('page')
    setSearchParams(next)
    setSalaryFrom(null)
    setSalaryTo(null)
  }

  function persistFilter() {
    localStorage.setItem(SAVED_FILTER_KEY, searchParams.toString())
  }

  function saveFilter() {
    if (!isAuthenticated) {
      setLoginModalOpen(true) // chưa đăng nhập -> mở modal đăng nhập, không rời trang
      return
    }
    persistFilter()
    message.success('Đã lưu bộ lọc hiện tại')
  }

  // Đăng nhập xong ngay trong modal -> lưu bộ lọc & đóng, vẫn ở lại trang việc làm.
  function handleLoginSuccess() {
    setLoginModalOpen(false)
    persistFilter()
    message.success('Đăng nhập thành công. Đã lưu bộ lọc.')
  }

  // ── Mức lương: 1 param URL gọn `salary` (bucket / thoả thuận / khoảng tự nhập) ─────
  const salaryDec = decodeSalary(searchParams.get('salary'))
  const matchedRange = SALARY_RANGES.find(
    (r) => (r.gte ?? null) === (salaryDec?.gte ?? null) && (r.lte ?? null) === (salaryDec?.lte ?? null),
  )
  const salaryKey = salaryDec?.nego
    ? 'nego'
    : matchedRange
      ? matchedRange.key
      : salaryDec?.gte || salaryDec?.lte
        ? 'custom'
        : ''

  function onSalaryChange(key) {
    if (!key) return updateParams({ salary: null })
    if (key === 'nego') return updateParams({ salary: 'nego' })
    const r = SALARY_RANGES.find((x) => x.key === key)
    return updateParams({ salary: encodeSalary(r?.gte, r?.lte) })
  }

  function applyCustomSalary() {
    updateParams({
      salary: encodeSalary(salaryFrom ? salaryFrom * SALARY_UNIT : null, salaryTo ? salaryTo * SALARY_UNIT : null),
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
  const selectedLocationDetailMap = new Map(selectedLocationDetails.map((location) => [location.id, location]))
  const selectedLocationGroupsMap = new Map()
  selectedLocations.forEach((locationId) => {
    const location = selectedLocationDetailMap.get(locationId)
    if (!location) return
    if (location.level === 'province') {
      const group = selectedLocationGroupsMap.get(location.id) || { province: location, wards: [], allProvince: false }
      selectedLocationGroupsMap.set(location.id, { ...group, province: location, allProvince: true })
      return
    }
    if (location.level === 'ward') {
      const province = provinces.find((p) => p.id === location.parent)
      const groupKey = province?.id || `ward-${location.id}`
      const group = selectedLocationGroupsMap.get(groupKey) || { province, wards: [], allProvince: false }
      if (!group.allProvince && !group.wards.some((ward) => ward.id === location.id)) {
        group.wards.push(location)
      }
      selectedLocationGroupsMap.set(groupKey, group)
    }
  })
  const selectedLocationGroups = [...selectedLocationGroupsMap.values()]
  const suggestedProvinces = selectedLocationGroups
    .map((group) => group.province)
    .filter(Boolean)
    .filter((province, index, items) => items.findIndex((item) => item.id === province.id) === index)
  // Chọn đúng 1 tỉnh/thành -> hiện banner thông báo địa danh hành chính mới (sau sáp nhập 1/7/2025).
  const singleProvince = selectedLocationGroups.length === 1 ? selectedLocationGroups[0].province : null
  const showMergeNotice = singleProvince && dismissedNotice !== singleProvince.id
  // Tên tỉnh viết thường ở giữa câu ("Tỉnh Đồng Nai" -> "tỉnh Đồng Nai"); merged_from = các tỉnh cũ hợp thành.
  const provName = singleProvince ? singleProvince.name.charAt(0).toLowerCase() + singleProvince.name.slice(1) : ''
  const mergedFrom = singleProvince?.merged_from || []
  const selectedWardNames = selectedLocationGroups.flatMap((group) => group.allProvince ? [] : group.wards.map(locationDisplayName))
  const locationSummary = formatLocationGroups(selectedLocationGroups)
  const fullLocationSummary = formatLocationGroups(selectedLocationGroups, { maxGroups: Infinity, maxWards: Infinity })
  const locationContext = locationSummary ? `tại ${locationSummary} mới (sau sáp nhập)` : ''
  const fullLocationContext = fullLocationSummary ? `tại ${fullLocationSummary} mới (sau sáp nhập)` : ''
  const searchLabel = searchParams.get('search') || ''
  const contextLabel = searchLabel || catName || locationContext
  const fullContextLabel = searchLabel || catName || fullLocationContext
  const isLocationContext = !searchLabel && !catName && Boolean(locationContext)
  const updateLabel = `[Update ${new Date().toLocaleDateString('vi-VN')}]`
  const visibleGroups = showAllGroups ? groups : groups.slice(0, VISIBLE_GROUPS)
  const wardSuggestionInsertIndex = useMemo(() => {
    if (results.length < 3) return 1
    const min = Math.max(1, Math.floor(results.length * 0.35))
    const max = Math.max(min, Math.floor(results.length * 0.7))
    const hash = selectedLocationKey.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), results.length)
    return min + (hash % (max - min + 1))
  }, [selectedLocationKey, results.length])

  // ── Dải "khám phá nhanh" dưới thanh tìm kiếm (lối tắt lọc, kiểu TopCV) ──
  const expYears = getCommaList(searchParams, 'exp')
  const toggleParam = (key, value) => updateParams({ [key]: searchParams.get(key) === value ? null : value })
  const shortcutSpecials = [
    { key: 'intern', label: 'Việc thực tập sinh', icon: <ReadOutlined />, active: searchParams.get('level') === 'intern', onClick: () => toggleParam('level', 'intern') },
    { key: 'part-time', label: 'Part-time, thời vụ', icon: <FieldTimeOutlined />, active: searchParams.get('et') === 'part_time', onClick: () => toggleParam('et', 'part_time') },
  ]
  const quickPills = [
    { key: 'salary', label: 'Ưu tiên việc lương cao', icon: <DollarOutlined />, active: ordering === 'salary_desc', onClick: () => toggleParam('sort', 'salary_desc') },
    { key: 'remote', label: 'Làm việc từ xa', icon: <LaptopOutlined />, active: searchParams.get('wt') === 'remote', onClick: () => toggleParam('wt', 'remote') },
    { key: 'weekend', label: 'Nghỉ thứ 7', icon: <CalendarOutlined />, active: searchParams.get('weekend') === 'off_saturday', onClick: () => toggleParam('weekend', 'off_saturday') },
    {
      key: 'no-exp',
      label: `${noExpCount == null ? '...' : formatNumber(noExpCount)} việc làm không cần kinh nghiệm`,
      icon: <RocketOutlined />,
      active: expYears.includes('none'),
      onClick: () => toggleExperienceYears('none'),
    },
  ]
  const openAllCategories = () => {
    setShowAllGroups(true)
    document.getElementById('cat-filter')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  useEffect(() => {
    if (!suggestedProvinces.length) {
      setSuggestedWards([])
      return
    }

    let cancelled = false
    Promise.all(suggestedProvinces.map((province) => getWards(province.id).then((wards) => ({ province, wards }))))
      .then((groups) => {
        if (cancelled) return
        const selected = new Set(selectedLocations)
        const candidates = groups.flatMap(({ province, wards }) => (
          wards
            .filter((ward) => !selected.has(ward.id))
            .map((ward) => ({
              ...ward,
              provinceId: province.id,
              provinceName: shortLocationName(province.name),
            }))
        ))
        const shuffled = [...candidates].sort(() => Math.random() - 0.5)
        setSuggestedWards(shuffled.slice(0, 12))
      })
      .catch(() => {
        if (!cancelled) setSuggestedWards([])
      })

    return () => {
      cancelled = true
    }
  }, [selectedLocationKey, selectedLocationGroups.length]) // eslint-disable-line react-hooks/exhaustive-deps

  function selectSuggestedWard(wardId) {
    setLocationParam([wardId])
  }

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
              onChange={(ids) => setCommaParam('cat', ids)}
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
              className="!h-11 !rounded-lg !px-8 !font-bold !bg-[var(--brand-primary)] hover:!bg-[var(--brand-primary-hover)]"
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
          <div className="min-w-0 flex-1">
            <h1 className="flex min-w-0 items-center gap-x-1.5 overflow-hidden whitespace-nowrap text-lg font-semibold text-gray-900">
              <span className="shrink-0">Tuyển dụng</span>
              {loading ? (
                <Skeleton.Input active size="small" style={{ width: 90, verticalAlign: 'middle' }} />
              ) : (
                <span className="shrink-0 text-[#00b14f]">{formatNumber(count)} việc làm</span>
              )}
              {!loading && contextLabel && (
                <Tooltip title={fullContextLabel || contextLabel}>
                  <span className={`min-w-0 truncate ${isLocationContext ? 'text-[#00b14f]' : ''}`}>
                    {contextLabel}
                  </span>
                </Tooltip>
              )}
              <span className="shrink-0 text-sm font-semibold text-gray-700">
                {updateLabel}
              </span>
            </h1>
            <nav className="mt-1 flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-sm text-gray-500">
              <Link to="/" className="shrink-0 hover:text-[#00b14f]">Trang chủ</Link>
              <RightOutlined className="shrink-0 text-[10px] text-gray-300" />
              {locationSummary ? (
                <>
                  <Link to="/viec-lam" className="shrink-0 hover:text-[#00b14f]">Việc làm</Link>
                  <RightOutlined className="shrink-0 text-[10px] text-gray-300" />
                  <Tooltip title={`${fullLocationSummary} mới (sau sáp nhập)`}>
                    <span className="min-w-0 truncate text-gray-700">
                      {locationSummary} mới (sau sáp nhập)
                    </span>
                  </Tooltip>
                </>
              ) : catChain.length === 0 ? (
                <span>Việc làm</span>
              ) : (
                catChain.map((c, i) => (
                  <span key={c.id} className="flex items-center gap-1.5">
                    {i > 0 && <RightOutlined className="text-[10px] text-gray-300" />}
                    {i < catChain.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setCommaParam('cat', [c.id])}
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
            onClick={() => setLocationParam([hanoiSuggest.id])}
            className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm transition hover:border-[#00b14f]"
          >
            Có <b>{formatNumber(hanoiSuggest.count)}</b> việc làm tại Hà Nội.
            <span className="font-semibold text-[#00b14f]">Xem ngay →</span>
          </button>
        )}

        {/* ── Khám phá nhanh: dải thẻ ngành nghề + hàng pill lối tắt lọc ── */}
        <div className="relative mt-4">
          <div
            ref={shortcutScrollerRef}
            className="flex gap-2.5 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {sidebarLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="w-[128px] shrink-0 rounded-xl border border-gray-200 bg-white px-2 py-3.5">
                    <Skeleton active title={false} paragraph={{ rows: 2, width: ['60%', '90%'] }} />
                  </div>
                ))
              : (
                <>
                  {shortcutSpecials.map((s) => (
                    <ShortcutCard key={s.key} icon={s.icon} label={s.label} active={s.active} onClick={s.onClick} />
                  ))}
                  {groups.map((g) => (
                    <ShortcutCard
                      key={g.id}
                      img={g.logo_url || undefined}
                      icon={<AppstoreOutlined />}
                      label={g.name}
                      active={selectedCategories.includes(g.id)}
                      onClick={() => toggleCategory(g.id)}
                    />
                  ))}
                  <ShortcutCard icon={<AppstoreOutlined />} label="Xem tất cả ngành nghề" onClick={openAllCategories} />
                </>
              )}
          </div>
          {!sidebarLoading && canScrollShortcutsLeft && (
            <ArrowButton
              dir="left"
              onClick={() => scrollShortcuts(-1)}
              className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white shadow-md shadow-black/10"
            />
          )}
          {!sidebarLoading && canScrollShortcutsRight && (
            <ArrowButton
              dir="right"
              onClick={() => scrollShortcuts(1)}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 bg-white shadow-md shadow-black/10"
            />
          )}
        </div>

        {!sidebarLoading && (
          <div className="mt-3 flex flex-wrap gap-2">
            {quickPills.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={p.onClick}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                  p.active
                    ? 'border-[#00b14f] bg-green-50 text-[#00b14f]'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-[#00b14f] hover:text-[#00b14f]'
                }`}
              >
                {p.icon}
                {p.label}
                <RightOutlined className="text-[10px]" />
              </button>
            ))}
          </div>
        )}

        {/* ── Banner địa danh hành chính mới: chỉ hiện khi lọc đúng 1 tỉnh/thành ── */}
        {showMergeNotice && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <InfoCircleFilled className="mt-0.5 shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1">
              <span className={noticeExpanded ? '' : 'line-clamp-1'}>
                <b>Lưu ý:</b> Từ ngày 1/7/2025,{' '}
                {mergedFrom.length ? (
                  <>
                    <PlaceHighlight>{provName}</PlaceHighlight> sau sáp nhập bao gồm phạm vi các tỉnh{' '}
                    <PlaceList items={mergedFrom} /> cũ. Danh sách bên dưới hiển thị các việc làm tại{' '}
                    <PlaceHighlight>{provName}</PlaceHighlight> mới, phù hợp với nhu cầu tìm việc theo đơn vị hành chính
                    mới.
                  </>
                ) : (
                  <>
                    <PlaceHighlight>{provName}</PlaceHighlight> điều chỉnh mô hình hành chính từ quận/huyện sang{' '}
                    <PlaceHighlight>phường/xã</PlaceHighlight>. Danh sách bên dưới hiển thị các việc làm tại{' '}
                    <PlaceHighlight>{provName}</PlaceHighlight> theo địa danh hành chính mới, phù hợp với nhu cầu tìm
                    việc theo đơn vị hành chính mới.
                  </>
                )}
                {selectedWardNames.length > 0 && (
                  <>
                    {' '}Khu vực đã chọn: <PlaceList items={selectedWardNames} />.
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={() => setNoticeExpanded((v) => !v)}
                className="ml-1 inline-flex cursor-pointer items-center gap-0.5 font-semibold text-amber-600 hover:text-amber-700"
              >
                {noticeExpanded ? 'Thu gọn' : 'Xem thêm'}
                {noticeExpanded ? <UpOutlined className="text-[10px]" /> : <DownOutlined className="text-[10px]" />}
              </button>
            </div>
            <button
              type="button"
              aria-label="Đóng thông báo"
              onClick={() => setDismissedNotice(singleProvince.id)}
              className="shrink-0 cursor-pointer p-0.5 text-amber-400 hover:text-amber-600"
            >
              <CloseOutlined className="text-xs" />
            </button>
          </div>
        )}

        {/* Không transition grid-template-columns (nội suy track width bị giật) — đổi cột tức thì,
            phần chuyển động mượt do panel slide-in + skeleton fade đảm nhận. */}
        <div
          className={`mt-4 grid grid-cols-1 gap-5 ${
            quickViewJob ? 'lg:grid-cols-[minmax(340px,400px)_1fr] lg:items-start' : 'lg:grid-cols-[300px_1fr]'
          }`}
        >
          {/* ── Sidebar lọc nâng cao: ẩn khi panel "Xem nhanh" mở (danh sách job chiếm chỗ này) ── */}
          {!quickViewJob && (
          <aside
            style={{ '--sb-top': `${sidebarTop}px` }}
            className="filter-sidebar animate-fade-slide flex flex-col bg-transparent transition-[top] duration-300 h-[calc(100dvh-180px)] lg:sticky lg:top-[var(--sb-top)] lg:h-[calc(100dvh-var(--sb-top)-1rem)]"
          >
            <style>{`
              .filter-sidebar-scroll { scrollbar-width: thin; scrollbar-color: transparent transparent; }
              .filter-sidebar-scroll:hover { scrollbar-color: #d1d5db transparent; }
              .filter-sidebar-scroll::-webkit-scrollbar { width: 4px; }
              .filter-sidebar-scroll::-webkit-scrollbar-thumb { background: transparent; border-radius: 99px; transition: background 0.2s; }
              .filter-sidebar-scroll:hover::-webkit-scrollbar-thumb { background: #d1d5db; }
              .filter-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
            `}</style>
            {/* Scrollable filter sections */}
            <div className="filter-sidebar-scroll flex-1 overflow-y-auto p-4">
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
                value={searchParams.get('weekend') || ''}
                onChange={(v) => updateParams({ weekend: v })}
                options={WEEKEND_POLICY_OPTIONS}
                allLabel="Không lọc"
              />
            </FilterSection>

            <div className="mt-4" />
            <div id="cat-filter">
            <FilterSection title="Theo danh mục nghề">
              {sidebarLoading ? (
                <FilterSkeleton rows={6} />
              ) : (
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
              )}
            </FilterSection>
            </div>

            <div className="mt-4">
              <FilterSection title="Kinh nghiệm">
                <MultiChips
                  values={getCommaList(searchParams, 'exp')}
                  onToggle={toggleExperienceYears}
                  onClear={() => setCommaParam('exp', [])}
                  options={Object.entries(EXPERIENCE_YEARS_LABELS)}
                />
              </FilterSection>
            </div>

            <div className="mt-4">
              <FilterSection title="Lĩnh vực công ty">
                {sidebarLoading ? (
                  <Skeleton.Input active size="default" block />
                ) : (
                  <Select
                    className="w-full"
                    allowClear
                    showSearch
                    placeholder="Tất cả lĩnh vực"
                    suffixIcon={<BankOutlined className="text-gray-400" />}
                    value={searchParams.get('nganh') || undefined}
                    onChange={(v) => updateParams({ nganh: v })}
                    options={industries.map((ind) => ({ value: String(ind.id), label: ind.name }))}
                  />
                )}
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
                  value={searchParams.get('level') || ''}
                  onChange={(v) => updateParams({ level: v })}
                  options={Object.entries(POSITION_LEVEL_LABELS)}
                />
              </FilterSection>
            </div>

            <div className="mt-4">
              <FilterSection title="Hình thức làm việc">
                <SingleChips
                  value={searchParams.get('wt') || ''}
                  onChange={(v) => updateParams({ wt: v })}
                  options={Object.entries(WORK_TYPE_LABELS)}
                />
              </FilterSection>
            </div>

            <div className="mt-4">
              <FilterSection title="Loại hình làm việc">
                <SingleChips
                  value={searchParams.get('et') || ''}
                  onChange={(v) => updateParams({ et: v })}
                  options={Object.entries(EMPLOYMENT_TYPE_LABELS)}
                />
              </FilterSection>
            </div>

            </div>{/* end scrollable */}

            {/* Action buttons — always visible at bottom, outside scroll area */}
            <div className="sticky bottom-0 z-10 flex shrink-0 gap-2 border-t border-gray-200/70 bg-[inherit] px-4 py-3 backdrop-blur">
              <Button
                block
                disabled={!hasFilters}
                onClick={clearFilters}
                className="!rounded-full"
                danger={hasFilters}
              >
                Xóa lọc{hasFilters ? ` (${[...searchParams.entries()].filter(([k]) => !['search','search_by','page','ordering'].includes(k)).length})` : ''}
              </Button>
              <Button
                block
                type="primary"
                icon={<PushpinOutlined />}
                onClick={saveFilter}
                className="!rounded-full !bg-[var(--brand-primary)] !border-[var(--brand-primary)] hover:!bg-[var(--brand-primary-hover)]"
              >
                Lưu bộ lọc
              </Button>
            </div>
          </aside>
          )}

          {/* ── Danh sách việc làm (khi "Xem nhanh" mở: cột trái gọn, thay chỗ bộ lọc) ── */}
          <div className="lg:col-span-1">
            <div className={quickViewJob ? 'hidden' : 'mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between'}>
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
                  onChange={(v) => updateParams({ sort: v })}
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
                {results.map((job, index) => (
                  <div key={job.public_id} className="space-y-3">
                    <JobCard
                      job={job}
                      isAuthenticated={isAuthenticated}
                      onRequireLogin={() => setLoginModalOpen(true)}
                      onQuickView={setQuickViewJob}
                      compact={Boolean(quickViewJob)}
                      active={quickViewJob?.public_id === job.public_id}
                    />
                    {!quickViewJob && suggestedWards.length > 0 && index + 1 === wardSuggestionInsertIndex && (
                      <WardSuggestionCard
                        wards={suggestedWards}
                        onSelect={selectSuggestedWard}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {count > PAGE_SIZE && (
              <div className="mt-6 flex justify-center">
                <Pagination
                  current={page}
                  pageSize={PAGE_SIZE}
                  total={count}
                  simple={Boolean(quickViewJob)}
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

          {/* ── Panel xem nhanh: dính viewport, cuộn riêng như sidebar ── */}
          {quickViewJob && (
            <div
              style={{ '--sb-top': `${sidebarTop}px` }}
              className="transition-[top] duration-300 lg:sticky lg:top-[var(--sb-top)] lg:max-h-[calc(100dvh-var(--sb-top)-1rem)] lg:overflow-y-auto lg:[scrollbar-width:thin] rounded-xl"
            >
              <JobQuickView
                job={quickViewJob}
                onClose={() => setQuickViewJob(null)}
                isAuthenticated={isAuthenticated}
                onRequireLogin={() => setLoginModalOpen(true)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Modal đăng nhập — tái dùng đúng component Login (Google/Facebook/email...). */}
      <Modal
        open={loginModalOpen}
        onCancel={() => setLoginModalOpen(false)}
        footer={null}
        centered
        width={640}
        destroyOnClose
        styles={{
          container: { borderRadius: 28, padding: 0, overflow: 'hidden' },
          body: { padding: '40px 48px 36px' },
        }}
      >
        <GoogleReCaptchaProvider reCaptchaKey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}>
          <Login onSuccess={handleLoginSuccess} />
        </GoogleReCaptchaProvider>
      </Modal>
    </div>
  )
}
