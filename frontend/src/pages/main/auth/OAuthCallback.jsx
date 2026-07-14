import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { completeOAuth, getAuthDestination, getSafeReturnUrl, withReturnUrl } from '@/features/auth'
import { useSession } from '@/entities/session'
import PageLoading from '@/shared/ui/PageLoading'

/**
 * Trang backend redirect về sau OAuth: đổi one_time_code lấy JWT rồi điều hướng.
 * Lỗi (user huỷ, state hết hạn, sai cổng...) -> quay về trang đăng nhập của cổng
 * kèm ?oauth_error= để LoginForm hiển thị thông báo trong form.
 */
export default function OAuthCallback({ portal = 'main', loginPath = '/login' }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { setCurrentUser } = useSession()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return // StrictMode chạy effect 2 lần — one_time_code chỉ dùng được 1 lần
    ran.current = true

    const error = params.get('error')
    const code = params.get('code')
    const next = getSafeReturnUrl(params.get('next'))
    if (error || !code) {
      const loginTarget = withReturnUrl(loginPath, next)
      navigate(`${loginTarget}${loginTarget.includes('?') ? '&' : '?'}oauth_error=${encodeURIComponent(error || 'invalid_code')}`, { replace: true })
      return
    }

    completeOAuth(code, portal)
      .then((result) => {
        const { user } = result
        setCurrentUser(user)
        const safeNext = getSafeReturnUrl(params.get('next'))
        navigate(getAuthDestination({ user, returnUrl: safeNext }), { replace: true })
      })
      .catch(() => {
        const loginTarget = withReturnUrl(loginPath, next)
        navigate(`${loginTarget}${loginTarget.includes('?') ? '&' : '?'}oauth_error=complete_failed`, { replace: true })
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <PageLoading />
}
