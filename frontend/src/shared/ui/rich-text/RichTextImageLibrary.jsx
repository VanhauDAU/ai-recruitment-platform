import { CloudUploadOutlined, FileImageOutlined, LinkOutlined, SearchOutlined } from '@ant-design/icons'
import { Alert, Button, Empty, Input, Modal, Skeleton, Tabs, Upload } from 'antd'
import { useEffect, useState } from 'react'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'

const DEFAULT_ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_IMAGE_SIZE = 5 * 1024 * 1024

function defaultAlt(name = '') {
  return name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim()
}

function formatSize(size = 0) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function errorMessage(error, fallback) {
  const response = error?.response?.data
  if (typeof response?.detail === 'string') return response.detail
  const fieldError = response && typeof response === 'object'
    ? Object.values(response).flat().find((item) => typeof item === 'string')
    : null
  return fieldError || fallback
}

function isAllowedImageUrl(value) {
  const source = value.trim()
  if (source.startsWith('/') && !source.startsWith('//')) return true
  try {
    const parsed = new URL(source)
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password
  } catch {
    return false
  }
}

export default function RichTextImageLibrary({
  open,
  onCancel,
  onInsert,
  onLoadImages,
  onUploadImage,
  allowExternalImage = false,
  acceptedImageTypes = DEFAULT_ACCEPTED_IMAGE_TYPES,
  uploadHint = m.ui_image_upload_hint(),
}) {
  const [activeTab, setActiveTab] = useState('library')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [alt, setAlt] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [externalUrl, setExternalUrl] = useState('')
  const [externalAlt, setExternalAlt] = useState('')

  useEffect(() => {
    if (!open || !onLoadImages) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const response = await onLoadImages({ q: query.trim() || undefined }, { signal: controller.signal })
        if (controller.signal.aborted) return
        setItems(response?.results || [])
      } catch (requestError) {
        if (controller.signal.aborted) return
        const text = errorMessage(requestError, m.ui_image_library_load_failed())
        setError(text)
        message.error(text)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, query ? 300 : 0)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [onLoadImages, open, query, reloadKey])

  useEffect(() => {
    if (open) return
    setSelected(null)
    setAlt('')
    setError('')
    setActiveTab('library')
    setExternalUrl('')
    setExternalAlt('')
  }, [open])

  const choose = (item) => {
    setSelected(item)
    setAlt(item.alt || defaultAlt(item.original_name || item.name))
  }

  const upload = async (file) => {
    if (!onUploadImage) return Upload.LIST_IGNORE
    if (!acceptedImageTypes.includes(file.type) || file.size > MAX_IMAGE_SIZE) {
      const text = m.ui_image_only_supports({ hint: uploadHint })
      setError(text)
      message.error(text)
      return Upload.LIST_IGNORE
    }
    setUploading(true)
    setError('')
    try {
      const uploaded = await onUploadImage(file)
      if (!uploaded?.url) throw new Error('Upload response does not include an image URL')
      setItems((current) => [uploaded, ...current.filter((item) => item.public_id !== uploaded.public_id)])
      choose(uploaded)
      setActiveTab('library')
      message.success(m.ui_image_uploaded())
    } catch (uploadError) {
      const text = errorMessage(uploadError, m.ui_image_upload_failed({ hint: uploadHint }))
      setError(text)
      message.error(text)
    } finally {
      setUploading(false)
    }
    return Upload.LIST_IGNORE
  }

  const insert = () => {
    if (activeTab === 'url') {
      if (!isAllowedImageUrl(externalUrl) || !externalAlt.trim()) return
      onInsert({ src: externalUrl.trim(), alt: externalAlt.trim() })
      onCancel()
      return
    }
    if (!selected?.url) return
    onInsert({ src: selected.url, alt: alt.trim() || defaultAlt(selected.original_name) })
    onCancel()
  }

  const library = (
    <div className="rich-image-library">
      <Input
        allowClear
        aria-label={m.ui_image_search()}
        prefix={<SearchOutlined />}
        placeholder={m.ui_image_search_placeholder()}
        size="large"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {error && <Alert className="mt-4" type="error" showIcon message={error} action={<Button size="small" onClick={() => setReloadKey((current) => current + 1)}>{m.ui_image_retry()}</Button>} />}
      {loading ? (
        <div className="rich-image-library__skeleton"><Skeleton.Image active /><Skeleton.Image active /><Skeleton.Image active /></div>
      ) : items.length ? (
        <div className="rich-image-library__grid" role="listbox" aria-label={m.ui_image_library()}>
          {items.map((item) => (
            <button
              className={`rich-image-library__item ${selected?.public_id === item.public_id ? 'rich-image-library__item--selected' : ''}`}
              key={item.public_id || item.url}
              type="button"
              role="option"
              aria-selected={selected?.public_id === item.public_id}
              onClick={() => choose(item)}
            >
              <img src={item.url} alt="" loading="lazy" />
              <span className="rich-image-library__name">{item.original_name || item.name}</span>
              <span className="rich-image-library__meta">{formatSize(item.size)}</span>
            </button>
          ))}
        </div>
      ) : (
        <Empty className="py-10" image={Empty.PRESENTED_IMAGE_SIMPLE} description={query ? m.ui_image_no_match() : m.ui_image_library_empty()} />
      )}
    </div>
  )

  const uploader = (
    <div>
      {error && <Alert className="mb-4" type="error" showIcon message={error} />}
      <Upload.Dragger
        accept={acceptedImageTypes.join(',')}
        beforeUpload={upload}
        disabled={uploading}
        multiple={false}
        showUploadList={false}
      >
        <p className="ant-upload-drag-icon"><CloudUploadOutlined /></p>
        <p className="ant-upload-text">{m.ui_image_drop()}</p>
        <p className="ant-upload-hint">{uploadHint}</p>
        {uploading && <Button className="mt-4" loading>{m.ui_image_uploading()}</Button>}
      </Upload.Dragger>
    </div>
  )

  const externalImage = (
    <div className="rich-image-library__external">
      <Alert
        type="info"
        showIcon
        message={m.ui_image_external_info()}
        description={m.ui_image_external_warning()}
      />
      <label htmlFor="rich-image-external-url">{m.ui_image_url()}</label>
      <Input
        id="rich-image-external-url"
        aria-label={m.ui_image_url()}
        placeholder="https://example.com/image.webp"
        status={externalUrl && !isAllowedImageUrl(externalUrl) ? 'error' : undefined}
        value={externalUrl}
        onChange={(event) => setExternalUrl(event.target.value)}
      />
      {externalUrl && !isAllowedImageUrl(externalUrl) && (
        <p className="rich-image-library__field-error">{m.ui_image_url_invalid()}</p>
      )}
      <label htmlFor="rich-image-external-alt">{m.ui_image_alt()}</label>
      <Input
        id="rich-image-external-alt"
        aria-label={m.ui_image_alt_from_url()}
        maxLength={255}
        placeholder={m.ui_image_alt_placeholder()}
        value={externalAlt}
        onChange={(event) => setExternalAlt(event.target.value)}
      />
    </div>
  )

  const canInsert = activeTab === 'url'
    ? isAllowedImageUrl(externalUrl) && Boolean(externalAlt.trim())
    : Boolean(selected?.url)

  return (
    <Modal
      className="rich-image-library-modal"
      width={900}
      open={open}
      title={<span><FileImageOutlined className="mr-2" />{m.ui_rich_insert_image()}</span>}
      okText={m.ui_image_insert_into_post()}
      cancelText={m.common_action_cancel()}
      okButtonProps={{ disabled: !canInsert }}
      onCancel={onCancel}
      onOk={insert}
    >
      <Tabs
        activeKey={activeTab}
        onChange={(key) => { setActiveTab(key); setError('') }}
        items={[
          { key: 'library', label: m.ui_image_library(), children: library },
          { key: 'upload', label: m.ui_image_upload_new(), children: uploader },
          ...(allowExternalImage
            ? [{ key: 'url', label: <span><LinkOutlined /> {m.ui_image_from_url()}</span>, children: externalImage }]
            : []),
        ]}
      />
      {activeTab !== 'url' && selected && (
        <div className="rich-image-library__selection">
          <img src={selected.url} alt="" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">{selected.original_name || selected.name}</p>
            <label className="mt-2 block text-xs font-medium text-slate-600" htmlFor="rich-image-alt">{m.ui_image_alt()}</label>
            <Input id="rich-image-alt" className="mt-1" value={alt} maxLength={255} onChange={(event) => setAlt(event.target.value)} placeholder={m.ui_image_alt_placeholder()} />
          </div>
        </div>
      )}
    </Modal>
  )
}
