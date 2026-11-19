function candidateAgreementDocumentUrl(document) {
  const fileUrl = document?.file_url || ''
  if (!/\.(doc|docx)(?:$|[?#])/i.test(fileUrl)) return fileUrl

  try {
    const url = new URL(fileUrl, window.location.origin)
    const isPublicExternalHttps = url.protocol === 'https:' && url.hostname !== window.location.hostname
    return isPublicExternalHttps
      ? `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`
      : fileUrl
  } catch {
    return fileUrl
  }
}

function isPrivateEmployerDocument(document) {
  return /\/employer\/company\/documents\/[^/]+\/content\/(?:$|[?#])/i.test(
    document?.file_url || '',
  )
}

export function CandidateAgreementDocumentLink({
  ariaLabel,
  children,
  className,
  document,
  onOpenDocument,
  openingDocument,
}) {
  if (isPrivateEmployerDocument(document)) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        aria-busy={openingDocument}
        disabled={openingDocument}
        onClick={() => onOpenDocument(document)}
        className={`${className} text-left disabled:cursor-wait disabled:opacity-70`}
      >
        {children}
      </button>
    )
  }
  return (
    <a
      aria-label={ariaLabel}
      href={candidateAgreementDocumentUrl(document)}
      target="_blank"
      rel="noreferrer"
      className={className}
    >
      {children}
    </a>
  )
}
