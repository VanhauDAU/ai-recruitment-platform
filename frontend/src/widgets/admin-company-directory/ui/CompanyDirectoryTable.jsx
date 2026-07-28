import {
  ArrowRightOutlined,
  ClockCircleOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Button, Empty, Space, Table, Tag, Tooltip } from 'antd'
import { recruiterVerificationMeta } from '@/entities/admin-company'
import CompanyLogo from './CompanyLogo'
import { CompanyStatusTag } from './CompanyStatusTags'

function formatDate(value) {
  if (!value) return 'Chưa cập nhật'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function sorterOrder(ordering, field) {
  if (ordering === field) return 'ascend'
  if (ordering === `-${field}`) return 'descend'
  return null
}

function VerificationSummary({ summary = {} }) {
  const entries = Object.entries(summary).filter(([, count]) => count > 0)
  if (!entries.length) return <span className="text-sm text-slate-400">Chưa có nhà tuyển dụng</span>

  return (
    <Space size={[4, 4]} wrap>
      {entries.map(([status, count]) => {
        const meta = recruiterVerificationMeta(status)
        return (
          <Tag key={status} color={meta.color} className="!m-0">
            {meta.label} · {count}
          </Tag>
        )
      })}
    </Space>
  )
}

function CompanyIdentity({ company, onOpen }) {
  const secondary = company.tax_code
    ? `MST ${company.tax_code}`
    : company.trade_name || company.public_id

  return (
    <button
      type="button"
      className="company-directory__company-button"
      onClick={() => onOpen(company)}
    >
      <CompanyLogo company={company} />
      <span className="min-w-0">
        <span className="block truncate font-bold text-slate-900">
          {company.company_name}
        </span>
        <span className="mt-1 block truncate text-xs text-slate-500">{secondary}</span>
        {company.trade_name && company.trade_name !== company.company_name && (
          <span className="mt-0.5 block truncate text-xs text-slate-400">
            Tên giao dịch: {company.trade_name}
          </span>
        )}
      </span>
    </button>
  )
}

function CompanyPeople({ company }) {
  const owner = company.owners?.[0]
  return (
    <div className="min-w-0">
      <div className="truncate font-semibold text-slate-800">
        {owner?.full_name || owner?.email || 'Chưa có owner'}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
        <TeamOutlined aria-hidden="true" />
        <span>{company.recruiter_count || 0} NTD</span>
        <span aria-hidden="true">·</span>
        <span>{company.owner_count || 0} owner</span>
        <span aria-hidden="true">·</span>
        <span>{company.member_count || 0} member</span>
      </div>
      {(company.owners?.length || 0) > 1 && (
        <Tooltip title={company.owners.slice(1).map((item) => item.full_name || item.email).join(', ')}>
          <span className="mt-1 inline-block text-xs font-medium text-emerald-600">
            +{company.owners.length - 1} owner khác
          </span>
        </Tooltip>
      )}
    </div>
  )
}

export default function CompanyDirectoryTable({
  companies,
  loading,
  ordering,
  page,
  onChange,
  onOpen,
}) {
  const columns = [
    {
      title: 'Công ty',
      key: 'company_name',
      width: 320,
      sorter: true,
      sortOrder: sorterOrder(ordering, 'company_name'),
      render: (_, company) => <CompanyIdentity company={company} onOpen={onOpen} />,
    },
    {
      title: 'Hồ sơ pháp nhân',
      key: 'verification_status',
      width: 180,
      sorter: true,
      sortOrder: sorterOrder(ordering, 'verification_status'),
      render: (_, company) => (
        <div>
          <CompanyStatusTag status={company.verification_status} />
          <div className="mt-2 text-xs text-slate-500">
            {company.business_type_label || 'Chưa xác định loại hình'}
          </div>
        </div>
      ),
    },
    {
      title: 'Owner & nhà tuyển dụng',
      key: 'owner_count',
      width: 270,
      sorter: true,
      sortOrder: sorterOrder(ordering, 'owner_count'),
      render: (_, company) => <CompanyPeople company={company} />,
    },
    {
      title: 'Xác thực NTD',
      dataIndex: 'recruiter_verification_summary',
      key: 'approved_recruiter_count',
      width: 270,
      sorter: true,
      sortOrder: sorterOrder(ordering, 'approved_recruiter_count'),
      render: (summary) => <VerificationSummary summary={summary} />,
    },
    {
      title: 'Cập nhật & hành động',
      key: 'updated_at',
      width: 230,
      sorter: true,
      sortOrder: sorterOrder(ordering, 'updated_at'),
      render: (_, company) => (
        <div className="company-directory__row-actions">
          <div>
            {company.pending_update_count ? (
              <Tag color="gold" className="!m-0">
                {company.pending_update_count} yêu cầu chờ xử lý
              </Tag>
            ) : (
              <span className="text-xs text-slate-400">Không có yêu cầu mới</span>
            )}
            <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
              <ClockCircleOutlined aria-hidden="true" />
              <span>{formatDate(company.updated_at)}</span>
            </div>
          </div>
          <Button
            type="primary"
            ghost
            icon={<ArrowRightOutlined />}
            iconPlacement="end"
            onClick={() => onOpen(company)}
          >
            Xem chi tiết
          </Button>
        </div>
      ),
    },
  ]

  return (
    <Table
      rowKey="public_id"
      loading={loading}
      dataSource={companies.results}
      columns={columns}
      className="company-directory__table"
      locale={{
        emptyText: (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Không tìm thấy công ty phù hợp với bộ lọc"
          />
        ),
      }}
      scroll={{ x: 1270 }}
      pagination={{
        current: page,
        pageSize: 20,
        total: companies.count,
        showSizeChanger: false,
        showTotal: (total) => `${total.toLocaleString('vi-VN')} công ty`,
      }}
      onChange={onChange}
      onRow={(company) => ({
        onDoubleClick: () => onOpen(company),
      })}
    />
  )
}
