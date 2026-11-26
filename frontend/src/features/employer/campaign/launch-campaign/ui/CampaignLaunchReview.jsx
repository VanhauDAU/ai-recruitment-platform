import { CalendarOutlined, CheckOutlined, ExclamationOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Checkbox } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import { campaignKeys, launchCampaign } from '@/entities/campaign/campaign'
import { getJobPostingContext, jobKeys } from '@/entities/job/job'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { EMPLOYER_VERIFY_URL, employerAppPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import { CHECK_STEP, jobSelection, SETUP_STEPS } from '../lib/setup-steps'
import './launch-campaign.css'
import { getIntlLocale, m } from '@/shared/config/i18n'

const formatDate = (value) => (value ? new Date(value).toLocaleDateString(getIntlLocale()) : '')
const STEP_TITLES = Object.fromEntries(SETUP_STEPS.map((step) => [step.key, step.title]))

function FixAction({ item, onGoToStep }) {
  const step = CHECK_STEP[item.code]
  if (step) {
    return <Button size="small" onClick={() => onGoToStep?.(step)}>{m.employer_campaign_launch_fix_in_step({ step: STEP_TITLES[step] })}</Button>
  }
  if (item.code === 'publication') {
    return <Link to={EMPLOYER_VERIFY_URL} className="cl-fix-link">{m.employer_campaign_launch_account_requirements()}</Link>
  }
  return null
}

function ModeOption({ value, current, disabled, icon, title, text, onSelect }) {
  const selected = value === current
  return (
    <label className={`cl-mode${selected ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`}>
      <input
        type="radio"
        name="launch-mode"
        value={value}
        checked={selected}
        disabled={disabled}
        onChange={() => onSelect(value)}
        className="cl-mode__input"
      />
      <span className="cl-mode__icon" aria-hidden>{icon}</span>
      <span className="cl-mode__title">{title}</span>
      <span className="cl-mode__text">{text}</span>
    </label>
  )
}

export default function CampaignLaunchReview({ campaign, overview, onLaunched, onGoToStep }) {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState(campaign.status === 'scheduled' && overview.can_schedule ? 'scheduled' : 'now')
  const [accepted, setAccepted] = useState(false)
  const contextQuery = useQuery({ queryKey: jobKeys.postingContext, queryFn: getJobPostingContext })
  const check = overview.check || { ready: false, items: [], job_problems: [] }
  const failing = check.items.filter((item) => !item.ok)
  const passing = check.items.filter((item) => item.ok)
  const selection = jobSelection(overview)
  const mutation = useMutation({
    mutationFn: () => launchCampaign(campaign.public_id, {
      mode,
      acceptedStatementVersion: overview.statement_version,
    }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.all })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      message.success(result.status === 'scheduled'
        ? m.employer_campaign_launch_scheduled_success({ date: formatDate(campaign.start_date) })
        : m.employer_campaign_launch_success())
      onLaunched?.(result)
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_campaign_launch_error()), { duration: 6 }),
  })
  const failedJobs = mutation.error?.response?.data?.jobs || []
  const blockedReason = !check.ready
    ? m.employer_campaign_launch_blocked_todo({ count: failing.length })
    : !accepted ? m.employer_campaign_launch_blocked_commit() : ''
  const effects = [
    selection.toPublish && m.employer_campaign_launch_effect_publish({ count: selection.toPublish }),
    selection.toAttach && m.employer_campaign_launch_effect_attach({ count: selection.toAttach }),
  ].filter(Boolean)

  return (
    <div className="cl-step">
      {overview.last_error?.error && (
        <div className="cl-callout cl-callout--error" role="alert">
          <strong>{m.employer_campaign_launch_last_error()}</strong>
          <span>{getApiErrorMessage({ response: { data: overview.last_error.error } }, m.employer_campaign_launch_check_below())}</span>
        </div>
      )}

      {failing.length > 0 ? (
        <section className="cl-todo" aria-labelledby="cl-todo-title">
          <h3 id="cl-todo-title" className="cl-todo__title">{m.employer_campaign_launch_todo_title({ count: failing.length })}</h3>
          <ul className="cl-todo__list">
            {failing.map((item) => (
              <li key={item.code} className="cl-todo__item">
                <span className="cl-mark cl-mark--todo" aria-hidden><ExclamationOutlined /></span>
                <span className="cl-todo__body">
                  <span className="cl-todo__label">{item.label}</span>
                  {item.detail && <span className="cl-todo__detail">{item.detail}</span>}
                </span>
                <FixAction item={item} onGoToStep={onGoToStep} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="cl-callout cl-callout--ok">
          <strong>{m.employer_campaign_launch_all_met()}</strong>
          <span>{m.employer_campaign_launch_all_met_description()}</span>
        </div>
      )}

      {[...check.job_problems, ...failedJobs].map((job) => (
        <div key={job.public_id} className="cl-callout cl-callout--warn">
          <strong>{job.title || job.public_id}</strong>
          <span>{job.problems?.join(' ') || getApiErrorMessage({ response: { data: job.error } }, '')}</span>
          <Link to={employerAppPath(`/tin-tuyen-dung/${job.public_id}/chinh-sua`)} className="cl-fix-link">{m.employer_campaign_launch_edit_job()}</Link>
        </div>
      ))}

      {passing.length > 0 && (
        <details className="cl-passed">
          <summary>{m.employer_campaign_launch_passed({ count: passing.length })}</summary>
          <ul>
            {passing.map((item) => (
              <li key={item.code}>
                <span className="cl-mark cl-mark--ok" aria-hidden><CheckOutlined /></span>
                {item.label}
              </li>
            ))}
          </ul>
        </details>
      )}

      <h3 id="cl-modes-title" className="cl-group__title">{m.employer_campaign_launch_modes()}</h3>
      <div role="radiogroup" aria-labelledby="cl-modes-title" className="cl-modes">
        <ModeOption
          value="now"
          current={mode}
          onSelect={setMode}
          icon={<ThunderboltOutlined />}
          title={m.employer_campaign_launch_now()}
          text={m.employer_campaign_launch_now_text()}
        />
        <ModeOption
          value="scheduled"
          current={mode}
          onSelect={setMode}
          disabled={!overview.can_schedule}
          icon={<CalendarOutlined />}
          title={overview.can_schedule
            ? m.employer_campaign_launch_schedule_on({ date: formatDate(campaign.start_date) })
            : m.employer_campaign_launch_schedule()}
          text={overview.can_schedule
            ? m.employer_campaign_launch_schedule_text()
            : m.employer_campaign_launch_schedule_disabled()}
        />
      </div>

      {effects.length > 0 && (
        <p className="cl-effects">
          {m.employer_campaign_launch_effects({ effects: effects.join(m.employer_campaign_launch_and()) })}
        </p>
      )}

      <Checkbox className="cl-commit" checked={accepted} onChange={(event) => setAccepted(event.target.checked)}>
        {contextQuery.data?.responsibility_statement?.text
          || m.employer_campaign_launch_commitment()}
      </Checkbox>

      <div className="cl-bar">
        <span className={`cl-bar__status${blockedReason ? ' is-empty' : ''}`}>
          {blockedReason || (mode === 'scheduled' ? m.employer_campaign_launch_ready_schedule() : m.employer_campaign_launch_ready_now())}
        </span>
        <Button
          type="primary"
          disabled={Boolean(blockedReason)}
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mode === 'scheduled' ? m.employer_campaign_launch_schedule_button() : m.employer_campaign_launch_button()}
        </Button>
      </div>
    </div>
  )
}
