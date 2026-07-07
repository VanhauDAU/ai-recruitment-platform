import { ConfigProvider, theme as antdTheme } from 'antd'
import { Outlet } from 'react-router-dom'
import ThemeToggle from '../components/ui/ThemeToggle'
import { useColorScheme } from '../hooks/useColorScheme'

export default function AuthLayout() {
  const [scheme, toggleScheme] = useColorScheme()

  return (
    <ConfigProvider
      theme={{
        algorithm: scheme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: { borderRadius: 12 },
      }}
    >
      {/* Nền toàn trang — flex-col để main chiếm phần còn lại */}
      <div
        className="flex min-h-[100dvh] flex-col text-gray-900 dark:text-gray-100"
        style={{ background: '#F7F7F7' }}
      >
        {/* Thanh trên: ThemeToggle */}
        <header className="flex justify-end px-6 py-4 lg:px-12">
          <ThemeToggle scheme={scheme} onToggle={toggleScheme} />
        </header>

        {/* Vùng giữa trang — chiếm hết chiều cao còn lại và căn giữa */}
        <main className="flex flex-1 items-center justify-center px-4 py-8">
          {/* Container form — nền trắng, bo tròn */}
          <div
            className="w-full max-w-[560px] animate-fade-slide rounded-3xl bg-white shadow-[0_4px_32px_rgba(0,0,0,0.07)] dark:bg-zinc-900 dark:shadow-none"
            style={{ padding: '2.5rem 2.75rem' }}
          >
            <Outlet />
          </div>
        </main>
      </div>
    </ConfigProvider>
  )
}
