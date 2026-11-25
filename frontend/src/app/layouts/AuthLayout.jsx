import { CloseOutlined } from '@ant-design/icons'
import { ConfigProvider, theme as antdTheme } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3'
import ThemeToggle from '@/shared/ui/ThemeToggle'
import { useConsentedColorScheme } from '@/entities/system/consent'
import { m } from '@/shared/config/i18n'
import { getCurrentPortal } from '@/shared/config/portals'

export default function AuthLayout() {
  const [scheme, toggleScheme] = useConsentedColorScheme()
  const { pathname } = useLocation()
  const isRegister = pathname.startsWith('/sign-up') || pathname.endsWith('/register')
  const isAdmin = getCurrentPortal() === 'admin'
  const navigate = useNavigate()

  // Về trang trước trong app (AuthGuard dùng replace nên không vòng lại trang cần
  // đăng nhập); vào thẳng từ ngoài thì về trang chủ.
  function goBack() {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1)
    else navigate('/', { replace: true })
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: scheme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          borderRadius: 12,
        },
      }}
    >
      <GoogleReCaptchaProvider reCaptchaKey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}>
        <div
          className="flex min-h-[100dvh] flex-col text-gray-900 dark:text-gray-100"
          style={{ background: '#F7F7F7' }}
        >
          <header className="flex items-center justify-end gap-2 px-6 py-4 lg:px-12">
            <ThemeToggle scheme={scheme} onToggle={toggleScheme} />
            {!isAdmin && (
              <button
                type="button"
                aria-label={m.candidate_auth_close()}
                title={m.candidate_auth_close()}
                onClick={goBack}
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-gray-400"
              >
                <CloseOutlined aria-hidden />
              </button>
            )}
          </header>

          <main
            className="flex flex-1 items-center justify-center px-3 py-6 sm:px-4"
            style={isAdmin && scheme !== 'dark'
              ? { background: 'radial-gradient(circle at 50% 0%, var(--brand-primary-soft) 0%, transparent 38%)' }
              : undefined}
          >
            <div
              className={`relative w-full overflow-visible animate-fade-slide rounded-3xl bg-white px-5 py-8 shadow-[0_4px_32px_rgba(0,0,0,0.07)] dark:bg-zinc-900 dark:shadow-none sm:px-10 sm:py-10 ${
                isRegister ? 'max-w-[680px] sm:px-12' : 'max-w-[680px] sm:px-11'
              } ${isAdmin ? 'border' : ''}`}
              style={isAdmin
                ? {
                    borderColor: scheme === 'dark' ? '#1e293b' : 'var(--brand-primary-soft)',
                    boxShadow: scheme === 'dark'
                      ? 'none'
                      : '0 20px 60px color-mix(in srgb, var(--brand-primary) 10%, transparent)',
                  }
                : undefined}
            >
              <Outlet />
            </div>
          </main>
        </div>
      </GoogleReCaptchaProvider>
    </ConfigProvider>
  )
}
