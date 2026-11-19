import { Form, Input } from 'antd'
import { applyReasonPreset } from './reason-presets'
import { m } from '@/shared/config/i18n'

/**
 * Reason/evidence input for ActionDialog: quick-pick presets owned by the
 * calling feature, an editable textarea with a counter, and the audit rules.
 */
export default function ReasonField({
  extra,
  label = m.common_reason_label(),
  maxLength = 500,
  minLength,
  name = 'reason',
  placeholder,
  presets = [],
  required = true,
  rows = 3,
}) {
  const form = Form.useFormInstance()
  const value = Form.useWatch(name, form) || ''
  const rules = [
    ...(required ? [{ required: true, whitespace: true, message: m.common_reason_required({ label: label.toLowerCase() }) }] : []),
    ...(minLength ? [{ min: minLength, message: m.common_reason_min({ count: minLength }) }] : []),
    { max: maxLength, message: m.common_reason_max({ count: maxLength }) },
  ]

  return (
    <Form.Item extra={extra} label={label} required={required}>
      {presets.length > 0 && (
        <div className="reason-field__presets" role="group" aria-label={m.common_reason_presets()}>
          {presets.map((preset) => (
            <button
              aria-pressed={value.includes(preset)}
              className="reason-field__preset"
              key={preset}
              onClick={() => {
                form.setFieldValue(name, applyReasonPreset(value, preset, presets))
                form.validateFields([name]).catch(() => {})
              }}
              type="button"
            >
              {preset}
            </button>
          ))}
        </div>
      )}
      <Form.Item name={name} noStyle rules={rules}>
        <Input.TextArea
          aria-label={label}
          autoComplete="off"
          maxLength={maxLength}
          placeholder={placeholder}
          rows={rows}
          showCount
        />
      </Form.Item>
    </Form.Item>
  )
}
