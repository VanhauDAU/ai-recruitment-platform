import { EyeOutlined, SearchOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, DatePicker, Input, Select, Table, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { useDeferredValue, useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  adminEmployerVerificationKeys,
  getAdminEmployerVerifications,
  verificationStatusMeta,
} from '@/entities/admin-employer-verification'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { adminPath } from '@/shared/config/portals'

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'in_review', label: 'Đang xử lý' },
  { value: 'changes_requested', label: 'Cần bổ sung' },
  { value: 'rejected', label: 'Bị từ chối' },
  { value: 'approved', label: 'Đã xác thực' },
]

const DOCUMENT_OPTIONS = [
  { value: '', label: 'Tất cả giấy tờ' },
  { value: 'business_registration', label: 'Giấy đăng ký doanh nghiệp' },
  { value: 'authorization_letter', label: 'Giấy ủy quyền' },
  { value: 'identity_document', label: 'Giấy tờ định danh' },
  { value: 'data_processing_agreement', label: 'Văn bản xử lý dữ liệu' },
]

const VERIFICATION_QUERY_KEYS = {
  q: 'verify_q',
  status: 'verify_status',
  document_type: 'verify_document',
  phone_verified: 'verify_phone',
  age: 'verify_age',
  submitted_from: 'verify_from',
  submitted_to: 'verify_to',
  page: 'verify_page',
  ordering: 'verify_ordering',
}

function verificationFiltersFromQuery(searchParams) {
  const page = Number(searchParams.get(VERIFICATION_QUERY_KEYS.page) || 1)
  const submittedFrom = searchParams.get(VERIFICATION_QUERY_KEYS.submitted_from)
  const submittedTo = searchParams.get(VERIFICATION_QUERY_KEYS.submitted_to)
  return {
    q: searchParams.get(VERIFICATION_QUERY_KEYS.q) || '',
    status: searchParams.get(VERIFICATION_QUERY_KEYS.status) || 'pending',
    document_type: searchParams.get(VERIFICATION_QUERY_KEYS.document_type) || '',
    phone_verified: searchParams.get(VERIFICATION_QUERY_KEYS.phone_verified) || '',
    age: searchParams.get(VERIFICATION_QUERY_KEYS.age) || '',
    ordering: searchParams.get(VERIFICATION_QUERY_KEYS.ordering) || '-submitted_at',
    page: Number.isInteger(page) && page > 0 ? page : 1,
    submitted_range: submittedFrom && submittedTo
      ? [dayjs(submittedFrom), dayjs(submittedTo)]
      : [],
  }
}

