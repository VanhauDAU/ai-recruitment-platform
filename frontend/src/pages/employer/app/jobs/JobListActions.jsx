import {
  ArrowRightOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  MoreOutlined,
  StopOutlined,
  SyncOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Button, Dropdown, Tooltip } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { employerAppPath } from '@/shared/config/portals'
import { employerJobApplicationsPath, isJobEditableUnderHold, isJobHeld, jobDisplayTitle } from './job-list-presentation'

const iconActionClass = 'inline-flex h-8 w-8 items-center justify-center rounded-lg !text-slate-500 transition hover:!bg-slate-100 hover:!text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500'

// The backend refuses edits, extensions and copies while a job is held.
function primaryAction(job) {
  if (isJobEditableUnderHold(job)) {
    return { label: 'Sửa theo yêu cầu', icon: <EditOutlined />, to: employerAppPath(`/jobs/${job.public_id}/edit`) }
  }
  if (isJobHeld(job)) return null
  if (job.status === 'draft') {
    return { label: 'Hoàn thiện', icon: <EditOutlined />, to: employerAppPath(`/jobs/${job.public_id}/edit`) }
  }
  if (job.is_expired) {
    return { label: 'Gia hạn', icon: <SyncOutlined />, to: employerAppPath(`/jobs/${job.public_id}`) }
  }
  return null
}

const canEdit = (job) => (!isJobHeld(job) || isJobEditableUnderHold(job))
  && !['draft', 'closed'].includes(job.status)

function menuItems(job, { candidateDataAccess, onDuplicate, closeMenu, queueConfirmation, onClose, onDelete }) {
  const jobTitle = jobDisplayTitle(job)
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
  if (canEdit(job)) {
    items.push({
      key: 'edit',
      icon: <EditOutlined />,
      label: <Link to={employerAppPath(`/jobs/${job.public_id}/edit`)}>Chỉnh sửa tin</Link>,
    })
  }
  if (!isJobHeld(job)) {
    items.push({
      key: 'duplicate',
      icon: <CopyOutlined />,
      label: 'Sao chép thành bản nháp',
      onClick: () => {
        closeMenu()
        onDuplicate(job.public_id)
      },
    })
  }
  if (job.status === 'active' && !job.is_expired) {
    items.push({ type: 'divider' }, {
      key: 'close',
      danger: true,
      icon: <StopOutlined />,
      label: 'Đóng tin',
      onClick: () => queueConfirmation({
        cancelText: 'Đóng',
        confirmText: 'Đóng tin',
        danger: true,
        description: (
          <>
            Bạn có chắc muốn đóng tin tuyển dụng <strong>{jobTitle}</strong> không?
            <br />
            Tin sẽ ngừng hiển thị với ứng viên.
          </>
        ),
        onConfirm: () => onClose(job.public_id),
        title: 'Đóng tin tuyển dụng',
      }),
    })
  }
  if (job.status === 'draft') {
    items.push({ type: 'divider' }, {
      key: 'delete',
      danger: true,
      icon: <DeleteOutlined />,
      label: 'Xóa bản nháp',
      onClick: () => queueConfirmation({
        cancelText: 'Đóng',
        confirmText: 'Xóa bản nháp',
        danger: true,
        description: (
          <>
            Bạn có chắc muốn xóa bản nháp <strong>{jobTitle}</strong> không?
            <br />
            Bản nháp sẽ bị xóa vĩnh viễn và không thể hoàn tác.
          </>
        ),
        onConfirm: () => onDelete(job.public_id),
        title: 'Xóa bản nháp',
      }),
    })
  }
  return items
}

export default function JobListActions({
  job,
  busy,
  onClose,
  onDelete,
  onDuplicate,
  requestConfirmation,
  candidateDataAccess = false,
}) {
  const action = primaryAction(job)
  const [menuOpen, setMenuOpen] = useState(false)
  const confirmationTimer = useRef(null)

  useEffect(() => () => window.clearTimeout(confirmationTimer.current), [])

  // Let the dropdown close before the modal opens so focus returns cleanly.
  const queueConfirmation = (options) => {
    setMenuOpen(false)
    window.clearTimeout(confirmationTimer.current)
    confirmationTimer.current = window.setTimeout(() => requestConfirmation(options))
  }

  return (
    <div data-testid="job-row-actions" className="ml-auto flex shrink-0 items-center justify-end gap-1">
      {action ? (
        <Link
          className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold !text-emerald-700 transition hover:border-emerald-300 hover:!bg-emerald-100"
          to={action.to}
        >
          {action.icon} {action.label}
        </Link>
      ) : (
        <div
          data-testid="job-hover-actions"
          className="pointer-events-none hidden items-center gap-0.5 opacity-0 transition-opacity duration-150 lg:flex lg:group-hover:pointer-events-auto lg:group-hover:opacity-100 lg:group-focus-within:pointer-events-auto lg:group-focus-within:opacity-100"
        >
          {candidateDataAccess && job.application_count > 0 && (
            <Tooltip title="Xem hồ sơ ứng tuyển">
              <Link aria-label="Xem hồ sơ ứng tuyển" className={iconActionClass} to={employerJobApplicationsPath(job)}>
                <TeamOutlined />
              </Link>
            </Tooltip>
          )}
          {canEdit(job) && (
            <Tooltip title="Chỉnh sửa tin">
              <Link aria-label="Chỉnh sửa tin" className={iconActionClass} to={employerAppPath(`/jobs/${job.public_id}/edit`)}>
                <EditOutlined />
              </Link>
            </Tooltip>
          )}
        </div>
      )}
      <Dropdown
        menu={{
          items: menuItems(job, {
            candidateDataAccess,
            closeMenu: () => setMenuOpen(false),
            onClose,
            onDelete,
            onDuplicate,
            queueConfirmation,
          }),
        }}
        open={menuOpen}
        onOpenChange={setMenuOpen}
        placement="bottomRight"
        trigger={['click']}
      >
        <Button
          type="text"
          aria-label={`Mở thao tác cho ${jobDisplayTitle(job)}`}
          className="!h-8 !w-8 !rounded-lg !p-0 !text-slate-500 hover:!bg-slate-100 hover:!text-slate-900"
          icon={<MoreOutlined />}
          loading={busy}
        />
      </Dropdown>
    </div>
  )
}
