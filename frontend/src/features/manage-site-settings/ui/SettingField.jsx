import { useEffect, useState } from 'react'
import { Button, ColorPicker, Input, InputNumber, Select, Switch, Tag, Upload } from 'antd'
import { UploadOutlined } from '@ant-design/icons'

function ColorInput({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <ColorPicker value={value} onChange={(c) => onChange(c.toHexString())} />
      <span className="font-mono text-gray-500">{value}</span>
    </div>
  )
}

function ImageInput({ value, onChange, onFileSelected, pendingFile, previewUrl, storedValue }) {
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
        placeholder="Storage key hoặc URL ảnh ngoài"
        className="flex-1"
      />
      <Upload accept="image/*" showUploadList={false} beforeUpload={handleSelectFile}>
        <Button icon={<UploadOutlined />}>Chọn ảnh</Button>
      </Upload>
    </div>
  )
}

function JsonInput({ value, onChange }) {
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
      />
      {invalid && <div className="mt-1 text-xs text-red-500">JSON không hợp lệ — thay đổi chưa được ghi nhận.</div>}
    </div>
  )
}

/** Render control nhập liệu theo value_type của setting (schema-driven). */
export default function SettingField({ setting, value, onChange, pendingFile, onFileSelected }) {
  switch (setting.value_type) {
    case 'boolean':
      return <Switch checked={!!value} onChange={onChange} />
    case 'number':
      return <InputNumber value={value} onChange={onChange} className="!w-40" />
    case 'select':
      return <Select value={value} onChange={onChange} options={setting.options?.choices || []} className="min-w-52" />
    case 'color':
      return <ColorInput value={value} onChange={onChange} />
    case 'image':
      return (
        <ImageInput
          value={value || ''}
          onChange={onChange}
          onFileSelected={onFileSelected}
          pendingFile={pendingFile}
          previewUrl={setting.display_value}
          storedValue={setting.value}
        />
      )
    case 'textarea':
      return <Input.TextArea value={value} onChange={(e) => onChange(e.target.value)} autoSize={{ minRows: 2, maxRows: 6 }} />
    case 'json':
      return <JsonInput value={value} onChange={onChange} />
    case 'env':
      return setting.env_configured ? (
        <Tag color="green">Đã cấu hình qua .env ({setting.options?.env_var})</Tag>
      ) : (
        <Tag color="orange">Chưa cấu hình — thêm {setting.options?.env_var} vào .env backend</Tag>
      )
    default: // text, email, url
      return <Input value={value} onChange={(e) => onChange(e.target.value)} />
  }
}
