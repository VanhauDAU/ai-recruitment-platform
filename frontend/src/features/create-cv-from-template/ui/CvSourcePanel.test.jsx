import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CvSourcePanel from './CvSourcePanel'

const mocks = vi.hoisted(() => ({
  getBlankCvPreview: vi.fn(),
  getCvPositionOptions: vi.fn(),
  getCvPositionPreview: vi.fn(),
  onRequireLogin: vi.fn(),
}))

const locales = [{ code: 'vi-VN', label_vi: 'Tiếng Việt', is_default: true }]

vi.mock('@/entities/cv', () => ({
  getLatestRecoverableDraft: vi.fn(),
  getMyCvs: vi.fn(),
  getCvTemplatePreview: vi.fn(),
  importCvFile: vi.fn(),
  retryCvImport: vi.fn(),
  switchCvTemplate: vi.fn(),
  waitForCvImport: vi.fn(),
}))

vi.mock('@/entities/cv-template', () => ({
  getBlankCvPreview: mocks.getBlankCvPreview,
  getCvPositionOptions: mocks.getCvPositionOptions,
  getCvPositionPreview: mocks.getCvPositionPreview,
}))

vi.mock('@/entities/locale', () => ({
  useLocales: () => ({ locales }),
}))

vi.mock('@/entities/session', () => ({
  useSession: () => ({ isAuthenticated: false, user: null }),
}))

vi.mock('@/entities/site-settings', () => ({
  useSiteSettings: () => ({ siteName: 'ProCV' }),
}))

describe('CvSourcePanel', () => {
  beforeEach(() => {
    mocks.onRequireLogin.mockReset()
    mocks.getCvPositionOptions.mockResolvedValue([])
    mocks.getCvPositionPreview.mockResolvedValue({})
    mocks.getBlankCvPreview.mockResolvedValue({ document: {} })
  })

  it('opens the candidate login prompt instead of only showing a warning when creating a CV as a guest', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <CvSourcePanel
          template={{ public_id: 'template_1', display_name: 'Kinh nghiệm' }}
          onRequireLogin={mocks.onRequireLogin}
        />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /Tạo CV từ đầu/ }))
    const createButton = screen.getByRole('button', { name: 'Tạo CV' })
    await waitFor(() => expect(createButton).toBeEnabled())
    await user.click(createButton)

    expect(mocks.onRequireLogin).toHaveBeenCalledTimes(1)
  })
})
