import { getIntlLocale, m } from '@/shared/config/i18n'

export const money = (value) => m.employer_campaign_money({ amount: Number(value || 0).toLocaleString(getIntlLocale()) })

export function postText(content = {}) {
  const tags = (content.hashtags || []).map((tag) => `#${tag.replace(/^#/, '')}`).join(' ')
  return [content.headline, content.body, content.call_to_action, tags].filter(Boolean).join('\n\n')
}

export async function copyText(text, label, message) {
  try {
    await navigator.clipboard.writeText(text)
    message.success(m.employer_campaign_copied({ label }))
  } catch {
    message.error(m.employer_campaign_copy_blocked())
  }
}

// Facebook chỉ dựng thẻ xem trước cho link công khai; link localhost hiện dạng chữ.
export function isPublicLink(link) {
  try {
    const { hostname } = new URL(link)
    return hostname.includes('.') && !/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)
  } catch {
    return false
  }
}
