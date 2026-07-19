import { CheckCircleFilled, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Result, Skeleton } from 'antd'
import { useState } from 'react'
import {
  getEmployerCompanyCatalogs,
  getEmployerIndustries,
  getEmployerProfile,
} from '@/entities/employer-profile'
import CompanyForm from './CompanyForm'
import CompanySearchPanel from './CompanySearchPanel'
import LinkedCompanyPanel from './LinkedCompanyPanel'
import './employer-company-settings.css'

const OPTIONS = [
  {
    key: 'search',
    icon: <SearchOutlined />,
    title: 'Tìm kiếm thông tin công ty',
    description: 'Dành cho doanh nghiệp đã có hồ sơ trên hệ thống.',
  },
  {
    key: 'create',
    icon: <PlusOutlined />,
    title: 'Tạo công ty mới',
    description: 'Dành cho doanh nghiệp lần đầu sử dụng hệ thống.',
  },
]

export default function EmployerCompanySettings() {
  const [activeFlow, setActiveFlow] = useState('search')
  const queryClient = useQueryClient()
  const profileQuery = useQuery({ queryKey: ['employer', 'profile'], queryFn: getEmployerProfile })
  const industriesQuery = useQuery({ queryKey: ['employer', 'industries'], queryFn: getEmployerIndustries, staleTime: 10 * 60 * 1000 })
  const catalogsQuery = useQuery({ queryKey: ['employer', 'company', 'catalogs'], queryFn: getEmployerCompanyCatalogs, staleTime: 30 * 60 * 1000 })

  async function refreshProfile() {
    await Promise.all([
      profileQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: ['employer-dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['employer', 'companies'] }),
      queryClient.invalidateQueries({ queryKey: ['employer', 'company', 'update-requests'] }),
    ])
  }

  if (profileQuery.isLoading || industriesQuery.isLoading || catalogsQuery.isLoading) return <Skeleton active paragraph={{ rows: 14 }} />
  if (profileQuery.isError || industriesQuery.isError || catalogsQuery.isError) {
    return <Result status="error" title="Không tải được trang thông tin công ty" extra={<Button type="primary" onClick={() => { profileQuery.refetch(); industriesQuery.refetch(); catalogsQuery.refetch() }}>Thử lại</Button>} />
  }

  const profile = profileQuery.data || {}
  const catalogs = catalogsQuery.data || { business_types: [], company_sizes: [], markets: [], target_customers: [] }
  const industries = industriesQuery.data || []
  if (profile.onboarding?.company_linked) {
    return <LinkedCompanyPanel profile={profile} catalogs={catalogs} industries={industries} onRefresh={refreshProfile} />
  }

  return (
    <div className="employer-company-settings">
      <div className="company-flow-options" role="tablist" aria-label="Chọn cách cập nhật thông tin công ty">
        {OPTIONS.map((option) => {
          const active = option.key === activeFlow
          return (
            <button key={option.key} type="button" role="tab" aria-selected={active} className={`company-flow-option ${active ? 'company-flow-option--active' : ''}`} onClick={() => setActiveFlow(option.key)}>
              <span className="company-flow-option__icon">{option.icon}</span>
              <span className="min-w-0 flex-1 text-left"><strong>{option.title}</strong><small>{option.description}</small></span>
              {active && <CheckCircleFilled className="company-flow-option__check" />}
            </button>
          )
        })}
      </div>
      <div className="company-flow-content" role="tabpanel">
        {activeFlow === 'search'
          ? <CompanySearchPanel onLinked={refreshProfile} onCreateInstead={() => setActiveFlow('create')} />
          : <CompanyForm catalogs={catalogs} industries={industries} onCompleted={refreshProfile} />}
      </div>
    </div>
  )
}
