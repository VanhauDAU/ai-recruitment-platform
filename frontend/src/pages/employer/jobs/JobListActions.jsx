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
import { m } from '@/shared/config/i18n'

const iconActionClass = 'inline-flex h-8 w-8 items-center justify-center rounded-lg !text-slate-500 transition hover:!bg-slate-100 hover:!text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500'

// The backend refuses edits, extensions and copies while a job is held.
function primaryAction(job) {
  if (isJobEditableUnderHold(job)) {
    return { label: m.employer_job_list_edit_as_requested(), icon: <EditOutlined />, to: employerAppPath(`/jobs/${job.public_id}/edit`) }
  }
  if (isJobHeld(job)) return null
  if (job.status === 'draft') {
    return { label: m.employer_job_list_complete(), icon: <EditOutlined />, to: employerAppPath(`/jobs/${job.public_id}/edit`) }
  }
  if (job.is_expired) {
    return { label: m.employer_job_list_extend(), icon: <SyncOutlined />, to: employerAppPath(`/jobs/${job.public_id}`) }
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
      label: <Link to={employerAppPath(`/jobs/${job.public_id}`)}>{m.employer_job_list_view_detail()}</Link>,
    },
  ]
  if (candidateDataAccess && job.application_count > 0) {
    items.push({
      key: 'applications',
      icon: <TeamOutlined />,
      label: <Link to={employerJobApplicationsPath(job)}>{m.employer_job_list_view_applications()}</Link>,
    })
  }
  if (canEdit(job)) {
    items.push({
      key: 'edit',
      icon: <EditOutlined />,
      label: <Link to={employerAppPath(`/jobs/${job.public_id}/edit`)}>{m.employer_job_list_edit()}</Link>,
    })
  }
  if (!isJobHeld(job)) {
    items.push({
      key: 'duplicate',
      icon: <CopyOutlined />,
      label: m.employer_job_list_duplicate(),
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
      label: m.employer_job_detail_stop_hiring(),
      onClick: () => queueConfirmation({
        cancelText: m.employer_job_detail_close(),
        confirmText: m.employer_job_detail_stop_hiring(),
        danger: true,
        description: (
          <>
            {m.employer_job_detail_stop_hiring_before()}<strong>{jobTitle}</strong>{m.employer_job_detail_stop_hiring_after()}
            <br />
            {m.employer_job_detail_stop_hiring_note()}
          </>
        ),
        onConfirm: () => onClose(job.public_id),
        title: m.employer_job_detail_stop_hiring(),
      }),
    })
  }
  if (job.status === 'draft') {
    items.push({ type: 'divider' }, {
      key: 'delete',
      danger: true,
      icon: <DeleteOutlined />,
      label: m.employer_job_list_delete_draft(),
      onClick: () => queueConfirmation({
        cancelText: m.employer_job_detail_close(),
        confirmText: m.employer_job_list_delete_draft(),
        danger: true,
        description: (
          <>
            {m.employer_job_list_delete_draft_before()}<strong>{jobTitle}</strong>{m.employer_job_list_delete_draft_after()}
            <br />
            {m.employer_job_list_delete_draft_note()}
          </>
        ),
        onConfirm: () => onDelete(job.public_id),
        title: m.employer_job_list_delete_draft(),
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
    <div data-testid="job-row-actions" className="ejl-row__actions">
      {action ? (
        <Link aria-label={action.label} className="ejl-primary-action" to={action.to}>
          {action.icon}<span>{action.label}</span>
        </Link>
      ) : (
        <div data-testid="job-quick-actions" className="ejl-quick-actions">
          {candidateDataAccess && job.application_count > 0 && (
            <Tooltip title={m.employer_job_list_view_applications()}>
              <Link aria-label={m.employer_job_list_view_applications()} className={iconActionClass} to={employerJobApplicationsPath(job)}>
                <TeamOutlined />
              </Link>
            </Tooltip>
          )}
          {canEdit(job) && (
            <Tooltip title={m.employer_job_list_edit()}>
              <Link aria-label={m.employer_job_list_edit()} className={iconActionClass} to={employerAppPath(`/jobs/${job.public_id}/edit`)}>
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
          aria-label={m.employer_job_list_more_actions({ title: jobDisplayTitle(job) })}
          className="!h-8 !w-8 !rounded-lg !p-0 !text-slate-500 hover:!bg-slate-100 hover:!text-slate-900"
          icon={<MoreOutlined />}
          loading={busy}
        />
      </Dropdown>
    </div>
  )
}
