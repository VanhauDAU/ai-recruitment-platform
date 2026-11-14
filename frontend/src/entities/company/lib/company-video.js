const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/
const VIMEO_ID = /^\d{6,12}$/
const YOUTUBE_HOSTS = new Set(['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'])

function embedUrl(provider, videoId) {
  return provider === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${videoId}`
    : `https://player.vimeo.com/video/${videoId}`
}

function video(provider, videoId) {
  const valid = provider === 'youtube' ? YOUTUBE_ID.test(videoId || '') : VIMEO_ID.test(videoId || '')
  return valid ? { provider, video_id: videoId, embed_url: embedUrl(provider, videoId) } : null
}

/**
 * Nhận diện liên kết video YouTube/Vimeo như backend chấp nhận; trả
 * `{ provider, video_id, embed_url }` hoặc `null`. Dùng cho kiểm tra trực tiếp ở
 * form và cho bản xem trước nội dung chờ duyệt.
 */
export function parseCompanyVideoUrl(value) {
  let url
  try {
    url = new URL(String(value || '').trim())
  } catch {
    return null
  }
  if (!['http:', 'https:'].includes(url.protocol)) return null
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const [first, second, third] = url.pathname.split('/').filter(Boolean)

  if (host === 'youtu.be') return video('youtube', first)
  if (YOUTUBE_HOSTS.has(host)) {
    if (url.pathname === '/watch') return video('youtube', url.searchParams.get('v'))
    return ['embed', 'shorts', 'live'].includes(first) ? video('youtube', second) : null
  }
  if (host === 'vimeo.com') return video('vimeo', first === 'channels' ? third : first)
  if (host === 'player.vimeo.com' && first === 'video') return video('vimeo', second)
  return null
}

/** Khối video chỉ được nhúng khi `embed_url` đúng là URL nhúng chuẩn của mã video. */
export function companyVideoEmbed(section) {
  const parsed = section?.provider && video(section.provider, section.video_id)
  return parsed && parsed.embed_url === section.embed_url ? parsed : null
}
