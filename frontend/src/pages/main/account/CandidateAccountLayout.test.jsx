import { render, screen } from '@testing-library/react'
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import CandidateAccountLayout from './CandidateAccountLayout'

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }))

vi.mock('@/entities/session', () => ({ useSession }))
vi.mock('@/entities/site-settings', () => ({
  DEFAULT_SITE_SETTINGS: { site_name: 'ProCV' },
  settingText: (value, fallback) => value || fallback,
  useSiteSettings: () => ({ settings: { site_name: 'ProCV' } }),
}))

function renderAccount(path = '/tai-khoan/thong-tin-ca-nhan') {
  useSession.mockReturnValue({
    user: {
      email_verified: true,
      full_name: 'Ứng viên thử nghiệm',
      job_preferences_configured: true,
    },
  })

  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<CandidateAccountLayout />}>
          <Route path="/tai-khoan" element={<Navigate to="/tai-khoan/thong-tin-ca-nhan" replace />} />
          <Route path="/tai-khoan/thong-tin-ca-nhan" element={<h1>Thông tin cá nhân</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('CandidateAccountLayout', () => {
  it('renders the candidate account content and both account sidebars', () => {
    renderAccount()

    expect(screen.getByRole('heading', { name: 'Thông tin cá nhân' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Danh mục tài khoản' })).toBeInTheDocument()
    expect(screen.getByText('Chào bạn trở lại,')).toBeInTheDocument()
    expect(screen.getByText('Ứng viên thử nghiệm')).toBeInTheDocument()
  })

  it('keeps the root account route redirect working', () => {
    renderAccount('/tai-khoan')

    expect(screen.getByRole('heading', { name: 'Thông tin cá nhân' })).toBeInTheDocument()
  })
})
