import { BankOutlined, CheckCircleFilled, ClockCircleOutlined, EnvironmentOutlined, GlobalOutlined, ReadOutlined, SolutionOutlined, TeamOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import {
  EDUCATION_LEVEL_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  POSITION_LEVEL_LABELS,
  WORK_TYPE_LABELS,
  companyInitial,
} from '../../../../../constants/jobOptions'
import JobSafetyTips from './JobSafetyTips'
import JobSidebarPromos from './JobSidebarPromos'

export default function JobDetailSidebar({ job }) {
  // Không lặp "Kinh nghiệm" ở đây — đã có ở Hero và tag Yêu cầu.
  const generalInfo = [
    { icon: <SolutionOutlined />, label: 'Cấp bậc', value: POSITION_LEVEL_LABELS[job.position_level] },
    { icon: <ReadOutlined />, label: 'Học vấn', value: job.education_level ? (EDUCATION_LEVEL_LABELS[job.education_level] || job.education_level) : null },
    { icon: <TeamOutlined />, label: 'Số lượng tuyển', value: job.number_of_vacancies ? `${job.number_of_vacancies} người` : null },
    { icon: <BankOutlined />, label: 'Hình thức làm việc', value: WORK_TYPE_LABELS[job.work_type] },
    { icon: <ClockCircleOutlined />, label: 'Loại hình làm việc', value: EMPLOYMENT_TYPE_LABELS[job.employment_type] },
  ].filter((item) => item.value)

  return <aside className="space-y-5 lg:sticky lg:top-[84px]"><CompanyCard job={job} /><GeneralInfo items={generalInfo} /><RelatedTopics job={job} /><JobSafetyTips /><JobSidebarPromos /></aside>
}

function CompanyCard({ job }) {
  const companyAddress = job.company_address
  const companyPath = `/viec-lam?search=${encodeURIComponent(job.company_name)}&search_by=company`
  return <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">{job.company_cover_url && <div className="h-16 bg-cover bg-center" style={{ backgroundImage: `url(${job.company_cover_url})` }} />}<div className={`p-5 ${job.company_cover_url ? '-mt-7' : ''}`}><div className="flex items-start gap-3"><CompanyLogo job={job} /><div className="min-w-0 pt-1"><p className="line-clamp-2 text-sm font-bold leading-5 text-slate-800">{job.company_name}</p>{job.company_verified && <p className="mt-1 text-xs font-medium text-emerald-600"><CheckCircleFilled /> Đã xác thực</p>}</div></div><div className="mt-5 space-y-3 border-t border-gray-100 pt-4"><CompanyInfo icon={<TeamOutlined />} label="Quy mô" value={job.company_size} /><CompanyInfo icon={<BankOutlined />} label="Lĩnh vực" value={job.company_industries?.join(', ')} /><CompanyInfo icon={<EnvironmentOutlined />} label="Địa chỉ" value={companyAddress} /></div>{job.company_description && <p className="mt-4 line-clamp-3 text-xs leading-5 text-gray-500">{job.company_description}</p>}{job.company_website_url ? <a href={job.company_website_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--brand-primary)] hover:underline">Xem trang công ty <GlobalOutlined className="text-xs" /></a> : <Link to={companyPath} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--brand-primary)] hover:underline">Xem trang công ty <GlobalOutlined className="text-xs" /></Link>}</div></section>
}

function CompanyLogo({ job }) {
  return <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-white bg-white shadow-sm">{job.company_logo_url ? <img src={job.company_logo_url} alt={job.company_name} className="h-full w-full object-contain p-1" /> : <span className="text-xl font-bold text-[var(--brand-primary)]">{companyInitial(job.company_name)}</span>}</div>
}

function CompanyInfo({ icon, label, value }) {
  if (!value) return null
  return <div className="flex items-start gap-2.5 text-sm"><span className="mt-0.5 text-gray-400">{icon}</span><div className="min-w-0"><span className="text-xs text-gray-500">{label}</span><p className="mt-0.5 leading-5 text-slate-700">{value}</p></div></div>
}

function GeneralInfo({ items }) {
  if (!items.length) return null
  return <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h2 className="text-base font-bold text-slate-800">Thông tin chung</h2><dl className="mt-4 space-y-4">{items.map((item) => <div key={item.label} className="flex gap-3"><dt className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm text-gray-500">{item.icon}</dt><dd className="min-w-0"><p className="text-xs text-gray-500">{item.label}</p><p className="mt-0.5 text-sm font-medium leading-5 text-slate-700">{item.value}</p></dd></div>)}</dl></section>
}

function RelatedTopics({ job }) {
  // Mỗi tag link theo đúng danh mục của nó (chuyên môn chính + kiến thức chuyên ngành).
  const topics = [job.primary_specialization, ...(job.domain_knowledge || [])].filter(Boolean).slice(0, 5)
  if (!topics.length) return null
  return <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h2 className="text-base font-bold text-slate-800">Danh mục nghề liên quan</h2><div className="mt-3 flex flex-wrap gap-2">{topics.map((topic) => <Link key={topic.id} to={`/viec-lam?cat=${topic.id}`} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-emerald-50 hover:text-[var(--brand-primary)]">{topic.name}</Link>)}</div></section>
}
