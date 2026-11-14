import {
  COMPANY_DIRECTORY_PATH,
  companyDetailPath,
  companyProfileSummary,
} from '@/entities/company'

function absoluteUrl(path) {
  return new URL(path, window.location.origin).href
}

/**
 * Metadata của trang công ty khi điều hướng SPA. Chỉ index khi API cho phép,
 * site không tắt index và URL không mang tab/bộ lọc; canonical luôn là URL gốc.
 */
export function companyDetailMetadata({ slug, profile, isNotFound, hasViewQuery, allowIndex }) {
  if (!profile?.identity) {
    return {
      title: isNotFound ? 'Không tìm thấy công ty' : 'Hồ sơ công ty',
      canonicalPath: companyDetailPath(slug),
      robots: 'noindex, nofollow',
    }
  }

  const { display_name: name, cover_image_url: cover, logo_url: logo } = profile.identity
  const canonicalPath = profile.canonical_path || companyDetailPath(profile.slug)
  const jobCount = Number(profile.stats?.active_public_job_count) || 0

  return {
    title: `${name} tuyển dụng`,
    description: companyProfileSummary(profile)
      || `Tìm hiểu ${name} và ${jobCount > 0 ? `${jobCount} việc làm` : 'các cơ hội việc làm'} đang tuyển dụng.`,
    canonicalPath,
    imageUrl: cover || logo,
    robots: profile.indexable && allowIndex && !hasViewQuery ? 'index, follow' : 'noindex, nofollow',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: absoluteUrl('/') },
        { '@type': 'ListItem', position: 2, name: 'Công ty', item: absoluteUrl(COMPANY_DIRECTORY_PATH) },
        { '@type': 'ListItem', position: 3, name, item: absoluteUrl(canonicalPath) },
      ],
    },
  }
}
