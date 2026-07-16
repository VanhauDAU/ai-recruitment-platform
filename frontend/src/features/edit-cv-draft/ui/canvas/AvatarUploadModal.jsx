import { InboxOutlined } from '@ant-design/icons'
import { App, Button, Modal, Upload } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'

const MAX_ZOOM = 3
const MIN_ZOOM = 1
const BASE_CROP_PERCENT = 82

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

function normalizedPosition(value) {
  const rawX = Number(value?.x)
  const rawY = Number(value?.y)
  return {
    x: clamp(Number.isFinite(rawX) ? rawX : 50, 0, 100),
    y: clamp(Number.isFinite(rawY) ? rawY : 50, 0, 100),
  }
}

function normalizedZoom(value) {
  const number = Number(value)
  return clamp(Number.isFinite(number) ? number : 1, MIN_ZOOM, MAX_ZOOM)
}

function cropImageStyle(position, zoom) {
  return {
    objectPosition: `${position.x}% ${position.y}%`,
    transform: `scale(${zoom})`,
    transformOrigin: `${position.x}% ${position.y}%`,
  }
}

function CropEditor({ asset, position, zoom, onPositionChange, onZoomChange }) {
  const containerRef = useRef(null)
  const gestureRef = useRef(null)
  const ratio = asset?.width && asset?.height ? asset.width / asset.height : 4 / 3
  const editorWidth = ratio >= 1 ? `min(100%, ${Math.round(300 * ratio)}px)` : `${Math.round(300 * ratio)}px`
  const cropPercent = BASE_CROP_PERCENT / zoom
  const available = 100 - cropPercent
  const left = (position.x / 100) * available
  const top = (position.y / 100) * available
  const cropPixels = asset?.width && asset?.height
    ? Math.max(1, Math.round(Math.min(asset.width, asset.height) * (cropPercent / 100)))
    : null

  const capturePointer = (event, gesture) => {
    event.preventDefault()
    event.stopPropagation()
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    gestureRef.current = {
      ...gesture,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPosition: position,
      startZoom: zoom,
      startCropPercent: cropPercent,
      width: rect.width,
      height: rect.height,
    }
    container.setPointerCapture(event.pointerId)
  }

  const movePointer = (event) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const deltaX = event.clientX - gesture.startX
    const deltaY = event.clientY - gesture.startY
    if (gesture.type === 'drag') {
      const startAvailable = 100 - gesture.startCropPercent
      if (startAvailable <= 0) return
      const startLeft = (gesture.startPosition.x / 100) * startAvailable
      const startTop = (gesture.startPosition.y / 100) * startAvailable
      const nextLeft = clamp(startLeft + ((deltaX / gesture.width) * 100), 0, startAvailable)
      const nextTop = clamp(startTop + ((deltaY / gesture.height) * 100), 0, startAvailable)
      onPositionChange({
        x: Math.round((nextLeft / startAvailable) * 1000) / 10,
        y: Math.round((nextTop / startAvailable) * 1000) / 10,
      })
      return
    }
    const horizontal = gesture.horizontal === 'left' ? -deltaX : deltaX
    const vertical = gesture.vertical === 'top' ? -deltaY : deltaY
    const outwardDelta = (horizontal + vertical) / 2
    const nextZoom = clamp(gesture.startZoom - (outwardDelta / Math.max(gesture.width, gesture.height)) * 3, MIN_ZOOM, MAX_ZOOM)
    onZoomChange(Math.round(nextZoom * 100) / 100)
  }

  const finishPointer = (event) => {
    if (gestureRef.current?.pointerId !== event.pointerId) return
    gestureRef.current = null
    containerRef.current?.releasePointerCapture?.(event.pointerId)
  }

  const resizeHandles = [
    ['top-left', 'left', 'top', '-left-1.5 -top-1.5 cursor-nwse-resize'],
    ['top-right', 'right', 'top', '-right-1.5 -top-1.5 cursor-nesw-resize'],
    ['bottom-left', 'left', 'bottom', '-bottom-1.5 -left-1.5 cursor-nesw-resize'],
    ['bottom-right', 'right', 'bottom', '-bottom-1.5 -right-1.5 cursor-nwse-resize'],
  ]

  return <div className="flex h-[300px] items-center justify-center overflow-hidden bg-slate-200">
    <div
      ref={containerRef}
      role="group"
      aria-label="Vùng căn chỉnh ảnh đại diện"
      className="relative max-h-[300px] touch-none overflow-hidden"
      style={{
        width: editorWidth,
        aspectRatio: ratio,
        backgroundColor: '#d1d5db',
        backgroundImage: 'linear-gradient(45deg,#9ca3af 25%,transparent 25%),linear-gradient(-45deg,#9ca3af 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#9ca3af 75%),linear-gradient(-45deg,transparent 75%,#9ca3af 75%)',
        backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
        backgroundSize: '16px 16px',
      }}
      onPointerMove={movePointer}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
    >
      <img src={asset.url} alt="Ảnh gốc để căn chỉnh" draggable={false} className="h-full w-full select-none object-cover" />
      <div
        className="absolute cursor-move border-2 border-sky-500"
        style={{
          width: `${cropPercent}%`,
          height: `${cropPercent}%`,
          left: `${left}%`,
          top: `${top}%`,
          boxShadow: '0 0 0 999px rgb(15 23 42 / 48%)',
        }}
        onPointerDown={(event) => capturePointer(event, { type: 'drag' })}
      >
        {cropPixels && <span className="absolute left-0 top-0 bg-slate-900/75 px-1.5 py-0.5 text-[11px] font-medium text-emerald-300">{cropPixels} × {cropPixels}</span>}
        <span className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-sky-500" />
        <span className="absolute bottom-0 left-1/2 h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rounded-sm bg-sky-500" />
        <span className="absolute left-0 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-sky-500" />
        <span className="absolute right-0 top-1/2 h-2.5 w-2.5 translate-x-1/2 -translate-y-1/2 rounded-sm bg-sky-500" />
        {resizeHandles.map(([name, horizontal, vertical, className]) => <button
          key={name}
          type="button"
          aria-label={`Đổi kích thước vùng cắt ${name}`}
          className={`absolute h-3 w-3 rounded-sm bg-sky-500 ${className}`}
          onPointerDown={(event) => capturePointer(event, { type: 'resize', horizontal, vertical })}
        />)}
      </div>
    </div>
  </div>
}

