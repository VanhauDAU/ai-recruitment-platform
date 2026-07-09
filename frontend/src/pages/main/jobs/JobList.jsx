import { useEffect, useMemo, useRef, useState } from 'react'
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Modal, message } from 'antd'
import JobQuickView from '../../../components/job/JobQuickView'
import { saveHistory } from '../../../components/ui/SearchDropdown'
import { useAuth } from '../../../hooks/useAuth'
import useDebouncedValue from '../../../hooks/useDebouncedValue'
import { useHideOnScroll } from '../../../hooks/useHideOnScroll'
import { getLocationsByIds, getWards } from '../../../api/locationService'
import { getJobs } from '../../../api/jobService'
import { SALARY_RANGES, formatNumber } from '../../../constants/jobOptions'
import Login from '../auth/Login'
import JobFilterSidebar from './components/JobFilterSidebar'
import JobListHeader from './components/JobListHeader'
import JobResults from './components/JobResults'
import JobSearchBar from './components/JobSearchBar'
import LocationMergeNotice from './components/LocationMergeNotice'
import QuickExplore from './components/QuickExplore'
import useJobListData from './hooks/useJobListData'
import useJobSidebarData from './hooks/useJobSidebarData'
import {
  FILTER_KEYS,
  SALARY_UNIT,
  SAVED_FILTER_KEY,
  decodeSalary,
  encodeSalary,
  formatLocationGroups,
  getCommaList,
  getLocationIds,
  locationDisplayName,
  pathForLocation,
  shortLocationName,
  toApiParams,
} from './utils/jobListParams'

