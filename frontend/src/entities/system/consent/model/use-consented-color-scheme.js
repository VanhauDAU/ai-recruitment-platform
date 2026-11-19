import { useEffect, useState } from 'react'
import { useConsent } from './consent-context'

const STORAGE_KEY = 'color-scheme'

export function useConsentedColorScheme() {
  const { consent, status } = useConsent()
  // Không còn lựa chọn đã lưu thì luôn quay về nền sáng. Không tự suy từ
  // giao diện hệ điều hành, để việc xóa `color-scheme` có kết quả rõ ràng.
  const [scheme, setScheme] = useState('light')

  useEffect(() => {
    if (status !== 'ready') return
    if (!consent.preferences) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') setScheme(stored)
  }, [consent.preferences, status])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', scheme === 'dark')
    if (status === 'ready' && consent.preferences) localStorage.setItem(STORAGE_KEY, scheme)
  }, [consent.preferences, scheme, status])

  return [scheme, () => setScheme((current) => (current === 'dark' ? 'light' : 'dark'))]
}
