import {
  BellOutlined,
  CopyOutlined,
  EditOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  RocketOutlined,
  StopOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Skeleton,
  Space,
  Tabs,
  Tag,
} from 'antd'
import {
  ANNOUNCEMENT_LIFECYCLE_STATES,
  latestAnnouncementRevision,
} from '@/entities/announcement'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import {
  KIND_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  SURFACE_LABELS,
} from '../model/announcement-options'
import AnnouncementPreview from './AnnouncementPreview'
import { AuditHistory, RevisionHistory } from './AnnouncementHistory'
import AnnouncementMetrics from './AnnouncementMetrics'

function formatDate(value) {
  if (!value) return 'Không giới hạn'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value))
}

function DetailOverview({ detail }) {
  const revision = latestAnnouncementRevision(detail)
  return (
    <div className="space-y-6">
      <Descriptions column={1} bordered size="small">
        <Descriptions.Item label="Trạng thái">
          <Tag color={STATUS_COLORS[detail.presentation_status]}>
            {STATUS_LABELS[detail.presentation_status] || detail.presentation_status}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Revision token">{detail.revision_token}</Descriptions.Item>
        {/* Người đã đóng thông báo chỉ thấy lại khi số này tăng. */}
        <Descriptions.Item label="Phiên bản hiển thị lại">
          {detail.dismissal_version}
        </Descriptions.Item>
        <Descriptions.Item label="Loại">
          {KIND_LABELS[revision.kind] || revision.kind}
        </Descriptions.Item>
        <Descriptions.Item label="Priority">{revision.priority}</Descriptions.Item>
        <Descriptions.Item label="Bắt đầu">{formatDate(revision.starts_at)}</Descriptions.Item>
        <Descriptions.Item label="Kết thúc">{formatDate(revision.ends_at)}</Descriptions.Item>
        <Descriptions.Item label="Surface">
          <Space size={[4, 4]} wrap>
            {revision.surfaces.map((surface) => (
              <Tag key={surface}>{SURFACE_LABELS[surface] || surface}</Tag>
            ))}
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label="Route include">
          {revision.include_path_prefixes.join(', ') || 'Tất cả route'}
        </Descriptions.Item>
        <Descriptions.Item label="Route exclude">
          {revision.exclude_path_prefixes.join(', ') || 'Không có'}
        </Descriptions.Item>
      </Descriptions>
      <AnnouncementPreview values={revision} />
    </div>
  )
}

export default function AnnouncementDetailDrawer({
  canManage,
  canPublish,
  conflict,
  detail,
  error,
  loading,
  onAction,
  onClose,
  onDuplicate,
  onEdit,
  onReload,
  onRename,
  open,
  pendingType,
}) {
  const revision = detail ? latestAnnouncementRevision(detail) : null
  const isArchived = detail?.lifecycle_state === ANNOUNCEMENT_LIFECYCLE_STATES.ARCHIVED
  const isDraft = detail?.lifecycle_state === ANNOUNCEMENT_LIFECYCLE_STATES.DRAFT
  const isPublished = detail?.lifecycle_state === ANNOUNCEMENT_LIFECYCLE_STATES.PUBLISHED
  const isPaused = detail?.lifecycle_state === ANNOUNCEMENT_LIFECYCLE_STATES.PAUSED
  const publishRevision = detail?.draft_revision_number || revision?.number

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size={880}
      styles={{ wrapper: { maxWidth: '100vw' } }}
      title={detail?.internal_name || 'Chi tiết thông báo'}
      destroyOnHidden
      extra={detail && (
        <Space wrap>
          {canManage && !isArchived && (
            <>
              <Button icon={<EditOutlined />} onClick={onRename}>Đổi tên</Button>
              <Button type="primary" icon={<EditOutlined />} onClick={onEdit}>
                Tạo revision
              </Button>
            </>
          )}
        </Space>
      )}
    >
      {conflict && (
        <Alert
          className="mb-4"
          type="warning"
          showIcon
          title="Dữ liệu đã thay đổi ở phiên khác"
          description={conflict.detail}
          action={<Button onClick={onReload}>Tải bản mới nhất</Button>}
        />
      )}
      {loading && <Skeleton active paragraph={{ rows: 10 }} />}
      {error && (
        <Alert
          type="error"
          showIcon
          title="Không thể tải chi tiết thông báo"
          description={getApiErrorMessage(error)}
          action={<Button onClick={onReload}>Thử lại</Button>}
        />
      )}
      {!loading && !error && !detail && <Empty description="Không tìm thấy thông báo" />}
      {detail && (
        <>
          <div className="announcement-detail__actions">
            <Space wrap>
              {canPublish && !isArchived && publishRevision && (isDraft || detail.draft_revision_number) && (
                <Button
                  type="primary"
                  icon={<RocketOutlined />}
                  loading={pendingType === 'publish'}
                  onClick={() => onAction('publish', { revision: publishRevision })}
                >
                  {detail.draft_revision_number ? 'Phát hành revision mới' : 'Phát hành'}
                </Button>
              )}
              {canPublish && isPublished && (
                <Button
                  icon={<PauseCircleOutlined />}
                  loading={pendingType === 'pause'}
                  onClick={() => onAction('pause')}
                >
                  Tạm dừng
                </Button>
              )}
              {canPublish && isPaused && (
                <Button
                  icon={<PlayCircleOutlined />}
                  loading={pendingType === 'resume'}
                  onClick={() => onAction('resume')}
                >
                  Tiếp tục
                </Button>
              )}
              {canPublish && isPublished && (
                <Button
                  icon={<BellOutlined />}
                  loading={pendingType === 'reset-dismissals'}
                  onClick={() => onAction('reset-dismissals')}
                >
                  Hiện lại cho người đã đóng
                </Button>
              )}
              {canPublish && !isArchived && (
                <Button
                  danger
                  icon={<StopOutlined />}
                  loading={pendingType === 'archive'}
                  onClick={() => onAction('archive')}
                >
                  Lưu trữ
                </Button>
              )}
              {canManage && (
                <Button icon={<CopyOutlined />} onClick={onDuplicate}>
                  Nhân bản
                </Button>
              )}
            </Space>
          </div>
          <Tabs
            items={[
              {
                key: 'overview',
                label: 'Tổng quan & preview',
                children: <DetailOverview detail={detail} />,
              },
              {
                key: 'metrics',
                label: 'Hiệu quả',
                children: <AnnouncementMetrics publicId={detail.public_id} />,
              },
              {
                key: 'revisions',
                label: `Revision (${detail.revisions.length})`,
                children: <RevisionHistory revisions={detail.revisions} />,
              },
              {
                key: 'audit',
                label: `Audit (${detail.audit_events.length})`,
                children: <AuditHistory events={detail.audit_events} />,
              },
            ]}
          />
        </>
      )}
    </Drawer>
  )
}
