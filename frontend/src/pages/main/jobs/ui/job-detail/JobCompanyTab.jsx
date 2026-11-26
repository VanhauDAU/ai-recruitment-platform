import { ExportOutlined, RightOutlined } from '@ant-design/icons'
import { Skeleton } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import { COMPANY_JOBS_TAB, companyDetailPath, jobCompanyPath } from '@/entities/company/company'
import JobCard from '../JobCard'
import useCompanyOtherJobs from '../../model/use-company-other-jobs'
import { CompanyCard } from './JobDetailSidebar'

/** Tab "Công ty" trên mobile: thẻ công ty, giới thiệu, dải việc làm cùng công ty cuộn ngang. */
export default function JobCompanyTab({ job, active, isAuthenticated, onRequireLogin }) {
  return (
    <>
      <CompanyCard job={job} />
      <CompanyAbout job={job} />
      <CompanyJobsRail job={job} enabled={active} isAuthenticated={isAuthenticated} onRequireLogin={onRequireLogin} />
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
      <h2 className="text-base font-bold text-slate-800">Giới thiệu công ty</h2>
      {description && (
        <>
          <p className={`job-company-about__text${expanded ? '' : ' is-clamped'}`}>{description}</p>
          {description.length > 220 && (
            <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className="job-company-about__toggle">
              {expanded ? 'Thu gọn' : 'Xem thêm'}
            </button>
          )}
        </>
      )}
      {industries.length > 0 && (
        <p className="job-company-about__meta"><span>Lĩnh vực</span>{industries.join(', ')}</p>
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

function CompanyJobsRail({ job, enabled, isAuthenticated, onRequireLogin }) {
  const { jobs, total, isPending } = useCompanyOtherJobs(job, { enabled })
  if (!isPending && !jobs.length) return null
  return (
    <section className="rounded-2xl border border-gray-200 bg-white py-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 px-5">
        <h2 className="text-base font-bold text-slate-800">Việc làm cùng công ty</h2>
        {total > 0 && (
          <Link to={job.company_slug ? companyDetailPath(job.company_slug, { tab: COMPANY_JOBS_TAB }) : jobCompanyPath(job)} className="job-company-rail__all">
            Xem tất cả ({total}) <RightOutlined aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className="job-company-rail" aria-label="Việc làm cùng công ty, vuốt ngang để xem thêm">
        {isPending
          ? <div className="job-company-rail__item rounded-2xl border border-gray-200 p-4"><Skeleton active avatar paragraph={{ rows: 2 }} /></div>
          : jobs.map((item) => (
              <div key={item.public_id} className="job-company-rail__item">
                <JobCard job={item} isAuthenticated={isAuthenticated} onRequireLogin={onRequireLogin} showQuickView={false} />
              </div>
            ))}
      </div>
    </section>
  )
}
