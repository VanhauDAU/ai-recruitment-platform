import { describe, expect, it } from 'vitest'
import { employerAppPath } from '@/shared/config/portals'
import { resolveEmployerRouteTitle } from './document-title'

describe('resolveEmployerRouteTitle', () => {
  it('uses a specific title for each employer job workflow route', () => {
    expect(resolveEmployerRouteTitle(employerAppPath('/jobs'))).toBe('Tin tuyển dụng')
    expect(resolveEmployerRouteTitle(employerAppPath('/jobs/new'))).toBe('Đăng tin tuyển dụng')
    expect(resolveEmployerRouteTitle(employerAppPath('/jobs/job_123/edit'))).toBe('Chỉnh sửa tin tuyển dụng')
    expect(resolveEmployerRouteTitle(employerAppPath('/jobs/job_123'))).toBe('Chi tiết tin tuyển dụng')
  })

  it('does not fall back to the marketing title for unknown workspace routes', () => {
    expect(resolveEmployerRouteTitle(employerAppPath('/unknown'))).toBe('Trang không tồn tại')
  })

  it('titles campaign and application workspace routes consistently', () => {
    expect(resolveEmployerRouteTitle(employerAppPath('/campaigns'))).toBe('Quản lý chiến dịch tuyển dụng')
    expect(resolveEmployerRouteTitle(employerAppPath('/campaigns/campaign_123'))).toBe('Chi tiết chiến dịch tuyển dụng')
    expect(resolveEmployerRouteTitle(employerAppPath('/applications'))).toBe('Quản lý CV ứng tuyển')
  })
})
