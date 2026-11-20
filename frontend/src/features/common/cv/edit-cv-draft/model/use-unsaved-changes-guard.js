// Chặn mất dữ liệu khi người dùng rời trang soạn CV: cảnh báo reload/đóng tab và
// hỏi xác nhận trước khi điều hướng nội bộ (editor không tự động lưu).
// Tách khỏi use-cv-draft-editor vì đây là mối quan tâm về browser event, không
// phải nghiệp vụ CV — và cần test riêng được.
import { useEffect } from 'react'
import { registerUnsavedChanges } from '@/shared/lib/unsaved-changes'

export function useUnsavedChangesGuard({
  documentRef,
  lastSavedSignatureRef,
  phaseRef,
  signature,
  flushPendingEdits,
}) {
  useEffect(() => {
    const hasUnsavedChanges = () => {
      const documentChanged = documentRef.current && signature(documentRef.current) !== lastSavedSignatureRef.current
      return documentChanged || ['saving', 'failed', 'conflict'].includes(phaseRef.current)
    }
    const flushInternalNavigation = (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = event.target.closest?.('a[href]')
      if (!link || link.target || link.download) return
      const destination = new URL(link.href, window.location.href)
      if (destination.origin !== window.location.origin || destination.href === window.location.href) return
      flushPendingEdits()
      if (!hasUnsavedChanges()) return
      if (!window.confirm('CV có thay đổi chưa lưu. Rời trang mà không lưu?')) event.preventDefault()
    }
    // Cảnh báo tải lại/đóng tab (và đổi ngôn ngữ) đi qua sổ đăng ký dùng chung.
    const unregister = registerUnsavedChanges(() => {
      flushPendingEdits()
      return hasUnsavedChanges()
    })
    globalThis.document.addEventListener('click', flushInternalNavigation, true)
    return () => {
      unregister()
      globalThis.document.removeEventListener('click', flushInternalNavigation, true)
    }
  }, [documentRef, lastSavedSignatureRef, phaseRef, signature, flushPendingEdits])
}
