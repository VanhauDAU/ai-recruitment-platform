import { useEffect, useMemo, useRef, useState } from 'react'
import { FilterOutlined } from '@ant-design/icons'
import { message } from 'antd'
import { useAuth } from '@/features/auth'
import { useLoginPrompt } from '@/features/auth'
import { useHideOnScroll } from '@/shared/hooks/use-hide-on-scroll'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import { formatNumber } from '@/entities/job'
import JobFilterSidebar from './ui/JobFilterSidebar'
import JobListHeader from './ui/JobListHeader'
import JobListOverlays from './ui/JobListOverlays'
import JobQuickView from './ui/JobQuickView'
import JobResults from './ui/JobResults'
import JobSearchBar from './ui/JobSearchBar'
import LocationMergeNotice from './ui/LocationMergeNotice'
import QuickExplore from './ui/QuickExplore'
import useJobListData from './model/use-job-list-data'
import useJobListFilters from './model/use-job-list-filters'
import useHanoiJobSuggestion from './model/use-hanoi-job-suggestion'
import useJobLocationData from './model/use-job-location-data'
import useJobSidebarData from './model/use-job-sidebar-data'
import { buildCategoryTree, nodeCheckState, selectedLeafSet, toggleCategoryIds } from './lib/category-tree'
import { formatLocationGroups, locationDisplayName } from './lib/job-list-params'

