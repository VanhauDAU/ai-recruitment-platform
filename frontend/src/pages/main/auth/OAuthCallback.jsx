import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import {
  completeOAuth,
  getAuthDestination,
  getSafeReturnUrl,
  relayOAuthResult,
  withReturnUrl,
} from '@/features/common/account/auth'
import { useSession } from '@/entities/account/session'
import { toastSoundOptions } from '@/shared/lib/sound-effects'
import { message } from '@/shared/lib/toast'
import PageLoading from '@/shared/ui/PageLoading'

/**
 * Trang backend redirect về sau OAuth: đổi one_time_code lấy JWT rồi điều hướng.
 * Lỗi (user huỷ, state hết hạn, sai cổng...) -> quay về trang đăng nhập của cổng
 * kèm ?oauth_error= để LoginForm hiển thị thông báo trong form.
 * Chế độ popup (`?popup=1&nonce=`): chuyển kết quả cho cửa sổ gốc rồi tự đóng;
 * cửa sổ gốc không xác nhận (đã đóng/chuyển trang) thì xử lý ngay tại popup.
 */
export default function OAuthCallback({ portal = 'main', loginPath = '/dang-nhap' }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { setCurrentUser } = useSession()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return // StrictMode chạy effect 2 lần — one_time_code chỉ dùng được 1 lần
    ran.current = true

    const error = params.get('error')
    const code = params.get('code')
    const nonce = params.get('nonce')
    const next = getSafeReturnUrl(params.get('next'))

    function finishHere() {
      if (error || !code) {
        const loginTarget = withReturnUrl(loginPath, next)
        navigate(`${loginTarget}${loginTarget.includes('?') ? '&' : '?'}oauth_error=${encodeURIComponent(error || 'invalid_code')}`, { replace: true })
        return
      }

      completeOAuth(code, portal)
        .then((result) => {
          const { user } = result
          setCurrentUser(user)
          message.success('Đăng nhập thành công.', toastSoundOptions('done'))
          navigate(getAuthDestination({ user, returnUrl: next }), { replace: true })
        })
        .catch(() => {
          const loginTarget = withReturnUrl(loginPath, next)
          navigate(`${loginTarget}${loginTarget.includes('?') ? '&' : '?'}oauth_error=complete_failed`, { replace: true })
        })
    }

    if (params.get('popup') !== '1' || !nonce) {
      finishHere()
      return
    }
    relayOAuthResult({ nonce, code, error, next }).then((acked) => {
      if (!acked) {
        finishHere()
        return
      }
      window.close()
      // Trình duyệt không cho đóng: cửa sổ gốc đã nhận code, popup chỉ rời trang chờ.
      navigate(next || loginPath, { replace: true })
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <PageLoading />
}
