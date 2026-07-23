import {
  CheckCircleFilled,
  ExclamationCircleFilled,
  LockFilled,
  ReloadOutlined,
} from '@ant-design/icons'
import { Button, Skeleton, Spin, Switch } from 'antd'
import { useEffect, useState } from 'react'
import {
  getCandidateNotificationPreferences,
  updateCandidateNotificationPreferences,
} from '@/entities/candidate-notification-preferences'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import {
  NOTIFICATION_SETTING_GROUPS,
  NOTIFICATION_SETTING_KEYS,
} from '../model/notification-setting-groups'

const GROUP_TONES = {
  emerald: {
    icon: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    accent: 'from-emerald-500 to-teal-500',
  },
  blue: {
    icon: 'bg-sky-50 text-sky-600 ring-sky-100',
    accent: 'from-sky-500 to-indigo-500',
  },
  amber: {
    icon: 'bg-amber-50 text-amber-600 ring-amber-100',
    accent: 'from-amber-400 to-orange-500',
  },
}

function normalizePreferences(data) {
  return Object.fromEntries(
    NOTIFICATION_SETTING_KEYS.map((key) => [key, Boolean(data?.[key])]),
  )
}

function SettingsSkeleton() {
  return (
    <div aria-label="Đang tải cài đặt nhận email" role="status" className="space-y-4">
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-2xl border border-slate-200 bg-white p-5">
          <Skeleton active title={{ width: '45%' }} paragraph={{ rows: 4 }} />
        </div>
      ))}
    </div>
  )
}

export default function EmailNotificationSettingsForm() {
  const [preferences, setPreferences] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [savingField, setSavingField] = useState('')
  const [saveState, setSaveState] = useState('idle')
  const [reloadVersion, setReloadVersion] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError('')

    getCandidateNotificationPreferences()
      .then((data) => {
        if (!active) return
        setPreferences(normalizePreferences(data))
      })
      .catch((error) => {
        if (!active) return
        setLoadError(getApiErrorMessage(
          error,
          'Không thể tải cài đặt nhận email. Vui lòng thử lại.',
        ))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [reloadVersion])

  async function handlePreferenceChange(field, enabled) {
    if (savingField || !preferences) return

    const previousValue = preferences[field]
    setPreferences((current) => ({ ...current, [field]: enabled }))
    setSavingField(field)
    setSaveState('saving')
    setSaveError('')

    try {
      const saved = await updateCandidateNotificationPreferences({ [field]: enabled })
      setPreferences((current) => ({
        ...current,
        [field]: typeof saved?.[field] === 'boolean' ? saved[field] : enabled,
      }))
      setSaveState('saved')
    } catch (error) {
      setPreferences((current) => ({ ...current, [field]: previousValue }))
      const errorMessage = getApiErrorMessage(
        error,
        'Không thể lưu lựa chọn này. Thay đổi đã được hoàn tác.',
      )
      setSaveError(errorMessage)
      setSaveState('error')
      message.error(errorMessage)
    } finally {
      setSavingField('')
    }
  }

  if (loading) return <SettingsSkeleton />

  if (loadError) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-red-200 bg-red-50 px-5 py-6 text-center"
      >
        <ExclamationCircleFilled className="text-2xl text-red-500" />
        <p className="mt-2 font-semibold text-red-700">Chưa tải được cài đặt nhận email</p>
        <p className="mt-1 text-sm text-red-600">{loadError}</p>
        <Button
          aria-label="Thử lại"
          className="mt-4"
          icon={<ReloadOutlined />}
          onClick={() => setReloadVersion((version) => version + 1)}
        >
          Thử lại
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <LockFilled />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900">Email bảo mật luôn được bật</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Xác thực email, đặt lại mật khẩu và mã xác minh hai bước là thông báo
                  thiết yếu nên không thể tắt.
                </p>
              </div>
              <Switch
                aria-label="Email bảo mật luôn bật"
                checked
                disabled
                checkedChildren="Luôn bật"
              />
            </div>
          </div>
        </div>
      </div>

      <div
        aria-live="polite"
        className="flex min-h-6 items-center justify-end text-xs font-medium"
        role="status"
      >
        {saveState === 'saving' && (
          <span className="inline-flex items-center gap-2 text-slate-500">
            <Spin size="small" /> Đang lưu thay đổi...
          </span>
        )}
        {saveState === 'saved' && (
          <span className="inline-flex items-center gap-1.5 text-emerald-600">
            <CheckCircleFilled /> Đã lưu tự động
          </span>
        )}
        {saveState === 'error' && (
          <span className="inline-flex items-center gap-1.5 text-red-600">
            <ExclamationCircleFilled /> Chưa lưu được thay đổi
          </span>
        )}
      </div>

      {saveError && (
        <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {saveError}
        </p>
      )}

      {NOTIFICATION_SETTING_GROUPS.map((group) => {
        const Icon = group.icon
        const tone = GROUP_TONES[group.tone]

        return (
          <section
            key={group.key}
            aria-labelledby={`notification-group-${group.key}`}
            className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tone.accent}`} />
            <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ${tone.icon}`}>
                <Icon className="text-lg" />
              </span>
              <div className="min-w-0">
                <h2 id={`notification-group-${group.key}`} className="font-bold text-slate-900">
                  {group.title}
                </h2>
                <p className="mt-1 text-sm leading-5 text-slate-500">{group.description}</p>
              </div>
            </div>

            <ul className="divide-y divide-slate-100">
              {group.items.map((item) => {
                const labelId = `notification-setting-${item.key}`
                return (
                  <li
                    key={item.key}
                    className="flex items-start justify-between gap-4 px-4 py-4 transition-colors hover:bg-slate-50/70 sm:px-5"
                  >
                    <div className="min-w-0">
                      <h3 id={labelId} className="text-sm font-semibold text-slate-800">
                        {item.label}
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
                        {item.description}
                      </p>
                    </div>
                    <Switch
                      aria-labelledby={labelId}
                      checked={Boolean(preferences[item.key])}
                      disabled={Boolean(savingField)}
                      loading={savingField === item.key}
                      onChange={(checked) => handlePreferenceChange(item.key, checked)}
                      className="mt-0.5 shrink-0"
                    />
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
