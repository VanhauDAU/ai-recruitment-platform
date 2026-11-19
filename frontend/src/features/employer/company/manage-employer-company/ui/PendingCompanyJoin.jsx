import { ClockCircleOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { Button, Result } from 'antd'
import dayjs from '@/shared/lib/dayjs'
import { cancelMyCompanyJoinRequest } from '@/entities/account/employer-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'

/** A join request waiting for its decider (owner, or admin); cancel it to pick another company. */
export default function PendingCompanyJoin({ joinRequest, onChanged }) {
  const cancel = useMutation({
    mutationFn: cancelMyCompanyJoinRequest,
    onSuccess: async () => {
      message.success(m.employer_company_join_cancelled())
      await onChanged()
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_company_join_cancel_failed())),
  })
  return (
    <Result
      icon={<ClockCircleOutlined className="text-amber-500" />}
      title={m.employer_company_join_pending_title({ company: joinRequest.company_name })}
      subTitle={m.employer_company_join_pending_subtitle({
        time: dayjs(joinRequest.created_at).format('DD/MM/YYYY HH:mm'),
        decider: joinRequest.awaiting_admin
          ? m.employer_company_join_decider_admin()
          : m.employer_company_join_decider_owner(),
      })}
      extra={<Button loading={cancel.isPending} onClick={() => cancel.mutate()}>{m.employer_company_join_cancel()}</Button>}
    />
  )
}
