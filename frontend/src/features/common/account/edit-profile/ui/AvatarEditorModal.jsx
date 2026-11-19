import { InboxOutlined, UserOutlined } from '@ant-design/icons'
import { Button, Modal, Upload } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useSession } from '@/entities/account/session'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { deleteAvatar, uploadAvatar } from '../api/edit-profile.api'
import {
  AVATAR_ACCEPT, AVATAR_MIN_SIDE, cropToFile, initialCrop, loadImageFile,
  moveCrop, resizeCrop, validateAvatarDimensions, validateAvatarFile,
} from '../model/avatar-crop'
import { m } from '@/shared/config/i18n'

const PREVIEW_SIZE = 176
const HANDLE = 'absolute h-3 w-3 rounded-sm bg-sky-500'
const CORNERS = [
  { key: 'tl', sx: -1, sy: -1, className: `${HANDLE} -left-1.5 -top-1.5 cursor-nwse-resize` },
  { key: 'tr', sx: 1, sy: -1, className: `${HANDLE} -right-1.5 -top-1.5 cursor-nesw-resize` },
  { key: 'bl', sx: -1, sy: 1, className: `${HANDLE} -bottom-1.5 -left-1.5 cursor-nesw-resize` },
  { key: 'br', sx: 1, sy: 1, className: `${HANDLE} -bottom-1.5 -right-1.5 cursor-nwse-resize` },
]

/**
 * "Chỉnh sửa ảnh đại diện": chọn ảnh → kéo/đổi cỡ khung vuông trên ảnh gốc →
 * "Xong" mới cắt và tải lên (hoặc xoá ảnh). "Đóng lại" bỏ mọi thay đổi.
 */
export default function AvatarEditorModal({ open, onClose }) {
  // destroyOnHidden huỷ phần thân nên mỗi lần mở lại bắt đầu từ trạng thái sạch.
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      mask={{ closable: false }}
      destroyOnHidden
      width="min(94vw, 760px)"
      styles={{ container: { padding: 0, overflow: 'hidden' } }}
    >
      <AvatarEditor onClose={onClose} />
    </Modal>
  )
}

