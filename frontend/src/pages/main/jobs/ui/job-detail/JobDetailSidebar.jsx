import { BankOutlined, ClockCircleOutlined, ExportOutlined, ReadOutlined, SolutionOutlined, TagsOutlined, TeamOutlined } from '@ant-design/icons'
import { Link } from 'react-router'
import { jobCompanyPath } from '@/entities/company/company'
import {
  EDUCATION_LEVEL_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  POSITION_LEVEL_LABELS,
  WORK_TYPE_LABELS,
  companyInitial,
  VerifiedEmployerBadge,
} from '@/entities/job/job'
import JobSafetyTips from './JobSafetyTips'
import JobSidebarPromos from './JobSidebarPromos'
import { useNewTabLinkProps } from '@/shared/hooks/use-new-tab-link-props'

export default function JobDetailSidebar({ job, fitAction = null }) {
  // Không lặp "Kinh nghiệm" ở đây — đã có ở Hero và tag Yêu cầu.
  const generalInfo = [
    { icon: <SolutionOutlined />, label: 'Cấp bậc', value: POSITION_LEVEL_LABELS[job.position_level] },
    { icon: <ReadOutlined />, label: 'Học vấn', value: job.education_level ? (EDUCATION_LEVEL_LABELS[job.education_level] || job.education_level) : null },
    { icon: <TeamOutlined />, label: 'Số lượng tuyển', value: job.number_of_vacancies ? `${job.number_of_vacancies} người` : null },
    { icon: <BankOutlined />, label: 'Hình thức làm việc', value: WORK_TYPE_LABELS[job.work_type] },
    { icon: <ClockCircleOutlined />, label: 'Loại hình làm việc', value: EMPLOYMENT_TYPE_LABELS[job.employment_type] },
  ].filter((item) => item.value)

  return <aside className="space-y-5 lg:sticky lg:top-[84px]"><CompanyCard job={job} />{fitAction}<GeneralInfo items={generalInfo} /><RelatedTopics job={job} /><JobSafetyTips /><JobSidebarPromos /></aside>
}

function CompanyCard({ job }) {
  const newTab = useNewTabLinkProps()
  const size = job.company_size && !/nhân viên/i.test(job.company_size) ? `${job.company_size} nhân viên` : job.company_size
  return (
    <section className="job-company-card rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="job-company-card__logo flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5">
          {job.company_logo_url
            ? <img src={job.company_logo_url} alt={job.company_name} className="h-full w-full object-contain" />
            : <span className="text-2xl font-bold text-[var(--brand-primary)]">{companyInitial(job.company_name)}</span>}
        </div>
        <div className="min-w-0">
          <p className="line-clamp-3 text-base font-bold uppercase leading-6 text-slate-800">{job.company_name}</p>
          <VerifiedEmployerBadge verification={job.company_verification} verified={job.company_verified} showCriteria appearance="label" className="mt-1" />
        </div>
      </div>
      <div className="mt-4 space-y-2.5">
        <CompanyInfo icon={<TeamOutlined />} label="Quy mô" value={size} />
        <CompanyInfo icon={<BankOutlined />} label="Địa điểm" value={job.company_address} />
      </div>
      {/* Nền/chữ phải dùng `!`: reset của antd đặt style thẻ `a` ngoài layer nên thắng utility thường. */}
      <Link to={jobCompanyPath(job)} {...newTab} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--brand-primary)] !bg-white text-sm font-semibold !text-[var(--brand-primary)] transition hover:!bg-[var(--brand-primary-soft)]">
        Xem trang công ty<ExportOutlined />
      </Link>
    </section>
  )
}

function CompanyInfo({ icon, label, value }) {
  if (!value) return null
  return <div className="flex items-start gap-2.5 text-sm"><span className="mt-0.5 text-base text-gray-400">{icon}</span><p className="min-w-0 leading-6 text-slate-600"><strong className="font-semibold text-slate-800">{label}:</strong> {value}</p></div>
}

function GeneralInfo({ items }) {
  if (!items.length) return null
  return <section className="job-general-info rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h2 className="text-base font-bold text-slate-800">Thông tin chung</h2><dl className="mt-4 space-y-4">{items.map((item) => <div key={item.label} className="flex gap-3"><dt className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm text-gray-500">{item.icon}</dt><dd className="min-w-0"><p className="text-xs text-gray-500">{item.label}</p><p className="mt-0.5 text-sm font-medium leading-5 text-slate-700">{item.value}</p></dd></div>)}</dl></section>
}

function RelatedTopics({ job }) {
  // Mỗi tag link theo đúng danh mục của nó (chuyên môn chính + kiến thức chuyên ngành).
  const topics = [job.primary_specialization, ...(job.domain_knowledge || [])].filter(Boolean).slice(0, 5)
  if (!topics.length) return null
  return <section className="job-related-topics rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-base font-bold text-slate-800"><TagsOutlined className="text-[var(--brand-primary)]" />Danh mục nghề liên quan</h2><div className="mt-4 flex flex-wrap gap-2">{topics.map((topic) => <Link key={topic.id} to={`/viec-lam?cat=${topic.id}`} className="group inline-flex items-center gap-1.5 rounded-full border border-gray-200 !bg-white px-3 py-1.5 text-xs font-medium !text-slate-600 transition hover:-translate-y-px hover:border-[var(--brand-primary)]/40 hover:!bg-[var(--brand-primary-soft)] hover:!text-[var(--brand-primary)] hover:shadow-sm"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300 transition group-hover:bg-[var(--brand-primary)]" />{topic.name}</Link>)}</div></section>
}
