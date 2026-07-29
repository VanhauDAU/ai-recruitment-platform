import {
  ArrowRightOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { Button, Empty, Space, Table, Tag, Tooltip } from 'antd'
import {
  KIND_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  SURFACE_LABELS,
} from '../model/announcement-options'

function formatDate(value, fallback = 'Không giới hạn') {
  if (!value) return fallback
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value))
}

function sorterOrder(ordering, field) {
  if (ordering === field) return 'ascend'
  if (ordering === `-${field}`) return 'descend'
  return null
}

function AnnouncementIdentity({ item }) {
  return (
    <div className="announcement-table__identity">
      <strong>{item.internal_name}</strong>
      <span>{item.public_id}</span>
      <Space size={[3, 3]} wrap>
        {item.surfaces.map((surface) => (
          <Tag key={surface}>{SURFACE_LABELS[surface] || surface}</Tag>
        ))}
      </Space>
    </div>
  )
}

function RevisionStatus({ item }) {
  return (
    <div className="announcement-table__status">
      <Tag color={STATUS_COLORS[item.presentation_status]}>
        {STATUS_LABELS[item.presentation_status] || item.presentation_status}
      </Tag>
      <span>
        {item.active_revision_number
          ? `Đang phát hành r${item.active_revision_number}`
          : 'Chưa phát hành'}
      </span>
      {item.draft_revision_number && (
        <Tag color="purple">Có draft r{item.draft_revision_number}</Tag>
      )}
    </div>
  )
}

function Schedule({ item }) {
  return (
    <div className="announcement-table__schedule">
      <span><ClockCircleOutlined /> {formatDate(item.starts_at, 'Hiệu lực ngay')}</span>
      <span>→ {formatDate(item.ends_at)}</span>
    </div>
  )
}

export default function AnnouncementTable({
  data,
  loading,
  ordering,
  page,
  onChange,
  onOpen,
}) {
  const columns = [
    {
      title: 'Thông báo & surface',
      key: 'internal_name',
      width: 320,
      sorter: true,
      sortOrder: sorterOrder(ordering, 'internal_name'),
      render: (_, item) => <AnnouncementIdentity item={item} />,
    },
    {
      title: 'Trạng thái',
      key: 'lifecycle_state',
      width: 190,
      sorter: true,
      sortOrder: sorterOrder(ordering, 'lifecycle_state'),
      render: (_, item) => <RevisionStatus item={item} />,
    },
    {
      title: 'Loại',
      key: 'kind',
      width: 170,
      sorter: true,
      sortOrder: sorterOrder(ordering, 'kind'),
      render: (_, item) => item.kind
        ? <Tag color="geekblue">{KIND_LABELS[item.kind] || item.kind}</Tag>
        : <span className="text-slate-400">Chưa phát hành</span>,
    },
    {
      title: 'Lịch hiển thị',
      key: 'starts_at',
      width: 220,
      sorter: true,
      sortOrder: sorterOrder(ordering, 'starts_at'),
      render: (_, item) => <Schedule item={item} />,
    },
    {
      title: 'Ưu tiên',
      key: 'priority',
      width: 110,
      align: 'center',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'priority'),
      render: (__, item) => item.priority ?? '—',
    },
    {
      title: 'Cập nhật',
      key: 'updated_at',
      width: 185,
      sorter: true,
      sortOrder: sorterOrder(ordering, 'updated_at'),
      render: (_, item) => (
        <Tooltip title={`Tạo lúc ${formatDate(item.created_at)}`}>
          <span>{formatDate(item.updated_at, 'Chưa cập nhật')}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 140,
      fixed: 'right',
      render: (_, item) => (
        <Button
          type="primary"
          ghost
          icon={<ArrowRightOutlined />}
          iconPlacement="end"
          onClick={() => onOpen(item.public_id)}
        >
          Chi tiết
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
      className="announcement-table"
      scroll={{ x: 1340 }}
      locale={{
        emptyText: (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Không tìm thấy thông báo phù hợp"
          />
        ),
      }}
      pagination={{
        current: page,
        pageSize: 20,
        total: data.count,
        showSizeChanger: false,
        showTotal: (total) => `${total.toLocaleString('vi-VN')} thông báo`,
      }}
      onChange={onChange}
      onRow={(item) => ({ onDoubleClick: () => onOpen(item.public_id) })}
    />
  )
}
