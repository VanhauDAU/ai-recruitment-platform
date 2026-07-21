// Chặn mất dữ liệu khi người dùng rời trang soạn CV: cảnh báo reload/đóng tab,
// flush + lưu trước khi điều hướng nội bộ, và lưu khi tab bị ẩn.
// Tách khỏi use-cv-draft-editor vì đây là mối quan tâm về browser event, không
// phải nghiệp vụ CV — và cần test riêng được.
import { useEffect } from 'react'

export function useUnsavedChangesGuard({
  documentRef,
  lastSavedSignatureRef,
  phaseRef,
  signature,
  flushPendingEdits,
  runAutosave,
}) {
  useEffect(() => {
    const hasUnsavedChanges = () => {
      const documentChanged = documentRef.current && signature(documentRef.current) !== lastSavedSignatureRef.current
      return documentChanged || ['saving', 'failed', 'conflict'].includes(phaseRef.current)
    }
    const warnBeforeUnload = (event) => {
      flushPendingEdits()
      if (!hasUnsavedChanges()) return
      event.preventDefault()
      event.returnValue = ''
    }
    const flushInternalNavigation = (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = event.target.closest?.('a[href]')
      if (!link || link.target || link.download) return
      const destination = new URL(link.href, window.location.href)
      if (destination.origin !== window.location.origin || destination.href === window.location.href) return
      flushPendingEdits()
      if (!hasUnsavedChanges()) return
      event.preventDefault()
      runAutosave().then((saved) => {
        if (saved) window.location.assign(destination.href)
      })
    }
    const flushWhenHidden = () => {
      if (globalThis.document.visibilityState === 'hidden') {
        flushPendingEdits()
        if (hasUnsavedChanges()) runAutosave()
      }
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    globalThis.document.addEventListener('click', flushInternalNavigation, true)
    globalThis.document.addEventListener('visibilitychange', flushWhenHidden)
    return () => {
      window.removeEventListener('beforeunload', warnBeforeUnload)
      globalThis.document.removeEventListener('click', flushInternalNavigation, true)
      globalThis.document.removeEventListener('visibilitychange', flushWhenHidden)
    }
  }, [documentRef, lastSavedSignatureRef, phaseRef, signature, flushPendingEdits, runAutosave])
}
