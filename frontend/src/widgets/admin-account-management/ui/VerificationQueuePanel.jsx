import { EyeOutlined, SearchOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, DatePicker, Input, Select, Table, Tag, Typography } from 'antd'
import { useDeferredValue, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  adminEmployerVerificationKeys,
  getAdminEmployerVerifications,
  verificationStatusMeta,
} from '@/entities/admin-employer-verification'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { adminPath } from '@/shared/config/portals'

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
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

function formatDate(value) {
  if (!value) return 'Chưa nộp'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function VerificationQueuePanel() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    q: '',
    status: '',
    document_type: '',
    phone_verified: '',
    age: '',
    submitted_range: [],
  })
  const search = useDeferredValue(filters.q.trim())
  const params = useMemo(() => {
    const result = {
      page,
      q: search,
      status: filters.status,
      document_type: filters.document_type,
      phone_verified: filters.phone_verified,
      age: filters.age,
    }
    if (filters.submitted_range?.length === 2) {
      result.submitted_from = filters.submitted_range[0].format('YYYY-MM-DD')
      result.submitted_to = filters.submitted_range[1].format('YYYY-MM-DD')
    }
    return Object.fromEntries(
      Object.entries(result).filter(([, value]) => value !== ''),
    )
  }, [filters, page, search])
  const query = useQuery({
    queryKey: adminEmployerVerificationKeys.list(params),
    queryFn: ({ signal }) => getAdminEmployerVerifications(params, { signal }),
  })

  const update = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
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
            onChange: setPage,
          }}
          columns={[
            {
              title: 'Nhà tuyển dụng',
              key: 'recruiter',
              width: 250,
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
              key: 'company',
              width: 220,
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
              width: 150,
              render: (status) => {
                const meta = verificationStatusMeta(status)
                return <Tag color={meta.color}>{meta.label}</Tag>
              },
            },
            {
              title: 'Bước còn thiếu',
              dataIndex: 'missing_steps',
              width: 135,
              render: (value) => `${value?.length || 0} bước`,
            },
            {
              title: 'Điện thoại',
              dataIndex: 'phone_verified',
              width: 145,
              render: (value) => (
                <Tag color={value ? 'green' : 'orange'}>
                  {value ? 'Đã xác minh' : 'Chưa xác minh'}
                </Tag>
              ),
            },
            {
              title: 'Nộp gần nhất',
              dataIndex: 'submitted_at',
              width: 170,
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
                    `${adminPath(`/accounts/${row.user_public_id}`)}?tab=verification`,
                  )}
                >
                  Xử lý
                </Button>
              ),
            },
          ]}
        />
      </div>
    </div>
  )
}
