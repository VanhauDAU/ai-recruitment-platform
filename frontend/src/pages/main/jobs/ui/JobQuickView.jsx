import { CheckCircleFilled, CloseOutlined, HeartFilled, HeartOutlined, RightOutlined } from '@ant-design/icons'
import { Skeleton, Tooltip } from 'antd'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  EDUCATION_LEVEL_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_YEARS_LABELS,
  POSITION_LEVEL_LABELS,
  WORK_TYPE_LABELS,
  companyInitial,
  formatLocations,
  formatSalary,
  getJobDetail,
  jobDetailPath,
  SavedJobTooltipContent,
} from '@/entities/job'
import { useSavedJob } from '@/features/saved-jobs'
import { normalizeRichTextHtml } from '@/shared/lib/rich-text-html'
import { sanitizeHtml } from '@/shared/lib/sanitize-html'

// Khối nội dung văn bản (mô tả/yêu cầu/quyền lợi...) — chỉ render khi có dữ liệu.
function Section({ title, text }) {
  const safeHtml = sanitizeHtml(normalizeRichTextHtml(text))
  const hasText = safeHtml.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
  if (!hasText) return null
  return (
    <section>
      <h3 className="mb-1.5 text-[15px] font-bold text-gray-900">{title}</h3>
      <div
        className="text-sm leading-6 text-gray-700 [&_li]:mb-1 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-0 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5"
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    </section>
  )
}

/**
 * JobQuickView — panel xem nhanh chi tiết job ngay trong trang danh sách,
 * không cần chuyển sang trang chi tiết. Fetch đầy đủ qua `getJobDetail` (kèm Skeleton);
 * header dùng ngay dữ liệu tóm tắt từ card nên hiện tức thì.
 */
// Skeleton hiện tối thiểu một nhịp để việc chuyển layout không "nháy" (data về quá nhanh
// sẽ gây 2 lần đổi giao diện liên tiếp -> giật). Data về sớm hơn thì chờ cho đủ MIN_SKELETON_MS.
const MIN_SKELETON_MS = 400

