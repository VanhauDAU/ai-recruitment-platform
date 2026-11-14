import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '@/shared/api/client'
import {
  getEmployerCompanyPage,
  getEmployerCompanyPageEditors,
  getEmployerPinnableJobs,
  grantEmployerCompanyPageEditor,
  revokeEmployerCompanyPageEditor,
  submitEmployerCompanyPageContent,
  updateEmployerCompanyPageLayout,
} from './employer-company-page.api'
import { employerCompanyPageKeys } from './employer-company-page.keys'

vi.mock('@/shared/api/client', () => ({
  default: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

describe('employer company page API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reads the workspace and patches only the layout endpoint', async () => {
    const signal = new AbortController().signal
    api.get.mockResolvedValueOnce({ data: { layout: { lock_version: 2 } } })
    api.patch.mockResolvedValueOnce({ data: { layout: { lock_version: 3 } } })

    await expect(getEmployerCompanyPage({ signal })).resolves.toEqual({ layout: { lock_version: 2 } })
    await expect(updateEmployerCompanyPageLayout({ lock_version: 2, accent: 'ocean' }))
      .resolves.toEqual({ layout: { lock_version: 3 } })

    expect(api.get).toHaveBeenCalledWith('/employer/company/page/', { signal })
    expect(api.patch).toHaveBeenCalledWith('/employer/company/page/layout/', { lock_version: 2, accent: 'ocean' })
  })

  it('unwraps result lists and addresses editors by grant id', async () => {
    api.get
      .mockResolvedValueOnce({ data: { results: [{ public_id: 'jb_1' }] } })
      .mockResolvedValueOnce({ data: { results: [{ member_id: 'm1' }] } })
    api.post.mockResolvedValueOnce({ data: { member_id: 'm1', grant: { public_id: 'cpg_1' } } })
    api.delete.mockResolvedValueOnce({ data: { member_id: 'm1', grant: null } })

    await expect(getEmployerPinnableJobs('kế toán')).resolves.toEqual([{ public_id: 'jb_1' }])
    await expect(getEmployerCompanyPageEditors()).resolves.toEqual([{ member_id: 'm1' }])
    await grantEmployerCompanyPageEditor('m1')
    await revokeEmployerCompanyPageEditor('cpg_1')

    expect(api.get).toHaveBeenNthCalledWith(1, '/employer/company/page/pinnable-jobs/', { params: { q: 'kế toán' }, signal: undefined })
    expect(api.get).toHaveBeenNthCalledWith(2, '/employer/company/page/editors/', { signal: undefined })
    expect(api.post).toHaveBeenCalledWith('/employer/company/page/editors/', { member_id: 'm1' })
    expect(api.delete).toHaveBeenCalledWith('/employer/company/page/editors/cpg_1/')
  })

  it('posts content changes wrapped in a changes object', async () => {
    api.post.mockResolvedValueOnce({ data: { content_form: { request: { public_id: 'cur_1' } } } })

    await expect(submitEmployerCompanyPageContent({ headline: 'Mới', logo_pending: true }))
      .resolves.toEqual({ content_form: { request: { public_id: 'cur_1' } } })
    expect(api.post).toHaveBeenCalledWith('/employer/company/page/content/', { changes: { headline: 'Mới', logo_pending: true } })
  })

  it('keeps every key under the employer company root', () => {
    expect(employerCompanyPageKeys.page).toEqual(['employer', 'company', 'page', 'workspace'])
    expect(employerCompanyPageKeys.pinnableJobs('dev')).toEqual(['employer', 'company', 'page', 'pinnable-jobs', { q: 'dev' }])
    expect(employerCompanyPageKeys.editors).toEqual(['employer', 'company', 'page', 'editors'])
  })
})
