import { CopyOutlined, HistoryOutlined, QuestionCircleOutlined, UndoOutlined } from '@ant-design/icons'
import { Button, Popover, Tag, Tooltip } from 'antd'
import { getIntlLocale, m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'
import { formatSettingValue, isEqual } from '../model/setting-values'
import SettingField from './SettingField'
import './site-settings.css'

function HelpContent({ setting, value, onResetDefault, onHistory }) {
  const appliesTo = setting.options?.applies_to || []
  const hasDefault = setting.default_value !== null && setting.default_value !== undefined
  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(setting.key)
      message.success(m.admin_settings_help_copied())
    } catch {
      // Clipboard API có thể bị chặn; key vẫn hiển thị để chọn thủ công.
    }
  }

  return (
    <div className="settings-help">
      {setting.help && <p className="settings-help__text">{setting.help}</p>}
      <dl className="settings-help__facts">
        {appliesTo.length > 0 && (
          <>
            <dt>{m.admin_settings_help_applies_to()}</dt>
            <dd>{appliesTo.map((place) => <Tag key={place}>{place}</Tag>)}</dd>
          </>
        )}
        {hasDefault && (
          <>
            <dt>{m.admin_settings_help_default()}</dt>
            <dd className="settings-help__default">
              <span>{formatSettingValue(setting, setting.default_value)}</span>
              {!isEqual(value, setting.default_value) && setting.value_type !== 'image' && (
                <Button size="small" type="link" onClick={onResetDefault}>{m.admin_settings_help_reset_default()}</Button>
              )}
            </dd>
          </>
        )}
        <dt>{m.admin_settings_help_public()}</dt>
        <dd>{setting.is_public ? m.admin_settings_help_public_yes() : m.admin_settings_help_public_no()}</dd>
        <dt>{m.admin_settings_help_key()}</dt>
        <dd>
          <code>{setting.key}</code>
          <Button size="small" type="text" icon={<CopyOutlined />} aria-label={m.admin_settings_help_copy_key()} onClick={copyKey} />
        </dd>
        {setting.updated_at && (
          <>
            <dt>{m.admin_settings_help_updated()}</dt>
            <dd>{new Date(setting.updated_at).toLocaleString(getIntlLocale())}</dd>
          </>
        )}
      </dl>
      <Button size="small" icon={<HistoryOutlined />} onClick={onHistory}>{m.admin_settings_help_history()}</Button>
    </div>
  )
}

/** Một dòng cấu hình: nhãn, mô tả, ô nhập, trạng thái đã sửa/lỗi và nút "?". */
export default function SettingRow({
  setting, value, file, dirty, error, blockedBy, highlighted,
  onChange, onFileSelected, onRevert, onHistory,
}) {
  const pending = Boolean(setting.options?.pending)
  // Danh sách object cần cả chiều ngang cho các ô; nhãn nằm phía trên.
  const wide = setting.options?.schema?.item === 'object'
  return (
    <div
      id={`setting-${setting.key}`}
      className={`settings-row${wide ? ' settings-row--wide' : ''}${highlighted ? ' settings-row--highlight' : ''}`}
    >
      <div className="settings-row__meta">
        <div className="settings-row__label">
          <span>{setting.label}</span>
          <Popover
            trigger="click"
            placement="bottom"
            title={setting.label}
            content={(
              <HelpContent
                setting={setting}
                value={value}
                onResetDefault={() => onChange(setting.default_value)}
                onHistory={onHistory}
              />
            )}
          >
            <Button
              type="text"
              size="small"
              className="settings-row__help"
              icon={<QuestionCircleOutlined />}
              aria-label={m.admin_settings_help_button({ label: setting.label })}
            />
          </Popover>
          {pending && <Tag color="orange">{m.admin_settings_pending_tag()}</Tag>}
          {dirty && <Tag color="blue">{m.admin_settings_modified()}</Tag>}
        </div>
        {setting.description && !pending && <p className="settings-row__description">{setting.description}</p>}
      </div>
      <div className="settings-row__control">
        <div className="settings-row__field">
          <SettingField
            setting={setting}
            value={value}
            onChange={onChange}
            pendingFile={file}
            onFileSelected={onFileSelected}
            disabled={Boolean(blockedBy)}
            status={error ? 'error' : undefined}
          />
          {dirty && (
            <Tooltip title={m.admin_settings_revert_field()}>
              <Button type="text" size="small" icon={<UndoOutlined />} aria-label={m.admin_settings_revert_field()} onClick={onRevert} />
            </Tooltip>
          )}
        </div>
        {blockedBy && <p className="settings-row__hint">{m.admin_settings_depends_on({ label: blockedBy })}</p>}
        {error && <p className="settings-row__error" role="alert">{error}</p>}
      </div>
    </div>
  )
}
