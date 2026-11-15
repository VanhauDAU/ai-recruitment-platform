import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Tooltip } from 'antd'
import dayjs from 'dayjs'
import { useState } from 'react'
import {
  applicationKeys,
  remindRecruiterOfApplication,
  replaceCandidateApplicationCv,
  withdrawCandidateApplication,
} from '@/entities/application'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import useConfirmAction from '@/shared/ui/use-confirm-action'
import ReplaceApplicationCvModal from './ReplaceApplicationCvModal'

/** Withdraw or swap the CV of one application, as its `actions` allow. */
export default function CandidateApplicationActions({ application }) {
  const queryClient = useQueryClient()
  const [cvModalOpen, setCvModalOpen] = useState(false)
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
  const replaceCv = useMutation({
    mutationFn: (selection) => replaceCandidateApplicationCv(application.public_id, selection),
    onSuccess: (saved) => {
      replaceCached(saved)
      setCvModalOpen(false)
      message.success('Đã nộp CV mới cho hồ sơ này.')
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể đổi CV lúc này.')),
  })

  const remindLater = !actions.remind && actions.remind_available_at
  if (!actions.withdraw && !actions.update_cv && !actions.remind && !remindLater) return null
  return (
    <div className="flex flex-wrap gap-2">
      {(actions.remind || remindLater) && (
        <Tooltip title={remindLater ? `Bạn có thể nhắc từ ${dayjs(actions.remind_available_at).format('HH:mm DD/MM/YYYY')}` : null}>
          <Button size="small" disabled={!actions.remind} loading={remind.isPending} onClick={() => remind.mutate()}>
            Nhắc NTD
          </Button>
        </Tooltip>
      )}
      {actions.update_cv && (
        <Button size="small" onClick={() => setCvModalOpen(true)}>Đổi CV</Button>
      )}
      {actions.withdraw && (
        <Button
          size="small"
          danger
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
      <ReplaceApplicationCvModal
        open={cvModalOpen}
        currentCvId={application.cv_public_id}
        saving={replaceCv.isPending}
        onCancel={() => setCvModalOpen(false)}
        onSubmit={(selection) => replaceCv.mutate(selection)}
      />
      {confirmationModal}
    </div>
  )
}
