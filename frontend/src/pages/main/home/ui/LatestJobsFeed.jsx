import { ArrowUpOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'
import {
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_YEARS_LABELS,
  WORK_TYPE_LABELS,
  companyInitial,
  formatNumber as fmt,
  formatSalary,
  jobDetailPath,
} from '@/entities/job'
import { DEMAND_COLORS } from '../lib/market-stats-palette'
import { useLatestJobsFeed } from '../model/use-latest-jobs-feed'

function formatDate(value) {
  if (!value) return null
  return new Intl.DateTimeFormat('vi-VN').format(new Date(value))
}

function formatDateTime(value) {
  if (!value) return null
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value))
}

function LatestJobTooltip({ job }) {
  const locations = job.location_names?.length ? job.location_names.join(' · ') : job.location_name || 'Chưa cập nhật'
  const details = [
    ['Lương', formatSalary(job)],
    ['Địa điểm', locations],
    ['Kinh nghiệm', EXPERIENCE_YEARS_LABELS[job.experience_years] || 'Không yêu cầu'],
    ['Hình thức', WORK_TYPE_LABELS[job.work_type] || 'Chưa cập nhật'],
    ['Loại việc', EMPLOYMENT_TYPE_LABELS[job.employment_type] || 'Chưa cập nhật'],
    ['Số lượng', job.number_of_vacancies ? `${fmt(job.number_of_vacancies)} vị trí` : 'Không giới hạn'],
    ['Hạn nộp', formatDate(job.deadline) || 'Chưa cập nhật'],
  ]

  return (
    <div className="text-xs leading-relaxed">
      <p className="text-sm font-semibold leading-snug">{job.title}</p>
      <p className="mt-0.5 text-green-100/80">{job.company_name}</p>
      {job.short_description && <p className="mt-2 line-clamp-2 text-white/80">{job.short_description}</p>}
      <div className="mt-2 grid grid-cols-[72px_1fr] gap-x-2 gap-y-1">
        {details.map(([label, value]) => (
          <div key={label} className="contents">
            <span className="text-green-100/65">{label}</span>
            <span className="min-w-0 text-white">{value}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-green-100/65">Đăng: {formatDateTime(job.published_at) || 'Chưa cập nhật'}</p>
    </div>
  )
}

function Mascot() {
  return (
    <div className="flex justify-center">
      <img
        src="https://cdn-new.topcv.vn/unsafe/https://static.topcv.vn/v4/image/welcome/dashboard/dashboard-item.png"
        alt="Thị trường việc làm"
        className="w-36 h-auto object-contain drop-shadow-md"
        loading="lazy"
      />
    </div>
  )
}

// Cột trái MarketStats: mascot + danh sách việc mới trượt vào theo chu kỳ.
export default function LatestJobsFeed({ jobs, enabled }) {
  const feed = useLatestJobsFeed(jobs, enabled)

  return (
    <div>
      <Mascot />
      <p className="font-semibold mt-4 mb-3">Việc làm mới nhất</p>
      <ul className="space-y-2.5 min-h-[180px]">
        {feed.map((item, idx) => (
          <Tooltip
            key={item.uid}
            placement="right"
            title={item.exiting ? null : <LatestJobTooltip job={item.job} />}
            styles={{ inner: { width: 300 } }}
          >
            <li
              onClick={() => !item.exiting && window.open(jobDetailPath(item.job), '_blank', 'noopener,noreferrer')}
              className={`relative flex items-center gap-3 rounded-lg bg-white/5 hover:bg-white/10 p-2.5 cursor-pointer transition ${
                item.exiting
                  ? 'animate-job-exit pointer-events-none'
                  : idx === 0
                    ? 'animate-job-pop pl-9 ring-1 ring-[#3ddc84]/35'
                    : 'animate-job-push'
              }`}
            >
              {idx === 0 && !item.exiting && (
                <span className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#3ddc84] text-[#07351f] shadow-sm">
                  <ArrowUpOutlined className="text-[10px]" />
                </span>
              )}
              <span
                className="w-9 h-9 shrink-0 rounded-md flex items-center justify-center text-sm font-bold text-white"
                style={{ background: DEMAND_COLORS[item.job.title.length % DEMAND_COLORS.length] }}
              >
                {item.job.company_logo_url ? (
                  <img
                    src={item.job.company_logo_url}
                    alt={item.job.company_name}
                    className="h-full w-full rounded-md bg-white object-contain p-0.5"
                    loading="lazy"
                  />
                ) : companyInitial(item.job.company_name)}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{item.job.title}</p>
                <p className="text-xs text-green-100/70 truncate">{item.job.company_name}</p>
              </div>
            </li>
          </Tooltip>
        ))}
      </ul>
    </div>
  )
}
