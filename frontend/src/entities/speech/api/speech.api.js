import api from '@/shared/api/client'

export async function getSpeechVoiceCatalog({ signal } = {}) {
  const { data } = await api.get('/speech/voices/', { signal })
  return data
}

export async function createBlogSpeechSession({ sourcePublicId, voiceId, style, signal }) {
  const preferences = {
    ...(voiceId ? { voice_id: voiceId } : {}),
    ...(style ? { style } : {}),
  }
  const { data } = await api.post(
    '/speech/sessions/',
    {
      source_type: 'blog_post',
      source_public_id: sourcePublicId,
      ...preferences,
    },
    { signal },
  )
  return data
}
