import { parseCompanyVideoUrl } from './company-video'

/**
 * Hồ sơ công ty như sẽ hiển thị nếu yêu cầu đang chờ duyệt được áp dụng: phủ
 * `content_form.pending` (chỉ chứa các khoá đã đổi) lên DTO công khai. Hàm thuần
 * dùng cho bản xem trước. `benefits` là danh mục phúc lợi (`id`, `name`, `icon`,
 * `category`) vì phúc lợi chờ duyệt chỉ có `benefit_id`; ảnh thư viện bị xoá
 * được nhận theo `id` của `content_form.published.gallery`.
 */
export function applyPendingCompanyContent(content, contentForm, { registry, benefits = [] } = {}) {
  const pending = contentForm?.pending
  if (!pending) return content
  const has = (key) => Object.hasOwn(pending, key)
  const registrySections = registry?.sections || []
  const titles = Object.fromEntries(registrySections.map((section) => [section.key, section.title]))
  const rank = (key) => {
    const index = registrySections.findIndex((section) => section.key === key)
    return index === -1 ? registrySections.length : index
  }
  // Khối chưa có trong DTO (chưa có nội dung công khai) được chèn theo thứ tự registry.
  const upsert = (list, key, build) => {
    const index = list.findIndex((section) => section.key === key)
    if (index !== -1) return list.with(index, build(list[index]))
    const next = build({ key, title: titles[key] || key })
    const before = list.findIndex((section) => rank(section.key) > rank(key))
    return before === -1 ? [...list, next] : list.toSpliced(before, 0, next)
  }
  const richText = (key, field) => (list) => (has(field)
    ? upsert(list, key, (section) => ({ ...section, type: 'rich_text', body_html: pending[field] || '' }))
    : list)

  let sections = [content.sections || []]
    .map(richText('about', 'description'))
    .map(richText('culture', 'culture'))[0]
  let sidebar = content.sidebar || []

  if (has('benefits') || has('employee_benefits')) {
    sections = upsert(sections, 'benefits', (section) => ({
      ...section,
      type: 'benefits',
      items: has('benefits')
        ? (pending.benefits || []).flatMap(({ benefit_id: benefitId, note }) => {
            const benefit = benefits.find((item) => item.id === benefitId)
            return benefit ? [{ name: benefit.name, icon: benefit.icon || '', category: benefit.category || '', note: note || '' }] : []
          })
        : section.type === 'benefits' ? section.items || [] : [],
      body_html: has('employee_benefits') ? pending.employee_benefits || '' : section.body_html || '',
    }))
  }
  if (has('video_url')) {
    const video = parseCompanyVideoUrl(pending.video_url) || { provider: '', video_id: '', embed_url: '' }
    sections = upsert(sections, 'video', (section) => ({ ...section, type: 'video', ...video }))
  }
  if (has('gallery_additions') || has('gallery_deletions')) {
    const deletions = new Set(pending.gallery_deletions || [])
    const removedUrls = new Set((contentForm.published?.gallery || [])
      .filter((image) => deletions.has(image.id))
      .map((image) => image.image_url))
    sections = upsert(sections, 'gallery', (section) => ({
      ...section,
      type: 'gallery',
      items: [
        ...(section.items || []).filter((image) => !removedUrls.has(image.image_url)),
        ...(pending.gallery_additions || []).map((image) => ({ image_url: image.image_url, caption: '' })),
      ],
    }))
  }
  if (has('offices')) {
    sidebar = upsert(sidebar, 'offices', (block) => ({
      ...block,
      type: 'offices',
      items: (pending.offices || []).map((office) => ({
        label: office.label || '',
        address: office.address_line || '',
        province_name: office.province_name || '',
        is_headquarters: Boolean(office.is_headquarters),
      })),
    }))
  }
  if (has('social_links')) {
    sidebar = upsert(sidebar, 'social_links', (block) => ({
      ...block,
      type: 'social_links',
      items: (registry?.social_networks || []).flatMap(({ key, label }) => {
        const url = (pending.social_links?.[key] || '').trim()
        return url ? [{ network: key, label, url }] : []
      }),
    }))
  }

  const identity = { ...content.identity }
  if (has('headline')) identity.headline = pending.headline || ''
  if (pending.logo_url) identity.logo_url = pending.logo_url
  if (pending.cover_image_url) identity.cover_image_url = pending.cover_image_url

  return { ...content, identity, sections, sidebar }
}
