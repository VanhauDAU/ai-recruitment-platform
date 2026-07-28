import {
  BankOutlined,
  FileSyncOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Empty,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from 'antd'
import { useNavigate, useSearchParams } from 'react-router'
import {
  adminCompanyKeys,
  getAdminCompanies,
  recruiterVerificationMeta,
} from '@/entities/admin-company'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { adminPath } from '@/shared/config/portals'
import CompanyLogo from './CompanyLogo'
import { CompanyPanel, CompanyStatCard } from './CompanyPanel'
import { CompanyStatusTag } from './CompanyStatusTags'
import '../admin-company-directory.css'

const EMPTY_PAGE = { count: 0, results: [] }
const DEFAULT_ORDERING = '-updated_at'

const COMPANY_STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái công ty' },
  { value: 'unverified', label: 'Chưa xác thực' },
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'verified', label: 'Đã xác thực' },
  { value: 'rejected', label: 'Bị từ chối' },
]

const RECRUITER_STATUS_OPTIONS = [
  { value: '', label: 'Mọi trạng thái NTD' },
  { value: 'none', label: 'Chưa có hồ sơ' },
  { value: 'draft', label: 'Chưa nộp' },
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'in_review', label: 'Đang xử lý' },
  { value: 'changes_requested', label: 'Cần bổ sung' },
  { value: 'approved', label: 'Đã xác thực' },
  { value: 'rejected', label: 'Bị từ chối' },
]

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function queryValue(searchParams, key, fallback = '') {
  return searchParams.get(key) || fallback
}

function sorterOrder(ordering, field) {
  if (ordering === field) return 'ascend'
  if (ordering === `-${field}`) return 'descend'
  return null
}

function VerificationSummary({ summary = {} }) {
  const entries = Object.entries(summary).filter(([, count]) => count > 0)
  if (!entries.length) return <span className="text-slate-400">Chưa có NTD</span>
  return (
    <Space size={[4, 4]} wrap>
      {entries.map(([status, count]) => {
        const meta = recruiterVerificationMeta(status)
        return (
          <Tag key={status} color={meta.color}>
            {meta.label}: {count}
          </Tag>
        )
      })}
    </Space>
  )
}

