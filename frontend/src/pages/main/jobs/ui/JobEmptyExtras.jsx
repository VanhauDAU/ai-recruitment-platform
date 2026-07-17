import { useEffect, useState } from 'react'
import { getBanners } from '@/entities/site-settings'
import useInterestedJobs from '../model/use-interested-jobs'
import JobCard from './JobCard'
import JobCardSkeleton from './JobCardSkeleton'

const THEME_CLASS = {
  green: 'from-emerald-700 to-emerald-500',
  blue: 'from-sky-700 to-blue-500',
  orange: 'from-orange-600 to-rose-500',
}

// Phần dưới thông báo "Rất tiếc..." khi tìm việc không có kết quả: banner do
// admin cấu hình (placement job_empty) + khối "Việc làm có thể bạn sẽ quan tâm"
// gợi ý theo nhu cầu đã lưu của ứng viên (use-interested-jobs).
export default function JobEmptyExtras({ isAuthenticated, onRequireLogin, onQuickView, selectedCategories, selectedLocations }) {
  const [banner, setBanner] = useState(null)
  const { jobs, loading } = useInterestedJobs({ selectedCategories, selectedLocations })

  useEffect(() => {
    let cancelled = false
    getBanners('job_empty')
      .then((items) => { if (!cancelled) setBanner(items[0] || null) })
      .catch(() => { if (!cancelled) setBanner(null) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="mt-4 space-y-5">
      {banner && <EmptyBanner banner={banner} />}

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

function EmptyBanner({ banner }) {
  const external = banner.cta_url?.startsWith('http')
  const content = (
    <article className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${THEME_CLASS[banner.theme] || THEME_CLASS.green} px-5 py-5 text-white shadow-sm sm:px-7`}>
      {banner.image_url && <img src={banner.image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" loading="lazy" />}
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div>
          {banner.eyebrow && <p className="text-[11px] font-bold tracking-[0.14em] text-white/80">{banner.eyebrow}</p>}
          <h2 className="mt-1 text-base font-bold leading-6 sm:text-lg">{banner.title}</h2>
          {banner.subtitle && <p className="mt-1.5 text-sm leading-5 text-white/85">{banner.subtitle}</p>}
        </div>
        {banner.cta_label && (
          <span className="inline-flex w-fit shrink-0 items-center rounded-full bg-white px-5 py-2.5 text-sm font-bold text-emerald-700">
            {banner.cta_label} →
          </span>
        )}
      </div>
    </article>
  )
  return banner.cta_url ? (
    <a
      href={banner.cta_url}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="block transition hover:-translate-y-0.5 hover:shadow-md"
    >
      {content}
    </a>
  ) : content
}
