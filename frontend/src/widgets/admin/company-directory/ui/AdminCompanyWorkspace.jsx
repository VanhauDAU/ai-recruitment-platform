import { useQuery } from '@tanstack/react-query'
import { Badge, Tabs } from 'antd'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { adminCompanyKeys, getAdminCompanySummary } from '@/entities/company/admin-company'
import { CompanyContentChangeQueue } from '@/features/admin/company/review-company-content-changes'
import { m } from '@/shared/config/i18n'
import AdminCompanyDirectory from './AdminCompanyDirectory'
import AdminCompanyJoinRequestQueue from './AdminCompanyJoinRequestQueue'
import AdminCompanyUpdateQueue from './AdminCompanyUpdateQueue'
import { CompanyPanel } from './CompanyPanel'
import '../admin-company-directory.css'

const TABS = ['updates', 'content-changes', 'join-requests']
const DIRECTORY_QUERY_KEYS = [
  'q',
  'recruiter_verification_status',
  'has_owner',
  'ordering',
  'page',
]

export default function AdminCompanyWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const activeTab = TABS.includes(requestedTab) ? requestedTab : 'directory'
  const summary = useQuery({
    queryKey: adminCompanyKeys.summary,
    queryFn: ({ signal }) => getAdminCompanySummary({ signal }),
  })
  const unreviewed = summary.data?.unreviewed_content_changes || 0

  useEffect(() => {
    if (requestedTab === activeTab || (!requestedTab && activeTab === 'directory')) return
    const next = new URLSearchParams(searchParams)
    if (activeTab === 'directory') next.delete('tab')
    else next.set('tab', activeTab)
    setSearchParams(next, { replace: true })
  }, [activeTab, requestedTab, searchParams, setSearchParams])

  const changeTab = (tab) => {
    const next = new URLSearchParams(searchParams)
    if (tab === 'directory') {
      next.delete('tab')
      next.delete('company')
      next.delete('update_q')
      next.delete('update_page')
      next.delete('update_ordering')
    } else {
      next.set('tab', tab)
      DIRECTORY_QUERY_KEYS.forEach((key) => next.delete(key))
    }
    next.delete('page')
    setSearchParams(next)
  }

  const panels = {
    updates: (
      <section className="admin-panel">
        <AdminCompanyUpdateQueue />
      </section>
    ),
    'content-changes': (
      <CompanyPanel
        title="Hậu kiểm nội dung trang công ty"
        description="Nội dung trang công ty lên trang ngay khi nhà tuyển dụng lưu. Xem lại theo lô, hoàn tác nội dung vi phạm và bật duyệt trước cho công ty tái phạm."
      >
        <CompanyContentChangeQueue />
      </CompanyPanel>
    ),
    'join-requests': <AdminCompanyJoinRequestQueue />,
  }

  return (
    <section className="admin-company-workspace">
      <Tabs
        activeKey={activeTab}
        onChange={changeTab}
        items={[
          { key: 'directory', label: m.admin_company_list_tab_directory() },
          { key: 'updates', label: m.admin_company_list_tab_updates() },
          {
            key: 'content-changes',
            label: (
              <span>
                {m.admin_company_list_tab_content()} <Badge count={unreviewed} size="small" overflowCount={99} />
              </span>
            ),
          },
          { key: 'join-requests', label: m.admin_company_list_tab_join() },
        ]}
      />
      {panels[activeTab] || <AdminCompanyDirectory onOpenTab={changeTab} />}
    </section>
  )
}
