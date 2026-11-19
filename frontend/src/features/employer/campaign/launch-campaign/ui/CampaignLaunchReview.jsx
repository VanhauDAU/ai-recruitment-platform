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
import { getIntlLocale } from '@/shared/config/i18n'

const formatDate = (value) => (value ? new Date(value).toLocaleDateString(getIntlLocale()) : '')
const STEP_TITLES = Object.fromEntries(SETUP_STEPS.map((step) => [step.key, step.title]))

function FixAction({ item, onGoToStep }) {
  const step = CHECK_STEP[item.code]
  if (step) {
    return <Button size="small" onClick={() => onGoToStep?.(step)}>Sửa ở bước {STEP_TITLES[step]}</Button>
  }
  if (item.code === 'publication') {
    return <Link to={EMPLOYER_VERIFY_URL} className="cl-fix-link">Xem điều kiện tài khoản</Link>
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
        ? `Đã lên lịch. Chiến dịch tự chạy ngày ${formatDate(campaign.start_date)}.`
        : 'Đã kích hoạt chiến dịch. Các tin đã được đăng.')
      onLaunched?.(result)
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Chưa kích hoạt được chiến dịch.'), { duration: 6 }),
  })
  const failedJobs = mutation.error?.response?.data?.jobs || []
  const blockedReason = !check.ready
    ? `Còn ${failing.length} việc cần xong trước khi kích hoạt.`
    : !accepted ? 'Đánh dấu cam kết để kích hoạt.' : ''
  const effects = [
    selection.toPublish && `đăng ${selection.toPublish} tin nháp`,
    selection.toAttach && `gắn ${selection.toAttach} tin đang hiển thị vào chiến dịch`,
  ].filter(Boolean)

  return (
    <div className="cl-step">
      {overview.last_error?.error && (
        <div className="cl-callout cl-callout--error" role="alert">
          <strong>Lần tự kích hoạt gần nhất không thành công.</strong>
          <span>{getApiErrorMessage({ response: { data: overview.last_error.error } }, 'Kiểm tra lại các mục bên dưới.')}</span>
        </div>
      )}

      {failing.length > 0 ? (
        <section className="cl-todo" aria-labelledby="cl-todo-title">
          <h3 id="cl-todo-title" className="cl-todo__title">Còn {failing.length} việc trước khi kích hoạt</h3>
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
          <strong>Mọi điều kiện đã đạt.</strong>
          <span>Chọn cách kích hoạt và xác nhận cam kết bên dưới.</span>
        </div>
      )}

      {[...check.job_problems, ...failedJobs].map((job) => (
        <div key={job.public_id} className="cl-callout cl-callout--warn">
          <strong>{job.title || job.public_id}</strong>
          <span>{job.problems?.join(' ') || getApiErrorMessage({ response: { data: job.error } }, '')}</span>
          <Link to={employerAppPath(`/jobs/${job.public_id}/edit`)} className="cl-fix-link">Sửa tin</Link>
        </div>
      ))}

      {passing.length > 0 && (
        <details className="cl-passed">
          <summary>{passing.length} điều kiện đã đạt</summary>
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

      <h3 id="cl-modes-title" className="cl-group__title">Cách kích hoạt</h3>
      <div role="radiogroup" aria-labelledby="cl-modes-title" className="cl-modes">
        <ModeOption
          value="now"
          current={mode}
          onSelect={setMode}
          icon={<ThunderboltOutlined />}
          title="Kích hoạt ngay"
          text="Chiến dịch chạy từ hôm nay, tin được đăng và nhận hồ sơ ngay."
        />
        <ModeOption
          value="scheduled"
          current={mode}
          onSelect={setMode}
          disabled={!overview.can_schedule}
          icon={<CalendarOutlined />}
          title={overview.can_schedule ? `Lên lịch ngày ${formatDate(campaign.start_date)}` : 'Lên lịch'}
          text={overview.can_schedule
            ? 'Hệ thống tự kích hoạt vào ngày bắt đầu và báo cho bạn.'
            : 'Cần ngày bắt đầu sau hôm nay. Chọn ngày ở bước Thông tin.'}
        />
      </div>

      {effects.length > 0 && (
        <p className="cl-effects">
          Khi kích hoạt, hệ thống sẽ {effects.join(' và ')}.
        </p>
      )}

      <Checkbox className="cl-commit" checked={accepted} onChange={(event) => setAccepted(event.target.checked)}>
        {contextQuery.data?.responsibility_statement?.text
          || 'Tôi cam kết chịu trách nhiệm về nội dung các tin tuyển dụng trong chiến dịch.'}
      </Checkbox>

      <div className="cl-bar">
        <span className={`cl-bar__status${blockedReason ? ' is-empty' : ''}`}>
          {blockedReason || (mode === 'scheduled' ? 'Sẵn sàng lên lịch.' : 'Sẵn sàng kích hoạt.')}
        </span>
        <Button
          type="primary"
          disabled={Boolean(blockedReason)}
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mode === 'scheduled' ? 'Lên lịch kích hoạt' : 'Kích hoạt chiến dịch'}
        </Button>
      </div>
    </div>
  )
}
