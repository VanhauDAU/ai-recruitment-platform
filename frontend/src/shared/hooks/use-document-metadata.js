import { useContext, useEffect } from 'react'
import { DocumentMetadataContext } from '@/shared/config/document-metadata-context'

export function useDocumentMetadata(metadata) {
  const registerMetadata = useContext(DocumentMetadataContext)
  const metadataKey = JSON.stringify(metadata)

  useEffect(() => {
    if (!registerMetadata || !metadataKey) return undefined
    return registerMetadata(JSON.parse(metadataKey))
  }, [registerMetadata, metadataKey])
}
