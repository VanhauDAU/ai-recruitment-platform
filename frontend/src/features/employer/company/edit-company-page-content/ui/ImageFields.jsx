import { DeleteOutlined, UndoOutlined, UploadOutlined } from '@ant-design/icons'
import { Button, Tag } from 'antd'
import { useEffect, useMemo, useRef } from 'react'
import { m } from '@/shared/config/i18n'

const IMAGE_TYPES = 'image/png,image/jpeg,image/webp'

function useObjectUrls(files) {
  const urls = useMemo(
    () => files.map((file) => (typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '')),
    [files],
  )
  useEffect(() => () => urls.forEach((url) => url && URL.revokeObjectURL(url)), [urls])
  return urls
}

function PickButton({ label, multiple = false, disabled, onPick }) {
  const inputRef = useRef(null)
  return (
    <>
      <Button size="small" icon={<UploadOutlined aria-hidden="true" />} disabled={disabled} onClick={() => inputRef.current?.click()}>
        {label}
      </Button>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={IMAGE_TYPES}
        multiple={multiple}
        aria-label={label}
        onChange={(event) => {
          onPick([...event.target.files])
          event.target.value = ''
        }}
      />
    </>
  )
}

/** Một ảnh (logo/ảnh bìa) dạng control của Form.Item: `value` là File mới chọn hoặc `null`. */
export function ImageField({ value = null, onChange, currentUrl, label, disabled, wide = false }) {
  const files = useMemo(() => (value ? [value] : []), [value])
  const [previewUrl] = useObjectUrls(files)
  const src = previewUrl || currentUrl

  return (
    <div className={`company-content-image ${wide ? 'company-content-image--wide' : ''}`}>
      <div className="company-content-image__frame">
        {src ? <img src={src} alt={value ? m.employer_company_image_alt_new({ label }) : m.employer_company_image_alt_current({ label })} /> : <span>{m.employer_company_image_empty()}</span>}
      </div>
      <div className="company-content-image__actions">
        <PickButton label={value ? m.employer_company_image_pick_other({ label: label.toLowerCase() }) : m.employer_company_image_pick({ label: label.toLowerCase() })} disabled={disabled} onPick={([file]) => file && onChange(file)} />
        {value && <Button size="small" type="link" disabled={disabled} onClick={() => onChange(null)}>{m.employer_company_image_clear()}</Button>}
      </div>
    </div>
  )
}

/**
 * Thư viện ảnh: `value` là `{ deletions: id[], files: File[] }`. Ảnh công khai
 * xoá/khôi phục được, ảnh mới chọn bỏ được; ảnh đang chờ duyệt chỉ để xem.
 */
export function GalleryField({ value, onChange, published = [], additions = [], limit, disabled }) {
  const { deletions, files } = value
  const fileUrls = useObjectUrls(files)
  const total = published.filter((image) => !deletions.includes(image.id)).length + additions.length + files.length
  const toggle = (id) => onChange({
    deletions: deletions.includes(id) ? deletions.filter((item) => item !== id) : [...deletions, id],
    files,
  })

  return (
    <div className="company-content-gallery">
      <p className="company-content-hint" role="status">{m.employer_company_gallery_usage({ total, limit })}</p>
      <ul className="company-content-gallery__grid" aria-label={m.employer_company_gallery_list()}>
        {published.map((image) => {
          const removed = deletions.includes(image.id)
          return (
            <li key={`published-${image.id}`} className={removed ? 'is-removed' : ''}>
              <img src={image.image_url} alt={image.caption || m.employer_company_gallery_image_alt({ id: image.id })} />
              {removed && <Tag color="red">{m.employer_company_gallery_will_delete()}</Tag>}
              <Button
                size="small"
                type="text"
                danger={!removed}
                disabled={disabled || (removed && total >= limit)}
                icon={removed ? <UndoOutlined aria-hidden="true" /> : <DeleteOutlined aria-hidden="true" />}
                aria-label={removed ? m.employer_company_gallery_keep({ id: image.id }) : m.employer_company_gallery_delete({ id: image.id })}
                onClick={() => toggle(image.id)}
              />
            </li>
          )
        })}
        {additions.map((image, index) => (
          <li key={`pending-${image.image_url}`}>
            <img src={image.image_url} alt={m.employer_company_gallery_pending_alt({ index: index + 1 })} />
            <Tag color="gold">{m.employer_company_content_status_pending()}</Tag>
          </li>
        ))}
        {files.map((file, index) => (
          <li key={`new-${file.name}-${index}`}>
            {fileUrls[index] ? <img src={fileUrls[index]} alt={m.employer_company_gallery_new_alt({ name: file.name })} /> : <span>{file.name}</span>}
            <Tag color="blue">{m.employer_company_gallery_new()}</Tag>
            <Button
              size="small"
              type="text"
              danger
              disabled={disabled}
              icon={<DeleteOutlined aria-hidden="true" />}
              aria-label={m.employer_company_gallery_remove_new({ name: file.name })}
              onClick={() => onChange({ deletions, files: files.filter((_, item) => item !== index) })}
            />
          </li>
        ))}
      </ul>
      <PickButton
        label={m.employer_company_gallery_add()}
        multiple
        disabled={disabled || total >= limit}
        onPick={(picked) => onChange({ deletions, files: [...files, ...picked.slice(0, Math.max(0, limit - total))] })}
      />
    </div>
  )
}
