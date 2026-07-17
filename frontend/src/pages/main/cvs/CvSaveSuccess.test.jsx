import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CvSaveSuccess from './CvSaveSuccess'

const mocks = vi.hoisted(() => ({
  getCv: vi.fn(), getCvDraft: vi.fn(), getJobs: vi.fn(), getCandidateJobPreferences: vi.fn(), updateCandidateJobPreferences: vi.fn(),
}))

vi.mock('@/entities/cv', () => ({
  getCv: mocks.getCv,
  getCvDraft: mocks.getCvDraft,
  CvDocumentPreview: () => <div>CV preview</div>,
}))
vi.mock('@/entities/candidate-preferences', () => ({
  getCandidateJobPreferences: mocks.getCandidateJobPreferences,
  updateCandidateJobPreferences: mocks.updateCandidateJobPreferences,
}))
vi.mock('@/entities/job', () => ({
  getJobs: mocks.getJobs,
  formatLocations: (job) => job.location,
  formatSalary: (job) => job.salary,
  jobDetailPath: (job) => `/viec-lam/${job.slug}`,
}))

function renderPage() {
  return render(<App><MemoryRouter initialEntries={['/save-cv-success/cv_1?type=create']}><Routes><Route path="/save-cv-success/:publicId" element={<CvSaveSuccess />} /></Routes></MemoryRouter></App>)
}

describe('CV save success page', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.getCv.mockResolvedValue({ title: 'CV Marketing', template_renderer_key: 'classic_single_column_v1' })
    mocks.getCvDraft.mockResolvedValue({ schema_version: 1, content_json: {}, layout_json: {}, style_json: {}, assets: {} })
    mocks.getCandidateJobPreferences.mockResolvedValue({
      desired_specialization_ids: [], desired_position_other: '', desired_salary_vnd: null, experience_level: '', preferred_province_ids: [], willing_to_relocate: false, ai_recommendation_consent: true, recruiter_visibility_consent: false, job_preferences_configured: true,
    })
    mocks.getJobs.mockResolvedValue({ results: [{ public_id: 'job_1', slug: 'marketing-executive', title: 'Marketing Executive', company_name: 'Pro Company', location: 'Hà Nội', salary: '15 - 20 triệu' }] })
    mocks.updateCandidateJobPreferences.mockImplementation(async (payload) => payload)
  })

  it('shows the saved CV, recruiter visibility and matching jobs', async () => {
    renderPage()
    expect(await screen.findByText('Lưu CV thành công!')).toBeInTheDocument()
    expect(screen.getByText('CV của CV Marketing')).toBeInTheDocument()
    expect(screen.getByText('Marketing Executive')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Chỉnh sửa/ })).toHaveAttribute('href', '/cvs/cv_1/edit')
  })

  it('updates recruiter visibility using only writable preference fields', async () => {
    renderPage()
    const visibility = await screen.findByRole('switch', { name: 'Cho phép nhà tuyển dụng tìm kiếm hồ sơ' })
    fireEvent.click(visibility)
    await waitFor(() => expect(mocks.updateCandidateJobPreferences).toHaveBeenCalledWith(expect.objectContaining({ recruiter_visibility_consent: true })))
    expect(mocks.updateCandidateJobPreferences.mock.calls[0][0]).not.toHaveProperty('job_preferences_configured')
  })
})
