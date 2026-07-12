export const RETURN_URL_PARAM = 'returnUrl'

// Chỉ chấp nhận path nội bộ để chặn open redirect sau đăng nhập/OAuth.
export function getSafeReturnUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return ''

  try {
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin) return ''
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return ''
  }
}

export function getReturnUrl(searchParams) {
  return getSafeReturnUrl(searchParams.get(RETURN_URL_PARAM))
}

export function withReturnUrl(loginPath, returnUrl) {
  const safeReturnUrl = getSafeReturnUrl(returnUrl)
  if (!safeReturnUrl) return loginPath

  const [pathAndSearch, hash = ''] = loginPath.split('#')
  const separator = pathAndSearch.includes('?') ? '&' : '?'
  return `${pathAndSearch}${separator}${RETURN_URL_PARAM}=${encodeURIComponent(safeReturnUrl)}${hash ? `#${hash}` : ''}`
}
