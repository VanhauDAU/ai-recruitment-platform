import { App as AntApp, ConfigProvider } from 'antd'
import { useMemo } from 'react'
import { AuthProvider } from '@/features/auth'
import { DEFAULT_SITE_SETTINGS, settingText, SiteSettingsProvider, useSiteSettings } from '@/entities/site-settings'

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
      <AntApp>
        <AuthProvider>{children}</AuthProvider>
      </AntApp>
    </ConfigProvider>
  )
}

// Điểm tập trung của provider tree. BrowserRouter ở App.jsx vì AuthProvider
// dùng navigation, còn mọi provider ứng dụng được giữ ở đây.
export default function AppProviders({ children }) {
  return (
    <SiteSettingsProvider>
      <ThemedProviders>{children}</ThemedProviders>
    </SiteSettingsProvider>
  )
}
