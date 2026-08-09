import {
  ArrowRightOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  MoreOutlined,
  StopOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Button, Dropdown, Modal, Tooltip } from 'antd'
import { Link } from 'react-router'
import { employerAppPath } from '@/shared/config/portals'
import { employerJobApplicationsPath } from './job-list-presentation'

const iconActionClass = 'inline-flex h-8 w-8 items-center justify-center rounded-lg !text-slate-500 transition hover:!bg-slate-100 hover:!text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500'

function primaryAction(job) {
  if (job.status === 'draft') {
    return { label: 'Hoàn thiện', to: employerAppPath(`/jobs/${job.public_id}/edit`) }
  }
  if (job.status === 'rejected') {
    return { label: 'Chỉnh sửa', to: employerAppPath(`/jobs/${job.public_id}/edit`) }
  }
  if (job.is_expired) {
    return { label: 'Gia hạn', to: employerAppPath(`/jobs/${job.public_id}`) }
  }
  return null
}

function confirmClose(job, onClose) {
  Modal.confirm({
    title: 'Đóng tin tuyển dụng?',
    content: 'Tin sẽ ngừng hiển thị với ứng viên.',
    okText: 'Đóng tin',
    cancelText: 'Hủy',
    okButtonProps: { danger: true },
    onOk: () => onClose(job.public_id),
  })
}

function confirmDelete(job, onDelete) {
  Modal.confirm({
    title: 'Xóa bản nháp này?',
    content: 'Thao tác này không thể hoàn tác.',
    okText: 'Xóa bản nháp',
    cancelText: 'Hủy',
    okButtonProps: { danger: true },
    onOk: () => onDelete(job.public_id),
  })
}

function menuItems(job, {
  candidateDataAccess,
  onClose,
  onDelete,
  onDuplicate,
}) {
  const items = [
    {
      key: 'detail',
      icon: <ArrowRightOutlined />,
      label: <Link to={employerAppPath(`/jobs/${job.public_id}`)}>Xem chi tiết</Link>,
    },
  ]
  if (candidateDataAccess && job.application_count > 0) {
    items.push({
      key: 'applications',
      icon: <TeamOutlined />,
      label: <Link to={employerJobApplicationsPath(job)}>Xem hồ sơ ứng tuyển</Link>,
    })
  }
  if (!['draft', 'rejected', 'closed'].includes(job.status)) {
    items.push({
      key: 'edit',
      icon: <EditOutlined />,
      label: <Link to={employerAppPath(`/jobs/${job.public_id}/edit`)}>Chỉnh sửa tin</Link>,
    })
  }
  items.push({
    key: 'duplicate',
    icon: <CopyOutlined />,
    label: 'Sao chép thành bản nháp',
    onClick: () => onDuplicate(job.public_id),
  })
  if (job.status === 'active' && !job.is_expired) {
    items.push(
      { type: 'divider' },
      {
        key: 'close',
        danger: true,
        icon: <StopOutlined />,
        label: 'Đóng tin',
        onClick: () => confirmClose(job, onClose),
      },
    )
  }
  if (job.status === 'draft') {
    items.push(
      { type: 'divider' },
      {
        key: 'delete',
        danger: true,
        icon: <DeleteOutlined />,
        label: 'Xóa bản nháp',
        onClick: () => confirmDelete(job, onDelete),
      },
    )
  }
  return items
}

function QuickActions({ job, candidateDataAccess }) {
  return (
    <div
      data-testid="job-hover-actions"
      className="pointer-events-none hidden items-center gap-0.5 opacity-0 transition-opacity duration-150 lg:flex lg:group-hover:pointer-events-auto lg:group-hover:opacity-100 lg:group-focus-within:pointer-events-auto lg:group-focus-within:opacity-100"
    >
      {candidateDataAccess && job.application_count > 0 && (
        <Tooltip title="Xem hồ sơ ứng tuyển">
          <Link
            aria-label="Xem hồ sơ ứng tuyển"
            className={iconActionClass}
            to={employerJobApplicationsPath(job)}
          >
            <TeamOutlined />
          </Link>
        </Tooltip>
      )}
      {!['draft', 'rejected', 'closed'].includes(job.status) && (
        <Tooltip title="Chỉnh sửa tin">
          <Link
            aria-label="Chỉnh sửa tin"
            className={iconActionClass}
            to={employerAppPath(`/jobs/${job.public_id}/edit`)}
          >
            <EditOutlined />
          </Link>
        </Tooltip>
      )}
    </div>
  )
}

export default function JobListActions({
  job,
  closing,
  deleting,
  duplicating,
  onClose,
  onDelete,
  onDuplicate,
  candidateDataAccess = false,
}) {
  const action = primaryAction(job)
  return (
    <div data-testid="job-mobile-actions" className="relative ml-auto flex items-center justify-end gap-1">
      {!action && <QuickActions job={job} candidateDataAccess={candidateDataAccess} />}
      {action && (
        <Link
          className="inline-flex h-8 items-center rounded-lg px-2 text-xs font-semibold !text-emerald-700 transition hover:bg-emerald-50"
          to={action.to}
        >
          {action.label}
        </Link>
      )}
      <Dropdown
        menu={{
          items: menuItems(job, {
            candidateDataAccess,
            onClose,
            onDelete,
            onDuplicate,
          }),
        }}
        placement="bottomRight"
        trigger={['click']}
      >
        <Button
          type="text"
          aria-label={`Mở thao tác cho ${job.title}`}
          className="!h-8 !w-8 !rounded-lg !p-0 !text-slate-500 hover:!bg-slate-100 hover:!text-slate-900"
          icon={<MoreOutlined />}
          loading={closing || deleting || duplicating}
        />
      </Dropdown>
    </div>
  )
}
