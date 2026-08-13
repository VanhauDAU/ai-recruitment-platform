import {
  BarChartOutlined,
  BellOutlined,
  ReloadOutlined,
  RiseOutlined,
} from '@ant-design/icons'
import { Button, Empty, Table, Tag, Tooltip } from 'antd'
import { useState } from 'react'
import {
  formatServiceDate,
  SERVICE_STATUS_META,
  serviceDaysRemaining,
} from '../model/service-presentation'
import ServiceActivationCard from './ServiceActivationCard'

const CAPABILITY_ICONS = {
  job_alert: <BellOutlined />,
  job_refresh: <ReloadOutlined />,
  sponsored_placement: <RiseOutlined />,
}

function quantityLabel(activation) {
  const quantities = (activation.items || []).filter((item) => Number(item.quantity) > 1)
  if (!quantities.length) return 'Theo thời hạn'
  return quantities.map((item) => (
    `${item.name || item.capability}: ${Number(item.remaining_quantity || 0)}/${Number(item.quantity)}`
  )).join(' · ')
}

function statusMeta(activation) {
  if (activation.status === 'active' && activation.is_effective === false) {
    return { color: 'default', label: 'Đã hết hiệu lực' }
  }
  return SERVICE_STATUS_META[activation.status] || {
    color: 'default',
    label: activation.status,
  }
}

export default function JobServiceHistoryTable({
  activations,
  alertEnabled = false,
  metricsEnabled = false,
  refreshEnabled = false,
  onChanged,
}) {
  const [expandedRowKeys, setExpandedRowKeys] = useState([])
  const toggleDetails = (publicId) => {
    setExpandedRowKeys((current) => current.includes(publicId)
      ? current.filter((key) => key !== publicId)
      : [...current, publicId])
  }
  const columns = [
    {
      title: 'Loại / quyền lợi',
      key: 'capabilities',
      width: 210,
      render: (_, activation) => (
        <div className="flex flex-wrap gap-1.5">
          {(activation.items || []).map((item) => (
            <Tooltip key={item.capability} title={item.name || item.capability}>
              <Tag icon={CAPABILITY_ICONS[item.capability]}>
                {item.name || item.capability}
              </Tag>
            </Tooltip>
          ))}
        </div>
      ),
    },
    {
      title: 'Tên dịch vụ',
      dataIndex: 'package_name',
      key: 'package_name',
      width: 200,
      render: (value, activation) => (
        <div>
          <strong className="text-slate-800">{value}</strong>
          <p className="mt-1 font-mono text-xs text-slate-400">{activation.public_id}</p>
        </div>
      ),
    },
    {
      title: 'Số lượng',
      key: 'quantity',
      width: 180,
      render: (_, activation) => quantityLabel(activation),
    },
    {
      title: 'Bắt đầu',
      dataIndex: 'starts_at',
      key: 'starts_at',
      width: 130,
      render: formatServiceDate,
    },
    {
      title: 'Kết thúc',
      dataIndex: 'ends_at',
      key: 'ends_at',
      width: 130,
      render: formatServiceDate,
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 140,
      render: (_, activation) => {
        const meta = statusMeta(activation)
        const days = activation.status === 'active' && activation.is_effective !== false
          ? serviceDaysRemaining(activation.ends_at)
          : null
        return (
          <div className="space-y-1">
            <Tag color={meta.color}>{meta.label}</Tag>
            {days != null && <p className="text-xs text-slate-500">Còn {days} ngày</p>}
          </div>
        )
      },
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 130,
      render: (_, activation) => (
        <Button
          size="small"
          type="link"
          icon={<BarChartOutlined />}
          onClick={(event) => {
            event.stopPropagation()
            toggleDetails(activation.public_id)
          }}
        >
          {expandedRowKeys.includes(activation.public_id) ? 'Thu gọn' : 'Chi tiết'}
        </Button>
      ),
    },
  ]

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <Table
        columns={columns}
        dataSource={activations || []}
        expandable={{
          expandRowByClick: true,
          expandedRowKeys,
          expandedRowRender: (activation) => (
            <div className="bg-slate-50 p-3 sm:p-4">
              <ServiceActivationCard
                activation={activation}
                actionsEnabled
                alertEnabled={alertEnabled}
                metricsEnabled={metricsEnabled}
                refreshEnabled={refreshEnabled}
                onChanged={onChanged}
              />
            </div>
          ),
          onExpand: (expanded, activation) => {
            setExpandedRowKeys((current) => expanded
              ? [...new Set([...current, activation.public_id])]
              : current.filter((key) => key !== activation.public_id))
          },
        }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Bạn chưa sử dụng dịch vụ nào cho tin này"
            />
          ),
        }}
        pagination={false}
        rowKey="public_id"
        scroll={{ x: 1120 }}
        size="middle"
      />
    </div>
  )
}
