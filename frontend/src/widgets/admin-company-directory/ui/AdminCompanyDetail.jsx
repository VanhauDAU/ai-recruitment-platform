import {
  ArrowLeftOutlined,
  BankOutlined,
  EyeOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Avatar,
  Button,
  Descriptions,
  Empty,
  Input,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
} from 'antd'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  adminCompanyKeys,
  getAdminCompany,
  getAdminCompanyRecruiters,
  recruiterVerificationMeta,
} from '@/entities/admin-company'
import { useAdminAccess } from '@/entities/admin-access'
import { useSession } from '@/entities/session'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { adminPath } from '@/shared/config/portals'
import { sanitizeHtml } from '@/shared/lib/sanitize-html'
import CompanyLogo from './CompanyLogo'
import { CompanyPanel } from './CompanyPanel'
import { CompanyStatusTag, RecruiterStatusTag } from './CompanyStatusTags'
import '../admin-company-directory.css'

const EMPTY_PAGE = { count: 0, results: [] }
const TAB_KEYS = new Set(['overview', 'recruiters', 'verification', 'updates', 'jobs'])

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function yesNo(value) {
  return value ? 'Đã hoàn tất' : 'Chưa hoàn tất'
}

function personInitials(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return 'NT'
  if (words.length === 1) return words[0].slice(0, 2).toLocaleUpperCase('vi-VN')
  return `${words[0][0]}${words.at(-1)[0]}`.toLocaleUpperCase('vi-VN')
}

function CompanyDescription({ description }) {
  const sanitizedDescription = sanitizeHtml(description)
  if (!sanitizedDescription) {
    return <span className="text-slate-400">Chưa cập nhật mô tả doanh nghiệp</span>
  }
  return (
    <div
      className="company-directory__rich-text"
      dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
    />
  )
}

