import { ConfigProvider, App as AntApp } from 'antd'
import { BrowserRouter, useLocation } from 'react-router-dom'
import { useEffect, useMemo } from 'react'
import AuthProvider from './contexts/AuthProvider'
import AppRoutes from './routes/AppRoutes'
import SiteSettingsProvider from './components/site/SiteSettingsProvider'
import { DEFAULT_SITE_SETTINGS } from './contexts/siteSettingsContext'
import { settingText, useSiteSettings } from './hooks/useSiteSettings'

function ScrollRestorationGuard() {
  const { pathname, search } = useLocation()

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname, search])

  return null
}

function ThemedApp() {
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
        <AuthProvider>
          <ScrollRestorationGuard />
          <AppRoutes />
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  )
}

function App() {
  return (
    <BrowserRouter>
      <SiteSettingsProvider>
        <ThemedApp />
      </SiteSettingsProvider>
    </BrowserRouter>
  )
}

export default App