export default function JobList() {
  const [expandedGroups, setExpandedGroups] = useState({})
  const [showAllGroups, setShowAllGroups] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)
  const [quickViewJob, setQuickViewJob] = useState(null)
  const [dismissedNotice, setDismissedNotice] = useState(null)
  const [noticeExpanded, setNoticeExpanded] = useState(false)
  const searchBoxRef = useRef(null)
  const shortcutScrollerRef = useRef(null)
  const [canScrollShortcutsLeft, setCanScrollShortcutsLeft] = useState(false)
  const [canScrollShortcutsRight, setCanScrollShortcutsRight] = useState(false)
  const { isAuthenticated } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const { categories, demandCounts, industries, noExpCount, provinces, sidebarLoading } = useJobSidebarData()
  const filters = useJobListFilters(provinces)
  const {
    expYears, hasFilters, keyword, ordering, page,
    searchBy, searchParamKeyword, searchParams,
    selectedCategories, selectedLocations,
  } = filters
  const { count, loading, results } = useJobListData(searchParams)

  // Thanh tìm kiếm sticky né header (header tự ẩn khi cuộn xuống); sidebar dính ngay dưới nó.
  const headerVisible = useHideOnScroll()
  const searchTop = headerVisible ? 64 : 0
  const sidebarTop = searchTop + 76

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

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories])
  const { groups, childrenOf } = categoryTree
  // Tập lá đang chọn -> để cha/con trong bộ lọc hiển thị checked/indeterminate đúng.
  const selectedLeaves = useMemo(
    () => selectedLeafSet(selectedCategories, categoryTree.leavesUnder),
    [selectedCategories, categoryTree],
  )
  const categoryCheckState = (id) => nodeCheckState(id, selectedLeaves, categoryTree.leavesUnder)
  const toggleCategory = (id) => filters.setCommaParam('cat', toggleCategoryIds(id, selectedCategories, categoryTree))

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

  // Dropdown gợi ý là UI cục bộ của trang: đóng nó mỗi khi một tìm kiếm được chạy.
  function runSearch(nextKeyword, by) {
    setDropdownOpen(false)
    filters.runSearch(nextKeyword, by)
  }

  function handleDropdownSelect(nextKeyword, by) {
    setDropdownOpen(false)
    filters.handleDropdownSelect(nextKeyword, by)
  }

  function openLocationPicker() {
    document.querySelector('#job-location-filter > button')?.click()
  }

  function jumpToResults() {
    document.getElementById('job-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

  function saveFilter() {
    if (!isAuthenticated) {
      // Đăng nhập xong lưu luôn bộ lọc vừa bấm, người dùng ở nguyên trang.
      promptLogin(() => {
        filters.persistFilter()
        message.success('Đăng nhập thành công. Đã lưu bộ lọc.')
      })
      return
    }
    filters.persistFilter()
    message.success('Đã lưu bộ lọc hiện tại')
  }

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

  const openAllCategories = () => {
    setShowAllGroups(true)
    document.getElementById('cat-filter')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const inlineQuickView = quickViewJob && isDesktop

  // Dùng lại cho cả cột dính (desktop) và drawer lọc (mobile).
  const filterSidebar = (
    <JobFilterSidebar
      categoryCheckState={categoryCheckState}
      childrenOf={childrenOf}
      demandCounts={demandCounts}
      expandedGroups={expandedGroups}
      expYears={expYears}
      groups={groups}
      hasFilters={hasFilters}
      industries={industries}
      onApplyCustomSalary={filters.applyCustomSalary}
      onClearFilters={filters.clearFilters}
      onSaveFilter={saveFilter}
      onSalaryChange={filters.onSalaryChange}
      onSetCommaParam={filters.setCommaParam}
      onSetExpandedGroups={setExpandedGroups}
      onSetSalaryFrom={filters.setSalaryFrom}
      onSetSalaryTo={filters.setSalaryTo}
      onSetShowAllGroups={setShowAllGroups}
      onToggleCategory={toggleCategory}
      onToggleExperienceYears={filters.toggleExperienceYears}
      onUpdateParams={filters.updateParams}
      salaryFrom={filters.salaryFrom}
      salaryKey={filters.salaryKey}
      salaryTo={filters.salaryTo}
      searchParams={searchParams}
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
        onCategoryChange={(ids) => filters.setCommaParam('cat', ids)}
        onDropdownClose={() => setDropdownOpen(false)}
        onDropdownOpen={() => setDropdownOpen(true)}
        onDropdownSelect={handleDropdownSelect}
        onKeywordChange={filters.handleKeywordChange}
        onLocationChange={filters.setLocationParam}
        onRunSearch={runSearch}
        onSearchByChange={(by) => filters.updateParams({ search_by: by === 'title' ? null : by })}
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
          onCategorySelect={(id) => filters.setCommaParam('cat', [id])}
          onJumpToResults={jumpToResults}
          onLocationPickerOpen={openLocationPicker}
          onSuggestedLocationSelect={filters.selectSuggestedLocation}
          searchSuggestion={keyword.trim()}
          updateLabel={updateLabel}
        />

        {!selectedLocations.length && hanoiSuggest?.count > 0 && (
          <button
            type="button"
            onClick={() => filters.setLocationParam([hanoiSuggest.id])}
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
            onToggleExperienceYears={filters.toggleExperienceYears}
            onToggleParam={filters.toggleParam}
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
            inlineQuickView ? 'lg:grid-cols-[minmax(340px,400px)_minmax(0,1fr)] lg:items-start' : 'lg:grid-cols-[300px_minmax(0,1fr)]'
          }`}
        >
          {!inlineQuickView && <div className="hidden lg:block">{filterSidebar}</div>}

          <JobResults
            count={count}
            isAuthenticated={isAuthenticated}
            loading={loading}
            onClearAll={hasFilters || searchParamKeyword ? filters.clearAllCriteria : undefined}
            onPageChange={filters.handlePageChange}
            onRequireLogin={promptLogin}
            onSearchByChange={(tabKey) => filters.updateParams({ search_by: tabKey === 'title' ? null : tabKey })}
            onSelectSuggestedWard={(wardId) => filters.setLocationParam([wardId])}
            onSetQuickViewJob={setQuickViewJob}
            onSortChange={(sort) => filters.updateParams({ sort })}
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
                onRequireLogin={promptLogin}
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
        quickViewJob={quickViewJob}
        onFilterDrawerClose={() => setFilterDrawerOpen(false)}
        onQuickViewClose={() => setQuickViewJob(null)}
        onRequireLogin={promptLogin}
      />
    </div>
  )
}