function Overview({ company }) {
  return (
    <div className="space-y-5">
      <CompanyPanel title="Thông tin doanh nghiệp">
        <div className="company-directory__brand-overview">
          <CompanyLogo company={company} size={58} />
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-slate-900">
              {company.trade_name || company.company_name}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <CompanyStatusTag status={company.verification_status} />
              {company.business_type_label && <Tag>{company.business_type_label}</Tag>}
              {company.company_size_label && <Tag>{company.company_size_label}</Tag>}
            </div>
          </div>
        </div>
        <div className="company-directory__description">
          <p className="company-directory__section-label">Giới thiệu</p>
          <CompanyDescription description={company.description} />
        </div>
      </CompanyPanel>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <CompanyPanel title="Hồ sơ pháp lý">
          <Descriptions column={{ xs: 1, md: 2 }} size="middle">
            <Descriptions.Item label="Tên đăng ký">{company.company_name}</Descriptions.Item>
            <Descriptions.Item label="Tên giao dịch">{company.trade_name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Mã số thuế">
              {company.tax_code || 'Không có quyền xem'}
            </Descriptions.Item>
            <Descriptions.Item label="Loại hình">{company.business_type_label || '—'}</Descriptions.Item>
            <Descriptions.Item label="Quy mô">{company.company_size_label || '—'}</Descriptions.Item>
            <Descriptions.Item label="Năm thành lập">{company.founded_year || '—'}</Descriptions.Item>
            <Descriptions.Item label="Địa chỉ" span={2}>{company.address || '—'}</Descriptions.Item>
            <Descriptions.Item label="Lĩnh vực" span={2}>
              <Space size={[4, 4]} wrap>
                {company.industries?.length
                  ? company.industries.map((industry) => (
                    <Tag key={industry.id} color={industry.is_primary ? 'green' : 'default'}>
                      {industry.name}{industry.is_primary ? ' · chính' : ''}
                    </Tag>
                  ))
                  : '—'}
              </Space>
            </Descriptions.Item>
          </Descriptions>
        </CompanyPanel>

        <div className="space-y-5">
          <CompanyPanel title="Tổ chức nhà tuyển dụng">
            <div className="company-directory__overview-metrics">
              <div>
                <strong>{company.recruiter_count}</strong>
                <span>Tổng NTD</span>
              </div>
              <div>
                <strong>{company.owner_count}</strong>
                <span>Owner</span>
              </div>
              <div>
                <strong>{company.member_count}</strong>
                <span>Member</span>
              </div>
            </div>
            {company.owner_count !== 1 && (
              <Alert
                className="mt-4"
                showIcon
                type="warning"
                title={company.owner_count
                  ? `Dữ liệu bất thường: ${company.owner_count} owner`
                  : 'Công ty chưa có owner'}
              />
            )}
          </CompanyPanel>
          <CompanyPanel title="Liên hệ">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Website">{company.website_url || '—'}</Descriptions.Item>
              <Descriptions.Item label="Email">{company.email || 'Không có quyền xem'}</Descriptions.Item>
              <Descriptions.Item label="Điện thoại">{company.phone || '—'}</Descriptions.Item>
            </Descriptions>
          </CompanyPanel>
          <CompanyPanel title="Nguồn tạo">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Người tạo">
                {company.created_by?.full_name || company.created_by?.email || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày tạo">{formatDate(company.created_at)}</Descriptions.Item>
              <Descriptions.Item label="Cập nhật">{formatDate(company.updated_at)}</Descriptions.Item>
            </Descriptions>
          </CompanyPanel>
        </div>
      </div>
    </div>
  )
}

function RecruiterRoster({ company, enabled }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('recruiter_page') || 1)
  const role = searchParams.get('role') || ''
  const verificationStatus = searchParams.get('recruiter_status') || ''
  const q = searchParams.get('recruiter_q') || ''
  const ordering = searchParams.get('recruiter_ordering') || 'created_at'
  const params = Object.fromEntries(Object.entries({
    page,
    role,
    verification_status: verificationStatus,
    q,
    ordering,
  }).filter(([, value]) => value !== ''))
  const recruitersQuery = useQuery({
    queryKey: adminCompanyKeys.recruiters(company.public_id, params),
    queryFn: ({ signal }) => getAdminCompanyRecruiters(
      company.public_id,
      params,
      { signal },
    ),
    enabled,
  })
  const recruiters = recruitersQuery.data || EMPTY_PAGE
  const updateParams = (changes, resetPage = true) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(changes).forEach(([key, value]) => {
      if (value === '' || value == null) next.delete(key)
      else next.set(key, String(value))
    })
    if (resetPage) next.delete('recruiter_page')
    setSearchParams(next)
  }

  if (!enabled) {
    return (
      <Alert
        showIcon
        type="warning"
        title="Bạn chưa có quyền xem nhà tuyển dụng của công ty"
        description="Cần quyền company_recruiter.view để mở roster owner/member."
      />
    )
  }

  const columns = [
    {
      title: 'Nhà tuyển dụng',
      dataIndex: ['account', 'full_name'],
      key: 'user__full_name',
      width: 260,
      sorter: true,
      render: (_, recruiter) => (
        <button
          type="button"
          className="company-directory__company-button"
          onClick={() => navigate(
            adminPath(`/recruiters/${recruiter.account.public_id}`),
            {
              state: {
                origin: {
                  pathname: location.pathname,
                  search: location.search,
                  label: company.company_name,
                },
              },
            },
          )}
        >
          <Avatar
            aria-label={`Ảnh đại diện ${recruiter.account.full_name || recruiter.account.email}`}
            size={38}
            src={recruiter.account.avatar_url || undefined}
          >
            {!recruiter.account.avatar_url && personInitials(
              recruiter.account.full_name || recruiter.account.email,
            )}
          </Avatar>
          <div className="min-w-0">
            <div className="truncate font-semibold text-slate-900">
              {recruiter.account.full_name || recruiter.account.email}
            </div>
            <div className="mt-1 truncate text-xs text-slate-500">
              {recruiter.account.email}
            </div>
          </div>
        </button>
      ),
    },
    {
      title: 'Vai trò',
      dataIndex: 'company_role',
      key: 'company_role',
      width: 135,
      sorter: true,
      render: (value, recruiter) => (
        <Tag color={value === 'owner' ? 'blue' : 'default'}>
          {recruiter.company_role_label}
        </Tag>
      ),
    },
    {
      title: 'Chức danh',
      dataIndex: 'position_title',
      key: 'position_title',
      width: 190,
      sorter: true,
      render: (value) => value || '—',
    },
    {
      title: 'Tài khoản',
      dataIndex: ['account', 'status'],
      key: 'user__status',
      width: 130,
      sorter: true,
      render: (status, recruiter) => (
        <Space direction="vertical" size={2}>
          <Tag color={status === 'active' && !recruiter.account.is_deleted ? 'green' : 'red'}>
            {recruiter.account.is_deleted ? 'Đã xóa' : status}
          </Tag>
          <span className="text-xs text-slate-500">
            Email: {recruiter.account.email_verified ? 'đã xác thực' : 'chưa xác thực'}
          </span>
        </Space>
      ),
    },
    {
      title: 'Onboarding',
      dataIndex: 'onboarding_completed',
      key: 'onboarding_completed_at',
      width: 150,
      sorter: true,
      render: (value, recruiter) => (
        <Space direction="vertical" size={2}>
          <span>{yesNo(value)}</span>
          <span className="text-xs text-slate-500">
            SĐT: {recruiter.phone_verified ? 'đã xác thực' : 'chưa xác thực'}
          </span>
        </Space>
      ),
    },
    {
      title: 'Xác thực đại diện NTD',
      dataIndex: ['verification', 'status'],
      key: 'verification_case__status',
      width: 190,
      sorter: true,
      render: (status) => <RecruiterStatusTag status={status} />,
    },
    {
      title: 'Tham gia',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      sorter: true,
      render: formatDate,
    },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 92,
      render: (_, recruiter) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => navigate(
            adminPath(`/recruiters/${recruiter.account.public_id}`),
            {
              state: {
                origin: {
                  pathname: location.pathname,
                  search: location.search,
                  label: company.company_name,
                },
              },
            },
          )}
        >
          Chi tiết
        </Button>
      ),
    },
  ]

  return (
    <CompanyPanel
      title={`Nhà tuyển dụng (${recruiters.count})`}
      description="Owner/member là vai trò trong công ty; trạng thái xác thực thuộc từng tài khoản NTD."
    >
      <div className="company-directory__roster-filters">
        <Input.Search
          allowClear
          aria-label="Tìm nhà tuyển dụng"
          placeholder="Tên, email hoặc chức danh"
          value={q}
          onChange={(event) => updateParams({ recruiter_q: event.target.value })}
        />
        <Select
          aria-label="Lọc vai trò NTD"
          value={role}
          options={[
            { value: '', label: 'Owner và member' },
            { value: 'owner', label: 'Owner' },
            { value: 'member', label: 'Member' },
          ]}
          onChange={(value) => updateParams({ role: value })}
        />
        <Select
          aria-label="Lọc trạng thái xác thực NTD"
          value={verificationStatus}
          options={[
            { value: '', label: 'Mọi trạng thái xác thực' },
            ...Object.entries({
              none: 'Chưa có hồ sơ',
              draft: 'Chưa nộp',
              pending: 'Chờ duyệt',
              in_review: 'Đang xử lý',
              changes_requested: 'Cần bổ sung',
              approved: 'Đã xác thực',
              rejected: 'Bị từ chối',
            }).map(([value, label]) => ({ value, label })),
          ]}
          onChange={(value) => updateParams({ recruiter_status: value })}
        />
      </div>
      {recruitersQuery.isError && (
        <Alert
          className="mb-4"
          showIcon
          type="error"
          title="Không thể tải danh sách nhà tuyển dụng"
          description={getApiErrorMessage(recruitersQuery.error)}
        />
      )}
      <Table
        rowKey="public_id"
        loading={recruitersQuery.isLoading}
        dataSource={recruiters.results}
        columns={columns.map((column) => ({
          ...column,
          sortOrder: column.sorter && (
            ordering === column.key
              ? 'ascend'
              : ordering === `-${column.key}`
                ? 'descend'
                : null
          ),
        }))}
        locale={{ emptyText: <Empty description="Công ty chưa có NTD phù hợp" /> }}
        scroll={{ x: 1250 }}
        pagination={{
          current: page,
          pageSize: 20,
          total: recruiters.count,
          showSizeChanger: false,
        }}
        onChange={(pagination, _, sorter) => {
          const field = sorter.columnKey
          const nextOrdering = sorter.order
            ? `${sorter.order === 'descend' ? '-' : ''}${field}`
            : 'created_at'
          updateParams(
            {
              recruiter_page: pagination.current,
              recruiter_ordering: nextOrdering,
            },
            false,
          )
        }}
      />
    </CompanyPanel>
  )
}

