import api from '@/shared/api/client'

function voicePreferences({ voiceId, style }) {
  // Bỏ hẳn key rỗng thay vì gửi '' để server tự chọn mặc định của giọng.
  return {
    ...(voiceId ? { voice_id: voiceId } : {}),
    ...(style ? { style } : {}),
  }
}

export async function getSpeechVoiceCatalog({ signal } = {}) {
  const { data } = await api.get('/speech/voices/', { signal })
  return data
}

export async function createBlogSpeechSession({ sourcePublicId, voiceId, style, signal }) {
  const { data } = await api.post(
    '/speech/sessions/',
    {
      source_type: 'blog_post',
      source_public_id: sourcePublicId,
      ...voicePreferences({ style, voiceId }),
    },
    { signal },
  )
  return data
}

export async function createTextSpeechSession({ text, voiceId, style, signal }) {
  const { data } = await api.post(
    '/speech/sessions/',
    {
      source_type: 'text',
      text,
      ...voicePreferences({ style, voiceId }),
    },
    { signal },
  )
  return data
}
