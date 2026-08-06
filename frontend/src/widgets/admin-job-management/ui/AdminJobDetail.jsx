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
import AdminJobChangeReview from './AdminJobChangeReview'
import AdminJobContentSections from './AdminJobContentSections'
import AdminJobDecisionDock from './AdminJobDecisionDock'
import AdminJobHistory from './AdminJobHistory'
import AdminJobOverview from './AdminJobOverview'
import AdminJobPublicLink from './AdminJobPublicLink'
import AdminJobReviewPanels from './AdminJobReviewPanels'
import AdminJobReviewSummary from './AdminJobReviewSummary'
import '../admin-job-detail.css'

const TABS = [
  { key: 'changes', label: 'Thay đổi' },
  { key: 'content', label: 'Nội dung' },
  { key: 'conditions', label: 'Điều kiện' },
  { key: 'workplace', label: 'Địa điểm' },
  { key: 'employer', label: 'Nhà tuyển dụng' },
  { key: 'contact', label: 'Nhận hồ sơ' },
  { key: 'reports', label: 'Báo cáo' },
  { key: 'history', label: 'Lịch sử' },
]

const CONTENT_TABS = ['content', 'conditions', 'workplace']
const REVIEW_TABS = ['employer', 'contact', 'reports']

export default function AdminJobDetail({ publicId }) {
  const { user } = useSession()
  const adminAccess = useAdminAccess(user)
  const location = useLocation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('content')
  const query = useQuery({
    queryKey: adminJobKeys.detail(publicId),
    queryFn: ({ signal }) => getAdminJob(publicId, { signal }),
  })
  const job = query.data
  const jobPublicId = job?.public_id
  const changeCount = job?.pending_changes?.changed_count || 0
  const pendingReportCount = job?.pending_report_count || 0
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
    if (!jobPublicId) return
    setActiveTab(changeCount > 0 ? 'changes' : 'content')
  }, [changeCount, jobPublicId])

  // Roving focus so the tab strip behaves like a standard tablist.
  function handleTabKeys(event) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    if (!step && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    const index = TABS.findIndex((item) => item.key === activeTab)
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? TABS.length - 1
        : (index + step + TABS.length) % TABS.length
    const next = TABS[nextIndex].key
    setActiveTab(next)
    document.getElementById(`admin-job-tab-${next}`)?.focus()
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

  const tabCounts = { changes: changeCount, reports: pendingReportCount }

  return (
    <div className="admin-job-detail">
      <div className="admin-job-detail__toolbar">
        <Button
          className="admin-job-detail__back"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(backTarget)}
          size="small"
          type="text"
        >
          {origin?.label || 'Quay lại danh sách'}
        </Button>
        <AdminJobPublicLink job={job} />
      </div>

      <AdminJobOverview job={job} />

      <div className="admin-job-sticky-bar">
        <AdminJobDecisionDock job={job} />
        <nav aria-label="Phần hồ sơ tin tuyển dụng" className="admin-job-section-nav">
          <div className="admin-job-section-nav__items" onKeyDown={handleTabKeys} role="tablist">
            {TABS.map((item) => (
              <button
                aria-controls="admin-job-tabpanel"
                aria-selected={activeTab === item.key}
                className={activeTab === item.key ? 'admin-job-section-nav__item--active' : ''}
                id={`admin-job-tab-${item.key}`}
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                role="tab"
                tabIndex={activeTab === item.key ? 0 : -1}
                type="button"
              >
                {item.label}
                {tabCounts[item.key] > 0 && <span>{tabCounts[item.key]}</span>}
              </button>
            ))}
          </div>
        </nav>
      </div>

      <div className="admin-job-detail__layout">
        <main
          aria-labelledby={`admin-job-tab-${activeTab}`}
          className="min-w-0"
          id="admin-job-tabpanel"
          role="tabpanel"
          tabIndex={-1}
        >
          {activeTab === 'changes' && <AdminJobChangeReview job={job} />}
          {CONTENT_TABS.includes(activeTab) && (
            <AdminJobContentSections job={job} tab={activeTab} />
          )}
          {REVIEW_TABS.includes(activeTab) && (
            <AdminJobReviewPanels
              canViewEmployerProfile={canViewEmployerProfile}
              job={job}
              tab={activeTab}
            />
          )}
          {activeTab === 'history' && <AdminJobHistory job={job} />}
        </main>
        <AdminJobReviewSummary job={job} />
      </div>
    </div>
  )
}
