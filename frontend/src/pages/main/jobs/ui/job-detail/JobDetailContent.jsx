import { DownOutlined, HeartFilled, HeartOutlined, UpOutlined } from '@ant-design/icons'
import { useEffect, useRef, useState } from 'react'
import { formatDeadline } from '@/entities/job'
import { formatJobDate } from '../../lib/job-detail-presentation'
import JobCard from '../JobCard'
import {
  AdditionalBenefits,
  JobSkills,
  LanguageRequirementList,
  RequirementTags,
  SectionHeading,
  SpecialtyTags,
  WorkplaceGroups,
  WorkScheduleList,
} from './JobDetailBlocks'
import JobQualityRating from './JobQualityRating'
import RichJobContent from './RichJobContent'

const APPLY_GUIDE = 'Ứng viên nộp hồ sơ trực tuyến bằng cách bấm Ứng tuyển ngay dưới đây.'
const MOBILE_COLLAPSED_HEIGHT = 520
const DESKTOP_COLLAPSED_HEIGHT = 640

export default function JobDetailContent({ job, relatedJobs, saved, savePending, isAuthenticated, applicationStatus, onApply, onSave, onReport, onRequireLogin }) {
  const [detailsExpanded, setDetailsExpanded] = useState(false)
  const [detailsOverflowing, setDetailsOverflowing] = useState(false)
  const detailsRef = useRef(null)

  useEffect(() => {
    setDetailsExpanded(false)
  }, [job.public_id])

  useEffect(() => {
    const element = detailsRef.current
    if (!element) return undefined
    const measure = () => {
      const collapsedHeight = window.matchMedia('(min-width: 640px)').matches
        ? DESKTOP_COLLAPSED_HEIGHT
        : MOBILE_COLLAPSED_HEIGHT
      setDetailsOverflowing(element.scrollHeight > collapsedHeight + 1)
    }
    measure()
    window.addEventListener('resize', measure)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(element)
    return () => {
      window.removeEventListener('resize', measure)
      observer?.disconnect()
    }
  }, [job])

  return (
    <>
      <DetailSection id="job-detail-content" title="Chi tiết tin tuyển dụng">
        <div className="relative">
          <div
            ref={detailsRef}
            id="job-detail-collapsible-content"
            className={detailsExpanded ? 'space-y-6' : 'max-h-[520px] space-y-6 overflow-hidden sm:max-h-[640px]'}
          >
            <div className="space-y-3">
              <RequirementTags tags={job.requirement_tags} />
              <SpecialtyTags primary={job.primary_specialization} domains={job.domain_knowledge} />
            </div>
            <JobText id="job-description" title="Mô tả công việc" content={job.description} />
            <JobText title="Yêu cầu ứng viên" content={job.requirements}>
              <JobSkills required={job.required_skills} preferred={job.preferred_skills} />
            </JobText>
            <JobText title="Quyền lợi" content={job.benefits}>
              <AdditionalBenefits groups={job.benefit_groups} />
            </JobText>
            <LanguageRequirementList items={job.language_requirements} />
            <WorkplaceGroups groups={job.workplace_groups} />
            <WorkScheduleList schedules={job.work_schedules} note={job.work_schedule_note} />
            <section>
              <SectionHeading>Cách thức ứng tuyển</SectionHeading>
              <p className="text-sm leading-6 text-slate-700">{APPLY_GUIDE}</p>
            </section>
            <JobClosingActions deadline={job.deadline} saved={saved} savePending={savePending} applicationStatus={applicationStatus} onApply={onApply} onSave={onSave} onReport={onReport} />
          </div>
          {detailsOverflowing && (
            <div className={detailsExpanded
              ? 'mt-5 flex justify-center'
              : 'pointer-events-none absolute inset-x-0 bottom-0 flex h-36 items-end justify-center bg-gradient-to-b from-white/0 via-white/90 to-white pb-1'}
            >
              <button
                type="button"
                aria-controls="job-detail-collapsible-content"
                aria-expanded={detailsExpanded}
                onClick={() => setDetailsExpanded((current) => !current)}
                className="pointer-events-auto inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-[var(--brand-primary)] bg-white px-5 text-sm font-semibold text-[var(--brand-primary)] shadow-[0_8px_24px_rgba(15,118,78,0.12)] transition-colors duration-200 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 motion-reduce:transition-none"
              >
                {detailsExpanded ? 'Thu gọn mô tả công việc' : 'Xem đầy đủ mô tả công việc'}
                {detailsExpanded ? <UpOutlined aria-hidden="true" /> : <DownOutlined aria-hidden="true" />}
              </button>
            </div>
          )}
        </div>
      </DetailSection>

      <JobQualityRating jobId={job.public_id} />
      <RelatedJobs jobs={relatedJobs} isAuthenticated={isAuthenticated} onRequireLogin={onRequireLogin} />
    </>
  )
}

function DetailSection({ id, title, children }) {
  return <section id={id} className="scroll-mt-20 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="border-l-4 border-[var(--brand-primary)] pl-3 text-base font-bold text-slate-800 sm:text-lg">{title}</h2><div className="mt-5 space-y-6">{children}</div></section>
}

function JobText({ id, title, content, children }) {
  if (!content?.trim()) return null
  return <section id={id} className={id ? 'scroll-mt-20' : undefined}><SectionHeading>{title}</SectionHeading><RichJobContent html={content} />{children}</section>
}

function JobClosingActions({ deadline, saved, savePending, applicationStatus, onApply, onSave, onReport }) {
  return (
    <div className="border-t border-slate-100 pt-5">
      {deadline && (
        <p className="text-sm text-slate-600">
          Hạn nộp hồ sơ:{' '}
          <strong className="text-slate-800">{formatJobDate(deadline)} ({formatDeadline(deadline)})</strong>
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onApply} disabled={applicationStatus.isLimitReached} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 text-sm font-bold text-white hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60">{applicationStatus.hasApplied && <i className="fa-solid fa-arrow-rotate-right" aria-hidden="true" />}{applicationStatus.hasApplied ? 'Ứng tuyển lại' : 'Ứng tuyển ngay'}</button>
        <button type="button" onClick={onSave} disabled={savePending} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-emerald-200 px-4 text-sm font-semibold text-[var(--brand-primary)] hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60">{saved ? <HeartFilled /> : <HeartOutlined />}{saved ? 'Đã lưu tin' : 'Lưu tin'}</button>
      </div>
      <p className="mt-4 rounded-lg bg-[#F2F4F5] px-4 py-3 text-sm leading-7 text-slate-600">
        <strong className="font-semibold text-slate-700">Báo cáo tin tuyển dụng:</strong>{' '}
        Nếu bạn thấy rằng tin tuyển dụng này không đúng hoặc có dấu hiệu lừa đảo,{' '}
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={onReport}
          className="-my-2 inline-flex min-h-11 cursor-pointer items-center align-middle font-medium text-slate-700 underline decoration-slate-400 underline-offset-4 transition-colors duration-200 hover:text-red-600 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          hãy phản ánh với chúng tôi
        </button>
        .
      </p>
    </div>
  )
}

function RelatedJobs({ jobs, isAuthenticated, onRequireLogin }) {
  if (!jobs.length) return null
  return <section id="related-jobs" className="scroll-mt-20 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="border-l-4 border-[var(--brand-primary)] pl-3 text-base font-bold text-slate-800 sm:text-lg">Việc làm liên quan</h2><div className="mt-5 space-y-3">{jobs.map((job) => <JobCard key={job.public_id} job={job} isAuthenticated={isAuthenticated} onRequireLogin={onRequireLogin} showQuickView={false} />)}</div></section>
}
