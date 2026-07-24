import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadPortalConfig({ employerHost }) {
  vi.resetModules()
  vi.stubEnv('VITE_EMPLOYER_HOST', employerHost)
  vi.stubEnv('VITE_ADMIN_HOST', 'admin.example.test')
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
    expect(employerAppPath('/jobs/job_123?tab=applications')).toBe(
      '/app/jobs/job_123?tab=applications',
    )
  })

  it('uses /tuyendung/app on the main host', async () => {
    const { IS_EMPLOYER_HOST, IS_MAIN_HOST, employerAppPath } = await loadPortalConfig({
      employerHost: 'employer.example.test',
    })

    expect(IS_EMPLOYER_HOST).toBe(false)
    expect(IS_MAIN_HOST).toBe(true)
    expect(employerAppPath('')).toBe('/tuyendung/app')
    expect(employerAppPath('/jobs/job_123?tab=applications')).toBe(
      '/tuyendung/app/jobs/job_123?tab=applications',
    )
  })
})
