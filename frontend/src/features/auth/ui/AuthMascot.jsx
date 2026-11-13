import { MASCOT_FRAME_GRIP, ProcvMascot } from '@/shared/ui/mascot'
import './auth-mascot.css'

function mascotState({ activeField, error, invalid, loading, passwordVisible, success }) {
  if (activeField === 'password') {
    return passwordVisible
      ? { emotion: 'happy', message: 'Mình chỉ hé một mắt thôi nhé!', pose: 'peek' }
      : { emotion: 'neutral', message: 'Yên tâm, mình không nhìn đâu!', pose: 'coverEyes' }
  }
  if (activeField === 'email') {
    return { blink: true, gaze: 'down', message: 'Mình đang theo dõi để hỗ trợ bạn.', pose: 'frameGrip' }
  }
  if (loading) return { emotion: 'thinking', message: 'Mình đang kiểm tra thông tin...', pose: 'frameGrip' }
  if (invalid) return { blink: true, emotion: 'error', message: 'Thông tin chưa hợp lệ, kiểm tra lại nhé!', pose: 'frameGrip' }
  if (error) return { blink: true, emotion: 'error', message: 'Có chút trục trặc, mình thử lại nhé!', pose: 'frameGrip' }
  if (success) return { blink: true, emotion: 'success', message: 'Tuyệt! Thông tin đã sẵn sàng.', pose: 'thumbsUp' }
  return { blink: true, emotion: 'happy', message: 'Xin chào! Mình là trợ lý ProCV.', pose: 'frameGrip' }
}

export default function AuthMascot({
  activeField = null,
  error = false,
  invalid = false,
  loading = false,
  passwordVisible = false,
  success = false,
}) {
  const state = mascotState({ activeField, error, invalid, loading, passwordVisible, success })

  return (
    <div className="auth-mascot-stage" data-state={activeField || (loading ? 'loading' : invalid ? 'invalid' : error ? 'error' : success ? 'success' : 'idle')}>
      <span className="auth-mascot-stage__halo" aria-hidden="true" />
      <ProcvMascot
        blink={state.blink}
        className="auth-mascot-stage__robot"
        emotion={state.emotion}
        gaze={state.gaze}
        pose={state.pose}
        shadow="floating"
        size={142}
      />
      {state.pose === 'frameGrip' && (
        <img
          alt=""
          aria-hidden="true"
          className="auth-mascot-stage__grip"
          draggable="false"
          src={MASCOT_FRAME_GRIP}
        />
      )}
      <span className="auth-mascot-stage__message" role="status" aria-live="polite">
        {state.message}
      </span>
    </div>
  )
}
