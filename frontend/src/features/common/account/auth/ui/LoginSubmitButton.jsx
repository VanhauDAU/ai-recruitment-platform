import { ArrowRightOutlined } from '@ant-design/icons'
import { m } from '@/shared/config/i18n'

function LoginButtonLabel() {
  return (
    <>
      {m.account_social_action_login()}
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
        <ArrowRightOutlined className="text-xs" />
      </span>
    </>
  )
}

export default function LoginSubmitButton({ loading, employerAppearance }) {
  return (
    <button
      type="submit"
      disabled={loading}
      aria-busy={loading}
      aria-label={loading ? m.account_auth_signing_in() : m.account_social_action_login()}
      data-testid="login-submit"
      className={`submit-btn flex w-full cursor-pointer items-center justify-center px-6 py-3.5 text-base font-bold text-white disabled:cursor-not-allowed ${employerAppearance ? 'rounded-lg' : 'rounded-full'}`}
    >
      {loading ? (
        <span className="submit-btn__loading">
          <svg
            aria-hidden="true"
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="white"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="white"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          {m.account_auth_signing_in_ellipsis()}
        </span>
      ) : (
        <span aria-hidden="true" className="submit-btn__track">
          <span className="submit-btn__label">
            <LoginButtonLabel />
          </span>
          <span className="submit-btn__label submit-btn__label--clone">
            <LoginButtonLabel />
          </span>
        </span>
      )}
    </button>
  )
}
