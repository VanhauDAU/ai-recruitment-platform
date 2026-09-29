import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CandidateDataGuard from './CandidateDataGuard'
import JobWorkspaceGuard from './JobWorkspaceGuard'

const { useEmployerReadiness, refetch } = vi.hoisted(() => ({
  useEmployerReadiness: vi.fn(),
  refetch: vi.fn(),
}))

vi.mock('@/entities/employer-profile', async (importOriginal) => ({
  ...await importOriginal(),
  useEmployerReadiness,
}))

function CurrentLocation() {
  const location = useLocation()
  return <output data-testid="current-location">{location.pathname}{location.search}</output>
}

function renderGuard(Guard, path = '/tuyendung/app/applications?job=job_1') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <CurrentLocation />
      <Routes>
        <Route element={<Guard />}>
          <Route path="/tuyendung/app/*" element={<p>Protected resource mounted</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

function state(overrides = {}) {
  return {
    isChecking: false,
    isAccessError: false,
    canUseJobWorkspace: true,
    canAccessCandidateData: true,
    profileQuery: { refetch },
    readiness: {
      source: 'canonical',
      jobWorkspaceReady: true,
      candidateDataAccess: true,
      blockers: [],
    },
    ...overrides,
  }
}

describe('employer capability route guards', () => {
  beforeEach(() => {
    refetch.mockReset()
    useEmployerReadiness.mockReset()
  })

  it('allows job and campaign workspace before final verification approval', () => {
    useEmployerReadiness.mockReturnValue(state({
      readiness: {
        source: 'canonical',
        jobWorkspaceReady: true,
        verificationApproved: false,
        candidateDataAccess: false,
        dpaStatus: 'current',
        blockers: [{
          code: 'verification_required',
          capabilities: ['verification', 'candidate_data', 'job_approval'],
          message: 'Hồ sơ đại diện doanh nghiệp chưa được duyệt.',
          action: 'open_verification',
        }],
      },
      canAccessCandidateData: false,
    }))

    renderGuard(JobWorkspaceGuard, '/tuyendung/app/jobs')

    expect(screen.getByText('Protected resource mounted')).toBeInTheDocument()
  })

  it('redirects a denied candidate-data URL to the existing verification page', () => {
    useEmployerReadiness.mockReturnValue(state({
      canAccessCandidateData: false,
      readiness: {
        source: 'canonical',
        jobWorkspaceReady: true,
        verificationApproved: false,
        candidateDataAccess: false,
        dpaStatus: 'current',
        blockers: [{
          code: 'verification_required',
          capabilities: ['verification', 'candidate_data', 'job_approval'],
          message: 'Hồ sơ đại diện doanh nghiệp chưa được duyệt.',
          action: 'open_verification',
        }],
      },
    }))

    renderGuard(CandidateDataGuard)

    expect(screen.queryByText('Protected resource mounted')).not.toBeInTheDocument()
    expect(screen.getByTestId('current-location')).toHaveTextContent(
      '/tuyendung/app/employer-verify',
    )
    expect(screen.queryByText('Dữ liệu ứng viên đang được bảo vệ')).not.toBeInTheDocument()
  })

  it('redirects an incomplete job workspace to the existing verification page', () => {
    useEmployerReadiness.mockReturnValue(state({
      canUseJobWorkspace: false,
      canAccessCandidateData: false,
      readiness: {
        source: 'canonical',
        jobWorkspaceReady: false,
        verificationApproved: false,
        candidateDataAccess: false,
        dpaStatus: 'missing',
        blockers: [{
          code: 'business_document_required',
          capabilities: ['job_workspace', 'verification', 'candidate_data', 'job_approval'],
          message: 'Cần nộp giấy tờ doanh nghiệp.',
          action: 'upload_business_document',
        }],
      },
    }))

    renderGuard(JobWorkspaceGuard, '/tuyendung/app/jobs')

    expect(screen.queryByText('Protected resource mounted')).not.toBeInTheDocument()
    expect(screen.getByTestId('current-location')).toHaveTextContent(
      '/tuyendung/app/employer-verify',
    )
    expect(screen.queryByText('Workspace tuyển dụng chưa sẵn sàng')).not.toBeInTheDocument()
  })

  it('fails a cached allowed state closed while refetching or after an error', () => {
    useEmployerReadiness.mockReturnValue(state({
      isAccessError: true,
      canAccessCandidateData: false,
    }))

    renderGuard(CandidateDataGuard)

    expect(screen.queryByText('Protected resource mounted')).not.toBeInTheDocument()
    expect(screen.getByText('Không thể kiểm tra quyền truy cập')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra lại' }))
    expect(refetch).toHaveBeenCalledOnce()
  })
})
