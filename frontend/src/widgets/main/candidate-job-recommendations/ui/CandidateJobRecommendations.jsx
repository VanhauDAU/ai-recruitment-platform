import { ArrowRightOutlined } from '@ant-design/icons'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Skeleton } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { getCandidateJobRecommendations, jobKeys } from '@/entities/job/job'
import { useSession } from '@/entities/account/session'
import { useHideJobRecommendation } from '@/features/main/job/hide-job-recommendation'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import { m } from '@/shared/config/i18n'
import { groupRecommendationJobs } from '../model/recommendation-reasons'
import AccountRecommendations from './AccountRecommendations'
import CandidateRecommendationCard from './CandidateRecommendationCard'

const ACCOUNT_PAGE_SIZE = 10
const HOME_PAGE_SIZE = 8
const HOME_ROTATE_MS = 8000
const MATCHING_PATH = '/tai-khoan/viec-lam-phu-hop'
function HomeLoading() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Đang tải gợi ý việc làm">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="rounded-2xl border border-slate-200 bg-white p-4">
          <Skeleton active avatar paragraph={{ rows: 2 }} />
        </div>
      ))}
    </div>
  )
}

function HomeRecommendations({ data, hiddenIds, hide, pendingIds, query }) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [page, setPage] = useState(0)
  const [paused, setPaused] = useState(false)
  const groups = useMemo(
    () => groupRecommendationJobs((data?.results || []).filter((job) => !hiddenIds.has(job.public_id))),
    [data?.results, hiddenIds],
  )

  useEffect(() => {
    if (page < groups.length) return
    setPage(Math.max(0, groups.length - 1))
  }, [groups.length, page])

  useEffect(() => {
    if (reducedMotion || paused || groups.length < 2) return undefined
    const timer = window.setInterval(() => {
      setPage((current) => (current + 1) % groups.length)
    }, HOME_ROTATE_MS)
    return () => window.clearInterval(timer)
  }, [groups.length, paused, reducedMotion])

  if (query.isPending) {
    return (
      <section aria-labelledby="candidate-recommendations-title" className="max-w-6xl mx-auto px-4 pt-8">
        <h2 id="candidate-recommendations-title" className="mb-4 text-xl font-extrabold text-slate-950 sm:text-2xl">Gợi ý việc làm phù hợp</h2>
        <HomeLoading />
      </section>
    )
  }
  // Trang chủ chỉ hiện gợi ý thật: ứng viên tắt gợi ý bằng AI thì ẩn khối này.
  if (query.isError || data?.status !== 'ready' || data.ai_recommendation_enabled === false || groups.length === 0) return null

  return (
    <section
      aria-labelledby="candidate-recommendations-title"
      className="max-w-6xl mx-auto px-4 pt-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false)
      }}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-emerald-600">Dành riêng cho bạn</p>
          <h2 id="candidate-recommendations-title" className="mt-1 text-xl font-extrabold text-slate-950 sm:text-2xl">Gợi ý việc làm phù hợp</h2>
          <p className="mt-1 text-sm text-slate-500">{m.candidate_reco_home_intro()}</p>
        </div>
        <Link to={MATCHING_PATH} className="inline-flex items-center gap-2 rounded-full border border-emerald-600 px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50">
          Xem tất cả <ArrowRightOutlined />
        </Link>
      </div>

      <div className="overflow-hidden pb-1">
        <div
          className="flex"
          style={{
            transform: `translateX(-${page * 100}%)`,
            transition: reducedMotion ? 'none' : 'transform 420ms ease',
          }}
        >
          {groups.map((group, groupIndex) => (
            <div key={group.map((job) => job.public_id).join(':')} className="min-w-full">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {group.map((job) => (
                  <CandidateRecommendationCard
                    key={job.public_id}
                    job={job}
                    hidePending={pendingIds.has(job.public_id)}
                    onHide={(selected) => hide(selected, 'homepage')}
                  />
                ))}
              </div>
              <span className="sr-only">Trang {groupIndex + 1} trên {groups.length}</span>
            </div>
          ))}
        </div>
      </div>

      {groups.length > 1 && (
        <div className="mt-4 flex justify-center gap-2" aria-label="Chọn trang gợi ý việc làm">
          {groups.map((group, index) => (
            <button
              key={group[0].public_id}
              type="button"
              aria-label={`Xem trang ${index + 1}`}
              aria-current={page === index ? 'true' : undefined}
              onClick={() => setPage(index)}
              className={`h-2.5 cursor-pointer rounded-full transition-all ${page === index ? 'w-7 bg-emerald-600' : 'w-2.5 bg-slate-300 hover:bg-slate-400'}`}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default function CandidateJobRecommendations({ variant = 'account' }) {
  const home = variant === 'home'
  const { isAuthenticated, user } = useSession()
  const [page, setPage] = useState(1)
  // Trang chủ không chờ ứng viên khai nhu cầu: khi gợi ý theo CV bật, CV đã lưu là đủ.
  const enabled = !home || Boolean(isAuthenticated && user?.role === 'candidate')
  const params = useMemo(
    () => ({ page: home ? 1 : page, page_size: home ? HOME_PAGE_SIZE : ACCOUNT_PAGE_SIZE }),
    [home, page],
  )
  const query = useQuery({
    queryKey: jobKeys.candidateRecommendations(params),
    queryFn: () => getCandidateJobRecommendations(params),
    enabled,
    placeholderData: home ? undefined : keepPreviousData,
    retry: 1,
  })
  const hidden = useHideJobRecommendation()

  if (home) {
    if (!enabled) return null
    return <HomeRecommendations data={query.data} query={query} {...hidden} />
  }
  return (
    <AccountRecommendations
      data={query.data}
      page={page}
      query={query}
      setPage={setPage}
      {...hidden}
    />
  )
}
