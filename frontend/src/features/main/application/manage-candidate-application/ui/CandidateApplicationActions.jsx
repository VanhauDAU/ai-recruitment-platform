import { BellOutlined, RollbackOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Tooltip } from 'antd'
import dayjs from 'dayjs'
import {
  applicationKeys,
  remindRecruiterOfApplication,
  withdrawCandidateApplication,
} from '@/entities/application/application'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import useConfirmAction from '@/shared/ui/confirm-action/use-confirm-action'

/** Remind the recruiter or withdraw one application, as its `actions` allow. */
export default function CandidateApplicationActions({ application }) {
  const queryClient = useQueryClient()
  const { confirmationModal, requestConfirmation } = useConfirmAction()
  const actions = application.actions || {}
  const replaceCached = (saved) => queryClient.setQueryData(
    applicationKeys.candidateList,
    (current = []) => current.map((item) => (item.public_id === saved.public_id ? saved : item)),
  )
  const withdraw = useMutation({
    mutationFn: () => withdrawCandidateApplication(application.public_id),
    onSuccess: (saved) => {
      replaceCached(saved)
      message.success('Đã rút hồ sơ.')
    },
  })
  const remind = useMutation({
    mutationFn: () => remindRecruiterOfApplication(application.public_id),
    onSuccess: (saved) => {
      replaceCached(saved)
      message.success('ProCV đã nhắc nhà tuyển dụng phản hồi hồ sơ của bạn.')
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Chưa thể nhắc nhà tuyển dụng lúc này.')),
  })

  const remindLater = !actions.remind && actions.remind_available_at
  if (!actions.withdraw && !actions.remind && !remindLater) return null
  return (
    <div className="flex flex-wrap gap-2">
      {(actions.remind || remindLater) && (
        <Tooltip title={remindLater ? `Bạn có thể nhắc từ ${dayjs(actions.remind_available_at).format('HH:mm DD/MM/YYYY')}` : null}>
          <Button
            size="small"
            icon={<BellOutlined aria-hidden="true" />}
            disabled={!actions.remind}
            loading={remind.isPending}
            onClick={() => remind.mutate()}
          >
            Nhắc NTD
          </Button>
        </Tooltip>
      )}
      {actions.withdraw && (
        <Button
          size="small"
          danger
          icon={<RollbackOutlined aria-hidden="true" />}
          onClick={() => requestConfirmation({
            title: 'Rút hồ sơ ứng tuyển',
            description: `Nhà tuyển dụng sẽ không xử lý hồ sơ của bạn cho vị trí ${application.job_title} nữa. Bạn có thể ứng tuyển lại sau.`,
            confirmText: 'Rút hồ sơ',
            cancelText: 'Giữ hồ sơ',
            danger: true,
            onConfirm: () => withdraw.mutateAsync(),
            onConfirmError: (error) => message.error(getApiErrorMessage(error, 'Không thể rút hồ sơ lúc này.')),
          })}
        >
          Rút hồ sơ
        </Button>
      )}
      {confirmationModal}
    </div>
  )
}
