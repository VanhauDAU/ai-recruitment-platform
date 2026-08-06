import { DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import { Button, ColorPicker, Form, Input, Select, Space, Upload, message } from 'antd'
import { useState } from 'react'
import {
  ANNOUNCEMENT_THEME_MODES,
  uploadAdminAnnouncementBackground,
} from '@/entities/announcement'
import {
  BG_FIT_OPTIONS,
  BG_OVERLAY_OPTIONS,
  BG_POSITION_OPTIONS,
  THEME_MODE_OPTIONS,
  THEME_PRESET_OPTIONS,
} from '../model/announcement-options'

function toHex(value, fallback = '') {
  if (!value) return fallback
  if (typeof value === 'string') return value
  if (typeof value.toHexString === 'function') return value.toHexString().slice(0, 7)
  return fallback
}

export default function AnnouncementVisualFields({ form, themeMode }) {
  const [uploading, setUploading] = useState(false)
  const backgroundUrl = Form.useWatch('background_image_url', form)
  const backgroundKey = Form.useWatch('background_image', form)

  const setColor = (field) => (value) => {
    form.setFieldValue(field, toHex(value, form.getFieldValue(field) || '#0f766e'))
  }

  const clearBackground = () => {
    form.setFieldsValue({
      background_image: '',
      background_image_url: '',
      background_overlay: 'none',
    })
  }

  const beforeUpload = async (file) => {
    setUploading(true)
    try {
      const uploaded = await uploadAdminAnnouncementBackground(file)
      form.setFieldsValue({
        background_image: uploaded.path,
        background_image_url: uploaded.url,
        background_overlay: form.getFieldValue('background_overlay') === 'none'
          ? 'dark'
          : form.getFieldValue('background_overlay'),
      })
      message.success(`Đã tải ảnh nền ${uploaded.width}×${uploaded.height}.`)
    } catch {
      message.error('Không tải được ảnh nền. Kiểm tra JPEG/PNG/WebP, ≤1MB, cao ≤120px.')
    } finally {
      setUploading(false)
    }
    return false
  }

  return (
    <div className="announcement-editor__grid announcement-editor__wide">
      <Form.Item
        className="announcement-editor__wide"
        name="theme_mode"
        label="Màu hiển thị"
        extra="Kind = palette theo loại; Preset = bảng có sẵn; Custom = hex tùy chỉnh."
      >
        <Select options={THEME_MODE_OPTIONS} />
      </Form.Item>

      {themeMode === ANNOUNCEMENT_THEME_MODES.PRESET && (
        <Form.Item
          name="theme_preset"
          label="Bảng màu"
          rules={[{ required: true, message: 'Chọn preset.' }]}
        >
          <Select options={THEME_PRESET_OPTIONS} placeholder="Chọn preset" />
        </Form.Item>
      )}

      {themeMode === ANNOUNCEMENT_THEME_MODES.CUSTOM && (
        <>
          {[
            ['color_accent', 'Accent / icon'],
            ['color_bg_from', 'Nền gradient (đầu)'],
            ['color_bg_to', 'Nền gradient (cuối)'],
            ['color_fg', 'Màu chữ'],
          ].map(([name, label]) => (
            <Form.Item key={name} name={name} label={label} className="announcement-editor__color-field">
              <Space.Compact className="w-full">
                <Form.Item name={name} noStyle>
                  <Input maxLength={7} placeholder="#0F766E" />
                </Form.Item>
                <ColorPicker
                  value={form.getFieldValue(name) || '#0f766e'}
                  onChange={setColor(name)}
                  disabledAlpha
                />
              </Space.Compact>
            </Form.Item>
          ))}
        </>
      )}

      <Form.Item name="background_image" hidden><Input /></Form.Item>
      <Form.Item name="background_image_url" hidden><Input /></Form.Item>

      <Form.Item
        className="announcement-editor__wide"
        label="Ảnh nền dải (tuỳ chọn)"
        extra="Khuyến nghị ~980×31, JPEG/PNG/WebP, ≤1 MB, cao ≤120 px. Height dải vẫn theo nội dung."
      >
        <div className="announcement-editor__bg-upload">
          <Upload
            accept="image/jpeg,image/png,image/webp"
            showUploadList={false}
            beforeUpload={beforeUpload}
            disabled={uploading}
          >
            <Button icon={<UploadOutlined />} loading={uploading}>
              {backgroundKey ? 'Thay ảnh nền' : 'Tải ảnh nền'}
            </Button>
          </Upload>
          {backgroundKey && (
            <Button icon={<DeleteOutlined />} onClick={clearBackground}>
              Xóa ảnh
            </Button>
          )}
        </div>
        {backgroundUrl && (
          <div className="announcement-editor__bg-thumb" style={{ backgroundImage: `url(${backgroundUrl})` }} />
        )}
      </Form.Item>

      {backgroundKey ? (
        <>
          <Form.Item name="background_fit" label="Cách phủ ảnh">
            <Select options={BG_FIT_OPTIONS} />
          </Form.Item>
          <Form.Item name="background_position" label="Vị trí ảnh">
            <Select options={BG_POSITION_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="background_overlay"
            label="Lớp phủ contrast"
            extra="Có ảnh nên dùng phủ tối/sáng để chữ dễ đọc."
          >
            <Select options={BG_OVERLAY_OPTIONS} />
          </Form.Item>
        </>
      ) : null}
    </div>
  )
}
