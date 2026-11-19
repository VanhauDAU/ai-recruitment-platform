import { Modal, Skeleton } from 'antd'
import { Suspense, lazy, useCallback, useMemo, useRef, useState } from 'react'
import LoginPromptContext from './login-prompt-context'

// Lazy để reCAPTCHA + form đăng nhập không nằm trong bundle chính (chỉ nạp khi
// mở popup), giữ mọi trang cổng ứng viên nhẹ.
const LazyLoginModalContent = lazy(() => import('../ui/LoginModalContent'))

/**
 * Popup đăng nhập dùng chung cho cả cổng ứng viên: bất kỳ hành động nào cần
 * đăng nhập (lưu tin, ứng tuyển, lưu bộ lọc...) gọi `promptLogin()` để mở modal
 * ngay tại trang, thay vì điều hướng sang /login và mất ngữ cảnh.
 *
 * `promptLogin(onSuccess?)`: onSuccess chạy sau khi đăng nhập thành công (vd. lưu
 * lại bộ lọc vừa bấm). reCAPTCHA chỉ nạp khi modal mở (destroyOnHidden).
 */
export default function LoginPromptProvider({ children }) {
  const [open, setOpen] = useState(false)
  const successRef = useRef(null)

  const promptLogin = useCallback((onSuccess) => {
    successRef.current = typeof onSuccess === 'function' ? onSuccess : null
    setOpen(true)
  }, [])

  const close = useCallback(() => {
    successRef.current = null
    setOpen(false)
  }, [])

  const handleSuccess = useCallback(() => {
    const callback = successRef.current
    successRef.current = null
    setOpen(false)
    callback?.()
  }, [])

  const value = useMemo(() => ({ promptLogin }), [promptLogin])

  return (
    <LoginPromptContext.Provider value={value}>
      {children}
      <Modal
        open={open}
        onCancel={close}
        footer={null}
        centered
        width={640}
        destroyOnHidden
        styles={{
          container: { borderRadius: 28, padding: 0, overflow: 'hidden' },
          body: { padding: '40px 48px 36px' },
        }}
      >
        <Suspense fallback={<Skeleton active paragraph={{ rows: 6 }} />}>
          <LazyLoginModalContent onSuccess={handleSuccess} />
        </Suspense>
      </Modal>
    </LoginPromptContext.Provider>
  )
}
