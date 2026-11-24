import { Tabs } from 'antd'
import { useSearchParams } from 'react-router'
import { JobReportQueue } from '@/features/admin/job/review-job-reports'
import AdminJobList from './AdminJobList'
import '../admin-job-list.css'

export default function AdminJobManagement() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') === 'reports' ? 'reports' : 'jobs'

  function changeTab(tab) {
    const next = new URLSearchParams(searchParams)
    if (tab === 'reports') next.set('tab', 'reports')
    else next.delete('tab')
    setSearchParams(next, { replace: true })
  }

  return (
    <section className="admin-job-management">
      <Tabs
        activeKey={activeTab}
        items={[
          { key: 'jobs', label: 'Quản lý tin' },
          { key: 'reports', label: 'Báo cáo vi phạm' },
        ]}
        onChange={changeTab}
      />
      {activeTab === 'reports' ? <JobReportQueue /> : <AdminJobList />}
    </section>
  )
}
