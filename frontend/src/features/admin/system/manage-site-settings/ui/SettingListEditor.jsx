import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Input } from 'antd'
import { m } from '@/shared/config/i18n'
import './site-settings.css'

const FIELD_LABELS = {
  value: m.admin_settings_field_value,
  label_vi: m.admin_settings_field_label_vi,
  label_en: m.admin_settings_field_label_en,
  name: m.admin_settings_field_name,
  name_vi: m.admin_settings_field_name_vi,
  name_en: m.admin_settings_field_name_en,
  logo_url: m.admin_settings_field_logo_url,
}

const fieldLabel = (field) => FIELD_LABELS[field]?.() || field

/** Danh sách object theo `options.schema.fields` (vd số liệu, logo đối tác) thay cho ô JSON thô. */
export default function SettingListEditor({ fields, value, onChange, disabled }) {
  const rows = Array.isArray(value) ? value : []
  const update = (next) => onChange(next)
  const setCell = (index, field, text) => update(rows.map((row, i) => {
    if (i !== index) return row
    const next = { ...row, [field]: text }
    if (!text) delete next[field]
    return next
  }))
  const move = (index, offset) => {
    const next = [...rows]
    const [row] = next.splice(index, 1)
    next.splice(index + offset, 0, row)
    update(next)
  }

  return (
    <div className="settings-list">
      {rows.length === 0 && <p className="settings-list__empty">{m.admin_settings_list_empty()}</p>}
      {rows.map((row, index) => (
        // eslint-disable-next-line react/no-array-index-key -- rows have no stable id; order is the identity
        <div className="settings-list__row" key={index}>
          <div className="settings-list__cells">
            {fields.map((field) => (
              <Input
                key={field}
                aria-label={`${fieldLabel(field)} ${index + 1}`}
                placeholder={fieldLabel(field)}
                value={row?.[field] || ''}
                onChange={(event) => setCell(index, field, event.target.value)}
                disabled={disabled}
              />
            ))}
          </div>
          <div className="settings-list__actions">
            <Button type="text" size="small" icon={<ArrowUpOutlined />} disabled={disabled || index === 0}
              aria-label={m.admin_settings_list_up({ index: index + 1 })} onClick={() => move(index, -1)} />
            <Button type="text" size="small" icon={<ArrowDownOutlined />} disabled={disabled || index === rows.length - 1}
              aria-label={m.admin_settings_list_down({ index: index + 1 })} onClick={() => move(index, 1)} />
            <Button type="text" size="small" danger icon={<DeleteOutlined />} disabled={disabled}
              aria-label={m.admin_settings_list_remove({ index: index + 1 })} onClick={() => update(rows.filter((_, i) => i !== index))} />
          </div>
        </div>
      ))}
      <Button size="small" icon={<PlusOutlined />} disabled={disabled} onClick={() => update([...rows, {}])}>
        {m.admin_settings_list_add()}
      </Button>
    </div>
  )
}
