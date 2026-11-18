import { BarChartOutlined, InboxOutlined, MailOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Skeleton, Switch, Tooltip } from 'antd'
import {
  employerNotificationKeys,
  getEmployerNotificationPreferences,
  updateEmployerNotificationPreferences,
} from '@/entities/notification/employer-notification'
import { message } from '@/shared/lib/toast'

function PreferenceRow({ icon, title, description, checked, disabled, loading, onChange, tooltip }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-lg border border-slate-200 p-3 sm:gap-4 sm:p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg text-slate-600">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-800">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      <Tooltip title={tooltip}><Switch checked={checked} disabled={disabled} loading={loading} onChange={onChange} /></Tooltip>
    </div>
  )
}

export default function EmployerNotificationPreferences() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: employerNotificationKeys.preferences(),
    queryFn: getEmployerNotificationPreferences,
  })
  const mutation = useMutation({
    mutationFn: ({ field, checked }) => updateEmployerNotificationPreferences({ [field]: checked }),
    onSuccess: (data) => {
      queryClient.setQueryData(employerNotificationKeys.preferences(), data)
      message.success('Đã cập nhật tùy chọn email.')
    },
    onError: () => message.error('Không thể cập nhật tùy chọn email.'),
  })
  if (query.isPending) return <Skeleton active paragraph={{ rows: 2 }} />
  const preferences = query.data || {}
  return (
    <div className="space-y-4">
      <PreferenceRow
        icon={<SafetyCertificateOutlined />}
        title="Quyết định xác thực quan trọng"
        description="Email khi hồ sơ được duyệt, từ chối, yêu cầu bổ sung, thu hồi hoặc hết hiệu lực."
        checked
        disabled
        tooltip="Email giao dịch quan trọng luôn được bật để bảo vệ tài khoản."
      />
      <PreferenceRow
        icon={<MailOutlined />}
        title="Cập nhật từng giấy tờ xác thực"
        description="Email khi một giấy tờ cần bổ sung hoặc bị từ chối; thông báo trên website vẫn luôn được lưu."
        checked={preferences.intermediate_verification_email !== false}
        loading={mutation.isPending && mutation.variables?.field === 'intermediate_verification_email'}
        onChange={(checked) => mutation.mutate({ field: 'intermediate_verification_email', checked })}
        tooltip="Có thể tắt email trung gian mà không làm mất thông báo trên website."
      />
      <PreferenceRow
        icon={<InboxOutlined />}
        title="Hồ sơ ứng tuyển mới"
        description="Email tới địa chỉ nhận hồ sơ của từng tin mỗi khi có ứng viên nộp; thông báo trên website vẫn luôn được lưu."
        checked={preferences.new_application_email !== false}
        loading={mutation.isPending && mutation.variables?.field === 'new_application_email'}
        onChange={(checked) => mutation.mutate({ field: 'new_application_email', checked })}
        tooltip="Tắt nếu bạn chỉ muốn xem hồ sơ mới trong hệ thống."
      />
      <PreferenceRow
        icon={<BarChartOutlined />}
        title="Báo cáo tuần của chiến dịch"
        description="Sáng thứ Hai, mỗi chiến dịch đang chạy gửi một email tóm tắt tiến độ, dự báo và cảnh báo của tuần trước."
        checked={preferences.campaign_weekly_report_email !== false}
        loading={mutation.isPending && mutation.variables?.field === 'campaign_weekly_report_email'}
        onChange={(checked) => mutation.mutate({ field: 'campaign_weekly_report_email', checked })}
        tooltip="Cảnh báo sức khỏe chiến dịch vẫn hiện trong thông báo trên website."
      />
    </div>
  )
}