export default function AdminCompanyDirectory() {
  const navigate = useNavigate()
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
  const companies = companiesQuery.data || EMPTY_PAGE

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

  const columns = [
    {
      title: 'Công ty',
      dataIndex: 'company_name',
      key: 'company_name',
      width: 280,
      sorter: true,
      sortOrder: sorterOrder(ordering, 'company_name'),
      render: (name, company) => (
        <button
          type="button"
          className="company-directory__company-button"
          onClick={() => navigate(adminPath(`/companies/${company.public_id}`))}
        >
          <CompanyLogo company={company} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-slate-900">{name}</span>
            <span className="mt-0.5 block truncate text-xs text-slate-500">
              {company.trade_name || company.public_id}
            </span>
          </span>
        </button>
      ),
    },
    {
      title: 'Loại hình',
      dataIndex: 'business_type_label',
      key: 'business_type',
      width: 140,
      sorter: true,
      sortOrder: sorterOrder(ordering, 'business_type'),
      render: (value) => value || '—',
    },
    {
      title: 'Trạng thái công ty',
      dataIndex: 'verification_status',
      key: 'verification_status',
      width: 170,
      sorter: true,
      sortOrder: sorterOrder(ordering, 'verification_status'),
      render: (status) => <CompanyStatusTag status={status} />,
    },
    {
      title: 'Owner',
      dataIndex: 'owner_count',
      key: 'owner_count',
      width: 210,
      sorter: true,
      sortOrder: sorterOrder(ordering, 'owner_count'),
      render: (count, company) => count ? (
        <div className="font-medium text-slate-800">
          {company.owners.map((owner) => owner.full_name || owner.email).join(', ')}
        </div>
      ) : '—',
    },
    {
      title: 'NTD',
      dataIndex: 'recruiter_count',
      key: 'recruiter_count',
      width: 100,
      align: 'center',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'recruiter_count'),
      render: (value, company) => (
        <Tooltip title={`${company.owner_count} owner · ${company.member_count} member`}>
          <strong>{value}</strong>
        </Tooltip>
      ),
    },
    {
      title: 'Xác thực NTD',
      dataIndex: 'recruiter_verification_summary',
      key: 'approved_recruiter_count',
      width: 260,
      sorter: true,
      sortOrder: sorterOrder(ordering, 'approved_recruiter_count'),
      render: (summary) => <VerificationSummary summary={summary} />,
    },
    {
      title: 'Yêu cầu sửa',
      dataIndex: 'pending_update_count',
      key: 'pending_update_count',
      width: 125,
      align: 'center',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'pending_update_count'),
      render: (value) => value ? <Tag color="gold">{value} chờ duyệt</Tag> : '—',
    },
    {
      title: 'Cập nhật',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 170,
      sorter: true,
      sortOrder: sorterOrder(ordering, 'updated_at'),
      render: formatDate,
    },
  ]

  const verifiedCount = companies.results.filter(
    (company) => company.verification_status === 'verified',
  ).length
  const pendingUpdateCount = companies.results.reduce(
    (total, company) => total + company.pending_update_count,
    0,
  )

  return (
    <div className="company-directory space-y-5">
      <header className="admin-page-header">
        <div>
          <p className="admin-page-header__eyebrow">Công ty & NTD</p>
          <h1 className="admin-page-header__title">Danh sách công ty</h1>
          <p className="admin-page-header__description">
            Theo dõi pháp nhân, owner/member và trạng thái xác thực của từng nhà tuyển dụng.
          </p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Tóm tắt công ty">
        <CompanyStatCard icon={<BankOutlined />} label="Tổng kết quả" value={companies.count} />
        <CompanyStatCard
          icon={<SafetyCertificateOutlined />}
          label="Đã xác thực trong trang"
          value={verifiedCount}
          tone="green"
        />
        <CompanyStatCard
          icon={<FileSyncOutlined />}
          label="Yêu cầu cập nhật trong trang"
          value={pendingUpdateCount}
          tone="amber"
        />
      </section>

      <CompanyPanel
        title="Tra cứu công ty"
        description="Trạng thái công ty và xác thực đại diện NTD được lọc độc lập."
      >
        <div className="company-directory__filters">
          <Input.Search
            allowClear
            aria-label="Tìm công ty"
            placeholder="Tên, mã công ty, mã số thuế hoặc email"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <Select
            aria-label="Lọc trạng thái công ty"
            value={filters.verification_status}
            options={COMPANY_STATUS_OPTIONS}
            onChange={(value) => updateParams({ verification_status: value })}
          />
          <Select
            aria-label="Lọc xác thực NTD"
            value={filters.recruiter_verification_status}
            options={RECRUITER_STATUS_OPTIONS}
            onChange={(value) => updateParams({ recruiter_verification_status: value })}
          />
          <Select
            aria-label="Lọc vai trò thành viên"
            value={filters.member_role}
            options={[
              { value: '', label: 'Mọi vai trò NTD' },
              { value: 'owner', label: 'Owner' },
              { value: 'member', label: 'Member' },
            ]}
            onChange={(value) => updateParams({ member_role: value })}
          />
          <Button onClick={clearFilters}>Xóa bộ lọc</Button>
        </div>

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

        <Table
          rowKey="public_id"
          loading={companiesQuery.isLoading}
          dataSource={companies.results}
          columns={columns}
          locale={{ emptyText: <Empty description="Không tìm thấy công ty phù hợp" /> }}
          scroll={{ x: 1450 }}
          pagination={{
            current: page,
            pageSize: 20,
            total: companies.count,
            showSizeChanger: false,
            showTotal: (total) => `${total} công ty`,
          }}
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
          onRow={(company) => ({
            onDoubleClick: () => navigate(adminPath(`/companies/${company.public_id}`)),
          })}
        />
      </CompanyPanel>
    </div>
  )
}
