import api from '@/shared/api/client'

// `idempotencyKey`: cùng một lần bấm "Tạo CV" gửi lại (mạng chập chờn, bấm hai
// lần) vẫn chỉ tạo một CV — backend trả lại CV đã tạo.
export async function createCvFromTemplate(payload, { idempotencyKey } = {}) {
  const config = idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined
  const { data } = await api.post('/v2/cvs/', payload, config)
  return data
}
