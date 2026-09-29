import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AiJobGenerationPanel from './AiJobGenerationPanel'

const apiMocks = vi.hoisted(() => ({
  cancelJobAiGeneration: vi.fn(),
  createJobAiGeneration: vi.fn(),
  getJobAiGeneration: vi.fn(),
  sendJobAiGenerationFeedback: vi.fn(),
}))

vi.mock('../api/job-ai-generation.api', () => apiMocks)
vi.mock('@/shared/ui/mascot', () => ({
  ProcvMascot: ({ emotion, float, talking }) => (
    <span
      data-testid="mascot"
      data-emotion={emotion}
      data-float={String(Boolean(float))}
      data-talking={String(Boolean(talking))}
    />
  ),
}))

function renderPanel(props = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const onSuggestionReady = vi.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <AiJobGenerationPanel
        draft={{ position: 'Kỹ sư Backend' }}
        generationPublicId="generation_1"
        mode="ai_brief"
        onChooseAnother={vi.fn()}
        onDraftChange={vi.fn()}
        onGenerationChange={vi.fn()}
        onSuggestionReady={onSuggestionReady}
        onUseManual={vi.fn()}
        {...props}
      />
    </QueryClientProvider>,
  )
  return { onSuggestionReady, queryClient }
}

describe('AiJobGenerationPanel', () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset())
  })

  it('resumes a completed generation from its public id and applies the suggestion once', async () => {
    const generation = {
      public_id: 'generation_1',
      status: 'completed',
      phase: 'completed',
      suggestion: { title: 'Kỹ sư Backend' },
      warnings: [],
    }
    apiMocks.getJobAiGeneration.mockResolvedValue(generation)
    const { onSuggestionReady, queryClient } = renderPanel()

    await waitFor(() => expect(onSuggestionReady).toHaveBeenCalledWith(generation))
    await queryClient.invalidateQueries({ queryKey: ['job-ai-generation', 'generation_1'] })
    await waitFor(() => expect(apiMocks.getJobAiGeneration).toHaveBeenCalledTimes(2))
    expect(onSuggestionReady).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('region', { name: 'Tạo tin tuyển dụng bằng AI' })).not.toBeInTheDocument()
  })

  it('shows the focused animated mascot while generation is active', async () => {
    apiMocks.getJobAiGeneration.mockResolvedValue({
      public_id: 'generation_1',
      status: 'processing',
      phase: 'generating',
    })
    renderPanel()

    expect(await screen.findByRole('heading', { name: 'Tạo bản nháp tin tuyển dụng' })).toBeVisible()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Đang viết nội dung tuyển dụng'))
    expect(screen.getByTestId('mascot')).toHaveAttribute('data-emotion', 'thinking')
    expect(screen.getByTestId('mascot')).toHaveAttribute('data-float', 'true')
    expect(screen.getByTestId('mascot')).toHaveAttribute('data-talking', 'true')
  })

  it('cancels an active generation through the owner endpoint', async () => {
    apiMocks.getJobAiGeneration.mockResolvedValue({
      public_id: 'generation_1',
      status: 'processing',
      phase: 'generating',
    })
    apiMocks.cancelJobAiGeneration.mockResolvedValue({
      public_id: 'generation_1',
      status: 'cancelled',
      phase: 'cancelled',
    })
    renderPanel()

    fireEvent.click(await screen.findByRole('button', { name: /Hủy tạo bản nháp/ }))

    await waitFor(() => expect(apiMocks.cancelJobAiGeneration).toHaveBeenCalledWith('generation_1'))
    expect(await screen.findByRole('status')).toHaveTextContent('Đã hủy yêu cầu')
  })

  it('turns terminal machine codes into actionable Vietnamese copy', async () => {
    apiMocks.getJobAiGeneration.mockResolvedValue({
      public_id: 'generation_1',
      status: 'failed',
      phase: 'failed',
      error_code: 'queue_timeout',
    })
    renderPanel()

    expect(await screen.findByText(/Hàng chờ đang quá tải/)).toBeVisible()
    expect(screen.queryByText('queue_timeout')).not.toBeInTheDocument()
    expect(screen.getByTestId('mascot')).toHaveAttribute('data-emotion', 'error')
  })

  it('shows the error mascot when the generation status request fails', async () => {
    apiMocks.getJobAiGeneration.mockRejectedValue(new Error('network unavailable'))
    renderPanel()

    expect(await screen.findByRole('heading', { name: 'Chưa thể tạo bản nháp' })).toBeVisible()
    expect(screen.getByTestId('mascot')).toHaveAttribute('data-emotion', 'error')
  })

  it('shows the error mascot when creating the generation fails', async () => {
    apiMocks.createJobAiGeneration.mockRejectedValue(new Error('provider unavailable'))
    renderPanel({ generationPublicId: null })

    fireEvent.click(screen.getByRole('button', { name: 'Tạo bản nháp bằng AI' }))

    expect(await screen.findByRole('heading', { name: 'Chưa thể tạo bản nháp' })).toBeVisible()
    expect(screen.getByTestId('mascot')).toHaveAttribute('data-emotion', 'error')
  })
})
