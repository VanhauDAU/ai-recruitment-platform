import {
  ArrowRightOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { Button, Empty, Space, Table, Tag } from 'antd'

const CHANGE_FIELD_LABELS = {
  address: 'Địa chỉ',
  business_type: 'Loại hình',
  company_name: 'Tên pháp lý',
  company_size: 'Quy mô',
  cover_image_url: 'Ảnh bìa',
  description: 'Giới thiệu',
  email: 'Email công ty',
  employee_benefits: 'Phúc lợi',
  founded_year: 'Năm thành lập',
  gallery_additions: 'Thư viện ảnh',
  has_no_logo: 'Trạng thái logo',
  has_no_website: 'Trạng thái website',
  industries: 'Lĩnh vực',
  logo_url: 'Logo',
  markets: 'Thị trường',
  phone: 'Số điện thoại',
  primary_industry: 'Lĩnh vực chính',
  target_customers: 'Khách hàng mục tiêu',
  tax_code: 'Mã số thuế',
  trade_name: 'Tên giao dịch',
  website_url: 'Website',
}

const STATUS_PRESENTATION = {
  submitted: ['blue', 'Chờ tiếp nhận'],
  in_review: ['gold', 'Đang thẩm định'],
  changes_requested: ['orange', 'Chờ chỉnh sửa'],
}

function formatDate(value) {
  if (!value) return 'Chưa gửi'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function ChangeSummary({ changes }) {
  const fields = Object.keys(changes || {})
  const visibleFields = fields.slice(0, 3)
  return (
    <div>
      <Space size={[4, 4]} wrap>
        {visibleFields.map((field) => (
          <Tag key={field} className="!m-0">
            {CHANGE_FIELD_LABELS[field] || field}
          </Tag>
        ))}
        {fields.length > visibleFields.length && (
          <Tag className="!m-0">+{fields.length - visibleFields.length}</Tag>
        )}
      </Space>
      <div className="mt-1.5 text-xs text-slate-500">
        {fields.length} trường thông tin được đề nghị thay đổi
      </div>
    </div>
  )
}

function sorterOrder(ordering, field) {
  if (ordering === field) return 'ascend'
  if (ordering === `-${field}`) return 'descend'
  return null
}

export default function CompanyUpdateQueueTable({
  data,
  loading,
  ordering,
  page,
  onChange,
  onOpen,
}) {
  const columns = [
    {
      title: 'Trạng thái',
      key: 'status',
      width: 150,
      render: (_, row) => {
        const [color, label] = STATUS_PRESENTATION[row.status] || ['default', row.status_label]
        return <Tag color={color}>{label || row.status}</Tag>
      },
    },
    {
      title: 'Công ty',
      key: 'company__company_name',
      width: 250,
      sorter: true,
      sortOrder: sorterOrder(ordering, 'company__company_name'),
      render: (_, row) => (
        <div>
          <div className="font-bold text-slate-900">{row.company?.name}</div>
          <div className="mt-1 text-xs text-slate-500">
            {row.company?.tax_code ? `MST ${row.company.tax_code}` : row.company?.public_id}
          </div>
        </div>
      ),
    },
    {
      title: 'Người đề nghị',
      key: 'requested_by__email',
      width: 230,
      sorter: true,
      sortOrder: sorterOrder(ordering, 'requested_by__email'),
      render: (_, row) => (
        <div>
          <div className="font-medium text-slate-800">{row.requested_by_email}</div>
          <div className="mt-1 text-xs text-slate-400">{row.requested_by_public_id}</div>
        </div>
      ),
    },
    {
      title: 'Nội dung thay đổi',
      dataIndex: 'changes',
      key: 'change_count',
      width: 300,
      sorter: true,
      sortOrder: sorterOrder(ordering, 'change_count'),
      render: (changes) => <ChangeSummary changes={changes} />,
    },
    {
      title: 'Mức độ & hồ sơ',
      key: 'is_sensitive',
      width: 200,
      sorter: true,
      sortOrder: sorterOrder(ordering, 'is_sensitive'),
      render: (_, row) => (
        <div>
          <Tag color={row.is_sensitive ? 'red' : 'blue'} className="!m-0">
            {row.is_sensitive ? 'Thay đổi pháp lý' : 'Thông tin vận hành'}
          </Tag>
          <div className="mt-2 text-xs text-slate-500">
            {row.documents?.length || 0} tài liệu
            {row.proof_type_label ? ` · ${row.proof_type_label}` : ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Tiếp nhận',
      key: 'updated_at',
      width: 190,
      sorter: true,
      sortOrder: sorterOrder(ordering, 'updated_at'),
      render: (_, row) => (
        <div>
          <div className="flex items-center gap-1.5 font-medium text-slate-700">
            <ClockCircleOutlined aria-hidden="true" />
            {formatDate(row.updated_at)}
          </div>
          <div className="mt-1 text-xs text-slate-400">Gửi {formatDate(row.created_at)}</div>
        </div>
      ),
    },
    {
      title: 'Hành động',
      key: 'action',
      fixed: 'right',
      width: 150,
      render: (_, row) => (
        <Button
          type="primary"
          icon={<ArrowRightOutlined />}
          iconPlacement="end"
          onClick={() => onOpen(row)}
        >
          Mở yêu cầu
        </Button>
      ),
    },
  ]

  return (
    <Table
      rowKey="public_id"
      loading={loading}
      dataSource={data.results}
      columns={columns}
      className="company-update-queue__table"
      scroll={{ x: 1310 }}
      locale={{
        emptyText: (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={(
              <span>
                <strong className="block text-slate-700">Không có yêu cầu nào đang chờ</strong>
                <span className="mt-1 block text-xs text-slate-500">
                  Các yêu cầu mới sẽ xuất hiện tại đây để quản trị viên xử lý.
                </span>
              </span>
            )}
          />
        ),
      }}
      pagination={{
        current: page,
        pageSize: 20,
        total: data.count,
        showSizeChanger: false,
        showTotal: (total) => `${total.toLocaleString('vi-VN')} yêu cầu`,
      }}
      onChange={onChange}
    />
  )
}
