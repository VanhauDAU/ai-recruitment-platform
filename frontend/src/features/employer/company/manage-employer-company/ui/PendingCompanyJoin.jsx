import { ClockCircleOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { Button, Result } from 'antd'
import dayjs from '@/shared/lib/dayjs'
import { cancelMyCompanyJoinRequest } from '@/entities/account/employer-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'

/** A join request waiting for its decider (owner, or admin); cancel it to pick another company. */
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
      title={`Đang chờ duyệt tham gia ${joinRequest.company_name}`}
      subTitle={`Gửi lúc ${dayjs(joinRequest.created_at).format('DD/MM/YYYY HH:mm')}. ${
        joinRequest.awaiting_admin
          ? 'Công ty chưa có quản lý đã xác thực nên quản trị viên ProCV sẽ duyệt.'
          : 'Quản lý công ty sẽ duyệt.'
      } Sau khi được duyệt, bạn nộp giấy tờ để xác thực tài khoản (bước riêng do quản trị viên kiểm tra).`}
      extra={<Button loading={cancel.isPending} onClick={() => cancel.mutate()}>Hủy yêu cầu</Button>}
    />
  )
}
