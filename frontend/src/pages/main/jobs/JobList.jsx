import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FilterOutlined } from '@ant-design/icons'
import { message } from 'antd'
import { saveHistory } from '../../../components/ui/searchDropdownHistory'
import { useAuth } from '../../../hooks/useAuth'
import { useHideOnScroll } from '../../../hooks/useHideOnScroll'
import { useMediaQuery } from '../../../hooks/useMediaQuery'
import { SALARY_RANGES, formatNumber } from '../../../constants/jobOptions'
import JobFilterSidebar from './components/JobFilterSidebar'
import JobListHeader from './components/JobListHeader'
import JobListOverlays from './components/JobListOverlays'
import JobQuickView from './components/JobQuickView'
import JobResults from './components/JobResults'
import JobSearchBar from './components/JobSearchBar'
import LocationMergeNotice from './components/LocationMergeNotice'
import QuickExplore from './components/QuickExplore'
import useJobListData from './hooks/useJobListData'
import useHanoiJobSuggestion from './hooks/useHanoiJobSuggestion'
import useJobLocationData from './hooks/useJobLocationData'
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
  mergeSearchParams,
  pathForLocation,
  removeSearchParams,
  replaceCommaParam,
  replaceLocationParams,
} from './utils/jobListParams'

export default function JobList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState(searchParams.get('search') || '')
  const [expandedGroups, setExpandedGroups] = useState({})
  const [showAllGroups, setShowAllGroups] = useState(false)
  const [salaryFrom, setSalaryFrom] = useState(null)
  const [salaryTo, setSalaryTo] = useState(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)
  const [quickViewJob, setQuickViewJob] = useState(null)
  const [dismissedNotice, setDismissedNotice] = useState(null)
  const [noticeExpanded, setNoticeExpanded] = useState(false)
  const searchBoxRef = useRef(null)
  const shortcutScrollerRef = useRef(null)
  const [canScrollShortcutsLeft, setCanScrollShortcutsLeft] = useState(false)
  const [canScrollShortcutsRight, setCanScrollShortcutsRight] = useState(false)
  const { isAuthenticated } = useAuth()
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const { categories, demandCounts, industries, noExpCount, provinces, sidebarLoading } = useJobSidebarData()
  const { count, loading, results } = useJobListData(searchParams)

  // Thanh tìm kiếm sticky né header (header tự ẩn khi cuộn xuống); sidebar dính ngay dưới nó.
  const headerVisible = useHideOnScroll()
  const searchTop = headerVisible ? 64 : 0
  const sidebarTop = searchTop + 76

  const page = Number(searchParams.get('page') || 1)
  const selectedLocations = getLocationIds(searchParams)
  const selectedLocationKey = selectedLocations.join(',')
  const { selectedLocationGroups, suggestedWards } = useJobLocationData(
    selectedLocations,
    selectedLocationKey,
    provinces,
  )
  const hanoiSuggest = useHanoiJobSuggestion(
    searchParams,
    provinces,
    selectedLocations.length > 0,
  )
  const selectedCategories = getCommaList(searchParams, 'cat').map(Number)
  const searchBy = searchParams.get('search_by') || 'title'
  const ordering = searchParams.get('sort') || ''
  const expYears = getCommaList(searchParams, 'exp')
  const searchParamKeyword = searchParams.get('search') || ''

  const groups = useMemo(() => categories.filter((category) => !category.parent), [categories])
  const childrenOf = useMemo(() => {
    const map = {}
    for (const category of categories) {
      if (category.parent) (map[category.parent] ||= []).push(category)
    }
    return map
  }, [categories])

  // "Khám phá nhanh" là lối vào duyệt việc, không phải một phần của kết quả:
  // ẩn khi user đã gõ từ khoá (đã biết rõ muốn gì), còn lọc theo địa điểm/ngành
  // vẫn là duyệt nên giữ lại. Không có ngành nghề nào thì cũng không có gì để gợi ý.
  const showQuickExplore = !searchParamKeyword && (sidebarLoading || groups.length > 0)

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
    // showQuickExplore: scroller unmount/mount lại thì phải gắn lại listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarLoading, groups.length, showQuickExplore])

  useEffect(() => {
    setKeyword(searchParamKeyword)
  }, [searchParamKeyword])

  function updateParams(entries) {
    setSearchParams(mergeSearchParams(searchParams, entries))
  }

  function setCommaParam(key, values) {
    setSearchParams(replaceCommaParam(searchParams, key, values))
  }

  function setLocationParam(ids) {
    const next = replaceLocationParams(searchParams, ids, {
      keyword: keyword.trim(),
      searchBy,
    })
    const pathname = pathForLocation(ids, provinces)
    const query = next.toString()
    navigate(query ? `${pathname}?${query}` : pathname)
  }

  function selectSuggestedLocation(provinceName) {
    const province = provinces.find((item) => item.name.includes(provinceName))
    if (!province) return
    setLocationParam([province.id])
  }

  function openLocationPicker() {
    document.querySelector('#job-location-filter > button')?.click()
  }

  function jumpToResults() {
    document.getElementById('job-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

  // Bấm "x" (hoặc xoá hết chữ) khi đang có search trên URL -> xoá filter ngay, không cần bấm Enter.
  function handleKeywordChange(value) {
    setKeyword(value)
    if (!value && searchParams.get('search')) runSearch('')
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
    setSearchParams(removeSearchParams(searchParams, [...FILTER_KEYS, 'page']))
    setSalaryFrom(null)
    setSalaryTo(null)
  }

  // Empty-state "Xóa bộ lọc & từ khóa": reset cả filter lẫn search về danh sách đầy đủ.
  function clearAllCriteria() {
    setSearchParams(removeSearchParams(
      searchParams,
      [...FILTER_KEYS, 'search', 'search_by', 'page'],
    ))
    setKeyword('')
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

  const inlineQuickView = quickViewJob && isDesktop

  // Dùng lại cho cả cột dính (desktop) và drawer lọc (mobile).
  const filterSidebar = (
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
  )

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
        onKeywordChange={handleKeywordChange}
        onLocationChange={setLocationParam}
        onRunSearch={runSearch}
        onSearchByChange={(by) => updateParams({ search_by: by === 'title' ? null : by })}
        searchBoxRef={searchBoxRef}
        searchBy={searchBy}
        searchTop={searchTop}
        selectedCategories={selectedCategories}
        selectedLocationLabel={locationSummary || (selectedLocations.length ? 'Đang tải địa điểm...' : '')}
        selectedLocations={selectedLocations}
      />

      <div className="max-w-6xl mx-auto px-4 py-5">
        <JobListHeader
          catChain={catChain}
          activeSearchKeyword={searchLabel}
          contextLabel={contextLabel}
          count={count}
          fullContextLabel={fullContextLabel}
          fullLocationSummary={fullLocationSummary}
          hasSelectedLocation={selectedLocations.length > 0}
          isLocationContext={isLocationContext}
          loading={loading}
          locationSummary={locationSummary}
          onCategorySelect={(id) => setCommaParam('cat', [id])}
          onJumpToResults={jumpToResults}
          onLocationPickerOpen={openLocationPicker}
          onSuggestedLocationSelect={selectSuggestedLocation}
          searchSuggestion={keyword.trim()}
          updateLabel={updateLabel}
        />

        {!selectedLocations.length && hanoiSuggest?.count > 0 && (
          <button
            type="button"
            onClick={() => setLocationParam([hanoiSuggest.id])}
            className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm transition hover:border-[var(--brand-primary)]"
          >
            Có <b>{formatNumber(hanoiSuggest.count)}</b> việc làm tại Hà Nội.
            <span className="font-semibold text-[var(--brand-primary)]">Xem ngay →</span>
          </button>
        )}

        {showQuickExplore && (
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
        )}

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

        <button
          type="button"
          onClick={() => setFilterDrawerOpen(true)}
          className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 shadow-sm lg:hidden"
        >
          <FilterOutlined className="text-[var(--brand-primary)]" />
          Lọc nâng cao{hasFilters ? ` (${[...searchParams.entries()].filter(([key]) => !['search', 'search_by', 'page', 'ordering'].includes(key)).length})` : ''}
        </button>

        <div
          id="job-results"
          className={`mt-4 scroll-mt-40 grid grid-cols-1 gap-5 ${
            inlineQuickView ? 'lg:grid-cols-[minmax(340px,400px)_1fr] lg:items-start' : 'lg:grid-cols-[300px_1fr]'
          }`}
        >
          {!inlineQuickView && <div className="hidden lg:block">{filterSidebar}</div>}

          <JobResults
            count={count}
            isAuthenticated={isAuthenticated}
            loading={loading}
            onClearAll={hasFilters || searchParamKeyword ? clearAllCriteria : undefined}
            onPageChange={handlePageChange}
            onRequireLogin={() => setLoginModalOpen(true)}
            onSearchByChange={(tabKey) => updateParams({ search_by: tabKey === 'title' ? null : tabKey })}
            onSelectSuggestedWard={selectSuggestedWard}
            onSetQuickViewJob={setQuickViewJob}
            onSortChange={(sort) => updateParams({ sort })}
            ordering={ordering}
            page={page}
            quickViewJob={inlineQuickView ? quickViewJob : null}
            results={results}
            searchBy={searchBy}
            suggestedWards={suggestedWards}
            wardSuggestionInsertIndex={wardSuggestionInsertIndex}
          />

          {inlineQuickView && (
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

      <JobListOverlays
        filterDrawerOpen={filterDrawerOpen}
        filterSidebar={filterSidebar}
        isAuthenticated={isAuthenticated}
        isDesktop={isDesktop}
        loginModalOpen={loginModalOpen}
        quickViewJob={quickViewJob}
        onFilterDrawerClose={() => setFilterDrawerOpen(false)}
        onLoginClose={() => setLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        onQuickViewClose={() => setQuickViewJob(null)}
        onRequireLogin={() => setLoginModalOpen(true)}
      />
    </div>
  )
}
