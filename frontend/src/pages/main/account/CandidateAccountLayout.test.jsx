import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Navigate, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import CandidateAccountLayout from './CandidateAccountLayout'

const { useSession, getAiRecommendation, updateAiRecommendation } = vi.hoisted(() => ({
  useSession: vi.fn(),
  getAiRecommendation: vi.fn(),
  updateAiRecommendation: vi.fn(),
}))

vi.mock('@/entities/account/session', () => ({ useSession }))
vi.mock('@/entities/cv/cv', () => ({
  getMyCvs: vi.fn().mockResolvedValue([{ recruiter_searchable: true }, { recruiter_searchable: false }]),
}))
vi.mock('@/entities/system/site-settings', () => ({
  DEFAULT_SITE_SETTINGS: { site_name: 'ProCV' },
  settingText: (value, fallback = '') => value || fallback,
  useSiteSettings: () => ({
    settings: { site_name: 'ProCV', ai_data_policy_url: 'https://example.test/ai-policy.pdf' },
    siteName: 'ProCV',
  }),
}))
vi.mock('@/entities/job/candidate-preferences', async (importOriginal) => ({
  ...(await importOriginal()),
  getAiRecommendation,
  updateAiRecommendation,
}))
vi.mock('@/shared/lib/toast', () => ({ message: { success: vi.fn(), error: vi.fn() } }))

function renderAccount(path = '/tai-khoan/thong-tin-ca-nhan', { aiEnabled = false } = {}) {
  getAiRecommendation.mockReset()
  updateAiRecommendation.mockReset()
  getAiRecommendation.mockResolvedValue({ enabled: aiEnabled })
  updateAiRecommendation.mockImplementation(async ({ enabled }) => ({ enabled }))
  useSession.mockReturnValue({
    user: {
      email_verified: true,
      full_name: 'Ứng viên thử nghiệm',
      job_preferences_configured: true,
    },
  })

  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<CandidateAccountLayout />}>
          <Route path="/tai-khoan" element={<Navigate to="/tai-khoan/thong-tin-ca-nhan" replace />} />
          <Route path="/tai-khoan/thong-tin-ca-nhan" element={<h1>Thông tin cá nhân</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>
    </QueryClientProvider>,
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

  it('counts the CVs opened to recruiter search', async () => {
    renderAccount()

    expect(await screen.findByText('1 CV')).toBeInTheDocument()
  })

  it('keeps the root account route redirect working', () => {
    renderAccount('/tai-khoan')

    expect(screen.getByRole('heading', { name: 'Thông tin cá nhân' })).toBeInTheDocument()
  })

  it('toggles AI job recommendations from the sidebar', async () => {
    renderAccount()

    const toggle = screen.getByRole('switch', { name: 'Gợi ý việc làm' })
    await waitFor(() => expect(toggle).toBeEnabled())
    expect(toggle).not.toBeChecked()
    fireEvent.click(toggle)

    // Bật phải qua popup đồng ý; chưa xác nhận thì chưa gọi API.
    expect(await screen.findByText('Xác nhận bật Gợi ý việc làm')).toBeInTheDocument()
    expect(updateAiRecommendation).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))

    await waitFor(() => expect(toggle).toBeChecked())
    expect(updateAiRecommendation).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, source: 'account_sidebar' }),
    )
  })

  it('asks before turning recommendations off and keeps them on when cancelled', async () => {
    renderAccount(undefined, { aiEnabled: true })

    const toggle = screen.getByRole('switch', { name: 'Gợi ý việc làm' })
    await waitFor(() => expect(toggle).toBeChecked())
    fireEvent.click(toggle)

    expect(await screen.findByText('Bạn chắc chắn muốn dừng nhận việc làm phù hợp?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục nhận gợi ý việc làm' }))
    expect(updateAiRecommendation).not.toHaveBeenCalled()
    expect(toggle).toBeChecked()

    fireEvent.click(toggle)
    fireEvent.click(await screen.findByRole('button', { name: 'Tắt tính năng và tự tìm việc' }))
    await waitFor(() => expect(toggle).not.toBeChecked())
    expect(updateAiRecommendation).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }))
  })

  it('explains the toggle and links the AI data policy', async () => {
    renderAccount()

    fireEvent.click(screen.getByRole('button', { name: 'Gợi ý việc làm là gì?' }))

    expect(await screen.findByText(/dựa trên CV và nhu cầu công việc bạn đã lưu/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'công nghệ AI' })).toHaveAttribute(
      'href',
      'https://example.test/ai-policy.pdf',
    )
  })
})
