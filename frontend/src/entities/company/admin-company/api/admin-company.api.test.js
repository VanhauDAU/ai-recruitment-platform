import { beforeEach, describe, expect, it, vi } from 'vitest'
import client from '@/shared/api/client'
import {
  getAdminCompanies,
  getAdminCompany,
  getAdminCompanyPublicPage,
  getAdminCompanyRecruiters,
  getAdminCompanySummary,
  setAdminCompanyPolicyHold,
} from './admin-company.api'

vi.mock('@/shared/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

describe('admin company api', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requests the paginated company directory', async () => {
    client.get.mockResolvedValue({ data: { count: 0, results: [] } })
    await getAdminCompanies({ page: 2, ordering: 'company_name' })
    expect(client.get).toHaveBeenCalledWith('/admin/companies/', {
      params: { page: 2, ordering: 'company_name' },
      signal: undefined,
    })
  })

  it('requests company detail and recruiter roster', async () => {
    client.get.mockResolvedValue({ data: {} })
    await getAdminCompany('co_123')
    await getAdminCompanyRecruiters('co_123', { role: 'owner' })
    expect(client.get).toHaveBeenNthCalledWith(1, '/admin/companies/co_123/', {
      signal: undefined,
    })
    expect(client.get).toHaveBeenNthCalledWith(
      2,
      '/admin/companies/co_123/recruiters/',
      { params: { role: 'owner' }, signal: undefined },
    )
  })

  it('requests the page-independent company summary', async () => {
    client.get.mockResolvedValue({ data: {} })
    await getAdminCompanySummary({ signal: 'signal' })
    expect(client.get).toHaveBeenCalledWith('/admin/companies/summary/', {
      signal: 'signal',
    })
  })

  it('reads the public page preview and posts a hold decision with its reason', async () => {
    const page = { public_path: '/cong-ty/alpha', policy_hold: { active: true } }
    client.get.mockResolvedValue({ data: page })
    client.post.mockResolvedValue({ data: page })

    await expect(getAdminCompanyPublicPage('co_123', { signal: 'signal' })).resolves.toBe(page)
    await expect(setAdminCompanyPolicyHold('co_123', {
      action: 'apply',
      reason: 'Nội dung giả mạo thương hiệu',
    })).resolves.toBe(page)

    expect(client.get).toHaveBeenCalledWith('/admin/companies/co_123/public-page/', {
      signal: 'signal',
    })
    expect(client.post).toHaveBeenCalledWith('/admin/companies/co_123/policy-hold/', {
      action: 'apply',
      reason: 'Nội dung giả mạo thương hiệu',
    })
  })
})
