import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAiRuntimeOverview } from '@/entities/ai-runtime'
import AiRuntimeOverview from './AiRuntimeOverview'

vi.mock('@/entities/ai-runtime', () => ({ getAiRuntimeOverview: vi.fn() }))

const overview = {
  generations: {
    days_7: { completed: 8, failed: 2 },
    days_30: { apply_rate: 0.625, completed: 24, failed: 3 },
  },
  policy: { model: 'gemini-3.5-flash-lite' },
  queue: { active: 1, name: 'ai-generation', waiting: 2 },
  runtime: {
    provider: 'google',
    provider_backend: 'gemini_developer',
    status: 'ready',
  },
  usage: {
    days_7: {},
    days_30: {
      cost_usd: '0.0812',
      p95_latency_ms: 12850,
      quota_rejection_count: 4,
      total_tokens: 12345,
    },
  },
}

describe('AiRuntimeOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAiRuntimeOverview.mockResolvedValue(overview)
  })

  it('shows runtime, queue, policy and 7/30-day operational metrics', async () => {
    render(<AiRuntimeOverview />)

    expect(await screen.findByText('Vận hành AI tạo tin tuyển dụng')).toBeInTheDocument()
    expect(screen.getByText('gemini-3.5-flash-lite')).toBeInTheDocument()
    expect(screen.getByText(/ai-generation/)).toHaveTextContent('1 đang chạy')
    expect(screen.getByText(/ai-generation/)).toHaveTextContent('2 chờ')
    expect(screen.getByText('62,5%')).toBeInTheDocument()
    expect(screen.getByText('$0.0812')).toBeInTheDocument()
    expect(screen.getByText('12.345')).toBeInTheDocument()
    await waitFor(() => expect(getAiRuntimeOverview).toHaveBeenCalledOnce())
  })

  it('uses safe defaults when optional aggregates are absent', async () => {
    getAiRuntimeOverview.mockResolvedValue({ runtime: { enabled: false } })

    render(<AiRuntimeOverview />)

    expect(await screen.findByText('disabled')).toBeInTheDocument()
    expect(screen.getAllByText('0').length).toBeGreaterThan(0)
    expect(screen.getByText('ai-generation · 0 đang chạy · 0 chờ')).toBeInTheDocument()
  })

  it('recovers from an initial load failure', async () => {
    const user = userEvent.setup()
    getAiRuntimeOverview
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(overview)

    render(<AiRuntimeOverview />)

    expect(await screen.findByText('Không tải được số liệu vận hành AI tạo tin tuyển dụng.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))

    expect(await screen.findByText('Vận hành AI tạo tin tuyển dụng')).toBeInTheDocument()
    expect(getAiRuntimeOverview).toHaveBeenCalledTimes(2)
  })
})