function Verification({ company }) {
  const summary = company.recruiter_verification_summary || {}
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <CompanyPanel title="Trạng thái pháp lý công ty">
        <div className="company-directory__status-card">
          <BankOutlined />
          <div>
            <p className="mb-2 text-sm text-slate-500">Trạng thái công ty</p>
            <CompanyStatusTag status={company.verification_status} />
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Trạng thái này áp dụng cho pháp nhân, không đại diện cho trạng thái
              xác thực của mọi tài khoản NTD.
            </p>
          </div>
        </div>
      </CompanyPanel>
      <CompanyPanel title="Xác thực đại diện NTD">
        <div className="space-y-3">
          {Object.entries(summary).map(([status, count]) => {
            const meta = recruiterVerificationMeta(status)
            return (
              <div key={status} className="flex items-center justify-between gap-4">
                <Tag color={meta.color}>{meta.label}</Tag>
                <strong>{count}</strong>
              </div>
            )
          })}
          <Link
            className="inline-flex pt-2 font-semibold text-emerald-700"
            to={`${adminPath('/recruiters')}?tab=verification&company=${company.public_id}`}
          >
            Mở hàng chờ xác thực NTD
          </Link>
        </div>
      </CompanyPanel>
    </div>
  )
}

export default function AdminCompanyDetail({ publicId }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useSession()
  const { has, isSuperuser } = useAdminAccess(user)
  const canViewRecruiters = isSuperuser || has('company_recruiter.view')
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab') || 'overview'
  const activeTab = TAB_KEYS.has(requestedTab) ? requestedTab : 'overview'
  const origin = location.state?.origin
  const safeOrigin = origin?.pathname?.startsWith(adminPath('/')) ? origin : null
  const backTarget = safeOrigin
    ? `${safeOrigin.pathname}${safeOrigin.search || ''}`
    : adminPath('/companies')
  const backLabel = safeOrigin?.label || 'Danh sách công ty'
  const companyQuery = useQuery({
    queryKey: adminCompanyKeys.detail(publicId),
    queryFn: ({ signal }) => getAdminCompany(publicId, { signal }),
  })

  if (companyQuery.isLoading) {
    return <CompanyPanel title="Đang tải hồ sơ công ty"><div className="h-40 animate-pulse rounded-xl bg-slate-100" /></CompanyPanel>
  }
  if (companyQuery.isError) {
    return (
      <Alert
        showIcon
        type="error"
        title="Không thể tải hồ sơ công ty"
        description={getApiErrorMessage(companyQuery.error)}
        action={<Button onClick={() => companyQuery.refetch()}>Thử lại</Button>}
      />
    )
  }

  const company = companyQuery.data
  const setTab = (tab) => {
    const next = new URLSearchParams(searchParams)
    if (tab === 'overview') next.delete('tab')
    else next.set('tab', tab)
    setSearchParams(next)
  }
  const tabs = [
    {
      key: 'overview',
      label: 'Tổng quan',
      children: <Overview company={company} />,
    },
    {
      key: 'recruiters',
      label: `Nhà tuyển dụng (${company.recruiter_count})`,
      children: <RecruiterRoster company={company} enabled={canViewRecruiters} />,
    },
    {
      key: 'verification',
      label: 'Xác thực',
      children: <Verification company={company} />,
    },
    {
      key: 'updates',
      label: `Yêu cầu cập nhật (${company.pending_update_count})`,
      children: (
        <CompanyPanel title="Yêu cầu cập nhật thông tin">
          <Link
            className="inline-flex font-semibold text-emerald-700"
            to={`${adminPath('/companies')}?tab=updates&company=${company.public_id}`}
          >
            Xem yêu cầu cập nhật của công ty
          </Link>
        </CompanyPanel>
      ),
    },
    {
      key: 'jobs',
      label: (
        <Space size={6}>
          Tin tuyển dụng
          <Tag>Sắp ra mắt</Tag>
        </Space>
      ),
      disabled: true,
      children: null,
    },
  ]

  return (
    <div className="company-directory company-directory--detail space-y-5">
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(backTarget)}>
        {backLabel}
      </Button>

      <header className="company-directory__hero">
        <CompanyLogo company={company} size={72} />
        <div className="min-w-0 flex-1">
          <p className="admin-page-header__eyebrow">Hồ sơ công ty</p>
          <h1 className="admin-page-header__title">{company.company_name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <CompanyStatusTag status={company.verification_status} />
            <Tag icon={<TeamOutlined />}>{company.recruiter_count} NTD</Tag>
            {company.verification_status === 'verified' && (
              <Tag color="green" icon={<SafetyCertificateOutlined />}>Pháp nhân đã xác thực</Tag>
            )}
          </div>
        </div>
      </header>

      <Tabs activeKey={activeTab} items={tabs} onChange={setTab} />
    </div>
  )
}
