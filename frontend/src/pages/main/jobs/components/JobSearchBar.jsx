import { SearchOutlined } from '@ant-design/icons'
import { Button, Input } from 'antd'
import LocationFilter from '../../../../components/job/LocationFilter'
import SearchDropdown from '../../../../components/ui/SearchDropdown'
import CategoryPicker from './CategoryPicker'

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
  selectedLocations,
}) {
  return (
    <div
      style={{ top: searchTop }}
      className="sticky z-20 bg-gradient-to-r from-[#00734d] to-[var(--brand-primary)] transition-[top] duration-300"
    >
      <div className="max-w-6xl mx-auto flex flex-col gap-2 px-4 py-3 md:flex-row">
        <div className="md:w-64 [&_button]:!h-11 [&_button]:!rounded-lg">
          <CategoryPicker categories={categories} value={selectedCategories} onChange={onCategoryChange} />
        </div>
        <div ref={searchBoxRef} className="relative flex flex-1 flex-col gap-2 md:flex-row">
          <Input
            size="large"
            placeholder="Vị trí tuyển dụng, tên công ty"
            prefix={<SearchOutlined className="text-gray-400" />}
            value={keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
            onFocus={onDropdownOpen}
            onPressEnter={() => onRunSearch()}
            allowClear
            className="flex-1 !h-11 !rounded-lg"
          />
          <div className="md:w-72 [&>button]:!h-11 [&>button]:!rounded-lg">
            <LocationFilter value={selectedLocations} onChange={onLocationChange} size="large" />
          </div>
          <Button
            type="primary"
            size="large"
            onClick={() => onRunSearch()}
            className="!h-11 !rounded-lg !px-8 !font-bold !bg-[var(--brand-primary)] hover:!bg-[var(--brand-primary-hover)]"
          >
            Tìm kiếm
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
