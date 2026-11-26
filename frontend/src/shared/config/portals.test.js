import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadPortalConfig({ employerHost, adminHost = 'admin.example.test', mainHost = '' }) {
  vi.resetModules()
  vi.stubEnv('VITE_EMPLOYER_HOST', employerHost)
  vi.stubEnv('VITE_ADMIN_HOST', adminHost)
  vi.stubEnv('VITE_MAIN_HOST', mainHost)
  return import('./portals.js')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('employer app paths', () => {
  it('uses /app on the configured employer host', async () => {
    const { IS_EMPLOYER_HOST, IS_MAIN_HOST, employerAppPath } = await loadPortalConfig({
      employerHost: window.location.hostname,
    })

    expect(IS_EMPLOYER_HOST).toBe(true)
    expect(IS_MAIN_HOST).toBe(false)
    expect(employerAppPath('')).toBe('/app')
    expect(employerAppPath('/tin-tuyen-dung/job_123?tab=applications')).toBe(
      '/app/tin-tuyen-dung/job_123?tab=applications',
    )
  })

  it('links to the employer subdomain from the main host', async () => {
    const config = await loadPortalConfig({ employerHost: 'employer.example.test' })

    expect(config.IS_MAIN_HOST).toBe(true)
    expect(config.SERVES_EMPLOYER).toBe(false)
    expect(config.SERVES_ADMIN).toBe(false)
    expect(config.employerAppPath('/tin-tuyen-dung/job_123')).toBe(
      'https://employer.example.test/app/tin-tuyen-dung/job_123',
    )
    expect(config.EMPLOYER_PORTAL_URL).toBe('https://employer.example.test')
    expect(config.adminPath('/dang-nhap')).toBe('https://admin.example.test/dang-nhap')
    expect(config.getCurrentPortal()).toBe('main')
  })

  it('keeps /tuyendung/app and /quan-tri when no portal has its own host', async () => {
    const config = await loadPortalConfig({ employerHost: '', adminHost: '' })

    expect(config.SERVES_EMPLOYER && config.SERVES_ADMIN).toBe(true)
    expect(config.employerAppPath('/tong-quan')).toBe('/tuyendung/app/tong-quan')
    expect(config.EMPLOYER_PORTAL_URL).toBe('/tuyendung')
    expect(config.adminPath('/tong-quan')).toBe('/quan-tri/tong-quan')
  })
})

describe('admin subdomain', () => {
  it('serves the admin app at the root and links back to the main site', async () => {
    const config = await loadPortalConfig({
      employerHost: 'employer.example.test',
      adminHost: window.location.hostname,
      mainHost: 'main.example.test',
    })

    expect(config.SERVES_ADMIN).toBe(true)
    expect(config.SERVES_EMPLOYER).toBe(false)
    expect(config.adminPath('')).toBe('/')
    expect(config.adminPath('/tong-quan')).toBe('/tong-quan')
    expect(config.MAIN_LOGIN_URL).toBe('https://main.example.test/dang-nhap')
    expect(config.getCurrentPortal()).toBe('admin')
  })
})
