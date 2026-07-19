import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntApp, ConfigProvider } from 'antd'
import { useMemo } from 'react'
import { SessionProvider } from '@/entities/session'
import { DEFAULT_SITE_SETTINGS, settingText, SiteSettingsProvider, useSiteSettings } from '@/entities/site-settings'
import { ConsentProvider } from '@/entities/consent'
import ToastSoundEffect from '@/shared/ui/ToastSoundEffect'

function ThemedProviders({ children }) {
  const { settings } = useSiteSettings()
  const primaryColor = settingText(settings.brand_primary_color, DEFAULT_SITE_SETTINGS.brand_primary_color)
  const theme = useMemo(() => ({
    token: {
      colorPrimary: primaryColor,
      borderRadius: 8,
      fontFamily: 'Inter, system-ui, sans-serif',
    },
  }), [primaryColor])

  return (
    <ConfigProvider theme={theme}>
      <AntApp
        message={{
          maxCount: 1,
          duration: 3.5,
          top: 20,
          className: 'app-toast',
          classNames: { list: 'app-toast-list' },
        }}
      >
        <ConsentProvider>
          <ToastSoundEffect />
          <SessionProvider>{children}</SessionProvider>
        </ConsentProvider>
      </AntApp>
    </ConfigProvider>
  )
}

// Server-state mặc định mô phỏng hành vi fetch tay hiện có: không refetch khi
// focus lại tab, retry 1 lần, dữ liệu tươi trong 30s để dedupe giữa các mount.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// Điểm tập trung của provider tree. BrowserRouter ở App.jsx vì SessionProvider
// dùng navigation, còn mọi provider ứng dụng được giữ ở đây.
export default function AppProviders({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SiteSettingsProvider>
        <ThemedProviders>{children}</ThemedProviders>
      </SiteSettingsProvider>
    </QueryClientProvider>
  )
}
