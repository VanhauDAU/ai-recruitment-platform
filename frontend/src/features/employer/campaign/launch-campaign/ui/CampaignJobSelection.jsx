import { FileAddOutlined, InboxOutlined, WarningFilled } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Checkbox } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import { campaignKeys, saveCampaignLaunchSelection } from '@/entities/campaign/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { employerAppPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import './launch-campaign.css'
import { getIntlLocale, m } from '@/shared/config/i18n'

const formatDate = (value) => (value ? new Date(value).toLocaleDateString(getIntlLocale()) : m.employer_campaign_select_no_deadline())
const pick = (jobs, action) => new Set(jobs.filter((job) => job.action === action).map((job) => job.public_id))

function JobRow({ job, checked, onToggle, badge, targetDate }) {
  const lateDeadline = targetDate && job.deadline && job.deadline > targetDate
  const content = (
    <>
      <span className="cl-job__main">
        <span className="cl-job__title">{job.title || m.employer_campaign_select_untitled()}</span>
        <span className="cl-job__meta">
          <span className={`cl-chip cl-chip--${badge.tone}`}>{badge.label}</span>
          {job.number_of_vacancies ? <span>{m.employer_campaign_select_vacancies({ count: job.number_of_vacancies })}</span> : null}
          <span>{m.employer_campaign_select_deadline({ date: formatDate(job.deadline) })}</span>
        </span>
        {lateDeadline && (
          <span className="cl-job__warn">
            <WarningFilled aria-hidden /> {m.employer_campaign_select_late_deadline()}
          </span>
        )}
      </span>
      <Link
        to={employerAppPath(`/jobs/${job.public_id}/edit`)}
        className="cl-job__edit"
        onClick={(event) => event.stopPropagation()}
      >
        {m.employer_campaign_launch_edit_job()}
      </Link>
    </>
  )
  if (!onToggle) return <li className="cl-job is-static">{content}</li>
  return (
    <li className={`cl-job${checked ? ' is-checked' : ''}`}>
      <Checkbox
        className="cl-job__hit"
        checked={checked}
        onChange={(event) => onToggle(job.public_id, event.target.checked)}
      >
        {content}
      </Checkbox>
    </li>
  )
}

function JobGroup({ title, hint, jobs, ...rowProps }) {
  if (!jobs.length) return null
  return (
    <section className="cl-group">
      <h3 className="cl-group__title">{title}</h3>
      <p className="cl-group__hint">{hint}</p>
      <ul className="cl-list">
        {jobs.map((job) => (
          <JobRow
            key={job.public_id}
            job={job}
            checked={rowProps.selected?.has(job.public_id)}
            onToggle={rowProps.onToggle}
            badge={rowProps.badge}
            targetDate={rowProps.targetDate}
          />
        ))}
      </ul>
    </section>
  )
}

export default function CampaignJobSelection({ campaign, overview, onSaved }) {
  const queryClient = useQueryClient()
  const [publish, setPublish] = useState(() => pick(overview.draft_jobs, 'publish'))
  const [attach, setAttach] = useState(() => pick(overview.attachable_jobs, 'attach'))
  const toggle = (setter) => (publicId, checked) => setter((current) => {
    const next = new Set(current)
    if (checked) next.add(publicId)
    else next.delete(publicId)
    return next
  })
  const mutation = useMutation({
    mutationFn: () => saveCampaignLaunchSelection(campaign.public_id, {
      publishJobIds: [...publish],
      attachJobIds: [...attach],
    }),
    onSuccess: (data) => {
      queryClient.setQueryData(campaignKeys.launch(campaign.public_id), data)
      message.success(m.employer_campaign_select_saved())
      onSaved?.(data)
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_campaign_select_save_error())),
  })
  const targetDate = campaign.is_continuous ? null : campaign.target_date
  const chosen = [
    ...overview.draft_jobs.filter((job) => publish.has(job.public_id)),
    ...overview.attachable_jobs.filter((job) => attach.has(job.public_id)),
    ...overview.campaign_jobs,
  ]
  const total = chosen.length
  const headcount = chosen.reduce((sum, job) => sum + (job.number_of_vacancies || 0), 0)
  const hasAnyJob = overview.draft_jobs.length + overview.attachable_jobs.length + overview.campaign_jobs.length > 0

  return (
    <div className="cl-step">
      <Link to={`${employerAppPath('/jobs/new')}?campaign=${campaign.public_id}&return=setup`} className="cl-create">
        <span className="cl-create__icon"><FileAddOutlined aria-hidden /></span>
        <span>
          <span className="cl-create__title">{m.employer_campaign_select_create_title()}</span>
          <span className="cl-create__text">
            {m.employer_campaign_select_create_prefix()}
            <strong>{m.employer_campaign_select_save_draft()}</strong>
            {m.employer_campaign_select_create_suffix()}
          </span>
        </span>
      </Link>

      {!hasAnyJob ? (
        <div className="cl-empty">
          <InboxOutlined aria-hidden className="cl-empty__icon" />
          <p>{m.employer_campaign_select_empty()}</p>
        </div>
      ) : (
        <>
          <JobGroup
            title={m.employer_campaign_select_drafts_title()}
            hint={m.employer_campaign_select_drafts_hint()}
            jobs={overview.draft_jobs}
            selected={publish}
            onToggle={toggle(setPublish)}
            badge={{ label: m.employer_campaign_jobs_status_draft(), tone: 'draft' }}
            targetDate={targetDate}
          />
          <JobGroup
            title={m.employer_campaign_select_live_title()}
            hint={m.employer_campaign_select_live_hint()}
            jobs={overview.attachable_jobs}
            selected={attach}
            onToggle={toggle(setAttach)}
            badge={{ label: m.employer_campaign_select_live_badge(), tone: 'live' }}
            targetDate={targetDate}
          />
          <JobGroup
            title={m.employer_campaign_select_attached_title()}
            hint={m.employer_campaign_select_attached_hint()}
            jobs={overview.campaign_jobs}
            badge={{ label: m.employer_campaign_jobs_status_active(), tone: 'live' }}
          />
        </>
      )}

      <div className="cl-bar">
        <span className={`cl-bar__status${total ? '' : ' is-empty'}`}>
          {total
            ? `${m.employer_campaign_select_total({ count: total })}${headcount ? m.employer_campaign_select_total_headcount({ count: headcount }) : ''}`
            : m.employer_campaign_select_none()}
        </span>
        <Button type="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>
          {m.employer_campaign_save_and_continue()}
        </Button>
      </div>
    </div>
  )
}
