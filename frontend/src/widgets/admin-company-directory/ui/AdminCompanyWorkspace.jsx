import { Tabs } from 'antd'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { useAdminAccess } from '@/entities/admin-access'
import { useSession } from '@/entities/session'
import AdminCompanyDirectory from './AdminCompanyDirectory'
import AdminCompanyUpdateQueue from './AdminCompanyUpdateQueue'

export default function AdminCompanyWorkspace() {
  const { user } = useSession()
  const { has, isSuperuser } = useAdminAccess(user)
  const [searchParams, setSearchParams] = useSearchParams()
  const canViewDirectory = isSuperuser || has('company.view')
  const canViewUpdates = isSuperuser || has('company_update.view')
  const requestedTab = searchParams.get('tab')
  const defaultTab = canViewDirectory ? 'directory' : 'updates'
  const activeTab = (
    (requestedTab === 'updates' && canViewUpdates)
    || (requestedTab === 'directory' && canViewDirectory)
  ) ? requestedTab : defaultTab

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
    } else {
      next.set('tab', tab)
    }
    next.delete('page')
    setSearchParams(next)
  }

  const items = [
    ...(canViewDirectory ? [{
      key: 'directory',
      label: 'Danh sách công ty',
      children: <AdminCompanyDirectory />,
    }] : []),
    ...(canViewUpdates ? [{
      key: 'updates',
      label: 'Yêu cầu cập nhật',
      children: <AdminCompanyUpdateQueue />,
    }] : []),
  ]

  return (
    <section className="admin-company-workspace">
      <Tabs
        activeKey={activeTab}
        items={items}
        onChange={changeTab}
        destroyOnHidden={false}
      />
    </section>
  )
}
