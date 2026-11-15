import { ClockCircleOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { Button, Result } from 'antd'
import dayjs from 'dayjs'
import { cancelMyCompanyJoinRequest } from '@/entities/employer-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'

/** A join request waiting for the company owner; cancel it to pick another company. */
export default function PendingCompanyJoin({ joinRequest, onChanged }) {
  const cancel = useMutation({
    mutationFn: cancelMyCompanyJoinRequest,
    onSuccess: async () => {
      message.success('Đã hủy yêu cầu tham gia.')
      await onChanged()
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể hủy yêu cầu lúc này.')),
  })
  return (
    <Result
      icon={<ClockCircleOutlined className="text-amber-500" />}
      title={`Đang chờ ${joinRequest.company_name} duyệt`}
      subTitle={`Bạn gửi yêu cầu lúc ${dayjs(joinRequest.created_at).format('DD/MM/YYYY HH:mm')}. Khi chủ công ty duyệt, tài khoản sẽ được liên kết và bạn tiếp tục các bước xác thực.`}
      extra={<Button loading={cancel.isPending} onClick={() => cancel.mutate()}>Hủy yêu cầu</Button>}
    />
  )
}
