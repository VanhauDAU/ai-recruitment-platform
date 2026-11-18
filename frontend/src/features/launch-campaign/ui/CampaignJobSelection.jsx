import { PlusOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Checkbox, Empty, Tag } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import { campaignKeys, saveCampaignLaunchSelection } from '@/entities/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { employerAppPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('vi-VN') : 'Chưa có hạn')

function JobGroup({ title, hint, jobs, selected, onToggle, empty }) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
      {jobs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {jobs.map((job) => (
            <li key={job.public_id} className="flex items-center gap-3 px-3 py-2">
              {onToggle ? (
                <Checkbox
                  checked={selected.has(job.public_id)}
                  onChange={(event) => onToggle(job.public_id, event.target.checked)}
                  aria-label={`Chọn ${job.title}`}
                />
              ) : <Tag color="green" className="!m-0">Đang tuyển</Tag>}
              <Link to={employerAppPath(`/jobs/${job.public_id}/edit`)} className="min-w-0 flex-1 truncate text-sm text-slate-700">
                {job.title || 'Tin chưa đặt tiêu đề'}
              </Link>
              <span className="shrink-0 text-xs text-slate-500">Hạn {formatDate(job.deadline)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const pick = (jobs, action) => new Set(jobs.filter((job) => job.action === action).map((job) => job.public_id))

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
  const newJobPath = `${employerAppPath('/jobs/new')}?campaign=${campaign.public_id}&return=setup`
  const nothing = !overview.draft_jobs.length && !overview.attachable_jobs.length && !overview.campaign_jobs.length

  return (
    <div className="space-y-5">
      <Alert
        type="info"
        showIcon
        title="Tin nháp được đăng và tin đang hiển thị được gắn vào chiến dịch đúng lúc kích hoạt."
      />
      {nothing ? (
        <Empty description="Chưa có tin nào. Tạo tin nháp cho chiến dịch để bắt đầu." />
      ) : (
        <>
          <JobGroup
            title="Tin nháp của chiến dịch"
            hint="Chọn tin sẽ được đăng khi kích hoạt."
            jobs={overview.draft_jobs}
            selected={publish}
            onToggle={toggle(setPublish)}
            empty="Chưa có tin nháp nào trong chiến dịch."
          />
          <JobGroup
            title="Tin đang hiển thị khác"
            hint="Tin chưa thuộc chiến dịch nào đang chạy; chọn để gắn vào chiến dịch này."
            jobs={overview.attachable_jobs}
            selected={attach}
            onToggle={toggle(setAttach)}
            empty="Không có tin đang hiển thị nào để gắn."
          />
          {overview.campaign_jobs.length > 0 && (
            <JobGroup
              title="Tin đã thuộc chiến dịch"
              hint="Các tin này đang tuyển trong chiến dịch."
              jobs={overview.campaign_jobs}
              empty=""
            />
          )}
        </>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Link to={newJobPath}>
          <Button icon={<PlusOutlined aria-hidden />} className="!w-full sm:!w-auto">Tạo tin nháp mới</Button>
        </Link>
        <Button type="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>
          Lưu và tiếp tục
        </Button>
      </div>
    </div>
  )
}
