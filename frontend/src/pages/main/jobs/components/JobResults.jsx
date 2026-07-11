import { Button, Empty, Pagination, Select } from 'antd'
import { SEARCH_BY_TABS } from '@/components/ui/searchDropdownHistory'
import { PAGE_SIZE } from '../utils/jobListParams'
import JobCard from './JobCard'
import JobCardSkeleton from './JobCardSkeleton'
import WardSuggestionCard from './WardSuggestionCard'

export default function JobResults({
  count,
  isAuthenticated,
  loading,
  onClearAll,
  onPageChange,
  onRequireLogin,
  onSearchByChange,
  onSelectSuggestedWard,
  onSetQuickViewJob,
  onSortChange,
  ordering,
  page,
  quickViewJob,
  results,
  searchBy,
  suggestedWards,
  wardSuggestionInsertIndex,
}) {
  return (
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
                onClick={() => onSearchByChange(tab.key)}
                className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                  active
                    ? 'border-[var(--brand-primary)] bg-green-50 text-[var(--brand-primary)]'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]'
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
            onChange={onSortChange}
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
          {Array.from({ length: 5 }).map((_, index) => (
            <JobCardSkeleton key={index} />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-16">
          <Empty
            description={
              <span className="text-gray-500">
                Rất tiếc, chưa tìm thấy công việc phù hợp với tiêu chí của bạn.
                <br />
                Hãy thử thay đổi từ khóa hoặc bộ lọc để mở rộng kết quả tìm kiếm.
              </span>
            }
          >
            {onClearAll && (
              <Button type="primary" shape="round" onClick={onClearAll}>
                Xóa bộ lọc & từ khóa
              </Button>
            )}
          </Empty>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((job, index) => (
            <div key={job.public_id} className="space-y-3">
              <JobCard
                job={job}
                isAuthenticated={isAuthenticated}
                onRequireLogin={onRequireLogin}
                onQuickView={onSetQuickViewJob}
                compact={Boolean(quickViewJob)}
                active={quickViewJob?.public_id === job.public_id}
              />
              {!quickViewJob && suggestedWards.length > 0 && index + 1 === wardSuggestionInsertIndex && (
                <WardSuggestionCard wards={suggestedWards} onSelect={onSelectSuggestedWard} />
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
            onChange={onPageChange}
            showSizeChanger={false}
          />
        </div>
      )}
    </div>
  )
}
