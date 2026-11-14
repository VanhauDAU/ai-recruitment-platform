import { CheckOutlined, CloseOutlined, UndoOutlined } from '@ant-design/icons'
import { Button, Space, Tag, Tooltip } from 'antd'
import { Link } from 'react-router'
import {
  COMPANY_REPORT_STATUS_COLORS,
  COMPANY_REPORT_STATUS_LABELS,
} from '@/entities/company-report'
import { adminPath } from '@/shared/config/portals'

export function formatDateTime(value) {
  return value ? new Date(value).toLocaleString('vi-VN') : '—'
}

function sortOrder(ordering, field) {
  if (ordering === field) return 'ascend'
  if (ordering === `-${field}`) return 'descend'
  return null
}

/**
 * Cột của hàng chờ báo cáo công ty. `key` của mỗi cột dữ liệu là field ordering
 * gửi lên máy chủ; `origin` giúp trang chi tiết công ty quay lại đúng bộ lọc.
 */
export function companyReportColumns({
  ordering,
  origin,
  busy,
  canOpenCompany,
  canResolve,
  onDecide,
  onFilterCompany,
}) {
  const sortable = (key) => ({ key, sorter: true, sortOrder: sortOrder(ordering, key) })
  const decide = (report, action, label, icon, props) => (
    <Tooltip title={label}>
      <Button
        aria-label={label}
        disabled={busy}
        icon={icon}
        onClick={() => onDecide(report, action)}
        size="small"
        {...props}
      />
    </Tooltip>
  )

  return [
    {
      title: 'Công ty',
      dataIndex: 'company',
      ...sortable('company_name'),
      width: 260,
      render: (company, report) => (
        <div className="min-w-0">
          {canOpenCompany ? (
            <Link
              className="font-semibold !text-slate-900 hover:!text-[var(--brand-primary)]"
              state={{ origin }}
              to={`${adminPath(`/companies/${company.public_id}`)}?tab=public-page`}
            >
              {company.display_name}
            </Link>
          ) : <span className="font-semibold text-slate-900">{company.display_name}</span>}
          {company.content_policy_hold && <Tag className="!ml-2" color="red">Đang tạm ẩn</Tag>}
          <p className="mt-1 font-mono text-[11px] text-slate-400">{report.public_id}</p>
          {onFilterCompany && (
            <Button className="!h-auto !p-0 text-xs" onClick={() => onFilterCompany(company.public_id)} size="small" type="link">
              Chỉ xem báo cáo của công ty này
            </Button>
          )}
        </div>
      ),
    },
    {
      title: 'Lý do',
      dataIndex: 'reason_label',
      ...sortable('reason'),
      width: 240,
      // Phần liên quan không phải field sắp xếp của máy chủ nên đi kèm lý do
      // thay vì thành một cột dữ liệu không có sorter.
      render: (value, report) => (
        <>
          <span className="font-medium text-slate-800">{value}</span>
          {report.section_title && (
            <p className="mt-1 text-xs text-slate-500">{`Phần: ${report.section_title}`}</p>
          )}
        </>
      ),
    },
    {
      title: 'Mô tả',
      dataIndex: 'detail',
      ...sortable('detail'),
      width: 300,
      render: (value) => (
        <span className="line-clamp-3 whitespace-pre-wrap break-words text-sm text-slate-600">
          {value || 'Không có mô tả bổ sung'}
        </span>
      ),
    },
    {
      title: 'Người báo cáo',
      dataIndex: 'reporter_email',
      ...sortable('reporter_email'),
      width: 220,
      render: (value) => <span className="break-all text-sm">{value || 'Tài khoản đã xóa'}</span>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      ...sortable('status'),
      width: 170,
      render: (value) => (
        <Tag color={COMPANY_REPORT_STATUS_COLORS[value]}>
          {COMPANY_REPORT_STATUS_LABELS[value] || value}
        </Tag>
      ),
    },
    {
      title: 'Thời điểm báo cáo',
      dataIndex: 'created_at',
      ...sortable('created_at'),
      width: 180,
      render: formatDateTime,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      width: 96,
      render: (_, report) => {
        if (!canResolve) return <span className="text-xs text-slate-500">Chỉ xem</span>
        if (report.status === 'pending') {
          return (
            <Space className="whitespace-nowrap" size={4}>
              {decide(report, 'uphold', 'Xác nhận vi phạm', <CheckOutlined />, { danger: true, type: 'primary' })}
              {decide(report, 'dismiss', 'Bác bỏ báo cáo', <CloseOutlined />)}
            </Space>
          )
        }
        // Kết luận nào cũng gỡ được; báo cáo quay lại hàng chờ.
        return decide(report, 'reverse', 'Gỡ kết luận', <UndoOutlined />)
      },
    },
  ]
}
