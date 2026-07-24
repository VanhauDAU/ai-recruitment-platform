import {
  CompassOutlined,
  FileTextOutlined,
  HeartFilled,
  ReloadOutlined,
} from '@ant-design/icons'
import { Alert, Button } from 'antd'
import { Link, Navigate } from 'react-router-dom'
import { useSession } from '@/entities/session'
import {
  useSavedJobRecommendations,
  useSavedJobs,
} from '@/features/saved-jobs'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import JobCard from './ui/JobCard'
import JobCardSkeleton from './ui/JobCardSkeleton'

const RECOMMENDATION_LIMIT = 12

function PromoAside() {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-24 overflow-hidden rounded-2xl bg-gradient-to-br from-[#063d30] via-[#087552] to-[var(--brand-primary)] p-6 text-white shadow-lg shadow-emerald-950/10">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-xl ring-1 ring-white/20">
          <FileTextOutlined />
        </span>
        <p className="mt-5 text-xl font-extrabold leading-snug">
          CV tốt hơn,
          <br />
          cơ hội phù hợp hơn
        </p>
        <p className="mt-2 text-sm leading-6 text-emerald-50">
          Tạo CV chuyên nghiệp theo ngành nghề và sẵn sàng ứng tuyển trong vài phút.
        </p>
        <Link
          to="/mau-cv"
          className="mt-5 inline-flex rounded-full !bg-white px-5 py-2.5 text-sm font-bold !text-emerald-700 transition hover:-translate-y-0.5 hover:!bg-emerald-50"
        >
          Tạo CV ngay
        </Link>
      </div>
    </aside>
  )
}

function SavedJobsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-11 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
        <HeartFilled className="text-2xl text-emerald-200" />
      </span>
      <p className="mt-4 text-base font-bold text-gray-800">Bạn chưa lưu việc làm nào</p>
      <p className="mt-1 max-w-md text-sm leading-6 text-gray-500">
        Lưu những tin bạn quan tâm để xem lại nhanh và nhận gợi ý sát hơn với nhu cầu.
      </p>
      <Link
        to="/viec-lam"
        className="mt-5 inline-flex items-center gap-2 rounded-full !bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-semibold !text-white transition hover:!bg-[var(--brand-primary-hover)]"
      >
        <CompassOutlined />
        Khám phá việc làm
      </Link>
    </div>
  )
}

function SectionHeading({ personalized }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 md:text-xl">
        {personalized ? 'Việc làm tương tự việc bạn đã lưu' : 'Việc làm bạn có thể quan tâm'}
      </h2>
      <p className="mt-1 text-sm leading-6 text-gray-500">
        {personalized
          ? 'Xếp hạng theo ngành nghề, kỹ năng và địa điểm xuất hiện trong các tin bạn đã lưu.'
          : 'Các tin tuyển dụng mới đang mở. Gợi ý sẽ sát hơn sau khi bạn lưu việc làm quan tâm.'}
      </p>
    </div>
  )
}

export default function SavedJobs() {
  const { loading: authLoading, isAuthenticated } = useSession()
  const {
    items,
    loading,
    refreshing,
    isCandidate,
    loadError,
    toggleError,
    reload,
  } = useSavedJobs()
  const {
    jobs: recommendations,
    sourceSavedJobCount,
    strategy,
    loading: recommendationsLoading,
    error: recommendationsError,
    reload: reloadRecommendations,
  } = useSavedJobRecommendations(RECOMMENDATION_LIMIT)

  if (!authLoading && !isCandidate) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: '/viec-lam-da-luu',
          reason: isAuthenticated ? 'candidate_only' : 'login_required',
        }}
      />
    )
  }

  const busy = authLoading || loading
  const personalized = strategy === 'saved-job-similarity-v1'
    && sourceSavedJobCount > 0

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:py-8">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
                Danh sách{' '}
                <span className="text-[var(--brand-primary)]">
                  {busy ? '…' : items.length}
                </span>{' '}
                việc làm đã lưu
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Quản lý các cơ hội bạn muốn quay lại hoặc ứng tuyển sau.
              </p>
            </div>
            {refreshing && (
              <span className="text-xs font-medium text-gray-400">Đang đồng bộ…</span>
            )}
          </div>

          {loadError && !busy && (
            <Alert
              showIcon
              type="error"
              className="mt-4"
              message="Chưa tải được việc làm đã lưu"
              description={getApiErrorMessage(
                loadError,
                'Không thể tải danh sách. Vui lòng thử lại.',
              )}
              action={(
                <Button size="small" icon={<ReloadOutlined />} onClick={() => reload()}>
                  Thử lại
                </Button>
              )}
            />
          )}

          {toggleError && !loadError && (
            <Alert
              showIcon
              type="warning"
              className="mt-4"
              message="Thay đổi chưa được lưu"
              description={getApiErrorMessage(
                toggleError,
                'Danh sách đã được khôi phục. Vui lòng thử lại.',
              )}
            />
          )}

          <div className="mt-4 space-y-3">
            {busy ? (
              Array.from({ length: 3 }).map((_, index) => (
                <JobCardSkeleton key={index} />
              ))
            ) : loadError && items.length === 0 ? null : items.length === 0 ? (
              <SavedJobsEmptyState />
            ) : (
              items.map(({ job_detail: job, created_at: savedAt }) => (
                <JobCard
                  key={job.public_id}
                  job={job}
                  savedAt={savedAt}
                  isAuthenticated
                  showQuickView={false}
                />
              ))
            )}
          </div>

          {!authLoading && (
            <section className="mt-9 border-t border-gray-200 pt-7">
              <SectionHeading personalized={personalized} />

              {recommendationsError && !recommendationsLoading ? (
                <Alert
                  showIcon
                  type="warning"
                  className="mt-4"
                  message="Chưa tải được danh sách gợi ý"
                  description={getApiErrorMessage(
                    recommendationsError,
                    'Bạn có thể thử tải lại mà không ảnh hưởng đến danh sách đã lưu.',
                  )}
                  action={(
                    <Button
                      size="small"
                      icon={<ReloadOutlined />}
                      onClick={() => reloadRecommendations()}
                    >
                      Tải lại
                    </Button>
                  )}
                />
              ) : (
                <div className="mt-4 space-y-3">
                  {recommendationsLoading
                    ? Array.from({ length: 3 }).map((_, index) => (
                        <JobCardSkeleton key={index} />
                      ))
                    : recommendations.map((job) => (
                        <JobCard
                          key={job.public_id}
                          job={job}
                          isAuthenticated
                          showQuickView={false}
                        />
                      ))}
                  {!recommendationsLoading
                    && !recommendationsError
                    && recommendations.length === 0 && (
                    <p className="rounded-xl border border-dashed border-gray-200 bg-white px-5 py-8 text-center text-sm text-gray-500">
                      Chưa có tin tuyển dụng đang mở để gợi ý. Hãy quay lại sau nhé.
                    </p>
                  )}
                </div>
              )}
            </section>
          )}
        </div>

        <PromoAside />
      </div>
    </div>
  )
}
