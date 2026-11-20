import { Alert, Skeleton, Tag, Tooltip } from 'antd'
import { QuestionCircleOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { m } from '@/shared/config/i18n'
import { getSystemParameters } from '../api/manage-site-settings.api'
import './site-settings.css'

/** Bảng thông số chỉ đọc do .env/mã nguồn quyết định (không bao giờ có secret). */
export default function SystemParametersPanel() {
  const [state, setState] = useState({ loading: true, groups: [], failed: false })

  useEffect(() => {
    let active = true
    getSystemParameters()
      .then((groups) => active && setState({ loading: false, groups, failed: false }))
      .catch(() => active && setState({ loading: false, groups: [], failed: true }))
    return () => { active = false }
  }, [])

  return (
    <section className="settings-section">
      <h3 className="settings-section__title">{m.admin_settings_system_title()}</h3>
      <p className="settings-section__description">{m.admin_settings_system_description()}</p>
      {state.loading && <Skeleton active paragraph={{ rows: 6 }} />}
      {state.failed && <Alert type="error" showIcon title={m.admin_settings_system_load_failed()} />}
      {state.groups.map((group) => (
        <div key={group.key} className="settings-params">
          <p className="settings-params__group">{group.label}</p>
          <dl>
            {group.items.map((item) => (
              <div key={item.key} className="settings-params__item">
                <dt>
                  {item.label}
                  {item.help && (
                    <Tooltip title={item.help}>
                      <QuestionCircleOutlined className="settings-params__help" aria-label={item.help} />
                    </Tooltip>
                  )}
                </dt>
                <dd>
                  <strong>{item.value}</strong>
                  <Tag variant="filled">
                    {item.source === 'code' ? m.admin_settings_system_source_code() : item.key}
                  </Tag>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  )
}