function AvatarEditor({ onClose }) {
  const { user, setCurrentUser } = useSession()
  const [source, setSource] = useState(null)
  const [crop, setCrop] = useState(null)
  const [removed, setRemoved] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => () => source && URL.revokeObjectURL(source.url), [source])

  async function pickFile(file) {
    const fileError = validateAvatarFile(file)
    if (fileError) {
      setError(fileError)
      return
    }
    try {
      const loaded = await loadImageFile(file)
      const sizeError = validateAvatarDimensions(loaded.width, loaded.height)
      if (sizeError) {
        URL.revokeObjectURL(loaded.url)
        setError(sizeError)
      } else {
        setSource(loaded)
        setCrop(initialCrop(loaded.width, loaded.height))
        setRemoved(false)
        setError('')
      }
    } catch (loadError) {
      setError(loadError.message)
    }
  }

  // Không để antd tự gửi tệp: chỉ đọc vào khung cắt, "Xong" mới tải lên.
  const beforeUpload = (file) => {
    pickFile(file)
    return false
  }

  function removeImage() {
    setSource(null)
    setCrop(null)
    setRemoved(Boolean(user?.avatar_url))
    setError('')
  }

  async function save() {
    if (!source && !removed) {
      onClose()
      return
    }
    setSaving(true)
    try {
      const updated = source ? await uploadAvatar(await cropToFile(source.image, crop)) : await deleteAvatar()
      setCurrentUser(updated)
      message.success(source ? m.account_avatar_updated() : m.account_avatar_removed())
      onClose()
    } catch (saveError) {
      message.error(getApiErrorMessage(saveError, m.account_avatar_save_failed()))
    } finally {
      setSaving(false)
    }
  }

  const currentUrl = removed ? '' : user?.avatar_url
  const scale = crop ? PREVIEW_SIZE / crop.size : 1

  return (
    <>
      <h2 className="m-0 bg-[var(--brand-primary)] px-5 py-3 text-center text-sm font-bold uppercase text-white">
        {m.account_avatar_title()}
      </h2>
      <div className="grid items-start gap-8 p-5 md:grid-cols-[minmax(0,1fr)_11rem]">
        <div className="min-w-0">
          <p className="mb-3 text-center font-medium text-slate-800">{m.account_avatar_original()}</p>
          {source ? (
            <CropStage source={source} crop={crop} onChange={setCrop} />
          ) : (
            <Upload.Dragger showUploadList={false} accept={AVATAR_ACCEPT} beforeUpload={beforeUpload} disabled={saving} className="!border-emerald-200 !bg-emerald-50/70">
              <p className="ant-upload-drag-icon"><InboxOutlined className="!text-emerald-600" /></p>
              <p className="ant-upload-text">{m.account_avatar_drop()}</p>
              <p className="ant-upload-hint">{m.account_avatar_hint({ min: AVATAR_MIN_SIDE })}</p>
            </Upload.Dragger>
          )}
          {error ? (
            <p role="alert" className="mt-3 text-center text-sm text-red-500">{error}</p>
          ) : source && (
            <p className="mt-3 text-center text-sm text-slate-500">{m.account_avatar_crop_help()}</p>
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          <p className="mb-1 text-center font-medium text-slate-800">{m.account_avatar_preview()}</p>
          <div className="relative h-44 w-44 overflow-hidden rounded-full bg-slate-100 shadow-inner">
            {source ? (
              <img
                src={source.url}
                alt={m.account_avatar_preview_alt()}
                className="absolute"
                style={{
                  maxWidth: 'none',
                  width: source.width * scale,
                  height: source.height * scale,
                  left: -crop.x * scale,
                  top: -crop.y * scale,
                }}
              />
            ) : currentUrl ? (
              <img src={currentUrl} alt={m.account_avatar_current_alt()} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-5xl text-slate-300"><UserOutlined /></span>
            )}
          </div>
          <div className="mt-2 flex gap-2">
            <Upload showUploadList={false} accept={AVATAR_ACCEPT} beforeUpload={beforeUpload} disabled={saving}>
              <Button color="blue" variant="solid" disabled={saving}>{m.account_avatar_change()}</Button>
            </Upload>
            <Button color="danger" variant="solid" disabled={saving || (!source && !currentUrl)} onClick={removeImage}>{m.account_avatar_delete()}</Button>
          </div>
          <Button type="primary" size="large" block loading={saving} onClick={save}>{m.account_avatar_done()}</Button>
          <Button type="link" danger disabled={saving} onClick={onClose}>{m.account_avatar_close()}</Button>
        </div>
      </div>
    </>
  )
}

// Ảnh gốc co theo khung 300px; vùng cắt đặt bằng % nên luôn vuông trên màn hình.
function CropStage({ source, crop, onChange }) {
  const stageRef = useRef(null)
  const gestureRef = useRef(null)
  const { width, height } = source
  const ratio = width / height

  function start(event, corner) {
    event.preventDefault()
    event.stopPropagation()
    const rect = stageRef.current.getBoundingClientRect()
    gestureRef.current = { corner, crop, pointerId: event.pointerId, x: event.clientX, y: event.clientY, factor: width / rect.width }
    stageRef.current.setPointerCapture?.(event.pointerId)
  }

  function move(event) {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const dx = (event.clientX - gesture.x) * gesture.factor
    const dy = (event.clientY - gesture.y) * gesture.factor
    onChange(gesture.corner
      ? resizeCrop(gesture.crop, gesture.corner, dx, dy, width, height)
      : moveCrop(gesture.crop, dx, dy, width, height))
  }

  function end(event) {
    if (gestureRef.current?.pointerId !== event.pointerId) return
    gestureRef.current = null
    stageRef.current?.releasePointerCapture?.(event.pointerId)
  }

  function nudge(event) {
    const step = Math.max(1, Math.round(Math.min(width, height) * (event.shiftKey ? 0.1 : 0.02)))
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key]
    if (!delta) return
    event.preventDefault()
    onChange(moveCrop(crop, delta[0], delta[1], width, height))
  }

  return (
    <div className="flex h-[300px] items-center justify-center overflow-hidden bg-slate-200">
      <div
        ref={stageRef}
        className="relative max-h-[300px] touch-none overflow-hidden"
        style={{ aspectRatio: ratio, width: ratio >= 1 ? `min(100%, ${Math.round(300 * ratio)}px)` : `${Math.round(300 * ratio)}px` }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <img src={source.url} alt={m.account_avatar_original_alt()} draggable={false} className="h-full w-full select-none object-cover" />
        <div
          role="group"
          tabIndex={0}
          aria-label={m.account_avatar_crop_aria({ size: crop.size })}
          className="absolute cursor-move border-2 border-sky-500"
          style={{
            left: `${(crop.x / width) * 100}%`,
            top: `${(crop.y / height) * 100}%`,
            width: `${(crop.size / width) * 100}%`,
            height: `${(crop.size / height) * 100}%`,
            boxShadow: '0 0 0 999px rgb(15 23 42 / 48%)',
          }}
          onPointerDown={(event) => start(event, null)}
          onKeyDown={nudge}
        >
          <span className="absolute left-0 top-0 bg-slate-900/75 px-1.5 py-0.5 text-[11px] font-medium text-emerald-300">{crop.size} × {crop.size}</span>
          {CORNERS.map(({ key, className, ...corner }) => (
            <span key={key} aria-hidden="true" className={className} onPointerDown={(event) => start(event, corner)} />
          ))}
        </div>
      </div>
    </div>
  )
}
