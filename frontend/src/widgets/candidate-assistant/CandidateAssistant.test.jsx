import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CandidateAssistant from './CandidateAssistant'

const { promptLogin, siteSettings, useConsent } = vi.hoisted(() => ({
  promptLogin: vi.fn(),
  siteSettings: { contact_zalo_url: '', hotline: '' },
  useConsent: vi.fn(),
}))

vi.mock('@/entities/consent', () => ({ useConsent }))
vi.mock('@/entities/session', () => ({ useSession: () => ({ isAuthenticated: false }) }))
vi.mock('@/entities/site-settings', () => ({
  useSiteSettings: () => ({ settings: siteSettings }),
}))
vi.mock('@/features/auth', () => ({ useLoginPrompt: () => ({ promptLogin }) }))

function renderAssistant(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CandidateAssistant />
    </MemoryRouter>,
  )
}

describe('CandidateAssistant', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    window.localStorage.clear()
    useConsent.mockReturnValue({ isDecided: true, isEnabled: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('tránh thanh ứng tuyển mobile và mở panel theo yêu cầu', async () => {
    const { container } = renderAssistant('/viec-lam/frontend-developer')
    expect(container.firstChild).toHaveStyle({ bottom: 'calc(32px + 0px + env(safe-area-inset-bottom, 0px))' })

    fireEvent.click(screen.getByRole('button', { name: 'Mở trợ lý ProCV' }))
    expect(await screen.findByRole('dialog', { name: 'Trợ lý ProCV' })).toBeInTheDocument()
    expect(screen.getByText('Trợ lý đang trong giai đoạn thử nghiệm, câu trả lời là mẫu có sẵn.')).toBeInTheDocument()
  })

  it('nâng launcher khi banner cookie đang hiển thị', () => {
    useConsent.mockReturnValue({ isDecided: false, isEnabled: true })
    const { container } = renderAssistant('/')
    expect(container.firstChild).toHaveStyle({ bottom: 'calc(160px + 0px + env(safe-area-inset-bottom, 0px))' })
  })

  it('chỉ hiện lời chào một lần trong phiên', () => {
    vi.useFakeTimers()
    const first = renderAssistant('/')
    act(() => vi.advanceTimersByTime(2500))
    expect(screen.getByRole('status')).toHaveTextContent('Mình là trợ lý ProCV')
    first.unmount()

    renderAssistant('/')
    act(() => vi.advanceTimersByTime(2500))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
