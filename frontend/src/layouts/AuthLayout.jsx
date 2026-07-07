import { ConfigProvider, theme as antdTheme } from 'antd'
import { Link, Outlet } from 'react-router-dom'
import AuthBrandPanel from '../components/auth/AuthBrandPanel'
import ThemeToggle from '../components/ui/ThemeToggle'
import { useColorScheme } from '../hooks/useColorScheme'

// Scoped to auth pages only: slightly softer radius than the app default (8px),
// plus the dark algorithm when the user toggles dark mode. Does not affect
// dashboard/admin screens, which keep the global ConfigProvider token in App.jsx.
export default function AuthLayout() {
  const [scheme, toggleScheme] = useColorScheme()

  return (
    <ConfigProvider
      theme={{
        algorithm: scheme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: { borderRadius: 12 },
      }}
    >
      <div className="grid min-h-[100dvh] bg-white text-gray-900 lg:grid-cols-2 dark:bg-zinc-950 dark:text-gray-100">
        <AuthBrandPanel />

        <div className="flex flex-col">
          <div className="flex items-center justify-between px-6 py-5 lg:px-10">
            <Link to="/" className="text-lg font-bold">
              AI Career <span className="text-[#00b14f]">Coach</span>
            </Link>
            <ThemeToggle scheme={scheme} onToggle={toggleScheme} />
          </div>

          <div className="flex flex-1 items-center justify-center px-6 pb-16 lg:px-10">
            <div className="w-full max-w-sm animate-fade-slide">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </ConfigProvider>
  )
}
