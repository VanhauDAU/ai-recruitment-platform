import { CheckCircleFilled, HeartFilled, HeartOutlined, ThunderboltFilled } from '@ant-design/icons'
import { Tooltip } from 'antd'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  EDUCATION_LEVEL_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_YEARS_LABELS,
  POSITION_LEVEL_LABELS,
  WORK_TYPE_LABELS,
  companyInitial,
  formatEducation,
  formatLocations,
  formatSalary,
} from '@/constants/jobOptions'
import { jobDetailPath } from '@/features/jobs'
import { useSavedJob } from '@/hooks/useSavedJobs'
import SavedJobTooltipContent from '@/components/job/SavedJobTooltipContent'

// "Đăng hôm nay" / "Đăng 3 ngày trước" / "Đăng 2 tuần trước"…
function postedLabel(job) {
  const at = job.published_at || job.created_at
  if (!at) return null
  const days = Math.floor((Date.now() - new Date(at)) / 86_400_000)
  if (days <= 0) return 'Đăng hôm nay'
  if (days < 7) return `Đăng ${days} ngày trước`
  if (days < 30) return `Đăng ${Math.floor(days / 7)} tuần trước`
  return `Đăng ${Math.floor(days / 30)} tháng trước`
}

function Chip({ children, elevated = false }) {
  // `elevated`: card nền xanh (featured/top) dùng chip trắng nổi trên nền;
  // card thường nền trắng dùng chip xám để vẫn tách khỏi nền.
  return (
    <span
      className={`inline-flex max-w-full items-center truncate rounded-full px-2.5 py-1 text-xs text-gray-600 ring-1 transition-colors group-hover:bg-gray-100 group-hover:ring-transparent ${
        elevated ? 'bg-white/70 ring-emerald-100' : 'bg-gray-50 ring-gray-200/70'
      }`}
    >
      {children}
    </span>
  )
}

// Nền + viền card theo hạng tin (admin gán): thường trắng, nổi bật/TOP xanh nhạt.
const TIER_CARD_CLASS = {
  standard: 'border-gray-200 bg-white hover:border-[var(--brand-primary)]',
  featured: 'border-emerald-300 bg-emerald-50/65 hover:border-[var(--brand-primary)]',
  top: 'border-emerald-400 bg-emerald-50/80 hover:border-[var(--brand-primary)]',
}

// Nhãn dịch vụ nhỏ đứng trước tiêu đề (TOP đi theo tier, HOT/GẤP là cờ riêng).
function TitleBadges({ job }) {
  return (
    <>
      {job.tier === 'top' && (
        <span className="mr-1.5 inline-block translate-y-[-1px] rounded bg-red-600 px-1.5 py-0.5 align-middle text-[10px] font-bold leading-none text-white">TOP</span>
      )}
      {job.is_hot && (
        <span className="mr-1.5 inline-block translate-y-[-1px] rounded bg-red-50 px-1.5 py-0.5 align-middle text-[10px] font-bold leading-none text-red-600 ring-1 ring-red-200">HOT</span>
      )}
      {job.is_urgent && (
        <span className="mr-1.5 inline-block translate-y-[-1px] rounded bg-orange-50 px-1.5 py-0.5 align-middle text-[10px] font-bold leading-none text-orange-600 ring-1 ring-orange-200">GẤP</span>
      )}
    </>
  )
}

function yearsRequirement(job) {
  const label = EXPERIENCE_YEARS_LABELS[job.experience_years]
  if (!label) return null
  if (job.experience_years === 'none') return 'Không yêu cầu kinh nghiệm'
  return `${label} kinh nghiệm chuyên môn`
}

function skillRequirement(skills) {
  if (!skills.length) return null
  return (
    <>
      {skills.slice(0, 2).join(' | ')}
      {skills.length > 2 && <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-gray-500">+{skills.length - 2}</span>}
    </>
  )
}

function RequirementTooltip({ details }) {
  return (
    <div className="max-w-sm space-y-1.5 text-xs leading-relaxed">
      {details.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[82px_1fr] gap-2">
          <span className="text-white/65">{label}</span>
          <span className="font-medium text-white">{value}</span>
        </div>
      ))}
    </div>
  )
}

