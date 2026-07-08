import { HeartFilled, HeartOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  EXPERIENCE_LEVEL_LABELS,
  companyInitial,
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

export default function JobCard({ job }) {
  const [saved, setSaved] = useState(() => getSaved().has(job.public_id))
  const locationLabel = formatLocations(job)
  const skills = (job.job_skills || []).map((s) => s.skill_name).filter(Boolean)
  const posted = postedLabel(job)

  function toggleSave(e) {
    e.preventDefault()
    e.stopPropagation()
    const set = getSaved()
    if (saved) set.delete(job.public_id)
    else set.add(job.public_id)
    localStorage.setItem(SAVED_KEY, JSON.stringify([...set]))
    setSaved(!saved)
  }

  return (
    <Link
      to={`/viec-lam/${job.slug}`}
      className="group flex gap-4 rounded-xl border border-emerald-200 bg-white p-4 transition hover:border-[#00b14f] hover:shadow-md hover:shadow-emerald-600/5"
    >
      <div className="flex h-16 w-16 md:h-20 md:w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-white">
        {job.company_logo_url ? (
          <img src={job.company_logo_url} alt={job.company_name} className="h-full w-full object-contain p-1" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100 text-xl font-bold text-[#00b14f]">
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

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-dashed border-gray-100 pt-2.5">
          <p className="min-w-0 truncate text-xs text-gray-500">
            {skills.length > 0 ? (
              <>
                {skills.slice(0, 3).join('  |  ')}
                {skills.length > 3 && <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-gray-500">+{skills.length - 3}</span>}
              </>
            ) : (
              job.short_description
            )}
          </p>
          <span className="flex shrink-0 items-center gap-3">
            {posted && <span className="text-xs text-gray-400">{posted}</span>}
            <button
              type="button"
              onClick={toggleSave}
              aria-label={saved ? 'Bỏ lưu việc làm' : 'Lưu việc làm'}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-gray-200 text-sm transition hover:border-[#00b14f] hover:bg-green-50"
            >
              {saved ? <HeartFilled className="text-[#00b14f]" /> : <HeartOutlined className="text-gray-400" />}
            </button>
          </span>
        </div>
      </div>
    </Link>
  )
}
