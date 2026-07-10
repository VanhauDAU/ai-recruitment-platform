import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { completeOAuth } from '../../../api/authService'
import PageLoading from '../../../components/ui/PageLoading'
import { HOME_BY_ROLE } from '../../../config/portals'
import { useAuth } from '../../../hooks/useAuth'

/**
 * Trang backend redirect về sau OAuth: đổi one_time_code lấy JWT rồi điều hướng.
 * Lỗi (user huỷ, state hết hạn, sai cổng...) -> quay về trang đăng nhập của cổng
 * kèm ?oauth_error= để LoginForm hiển thị thông báo trong form.
 */
export default function OAuthCallback({ portal = 'main', loginPath = '/login' }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return // StrictMode chạy effect 2 lần — one_time_code chỉ dùng được 1 lần
    ran.current = true

    const error = params.get('error')
    const code = params.get('code')
    if (error || !code) {
      navigate(`${loginPath}?oauth_error=${encodeURIComponent(error || 'invalid_code')}`, { replace: true })
      return
    }

    completeOAuth(code, portal)
      .then(async ({ user }) => {
        await refreshUser()
        const next = params.get('next')
        const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : ''
        navigate(safeNext || HOME_BY_ROLE[user.role] || '/', { replace: true })
      })
      .catch(() => navigate(`${loginPath}?oauth_error=complete_failed`, { replace: true }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <PageLoading />
}
