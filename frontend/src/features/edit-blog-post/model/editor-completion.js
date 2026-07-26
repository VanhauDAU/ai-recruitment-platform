export const EDITOR_COMPLETION_ITEMS = [
  { key: 'title', label: 'Tiêu đề' },
  { key: 'summary', label: 'Sapo' },
  { key: 'content', label: 'Nội dung' },
  { key: 'thumbnail', label: 'Ảnh đại diện' },
  { key: 'related_job_category', label: 'Việc làm liên quan' },
  { key: 'seo_title', label: 'SEO title' },
  { key: 'seo_description', label: 'SEO description' },
]

function hasValue(value) {
  return typeof value === 'string' ? Boolean(value.trim()) : Boolean(value)
}

export function getEditorCompletion(values = {}) {
  const checks = {
    title: hasValue(values.title),
    summary: hasValue(values.summary),
    content: hasValue(values.content),
    thumbnail: hasValue(values.thumbnail_storage_key || values.thumbnail_url),
    related_job_category: hasValue(values.related_job_category_id),
    seo_title: hasValue(values.seo_title),
    seo_description: hasValue(values.seo_description),
  }
  const completed = Object.values(checks).filter(Boolean).length
  return {
    checks,
    score: Math.round((completed / EDITOR_COMPLETION_ITEMS.length) * 100),
  }
}
