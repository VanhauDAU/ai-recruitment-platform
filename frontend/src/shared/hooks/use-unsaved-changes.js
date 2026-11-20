import { useEffect } from 'react'
import { registerUnsavedChanges } from '@/shared/lib/unsaved-changes'

/** Báo cho trang biết form đang có thay đổi chưa lưu (xem shared/lib/unsaved-changes). */
export function useUnsavedChanges(isDirty) {
  useEffect(() => (isDirty ? registerUnsavedChanges(() => true) : undefined), [isDirty])
}
