import { BrowserRouter, useLocation } from 'react-router'
import { useEffect } from 'react'
import AppProviders from './app/providers/AppProviders'
import AppRouter from './app/router/AppRouter'
import DocumentMetadataManager from './app/router/DocumentMetadataManager'
import GoogleAnalyticsTag from './app/router/GoogleAnalyticsTag'
import { CookieConsentLayer } from '@/widgets/common/cookie-consent-layer'

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
        <DocumentMetadataManager>
          <AppRouter />
        </DocumentMetadataManager>
        <CookieConsentLayer />
        <GoogleAnalyticsTag />
      </AppProviders>
    </BrowserRouter>
  )
}

export default App
