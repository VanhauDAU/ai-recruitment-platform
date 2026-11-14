import { EyeOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Drawer, Empty, Grid, Result, Skeleton, Tabs } from 'antd'
import { Suspense, useState } from 'react'
import { Link } from 'react-router'
import { employerCompanyPageKeys, getEmployerCompanyPage } from '@/entities/employer-company-page'
import { CompanyLayoutControls, useCompanyLayoutDraft } from '@/features/customize-company-page'
import { CompanyCompletenessMeter, CompanyContentEditor } from '@/features/edit-company-page-content'
import { CompanyPageEditors } from '@/features/manage-company-page-editors'
import { employerAppPath } from '@/shared/config/portals'
import CompanyPageHeader from './CompanyPageHeader'
import CompanyPagePreview from './CompanyPagePreview'
import '../employer-company-page.css'

// Thêm tab mới bằng một phần tử: `visible(page)` đọc payload, `render` nhận ngữ cảnh workspace.
const WORKSPACE_TABS = [
  {
    key: 'layout',
    label: 'Bố cục',
    visible: () => true,
    render: ({ page, controller }) => (
      <CompanyLayoutControls page={page} controller={controller} readOnlyReason={page.permissions.blockers?.[0]?.message} />
    ),
  },
  {
    key: 'content',
    label: 'Nội dung',
    visible: (page) => Boolean(page.content_form),
    render: ({ page, focusCard }) => (
      <Suspense fallback={<Skeleton active paragraph={{ rows: 8 }} />}>
        <CompanyContentEditor page={page} focusCard={focusCard} />
      </Suspense>
    ),
  },
  {
    key: 'editors',
    label: 'Người biên tập',
    visible: (page) => Boolean(page.permissions.can_manage_editors),
    render: () => <CompanyPageEditors />,
  },
]

function CompanyPageWorkspace({ page }) {
  const controller = useCompanyLayoutDraft(page)
  const { xl } = Grid.useBreakpoint()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('layout')
  const [focusCard, setFocusCard] = useState(null)
  const [showPending, setShowPending] = useState(false)
  const previewProps = {
    content: page.content,
    layout: controller.draft,
    registry: page.registry,
    pinnedJobs: controller.pinnedJobs,
    contentForm: page.content_form,
    showPending,
    onShowPendingChange: setShowPending,
  }
  // Mục còn thiếu của thước đo mở tab "Nội dung" rồi cuộn tới thẻ tương ứng.
  const openContentCard = (id) => {
    setActiveTab('content')
    setFocusCard({ id })
  }

  return (
    <div className="employer-company-page">
      <CompanyPageHeader
        page={page}
        completeness={page.completeness && (
          <CompanyCompletenessMeter completeness={page.completeness} onOpenItem={openContentCard} />
        )}
      />
      <div className="employer-company-page__body">
        <section className="employer-company-page__panel" aria-label="Tuỳ biến trang công ty">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={WORKSPACE_TABS.filter((tab) => tab.visible(page)).map((tab) => ({
              key: tab.key,
              label: tab.label,
              children: tab.render({ page, controller, focusCard }),
            }))}
            tabBarExtraContent={!xl && (
              <Button size="small" icon={<EyeOutlined aria-hidden="true" />} onClick={() => setPreviewOpen(true)}>Xem trước</Button>
            )}
          />
        </section>
        {xl && (
          <aside className="employer-company-page__panel employer-company-page__aside" aria-label="Xem trước trang công ty">
            <CompanyPagePreview {...previewProps} />
          </aside>
        )}
      </div>
      {!xl && (
        <Drawer open={previewOpen} onClose={() => setPreviewOpen(false)} size={480} title="Xem trước trang công ty" destroyOnHidden>
          <CompanyPagePreview {...previewProps} defaultDevice="mobile" />
        </Drawer>
      )}
    </div>
  )
}

/** Workspace "Trang công ty" của nhà tuyển dụng: bố cục tức thì, nội dung chờ duyệt, người biên tập và bản xem trước. */
export default function EmployerCompanyPage() {
  const query = useQuery({
    queryKey: employerCompanyPageKeys.page,
    queryFn: ({ signal }) => getEmployerCompanyPage({ signal }),
    // Lỗi 4xx (404: chưa liên kết công ty) không đổi khi thử lại; lỗi khác thử thêm một lần.
    retry: (failureCount, error) => !(error?.response?.status < 500) && failureCount < 1,
  })

  if (query.isPending) {
    return (
      <div className="employer-company-page__panel" aria-label="Đang tải trang công ty" aria-busy="true">
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    )
  }
  if (query.error?.response?.status === 404) {
    return (
      <div className="employer-company-page__panel">
        <Empty description="Tài khoản chưa liên kết với công ty nào nên chưa có trang công ty để tuỳ biến.">
          <Link to={employerAppPath('/account/settings/company')} className="text-sm font-semibold !text-[var(--brand-primary)] hover:underline">
            Cập nhật thông tin công ty
          </Link>
        </Empty>
      </div>
    )
  }
  if (query.isError) {
    return (
      <Result
        status="error"
        title="Không tải được trang công ty"
        extra={<Button type="primary" onClick={() => query.refetch()}>Thử lại</Button>}
      />
    )
  }

  return <CompanyPageWorkspace page={query.data} />
}
