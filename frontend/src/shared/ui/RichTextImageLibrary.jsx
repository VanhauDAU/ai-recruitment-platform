import { CloudUploadOutlined, FileImageOutlined, SearchOutlined } from '@ant-design/icons'
import { Alert, Button, Empty, Input, Modal, Skeleton, Tabs, Upload } from 'antd'
import { useEffect, useState } from 'react'
import { message } from '@/shared/lib/toast'

const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
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

export default function RichTextImageLibrary({ open, onCancel, onInsert, onLoadImages, onUploadImage }) {
  const [activeTab, setActiveTab] = useState('library')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [alt, setAlt] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

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
        const text = errorMessage(requestError, 'Không thể tải kho hình ảnh. Vui lòng thử lại.')
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
  }, [open])

  const choose = (item) => {
    setSelected(item)
    setAlt(item.alt || defaultAlt(item.original_name || item.name))
  }

  const upload = async (file) => {
    if (!onUploadImage) return Upload.LIST_IGNORE
    if (!ACCEPTED_IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_SIZE) {
      const text = 'Chỉ hỗ trợ JPG, PNG, GIF hoặc WebP tối đa 5 MB.'
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
      message.success('Đã tải ảnh lên kho hình ảnh.')
    } catch (uploadError) {
      const text = errorMessage(uploadError, 'Không thể tải ảnh. Chỉ hỗ trợ JPG, PNG, GIF hoặc WebP tối đa 5 MB.')
      setError(text)
      message.error(text)
    } finally {
      setUploading(false)
    }
    return Upload.LIST_IGNORE
  }

  const insert = () => {
    if (!selected?.url) return
    onInsert({ src: selected.url, alt: alt.trim() || defaultAlt(selected.original_name) })
    onCancel()
  }

  const library = (
    <div className="rich-image-library">
      <Input
        allowClear
        aria-label="Tìm trong kho hình ảnh"
        prefix={<SearchOutlined />}
        placeholder="Tìm theo tên hình ảnh…"
        size="large"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {error && <Alert className="mt-4" type="error" showIcon message={error} action={<Button size="small" onClick={() => setReloadKey((current) => current + 1)}>Thử lại</Button>} />}
      {loading ? (
        <div className="rich-image-library__skeleton"><Skeleton.Image active /><Skeleton.Image active /><Skeleton.Image active /></div>
      ) : items.length ? (
        <div className="rich-image-library__grid" role="listbox" aria-label="Kho hình ảnh">
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
        <Empty className="py-10" image={Empty.PRESENTED_IMAGE_SIMPLE} description={query ? 'Không tìm thấy hình ảnh phù hợp' : 'Kho hình ảnh chưa có dữ liệu'} />
      )}
    </div>
  )

  const uploader = (
    <div>
      {error && <Alert className="mb-4" type="error" showIcon message={error} />}
      <Upload.Dragger
        accept="image/jpeg,image/png,image/gif,image/webp"
        beforeUpload={upload}
        disabled={uploading}
        multiple={false}
        showUploadList={false}
      >
        <p className="ant-upload-drag-icon"><CloudUploadOutlined /></p>
        <p className="ant-upload-text">Kéo thả ảnh vào đây hoặc bấm để chọn</p>
        <p className="ant-upload-hint">JPG, PNG, GIF, WebP · tối đa 5 MB · ảnh lớn tự thu về tối đa 1600 px</p>
        {uploading && <Button className="mt-4" loading>Đang tải ảnh…</Button>}
      </Upload.Dragger>
    </div>
  )

  return (
    <Modal
      className="rich-image-library-modal"
      width={900}
      open={open}
      title={<span><FileImageOutlined className="mr-2" />Chèn hình ảnh</span>}
      okText="Chèn vào bài viết"
      cancelText="Hủy"
      okButtonProps={{ disabled: !selected?.url }}
      onCancel={onCancel}
      onOk={insert}
    >
      <Tabs
        activeKey={activeTab}
        onChange={(key) => { setActiveTab(key); setError('') }}
        items={[
          { key: 'library', label: 'Kho hình ảnh', children: library },
          { key: 'upload', label: 'Tải ảnh mới', children: uploader },
        ]}
      />
      {selected && (
        <div className="rich-image-library__selection">
          <img src={selected.url} alt="" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">{selected.original_name || selected.name}</p>
            <label className="mt-2 block text-xs font-medium text-slate-600" htmlFor="rich-image-alt">Mô tả ảnh (alt text)</label>
            <Input id="rich-image-alt" className="mt-1" value={alt} maxLength={255} onChange={(event) => setAlt(event.target.value)} placeholder="Mô tả ngắn nội dung ảnh" />
          </div>
        </div>
      )}
    </Modal>
  )
}
