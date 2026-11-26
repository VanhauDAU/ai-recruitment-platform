import { SearchOutlined } from '@ant-design/icons'
import { Button, Input } from 'antd'
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { JobCategoryTreePicker } from '@/entities/job/job'
import { LocationFilter } from '@/entities/system/location'
import { SearchDropdown } from '@/features/main/job/search-jobs'
import { useMediaQuery } from '@/shared/hooks/use-media-query'

export default function JobSearchBar({
  categories,
  dropdownOpen,
  keyword,
  onCategoryChange,
  onDropdownClose,
  onDropdownOpen,
  onDropdownSelect,
  onKeywordChange,
  onLocationChange,
  onRunSearch,
  onSearchByChange,
  searchBoxRef,
  searchBy,
  searchTop,
  selectedCategories,
  selectedLocationLabel,
  selectedLocations,
}) {
  // Mobile xếp ô tìm kiếm thành lưới (khối từ khóa bị `display: contents`, không đo được
  // kích thước), nên dropdown gợi ý neo vào cả thanh thay vì khối từ khóa.
  const isMdUp = useMediaQuery('(min-width: 768px)')
  const keywordRef = useRef(null)
  const focusSearch = useLocation().state?.focusSearch

  // Nút kính lúp ở header (Header.jsx) gửi `state.focusSearch`: lên đầu trang và đặt
  // con trỏ vào ô từ khóa, kể cả khi đang đứng sẵn ở trang danh sách.
  useEffect(() => {
    if (!focusSearch) return
    window.scrollTo({ top: 0, behavior: 'smooth' })
    keywordRef.current?.focus({ preventScroll: true })
  }, [focusSearch])

  return (
    <div
      style={{ top: searchTop }}
      className="job-search-bar sticky z-20 bg-gradient-to-r from-[#00734d] to-[var(--brand-primary)] transition-[top] duration-300"
    >
      <div
        ref={isMdUp ? undefined : searchBoxRef}
        className="job-search-bar__inner max-w-6xl mx-auto flex flex-col gap-2 px-4 py-3 md:flex-row"
      >
        <div className={`job-search-bar__category md:w-64 md:[&_button]:!h-11 md:[&_button]:!rounded-lg${selectedCategories?.length ? ' is-active' : ''}`}>
          <JobCategoryTreePicker
            ariaLabel="Danh mục nghề"
            categories={categories}
            placeholder={isMdUp ? 'Danh mục Nghề' : 'Ngành nghề'}
            value={selectedCategories}
            onChange={onCategoryChange}
          />
        </div>
        <div ref={isMdUp ? searchBoxRef : undefined} className="job-search-bar__box relative flex flex-1 flex-col gap-2 md:flex-row">
          <Input
            ref={keywordRef}
            size="large"
            placeholder="Vị trí tuyển dụng, tên công ty"
            prefix={<SearchOutlined className="text-gray-400" />}
            value={keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
            onFocus={onDropdownOpen}
            onPressEnter={() => onRunSearch()}
            allowClear
            className="job-search-bar__keyword flex-1 md:!h-11 !rounded-lg"
          />
          <div id="job-location-filter" className={`job-search-bar__location md:w-72 md:[&>button]:!h-11 md:[&>button]:!rounded-lg${selectedLocations?.length ? ' is-active' : ''}`}>
            <LocationFilter
              value={selectedLocations}
              onChange={onLocationChange}
              size="large"
              displayLabel={selectedLocationLabel}
            />
          </div>
          <Button
            type="primary"
            size="large"
            aria-label="Tìm kiếm"
            onClick={() => onRunSearch()}
            className="job-search-bar__submit md:!h-11 !rounded-lg !font-bold !bg-[var(--brand-primary)] hover:!bg-[var(--brand-primary-hover)]"
          >
            <SearchOutlined className="job-search-bar__submit-icon" />
            <span className="job-search-bar__submit-label">Tìm kiếm</span>
          </Button>
          <SearchDropdown
            open={dropdownOpen}
            onClose={onDropdownClose}
            onSelect={onDropdownSelect}
            keyword={keyword}
            searchBy={searchBy}
            onSearchByChange={onSearchByChange}
            wrapperRef={searchBoxRef}
          />
        </div>
      </div>
    </div>
  )
}
