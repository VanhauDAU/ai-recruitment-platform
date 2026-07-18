import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useSiteSettings } from '@/entities/site-settings'
import { formatDocumentTitle, setDocumentTitle } from '@/shared/config/document-title'
import { getCurrentPortal } from '@/shared/config/portals'
import { resolveRouteTitle } from './document-title'

export default function DocumentTitleManager() {
  const { pathname } = useLocation()
  const { siteName } = useSiteSettings()
  const portal = getCurrentPortal()

  useEffect(() => {
    const titleOptions = { portal, siteName }
    setDocumentTitle(resolveRouteTitle(pathname), titleOptions)

    const titleElement = document.querySelector('title')
    if (!titleElement || typeof MutationObserver === 'undefined') return undefined

    const observer = new MutationObserver(() => {
      const formatted = formatDocumentTitle(document.title, titleOptions)
      if (document.title !== formatted) document.title = formatted
    })
    observer.observe(titleElement, { childList: true, characterData: true, subtree: true })
    return () => observer.disconnect()
  }, [pathname, portal, siteName])

  return null
}
