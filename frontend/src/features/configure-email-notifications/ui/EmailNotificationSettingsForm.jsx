import {
  ExclamationCircleFilled,
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

function normalizePreferences(data) {
  return Object.fromEntries(
    NOTIFICATION_SETTING_KEYS.map((key) => [key, Boolean(data?.[key])]),
  )
}

function SettingsSkeleton() {
  return (
    <div aria-label="Đang tải cài đặt nhận email" role="status" className="space-y-4">
      {[0, 1, 2].map((item) => (
        <div key={item} className="border-b border-slate-100 px-5 py-5 sm:px-6">
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
      setSaveState('idle')
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
        className="border-b border-red-200 bg-red-50 px-5 py-6 text-center"
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
    <div>
      <div
        aria-live="polite"
        className={saveState === 'idle'
          ? 'sr-only'
          : 'flex items-center justify-end px-5 py-2 text-xs font-medium sm:px-6'}
        role="status"
      >
        {saveState === 'saving' && (
          <span className="inline-flex items-center gap-2 text-slate-500">
            <Spin size="small" /> Đang lưu thay đổi...
          </span>
        )}
        {saveState === 'error' && (
          <span className="inline-flex items-center gap-1.5 text-red-600">
            <ExclamationCircleFilled /> Chưa lưu được thay đổi
          </span>
        )}
      </div>

      {saveError && (
        <p role="alert" className="bg-red-50 px-5 py-3 text-sm text-red-700 sm:px-6">
          {saveError}
        </p>
      )}

      {NOTIFICATION_SETTING_GROUPS.map((group) => {
        return (
          <section
            key={group.key}
            aria-labelledby={`notification-group-${group.key}`}
            className="border-t border-slate-100 px-5 py-3.5 sm:px-6"
          >
            <h2 id={`notification-group-${group.key}`} className="text-sm font-semibold text-slate-800">
              {group.title}
            </h2>

            <ul className="mt-1">
              {group.items.map((item) => {
                const labelId = `notification-setting-${item.key}`
                return (
                  <li
                    key={item.key}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <h3 id={labelId} className="min-w-0 text-sm font-medium leading-5 text-slate-700">
                      {item.label}
                    </h3>
                    <Switch
                      aria-labelledby={labelId}
                      checked={Boolean(preferences[item.key])}
                      disabled={Boolean(savingField)}
                      loading={savingField === item.key}
                      onChange={(checked) => handlePreferenceChange(item.key, checked)}
                      className="shrink-0"
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
