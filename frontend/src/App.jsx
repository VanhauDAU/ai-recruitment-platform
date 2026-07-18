import { BrowserRouter, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import AppProviders from './app/providers/AppProviders'
import AppRouter from './app/router/AppRouter'
import DocumentTitleManager from './app/router/DocumentTitleManager'
import { CookieConsentLayer } from '@/widgets/cookie-consent-layer'

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
    <BrowserRouter>
      <AppProviders>
        <ScrollRestorationGuard />
        <DocumentTitleManager />
        <AppRouter />
        <CookieConsentLayer />
      </AppProviders>
    </BrowserRouter>
  )
}

export default App
