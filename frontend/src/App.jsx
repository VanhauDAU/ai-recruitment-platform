import { ConfigProvider, App as AntApp } from 'antd'
import { BrowserRouter, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider } from './hooks/useAuth'
import AppRoutes from './routes/AppRoutes'
import SiteSettingsProvider from './components/site/SiteSettingsProvider'

const theme = {
  token: {
    colorPrimary: '#00b14f',
    borderRadius: 8,
    fontFamily: 'Inter, system-ui, sans-serif',
  },
}

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

function App() {
  return (
    <ConfigProvider theme={theme}>
      <AntApp>
        <BrowserRouter>
          <SiteSettingsProvider>
            <AuthProvider>
              <ScrollRestorationGuard />
              <AppRoutes />
            </AuthProvider>
          </SiteSettingsProvider>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  )
}

export default App
