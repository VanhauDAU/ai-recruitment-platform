import { CloseOutlined, PictureOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Upload } from 'antd'
import { useRef } from 'react'
import { campaignKeys, getChannelPostImageChoices, uploadChannelPostImage } from '@/entities/campaign/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'

export const MAX_POST_IMAGES = 4
const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'

// Ảnh đính kèm bài Fanpage: tải từ máy hoặc dùng ảnh bìa, logo công ty. value = [{path, url}].
export default function PostImagePicker({ campaignId, channelId, value = [], onChange }) {
  const choicesQuery = useQuery({
    queryKey: campaignKeys.postImageChoices(campaignId, channelId),
    queryFn: () => getChannelPostImageChoices(campaignId, channelId),
  })
  const upload = useMutation({
    mutationFn: (file) => uploadChannelPostImage(campaignId, channelId, file),
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_campaign_images_upload_error())),
  })
  // Nhiều ảnh tải song song: mỗi ảnh xong phải nối vào danh sách mới nhất, không phải bản lúc bắt đầu.
  const latest = useRef(value)
  latest.current = value
  const full = value.length >= MAX_POST_IMAGES
  const add = (image) => {
    const current = latest.current
    if (current.length >= MAX_POST_IMAGES || current.some((item) => item.path === image.path)) return
    latest.current = [...current, { path: image.path, url: image.url }]
    onChange(latest.current)
  }
  const companyImages = (choicesQuery.data?.company_images || []).filter(
    (item) => !value.some((image) => image.path === item.path),
  )

  return (
    <div className="ch-images">
      {value.length > 0 && (
        <ul className="ch-images__grid" aria-label={m.employer_campaign_images_attached_aria()}>
          {value.map((image, index) => (
            <li key={image.path}>
              <img src={image.url} alt={m.employer_campaign_images_alt({ index: index + 1 })} />
              <button
                type="button"
                aria-label={m.employer_campaign_images_remove_aria({ index: index + 1 })}
                onClick={() => onChange(value.filter((item) => item.path !== image.path))}
              >
                <CloseOutlined aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="ch-chips">
        <Upload
          accept={ACCEPT}
          multiple
          showUploadList={false}
          disabled={full || upload.isPending}
          beforeUpload={(file) => {
            if (file.size > MAX_BYTES) {
              message.error(m.employer_campaign_images_too_large({ name: file.name }))
              return Upload.LIST_IGNORE
            }
            return true
          }}
          customRequest={({ file, onSuccess, onError }) => {
            upload.mutateAsync(file).then((saved) => {
              add(saved)
              onSuccess(saved)
            }, onError)
          }}
        >
          <button type="button" className="ch-chip" disabled={full || upload.isPending}>
            <PlusOutlined aria-hidden /> {upload.isPending ? m.employer_campaign_images_uploading() : m.employer_campaign_images_upload()}
          </button>
        </Upload>
        {companyImages.map((item) => (
          <button key={item.path} type="button" className="ch-chip" disabled={full} onClick={() => add(item)}>
            <PictureOutlined aria-hidden /> {m.employer_campaign_images_use({ label: item.label.toLowerCase() })}
          </button>
        ))}
      </div>
      <p className="ch-section-note">
        {m.employer_campaign_images_note({ max: MAX_POST_IMAGES })}
      </p>
    </div>
  )
}
