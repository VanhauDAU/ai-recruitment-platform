import { Tabs } from 'antd'
import { useSearchParams } from 'react-router'
import { JobReportQueue } from '@/features/review-job-reports'
import AdminJobList from './AdminJobList'

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
    <section className="space-y-4">
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
