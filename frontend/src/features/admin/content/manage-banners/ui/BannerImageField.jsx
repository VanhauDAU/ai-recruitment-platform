import { DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import { Button, Upload } from 'antd'
import { useState } from 'react'
import { uploadAdminBannerImage } from '@/entities/content/banner'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'

/** Tải ảnh lên ngay khi chọn file; form chỉ giữ đường dẫn lưu trữ và URL xem trước. */
export default function BannerImageField({ form, placement, kind, hint }) {
  const [uploading, setUploading] = useState(false)
  const preview = form.getFieldValue('image_preview')

  async function upload(file) {
    setUploading(true)
    try {
      const saved = await uploadAdminBannerImage(file, { placement, kind })
      form.setFieldsValue({ image_path: saved.path, image_preview: saved.url })
      form.setFields([{ name: 'image_path', errors: [] }])
    } catch (error) {
      message.error(getApiErrorMessage(error, m.admin_banner_upload_failed()))
    } finally {
      setUploading(false)
    }
    return Upload.LIST_IGNORE
  }

  return (
    <div className="space-y-2">
      {preview && (
        <img src={preview} alt="" className="max-h-28 w-full rounded-md border border-slate-200 object-contain bg-slate-50" />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Upload accept="image/jpeg,image/png,image/webp" showUploadList={false} beforeUpload={upload}>
          <Button icon={<UploadOutlined />} loading={uploading}>
            {preview ? m.admin_banner_image_replace() : m.admin_banner_image_upload()}
          </Button>
        </Upload>
        {preview && (
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => form.setFieldsValue({ image_path: '', image_preview: '' })}
          >
            {m.admin_banner_image_remove()}
          </Button>
        )}
      </div>
      <p className="text-xs text-slate-500">{hint}</p>
    </div>
  )
}
