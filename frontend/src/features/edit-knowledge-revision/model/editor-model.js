const EMPTY_BODY = '<p></p>'

export function revisionToEditorValues(article) {
  const revision = article?.revisions?.find((item) => item.status === 'DRAFT')
    || article?.revisions?.[0]
  if (!revision) return null
  return {
    category_public_id: article.category?.public_id,
    type: article.article_type,
    slug: article.slug,
    order: article.order,
    title: revision.title,
    body: revision.body || EMPTY_BODY,
    source_reference: revision.source_reference,
    change_summary: revision.change_summary,
    seo_title: revision.seo_title,
    seo_description: revision.seo_description,
  }
}

export function newKnowledgeEditorValues(categories = []) {
  return {
    category_public_id: categories.find((item) => item.is_active)?.public_id,
    type: 'FAQ',
    order: 0,
    title: '',
    body: EMPTY_BODY,
    source_reference: '',
    change_summary: '',
    seo_title: '',
    seo_description: '',
  }
}

export function editorCompletion(values = {}) {
  const checks = [
    { key: 'title', label: 'Tiêu đề rõ ràng', done: Boolean(values.title?.trim()) },
    { key: 'body', label: 'Nội dung trả lời', done: Boolean(values.body?.replace(/<[^>]+>/g, '').trim()) },
    { key: 'source', label: 'Nguồn tham chiếu', done: Boolean(values.source_reference?.trim()) },
    { key: 'seo', label: 'Mô tả tìm kiếm', done: Boolean(values.seo_description?.trim()) },
  ]
  return { checks, completed: checks.filter((item) => item.done).length }
}

export function draftStorageKey(publicId = 'new') {
  return `procv:knowledgebase:draft:${publicId}`
}
