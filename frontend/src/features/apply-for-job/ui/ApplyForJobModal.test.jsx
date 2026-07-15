import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ApplyForJobModal from './ApplyForJobModal'
const cvApi = vi.hoisted(() => ({ getCv: vi.fn(), getCvVersions: vi.fn(), getMyCvs: vi.fn() }))
const applicationApi = vi.hoisted(() => ({ submitJobApplication: vi.fn() }))

vi.mock('@/entities/cv', () => cvApi)
vi.mock('@/entities/application', () => applicationApi)

describe('ApplyForJobModal', () => {
  afterEach(() => vi.unstubAllGlobals())

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    Object.values(cvApi).forEach((mock) => mock.mockReset())
    applicationApi.submitJobApplication.mockReset()
    cvApi.getMyCvs.mockResolvedValue([{ public_id: 'cv_1', title: 'CV chính', is_default: true }])
    cvApi.getCv.mockResolvedValue({ public_id: 'cv_1', published_version_public_id: 'cvv_2', latest_version_public_id: 'cvv_3' })
    cvApi.getCvVersions.mockResolvedValue([
      { public_id: 'cvv_3', version_number: 3, version_kind: 'manual_save' },
      { public_id: 'cvv_2', version_number: 2, version_kind: 'published' },
    ])
  })

  it('submits the candidate-selected immutable CV version', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    applicationApi.submitJobApplication.mockResolvedValue({ public_id: 'app_1' })

    render(<ApplyForJobModal open onClose={onClose} jobPublicId="job_1" jobTitle="Kỹ sư" />)

    await waitFor(() => expect(cvApi.getCvVersions).toHaveBeenCalledWith('cv_1'))
    await user.click(screen.getByRole('button', { name: 'Xác nhận ứng tuyển' }))

    await waitFor(() => expect(applicationApi.submitJobApplication).toHaveBeenCalledWith({
      jobPublicId: 'job_1', cvPublicId: 'cv_1', versionPublicId: 'cvv_2', coverLetter: '',
    }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
