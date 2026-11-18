import { CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Checkbox, Radio } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import { campaignKeys, launchCampaign } from '@/entities/campaign'
import { getJobPostingContext, jobKeys } from '@/entities/job'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { employerAppPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('vi-VN') : '')

export default function CampaignLaunchReview({ campaign, overview, onLaunched }) {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState(campaign.status === 'scheduled' ? 'scheduled' : 'now')
  const [accepted, setAccepted] = useState(false)
  const contextQuery = useQuery({ queryKey: jobKeys.postingContext, queryFn: getJobPostingContext })
  const check = overview.check || { ready: false, items: [], job_problems: [] }
  const mutation = useMutation({
    mutationFn: () => launchCampaign(campaign.public_id, {
      mode,
      acceptedStatementVersion: overview.statement_version,
    }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.all })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      message.success(result.status === 'scheduled'
        ? `Đã lên lịch, chiến dịch tự chạy ngày ${formatDate(campaign.start_date)}.`
        : 'Chiến dịch đã chạy. Các tin đã được đăng.')
      onLaunched?.(result)
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Chưa kích hoạt được chiến dịch.'), { duration: 6 }),
  })
  const failedJobs = mutation.error?.response?.data?.jobs || []

  return (
    <div className="space-y-5">
      {overview.last_error?.error && (
        <Alert
          type="error"
          showIcon
          title="Lần kích hoạt theo lịch gần nhất không thành công"
          description={getApiErrorMessage({ response: { data: overview.last_error.error } }, 'Kiểm tra lại các mục bên dưới.')}
        />
      )}
      <ul className="space-y-2">
        {check.items.map((item) => (
          <li key={item.code} className="flex items-start gap-2 text-sm">
            {item.ok
              ? <CheckCircleFilled className="mt-0.5 text-emerald-600" aria-label="Đạt" />
              : <CloseCircleFilled className="mt-0.5 text-rose-500" aria-label="Chưa đạt" />}
            <div>
              <p className="font-medium text-slate-800">{item.label}</p>
              {!item.ok && item.detail && <p className="text-xs text-slate-500">{item.detail}</p>}
            </div>
          </li>
        ))}
      </ul>
      {[...check.job_problems, ...failedJobs].map((job) => (
        <Alert
          key={job.public_id}
          type="warning"
          showIcon
          title={job.title || job.public_id}
          description={job.problems?.join(' ') || getApiErrorMessage({ response: { data: job.error } }, '')}
          action={<Link to={employerAppPath(`/jobs/${job.public_id}/edit`)}>Sửa tin</Link>}
        />
      ))}
      <Radio.Group value={mode} onChange={(event) => setMode(event.target.value)} className="grid gap-2">
        <Radio value="now">Kích hoạt ngay: đăng tin và bắt đầu nhận hồ sơ từ hôm nay</Radio>
        <Radio value="scheduled" disabled={!overview.can_schedule}>
          Lên lịch: tự kích hoạt ngày {formatDate(campaign.start_date) || '(chọn ngày bắt đầu ở bước Mục tiêu)'}
        </Radio>
      </Radio.Group>
      <Checkbox checked={accepted} onChange={(event) => setAccepted(event.target.checked)}>
        <span className="text-sm text-slate-700">
          {contextQuery.data?.responsibility_statement?.text
            || 'Tôi cam kết chịu trách nhiệm về nội dung các tin tuyển dụng trong chiến dịch.'}
        </span>
      </Checkbox>
      <div className="flex justify-end">
        <Button
          type="primary"
          disabled={!accepted || !check.ready}
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mode === 'scheduled' ? 'Lên lịch kích hoạt' : 'Kích hoạt chiến dịch'}
        </Button>
      </div>
    </div>
  )
}
