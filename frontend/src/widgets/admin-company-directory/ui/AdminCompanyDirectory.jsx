import {
  BankOutlined,
  CheckCircleOutlined,
  FileSyncOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Alert, Button } from 'antd'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  adminCompanyKeys,
  getAdminCompanies,
  getAdminCompanySummary,
} from '@/entities/admin-company'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { adminPath } from '@/shared/config/portals'
import CompanyDirectoryFilters from './CompanyDirectoryFilters'
import CompanyDirectoryTable from './CompanyDirectoryTable'
import { CompanyStatCard } from './CompanyPanel'
import '../admin-company-directory.css'

const EMPTY_PAGE = { count: 0, results: [] }
const DEFAULT_ORDERING = '-updated_at'

function queryValue(searchParams, key, fallback = '') {
  return searchParams.get(key) || fallback
}

export default function AdminCompanyDirectory({ onOpenUpdates }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(queryValue(searchParams, 'page', '1')) || 1
  const ordering = queryValue(searchParams, 'ordering', DEFAULT_ORDERING)
  const query = queryValue(searchParams, 'q')
  const [searchInput, setSearchInput] = useState(query)
  const filters = {
    q: query,
    verification_status: queryValue(searchParams, 'verification_status'),
    recruiter_verification_status: queryValue(
      searchParams,
      'recruiter_verification_status',
    ),
    member_role: queryValue(searchParams, 'member_role'),
  }
  const params = Object.fromEntries(
    Object.entries({ ...filters, page, ordering }).filter(([, value]) => value !== ''),
  )
  const companiesQuery = useQuery({
    queryKey: adminCompanyKeys.list(params),
    queryFn: ({ signal }) => getAdminCompanies(params, { signal }),
  })
  const summaryQuery = useQuery({
    queryKey: adminCompanyKeys.summary,
    queryFn: ({ signal }) => getAdminCompanySummary({ signal }),
  })
  const companies = companiesQuery.data || EMPTY_PAGE
  const summary = summaryQuery.data || {
    total: 0,
    verification: {},
    pending_update_requests: 0,
  }
  const activeFilterCount = [
    filters.verification_status,
    filters.recruiter_verification_status,
    filters.member_role,
  ].filter(Boolean).length + (query ? 1 : 0)

  useEffect(() => {
    setSearchInput(query)
  }, [query])

  useEffect(() => {
    const normalizedQuery = searchInput.trim()
    if (normalizedQuery === query) return undefined

    const timeoutId = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams)
      if (normalizedQuery) next.set('q', normalizedQuery)
      else next.delete('q')
      next.delete('page')
      setSearchParams(next, { replace: true })
    }, 400)

    return () => window.clearTimeout(timeoutId)
  }, [query, searchInput, searchParams, setSearchParams])

  const updateParams = (changes, { resetPage = true } = {}) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(changes).forEach(([key, value]) => {
      if (value === '' || value == null) next.delete(key)
      else next.set(key, String(value))
    })
    if (resetPage) next.delete('page')
    setSearchParams(next)
  }

  const clearFilters = () => {
    setSearchInput('')
    setSearchParams(new URLSearchParams())
  }

  const openCompany = (company) => navigate(
    adminPath(`/companies/${company.public_id}`),
    {
      state: {
        origin: {
          pathname: location.pathname,
          search: location.search,
          label: 'Danh sách công ty',
        },
      },
    },
  )

  return (
    <div className="company-directory company-management-tab-content space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Tóm tắt công ty">
        <CompanyStatCard
          icon={<BankOutlined />}
          label="Tổng công ty"
          value={summary.total}
          hint="Xem toàn bộ"
          active={activeFilterCount === 0}
          onClick={clearFilters}
        />
        <CompanyStatCard
          icon={<CheckCircleOutlined />}
          label="Đã xác thực"
          value={summary.verification?.verified}
          tone="green"
          hint="Lọc danh sách"
          active={filters.verification_status === 'verified'}
          onClick={() => updateParams({ verification_status: 'verified' })}
        />
        <CompanyStatCard
          icon={<FileSyncOutlined />}
          label="Chờ duyệt pháp nhân"
          value={summary.verification?.pending}
          tone="amber"
          hint="Cần theo dõi"
          active={filters.verification_status === 'pending'}
          onClick={() => updateParams({ verification_status: 'pending' })}
        />
        <CompanyStatCard
          icon={<FileSyncOutlined />}
          label="Yêu cầu cập nhật"
          value={summary.pending_update_requests}
          tone="amber"
          hint={onOpenUpdates ? 'Mở hàng đợi xử lý' : 'Đang chờ xử lý'}
          onClick={onOpenUpdates}
        />
      </section>

      <div>
        <CompanyDirectoryFilters
          filters={filters}
          loading={companiesQuery.isLoading}
          ordering={ordering}
          searchInput={searchInput}
          total={companies.count}
          onClear={clearFilters}
          onPatch={updateParams}
          onSearchChange={(event) => setSearchInput(event.target.value)}
        />

        {companiesQuery.isError && (
          <Alert
            className="mb-4"
            type="error"
            showIcon
            title="Không thể tải danh sách công ty"
            description={getApiErrorMessage(companiesQuery.error)}
            action={<Button onClick={() => companiesQuery.refetch()}>Thử lại</Button>}
          />
        )}

        <CompanyDirectoryTable
          companies={companies}
          loading={companiesQuery.isLoading}
          ordering={ordering}
          page={page}
          onOpen={openCompany}
          onChange={(pagination, _, sorter) => {
            const field = sorter.columnKey || sorter.field
            const nextOrdering = sorter.order
              ? `${sorter.order === 'descend' ? '-' : ''}${field}`
              : DEFAULT_ORDERING
            updateParams(
              { page: pagination.current, ordering: nextOrdering },
              { resetPage: false },
            )
          }}
        />
      </div>
    </div>
  )
}
