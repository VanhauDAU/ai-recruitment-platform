import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CandidateAssistant from './CandidateAssistant'
import { findAssistantReply } from './model/use-assistant-script'

const { promptLogin, siteSettings, speech, useConsent } = vi.hoisted(() => ({
  promptLogin: vi.fn(),
  siteSettings: { contact_zalo_url: '', hotline: '', speech_chatbot_enabled: true },
  speech: { speak: vi.fn(), speaking: false, status: 'idle', stop: vi.fn() },
  useConsent: vi.fn(),
}))

vi.mock('@/entities/consent', () => ({ useConsent }))
vi.mock('@/entities/session', () => ({ useSession: () => ({ isAuthenticated: false }) }))
vi.mock('@/entities/site-settings', () => ({
  useSiteSettings: () => ({ settings: siteSettings }),
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
    siteSettings.speech_chatbot_enabled = true
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

  it('chỉ đọc câu trả lời sau khi người dùng bấm Nghe', async () => {
    renderAssistant('/')
    fireEvent.click(screen.getByRole('button', { name: 'Mở trợ lý ProCV' }))
    await screen.findByRole('dialog', { name: 'Trợ lý ProCV' })

    fireEvent.change(screen.getByLabelText('Nhập câu hỏi cho trợ lý'), {
      target: { value: 'tìm việc' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi câu hỏi' }))

    expect(speech.speak).not.toHaveBeenCalled()
    expect(await screen.findByText(findAssistantReply('tìm việc').reply, {}, { timeout: 2500 })).toBeInTheDocument()
    await waitFor(
      () => expect(screen.getAllByRole('button', { name: 'Nghe tin nhắn' })).toHaveLength(2),
      { timeout: 2500 },
    )
    const listenButtons = screen.getAllByRole('button', { name: 'Nghe tin nhắn' })
    fireEvent.click(listenButtons.at(-1))

    expect(speech.speak).toHaveBeenCalledWith(findAssistantReply('tìm việc').reply)
  })

  it('ẩn toàn bộ hành động nghe khi policy chatbot đang tắt', async () => {
    siteSettings.speech_chatbot_enabled = false
    renderAssistant('/')
    fireEvent.click(screen.getByRole('button', { name: 'Mở trợ lý ProCV' }))
    await screen.findByRole('dialog', { name: 'Trợ lý ProCV' })

    expect(screen.queryByRole('button', { name: 'Nghe tin nhắn' })).not.toBeInTheDocument()
    expect(speech.speak).not.toHaveBeenCalled()
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