function formatDate(value) {
  if (!value) return 'Chưa nộp'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function VerificationQueuePanel() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(
    () => verificationFiltersFromQuery(searchParams),
    [searchParams],
  )
  const page = filters.page
  const search = useDeferredValue(filters.q.trim())
  const params = useMemo(() => {
    const result = {
      page,
      q: search,
      status: filters.status === 'all' ? '' : filters.status,
      document_type: filters.document_type,
      phone_verified: filters.phone_verified,
      age: filters.age,
      ordering: filters.ordering,
      company: searchParams.get('company') || '',
    }
    if (filters.submitted_range?.length === 2) {
      result.submitted_from = filters.submitted_range[0].format('YYYY-MM-DD')
      result.submitted_to = filters.submitted_range[1].format('YYYY-MM-DD')
    }
    return Object.fromEntries(
      Object.entries(result).filter(([, value]) => value !== ''),
    )
  }, [filters, page, search, searchParams])
  const query = useQuery({
    queryKey: adminEmployerVerificationKeys.list(params),
    queryFn: ({ signal }) => getAdminEmployerVerifications(params, { signal }),
  })

  const update = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (key === 'submitted_range') {
      if (value?.length === 2) {
        next.set(VERIFICATION_QUERY_KEYS.submitted_from, value[0].format('YYYY-MM-DD'))
        next.set(VERIFICATION_QUERY_KEYS.submitted_to, value[1].format('YYYY-MM-DD'))
      } else {
        next.delete(VERIFICATION_QUERY_KEYS.submitted_from)
        next.delete(VERIFICATION_QUERY_KEYS.submitted_to)
      }
    } else {
      const queryKey = VERIFICATION_QUERY_KEYS[key]
      const defaultValue = key === 'ordering'
        ? '-submitted_at'
        : key === 'status' ? 'pending' : ''
      if (value === defaultValue || value === '' || value == null || (key === 'page' && value === 1)) {
        next.delete(queryKey)
      } else {
        next.set(queryKey, String(value))
      }
    }
    if (key !== 'page') next.delete(VERIFICATION_QUERY_KEYS.page)
    setSearchParams(next)
  }

  return (
    <div className="space-y-4">
      <div className="verification-queue-filters">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Email, họ tên, công ty, MST hoặc mã hồ sơ"
          value={filters.q}
          onChange={(event) => update('q', event.target.value)}
        />
        <Select
          aria-label="Trạng thái xác thực NTD"
          value={filters.status}
          options={STATUS_OPTIONS}
          onChange={(value) => update('status', value)}
        />
        <Select
          value={filters.document_type}
          options={DOCUMENT_OPTIONS}
          onChange={(value) => update('document_type', value)}
        />
        <Select
          value={filters.phone_verified}
          options={[
            { value: '', label: 'Mọi trạng thái điện thoại' },
            { value: 'true', label: 'Đã xác minh điện thoại' },
            { value: 'false', label: 'Chưa xác minh điện thoại' },
          ]}
          onChange={(value) => update('phone_verified', value)}
        />
        <Select
          value={filters.age}
          options={[
            { value: '', label: 'Mọi thời gian chờ' },
            { value: 'under_24h', label: 'Dưới 24 giờ' },
            { value: '24_72h', label: '24–72 giờ' },
            { value: 'over_72h', label: 'Trên 72 giờ' },
          ]}
          onChange={(value) => update('age', value)}
        />
        <DatePicker.RangePicker
          value={filters.submitted_range}
          onChange={(value) => update('submitted_range', value || [])}
          placeholder={['Nộp từ ngày', 'Đến ngày']}
        />
      </div>

      <Typography.Title level={5} className="!mb-2 !mt-0">
        Hồ sơ xác thực nhà tuyển dụng
      </Typography.Title>

      {query.isError && (
        <Alert
          showIcon
          type="error"
          title="Không thể tải hàng chờ xác thực"
          description={getApiErrorMessage(query.error)}
        />
      )}
      <div className="overflow-x-auto">
        <Table
          rowKey="public_id"
          loading={query.isLoading}
          dataSource={query.data?.results || []}
          scroll={{ x: 1180 }}
          pagination={{
            current: page,
            pageSize: 20,
            total: query.data?.count || 0,
            showSizeChanger: false,
            showTotal: (total) => `${total.toLocaleString('vi-VN')} hồ sơ`,
          }}
          columns={[
            {
              title: 'Nhà tuyển dụng',
              key: 'recruiter__user__full_name',
              width: 250,
              sorter: true,
              sortOrder: filters.ordering === 'recruiter__user__full_name'
                ? 'ascend'
                : filters.ordering === '-recruiter__user__full_name' ? 'descend' : null,
              render: (_, row) => (
                <div>
                  <Typography.Text strong className="!block">
                    {row.full_name || 'Chưa cập nhật họ tên'}
                  </Typography.Text>
                  <Typography.Text type="secondary" className="!block !text-xs">
                    {row.email}
                  </Typography.Text>
                </div>
              ),
            },
            {
              title: 'Công ty',
              key: 'company__company_name',
              width: 220,
              sorter: true,
              sortOrder: filters.ordering === 'company__company_name'
                ? 'ascend'
                : filters.ordering === '-company__company_name' ? 'descend' : null,
              render: (_, row) => (
                <div>
                  <Typography.Text className="!block">
                    {row.company?.name || 'Chưa liên kết'}
                  </Typography.Text>
                  <Typography.Text type="secondary" className="!block !text-xs">
                    {row.company?.tax_code || 'Chưa có MST'}
                  </Typography.Text>
                </div>
              ),
            },
            {
              title: 'Trạng thái',
              dataIndex: 'status',
              key: 'status',
              width: 150,
              sorter: true,
              sortOrder: filters.ordering === 'status'
                ? 'ascend'
                : filters.ordering === '-status' ? 'descend' : null,
              render: (status, row) => {
                const meta = verificationStatusMeta(status)
                if (!row.pending_document_count) {
                  return <Tag color={meta.color}>{meta.label}</Tag>
                }
                return (
                  <div className="flex flex-wrap gap-1">
                    <Tag color="gold" className="!m-0">
                      {`${row.pending_document_count} file chờ duyệt`}
                    </Tag>
                    {status !== 'pending' && (
                      <Tag color={meta.color} className="!m-0">
                        {`Hồ sơ: ${meta.label}`}
                      </Tag>
                    )}
                  </div>
                )
              },
            },
            {
              title: 'Bước còn thiếu',
              dataIndex: 'missing_steps',
              key: 'current_document_count',
              width: 135,
              sorter: true,
              sortOrder: filters.ordering === 'current_document_count'
                ? 'ascend'
                : filters.ordering === '-current_document_count' ? 'descend' : null,
              render: (value) => `${value?.length || 0} bước`,
            },
            {
              title: 'Điện thoại',
              dataIndex: 'phone_verified',
              key: 'recruiter__phone_verified_at',
              width: 145,
              sorter: true,
              sortOrder: filters.ordering === 'recruiter__phone_verified_at'
                ? 'ascend'
                : filters.ordering === '-recruiter__phone_verified_at' ? 'descend' : null,
              render: (value) => (
                <Tag color={value ? 'green' : 'orange'}>
                  {value ? 'Đã xác minh' : 'Chưa xác minh'}
                </Tag>
              ),
            },
            {
              title: 'Nộp gần nhất',
              dataIndex: 'submitted_at',
              key: 'submitted_at',
              width: 170,
              sorter: true,
              sortOrder: filters.ordering === 'submitted_at'
                ? 'ascend'
                : filters.ordering === '-submitted_at' ? 'descend' : null,
              render: formatDate,
            },
            {
              title: '',
              key: 'action',
              fixed: 'right',
              width: 120,
              render: (_, row) => (
                <Button
                  type="link"
                  icon={<EyeOutlined />}
                  onClick={() => navigate(
                    `${adminPath(`/recruiters/${row.user_public_id}`)}?tab=verification`,
                    {
                      state: {
                        origin: {
                          pathname: location.pathname,
                          search: location.search,
                          label: 'Hàng chờ xác thực NTD',
                        },
                      },
                    },
                  )}
                >
                  Xử lý
                </Button>
              ),
            },
          ]}
          onChange={(pagination, _, sorter, extra) => {
            if (extra.action === 'sort') {
              const ordering = sorter.order
                ? `${sorter.order === 'descend' ? '-' : ''}${sorter.columnKey}`
                : '-submitted_at'
              update('ordering', ordering)
              return
            }
            update('page', pagination.current)
          }}
        />
      </div>
    </div>
  )
}