export default function JobQuickView({ job, onClose, isAuthenticated = true, onRequireLogin }) {
  const navigate = useNavigate()
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saved, toggleSaved, savePending] = useSavedJob(job.public_id)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setDetail(null)
    const startedAt = Date.now()
    getJobDetail(job.slug)
      .then((d) => (cancelled ? null : d))
      .catch(() => (cancelled ? null : job)) // lỗi mạng -> dùng tạm dữ liệu tóm tắt từ card
      .then((d) => {
        if (cancelled) return
        const wait = Math.max(0, MIN_SKELETON_MS - (Date.now() - startedAt))
        setTimeout(() => {
          if (cancelled) return
          setDetail(d)
          setLoading(false)
        }, wait)
      })
    return () => {
      cancelled = true
    }
  }, [job.slug]) // eslint-disable-line react-hooks/exhaustive-deps

  const d = detail || job
  const locationLabel = formatLocations(job)
  const meta = [
    ['Cấp bậc', POSITION_LEVEL_LABELS[d.position_level]],
    ['Kinh nghiệm', EXPERIENCE_YEARS_LABELS[d.experience_years]],
    ['Học vấn', EDUCATION_LEVEL_LABELS[d.education_level]],
    ['Hình thức', WORK_TYPE_LABELS[d.work_type]],
    ['Loại hình', EMPLOYMENT_TYPE_LABELS[d.employment_type]],
    ['Số lượng', d.number_of_vacancies ? `${d.number_of_vacancies} người` : null],
    ['Hạn nộp', d.deadline ? new Date(d.deadline).toLocaleDateString('vi-VN') : null],
  ].filter(([, v]) => v)

  function handleSave() {
    if (!isAuthenticated) {
      onRequireLogin?.()
      return
    }
    toggleSaved()
  }

  return (
    <div
      className="rounded-xl border border-gray-200 bg-white"
      style={{ animation: 'quickViewIn 0.25s ease both' }}
    >
      <style>{`
        @keyframes quickViewIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
        @keyframes quickViewFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* ── Header dính đỉnh panel: tiêu đề + đóng + hành động ── */}
      <div className="sticky top-0 z-10 rounded-t-xl border-b border-gray-100 bg-white p-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold leading-snug text-gray-900">
            {job.title}
            {job.company_verified && (
              <Tooltip title="Tin đã xác thực — công ty được kiểm chứng">
                <CheckCircleFilled className="ml-1.5 translate-y-[-1px] align-middle text-sm !text-emerald-500" />
              </Tooltip>
            )}
          </h2>
          <button
            type="button"
            aria-label="Đóng xem nhanh"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
          >
            <CloseOutlined className="text-xs" />
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">{formatSalary(job)}</span>
          {locationLabel && (
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">{locationLabel} (mới)</span>
          )}
          {d.experience_years && (
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
              {EXPERIENCE_YEARS_LABELS[d.experience_years]}
            </span>
          )}
          <Link
            to={jobDetailPath(job)}
            className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)]"
          >
            Xem chi tiết <RightOutlined className="text-[10px]" />
          </Link>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(jobDetailPath(job))}
            className="flex-1 cursor-pointer rounded-lg bg-[var(--brand-primary)] py-2.5 text-sm font-bold text-white transition hover:bg-[var(--brand-primary-hover)]"
          >
            Ứng tuyển ngay
          </button>
          <Tooltip title={isAuthenticated ? (saved ? <SavedJobTooltipContent /> : 'Lưu việc làm') : 'Hãy đăng nhập để lưu tin'}>
            <button
              type="button"
              onClick={handleSave}
              disabled={savePending}
              aria-label="Lưu việc làm"
              className="flex h-10 w-11 cursor-pointer items-center justify-center rounded-lg border border-[var(--brand-primary)] transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saved ? <HeartFilled className="text-[var(--brand-primary)]" /> : <HeartOutlined className="text-[var(--brand-primary)]" />}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* ── Nội dung chi tiết ── */}
      <div className="space-y-5 p-5">
        {loading ? (
          <>
            <Skeleton active title={{ width: '35%' }} paragraph={{ rows: 4 }} />
            <Skeleton active title={{ width: '30%' }} paragraph={{ rows: 3 }} />
            <Skeleton active title={{ width: '25%' }} paragraph={{ rows: 4 }} />
          </>
        ) : (
          <div className="space-y-5" style={{ animation: 'quickViewFade 0.3s ease both' }}>
            {meta.length > 0 && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-gray-50 p-3.5 sm:grid-cols-3">
                {meta.map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
                    <p className="truncate text-sm font-medium text-gray-800">{value}</p>
                  </div>
                ))}
              </div>
            )}

            <Section title="Mô tả công việc" text={d.description} />
            <Section title="Yêu cầu ứng viên" text={d.requirements} />
            <Section title="Quyền lợi" text={d.benefits} />

            {d.job_locations?.length > 0 && (
              <section>
                <h3 className="mb-1.5 text-[15px] font-bold text-gray-900">Địa điểm làm việc</h3>
                {d.job_locations.map((location) => (
                  <p key={location.id || `${location.location}-${location.address_detail}`} className="text-sm text-gray-700">
                    - {[location.address_detail, location.location_name, location.location_level === 'ward' && location.province_name].filter(Boolean).join(', ')}
                  </p>
                ))}
              </section>
            )}

            {/* ── Thẻ công ty ── */}
            <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-white">
                {job.company_logo_url ? (
                  <img src={job.company_logo_url} alt={job.company_name} className="h-full w-full object-contain p-0.5" loading="lazy" />
                ) : (
                  <span className="text-lg font-bold text-[var(--brand-primary)]">{companyInitial(job.company_name)}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{job.company_name}</p>
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/viec-lam?search=${encodeURIComponent(job.company_name)}&search_by=company`)
                  }
                  className="cursor-pointer text-xs font-medium text-[var(--brand-primary)] hover:underline"
                >
                  Xem trang công ty ↗
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