export default function JobList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [selectedLocationDetails, setSelectedLocationDetails] = useState([])
  const [keyword, setKeyword] = useState(searchParams.get('search') || '')
  const [expandedGroups, setExpandedGroups] = useState({})
  const [showAllGroups, setShowAllGroups] = useState(false)
  const [hanoiSuggest, setHanoiSuggest] = useState(null)
  const [salaryFrom, setSalaryFrom] = useState(null)
  const [salaryTo, setSalaryTo] = useState(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const [quickViewJob, setQuickViewJob] = useState(null)
  const [dismissedNotice, setDismissedNotice] = useState(null)
  const [noticeExpanded, setNoticeExpanded] = useState(false)
  const [suggestedWards, setSuggestedWards] = useState([])
  const searchBoxRef = useRef(null)
  const shortcutScrollerRef = useRef(null)
  const [canScrollShortcutsLeft, setCanScrollShortcutsLeft] = useState(false)
  const [canScrollShortcutsRight, setCanScrollShortcutsRight] = useState(false)
  const latestSearchParamsRef = useRef(searchParams)
  const lastSearchParamRef = useRef(searchParams.get('search') || '')
  const { isAuthenticated } = useAuth()

  const { categories, demandCounts, industries, noExpCount, provinces, sidebarLoading } = useJobSidebarData()
  const { count, loading, results } = useJobListData(searchParams)

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
  const expYears = getCommaList(searchParams, 'exp')
  const debouncedKeyword = useDebouncedValue(keyword, 450)

  const groups = useMemo(() => categories.filter((category) => !category.parent), [categories])
  const childrenOf = useMemo(() => {
    const map = {}
    for (const category of categories) {
      if (category.parent) (map[category.parent] ||= []).push(category)
    }
    return map
  }, [categories])

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
    if (selectedLocations.length || !provinces.length) {
      setHanoiSuggest(null)
      return undefined
    }
    const hanoi = provinces.find((province) => province.name.includes('Hà Nội'))
    if (!hanoi) return undefined
    let cancelled = false
    const params = toApiParams(searchParams)
    params.delete('page')
    params.append('location', hanoi.id)
    params.set('page_size', '1')
    getJobs(params)
      .then((data) => !cancelled && setHanoiSuggest({ id: hanoi.id, count: data.count ?? 0 }))
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, provinces])

  const selectedLocationGroups = useMemo(() => {
    const locationMap = new Map(selectedLocationDetails.map((location) => [location.id, location]))
    const groupsMap = new Map()

    selectedLocations.forEach((locationId) => {
      const location = locationMap.get(locationId)
      if (!location) return
      if (location.level === 'province') {
        const group = groupsMap.get(location.id) || { province: location, wards: [], allProvince: false }
        groupsMap.set(location.id, { ...group, province: location, allProvince: true })
        return
      }
      if (location.level === 'ward') {
        const province = provinces.find((item) => item.id === location.parent)
        const groupKey = province?.id || `ward-${location.id}`
        const group = groupsMap.get(groupKey) || { province, wards: [], allProvince: false }
        if (!group.allProvince && !group.wards.some((ward) => ward.id === location.id)) {
          group.wards.push(location)
        }
        groupsMap.set(groupKey, group)
      }
    })

    return [...groupsMap.values()]
  }, [provinces, selectedLocationDetails, selectedLocationKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const suggestedProvinces = useMemo(() => (
    selectedLocationGroups
      .map((group) => group.province)
      .filter(Boolean)
      .filter((province, index, items) => items.findIndex((item) => item.id === province.id) === index)
  ), [selectedLocationGroups])

  useEffect(() => {
    if (!suggestedProvinces.length) {
      setSuggestedWards([])
      return
    }

    let cancelled = false
    Promise.all(suggestedProvinces.map((province) => getWards(province.id).then((wards) => ({ province, wards }))))
      .then((wardGroups) => {
        if (cancelled) return
        const selected = new Set(selectedLocations)
        const candidates = wardGroups.flatMap(({ province, wards }) => (
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

  function updateParams(entries) {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(entries)) {
      if (value === undefined || value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    next.delete('page')
    setSearchParams(next)
  }

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
      selectedCategories.includes(id) ? selectedCategories.filter((categoryId) => categoryId !== id) : [...selectedCategories, id],
    )
  }

  function runSearch(nextKeyword = keyword, by = searchBy) {
    saveHistory(nextKeyword, by)
    setDropdownOpen(false)
    updateParams({ search: nextKeyword.trim() || null, search_by: by === 'title' ? null : by })
  }

  function handleDropdownSelect(nextKeyword, by = searchBy) {
    setKeyword(nextKeyword)
    runSearch(nextKeyword, by)
  }

  function toggleExperienceYears(value) {
    setCommaParam('exp', expYears.includes(value) ? expYears.filter((item) => item !== value) : [...expYears, value])
  }

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
    FILTER_KEYS.forEach((key) => next.delete(key))
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
      setLoginModalOpen(true)
      return
    }
    persistFilter()
    message.success('Đã lưu bộ lọc hiện tại')
  }

  function handleLoginSuccess() {
    setLoginModalOpen(false)
    persistFilter()
    message.success('Đăng nhập thành công. Đã lưu bộ lọc.')
  }

  const salaryDec = decodeSalary(searchParams.get('salary'))
  const matchedRange = SALARY_RANGES.find(
    (range) => (range.gte ?? null) === (salaryDec?.gte ?? null) && (range.lte ?? null) === (salaryDec?.lte ?? null),
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
    const range = SALARY_RANGES.find((item) => item.key === key)
    return updateParams({ salary: encodeSalary(range?.gte, range?.lte) })
  }

  function applyCustomSalary() {
    updateParams({
      salary: encodeSalary(salaryFrom ? salaryFrom * SALARY_UNIT : null, salaryTo ? salaryTo * SALARY_UNIT : null),
    })
  }

  const hasFilters = FILTER_KEYS.some((key) => searchParams.has(key))
  const catChain = (() => {
    if (selectedCategories.length !== 1) return []
    const byId = Object.fromEntries(categories.map((category) => [category.id, category]))
    const chain = []
    let current = byId[selectedCategories[0]]
    while (current) {
      chain.unshift(current)
      current = byId[current.parent]
    }
    return chain
  })()
  const catName = catChain.at(-1)?.name || null

  const singleProvince = selectedLocationGroups.length === 1 ? selectedLocationGroups[0].province : null
  const showMergeNotice = singleProvince && dismissedNotice !== singleProvince.id
  const provName = singleProvince ? singleProvince.name.charAt(0).toLowerCase() + singleProvince.name.slice(1) : ''
  const mergedFrom = singleProvince?.merged_from || []
  const selectedWardNames = selectedLocationGroups.flatMap((group) => (
    group.allProvince ? [] : group.wards.map(locationDisplayName)
  ))
  const locationSummary = formatLocationGroups(selectedLocationGroups)
  const fullLocationSummary = formatLocationGroups(selectedLocationGroups, { maxGroups: Infinity, maxWards: Infinity })
  const locationContext = locationSummary ? `tại ${locationSummary} mới (sau sáp nhập)` : ''
  const fullLocationContext = fullLocationSummary ? `tại ${fullLocationSummary} mới (sau sáp nhập)` : ''
  const searchLabel = searchParams.get('search') || ''
  const contextLabel = searchLabel || catName || locationContext
  const fullContextLabel = searchLabel || catName || fullLocationContext
  const isLocationContext = !searchLabel && !catName && Boolean(locationContext)
  const updateLabel = `[Update ${new Date().toLocaleDateString('vi-VN')}]`
  const wardSuggestionInsertIndex = useMemo(() => {
    if (results.length < 3) return 1
    const min = Math.max(1, Math.floor(results.length * 0.35))
    const max = Math.max(min, Math.floor(results.length * 0.7))
    const hash = selectedLocationKey.split('').reduce((sum, char) => sum + char.charCodeAt(0), results.length)
    return min + (hash % (max - min + 1))
  }, [selectedLocationKey, results.length])

  const toggleParam = (key, value) => updateParams({ [key]: searchParams.get(key) === value ? null : value })
  const openAllCategories = () => {
    setShowAllGroups(true)
    document.getElementById('cat-filter')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function selectSuggestedWard(wardId) {
    setLocationParam([wardId])
  }

  function handlePageChange(nextPage) {
    const next = new URLSearchParams(searchParams)
    next.set('page', nextPage)
    setSearchParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div>
      <JobSearchBar
        categories={categories}
        dropdownOpen={dropdownOpen}
        keyword={keyword}
        onCategoryChange={(ids) => setCommaParam('cat', ids)}
        onDropdownClose={() => setDropdownOpen(false)}
        onDropdownOpen={() => setDropdownOpen(true)}
        onDropdownSelect={handleDropdownSelect}
        onKeywordChange={setKeyword}
        onLocationChange={setLocationParam}
        onRunSearch={runSearch}
        onSearchByChange={(by) => updateParams({ search_by: by === 'title' ? null : by })}
        searchBoxRef={searchBoxRef}
        searchBy={searchBy}
        searchTop={searchTop}
        selectedCategories={selectedCategories}
        selectedLocations={selectedLocations}
      />

      <div className="max-w-6xl mx-auto px-4 py-5">
        <JobListHeader
          catChain={catChain}
          contextLabel={contextLabel}
          count={count}
          fullContextLabel={fullContextLabel}
          fullLocationSummary={fullLocationSummary}
          isLocationContext={isLocationContext}
          loading={loading}
          locationSummary={locationSummary}
          onCategorySelect={(id) => setCommaParam('cat', [id])}
          updateLabel={updateLabel}
        />

        {hanoiSuggest?.count > 0 && (
          <button
            type="button"
            onClick={() => setLocationParam([hanoiSuggest.id])}
            className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm transition hover:border-[var(--brand-primary)]"
          >
            Có <b>{formatNumber(hanoiSuggest.count)}</b> việc làm tại Hà Nội.
            <span className="font-semibold text-[var(--brand-primary)]">Xem ngay →</span>
          </button>
        )}

        <QuickExplore
          canScrollLeft={canScrollShortcutsLeft}
          canScrollRight={canScrollShortcutsRight}
          expYears={expYears}
          groups={groups}
          noExpCount={noExpCount}
          onOpenAllCategories={openAllCategories}
          onScroll={scrollShortcuts}
          onToggleCategory={toggleCategory}
          onToggleExperienceYears={toggleExperienceYears}
          onToggleParam={toggleParam}
          ordering={ordering}
          scrollerRef={shortcutScrollerRef}
          searchParams={searchParams}
          selectedCategories={selectedCategories}
          sidebarLoading={sidebarLoading}
        />

        {showMergeNotice && (
          <LocationMergeNotice
            expanded={noticeExpanded}
            mergedFrom={mergedFrom}
            onClose={() => setDismissedNotice(singleProvince.id)}
            onToggleExpanded={() => setNoticeExpanded((value) => !value)}
            provinceName={provName}
            selectedWardNames={selectedWardNames}
          />
        )}

        <div
          className={`mt-4 grid grid-cols-1 gap-5 ${
            quickViewJob ? 'lg:grid-cols-[minmax(340px,400px)_1fr] lg:items-start' : 'lg:grid-cols-[300px_1fr]'
          }`}
        >
          {!quickViewJob && (
            <JobFilterSidebar
              childrenOf={childrenOf}
              demandCounts={demandCounts}
              expandedGroups={expandedGroups}
              expYears={expYears}
              groups={groups}
              hasFilters={hasFilters}
              industries={industries}
              onApplyCustomSalary={applyCustomSalary}
              onClearFilters={clearFilters}
              onSaveFilter={saveFilter}
              onSalaryChange={onSalaryChange}
              onSetCommaParam={setCommaParam}
              onSetExpandedGroups={setExpandedGroups}
              onSetSalaryFrom={setSalaryFrom}
              onSetSalaryTo={setSalaryTo}
              onSetShowAllGroups={setShowAllGroups}
              onToggleCategory={toggleCategory}
              onToggleExperienceYears={toggleExperienceYears}
              onUpdateParams={updateParams}
              salaryFrom={salaryFrom}
              salaryKey={salaryKey}
              salaryTo={salaryTo}
              searchParams={searchParams}
              selectedCategories={selectedCategories}
              showAllGroups={showAllGroups}
              sidebarLoading={sidebarLoading}
              sidebarTop={sidebarTop}
            />
          )}

          <JobResults
            count={count}
            isAuthenticated={isAuthenticated}
            loading={loading}
            onPageChange={handlePageChange}
            onRequireLogin={() => setLoginModalOpen(true)}
            onSearchByChange={(tabKey) => updateParams({ search_by: tabKey === 'title' ? null : tabKey })}
            onSelectSuggestedWard={selectSuggestedWard}
            onSetQuickViewJob={setQuickViewJob}
            onSortChange={(sort) => updateParams({ sort })}
            ordering={ordering}
            page={page}
            quickViewJob={quickViewJob}
            results={results}
            searchBy={searchBy}
            suggestedWards={suggestedWards}
            wardSuggestionInsertIndex={wardSuggestionInsertIndex}
          />

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

      <Modal
        open={loginModalOpen}
        onCancel={() => setLoginModalOpen(false)}
        footer={null}
        centered
        width={640}
        destroyOnHidden
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
