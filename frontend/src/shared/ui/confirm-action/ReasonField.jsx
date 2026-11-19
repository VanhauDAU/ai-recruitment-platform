import { Form, Input } from 'antd'
import { applyReasonPreset } from './reason-presets'

/**
 * Reason/evidence input for ActionDialog: quick-pick presets owned by the
 * calling feature, an editable textarea with a counter, and the audit rules.
 */
export default function ReasonField({
  extra,
  label = 'Lý do',
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
    ...(required ? [{ required: true, whitespace: true, message: `Nhập ${label.toLowerCase()}.` }] : []),
    ...(minLength ? [{ min: minLength, message: `Cần ít nhất ${minLength} ký tự.` }] : []),
    { max: maxLength, message: `Tối đa ${maxLength} ký tự.` },
  ]

  return (
    <Form.Item extra={extra} label={label} required={required}>
      {presets.length > 0 && (
        <div className="reason-field__presets" role="group" aria-label="Gợi ý nhanh">
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
