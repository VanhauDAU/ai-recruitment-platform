import {
  CopyOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  ExportOutlined,
  EyeOutlined,
  StopOutlined,
  SyncOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Button, Dropdown } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { employerAppPath } from '@/shared/config/portals'
import { publicJobUrl } from './job-detail-presentation'
import { employerJobApplicationsPath, isJobEditableUnderHold, isJobHeld, jobDisplayTitle } from './job-list-presentation'
import { m } from '@/shared/config/i18n'

// Buttons in the action cell, "Khác" included; the rest goes into that menu.
const MAX_BUTTONS = 3

// The backend refuses edits, extensions and copies while a job is held.
function primaryAction(job) {
  const editPath = employerAppPath(`/jobs/${job.public_id}/edit`)
  if (isJobEditableUnderHold(job)) return { key: 'resume', label: m.employer_job_list_edit_as_requested(), icon: <EditOutlined />, to: editPath }
  if (isJobHeld(job)) return null
  if (job.status === 'draft') return { key: 'complete', label: m.employer_job_list_complete(), icon: <EditOutlined />, to: editPath }
  if (job.is_expired) return { key: 'extend', label: m.employer_job_list_extend(), icon: <SyncOutlined />, to: employerAppPath(`/jobs/${job.public_id}`) }
  return null
}

const canEdit = (job) => (!isJobHeld(job) || isJobEditableUnderHold(job))
  && !['draft', 'closed'].includes(job.status)

// Navigation actions in priority order: the most useful next step first.
function linkActions(job, candidateDataAccess) {
  const publicUrl = publicJobUrl(job)
  const primary = primaryAction(job)
  // The candidate count in the row already opens the applications.
  return [
    primary && { ...primary, primary: true },
    { key: 'detail', label: m.employer_job_list_view_detail(), icon: <EyeOutlined />, to: employerAppPath(`/jobs/${job.public_id}`) },
    publicUrl && { key: 'public', label: m.employer_job_list_view_public(), icon: <ExportOutlined />, href: publicUrl },
    candidateDataAccess && job.application_count > 0 && {
      key: 'applications', label: m.employer_job_list_view_applications(), icon: <TeamOutlined />, to: employerJobApplicationsPath(job),
    },
    canEdit(job) && { key: 'edit', label: m.employer_job_list_edit(), icon: <EditOutlined />, to: employerAppPath(`/jobs/${job.public_id}/edit`) },
  ].filter(Boolean)
}

function ActionLink({ action, className }) {
  const content = <>{action.icon}<span>{action.label}</span></>
  return action.href
    ? <a aria-label={action.label} className={className} href={action.href} target="_blank" rel="noreferrer">{content}</a>
    : <Link aria-label={action.label} className={className} to={action.to}>{content}</Link>
}

function commandItems(job, { onDuplicate, closeMenu, queueConfirmation, onClose, onDelete }) {
  const jobTitle = jobDisplayTitle(job)
  const items = []
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
    items.push({
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
    items.push({
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
  const [menuOpen, setMenuOpen] = useState(false)
  const confirmationTimer = useRef(null)

  useEffect(() => () => window.clearTimeout(confirmationTimer.current), [])

  // Let the dropdown close before the modal opens so focus returns cleanly.
  const queueConfirmation = (options) => {
    setMenuOpen(false)
    window.clearTimeout(confirmationTimer.current)
    confirmationTimer.current = window.setTimeout(() => requestConfirmation(options))
  }

  const links = linkActions(job, candidateDataAccess)
  const commands = commandItems(job, { closeMenu: () => setMenuOpen(false), onClose, onDelete, onDuplicate, queueConfirmation })
  const needsMenu = commands.length > 0 || links.length > MAX_BUTTONS
  const shown = links.slice(0, needsMenu ? MAX_BUTTONS - 1 : MAX_BUTTONS)
  const overflow = links.slice(shown.length).map((action) => ({
    key: action.key,
    icon: action.icon,
    label: <ActionLink action={{ ...action, icon: null }} />,
  }))
  const menuItems = [...overflow, ...(overflow.length && commands.length ? [{ type: 'divider' }] : []), ...commands]

  return (
    <div data-testid="job-row-actions" className="wt-actions">
      <div data-testid="job-quick-actions" className="wt-actions">
        {shown.map((action) => (
          <ActionLink key={action.key} action={action} className={`wt-btn${action.primary ? ' wt-btn--primary' : ''}`} />
        ))}
      </div>
      {menuItems.length > 0 && (
        <Dropdown
          menu={{ items: menuItems }}
          open={menuOpen}
          onOpenChange={setMenuOpen}
          placement="bottomRight"
          trigger={['click']}
        >
          <Button
            type="text"
            aria-label={m.employer_job_list_more_actions({ title: jobDisplayTitle(job) })}
            className="wt-btn"
            loading={busy}
          >
            {m.employer_job_list_more()} <DownOutlined aria-hidden />
          </Button>
        </Dropdown>
      )}
    </div>
  )
}
