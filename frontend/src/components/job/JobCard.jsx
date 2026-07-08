import { HeartFilled, HeartOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  EDUCATION_LEVEL_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_LEVEL_LABELS,
  EXPERIENCE_YEARS_LABELS,
  POSITION_LEVEL_LABELS,
  WORK_TYPE_LABELS,
  companyInitial,
  formatEducation,
  formatLocations,
  formatSalary,
} from '../../constants/jobOptions'

const SAVED_KEY = 'saved_jobs'

function getSaved() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

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

function Chip({ children }) {
  return (
    <span className="inline-flex max-w-full items-center truncate rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
      {children}
    </span>
  )
}

function extractAgeRequirement(text = '') {
  const match = text.match(/(?:từ\s*)?\d{2}\s*(?:-|–|đến|tới)\s*\d{2}\s*tuổi|\d{2}\s*tuổi/iu)
  return match?.[0]?.replace(/\s+/g, ' ') || null
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

export default function JobCard({ job, isAuthenticated = true, onRequireLogin }) {
  const navigate = useNavigate()
  const [saved, setSaved] = useState(() => getSaved().has(job.public_id))
  const [hovered, setHovered] = useState(false)
  const locationLabel = formatLocations(job)
  const skills = (job.job_skills || []).map((s) => s.skill_name).filter(Boolean)
  const posted = postedLabel(job)
  const ageRequirement = extractAgeRequirement(job.requirements)
  const requirementSummary = [
    yearsRequirement(job),
    ageRequirement,
    formatEducation(job.education_level),
    POSITION_LEVEL_LABELS[job.position_level],
    skillRequirement(skills),
  ].filter(Boolean)
  const requirementDetails = [
    ['Kinh nghiệm', yearsRequirement(job) || EXPERIENCE_LEVEL_LABELS[job.experience_level] || 'Không đề cập'],
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
    const set = getSaved()
    if (saved) set.delete(job.public_id)
    else set.add(job.public_id)
    localStorage.setItem(SAVED_KEY, JSON.stringify([...set]))
    setSaved(!saved)
  }

  function handleApply(e) {
    e.preventDefault()
    e.stopPropagation()
    navigate(`/viec-lam/${job.slug}`)
  }

  return (
    <Link
      to={`/viec-lam/${job.slug}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative flex gap-4 rounded-xl border border-emerald-200 bg-white p-4 transition hover:border-[#00b14f] hover:shadow-md hover:shadow-emerald-600/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00b14f]/25"
    >
      <div className="flex h-20 w-20 md:h-24 md:w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-white">
        {job.company_logo_url ? (
          <img src={job.company_logo_url} alt={job.company_name} className="h-full w-full object-contain p-0.5" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100 text-2xl font-bold text-[#00b14f]">
            {companyInitial(job.company_name)}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-gray-900 leading-snug line-clamp-2 transition-colors group-hover:text-[#00b14f]">
            {job.title}
          </h3>
          <span className="shrink-0 text-sm font-semibold text-[#00b14f]">{formatSalary(job)}</span>
        </div>
        <p className="mt-0.5 truncate text-sm text-gray-500 uppercase">{job.company_name}</p>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {locationLabel && <Chip>{locationLabel}</Chip>}
          {job.experience_level && <Chip>{EXPERIENCE_LEVEL_LABELS[job.experience_level]}</Chip>}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-dashed border-gray-100 pt-2.5 pr-0 md:pr-28">
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
            {posted && <span className="text-xs text-gray-400">{posted}</span>}
            <Tooltip title={isAuthenticated ? (saved ? 'Bỏ lưu việc làm' : 'Lưu việc làm') : 'Hãy đăng nhập để lưu tin'}>
              <button
                type="button"
                onClick={toggleSave}
                aria-label={isAuthenticated ? (saved ? 'Bỏ lưu việc làm' : 'Lưu việc làm') : 'Hãy đăng nhập để lưu tin'}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-gray-200 text-sm transition hover:border-[#00b14f] hover:bg-green-50"
              >
                {saved ? <HeartFilled className="text-[#00b14f]" /> : <HeartOutlined className="text-gray-400" />}
              </button>
            </Tooltip>
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={handleApply}
        className={`absolute bottom-4 right-4 cursor-pointer rounded-full bg-[#00b14f] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 transition-all hover:bg-[#008a3e] ${
          hovered ? 'inline-flex translate-y-0 opacity-100' : 'pointer-events-none hidden translate-y-1 opacity-0'
        }`}
      >
        Ứng tuyển
      </button>
    </Link>
  )
}
