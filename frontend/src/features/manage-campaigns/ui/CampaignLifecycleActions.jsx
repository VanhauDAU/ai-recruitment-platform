import {
  PauseCircleOutlined,
  PlayCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Input, Modal, Skeleton, Switch, message } from 'antd'
import { useState } from 'react'
import {
  campaignKeys,
  changeCampaignStatus,
  getCampaignPauseImpact,
} from '@/entities/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'

export default function CampaignLifecycleActions({
  campaign,
  block = false,
  variant = 'buttons',
}) {
  const [pauseOpen, setPauseOpen] = useState(false)
  const [confirmationCode, setConfirmationCode] = useState('')
  const queryClient = useQueryClient()
  const impactQuery = useQuery({
    queryKey: campaignKeys.pauseImpact(campaign?.public_id),
    queryFn: () => getCampaignPauseImpact(campaign.public_id),
    enabled: pauseOpen && Boolean(campaign?.public_id),
  })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: campaignKeys.all })
  const mutation = useMutation({
    mutationFn: ({ status, code }) => (
      changeCampaignStatus(campaign.public_id, status, code)
    ),
    onSuccess: (_, variables) => {
      invalidate()
      setPauseOpen(false)
      setConfirmationCode('')
      message.success(
        variables.status === 'active'
          ? 'Đã mở lại chiến dịch.'
          : 'Đã dừng chiến dịch và ẩn các tin đang công khai.',
      )
    },
    onError: (error) => message.error(
      getApiErrorMessage(error, 'Không thể đổi trạng thái chiến dịch.'),
    ),
  })
  const impact = impactQuery.data
  const canToggle = ['active', 'paused'].includes(campaign?.status)

  function handleToggle(checked) {
    if (!checked && campaign?.status === 'active') {
      setPauseOpen(true)
      return
    }
    if (checked && campaign?.status === 'paused') {
      mutation.mutate({ status: 'active' })
    }
  }

  return (
    <>
      {variant === 'switch' ? (
        <Switch
          size="small"
          checked={campaign?.status === 'active'}
          disabled={!canToggle}
          loading={mutation.isPending}
          aria-label={
            campaign?.status === 'active'
              ? `Dừng chiến dịch ${campaign.name}`
              : campaign?.status === 'paused'
                ? `Mở lại chiến dịch ${campaign.name}`
                : `Chiến dịch ${campaign?.name} đã kết thúc`
          }
          className="!min-w-9 shrink-0 [&.ant-switch-checked]:!bg-emerald-500"
          onChange={handleToggle}
        />
      ) : (
        <div className={`flex flex-wrap gap-2 ${block ? '[&>*]:flex-1' : ''}`}>
          {campaign?.status === 'active' && (
            <Button
              icon={<PauseCircleOutlined aria-hidden />}
              className="!h-10 !rounded-xl !border-rose-200 !bg-rose-50/80 !px-4 !font-semibold !text-rose-700 !shadow-sm transition-all duration-200 hover:!-translate-y-0.5 hover:!border-rose-300 hover:!bg-rose-100 hover:!text-rose-800 hover:!shadow-md focus-visible:!outline-2 focus-visible:!outline-offset-2 focus-visible:!outline-rose-400 active:!translate-y-0"
              onClick={() => setPauseOpen(true)}
            >
              Dừng chiến dịch
            </Button>
          )}
          {campaign?.status === 'paused' && (
            <Button
              type="primary"
              icon={<PlayCircleOutlined aria-hidden />}
              className="!h-10 !rounded-xl !border-0 !bg-gradient-to-r !from-emerald-600 !to-teal-600 !px-4 !font-semibold !shadow-md transition-all duration-200 hover:!-translate-y-0.5 hover:!from-emerald-500 hover:!to-teal-500 hover:!shadow-lg active:!translate-y-0"
              loading={mutation.isPending}
              onClick={() => mutation.mutate({ status: 'active' })}
            >
              Mở lại chiến dịch
            </Button>
          )}
        </div>
      )}
      <Modal
        destroyOnHidden
        open={pauseOpen}
        title="Dừng chiến dịch tuyển dụng"
        okText="Xác nhận dừng"
        cancelText="Hủy"
        okButtonProps={{
          danger: true,
          disabled: confirmationCode !== campaign?.public_id || impactQuery.isLoading,
        }}
        confirmLoading={mutation.isPending}
        onCancel={() => {
          setPauseOpen(false)
          setConfirmationCode('')
        }}
        onOk={() => mutation.mutate({ status: 'paused', code: confirmationCode })}
      >
        {impactQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : (
          <div className="space-y-4">
            <Alert
              type="warning"
              showIcon
              icon={<WarningOutlined />}
              title={`${impact?.active_public_job_count || 0} tin đang công khai sẽ bị ẩn`}
              description="Trạng thái của tin không thay đổi. Tin còn hạn sẽ tự hiển thị lại khi mở chiến dịch."
            />
            {(impact?.active_public_jobs || []).length > 0 && (
              <div className="rounded-lg border border-slate-200">
                {(impact.active_public_jobs || []).map((job) => (
                  <div
                    key={job.public_id}
                    className="border-b border-slate-100 px-3 py-2 text-sm last:border-b-0"
                  >
                    <strong className="text-slate-700">{job.title}</strong>
                    <span className="ml-2 text-xs text-slate-400">#{job.public_id}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              Dịch vụ đang chạy: <strong>Không có</strong>
            </div>
            <label className="block text-sm font-medium text-slate-700">
              Nhập mã <strong>{campaign?.public_id}</strong> để xác nhận
              <Input
                className="mt-2 !h-11 !rounded-xl !border-slate-300 transition-shadow focus-within:!border-rose-400 focus-within:!shadow-[0_0_0_3px_rgba(251,113,133,0.14)]"
                value={confirmationCode}
                onChange={(event) => setConfirmationCode(event.target.value)}
              />
            </label>
          </div>
        )}
      </Modal>
    </>
  )
}
