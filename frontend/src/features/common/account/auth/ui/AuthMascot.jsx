import { MASCOT_FRAME_GRIP, ProcvMascot } from '@/shared/ui/mascot'
import './auth-mascot.css'
import { m } from '@/shared/config/i18n'

function mascotState({ activeField, error, invalid, loading, passwordVisible, success }) {
  if (activeField === 'password') {
    return passwordVisible
      ? { emotion: 'happy', message: m.account_auth_mascot_peek(), pose: 'peek' }
      : { emotion: 'neutral', message: m.account_auth_mascot_cover(), pose: 'coverEyes' }
  }
  if (activeField === 'email') {
    return { blink: true, gaze: 'down', message: m.account_auth_mascot_email(), pose: 'frameGrip' }
  }
  if (loading) return { emotion: 'thinking', message: m.account_auth_mascot_loading(), pose: 'frameGrip' }
  if (invalid) return { blink: true, emotion: 'error', message: m.account_auth_mascot_invalid(), pose: 'frameGrip' }
  if (error) return { blink: true, emotion: 'error', message: m.account_auth_mascot_error(), pose: 'frameGrip' }
  if (success) return { blink: true, emotion: 'success', message: m.account_auth_mascot_success(), pose: 'thumbsUp' }
  return { blink: true, emotion: 'happy', message: m.account_auth_mascot_idle(), pose: 'frameGrip' }
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
