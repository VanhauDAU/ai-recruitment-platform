import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { describe, expect, it, vi } from 'vitest'
import FeedbackLauncher from './FeedbackLauncher'

const api = vi.hoisted(() => ({ submitFeedback: vi.fn(() => Promise.resolve({})) }))
vi.mock('../api/submit-feedback.api', () => api)
vi.mock('@/entities/account/session', () => ({ useSession: () => ({ isAuthenticated: true }) }))
vi.mock('@/entities/system/site-settings', () => ({ useSiteSettings: () => ({ siteName: 'ProCV' }) }))

describe('FeedbackLauncher', () => {
  it('opens the feedback form and reports a bug with the page and device context', async () => {
    window.history.pushState({}, '', '/viec-lam?search=python')
    render(<App><FeedbackLauncher /></App>)

    fireEvent.click(screen.getByRole('button', { name: 'Góp ý & báo lỗi' }))
    fireEvent.click(await screen.findByRole('button', { name: '🐞 Báo lỗi' }))
    fireEvent.change(screen.getByPlaceholderText(/Bạn đang làm gì thì gặp lỗi/), {
      target: { value: 'Bấm Lưu CV trên điện thoại không phản hồi.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi phản hồi' }))

    await waitFor(() => expect(api.submitFeedback).toHaveBeenCalledTimes(1))
    const payload = api.submitFeedback.mock.calls[0][0]
    expect(payload).toMatchObject({
      category: 'bug',
      content: 'Bấm Lưu CV trên điện thoại không phản hồi.',
      page_url: '/viec-lam?search=python',
    })
    expect(payload.client_info).toMatchObject({
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      standalone: false,
    })
    expect(payload.client_info.user_agent).toBe(navigator.userAgent)
  })
})
