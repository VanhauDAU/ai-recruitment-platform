import {
  ArrowRightOutlined,
  CheckCircleFilled,
  CompassOutlined,
  EnvironmentOutlined,
  HeartFilled,
  HeartOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  SettingOutlined,
  StarFilled,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Pagination, Skeleton, Tooltip } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import {
  formatLocations,
  formatSalary,
  getCandidateJobRecommendations,
  jobDetailPath,
  jobKeys,
} from '@/entities/job'
import { useSavedJob } from '@/features/saved-jobs'
import { JobImpressionBoundary } from '@/features/track-job-engagement'
import { MascotEmpty } from '@/shared/ui/mascot'

const PAGE_SIZE = 10
const SETTINGS_PATH = '/tai-khoan/cai-dat-goi-y-viec-lam'

function MatchReasons({ details = [] }) {
  return (
    <Tooltip
      placement="bottomLeft"
      title={(
        <ul className="space-y-1.5 py-1">
          {details.map((detail) => (
            <li key={detail.code} className="flex items-center justify-between gap-4">
              <span>{detail.label}</span>
              <b>+{detail.points}</b>
            </li>
          ))}
        </ul>
      )}
    >
      <button
        type="button"
        className="inline-flex cursor-help items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
      >
        <InfoCircleOutlined />
        Vì sao phù hợp?
      </button>
    </Tooltip>
  )
}

function MatchingJobCard({ job }) {
  const [saved, toggleSaved, savePending] = useSavedJob(job.public_id, job)
  const detailPath = jobDetailPath(job)

  return (
    <JobImpressionBoundary slug={job.slug}>
      <article className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_12px_30px_rgba(16,185,129,0.1)]">
        <div className="flex gap-3 sm:gap-4">
          <Link
            to={detailPath}
            aria-label={`Xem chi tiết ${job.title} qua logo công ty`}
            className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white sm:h-20 sm:w-20"
          >
            {job.company_logo_url ? (
              <img src={job.company_logo_url} alt="" className="h-full w-full object-contain p-2" />
            ) : (
              <span className="text-2xl font-black text-[var(--brand-primary)]">
                {job.company_name?.charAt(0) || 'P'}
              </span>
            )}
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  to={detailPath}
                  className="line-clamp-2 text-base font-bold leading-6 text-slate-900 transition group-hover:text-[var(--brand-primary)]"
                >
                  {job.title}
                </Link>
                <p className="mt-0.5 truncate text-sm text-slate-500">
                  {job.company_name}
                  {job.company_verified && (
                    <CheckCircleFilled className="ml-1 text-sky-500" title="Nhà tuyển dụng đã xác thực" />
                  )}
                </p>
              </div>
              <button
                type="button"
                aria-label={saved ? 'Bỏ lưu việc làm' : 'Lưu việc làm'}
                disabled={savePending}
                onClick={toggleSaved}
                className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full border border-slate-200 text-base text-slate-400 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-[var(--brand-primary)] disabled:cursor-wait disabled:opacity-50"
              >
                {saved ? <HeartFilled className="text-[var(--brand-primary)]" /> : <HeartOutlined />}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
              <span className="rounded-lg bg-slate-100 px-2.5 py-1">{formatSalary(job)}</span>
              {formatLocations(job) && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1">
                  <EnvironmentOutlined />
                  {formatLocations(job)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
              job.is_high_match
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-sky-50 text-sky-700'
            }`}>
              <StarFilled />
              {job.is_high_match ? 'Rất phù hợp' : `${job.match_score}% phù hợp`}
            </span>
            <MatchReasons details={job.match_details} />
          </div>
          <Link
            to={detailPath}
            className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-primary)] px-4 py-2 text-xs font-bold text-white transition hover:bg-[var(--brand-primary-hover)]"
          >
            Xem việc làm <ArrowRightOutlined />
          </Link>
        </div>
      </article>
    </JobImpressionBoundary>
  )
}

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
          ? 'Hệ thống chỉ đọc nhu cầu và CV để xếp hạng sau khi bạn đồng ý. Bạn có thể rút lại quyền này bất cứ lúc nào.'
          : 'Cập nhật vị trí, kinh nghiệm, mức lương và địa điểm mong muốn để nhận danh sách dành riêng cho bạn.'}
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

function RecommendationSources({ data }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Dữ liệu đang được dùng</h2>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
              Nhu cầu công việc
            </span>
            {data.sources?.cv && (
              <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-700">
                CV: {data.source_cv?.title || 'CV gần nhất'}
              </span>
            )}
          </div>
          {!data.sources?.cv && (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Chưa có CV; kết quả hiện dựa trên nhu cầu công việc đã lưu.
            </p>
          )}
        </div>
        <Link
          to={SETTINGS_PATH}
          className="inline-flex items-center gap-1 text-xs font-bold text-[var(--brand-primary)] hover:underline"
        >
          <SettingOutlined /> Cập nhật tiêu chí
        </Link>
      </div>
    </div>
  )
}

export default function MatchingJobs() {
  const [page, setPage] = useState(1)
  const params = { page, page_size: PAGE_SIZE }
  const query = useQuery({
    queryKey: jobKeys.candidateRecommendations(params),
    queryFn: () => getCandidateJobRecommendations(params),
    retry: 1,
  })
  const data = query.data

  return (
    <section className="space-y-4">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#063f32] via-[#087c55] to-[#0fba6b] px-5 py-6 text-white shadow-sm sm:px-6">
        <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full border-[24px] border-white/10" />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-100">Dành riêng cho bạn</p>
          <h1 className="mt-2 text-xl font-extrabold sm:text-2xl">Việc làm phù hợp</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-emerald-50">
            Xếp hạng minh bạch theo vị trí mong muốn, kỹ năng trên CV, kinh nghiệm,
            địa điểm và mức lương của bạn.
          </p>
        </div>
      </header>

      {query.isPending && (
        <div className="space-y-3" aria-label="Đang tải việc làm phù hợp">
          {[0, 1, 2].map((item) => (
            <div key={item} className="rounded-2xl border border-slate-200 bg-white p-5">
              <Skeleton active avatar paragraph={{ rows: 3 }} />
            </div>
          ))}
        </div>
      )}

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
          <RecommendationSources data={data} />
          <div className="flex items-center justify-between gap-3 px-1">
            <p className="text-sm font-semibold text-slate-700">
              {data.pagination?.total || 0} cơ hội phù hợp với tiêu chí của bạn
            </p>
            {query.isFetching && !query.isPending && <span className="text-xs text-slate-400">Đang cập nhật…</span>}
          </div>

          {data.results?.length ? (
            <div className="space-y-3">
              {data.results.map((job) => <MatchingJobCard key={job.public_id} job={job} />)}
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
                pageSize={PAGE_SIZE}
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
