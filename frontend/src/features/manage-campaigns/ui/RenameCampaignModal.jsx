import { EditOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal, message } from 'antd'
import { campaignKeys, updateCampaign } from '@/entities/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import CampaignNameForm from './CampaignNameForm'

export default function RenameCampaignModal({ campaign, onClose }) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({ publicId, values }) => updateCampaign(publicId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.all })
      onClose()
      message.success('Đã cập nhật chiến dịch.')
    },
    onError: (error) => message.error(
      getApiErrorMessage(error, 'Không thể cập nhật chiến dịch.'),
    ),
  })

  return (
    <Modal
      destroyOnHidden
      footer={null}
      open={Boolean(campaign)}
      title={(
        <span className="inline-flex items-center gap-2">
          <EditOutlined className="text-emerald-600" />
          Sửa chiến dịch
        </span>
      )}
      onCancel={onClose}
    >
      <CampaignNameForm
        initialName={campaign?.name}
        submitting={mutation.isPending}
        onCancel={onClose}
        onSubmit={(values) => mutation.mutate({
          publicId: campaign.public_id,
          values,
        })}
      />
    </Modal>
  )
}
