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

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('vi-VN') : 'Chưa đặt hạn nộp')
const pick = (jobs, action) => new Set(jobs.filter((job) => job.action === action).map((job) => job.public_id))

function JobRow({ job, checked, onToggle, badge, targetDate }) {
  const lateDeadline = targetDate && job.deadline && job.deadline > targetDate
  const content = (
    <>
      <span className="cl-job__main">
        <span className="cl-job__title">{job.title || 'Tin chưa đặt tiêu đề'}</span>
        <span className="cl-job__meta">
          <span className={`cl-chip cl-chip--${badge.tone}`}>{badge.label}</span>
          {job.number_of_vacancies ? <span>Tuyển {job.number_of_vacancies} người</span> : null}
          <span>Hạn nộp {formatDate(job.deadline)}</span>
        </span>
        {lateDeadline && (
          <span className="cl-job__warn">
            <WarningFilled aria-hidden /> Hạn nộp sau ngày kết thúc chiến dịch, cần sửa trước khi kích hoạt.
          </span>
        )}
      </span>
      <Link
        to={employerAppPath(`/jobs/${job.public_id}/edit`)}
        className="cl-job__edit"
        onClick={(event) => event.stopPropagation()}
      >
        Sửa tin
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
      message.success('Đã lưu danh sách tin của chiến dịch.')
      onSaved?.(data)
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể lưu danh sách tin.')),
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
          <span className="cl-create__title">Tạo tin mới cho chiến dịch</span>
          <span className="cl-create__text">
            Điền tin rồi bấm <strong>Lưu nháp</strong> (không bấm Đăng tin). Bạn sẽ được đưa về đây để chọn tin.
          </span>
        </span>
      </Link>

      {!hasAnyJob ? (
        <div className="cl-empty">
          <InboxOutlined aria-hidden className="cl-empty__icon" />
          <p>Chưa có tin nào để chọn. Tạo tin mới ở trên, hoặc đăng tin trước rồi quay lại gắn vào chiến dịch.</p>
        </div>
      ) : (
        <>
          <JobGroup
            title="Tin nháp của chiến dịch"
            hint="Tin được chọn sẽ đăng công khai khi kích hoạt."
            jobs={overview.draft_jobs}
            selected={publish}
            onToggle={toggle(setPublish)}
            badge={{ label: 'Nháp', tone: 'draft' }}
            targetDate={targetDate}
          />
          <JobGroup
            title="Tin bạn đang đăng"
            hint="Tin chưa thuộc chiến dịch nào đang chạy. Tin được chọn sẽ thuộc chiến dịch này khi kích hoạt."
            jobs={overview.attachable_jobs}
            selected={attach}
            onToggle={toggle(setAttach)}
            badge={{ label: 'Đang hiển thị', tone: 'live' }}
            targetDate={targetDate}
          />
          <JobGroup
            title="Đã thuộc chiến dịch"
            hint="Các tin này đang tuyển trong chiến dịch."
            jobs={overview.campaign_jobs}
            badge={{ label: 'Đang tuyển', tone: 'live' }}
          />
        </>
      )}

      <div className="cl-bar">
        <span className={`cl-bar__status${total ? '' : ' is-empty'}`}>
          {total
            ? `Đã chọn ${total} tin${headcount ? `, tuyển tổng ${headcount} người` : ''}`
            : 'Chưa chọn tin nào. Chiến dịch cần ít nhất 1 tin.'}
        </span>
        <Button type="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>
          Lưu và tiếp tục
        </Button>
      </div>
    </div>
  )
}
