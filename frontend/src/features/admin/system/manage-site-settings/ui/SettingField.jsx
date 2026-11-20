import { useEffect, useState } from 'react'
import { Button, ColorPicker, Input, InputNumber, Select, Switch, Upload } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { m } from '@/shared/config/i18n'
import SettingListEditor from './SettingListEditor'

function ColorInput({ value, onChange, disabled }) {
  return (
    <div className="flex items-center gap-2">
      <ColorPicker value={value} disabled={disabled} onChange={(c) => onChange(c.toHexString())} />
      <span className="font-mono text-gray-500">{value}</span>
    </div>
  )
}

function ImageInput({ value, onChange, onFileSelected, pendingFile, previewUrl, storedValue, disabled }) {
  const [localPreviewUrl, setLocalPreviewUrl] = useState(null)
  const manualPreviewUrl = value !== storedValue && /^(https?:)?\//.test(value) ? value : null
  const activePreviewUrl = localPreviewUrl || manualPreviewUrl || previewUrl

  useEffect(() => {
    if (!pendingFile) {
      setLocalPreviewUrl(null)
      return undefined
    }
    const objectUrl = URL.createObjectURL(pendingFile)
    setLocalPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [pendingFile])

  const handleSelectFile = (file) => {
    onFileSelected?.(file)
    return false
  }

  return (
    <div className="flex items-center gap-3">
      {activePreviewUrl ? (
        <img src={activePreviewUrl} alt="" className="h-10 max-w-[120px] rounded border border-gray-200 object-contain bg-white p-1" />
      ) : null}
      <Input
        value={value}
        onChange={(e) => {
          onFileSelected?.(null)
          onChange(e.target.value)
        }}
        placeholder={m.admin_settings_image_placeholder()}
        className="flex-1"
        disabled={disabled}
      />
      <Upload accept="image/*" showUploadList={false} beforeUpload={handleSelectFile} disabled={disabled}>
        <Button icon={<UploadOutlined />} disabled={disabled}>{m.admin_settings_image_choose()}</Button>
      </Upload>
    </div>
  )
}

function JsonInput({ value, onChange, disabled }) {
  const [text, setText] = useState(() => JSON.stringify(value ?? null, null, 2))
  const [invalid, setInvalid] = useState(false)

  const handleBlur = () => {
    try {
      onChange(JSON.parse(text))
      setInvalid(false)
    } catch {
      setInvalid(true)
    }
  }

  return (
    <div>
      <Input.TextArea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        autoSize={{ minRows: 2, maxRows: 8 }}
        status={invalid ? 'error' : undefined}
        className="font-mono"
        disabled={disabled}
      />
      {invalid && <div className="mt-1 text-xs text-red-500">{m.admin_settings_json_invalid()}</div>}
    </div>
  )
}

function JsonField({ setting, value, onChange, disabled }) {
  const schema = setting.options?.schema
  if (schema?.item === 'string') {
    return (
      <Select
        mode="tags"
        value={Array.isArray(value) ? value : []}
        onChange={onChange}
        open={false}
        suffixIcon={null}
        tokenSeparators={[',']}
        placeholder={m.admin_settings_tags_placeholder()}
        disabled={disabled}
        className="w-full"
      />
    )
  }
  if (schema?.item === 'object') {
    return <SettingListEditor fields={schema.fields || []} value={value} onChange={onChange} disabled={disabled} />
  }
  return <JsonInput value={value} onChange={onChange} disabled={disabled} />
}

/** Render control nhập liệu theo value_type + options của setting (schema-driven). */
export default function SettingField({ setting, value, onChange, pendingFile, onFileSelected, disabled = false, status }) {
  const maxLength = Number.isInteger(setting.options?.max_length) ? setting.options.max_length : undefined
  const textProps = { value, disabled, status, maxLength, showCount: Boolean(maxLength), onChange: (e) => onChange(e.target.value) }
  switch (setting.value_type) {
    case 'boolean':
      return <Switch checked={!!value} onChange={onChange} disabled={disabled} />
    case 'number':
      return (
        <InputNumber
          value={value}
          onChange={onChange}
          min={Number.isFinite(setting.options?.min) ? setting.options.min : undefined}
          max={Number.isFinite(setting.options?.max) ? setting.options.max : undefined}
          step={Number.isFinite(setting.options?.step) ? setting.options.step : undefined}
          precision={setting.options?.integer ? 0 : setting.options?.precision}
          disabled={disabled}
          status={status}
          className="!w-40"
        />
      )
    case 'select':
      return <Select value={value} onChange={onChange} options={setting.options?.choices || []} disabled={disabled} status={status} className="min-w-52" />
    case 'multiselect':
      return <Select mode="multiple" value={Array.isArray(value) ? value : []} onChange={onChange} options={setting.options?.choices || []} disabled={disabled} status={status} className="w-full" />
    case 'color':
      return <ColorInput value={value} onChange={onChange} disabled={disabled} />
    case 'image':
      return (
        <ImageInput
          value={value || ''}
          onChange={onChange}
          onFileSelected={onFileSelected}
          pendingFile={pendingFile}
          previewUrl={setting.display_value}
          storedValue={setting.value}
          disabled={disabled}
        />
      )
    case 'textarea':
      return <Input.TextArea {...textProps} autoSize={{ minRows: 2, maxRows: 6 }} />
    case 'json':
      return <JsonField setting={setting} value={value} onChange={onChange} disabled={disabled} />
    default: // text, email, url
      return <Input {...textProps} />
  }
}
