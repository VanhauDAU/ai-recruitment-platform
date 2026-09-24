/** Canonical absolute URL dùng khi share (bỏ query/hash để khớp OG shell). */
export function absoluteBlogShareUrl(pathname) {
  const path = String(pathname || '').startsWith('/')
    ? String(pathname)
    : `/${String(pathname || '')}`
  if (typeof window === 'undefined') return path
  try {
    return new URL(path, window.location.origin).href
  } catch {
    return path
  }
}

/**
 * Deep-link chia sẻ social.
 * Facebook/X chỉ lấy `u`/`url` để crawl; title/description phụ thuộc OG server-side.
 * `text` trên X chỉ là gợi ý caption khi người dùng đăng.
 */
export function buildBlogShareTargets({ url, title = '' }) {
  const shareUrl = String(url || '').trim()
  const encodedUrl = encodeURIComponent(shareUrl)
  const encodedTitle = encodeURIComponent(String(title || '').trim())
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    // twitter.com/intent vẫn redirect ổn định sang x.com
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}${encodedTitle ? `&text=${encodedTitle}` : ''}`,
  }
}

export function openShareWindow(href) {
  if (!href || typeof window === 'undefined') return
  window.open(href, '_blank', 'noopener,noreferrer,width=640,height=640')
}

export async function shareViaWebApi({ url, title, text }) {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return false
  }
  try {
    await navigator.share({
      url,
      title: title || undefined,
      text: text || undefined,
    })
    return true
  } catch (error) {
    // User dismiss → AbortError; không coi là lỗi.
    if (error?.name === 'AbortError') return true
    return false
  }
}

export function canUseWebShare() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}
