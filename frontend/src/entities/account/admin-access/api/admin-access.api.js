import client from '@/shared/api/client'

// `scope: 'all'` chỉ dành cho superuser; mặc định chỉ trả log của chính mình.
export async function getAdminAuditLogs({ scope = 'mine', action = '', page = 1, signal } = {}) {
  const response = await client.get('/admin/audit-logs/', {
    params: {
      page,
      ...(scope === 'all' ? { scope: 'all' } : {}),
      ...(action ? { action } : {}),
    },
    signal,
  })
  return response.data
}