// `onQuickView`: click vào card (ngoài tiêu đề) / nút "Xem nhanh" mở panel xem nhanh
// thay vì sang trang chi tiết (tiêu đề vẫn là link sang trang chi tiết).
// `compact`: bản gọn cho cột danh sách khi panel xem nhanh đang mở; `active`: card đang xem.
export default function JobCard({ job, isAuthenticated = true, onRequireLogin, onQuickView, compact = false, active = false, showQuickView = true }) {
  const navigate = useNavigate()
  const [saved, toggleSaved] = useSavedJob(job.public_id)
  const [hovered, setHovered] = useState(false)
  const locationLabel = formatLocations(job)
  const elevated = job.tier === 'featured' || job.tier === 'top'
  const skills = (job.job_skills || []).map((s) => s.skill_name).filter(Boolean)
  const posted = postedLabel(job)
  const ageRequirement = job.age_min && job.age_max
    ? `${job.age_min} - ${job.age_max} tuổi`
    : job.age_min ? `Từ ${job.age_min} tuổi` : job.age_max ? `Đến ${job.age_max} tuổi` : null
  const requirementSummary = [
    yearsRequirement(job),
    ageRequirement,
    formatEducation(job.education_level),
    POSITION_LEVEL_LABELS[job.position_level],
    skillRequirement(skills),
  ].filter(Boolean)
  const requirementDetails = [
    ['Kinh nghiệm', yearsRequirement(job) || 'Không đề cập'],
    ['Độ tuổi', ageRequirement || 'Không đề cập'],
    ['Học vấn', job.education_level ? (EDUCATION_LEVEL_LABELS[job.education_level] || formatEducation(job.education_level)) : 'Không đề cập'],
    ['Cấp bậc', POSITION_LEVEL_LABELS[job.position_level] || 'Không đề cập'],
    ['Hình thức', WORK_TYPE_LABELS[job.work_type] || EMPLOYMENT_TYPE_LABELS[job.employment_type] || 'Không đề cập'],
    ['Chuyên môn', skills.length ? skills.join(', ') : 'Không đề cập'],
  ]

  function toggleSave(e) {
    e.preventDefault()
    e.stopPropagation()
    if (!isAuthenticated) {
      setHovered(false)
      e.currentTarget.blur()
      onRequireLogin?.()
      return
    }
    toggleSaved()
  }

  function handleApply(e) {
    e.preventDefault()
    e.stopPropagation()
    navigate(jobDetailPath(job))
  }

  // Click card / nút "Xem nhanh": mở panel nếu có, ngược lại vào trang chi tiết.
  function handleQuickView(e) {
    e.preventDefault()
    e.stopPropagation()
    if (onQuickView) onQuickView(job)
    else navigate(jobDetailPath(job))
  }

  return (
    <div
      onClick={handleQuickView}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group relative flex min-w-0 cursor-pointer gap-4 rounded-xl border transition-colors duration-200 hover:bg-white hover:shadow-md hover:shadow-emerald-600/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/25 ${
        compact ? 'p-3' : 'p-4'
      } ${active ? 'border-[var(--brand-primary)] bg-white shadow-md shadow-emerald-600/10' : TIER_CARD_CLASS[job.tier] || TIER_CARD_CLASS.standard}`}
    >
      <div className="relative shrink-0">
        <div
          className={`flex items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-white ${
            compact ? 'h-14 w-14' : 'h-20 w-20 md:h-24 md:w-24'
          }`}
        >
          {job.company_logo_url ? (
            <img src={job.company_logo_url} alt={job.company_name} className="h-full w-full object-contain p-0.5" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100 text-2xl font-bold text-[var(--brand-primary)]">
              {companyInitial(job.company_name)}
            </div>
          )}
        </div>
        {job.has_flash_badge && (
          <Tooltip title="Huy hiệu Sấm Chớp — nhà tuyển dụng tương tác nhanh">
            <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#ffda00] to-[#ff8c00] text-[10px] text-white ring-2 ring-white">
              <ThunderboltFilled />
            </span>
          </Tooltip>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className={`flex items-start justify-between gap-3 ${compact ? 'flex-col gap-1' : ''}`}>
          <h3 className="min-w-0 font-semibold text-gray-900 leading-snug line-clamp-2 transition-colors group-hover:text-[var(--brand-primary)]">
            <TitleBadges job={job} />
            <Link
              to={jobDetailPath(job)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="hover:underline underline-offset-2"
            >
              {job.title}
            </Link>
            {job.company_verified && (
              <Tooltip title="Tin đã xác thực — công ty được kiểm chứng">
                <CheckCircleFilled className="ml-1.5 translate-y-[-1px] align-middle text-sm !text-emerald-500" />
              </Tooltip>
            )}
          </h3>
          <span className="shrink-0 text-sm font-semibold text-[var(--brand-primary)]">{formatSalary(job)}</span>
        </div>
        <p className="mt-0.5 truncate text-sm text-gray-500 uppercase">{job.company_name}</p>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {locationLabel && <Chip elevated={elevated}>{locationLabel}</Chip>}
          {job.experience_years && <Chip elevated={elevated}>{EXPERIENCE_YEARS_LABELS[job.experience_years]}</Chip>}
        </div>

        <div className={`mt-3 flex items-center justify-between gap-3 border-t pt-2.5 transition-colors group-hover:border-gray-200/70 ${elevated ? 'border-emerald-100' : 'border-gray-100'}`}>
          <Tooltip
            placement="topLeft"
            title={<RequirementTooltip details={requirementDetails} />}
          >
            <p className="min-w-0 truncate text-xs text-gray-500">
              <span className="font-semibold text-gray-600"></span>
              {requirementSummary.length ? (
                requirementSummary.map((item, index) => (
                  <span key={index}>
                    {index > 0 && <span className="px-1 text-gray-300">|</span>}
                    {item}
                  </span>
                ))
              ) : (
                'Xem chi tiết yêu cầu công việc'
              )}
            </p>
          </Tooltip>
          <span className="flex shrink-0 items-center gap-3">
            {posted && !compact && <span className="text-xs text-gray-400">{posted}</span>}
            {!compact && (
              <button
                type="button"
                onClick={handleApply}
                className={`hidden origin-center cursor-pointer rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-[var(--brand-primary-hover)] hover:shadow-lg hover:shadow-emerald-600/25 md:inline-flex ${
                  hovered ? 'translate-y-0 scale-100 opacity-100 delay-75' : 'pointer-events-none translate-y-2 scale-95 opacity-0'
                }`}
              >
                Ứng tuyển
              </button>
            )}
            <Tooltip title={isAuthenticated ? (saved ? <SavedJobTooltipContent /> : 'Lưu việc làm') : 'Hãy đăng nhập để lưu tin'}>
              <button
                type="button"
                onClick={toggleSave}
                aria-label={isAuthenticated ? (saved ? 'Bỏ lưu việc làm' : 'Lưu việc làm') : 'Hãy đăng nhập để lưu tin'}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-gray-200 text-sm transition hover:border-[var(--brand-primary)] hover:bg-green-50"
              >
                {saved ? <HeartFilled className="text-[var(--brand-primary)]" /> : <HeartOutlined className="text-gray-400" />}
              </button>
            </Tooltip>
          </span>
        </div>
      </div>
      {!compact && showQuickView && (
        <button
          type="button"
          onClick={handleQuickView}
          className={`absolute right-4 top-[52px] hidden origin-center cursor-pointer items-center gap-1 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-[var(--brand-primary)] shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-emerald-100 hover:shadow-md md:inline-flex ${
            hovered ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-2 scale-95 opacity-0'
          }`}
        >
          Xem nhanh <span className={`text-base leading-none transition-transform duration-300 ${hovered ? 'translate-x-0.5' : ''}`}>»</span>
        </button>
      )}
    </div>
  )
}
