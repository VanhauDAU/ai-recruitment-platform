import { HeartFilled, HeartOutlined } from '@ant-design/icons'
import { Button, Result } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useLoginPrompt } from '@/features/common/account/auth'
import { AnalyzeJobFit } from '@/features/main/application/analyze-job-fit'
import { ApplyForJobModal, useJobApplicationStatus } from '@/features/main/application/apply-for-job'
import { CreateJobAlertModal } from '@/features/main/job/manage-job-alerts'
import { JobCompareButton } from '@/features/main/job/compare-jobs'
import { ReportJobModal } from '@/features/main/job/report-job'
import { useSession } from '@/entities/account/session'
import { useSavedJob } from '@/features/main/job/saved-jobs'
import { m } from '@/shared/config/i18n'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import { message } from '@/shared/lib/toast'
import { buildJobDetailAlertPrefill } from './lib/job-detail-alert-prefill'
import JobDetailContent, { RelatedJobs } from './ui/job-detail/JobDetailContent'
import { JobBreadcrumbs, JobDetailSkeleton, JobHero } from './ui/job-detail/JobDetailOverview'
import JobDetailSearchBar from './ui/job-detail/JobDetailSearchBar'
import JobCompanyTab from './ui/job-detail/JobCompanyTab'
import JobDetailSidebar, { JobGeneralInfo, RelatedTopics } from './ui/job-detail/JobDetailSidebar'
import JobDetailStickyBar from './ui/job-detail/JobDetailStickyBar'
import JobDetailTabs from './ui/job-detail/JobDetailTabs'
import JobQualityRating from './ui/job-detail/JobQualityRating'
import JobSafetyTips from './ui/job-detail/JobSafetyTips'
import JobSidebarPromos from './ui/job-detail/JobSidebarPromos'
import { isAcceptingApplications } from './lib/job-detail-presentation'
import JobApplicationClosed from './ui/job-detail/JobApplicationClosed'
import JobShareRail from './ui/job-detail/JobShareRail'
import useJobDetailPageData from './model/use-job-detail-page-data'
import './ui/job-detail/job-detail.css'

