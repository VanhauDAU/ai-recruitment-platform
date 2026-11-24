import {
  CheckCircleOutlined,
  MoreOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Dropdown, Input, Modal, Skeleton } from 'antd'
import { useState } from 'react'
import {
  campaignKeys,
  changeCampaignStatus,
  getCampaignPauseImpact,
} from '@/entities/campaign/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import CodeBadge from '@/shared/ui/code-badge/CodeBadge'
import { message } from '@/shared/lib/toast'

// Kết thúc chiến dịch đóng mọi tin đang tuyển; hủy lịch đưa chiến dịch về nháp.
const END_ACTIONS = {
  completed: {
    title: m.employer_campaign_lifecycle_complete_title(),
    okText: m.employer_campaign_lifecycle_complete_ok(),
    description: m.employer_campaign_lifecycle_complete_description(),
    success: m.employer_campaign_lifecycle_complete_success(),
  },
  cancelled: {
    title: m.employer_campaign_lifecycle_cancel_title(),
    okText: m.employer_campaign_lifecycle_cancel_title(),
    description: m.employer_campaign_lifecycle_cancel_description(),
    success: m.employer_campaign_lifecycle_cancel_success(),
  },
  draft: {
    title: m.employer_campaign_lifecycle_unschedule_title(),
    okText: m.employer_campaign_lifecycle_unschedule_ok(),
    description: m.employer_campaign_lifecycle_unschedule_description(),
    success: m.employer_campaign_lifecycle_unschedule_success(),
  },
}

// Thao tác vòng đời: "Mở lại" là nút chính khi tạm dừng, còn lại gom trong menu.
export default function CampaignLifecycleActions({ campaign }) {
  const [pauseOpen, setPauseOpen] = useState(false)
  const [confirmationCode, setConfirmationCode] = useState('')
  const [endStatus, setEndStatus] = useState('')
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
      setEndStatus('')
      message.success(
        END_ACTIONS[variables.status]?.success
          || (variables.status === 'active'
            ? m.employer_campaign_lifecycle_resumed()
            : m.employer_campaign_lifecycle_paused()),
      )
    },
    onError: (error) => message.error(
      getApiErrorMessage(error, m.employer_campaign_lifecycle_status_error()),
    ),
  })
  const impact = impactQuery.data
  const endOptions = {
    draft: ['cancelled'],
    scheduled: ['draft', 'cancelled'],
    active: ['completed', 'cancelled'],
    paused: ['completed', 'cancelled'],
  }[campaign?.status] || []
  const endAction = END_ACTIONS[endStatus]
  const menuItems = [
    campaign?.status === 'active' && {
      key: 'pause',
      label: m.employer_campaign_lifecycle_pause(),
      icon: <PauseCircleOutlined aria-hidden />,
    },
    ...endOptions.map((status) => ({
      key: status,
      label: END_ACTIONS[status].okText,
      icon: status === 'completed' ? <CheckCircleOutlined aria-hidden /> : <StopOutlined aria-hidden />,
      danger: status === 'cancelled',
    })),
  ].filter(Boolean)

  return (
    <>
      {campaign?.status === 'paused' && (
        <Button
          type="primary"
          icon={<PlayCircleOutlined aria-hidden />}
          loading={mutation.isPending}
          onClick={() => mutation.mutate({ status: 'active' })}
        >
          {m.employer_campaign_lifecycle_resume()}
        </Button>
      )}
      {menuItems.length > 0 && (
        <Dropdown
          trigger={['click']}
          menu={{
            items: menuItems,
            onClick: ({ key }) => (key === 'pause' ? setPauseOpen(true) : setEndStatus(key)),
          }}
        >
          <Button icon={<MoreOutlined aria-hidden />}>{m.employer_campaign_lifecycle_more()}</Button>
        </Dropdown>
      )}
      <Modal
        destroyOnHidden
        open={Boolean(endAction)}
        title={endAction?.title}
        okText={endAction?.okText}
        cancelText={m.employer_campaign_close()}
        okButtonProps={{ danger: endStatus !== 'completed' }}
        confirmLoading={mutation.isPending}
        onCancel={() => setEndStatus('')}
        onOk={() => mutation.mutate({ status: endStatus })}
      >
        <p className="text-sm text-slate-600">{endAction?.description}</p>
      </Modal>
      <Modal
        destroyOnHidden
        open={pauseOpen}
        title={m.employer_campaign_lifecycle_pause_title()}
        okText={m.employer_campaign_lifecycle_pause_ok()}
        cancelText={m.employer_campaign_cancel()}
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
              title={m.employer_campaign_lifecycle_pause_impact({ count: impact?.active_public_job_count || 0 })}
              description={m.employer_campaign_lifecycle_pause_impact_description()}
            />
            {(impact?.active_public_jobs || []).length > 0 && (
              <div className="rounded-lg border border-slate-200">
                {(impact.active_public_jobs || []).map((job) => (
                  <div
                    key={job.public_id}
                    className="border-b border-slate-100 px-3 py-2 text-sm last:border-b-0"
                  >
                    <strong className="text-slate-700">{job.title}</strong>
                    <CodeBadge code={job.code} className="ml-2" />
                  </div>
                ))}
              </div>
            )}
            <label className="block text-sm font-medium text-slate-700">
              {m.employer_campaign_lifecycle_code_prefix()}
              <strong>{campaign?.public_id}</strong>
              {m.employer_campaign_lifecycle_code_suffix()}
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
