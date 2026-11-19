import { MailOutlined } from '@ant-design/icons'
import { Switch, Tooltip } from 'antd'
import { EmployerNotificationPreferences } from '@/features/employer/account/configure-employer-notifications'
import { m } from '@/shared/config/i18n'

export default function EmployerGeneralSettings() {
  return (
    <div className="space-y-4">
      <EmployerNotificationPreferences />
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-lg border border-slate-200 p-3 sm:gap-4 sm:p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg text-slate-600"><MailOutlined /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-slate-800">{m.employer_account_settings_cv_notify_title()}</p>
            <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">{m.employer_account_settings_active()}</span>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-500">{m.employer_account_settings_cv_notify_desc()}</p>
        </div>
        <Tooltip title={m.employer_account_settings_cv_notify_tooltip()}><Switch checked disabled /></Tooltip>
      </div>
    </div>
  )
}
