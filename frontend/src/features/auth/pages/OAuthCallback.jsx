import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { completeOAuth } from '../api/authService'
import PageLoading from '@/components/ui/PageLoading'
import { HOME_BY_ROLE } from '@/config/portals'
import { useAuth } from '../model/useAuth'
import { resendTwoFactorLogin, TwoFactorCodeModal } from '@/features/two-factor'

/**
 * Trang backend redirect về sau OAuth: đổi one_time_code lấy JWT rồi điều hướng.
 * Lỗi (user huỷ, state hết hạn, sai cổng...) -> quay về trang đăng nhập của cổng
 * kèm ?oauth_error= để LoginForm hiển thị thông báo trong form.
 */
export default function OAuthCallback({ portal = 'main', loginPath = '/login' }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { setAuthenticatedUser, completeTwoFactorLogin } = useAuth()
  const ran = useRef(false)
  const [twoFactorChallenge, setTwoFactorChallenge] = useState(null)

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
      .then((result) => {
        if (result.two_factor_required) {
          setTwoFactorChallenge({ ...result, portal })
          return
        }
        const { user } = result
        setAuthenticatedUser(user)
        const next = params.get('next')
        const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : ''
        navigate(safeNext || HOME_BY_ROLE[user.role] || '/', { replace: true })
      })
      .catch(() => navigate(`${loginPath}?oauth_error=complete_failed`, { replace: true }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmTwoFactor(code) {
    const user = await completeTwoFactorLogin({
      challenge: twoFactorChallenge.challenge,
      code,
      portal: twoFactorChallenge.portal,
    })
    const next = params.get('next')
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : ''
    navigate(safeNext || HOME_BY_ROLE[user.role] || '/', { replace: true })
  }

  return <>
    <PageLoading />
    <TwoFactorCodeModal
      open={Boolean(twoFactorChallenge)}
      email={twoFactorChallenge?.email}
      expiresIn={twoFactorChallenge?.expires_in || 180}
      onCancel={() => navigate(loginPath, { replace: true })}
      onConfirm={confirmTwoFactor}
      onResend={() => resendTwoFactorLogin(twoFactorChallenge.challenge)}
    />
  </>
}
