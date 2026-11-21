import { Alert, Button, Drawer, Empty, Skeleton } from 'antd'
import { useEffect, useState } from 'react'
import { getIntlLocale, m } from '@/shared/config/i18n'
import { getSettingHistory } from '../api/manage-site-settings.api'
import { formatSettingValue } from '../model/setting-values'
import './site-settings.css'

/** Lịch sử thay đổi một key (audit log); "Dùng lại" chỉ điền vào form, chưa lưu. */
export default function SettingHistoryDrawer({ setting, onClose, onUseValue }) {
  const [state, setState] = useState({ loading: true, rows: [], failed: false })

  useEffect(() => {
    if (!setting) return undefined
    let active = true
    setState({ loading: true, rows: [], failed: false })
    getSettingHistory(setting.key)
      .then((rows) => active && setState({ loading: false, rows, failed: false }))
      .catch(() => active && setState({ loading: false, rows: [], failed: true }))
    return () => { active = false }
  }, [setting])

  return (
    <Drawer
      open={Boolean(setting)}
      onClose={onClose}
      title={setting ? m.admin_settings_history_title({ label: setting.label }) : ''}
      size="min(420px, 100vw)"
    >
      {state.loading && <Skeleton active paragraph={{ rows: 6 }} />}
      {state.failed && <Alert type="error" showIcon title={m.admin_settings_history_load_failed()} />}
      {!state.loading && !state.failed && state.rows.length === 0 && (
        <Empty description={m.admin_settings_history_empty()} />
      )}
      <ol className="settings-history">
        {state.rows.map((row) => (
          <li key={row.id}>
            <p className="settings-history__meta">
              {new Date(row.created_at).toLocaleString(getIntlLocale())} · {row.actor}
            </p>
            <dl>
              <dt>{m.admin_settings_history_before()}</dt>
              <dd>{formatSettingValue(setting, row.before)}</dd>
              <dt>{m.admin_settings_history_after()}</dt>
              <dd>{formatSettingValue(setting, row.after)}</dd>
            </dl>
            {setting?.value_type !== 'image' && (
              <Button size="small" onClick={() => onUseValue(row.after)}>{m.admin_settings_history_use()}</Button>
            )}
          </li>
        ))}
      </ol>
    </Drawer>
  )
}
