import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router'
import { useSiteSettings } from '@/entities/site-settings'
import { DocumentMetadataContext } from '@/shared/config/document-metadata-context'
import { applyDocumentMetadata } from '@/shared/config/document-meta'
import { getCurrentPortal } from '@/shared/config/portals'
import { resolveRouteMetadata } from './route-metadata'

export default function DocumentMetadataManager({ children }) {
  const { pathname } = useLocation()
  const { settings, siteName } = useSiteSettings()
  const portal = getCurrentPortal()
  const [pageMetadata, setPageMetadata] = useState(null)

  const registerMetadata = useCallback((metadata) => {
    const token = Symbol('document-metadata')
    setPageMetadata({ metadata, token })
    return () => {
      setPageMetadata((current) => current?.token === token ? null : current)
    }
  }, [])

  const baseMetadata = useMemo(
    () => resolveRouteMetadata({ pathname, portal, settings }),
    [pathname, portal, settings],
  )
  const effectiveMetadata = useMemo(
    () => ({ ...baseMetadata, ...(pageMetadata?.metadata || {}) }),
    [baseMetadata, pageMetadata],
  )

  useEffect(() => {
    applyDocumentMetadata(effectiveMetadata, { portal, siteName })
  }, [effectiveMetadata, portal, siteName])

  return (
    <DocumentMetadataContext.Provider value={registerMetadata}>
      {children}
    </DocumentMetadataContext.Provider>
  )
}
