import { BankOutlined, DownOutlined, FilterOutlined, PushpinOutlined, UpOutlined } from '@ant-design/icons'
import { Button, Checkbox, InputNumber, Select, Skeleton } from 'antd'
import {
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_YEARS_LABELS,
  POSITION_LEVEL_LABELS,
  SALARY_RANGES,
  WORK_TYPE_LABELS,
  formatNumber,
} from '@/constants/jobOptions'
import { VISIBLE_GROUPS } from '../utils/jobListParams'
import { FilterSection, FilterSkeleton, MultiChips, SingleChips } from './FilterControls'

export default function JobFilterSidebar({
  categoryCheckState,
  childrenOf,
  demandCounts,
  expandedGroups,
  expYears,
  groups,
  hasFilters,
  industries,
  onApplyCustomSalary,
  onClearFilters,
  onSaveFilter,
  onSetCommaParam,
  onSetExpandedGroups,
  onSetSalaryFrom,
  onSetSalaryTo,
  onSetShowAllGroups,
  onSalaryChange,
  onToggleCategory,
  onToggleExperienceYears,
  onUpdateParams,
  salaryFrom,
  salaryKey,
  salaryTo,
  searchParams,
  showAllGroups,
  sidebarLoading,
  sidebarTop,
}) {
  const visibleGroups = showAllGroups ? groups : groups.slice(0, VISIBLE_GROUPS)

  return (
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
      <div className="filter-sidebar-scroll flex-1 overflow-y-auto p-4">
        <div className="mb-4 flex items-center gap-2">
          <FilterOutlined className="text-[var(--brand-primary)]" />
          <span className="text-base font-bold text-gray-900">Lọc nâng cao</span>
        </div>

        <div id="cat-filter">
          <FilterSection title="Theo danh mục nghề">
            {sidebarLoading ? (
              <FilterSkeleton rows={6} />
            ) : (
              <div className="space-y-2">
                {visibleGroups.map((group) => {
                  const kids = childrenOf[group.id] || []
                  const open = expandedGroups[group.id]
                  const groupState = categoryCheckState(group.id)
                  return (
                    <div key={group.id}>
                      <div className="flex items-center justify-between gap-1">
                        <Checkbox
                          checked={groupState.checked}
                          indeterminate={groupState.indeterminate}
                          onChange={() => onToggleCategory(group.id)}
                          className="min-w-0 flex-1 [&_span:last-child]:!pr-0"
                        >
                          <span className="text-sm text-gray-700">
                            {group.name}
                            {demandCounts[group.id] != null && (
                              <span className="ml-1 text-xs text-gray-400">
                                ({formatNumber(demandCounts[group.id])})
                              </span>
                            )}
                          </span>
                        </Checkbox>
                        {kids.length > 0 && (
                          <button
                            type="button"
                            aria-label={open ? 'Thu gọn' : 'Mở rộng'}
                            onClick={() => onSetExpandedGroups((prev) => ({ ...prev, [group.id]: !open }))}
                            className="shrink-0 cursor-pointer p-1 text-gray-400 hover:text-[var(--brand-primary)]"
                          >
                            {open ? <UpOutlined className="text-[10px]" /> : <DownOutlined className="text-[10px]" />}
                          </button>
                        )}
                      </div>
                      {open && (
                        <div className="mt-1.5 ml-6 space-y-1.5">
                          {kids.map((category) => {
                            const childState = categoryCheckState(category.id)
                            return (
                              <Checkbox
                                key={category.id}
                                checked={childState.checked}
                                indeterminate={childState.indeterminate}
                                onChange={() => onToggleCategory(category.id)}
                                className="!flex"
                              >
                                <span className="text-sm text-gray-600">{category.name}</span>
                              </Checkbox>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
                {groups.length > VISIBLE_GROUPS && (
                  <button
                    type="button"
                    onClick={() => onSetShowAllGroups(!showAllGroups)}
                    className="cursor-pointer text-sm font-medium text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)]"
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
              values={expYears}
              onToggle={onToggleExperienceYears}
              onClear={() => onSetCommaParam('exp', [])}
              options={Object.entries(EXPERIENCE_YEARS_LABELS)}
            />
          </FilterSection>
        </div>

        <div className="mt-4">
          <FilterSection title="Lĩnh vực công ty">
            {sidebarLoading ? (
              <Skeleton.Input active size="medium" block />
            ) : (
              <Select
                className="w-full"
                allowClear
                showSearch
                placeholder="Tất cả lĩnh vực"
                suffixIcon={<BankOutlined className="text-gray-400" />}
                value={searchParams.get('nganh') || undefined}
                onChange={(value) => onUpdateParams({ nganh: value })}
                options={industries.map((industry) => ({ value: String(industry.id), label: industry.name }))}
              />
            )}
          </FilterSection>
        </div>

        <div className="mt-4">
          <FilterSection title="Mức lương">
            <SingleChips
              value={salaryKey === 'custom' ? '' : salaryKey}
              onChange={onSalaryChange}
              options={[...SALARY_RANGES.map((range) => [range.key, range.label]), ['nego', 'Thoả thuận']]}
            />
            <div className="mt-3 flex items-center gap-2">
              <InputNumber min={0} placeholder="Từ" value={salaryFrom} onChange={onSetSalaryFrom} className="!w-full" controls={false} />
              <span className="text-gray-400">-</span>
              <InputNumber min={0} placeholder="Đến" value={salaryTo} onChange={onSetSalaryTo} className="!w-full" controls={false} />
              <span className="text-sm text-gray-500">triệu</span>
            </div>
            <Button
              block
              disabled={!salaryFrom && !salaryTo}
              onClick={onApplyCustomSalary}
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
              onChange={(value) => onUpdateParams({ level: value })}
              options={Object.entries(POSITION_LEVEL_LABELS)}
            />
          </FilterSection>
        </div>

        <div className="mt-4">
          <FilterSection title="Hình thức làm việc">
            <SingleChips
              value={searchParams.get('wt') || ''}
              onChange={(value) => onUpdateParams({ wt: value })}
              options={Object.entries(WORK_TYPE_LABELS)}
            />
          </FilterSection>
        </div>

        <div className="mt-4">
          <FilterSection title="Loại hình làm việc">
            <SingleChips
              value={searchParams.get('et') || ''}
              onChange={(value) => onUpdateParams({ et: value })}
              options={Object.entries(EMPLOYMENT_TYPE_LABELS)}
            />
          </FilterSection>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 flex shrink-0 gap-2 border-t border-gray-200/70 bg-[inherit] px-4 py-3 backdrop-blur">
        <Button block disabled={!hasFilters} onClick={onClearFilters} className="!rounded-full" danger={hasFilters}>
          Xóa lọc
          {hasFilters
            ? ` (${[...searchParams.entries()].filter(([key]) => !['search', 'search_by', 'page', 'ordering'].includes(key)).length})`
            : ''}
        </Button>
        <Button
          block
          type="primary"
          icon={<PushpinOutlined />}
          onClick={onSaveFilter}
          className="!rounded-full !bg-[var(--brand-primary)] !border-[var(--brand-primary)] hover:!bg-[var(--brand-primary-hover)]"
        >
          Lưu bộ lọc
        </Button>
      </div>
    </aside>
  )
}
