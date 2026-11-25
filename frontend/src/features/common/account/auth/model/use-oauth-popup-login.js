import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useSession } from '@/entities/account/session'
import { getOAuthErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { toastSoundOptions } from '@/shared/lib/sound-effects'
import { message } from '@/shared/lib/toast'
import { completeOAuth } from '../api/auth.api'
import { getAuthDestination } from './password-login-destination'
import { getSafeReturnUrl } from './return-url'
import { canUseOAuthPopup, createOAuthNonce, OAUTH_POPUP_CHANNEL, openOAuthPopup } from './oauth-popup'

/**
 * Cửa sổ gốc của luồng OAuth popup. `start(buildUrl)` trả false khi không dùng
 * được popup (mobile, bị chặn) để nơi gọi chuyển trang như cũ.
 * `onSuccess(user)` (modal đăng nhập) thay cho điều hướng tới trang đích.
 */
export default function useOAuthPopupLogin({ portal, onSuccess }) {
  const navigate = useNavigate()
  const { setCurrentUser } = useSession()
  const [pending, setPending] = useState(false)
  const flowRef = useRef(null)

  const endFlow = useCallback(() => {
    if (!flowRef.current) return
    flowRef.current.channel.close()
    clearInterval(flowRef.current.watch)
    flowRef.current = null
  }, [])
  useEffect(() => endFlow, [endFlow])

  async function finish({ code, error, next }) {
    endFlow()
    if (error || !code) {
      setPending(false)
      message.error(getOAuthErrorMessage(error || 'invalid_code'))
      return
    }
    setPending(true)
    try {
      const { user } = await completeOAuth(code, portal)
      setCurrentUser(user)
      message.success(m.account_auth_login_success(), toastSoundOptions('done'))
      if (onSuccess) onSuccess(user)
      else navigate(getAuthDestination({ user, returnUrl: getSafeReturnUrl(next) }), { replace: true })
    } catch {
      message.error(getOAuthErrorMessage('complete_failed'))
    } finally {
      setPending(false)
    }
  }

  function start(buildUrl) {
    if (!canUseOAuthPopup()) return false
    const nonce = createOAuthNonce()
    const popup = openOAuthPopup(buildUrl(nonce))
    if (!popup) return false

    endFlow()
    const channel = new BroadcastChannel(OAUTH_POPUP_CHANNEL)
    channel.onmessage = ({ data }) => {
      if (data?.type !== 'result' || data.nonce !== nonce) return
      channel.postMessage({ type: 'ack', nonce })
      finish(data)
    }
    // Chỉ tắt trạng thái chờ, vẫn nghe tiếp: COOP có thể khiến `closed` báo true
    // ngay khi popup sang trang provider dù cửa sổ vẫn mở.
    const watch = setInterval(() => {
      if (!popup.closed) return
      clearInterval(watch)
      setPending(false)
    }, 500)
    flowRef.current = { channel, watch }
    setPending(true)
    return true
  }

  return { pending, start }
}
