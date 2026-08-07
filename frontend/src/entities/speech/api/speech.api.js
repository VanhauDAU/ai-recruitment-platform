import api from '@/shared/api/client'

export async function createBlogSpeechSession({ sourcePublicId, signal }) {
  const { data } = await api.post(
    '/speech/sessions/',
    {
      source_type: 'blog_post',
      source_public_id: sourcePublicId,
    },
    { signal },
  )
  return data
}

export async function createTextSpeechSession({ text, surface, signal }) {
  const { data } = await api.post(
    '/speech/sessions/',
    {
      source_type: 'text',
      surface,
      text,
    },
    { signal },
  )
  return data
}

export async function getSpeechAdminOverview({ signal } = {}) {
  const { data } = await api.get('/speech/admin/overview/', { signal })
  return data
}