export default function AvatarUploadModal({
  open,
  avatar,
  position,
  zoom,
  onClose,
  onAvatarUpload,
  onComplete,
}) {
  const { message } = App.useApp()
  const [uploaded, setUploaded] = useState(null)
  const [removed, setRemoved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [draftPosition, setDraftPosition] = useState(() => normalizedPosition(position))
  const [draftZoom, setDraftZoom] = useState(() => normalizedZoom(zoom))
  const activeAvatar = removed ? null : (uploaded || avatar)

  useEffect(() => {
    if (!open) {
      setUploaded(null)
      setRemoved(false)
      return
    }
    setDraftPosition(normalizedPosition(position))
    setDraftZoom(normalizedZoom(zoom))
  }, [open, position, zoom])

  const imageUrl = activeAvatar?.url
  const imageStyle = useMemo(() => cropImageStyle(draftPosition, draftZoom), [draftPosition, draftZoom])

  const upload = async (file) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      message.error('Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.')
      return Upload.LIST_IGNORE
    }
    if (file.size > 5 * 1024 * 1024) {
      message.error('Ảnh đại diện không được vượt quá 5 MB.')
      return Upload.LIST_IGNORE
    }
    setUploading(true)
    try {
      const nextAvatar = await onAvatarUpload(file)
      if (nextAvatar) {
        setUploaded(nextAvatar)
        setRemoved(false)
        setDraftPosition({ x: 50, y: 50 })
        setDraftZoom(1)
      }
    } finally {
      setUploading(false)
    }
    return false
  }

  const finish = () => {
    onComplete({
      avatar: uploaded,
      removed,
      position: draftPosition,
      zoom: draftZoom,
    })
    onClose()
  }

  return <Modal open={open} onCancel={onClose} footer={null} width="min(94vw, 760px)" title="Cập nhật ảnh đại diện">
    {imageUrl ? <div className="grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_11rem]">
      <div className="min-w-0">
        <p className="mb-3 text-center font-medium text-slate-800">Ảnh gốc</p>
        <CropEditor asset={activeAvatar} position={draftPosition} zoom={draftZoom} onPositionChange={setDraftPosition} onZoomChange={setDraftZoom} />
        <p className="mt-3 text-center text-sm text-slate-700">Kéo khung để chọn vùng ảnh, kéo các góc để phóng to hoặc thu nhỏ.</p>
        <p className="mt-1 text-center text-sm text-slate-700">Ảnh tải lên không quá 5 MB.</p>
      </div>
      <div className="flex flex-col items-center">
        <p className="mb-3 text-center font-medium text-slate-800">Ảnh hiển thị trên CV</p>
        <div className="h-44 w-44 overflow-hidden rounded-full bg-slate-100 shadow-inner">
          <img src={imageUrl} alt="Xem trước ảnh đại diện" className="h-full w-full object-cover" style={imageStyle} />
        </div>
        <Upload showUploadList={false} accept="image/jpeg,image/png,image/webp" beforeUpload={upload} disabled={uploading}>
          <Button className="mt-3 !border-0 !bg-emerald-50 !text-emerald-600" loading={uploading}>Đổi ảnh</Button>
        </Upload>
        <Button danger className="mt-2 !border-0 !bg-rose-50" onClick={() => { setRemoved(true); setUploaded(null) }}>Xóa ảnh</Button>
      </div>
    </div> : <div className="mx-auto max-w-xl py-4">
      <p className="mb-3 text-center font-medium text-slate-800">Ảnh gốc</p>
      <Upload.Dragger name="avatar" showUploadList={false} accept="image/jpeg,image/png,image/webp" beforeUpload={upload} disabled={uploading} className="!border-emerald-200 !bg-emerald-50/70">
        <p className="ant-upload-drag-icon"><InboxOutlined className="!text-emerald-600" /></p>
        <p className="ant-upload-text">Click hoặc kéo thả ảnh để tải lên</p>
        <p className="ant-upload-hint">JPEG, PNG hoặc WebP · tối đa 5 MB</p>
      </Upload.Dragger>
    </div>}
    <div className="mt-7 flex justify-center gap-4 border-t border-slate-100 pt-5">
      <Button onClick={onClose}>Đóng lại</Button>
      <Button type="primary" onClick={finish} loading={uploading}>Hoàn tất</Button>
    </div>
  </Modal>
}
