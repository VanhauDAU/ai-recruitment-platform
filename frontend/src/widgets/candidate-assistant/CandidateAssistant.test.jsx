import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CandidateAssistant from './CandidateAssistant'
import { findAssistantReply } from './model/use-assistant-script'

const { promptLogin, speech, useConsent } = vi.hoisted(() => ({
  promptLogin: vi.fn(),
  speech: { speak: vi.fn(), speaking: false, stop: vi.fn(), unlock: vi.fn() },
  useConsent: vi.fn(),
}))

vi.mock('@/entities/consent', () => ({ useConsent }))
vi.mock('@/entities/session', () => ({ useSession: () => ({ isAuthenticated: false }) }))
vi.mock('@/entities/site-settings', () => ({
  useSiteSettings: () => ({ settings: { contact_zalo_url: '', hotline: '' } }),
}))
vi.mock('@/features/auth', () => ({ useLoginPrompt: () => ({ promptLogin }) }))
vi.mock('@/features/speak-text', () => ({ useSpeak: () => speech }))

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
    expect(container.firstChild).toHaveStyle({ bottom: '32px' })

    fireEvent.click(screen.getByRole('button', { name: 'Mở trợ lý ProCV' }))
    expect(await screen.findByRole('dialog', { name: 'Trợ lý ProCV' })).toBeInTheDocument()
    expect(screen.getByText('Trợ lý đang trong giai đoạn thử nghiệm, câu trả lời là mẫu có sẵn.')).toBeInTheDocument()
  })

  it('nâng launcher khi banner cookie đang hiển thị', () => {
    useConsent.mockReturnValue({ isDecided: false, isEnabled: true })
    const { container } = renderAssistant('/')
    expect(container.firstChild).toHaveStyle({ bottom: '160px' })
  })

  it('đọc to câu trả lời của trợ lý sau khi người dùng gửi câu hỏi', async () => {
    renderAssistant('/')
    fireEvent.click(screen.getByRole('button', { name: 'Mở trợ lý ProCV' }))
    await screen.findByRole('dialog', { name: 'Trợ lý ProCV' })

    fireEvent.change(screen.getByLabelText('Nhập câu hỏi cho trợ lý'), {
      target: { value: 'tìm việc' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi câu hỏi' }))

    // unlock phải xảy ra ngay trong cử chỉ gửi, không đợi câu trả lời.
    expect(speech.unlock).toHaveBeenCalledTimes(1)
    // Script trả lời sau tối đa 1,1s — dài hơn timeout mặc định của waitFor.
    await waitFor(
      () => expect(speech.speak).toHaveBeenCalledWith(findAssistantReply('tìm việc').reply),
      { timeout: 2500 },
    )
  })

  it('cho phép tắt giọng đọc trợ lý', async () => {
    renderAssistant('/')
    fireEvent.click(screen.getByRole('button', { name: 'Mở trợ lý ProCV' }))
    await screen.findByRole('dialog', { name: 'Trợ lý ProCV' })

    fireEvent.click(screen.getByRole('button', { name: 'Tắt giọng đọc trợ lý' }))

    expect(speech.stop).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Bật giọng đọc trợ lý' })).toHaveAttribute('aria-pressed', 'false')
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
