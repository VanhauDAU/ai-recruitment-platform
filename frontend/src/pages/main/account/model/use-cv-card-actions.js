import { message } from 'antd'
import { useEffect, useState } from 'react'
import { createCvSharedLink, deleteCv, duplicateCv, renameCv, setDefaultCv } from '@/entities/cv'

// Sở hữu state hiển thị (tên, CV chính) và toàn bộ hành động của một thẻ CV.
export function useCvCardActions(cv, onRefresh) {
  const [isMainCv, setIsMainCv] = useState(cv.is_default || false)
  const [title, setTitle] = useState(cv.title || '')
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [newTitle, setNewTitle] = useState(cv.title || '')
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false)

  // Đồng bộ lại khi danh sách bên ngoài refresh và truyền cv mới xuống.
  useEffect(() => {
    setIsMainCv(cv.is_default || false)
    setTitle(cv.title || '')
    setNewTitle(cv.title || '')
  }, [cv])

  const toggleMain = async () => {
    const nextState = !isMainCv
    try {
      await setDefaultCv(cv.public_id, nextState)
      setIsMainCv(nextState)
      message.success(nextState ? 'Đã đặt CV này làm CV chính.' : 'Đã bỏ đặt CV này làm CV chính.')
      onRefresh?.()
    } catch {
      message.error('Không thể cập nhật trạng thái CV chính.')
    }
  }

  const buildShareUrl = async () => {
    const { token } = await createCvSharedLink(cv.public_id)
    return `${window.location.origin}/cv/share/${token}`
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(await buildShareUrl())
      message.success('Đã sao chép liên kết chia sẻ CV.')
    } catch {
      message.error('Không thể tạo liên kết chia sẻ.')
    }
  }

  const shareFacebook = async () => {
    try {
      const shareUrl = await buildShareUrl()
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank', 'noopener,noreferrer')
    } catch {
      message.error('Không thể tạo liên kết chia sẻ.')
    }
  }

  const duplicate = async () => {
    try {
      await duplicateCv(cv.public_id, `${title} (Bản sao)`)
      message.success('Tạo bản sao CV thành công.')
      onRefresh?.()
    } catch {
      message.error('Không thể tạo bản sao CV.')
    }
  }

  const openRename = () => {
    setNewTitle(title)
    setIsRenameOpen(true)
  }

  const submitRename = async () => {
    if (!newTitle.trim()) {
      message.warning('Vui lòng nhập tên CV.')
      return
    }
    try {
      const updated = await renameCv(cv.public_id, newTitle.trim())
      setTitle(updated.title)
      message.success('Đổi tên CV thành công.')
      setIsRenameOpen(false)
      onRefresh?.()
    } catch {
      message.error('Không thể đổi tên CV.')
    }
  }

  const deletePermanently = async () => {
    try {
      await deleteCv(cv.public_id)
      message.success('Đã xóa vĩnh viễn CV.')
      onRefresh?.()
    } catch {
      message.error('Không thể xóa CV.')
    } finally {
      setIsDeleteConfirmationOpen(false)
    }
  }

  return {
    isMainCv,
    setIsMainCv,
    title,
    toggleMain,
    copyLink,
    shareFacebook,
    duplicate,
    deleteConfirmation: {
      open: isDeleteConfirmationOpen,
      show: () => setIsDeleteConfirmationOpen(true),
      close: () => setIsDeleteConfirmationOpen(false),
      submit: deletePermanently,
    },
    rename: {
      open: isRenameOpen,
      value: newTitle,
      setValue: setNewTitle,
      show: openRename,
      close: () => setIsRenameOpen(false),
      submit: submitRename,
    },
  }
}
