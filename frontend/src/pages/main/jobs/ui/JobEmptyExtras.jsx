import useInterestedJobs from '../model/use-interested-jobs'
import JobCard from './JobCard'
import JobCardSkeleton from './JobCardSkeleton'
import PlacementBanner from './PlacementBanner'

// Phần dưới thông báo "Rất tiếc..." khi tìm việc không có kết quả: banner do
// admin cấu hình (placement job_empty) + khối "Việc làm có thể bạn sẽ quan tâm"
// gợi ý theo nhu cầu đã lưu của ứng viên (use-interested-jobs).
export default function JobEmptyExtras({ isAuthenticated, onRequireLogin, onQuickView, selectedCategories, selectedLocations }) {
  const { jobs, loading } = useInterestedJobs({ selectedCategories, selectedLocations })

  return (
    <div className="mt-4 space-y-5">
      <PlacementBanner placement="job_empty" />

      {(loading || jobs.length > 0) && (
        <section aria-label="Việc làm có thể bạn sẽ quan tâm">
          <h2 className="text-lg font-bold text-gray-800">Việc làm có thể bạn sẽ quan tâm</h2>
          <div className="mt-3 space-y-3">
            {loading
              ? Array.from({ length: 3 }).map((_, index) => <JobCardSkeleton key={index} />)
              : jobs.map((job) => (
                <JobCard
                  key={job.public_id}
                  job={job}
                  isAuthenticated={isAuthenticated}
                  onRequireLogin={onRequireLogin}
                  onQuickView={onQuickView}
                />
              ))}
          </div>
        </section>
      )}
    </div>
  )
}
