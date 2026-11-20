import { DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import { Button, Upload } from 'antd'
import { useEffect, useState } from 'react'
import { HOME_HERO_PLACEMENT, uploadAdminBannerImage } from '@/entities/content/banner'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'
import { CROP_ASPECTS, CROP_OUTPUT_WIDTH, cropToFile } from '../model/crop-image'
import BannerImageCropper from './BannerImageCropper'

const ACCEPT = 'image/jpeg,image/png,image/webp'

/**
 * Chọn ảnh -> cắt/căn theo khung của loại slide -> tải lên ngay.
 * Form chỉ giữ đường dẫn lưu trữ (`image_path`) và URL xem trước (`image_preview`).
 * `kind`/`placement` đọc lúc tải để luôn khớp giá trị đang có trong form.
 */
export default function BannerImageField({ form, hint }) {
  const [uploading, setUploading] = useState(false)
  const [pending, setPending] = useState(null)
  const preview = form.getFieldValue('image_preview')

  useEffect(() => () => pending && URL.revokeObjectURL(pending.source), [pending])

  function currentTarget() {
    const placement = form.getFieldValue('placement') || HOME_HERO_PLACEMENT
    const kind = form.getFieldValue('kind') || 'promo'
    return { placement, kind }
  }

  async function upload(file) {
    setUploading(true)
    try {
      const saved = await uploadAdminBannerImage(file, currentTarget())
      form.setFieldsValue({ image_path: saved.path, image_preview: saved.url })
      form.setFields([{ name: 'image_path', errors: [] }])
      setPending(null)
    } catch (error) {
      message.error(getApiErrorMessage(error, m.admin_banner_upload_failed()))
    } finally {
      setUploading(false)
    }
  }

  function choose(file) {
    if (!ACCEPT.split(',').includes(file.type)) {
      message.error(m.admin_banner_image_type())
      return Upload.LIST_IGNORE
    }
    const { placement, kind } = currentTarget()
    // Chỉ carousel trang chủ có khung cố định; vị trí khác giữ nguyên ảnh gốc.
    if (placement === HOME_HERO_PLACEMENT && CROP_ASPECTS[kind]) {
      setPending({ source: URL.createObjectURL(file), name: file.name, kind })
    } else {
      upload(file)
    }
    return Upload.LIST_IGNORE
  }

  async function confirmCrop(area) {
    const cropped = await cropToFile(pending.source, area, { maxWidth: CROP_OUTPUT_WIDTH[pending.kind], name: pending.name })
    await upload(cropped)
  }

  return (
    <div className="space-y-2">
      {preview && (
        <img src={preview} alt="" className="max-h-28 w-full rounded-md border border-slate-200 bg-slate-50 object-contain" />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Upload accept={ACCEPT} showUploadList={false} beforeUpload={choose}>
          <Button icon={<UploadOutlined />} loading={uploading && !pending}>
            {preview ? m.admin_banner_image_replace() : m.admin_banner_image_upload()}
          </Button>
        </Upload>
        {preview && (
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => form.setFieldsValue({ image_path: '', image_preview: '' })}>
            {m.admin_banner_image_remove()}
          </Button>
        )}
      </div>
      <p className="text-xs text-slate-500">{hint}</p>
      <BannerImageCropper
        source={pending?.source}
        aspect={pending ? CROP_ASPECTS[pending.kind] : 1}
        recommendedWidth={pending ? CROP_OUTPUT_WIDTH[pending.kind] : 0}
        busy={uploading}
        onCancel={() => setPending(null)}
        onConfirm={confirmCrop}
      />
    </div>
  )
}