export default function JobDetail() {
  const { slug, companySlug } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, loading: sessionLoading, user } = useSession()
  const { promptLogin } = useLoginPrompt()
  const { job, relatedJobs, loading, notFound } = useJobDetailPageData({ slug, companySlug, navigate })
  const [saved, toggleSaved, savePending] = useSavedJob(job?.public_id, job)
  const [applyOpen, setApplyOpen] = useState(false)
  const [createAlertOpen, setCreateAlertOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const isMobile = useMediaQuery('(max-width: 767.98px)')
  // Tab gắn với id tin: sang tin khác (bấm việc liên quan) thì tự về tab Thông tin.
  const [tabState, setTabState] = useState({ jobId: null, key: 'info' })
  const jobAlertInitialValues = useMemo(() => buildJobDetailAlertPrefill(job), [job])
  const canCreateJobAlert = !sessionLoading && (!isAuthenticated || user?.role === 'candidate')
  const applicationStatus = useJobApplicationStatus({
    jobPublicId: job?.public_id,
    enabled: isAuthenticated && user?.role === 'candidate',
  })
  const [searchParams, setSearchParams] = useSearchParams()
  const applyRequested = searchParams.get('ung-tuyen') === '1'

  function requireCandidate() {
    if (!isAuthenticated) {
      promptLogin()
      return false
    }
    if (user?.role !== 'candidate') {
      message.warning('Chỉ ứng viên mới có thể sử dụng tính năng này.')
      return false
    }
    return true
  }

  function handleApply() {
    if (!requireCandidate()) return
    if (applicationStatus.isPending) {
      message.info('Bạn đã ứng tuyển tin này. Theo dõi hoặc rút hồ sơ trong mục "Việc làm đã ứng tuyển".')
      return
    }
    if (applicationStatus.isLimitReached) {
      message.info('Bạn đã dùng hết 2 lượt ứng tuyển lại cho công việc này.')
      return
    }
    if (applicationStatus.isCoolingDown) {
      message.warning('Vui lòng chờ đủ 5 phút kể từ lần ứng tuyển gần nhất trước khi ứng tuyển lại.')
      return
    }
    setApplyOpen(true)
  }

  // Nút "Ứng tuyển" ở danh sách gợi ý dẫn tới `?ung-tuyen=1`: mở form một lần khi đã đủ dữ liệu.
  useEffect(() => {
    if (!applyRequested || !job || sessionLoading || applicationStatus.isLoading) return
    setSearchParams((params) => {
      params.delete('ung-tuyen')
      return params
    }, { replace: true })
    if (isAcceptingApplications(job)) handleApply()
  }, [applyRequested, job, sessionLoading, applicationStatus.isLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSave() {
    if (!requireCandidate()) return
    toggleSaved()
  }

  function handleCreateSimilarJobAlert() {
    if (!canCreateJobAlert) return
    if (!isAuthenticated) {
      promptLogin(() => setCreateAlertOpen(true))
      return
    }
    setCreateAlertOpen(true)
  }

  function handleReport() {
    if (!isAuthenticated) {
      promptLogin(() => setReportOpen(true))
      return
    }
    if (user?.role !== 'candidate') {
      message.warning('Chỉ ứng viên mới có thể báo cáo tin tuyển dụng.')
      return
    }
    setReportOpen(true)
  }

  const activeTab = tabState.jobId === job?.public_id ? tabState.key : 'info'
  const setActiveTab = (key) => setTabState({ jobId: job?.public_id, key })

  function showTab(key) {
    setActiveTab(key)
    // Đang đọc giữa panel dài: đưa đầu panel mới lên ngay dưới thanh tab.
    const tabs = document.getElementById('job-detail-tabs')
    if (tabs && tabs.getBoundingClientRect().top < 0) tabs.scrollIntoView({ block: 'start' })
  }

  function showRelatedTab() {
    setActiveTab('related')
    document.getElementById('job-detail-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (loading) return <JobDetailSkeleton />
  if (notFound || !job) return <NotFoundState />

  const details = (
    <JobDetailContent
      job={job}
      saved={saved}
      savePending={savePending}
      applicationStatus={applicationStatus}
      canCreateJobAlert={canCreateJobAlert}
      onApply={handleApply}
      onCreateJobAlert={handleCreateSimilarJobAlert}
      onSave={handleSave}
      onReport={handleReport}
    />
  )
  const related = <RelatedJobs jobs={relatedJobs} isAuthenticated={isAuthenticated} onRequireLogin={promptLogin} />

  return (
    <>
      <JobDetailSearchBar />
      <JobShareRail />
      <JobDetailStickyBar job={job} relatedJobs={relatedJobs} applicationStatus={applicationStatus} onApply={handleApply} onSave={handleSave} savePending={savePending} />

      <main className="bg-[#f5f7f8] pb-24 pt-5 md:pb-8">
        <div className="mx-auto max-w-6xl px-4">
          <JobBreadcrumbs job={job} />
          <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="min-w-0 space-y-5">
              <JobHero
                job={job}
                saved={saved}
                applicationStatus={applicationStatus}
                onApply={handleApply}
                onSave={handleSave}
                savePending={savePending}
              />
              {isAcceptingApplications(job) && (
                <AnalyzeJobFit job={job} beforeOpen={requireCandidate} onApply={handleApply} placement={isMobile ? 'floating' : 'inline'} />
              )}
              {isMobile
                ? (
                    <JobDetailTabs
                      active={activeTab}
                      onChange={showTab}
                      relatedCount={relatedJobs.length}
                      panels={{
                        info: <><JobGeneralInfo job={job} />{details}<JobQualityRating jobId={job.public_id} /><JobSafetyTips /><JobSidebarPromos /></>,
                        company: <JobCompanyTab job={job} active={activeTab === 'company'} />,
                        related: <>{relatedJobs.length ? related : <EmptyRelatedJobs />}<RelatedTopics job={job} /></>,
                      }}
                    />
                  )
                : <>{details}<JobQualityRating jobId={job.public_id} />{related}</>}
            </div>
            {!isMobile && (
              <JobDetailSidebar
                job={job}
                fitAction={isAcceptingApplications(job) && (
                  <AnalyzeJobFit job={job} beforeOpen={requireCandidate} onApply={handleApply} />
                )}
              />
            )}
          </div>
        </div>
      </main>

      <MobileActions isMobile={isMobile} onShowRelated={showRelatedTab} job={job} saved={saved} applicationStatus={applicationStatus} onApply={handleApply} onSave={handleSave} savePending={savePending} />
      <ApplyForJobModal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        jobPublicId={job.public_id}
        jobTitle={job.title}
        workplaceGroups={job.workplace_groups || []}
        candidateName={user?.full_name || ''}
        candidateEmail={user?.email || ''}
        candidatePhone={user?.phone || ''}
        isReapplication={applicationStatus.isResubmission}
        retriesRemaining={applicationStatus.retriesRemaining}
        onSubmitted={applicationStatus.recordSubmission}
      />
      <CreateJobAlertModal
        open={createAlertOpen}
        initialValues={jobAlertInitialValues}
        onClose={() => setCreateAlertOpen(false)}
      />
      <ReportJobModal
        jobPublicId={job.public_id}
        jobTitle={job.title}
        onClose={() => setReportOpen(false)}
        open={reportOpen}
      />
    </>
  )
}

function NotFoundState() {
  return <Result status="404" title="Không tìm thấy tin tuyển dụng" extra={<Link to="/viec-lam"><Button type="primary">Xem việc làm khác</Button></Link>} />
}

function EmptyRelatedJobs() {
  return <p className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-slate-600">{m.candidate_job_detail_related_empty()} <Link to="/viec-lam" className="font-semibold !text-[var(--brand-primary)]">{m.candidate_job_detail_all_jobs()}</Link></p>
}

function ApplyButtonLabel({ status }) {
  return <>{status.isResubmission && <i className="fa-solid fa-arrow-rotate-right" aria-hidden="true" />} {status.applyLabel}</>
}

function MobileActions({ isMobile, onShowRelated, job, saved, applicationStatus, onApply, onSave, savePending }) {
  // Thanh chỉ hiện dưới md: báo cho thanh tab dưới nhường chỗ và nút nổi nâng lên.
  useEffect(() => {
    if (!isMobile) return undefined
    document.body.classList.add('has-bottom-action-bar')
    return () => document.body.classList.remove('has-bottom-action-bar')
  }, [isMobile])

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-6xl gap-2">
        <JobCompareButton job={job} className="job-mobile-actions__compare" />
        <button type="button" onClick={onSave} disabled={savePending} aria-label={saved ? 'Bỏ lưu việc làm' : 'Lưu việc làm'} className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-[var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-60">{saved ? <HeartFilled /> : <HeartOutlined />}</button>
        {isAcceptingApplications(job) ? <button type="button" onClick={onApply} disabled={applicationStatus.isLimitReached} className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"><ApplyButtonLabel status={applicationStatus} /></button> : <JobApplicationClosed className="flex-1" onShowRelated={onShowRelated} />}
      </div>
    </div>
  )
}
