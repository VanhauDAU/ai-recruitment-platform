import { ExportOutlined, RightOutlined } from '@ant-design/icons'
import { Skeleton } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import { COMPANY_JOBS_TAB, companyDetailPath, jobCompanyPath } from '@/entities/company/company'
import { EXPERIENCE_YEARS_LABELS, formatLocations, formatSalary, jobDetailPath } from '@/entities/job/job'
import { m } from '@/shared/config/i18n'
import useCompanyOtherJobs from '../../model/use-company-other-jobs'
import { CompanyCard } from './JobDetailSidebar'

/** Tab "Công ty" trên mobile: thẻ công ty, giới thiệu, dải việc làm cùng công ty cuộn ngang. */
export default function JobCompanyTab({ job, active }) {
  return (
    <>
      <CompanyCard job={job} />
      <CompanyAbout job={job} />
      <CompanyJobsRail job={job} enabled={active} />
    </>
  )
}

function CompanyAbout({ job }) {
  const [expanded, setExpanded] = useState(false)
  const description = job.company_description?.trim()
  const industries = job.company_industries || []
  if (!description && !industries.length && !job.company_website_url) return null
  return (
    <section className="job-company-about rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-slate-800">{m.candidate_job_company_about()}</h2>
      {description && (
        <>
          <p className={`job-company-about__text${expanded ? '' : ' is-clamped'}`}>{description}</p>
          {description.length > 220 && (
            <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className="job-company-about__toggle">
              {expanded ? m.candidate_job_company_show_less() : m.candidate_job_company_show_more()}
            </button>
          )}
        </>
      )}
      {industries.length > 0 && (
        <p className="job-company-about__meta"><span>{m.candidate_job_company_industries()}</span>{industries.join(', ')}</p>
      )}
      {job.company_website_url && (
        <p className="job-company-about__meta">
          <span>Website</span>
          <a href={job.company_website_url} target="_blank" rel="noopener noreferrer nofollow" className="job-company-about__link">
            {job.company_website_url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')} <ExportOutlined aria-hidden="true" />
          </a>
        </p>
      )}
    </section>
  )
}

function CompanyJobsRail({ job, enabled }) {
  const { jobs, total, isPending } = useCompanyOtherJobs(job, { enabled })
  if (!isPending && !jobs.length) return null
  return (
    <section className="rounded-2xl border border-gray-200 bg-white py-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 px-5">
        <h2 className="text-base font-bold text-slate-800">{m.candidate_job_company_jobs()}</h2>
        {total > 0 && (
          <Link to={job.company_slug ? companyDetailPath(job.company_slug, { tab: COMPANY_JOBS_TAB }) : jobCompanyPath(job)} className="job-company-rail__all">
            {m.candidate_job_company_jobs_all({ count: total })} <RightOutlined aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className="job-company-rail" aria-label={m.candidate_job_company_jobs_swipe()}>
        {isPending
          ? <div className="job-company-rail__item job-company-mini"><Skeleton active title={false} paragraph={{ rows: 3 }} /></div>
          : jobs.map((item) => <CompanyJobMini key={item.public_id} job={item} />)}
      </div>
    </section>
  )
}

// Thẻ thấp cho dải ngang: cùng công ty nên bỏ logo/tên công ty, chỉ còn tiêu đề, lương, nơi làm · kinh nghiệm.
function CompanyJobMini({ job }) {
  const meta = [formatLocations(job), EXPERIENCE_YEARS_LABELS[job.experience_years]].filter(Boolean).join(' · ')
  return (
    <Link to={jobDetailPath(job)} className="job-company-rail__item job-company-mini">
      <span className="job-company-mini__title">{job.title}</span>
      <span className="job-company-mini__salary">{formatSalary(job)}</span>
      {meta && <span className="job-company-mini__meta">{meta}</span>}
    </Link>
  )
}
