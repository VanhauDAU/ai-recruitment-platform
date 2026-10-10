import {
  ArrowRightOutlined,
  CompassOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Alert, Button, Pagination, Skeleton } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { getCandidateJobRecommendations, jobKeys } from '@/entities/job'
import { useSession } from '@/entities/session'
import { useHideJobRecommendation } from '@/features/hide-job-recommendation'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import { MascotEmpty } from '@/shared/ui/mascot'
import { groupRecommendationJobs } from '../model/recommendation-reasons'
import CandidateRecommendationCard from './CandidateRecommendationCard'

const ACCOUNT_PAGE_SIZE = 10
const HOME_PAGE_SIZE = 8
const HOME_ROTATE_MS = 8000
const SETTINGS_PATH = '/tai-khoan/cai-dat-goi-y-viec-lam'
const MATCHING_PATH = '/tai-khoan/viec-lam-phu-hop'

function SetupState({ consentRequired = false }) {
  return (
    <div className="rounded-2xl border border-dashed border-emerald-300 bg-gradient-to-br from-emerald-50 to-white px-5 py-10 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-2xl text-[var(--brand-primary)] shadow-sm">
        {consentRequired ? <InfoCircleOutlined /> : <CompassOutlined />}
      </span>
      <h2 className="mt-4 text-lg font-bold text-slate-900">
        {consentRequired ? 'Bật quyền gợi ý việc làm' : 'Hoàn thiện nhu cầu công việc'}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
        {consentRequired
          ? 'Hệ thống chỉ dùng nhu cầu công việc đã lưu sau khi bạn đồng ý. Bạn có thể rút lại quyền này bất cứ lúc nào.'
          : 'Cập nhật vị trí, kỹ năng, kinh nghiệm, mức lương và địa điểm mong muốn để nhận danh sách dành riêng cho bạn.'}
      </p>
      <Link
        to={SETTINGS_PATH}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-bold text-white hover:bg-[var(--brand-primary-hover)]"
      >
        <SettingOutlined />
        Đi tới cài đặt gợi ý
      </Link>
    </div>
  )
}

function AccountLoading() {
  return (
    <div className="space-y-3" aria-label="Đang tải việc làm phù hợp">
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-2xl border border-slate-200 bg-white p-5">
          <Skeleton active avatar paragraph={{ rows: 3 }} />
        </div>
      ))}
    </div>
  )
}

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

function AccountRecommendations({ data, hiddenIds, hide, page, pendingIds, query, setPage }) {
  const jobs = (data?.results || []).filter((job) => !hiddenIds.has(job.public_id))

  return (
    <section className="space-y-4">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#063f32] via-[#087c55] to-[#0fba6b] px-5 py-6 text-white shadow-sm sm:px-6">
        <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full border-[24px] border-white/10" />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-100">Dành riêng cho bạn</p>
          <h1 className="mt-2 text-xl font-extrabold sm:text-2xl">Việc làm phù hợp</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-emerald-50">
            Những công việc phù hợp nhất với bạn dựa trên mong muốn, kỹ năng và kinh nghiệm.
          </p>
        </div>
      </header>

      {query.isPending && <AccountLoading />}
      {query.isError && (
        <Alert
          showIcon
          type="error"
          title="Không thể tải việc làm phù hợp"
          description="Kết nối chưa ổn định. Vui lòng thử lại."
          action={<Button icon={<ReloadOutlined />} onClick={() => query.refetch()}>Thử lại</Button>}
        />
      )}
      {data?.status === 'preferences_required' && <SetupState />}
      {data?.status === 'consent_required' && <SetupState consentRequired />}

      {data?.status === 'ready' && (
        <>
          <div className="flex items-center justify-between gap-3 px-1">
            <p className="text-sm font-semibold text-slate-700">
              {data.pagination?.total || 0} cơ hội phù hợp với tiêu chí của bạn
            </p>
            <Link to={SETTINGS_PATH} className="inline-flex items-center gap-1 text-xs font-bold text-[var(--brand-primary)] hover:underline">
              <SettingOutlined /> Cập nhật tiêu chí
            </Link>
          </div>

          {jobs.length ? (
            <div className="space-y-3">
              {jobs.map((job) => (
                <CandidateRecommendationCard
                  key={job.public_id}
                  job={job}
                  hidePending={pendingIds.has(job.public_id)}
                  onHide={(selected) => hide(selected, 'matching')}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10">
              <MascotEmpty
                scene="profileCheck"
                description={(
                  <>
                    <h2 className="font-bold text-slate-800">Chưa có việc làm đủ phù hợp</h2>
                    <p className="mt-1 text-sm text-slate-500">Hãy cập nhật thêm tiêu chí hoặc quay lại sau khi có tin tuyển dụng mới.</p>
                  </>
                )}
              />
            </div>
          )}

          {(data.pagination?.total_pages || 0) > 1 && (
            <div className="flex justify-center rounded-2xl border border-slate-200 bg-white py-4">
              <Pagination
                current={page}
                pageSize={ACCOUNT_PAGE_SIZE}
                total={data.pagination.total}
                showSizeChanger={false}
                onChange={setPage}
              />
            </div>
          )}
        </>
      )}
    </section>
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
  if (query.isError || data?.status !== 'ready' || groups.length === 0) return null

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
          <p className="mt-1 text-sm text-slate-500">Dựa trên nhu cầu công việc bạn đã lưu.</p>
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
                    compact
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
  const enabled = !home || Boolean(
    isAuthenticated
    && user?.role === 'candidate'
    && user?.job_preferences_configured,
  )
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
