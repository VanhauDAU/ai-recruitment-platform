import { HeartFilled, HeartOutlined } from '@ant-design/icons'
import { Button, Result, message } from 'antd'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLoginPrompt } from '@/features/auth'
import { ApplyForJobModal } from '@/features/apply-for-job'
import { useSession } from '@/entities/session'
import { useSavedJob } from '@/features/saved-jobs'
import JobDetailContent from './ui/job-detail/JobDetailContent'
import { JobBreadcrumbs, JobDetailSkeleton, JobHero } from './ui/job-detail/JobDetailOverview'
import JobDetailSearchBar from './ui/job-detail/JobDetailSearchBar'
import JobDetailSidebar from './ui/job-detail/JobDetailSidebar'
import JobDetailStickyBar from './ui/job-detail/JobDetailStickyBar'
import JobShareRail from './ui/job-detail/JobShareRail'
import useJobDetailPageData from './model/use-job-detail-page-data'

export default function JobDetail() {
  const { slug, companySlug } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useSession()
  const { promptLogin } = useLoginPrompt()
  const { job, relatedJobs, loading, notFound } = useJobDetailPageData({ slug, companySlug, navigate })
  const [saved, toggleSaved, savePending] = useSavedJob(job?.public_id)
  const [applyOpen, setApplyOpen] = useState(false)

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
    setApplyOpen(true)
  }

  function handleSave() {
    if (!requireCandidate()) return
    toggleSaved()
  }

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      message.success('Đã sao chép liên kết việc làm.')
    } catch {
      message.info('Bạn có thể sao chép liên kết trên thanh địa chỉ để chia sẻ.')
    }
  }

  if (loading) return <JobDetailSkeleton />
  if (notFound || !job) return <NotFoundState />

  return (
    <>
      <JobDetailSearchBar />
      <JobShareRail />
      <JobDetailStickyBar job={job} relatedJobs={relatedJobs} onApply={handleApply} onSave={handleSave} savePending={savePending} />

      <main className="bg-[#f5f7f8] pb-24 pt-5 md:pb-8">
        <div className="mx-auto max-w-6xl px-4">
          <JobBreadcrumbs job={job} />
          <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="min-w-0 space-y-5">
              <JobHero job={job} saved={saved} onApply={handleApply} onSave={handleSave} onShare={handleShare} savePending={savePending} />
              <JobDetailContent
                job={job}
                relatedJobs={relatedJobs}
                saved={saved}
                savePending={savePending}
                isAuthenticated={isAuthenticated}
                onApply={handleApply}
                onSave={handleSave}
                onReport={() => message.info('Cảm ơn bạn. Tính năng báo cáo chi tiết sẽ sớm được mở trong Trung tâm hỗ trợ.')}
                onRequireLogin={promptLogin}
              />
            </div>
            <JobDetailSidebar job={job} />
          </div>
        </div>
      </main>

      <MobileActions saved={saved} onApply={handleApply} onSave={handleSave} savePending={savePending} />
      <ApplyForJobModal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        jobPublicId={job.public_id}
        jobTitle={job.title}
      />
    </>
  )
}

function NotFoundState() {
  return <Result status="404" title="Không tìm thấy tin tuyển dụng" extra={<Link to="/viec-lam"><Button type="primary">Xem việc làm khác</Button></Link>} />
}

function MobileActions({ saved, onApply, onSave, savePending }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-6xl gap-2">
        <button type="button" onClick={onSave} disabled={savePending} aria-label={saved ? 'Bỏ lưu việc làm' : 'Lưu việc làm'} className="flex h-11 w-12 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-emerald-200 text-[var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-60">{saved ? <HeartFilled /> : <HeartOutlined />}</button>
        <button type="button" onClick={onApply} className="h-11 flex-1 cursor-pointer rounded-lg bg-[var(--brand-primary)] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--brand-primary-hover)]">Ứng tuyển ngay</button>
      </div>
    </div>
  )
}
