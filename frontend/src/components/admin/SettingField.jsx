import { useState } from 'react'
import { Button, ColorPicker, Input, InputNumber, Select, Switch, Tag, Upload, message } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { uploadSettingImage } from '../../api/adminSiteService'

function ColorInput({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <ColorPicker value={value} onChange={(c) => onChange(c.toHexString())} />
      <span className="font-mono text-gray-500">{value}</span>
    </div>
  )
}

function ImageInput({ value, onChange, settingKey }) {
  const [uploading, setUploading] = useState(false)

  const customRequest = async ({ file, onSuccess, onError }) => {
    setUploading(true)
    try {
      const { url } = await uploadSettingImage(file, settingKey)
      onChange(url)
      onSuccess(url)
    } catch (err) {
      message.error('Upload ảnh thất bại.')
      onError(err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {value ? (
        <img src={value} alt="" className="h-10 max-w-[120px] rounded border border-gray-200 object-contain bg-white p-1" />
      ) : null}
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="URL ảnh" className="flex-1" />
      <Upload accept="image/*" showUploadList={false} customRequest={customRequest}>
        <Button icon={<UploadOutlined />} loading={uploading}>Upload</Button>
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
export default function SettingField({ setting, value, onChange }) {
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
      return <ImageInput value={value || ''} onChange={onChange} settingKey={setting.key} />
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
