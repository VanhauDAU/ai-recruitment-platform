import { DownOutlined, FileTextOutlined, MessageOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Empty, Skeleton, Tag, Timeline, Tooltip } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CANDIDATE_APPLICATION_FILTERS,
  CANDIDATE_APPLICATION_STATUS_LABELS,
  applicationKeys,
  getCandidateApplications,
} from '@/entities/application'

const STATUS_COLORS = {
  submitted: 'blue',
  viewed: 'cyan',
  considering: 'gold',
  shortlisted: 'green',
  interviewed: 'purple',
  accepted: 'green',
  rejected: 'default',
}

const STEPS = [
  ['Ứng viên gửi hồ sơ thành công', ''],
  ['NTD tiếp nhận hồ sơ', 'Bộ phận tuyển dụng xem và đánh giá hồ sơ'],
  ['NTD xem hồ sơ', 'Phòng ban chuyên môn đánh giá, cân nhắc hồ sơ'],
  ['NTD xử lý hồ sơ', ''],
  ['NTD phản hồi ứng viên', ''],
]

function formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function ProcessGuide() {
  return (
    <div className="rounded-xl bg-slate-50 p-4 sm:p-5">
      <p className="text-center text-xs font-bold uppercase tracking-wide text-slate-500">Quy trình ứng tuyển</p>
      <ol className="mt-4 grid gap-4 sm:grid-cols-5">
        {STEPS.map(([label, hint], index) => (
          <li key={label} className="relative flex gap-3 sm:flex-col sm:items-center sm:text-center">
            {/*
              Thanh nối chạy từ tâm bước trước sang tâm bước này: nửa bề rộng một ô (50%) cộng
              khoảng gap-4 (1rem). Nằm dưới vòng tròn (z-0) nên số thứ tự vẫn nổi lên trên.
            */}
            {index > 0 && (
              <span
                aria-hidden="true"
                className="absolute right-1/2 top-3.5 z-0 hidden h-0.5 -translate-y-1/2 bg-slate-200 sm:block"
                style={{ left: 'calc(-50% - 1rem)' }}
              />
            )}
            <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)] text-xs font-bold text-white">
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-slate-700">{label}</span>
              {hint && <span className="mt-0.5 block text-[11px] leading-4 text-slate-400">{hint}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function ApplicationCard({ application, expanded, onToggle }) {
  const timeline = application.timeline || []
  const latest = timeline[0]
  const statusLabel = application.candidate_status
    || CANDIDATE_APPLICATION_STATUS_LABELS[application.status]

  return (
    <article className="rounded-xl border border-slate-200 p-4">
      <div className="flex gap-3">
        {application.company_logo_url
          ? <img src={application.company_logo_url} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-contain" />
          : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-lg font-black text-slate-400">
              {(application.company_name || '?').charAt(0).toUpperCase()}
            </span>
          )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              {application.job_slug
                ? <Link to={`/viec-lam/${application.job_slug}`} className="font-bold text-slate-900 hover:text-[var(--brand-primary)]">{application.job_title}</Link>
                : <span className="font-bold text-slate-900">{application.job_title}</span>}
              <p className="mt-0.5 truncate text-xs font-semibold uppercase text-slate-500">{application.company_name}</p>
            </div>
            <Tag color={STATUS_COLORS[application.status]} className="!mr-0">{statusLabel}</Tag>
          </div>

          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>Ứng tuyển: {formatDateTime(application.applied_at)}</span>
            <span className="inline-flex items-center gap-1">
              <FileTextOutlined />
              {application.cv_public_id
                ? <Link to={`/cvs/${application.cv_public_id}/view`} className="font-medium text-[var(--brand-primary)] hover:underline">{application.submitted_cv_title}</Link>
                : <span>{application.submitted_cv_title}</span>}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <p className="text-sm text-slate-700">
          <strong className="font-semibold">{latest?.label || statusLabel}</strong>
          {latest && <span className="text-slate-400"> ({formatDateTime(latest.occurred_at)})</span>}
        </p>
        <Tooltip title="Nhắn tin với nhà tuyển dụng sẽ được mở trong giai đoạn tiếp theo">
          <span
            aria-disabled="true"
            className="inline-flex h-8 cursor-not-allowed items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-400"
          >
            <MessageOutlined /> Nhắn tin
          </span>
        </Tooltip>
      </div>

      {timeline.length > 0 && (
        <div className="mt-3 rounded-lg bg-slate-50 px-4 py-3">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="flex w-full cursor-pointer items-center justify-between gap-2 text-left text-sm font-semibold text-slate-700"
          >
            Tiến trình ứng tuyển
            <DownOutlined className={`text-xs text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
          {expanded && (
            <Timeline
              className="mt-4 [&_.ant-timeline-item-last]:!pb-0"
              items={timeline.map((item, index) => ({
                color: index === 0 ? 'green' : 'gray',
                children: (
                  <>
                    <span className="block text-sm text-slate-700">{item.label}</span>
                    <span className="block text-xs text-slate-400">{formatDateTime(item.occurred_at)}</span>
                  </>
                ),
              }))}
            />
          )}
        </div>
      )}
    </article>
  )
}

export default function AppliedJobs() {
  const applicationsQuery = useQuery({ queryKey: applicationKeys.candidateList, queryFn: getCandidateApplications })
  const [statusFilter, setStatusFilter] = useState('all')
  // Chỉ tin đầu tiên mở sẵn; các tin sau đóng cho tới khi người dùng bấm mở.
  const [collapsedIds, setCollapsedIds] = useState(() => new Set())
  const [expandedIds, setExpandedIds] = useState(() => new Set())

  if (applicationsQuery.isLoading) return <Skeleton active paragraph={{ rows: 10 }} />

  const applications = applicationsQuery.data || []
  const counts = applications.reduce((total, item) => {
    total[item.status] = (total[item.status] || 0) + 1
    return total
  }, {})
  const filters = [['all', 'Tất cả'], ...CANDIDATE_APPLICATION_FILTERS.filter(([value]) => counts[value])]
  const visible = statusFilter === 'all'
    ? applications
    : applications.filter((item) => item.status === statusFilter)

  function isExpanded(application, index) {
    if (expandedIds.has(application.public_id)) return true
    if (collapsedIds.has(application.public_id)) return false
    return index === 0
  }

  function toggle(application, index) {
    const open = isExpanded(application, index)
    const nextExpanded = new Set(expandedIds)
    const nextCollapsed = new Set(collapsedIds)
    if (open) {
      nextExpanded.delete(application.public_id)
      nextCollapsed.add(application.public_id)
    } else {
      nextCollapsed.delete(application.public_id)
      nextExpanded.add(application.public_id)
    }
    setExpandedIds(nextExpanded)
    setCollapsedIds(nextCollapsed)
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-extrabold text-slate-900">Việc làm đã ứng tuyển</h1>
        <p className="mt-1 text-sm text-slate-500">Theo dõi các mốc xử lý hồ sơ mà nhà tuyển dụng chia sẻ với bạn.</p>
      </div>

      {!applications.length ? <Empty description="Bạn chưa ứng tuyển việc làm nào" /> : (
        <>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Lọc theo trạng thái hồ sơ">
            {filters.map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={statusFilter === value}
                onClick={() => setStatusFilter(value)}
                className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition ${statusFilter === value
                  ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] font-semibold text-[var(--brand-primary)]'
                  : 'border-slate-200 text-slate-600 hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]'
                }`}
              >
                {label} {value === 'all' ? applications.length : counts[value]}
              </button>
            ))}
          </div>

          <div className="mt-4"><ProcessGuide /></div>

          <div className="mt-4 space-y-4">
            {visible.map((application, index) => (
              <ApplicationCard
                key={application.public_id}
                application={application}
                expanded={isExpanded(application, index)}
                onToggle={() => toggle(application, index)}
              />
            ))}
            {!visible.length && <Empty description="Không có hồ sơ nào ở trạng thái này" />}
          </div>
        </>
      )}
    </section>
  )
}
