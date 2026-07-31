import { ArrowLeftOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Skeleton } from 'antd'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAdminAccess } from '@/entities/admin-access'
import { adminJobKeys, getAdminJob } from '@/entities/admin-job'
import { useSession } from '@/entities/session'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { adminPath } from '@/shared/config/portals'
import { AdminPanel } from '@/shared/ui/admin'
import AdminJobContentSections from './AdminJobContentSections'
import AdminJobHistory from './AdminJobHistory'
import AdminJobOverview from './AdminJobOverview'
import AdminJobReviewSidebar from './AdminJobReviewSidebar'
import '../admin-job-detail.css'

const SECTION_NAVIGATION = [
  { key: 'content', label: 'Nội dung' },
  { key: 'conditions', label: 'Điều kiện' },
  { key: 'workplace', label: 'Địa điểm' },
  { key: 'employer', label: 'Nhà tuyển dụng' },
  { key: 'contact', label: 'Nhận hồ sơ' },
  { key: 'reports', label: 'Báo cáo' },
  { key: 'history', label: 'Lịch sử' },
]

function defaultOpenSections(hasPendingReports = false) {
  return new Set([
    'content',
    'employer',
    ...(hasPendingReports ? ['reports'] : []),
  ])
}

export default function AdminJobDetail({ publicId }) {
  const { user } = useSession()
  const adminAccess = useAdminAccess(user)
  const location = useLocation()
  const navigate = useNavigate()
  const [openSections, setOpenSections] = useState(() => defaultOpenSections())
  const query = useQuery({
    queryKey: adminJobKeys.detail(publicId),
    queryFn: ({ signal }) => getAdminJob(publicId, { signal }),
  })
  const job = query.data
  const jobPublicId = job?.public_id
  const hasPendingReports = Boolean(job?.pending_report_count)
  const fallback = adminPath('/job-moderation')
  const origin = location.state?.origin
  const backTarget = origin?.pathname?.startsWith(adminPath(''))
    ? `${origin.pathname}${origin.search || ''}`
    : fallback
  const canViewEmployerProfile = adminAccess.hasAny([
    'account.employer.view',
    'account.view',
    'employer_verification.view',
    'company_update.view',
  ])

  useEffect(() => {
    if (jobPublicId) setOpenSections(defaultOpenSections(hasPendingReports))
  }, [hasPendingReports, jobPublicId])

  function toggleSection(sectionKey) {
    setOpenSections((current) => {
      const next = new Set(current)
      if (next.has(sectionKey)) next.delete(sectionKey)
      else next.add(sectionKey)
      return next
    })
  }

  function jumpToSection(sectionKey) {
    setOpenSections((current) => new Set([...current, sectionKey]))
    window.requestAnimationFrame(() => {
      document.getElementById(`admin-job-${sectionKey}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }

  if (query.isLoading) {
    return <AdminPanel><Skeleton active paragraph={{ rows: 12 }} /></AdminPanel>
  }

  if (query.isError || !job) {
    return (
      <AdminPanel>
        <Alert
          action={<Button onClick={() => query.refetch()}>Thử lại</Button>}
          description={getApiErrorMessage(query.error, 'Không tìm thấy tin tuyển dụng.')}
          showIcon
          title="Không thể tải chi tiết tin"
          type="error"
        />
        <Button className="mt-4" icon={<ArrowLeftOutlined />} onClick={() => navigate(fallback)}>
          Về danh sách
        </Button>
      </AdminPanel>
    )
  }

  return (
    <div className="admin-job-detail">
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(backTarget)}>
        {origin?.label || 'Quay lại danh sách'}
      </Button>

      <AdminJobOverview
        job={job}
        onCollapseAll={() => setOpenSections(new Set())}
        onOpenAll={() => setOpenSections(new Set(SECTION_NAVIGATION.map((item) => item.key)))}
        openCount={openSections.size}
        sectionCount={SECTION_NAVIGATION.length}
      />

      <nav aria-label="Điều hướng hồ sơ tin tuyển dụng" className="admin-job-section-nav">
        <span className="admin-job-section-nav__label">Đi nhanh đến</span>
        <div className="admin-job-section-nav__items">
          {SECTION_NAVIGATION.map((item) => (
            <button
              aria-pressed={openSections.has(item.key)}
              className={openSections.has(item.key) ? 'admin-job-section-nav__item--active' : ''}
              key={item.key}
              onClick={() => jumpToSection(item.key)}
              type="button"
            >
              {item.label}
              {item.key === 'reports' && job.pending_report_count > 0 && (
                <span>{job.pending_report_count}</span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <div className="admin-job-detail__layout">
        <main className="min-w-0 space-y-4">
          <AdminJobContentSections
            job={job}
            onToggle={toggleSection}
            openSections={openSections}
          />
          <AdminJobHistory job={job} onToggle={toggleSection} openSections={openSections} />
        </main>
        <AdminJobReviewSidebar
          canViewEmployerProfile={canViewEmployerProfile}
          job={job}
          onToggle={toggleSection}
          openSections={openSections}
        />
      </div>
    </div>
  )
}
