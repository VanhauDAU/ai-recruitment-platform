import { ExclamationCircleFilled, LockOutlined, ReloadOutlined } from '@ant-design/icons'
import { Alert, Button, Skeleton, Switch } from 'antd'
import { Link } from 'react-router'
import { PREFERENCE_ISSUES } from '@/entities/notification/candidate-notification-preferences'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import {
  APPLICATION_NOTIFICATION_ROWS,
  JOB_EMAIL_SETTINGS,
  SETTING_LABELS,
  SIMILAR_JOBS_SETTING,
} from '../model/notification-setting-groups'
import useNotificationSettings from '../model/use-notification-settings'
import './notification-settings.css'

function SettingsSkeleton() {
  return (
    <div aria-label="Đang tải cài đặt thông báo" role="status" className="space-y-4">
      {[0, 1].map((item) => (
        <div key={item} className="border-b border-slate-100 px-5 py-5 sm:px-6">
          <Skeleton active title={{ width: '45%' }} paragraph={{ rows: 4 }} />
        </div>
      ))}
    </div>
  )
}

function IssueAlert({ code }) {
  const issue = PREFERENCE_ISSUES[code]
  if (!issue) return null
  return (
    <Alert
      showIcon
      className="!mt-2"
      type={issue.type}
      title={issue.title}
      description={issue.description}
      action={<Link to={issue.actionPath} className="font-semibold hover:underline">{issue.actionLabel}</Link>}
    />
  )
}

function ChannelSwitch({ field, settings, disabled = false }) {
  return (
    <Switch
      aria-label={SETTING_LABELS[field]}
      checked={Boolean(settings.preferences[field])}
      disabled={disabled}
      loading={settings.isSaving(field)}
      onChange={(checked) => settings.change(field, checked)}
    />
  )
}

function Section({ id, title, description, children }) {
  return (
    <section aria-labelledby={id} className="border-t border-slate-100 px-5 py-4 sm:px-6">
      <h2 id={id} className="text-sm font-semibold text-slate-800">{title}</h2>
      {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
      {children}
    </section>
  )
}

export default function EmailNotificationSettingsForm() {
  const settings = useNotificationSettings()
  const { query, preferences, issues } = settings

  if (query.isPending) return <SettingsSkeleton />
  if (query.isError) {
    return (
      <div role="alert" className="border-b border-red-200 bg-red-50 px-5 py-6 text-center">
        <ExclamationCircleFilled className="text-2xl text-red-500" />
        <p className="mt-2 font-semibold text-red-700">Chưa tải được cài đặt thông báo</p>
        <p className="mt-1 text-sm text-red-600">
          {getApiErrorMessage(query.error, 'Không thể tải cài đặt thông báo. Vui lòng thử lại.')}
        </p>
        <Button aria-label="Thử lại" className="mt-4" icon={<ReloadOutlined />} loading={query.isFetching} onClick={() => query.refetch()}>
          Thử lại
        </Button>
      </div>
    )
  }

  return (
    <div>
      {preferences.email_delivery_enabled === false && (
        <Alert
          showIcon
          type="warning"
          className="!m-5"
          title="Email đang tạm dừng trên toàn hệ thống"
          description="Quản trị viên đã tạm tắt email. Thông báo trên web vẫn hoạt động; lựa chọn email của bạn được giữ nguyên."
        />
      )}

      <Section id="notification-group-applications" title="Hồ sơ ứng tuyển" description="Chọn kênh nhận cho từng loại thông báo.">
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
          <div className="ns-row ns-row--head">
            <span>Loại thông báo</span>
            <span className="text-center">Email</span>
            <span className="text-center">Trên web</span>
          </div>
          {APPLICATION_NOTIFICATION_ROWS.map((row) => (
            <div key={row.key} className="border-t border-slate-100 px-4 py-3">
              <div className="ns-row">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium leading-5 text-slate-700">{row.label}</h3>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">{row.description}</p>
                </div>
                {row.mandatory ? (
                  <span className="col-span-2 inline-flex items-center justify-center gap-1 text-xs font-semibold text-emerald-600">
                    <LockOutlined aria-hidden /> Luôn bật
                  </span>
                ) : (
                  <>
                    <span className="flex justify-center"><ChannelSwitch field={row.email} settings={settings} /></span>
                    <span className="flex justify-center"><ChannelSwitch field={row.web} settings={settings} /></span>
                  </>
                )}
              </div>
              {row.email === SIMILAR_JOBS_SETTING.dependsOn && (
                <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-xs text-slate-600">{SIMILAR_JOBS_SETTING.label}</span>
                  <ChannelSwitch
                    field={SIMILAR_JOBS_SETTING.key}
                    settings={settings}
                    disabled={!preferences[SIMILAR_JOBS_SETTING.dependsOn]}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section id="notification-group-jobs" title="Email cơ hội việc làm">
        <ul className="mt-1">
          {JOB_EMAIL_SETTINGS.map((item) => (
            <li key={item.key} className="py-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="min-w-0 text-sm font-medium leading-5 text-slate-700">{item.label}</h3>
                <ChannelSwitch field={item.key} settings={settings} />
              </div>
              <IssueAlert code={issues[item.key]} />
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}
