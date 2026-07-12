import { FlagOutlined, HeartFilled, HeartOutlined } from '@ant-design/icons'
import { formatDeadline } from '@/constants/jobOptions'
import { formatJobDate } from '../../utils/jobDetailPresentation'
import JobCard from '../JobCard'
import {
  BenefitTags,
  LanguageRequirementList,
  RequirementTags,
  SpecialtyTags,
  WorkplaceGroups,
  WorkScheduleList,
} from './JobDetailBlocks'
import JobQualityRating from './JobQualityRating'
import RichJobContent from './RichJobContent'

const APPLY_GUIDE = 'Ứng viên nộp hồ sơ trực tuyến bằng cách bấm Ứng tuyển ngay dưới đây.'

export default function JobDetailContent({ job, relatedJobs, saved, isAuthenticated, onApply, onSave, onReport, onRequireLogin }) {
  return (
    <>
      <DetailSection id="job-detail-content" title="Chi tiết tin tuyển dụng">
        <div className="space-y-3">
          <RequirementTags tags={job.requirement_tags} />
          <BenefitTags tags={job.benefit_tags} />
          <SpecialtyTags primary={job.primary_specialization} domains={job.domain_knowledge} />
        </div>
        <JobText id="job-description" title="Mô tả công việc" content={job.description} />
        <JobText title="Yêu cầu ứng viên" content={job.requirements} />
        <JobText title="Quyền lợi" content={job.benefits} />
        <LanguageRequirementList items={job.language_requirements} />
        <WorkplaceGroups groups={job.workplace_groups} />
        <WorkScheduleList schedules={job.work_schedules} note={job.work_schedule_note} />
        <section>
          <h3 className="mb-2 text-sm font-bold text-slate-800">Cách thức ứng tuyển</h3>
          <p className="text-sm leading-6 text-slate-700">{APPLY_GUIDE}</p>
        </section>
        <JobClosingActions deadline={job.deadline} saved={saved} onApply={onApply} onSave={onSave} onReport={onReport} />
      </DetailSection>

      <JobQualityRating jobId={job.public_id} />
      <RelatedJobs jobs={relatedJobs} isAuthenticated={isAuthenticated} onRequireLogin={onRequireLogin} />
    </>
  )
}

function DetailSection({ id, title, children }) {
  return <section id={id} className="scroll-mt-20 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="border-l-4 border-[var(--brand-primary)] pl-3 text-base font-bold text-slate-800 sm:text-lg">{title}</h2><div className="mt-5 space-y-6">{children}</div></section>
}

function JobText({ id, title, content }) {
  if (!content?.trim()) return null
  return <section id={id} className={id ? 'scroll-mt-20' : undefined}><h3 className="mb-2 text-sm font-bold text-slate-800">{title}</h3><RichJobContent html={content} /></section>
}

function JobClosingActions({ deadline, saved, onApply, onSave, onReport }) {
  return <div className="border-t border-slate-100 pt-5">{deadline && <p className="text-sm text-slate-600">Hạn nộp hồ sơ: <strong className="text-slate-800">{formatJobDate(deadline)} ({formatDeadline(deadline)})</strong></p>}<div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={onApply} className="inline-flex h-10 cursor-pointer items-center rounded-lg bg-[var(--brand-primary)] px-4 text-sm font-bold text-white hover:bg-[var(--brand-primary-hover)]">Ứng tuyển ngay</button><button type="button" onClick={onSave} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-emerald-200 px-4 text-sm font-semibold text-[var(--brand-primary)] hover:bg-emerald-50">{saved ? <HeartFilled /> : <HeartOutlined />}{saved ? 'Đã lưu tin' : 'Lưu tin'}</button><button type="button" onClick={onReport} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-gray-500 hover:text-red-600"><FlagOutlined /> Báo cáo tin tuyển dụng</button></div></div>
}

function RelatedJobs({ jobs, isAuthenticated, onRequireLogin }) {
  if (!jobs.length) return null
  return <section id="related-jobs" className="scroll-mt-20 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="border-l-4 border-[var(--brand-primary)] pl-3 text-base font-bold text-slate-800 sm:text-lg">Việc làm liên quan</h2><div className="mt-5 space-y-3">{jobs.map((job) => <JobCard key={job.public_id} job={job} isAuthenticated={isAuthenticated} onRequireLogin={onRequireLogin} showQuickView={false} />)}</div></section>
}
