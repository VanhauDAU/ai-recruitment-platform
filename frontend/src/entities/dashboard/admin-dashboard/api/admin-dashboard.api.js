import api from '@/shared/api/client'

export const ADMIN_DASHBOARD_PERIODS = [7, 30, 90]

export const adminDashboardKeys = {
  all: ['admin-dashboard'],
  detail: (period) => [...adminDashboardKeys.all, period],
  queues: ['admin-dashboard', 'queues'],
}

export async function getAdminDashboard(period, { signal } = {}) {
  const { data } = await api.get('/admin/dashboard/', { params: { period }, signal })
  return data
}

export async function getAdminQueueSummary({ signal } = {}) {
  const { data } = await api.get('/admin/dashboard/queues/', { signal })
  return data
}
