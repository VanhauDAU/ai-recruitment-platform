import { BarChartOutlined, InboxOutlined, MailOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Skeleton, Switch, Tooltip } from 'antd'
import {
  employerNotificationKeys,
  getEmployerNotificationPreferences,
  updateEmployerNotificationPreferences,
} from '@/entities/notification/employer-notification'
import { message } from '@/shared/lib/toast'
import { m } from '@/shared/config/i18n'

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
      message.success(m.employer_account_notify_saved())
    },
    onError: () => message.error(m.employer_account_notify_save_failed()),
  })
  if (query.isPending) return <Skeleton active paragraph={{ rows: 2 }} />
  const preferences = query.data || {}
  return (
    <div className="space-y-4">
      <PreferenceRow
        icon={<SafetyCertificateOutlined />}
        title={m.employer_account_notify_decision_title()}
        description={m.employer_account_notify_decision_desc()}
        checked
        disabled
        tooltip={m.employer_account_notify_decision_tooltip()}
      />
      <PreferenceRow
        icon={<MailOutlined />}
        title={m.employer_account_notify_document_title()}
        description={m.employer_account_notify_document_desc()}
        checked={preferences.intermediate_verification_email !== false}
        loading={mutation.isPending && mutation.variables?.field === 'intermediate_verification_email'}
        onChange={(checked) => mutation.mutate({ field: 'intermediate_verification_email', checked })}
        tooltip={m.employer_account_notify_document_tooltip()}
      />
      <PreferenceRow
        icon={<InboxOutlined />}
        title={m.employer_account_notify_application_title()}
        description={m.employer_account_notify_application_desc()}
        checked={preferences.new_application_email !== false}
        loading={mutation.isPending && mutation.variables?.field === 'new_application_email'}
        onChange={(checked) => mutation.mutate({ field: 'new_application_email', checked })}
        tooltip={m.employer_account_notify_application_tooltip()}
      />
      <PreferenceRow
        icon={<BarChartOutlined />}
        title={m.employer_account_notify_weekly_title()}
        description={m.employer_account_notify_weekly_desc()}
        checked={preferences.campaign_weekly_report_email !== false}
        loading={mutation.isPending && mutation.variables?.field === 'campaign_weekly_report_email'}
        onChange={(checked) => mutation.mutate({ field: 'campaign_weekly_report_email', checked })}
        tooltip={m.employer_account_notify_weekly_tooltip()}
      />
    </div>
  )
}
